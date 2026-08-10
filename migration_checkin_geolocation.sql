-- ============================================================
-- Migration Idempotente: Check-in por Geolocalização & RPC (V2.2)
-- Projeto: Portal do Voluntário - Apometria Elos de Amor e Paz
-- ============================================================

BEGIN;

-- 1. Tabela de Configurações Públicas da Casa (Localização GPS e Raio)
CREATE TABLE IF NOT EXISTS public.casa_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  latitude DOUBLE PRECISION NULL,
  longitude DOUBLE PRECISION NULL,
  raio_metros INTEGER NOT NULL DEFAULT 100 CHECK (raio_metros > 0),
  janela_checkin_minutos INTEGER NOT NULL DEFAULT 30 CHECK (janela_checkin_minutos >= 0),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Inserção idempotente do registro inicial com id = 1
INSERT INTO public.casa_config (id, latitude, longitude, raio_metros, janela_checkin_minutos)
VALUES (1, NULL, NULL, 100, 30)
ON CONFLICT (id) DO NOTHING;

-- Remover qr_token de casa_config caso tenha sido adicionada anteriormente (para não expor nada na tabela pública)
ALTER TABLE public.casa_config DROP COLUMN IF EXISTS qr_token;

-- 2. Tabela Separada e Protegida para Segredos de Check-in (Token QR Code)
CREATE TABLE IF NOT EXISTS public.casa_checkin_secret (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  qr_token TEXT NOT NULL DEFAULT 'LBEB-PRESENCA-2026',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Inserção idempotente do token secreto inicial
INSERT INTO public.casa_checkin_secret (id, qr_token)
VALUES (1, 'LBEB-PRESENCA-2026')
ON CONFLICT (id) DO NOTHING;

-- 3. Novas colunas na tabela presencas
ALTER TABLE public.presencas
ADD COLUMN IF NOT EXISTS checkin_method TEXT NULL,
ADD COLUMN IF NOT EXISTS checkin_distance_meters NUMERIC NULL,
ADD COLUMN IF NOT EXISTS checkin_accuracy_meters NUMERIC NULL;

-- 4. RLS para casa_config (Leitura liberada para autenticados, alteração apenas admin)
ALTER TABLE public.casa_config ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'casa_config' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.casa_config', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "casa_config_select_policy" ON public.casa_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "casa_config_update_policy" ON public.casa_config
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "casa_config_insert_policy" ON public.casa_config
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- 5. RLS para casa_checkin_secret (RESTRITO 100% A ADMINISTRADORES - Sem SELECT para voluntários)
ALTER TABLE public.casa_checkin_secret ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'casa_checkin_secret' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.casa_checkin_secret', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "casa_checkin_secret_admin_policy" ON public.casa_checkin_secret
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. Remoção de assinaturas legadas da RPC
DROP FUNCTION IF EXISTS public.realizar_checkin(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC);
DROP FUNCTION IF EXISTS public.realizar_checkin(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC, TEXT);

-- 7. Função RPC Transacional de Check-in (Geolocalização / QR Code Fallback)
CREATE OR REPLACE FUNCTION public.realizar_checkin(
  p_atividade_id UUID,
  p_method TEXT,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_accuracy NUMERIC DEFAULT NULL,
  p_qr_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_act RECORD;
  v_config RECORD;
  v_distance_meters NUMERIC;
  v_presenca_id UUID;
  v_already_checked_in BOOLEAN;
  v_now_local TIMESTAMP WITHOUT TIME ZONE;
  v_now_time TIME;
  v_today_date DATE;
  v_dow INTEGER;
  v_window_minutes INTEGER;
  v_start_window TIME;
  v_end_window TIME;
  v_dlat DOUBLE PRECISION;
  v_dlng DOUBLE PRECISION;
  v_a DOUBLE PRECISION;
  v_c DOUBLE PRECISION;
  v_official_token TEXT;
BEGIN
  -- 1. Validar Usuário Autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado.');
  END IF;

  -- 2. Buscar Atividade
  SELECT * INTO v_act FROM public.atividades WHERE id = p_atividade_id AND active = true;
  IF v_act.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Atendimento/Escala não encontrado ou inativo.');
  END IF;

  -- 3. Horário local no Brasil (São Paulo) armazenado em TIMESTAMP WITHOUT TIME ZONE
  v_now_local := NOW() AT TIME ZONE 'America/Sao_Paulo';
  v_today_date := v_now_local::date;
  v_now_time := v_now_local::time;
  v_dow := EXTRACT(DOW FROM v_now_local)::integer;

  -- Validar se a atividade é agendada para o dia atual
  IF v_act.event_date IS NOT NULL THEN
    IF v_act.event_date <> v_today_date THEN
      RETURN jsonb_build_object('success', false, 'message', 'Este atendimento não está agendado para a data de hoje.');
    END IF;
  ELSE
    IF v_act.day_of_week <> v_dow THEN
      RETURN jsonb_build_object('success', false, 'message', 'Este atendimento não está na grade do dia de hoje.');
    END IF;
  END IF;

  -- 4. Lock de Concorrência (FOR UPDATE) na seleção da presença existente
  SELECT id, qr_checkin INTO v_presenca_id, v_already_checked_in
  FROM public.presencas
  WHERE user_id = v_user_id
    AND atividade_id = p_atividade_id
    AND checkin_time >= (v_today_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
  ORDER BY checkin_time DESC
  LIMIT 1
  FOR UPDATE;

  IF v_presenca_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'no_confirmation', true,
      'message', 'Você precisa primeiro confirmar sua presença nesta atividade na Agenda antes de realizar o check-in.'
    );
  END IF;

  IF v_already_checked_in = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_done', true,
      'message', 'Seu check-in já foi realizado para esta atividade hoje.'
    );
  END IF;

  -- 5. Buscar configurações públicas da Casa (Latitude, Longitude, Raio, Janela)
  SELECT * INTO v_config FROM public.casa_config WHERE id = 1;

  -- 6. Validar janela de horário (30 min antes até 30 min depois do start_time)
  IF v_act.start_time IS NOT NULL THEN
    v_window_minutes := COALESCE(v_config.janela_checkin_minutos, 30);
    v_start_window   := v_act.start_time - (v_window_minutes || ' minutes')::INTERVAL;
    v_end_window     := v_act.start_time + (v_window_minutes || ' minutes')::INTERVAL;

    IF v_start_window < v_end_window THEN
      IF v_now_time < v_start_window OR v_now_time > v_end_window THEN
        RETURN jsonb_build_object(
          'success', false,
          'outside_window', true,
          'message', format('Fora da janela de horário permitida para check-in. O check-in para %s fica disponível de %s às %s.',
            v_act.name,
            to_char(v_start_window, 'HH24:MI'),
            to_char(v_end_window, 'HH24:MI')
          )
        );
      END IF;
    END IF;
  END IF;

  -- 7. Tratamento e Validação da Precisão do GPS (Accuracy)
  IF p_accuracy IS NOT NULL THEN
    IF p_accuracy < 0 OR p_accuracy > 10000 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Valor de precisão do GPS (accuracy) inválido.');
    END IF;
  END IF;

  -- 8. Validar Método de Check-in
  IF p_method = 'geolocation' THEN
    IF v_config.latitude IS NULL OR v_config.longitude IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'A localização da Casa ainda não foi configurada pela administração.');
    END IF;

    IF p_lat IS NULL OR p_lng IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Coordenadas GPS não recebidas do dispositivo.');
    END IF;

    -- Validar Limites Geográficos: Latitude (-90 a 90) e Longitude (-180 a 180)
    IF p_lat < -90.0 OR p_lat > 90.0 OR p_lng < -180.0 OR p_lng > 180.0 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Coordenadas de geolocalização inválidas recebidas do dispositivo.');
    END IF;

    -- Cálculo Haversine em metros
    v_dlat := radians(v_config.latitude - p_lat);
    v_dlng := radians(v_config.longitude - p_lng);
    v_a := sin(v_dlat/2.0)^2 + cos(radians(p_lat)) * cos(radians(v_config.latitude)) * sin(v_dlng/2.0)^2;
    v_c := 2.0 * atan2(sqrt(v_a), sqrt(1.0 - v_a));
    v_distance_meters := round((6371000.0 * v_c)::numeric, 1);

    IF v_distance_meters > v_config.raio_metros THEN
      RETURN jsonb_build_object(
        'success', false,
        'outside_radius', true,
        'message', 'Você precisa estar próximo à Casa para realizar o check-in.',
        'distance_meters', v_distance_meters,
        'raio_configurado', v_config.raio_metros
      );
    END IF;

  ELSIF p_method = 'qrcode' THEN
    v_distance_meters := NULL;

    -- Buscar o token secreto na tabela protegida casa_checkin_secret (acesso interno via SECURITY DEFINER)
    SELECT qr_token INTO v_official_token
    FROM public.casa_checkin_secret
    WHERE id = 1;

    v_official_token := COALESCE(v_official_token, 'LBEB-PRESENCA-2026');

    IF p_qr_token IS NULL OR p_qr_token <> v_official_token THEN
      RETURN jsonb_build_object('success', false, 'message', 'Token de QR Code inválido ou não fornecido.');
    END IF;

  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Método de check-in inválido.');
  END IF;

  -- 9. Efetivar presenças atualizando o registro existente
  UPDATE public.presencas
  SET qr_checkin = true,
      checkin_method = p_method,
      checkin_distance_meters = v_distance_meters,
      checkin_accuracy_meters = p_accuracy,
      checkin_time = now()
  WHERE id = v_presenca_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Check-in realizado com sucesso!',
    'checkin_at', to_char(v_now_local, 'HH24:MI'),
    'distance_meters', v_distance_meters
  );
END;
$$;

-- 8. Permissões explícitas da RPC
REVOKE ALL ON FUNCTION public.realizar_checkin(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realizar_checkin(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC, TEXT) TO authenticated;

-- 9. Notificar PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';

COMMIT;
