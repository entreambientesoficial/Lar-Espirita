-- ============================================================
-- Migration Idempotente: Disponibilidade e Reagendamento
-- Projeto: Portal do Voluntário - Apometria Elos de Amor e Paz
-- ============================================================

BEGIN;

-- 1. Adicionar colunas de disponibilidade na tabela atendimento_pessoas (Idempotente)
ALTER TABLE public.atendimento_pessoas 
ADD COLUMN IF NOT EXISTS dias_disponiveis JSONB NULL,
ADD COLUMN IF NOT EXISTS periodos_disponiveis JSONB NULL,
ADD COLUMN IF NOT EXISTS datas_indisponiveis JSONB NULL,
ADD COLUMN IF NOT EXISTS observacoes_disponibilidade TEXT NULL;

COMMIT;
