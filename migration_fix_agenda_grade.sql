-- ============================================================
-- Migration Idempotente: Ajuste da Grade Regular de Apometria
-- Projeto: Portal do Voluntário - Apometria Elos de Amor e Paz
-- Executar no Supabase SQL Editor
-- ============================================================

BEGIN;

-- 1. Desativar a sessão da Tarde (13:30) na Terça-feira (2) e Quinta-feira (4)
UPDATE public.atividades
SET active = false
WHERE event_date IS NULL
  AND start_time = '13:30:00'
  AND day_of_week IN (2, 4);

-- 2. Terça-feira (2): Apenas Noite (19:00 - 22:00)
INSERT INTO public.atividades (name, time_range, start_time, end_time, description, day_of_week, icon, active, event_date)
SELECT 'Apometria', '19:00 – 22:00', '19:00:00', '22:00:00', 'Atendimento de Apometria - Período da Noite.', 2, 'self_improvement', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.atividades 
  WHERE day_of_week = 2 AND start_time = '19:00:00' AND event_date IS NULL
);

UPDATE public.atividades
SET active = true, description = 'Atendimento de Apometria - Período da Noite.'
WHERE day_of_week = 2 AND start_time = '19:00:00' AND event_date IS NULL;

-- 3. Quarta-feira (3): Duas Sessões - Tarde (13:30 - 16:30) e Noite (19:00 - 22:00)
INSERT INTO public.atividades (name, time_range, start_time, end_time, description, day_of_week, icon, active, event_date)
SELECT 'Apometria', '13:30 – 16:30', '13:30:00', '16:30:00', 'Atendimento de Apometria - Período da Tarde.', 3, 'self_improvement', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.atividades 
  WHERE day_of_week = 3 AND start_time = '13:30:00' AND event_date IS NULL
);

UPDATE public.atividades
SET active = true, description = 'Atendimento de Apometria - Período da Tarde.'
WHERE day_of_week = 3 AND start_time = '13:30:00' AND event_date IS NULL;

INSERT INTO public.atividades (name, time_range, start_time, end_time, description, day_of_week, icon, active, event_date)
SELECT 'Apometria', '19:00 – 22:00', '19:00:00', '22:00:00', 'Atendimento de Apometria - Período da Noite.', 3, 'self_improvement', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.atividades 
  WHERE day_of_week = 3 AND start_time = '19:00:00' AND event_date IS NULL
);

UPDATE public.atividades
SET active = true, description = 'Atendimento de Apometria - Período da Noite.'
WHERE day_of_week = 3 AND start_time = '19:00:00' AND event_date IS NULL;

-- 4. Quinta-feira (4): Apenas Noite (19:00 - 22:00)
INSERT INTO public.atividades (name, time_range, start_time, end_time, description, day_of_week, icon, active, event_date)
SELECT 'Apometria', '19:00 – 22:00', '19:00:00', '22:00:00', 'Atendimento de Apometria - Período da Noite.', 4, 'self_improvement', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.atividades 
  WHERE day_of_week = 4 AND start_time = '19:00:00' AND event_date IS NULL
);

UPDATE public.atividades
SET active = true, description = 'Atendimento de Apometria - Período da Noite.'
WHERE day_of_week = 4 AND start_time = '19:00:00' AND event_date IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
