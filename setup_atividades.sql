-- ============================================================
-- Script de População da Tabela de Atividades
-- Lar Beneficente Eurípedes Barsanulfo
--
-- SEGURO: não usa TRUNCATE (presencas tem FK para atividades).
-- Apaga apenas os dias SEM registros de presença (1, 2, 3, 6)
-- e insere as atividades corretas para todos os dias.
-- Execute no SQL Editor do painel do Supabase.
-- ============================================================

-- 1. Remove apenas os dias que não têm presenças associadas
--    (dias que estavam faltando na agenda)
DELETE FROM atividades WHERE day_of_week IN (1, 2, 3, 6);

-- 2. Insere os dias que estavam faltando + sábado atualizado
INSERT INTO atividades (name, time_range, description, day_of_week, icon) VALUES

  -- Segunda-feira (1)
  ('Apometria',                   '19:00',         'Trabalho de desobstrução e harmonização espiritual via apometria.',          1, 'self_improvement'),
  ('Cura Dr. Bezerra de Menezes', '19:00',         'Sessão de cura espiritual e fluidoterapia com a corrente do Dr. Bezerra.',  1, 'medical_services'),

  -- Terça-feira (2)
  ('Cura Quântica',               '19:00',         'Atendimento de cura com técnicas quânticas e espirituais.',                 2, 'blur_circular'),
  ('Mesa Branca',                 '20:00',         'Trabalho mediúnico de mesa branca para auxílio espiritual.',                2, 'groups'),

  -- Quarta-feira (3)
  ('Reiki',                       '19:00',         'Canalização de energia vital para equilíbrio físico e espiritual.',         3, 'spa'),
  ('Reiki em Animais',            '19:00',         'Aplicação de Reiki em animais de estimação e silvestres.',                  3, 'pets'),

  -- Sábado (6)
  ('Grupo de Estudos Espirituais','15:00 – 17:00', 'Estudo aprofundado das obras básicas de Allan Kardec e Chico Xavier.',     6, 'book');

-- 3. Confirma o resultado completo
SELECT day_of_week, name, time_range
FROM atividades
ORDER BY day_of_week, time_range;
