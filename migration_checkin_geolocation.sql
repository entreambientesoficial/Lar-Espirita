-- ============================================================
-- Migration Idempotente: Check-in por Geolocalização & RPC
-- Projeto: Portal do Voluntário - Apometria Elos de Amor e Paz
-- ============================================================

BEGIN;

-- 1. Tabela de Configurações da Casa (Localização GPS e Raio)
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

-- 2. Novas colunas na tabela presencas
ALTER TABLE public.presencas
ADD COLUMN IF NOT EXISTS checkin_method TEXT NULL,
ADD COLUMN IF NOT EXISTS checkin_distance_meters NUMERIC NULL,
ADD COLUMN IF NOT EXISTS checkin_accuracy_meters NUMERIC NULL;

-- 3. RLS para casa_config
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

-- 4. Função RPC Transacional de Check-in (Geolocalização / QR Code Fallback)
CREATE OR REPLACE FUNCTION public.realizar_checkin(
  p_atividade_id UUID,
  p_method TEXT,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_accuracy NUMERIC DEFAULT NULL
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
  v_now TIMESTAMPTZ;
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

  -- Horário local no Brasil (São Paulo, UTC-3)
  v_now := NOW() AT TIME ZONE 'America/Sao_Paulo';
  v_today_date := v_now::date;
  v_now_time := v_now::time;
  v_dow := EXTRACT(DOW FROM v_now)::integer;

  -- 3. Validar se a atividade é agendada para o dia atual
  IF v_act.event_date IS NOT NULL THEN
    IF v_act.event_date <> v_today_date THEN
      RETURN jsonb_build_object('success', false, 'message', 'Este atendimento não está agendado para a data de hoje.');
    END IF;
  ELSE
    IF v_act.day_of_week <> v_dow THEN
      RETURN jsonb_build_object('success', false, 'message', 'Este atendimento não está na grade do dia de hoje.');
    END IF;
  END IF;

  -- 4. Validar se o usuário possui confirmação prévia para essa atividade hoje em presencas
  SELECT id, qr_checkin INTO v_presenca_id, v_already_checked_in
  FROM public.presencas
  WHERE user_id = v_user_id
    AND atividade_id = p_atividade_id
    AND checkin_time >= (v_today_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
  ORDER BY checkin_time DESC
  LIMIT 1;

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

  -- 5. Buscar configurações da Casa
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

  -- 7. Validar método de check-in (Geolocalização / QR Code)
  IF p_method = 'geolocation' THEN
    IF v_config.latitude IS NULL OR v_config.longitude IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'A localização da Casa ainda não foi configurada pela administração.');
    END IF;

    IF p_lat IS NULL OR p_lng IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Coordenadas GPS não recebidas do dispositivo.');
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
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Método de check-in inválido.');
  END IF;

  -- 8. Efetivar presenças atualizando o registro existente
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
    'checkin_at', to_char(v_now, 'HH24:MI'),
    'distance_meters', v_distance_meters
  );
END;
$$;

COMMIT;
