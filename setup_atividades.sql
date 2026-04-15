-- Script para Criao da Tabela de Atividades
-- Execute este script no SQL Editor do seu Painel do Supabase

-- 1. Criar a tabela se ela no existir
CREATE TABLE IF NOT EXISTS atividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  horario TEXT NOT NULL,
  descricao TEXT,
  dia_semana_index INTEGER NOT NULL, -- 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  icone TEXT DEFAULT 'verified',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Limpar dados antigos (Opcional, use com cautela)
-- TRUNCATE atividades;

-- 3. Inserir os registros solicitados para Qui, Sex e Sb
INSERT INTO atividades (nome, horario, descricao, dia_semana_index, icone)
VALUES 
  -- Quinta-feira (4)
  ('Cura Dr. Bezerra', '09:00 - 12:00', 'Sessão matutina de cura espiritual e fluidoterapia.', 4, 'medical_services'),
  ('Evangelização Infantil', '19:00 - 20:30', 'Ensino da doutrina espírita para crianças e jovens.', 4, 'child_care'),
  
  -- Sexta-feira (5)
  ('Desobsessão', '19:00', 'Trabalho especializado de auxílio a espíritos necessitados.', 5, 'psychology'),
  
  -- Sábado (6)
  ('Grupo de Estudos', '15:00 - 17:00', 'Estudo aprofundado das obras básicas de Allan Kardec.', 6, 'book');

-- 4. Exemplo de Query para o Frontend
-- SELECT * FROM atividades WHERE dia_semana_index = 4;
