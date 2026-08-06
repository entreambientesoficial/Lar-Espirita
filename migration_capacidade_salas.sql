-- ============================================================
-- Migration Idempotente e Transacional: Capacidade por Salas
-- Projeto: Portal do Voluntário - Apometria Elos de Amor e Paz
-- ============================================================

BEGIN;

-- 1. Adicionar colunas quantidade_salas e atendimentos_por_sala à tabela atendimento_capacidades (Idempotente)
ALTER TABLE public.atendimento_capacidades 
ADD COLUMN IF NOT EXISTS quantidade_salas INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS atendimentos_por_sala INTEGER NOT NULL DEFAULT 3;

-- 2. Constraints de Validação (Idempotente)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_quantidade_salas_positive' 
      AND conrelid = 'public.atendimento_capacidades'::regclass
  ) THEN
    ALTER TABLE public.atendimento_capacidades 
    ADD CONSTRAINT check_quantidade_salas_positive 
    CHECK (quantidade_salas >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_atendimentos_por_sala_positive' 
      AND conrelid = 'public.atendimento_capacidades'::regclass
  ) THEN
    ALTER TABLE public.atendimento_capacidades 
    ADD CONSTRAINT check_atendimentos_por_sala_positive 
    CHECK (atendimentos_por_sala >= 1);
  END IF;
END $$;

-- 3. Atualizar todos os registros existentes para 3 salas, 3 atendimentos e capacidade calculada 9
UPDATE public.atendimento_capacidades
SET quantidade_salas = COALESCE(NULLIF(quantidade_salas, 0), 3),
    atendimentos_por_sala = COALESCE(NULLIF(atendimentos_por_sala, 0), 3),
    capacidade = COALESCE(quantidade_salas, 3) * COALESCE(atendimentos_por_sala, 3),
    updated_at = NOW();

COMMIT;
