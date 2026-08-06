-- ============================================================
-- Migration Idempotente: Nova Agenda e Atendimentos Extras
-- Projeto: Portal do Voluntário - Apometria Elos de Amor e Paz
-- ============================================================

BEGIN;

-- 1. Colunas adicionais na tabela atividades
ALTER TABLE public.atividades
ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS event_date DATE NULL,
ADD COLUMN IF NOT EXISTS start_time TIME NULL,
ADD COLUMN IF NOT EXISTS end_time TIME NULL;

-- 2. Constraints de integridade de horários
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_times_both_or_neither' 
      AND conrelid = 'public.atividades'::regclass
  ) THEN
    ALTER TABLE public.atividades 
    ADD CONSTRAINT check_times_both_or_neither 
    CHECK ((start_time IS NULL AND end_time IS NULL) OR (start_time IS NOT NULL AND end_time IS NOT NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_end_after_start' 
      AND conrelid = 'public.atividades'::regclass
  ) THEN
    ALTER TABLE public.atividades 
    ADD CONSTRAINT check_end_after_start 
    CHECK (start_time IS NULL OR end_time > start_time);
  END IF;
END $$;

-- 3. Índices de Otimização e Unicidade
CREATE INDEX IF NOT EXISTS idx_atividades_active_day ON public.atividades(active, day_of_week);
CREATE INDEX IF NOT EXISTS idx_atividades_event_date ON public.atividades(event_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_regular_active_slot 
ON public.atividades (day_of_week, name, start_time) 
WHERE (active = true AND event_date IS NULL AND start_time IS NOT NULL);

-- 4. Desativação Idempotente de Atividades Antigas (Somente as que não possuem start_time preenchido)
UPDATE public.atividades 
SET active = false 
WHERE start_time IS NULL AND event_date IS NULL;

-- 5. Inserção Idempotente da Nova Grade Regular de Apometria

-- Terça-feira (2)
INSERT INTO public.atividades (name, time_range, start_time, end_time, description, day_of_week, icon, active, event_date)
SELECT 'Apometria', '13:30 – 16:30', '13:30:00', '16:30:00', 'Atendimento de Apometria - Período da Tarde.', 2, 'self_improvement', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.atividades WHERE day_of_week = 2 AND name = 'Apometria' AND start_time = '13:30:00' AND event_date IS NULL);

INSERT INTO public.atividades (name, time_range, start_time, end_time, description, day_of_week, icon, active, event_date)
SELECT 'Apometria', '19:00 – 22:00', '19:00:00', '22:00:00', 'Atendimento de Apometria - Período da Noite.', 2, 'self_improvement', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.atividades WHERE day_of_week = 2 AND name = 'Apometria' AND start_time = '19:00:00' AND event_date IS NULL);

-- Quarta-feira (3)
INSERT INTO public.atividades (name, time_range, start_time, end_time, description, day_of_week, icon, active, event_date)
SELECT 'Apometria', '13:30 – 16:30', '13:30:00', '16:30:00', 'Atendimento de Apometria - Período da Tarde.', 3, 'self_improvement', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.atividades WHERE day_of_week = 3 AND name = 'Apometria' AND start_time = '13:30:00' AND event_date IS NULL);

INSERT INTO public.atividades (name, time_range, start_time, end_time, description, day_of_week, icon, active, event_date)
SELECT 'Apometria', '19:00 – 22:00', '19:00:00', '22:00:00', 'Atendimento de Apometria - Período da Noite.', 3, 'self_improvement', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.atividades WHERE day_of_week = 3 AND name = 'Apometria' AND start_time = '19:00:00' AND event_date IS NULL);

-- Quinta-feira (4)
INSERT INTO public.atividades (name, time_range, start_time, end_time, description, day_of_week, icon, active, event_date)
SELECT 'Apometria', '13:30 – 16:30', '13:30:00', '16:30:00', 'Atendimento de Apometria - Período da Tarde.', 4, 'self_improvement', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.atividades WHERE day_of_week = 4 AND name = 'Apometria' AND start_time = '13:30:00' AND event_date IS NULL);

INSERT INTO public.atividades (name, time_range, start_time, end_time, description, day_of_week, icon, active, event_date)
SELECT 'Apometria', '19:00 – 22:00', '19:00:00', '22:00:00', 'Atendimento de Apometria - Período da Noite.', 4, 'self_improvement', true, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.atividades WHERE day_of_week = 4 AND name = 'Apometria' AND start_time = '19:00:00' AND event_date IS NULL);

-- 6. Políticas RLS
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'atividades' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.atividades', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "atividades_select_policy" ON public.atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "atividades_insert_policy" ON public.atividades FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "atividades_update_policy" ON public.atividades FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "atividades_delete_policy" ON public.atividades FOR DELETE TO authenticated USING (public.is_admin());

COMMIT;
