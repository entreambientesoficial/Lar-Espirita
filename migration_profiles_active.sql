-- ====================================================
-- MIGRATION: ADICIONAR COLUNA 'active' EM public.profiles
-- ====================================================
-- Descrição: Permite o controle operacional do status de atuação do médium na Casa (Ativo / Inativo).
-- Não bloqueia a autenticação do usuário.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Força a atualização do cache do Schema do PostgREST
NOTIFY pgrst, 'reload schema';
