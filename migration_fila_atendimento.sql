-- ============================================================
-- Migration Idempotente: Módulo Fila de Atendimento Publico
-- Projeto: Portal do Voluntário - Apometria Elos de Amor e Paz
-- ============================================================

BEGIN;

-- 1. Tabela: atendimento_pessoas (Pessoas na Fila de Espera)
CREATE TABLE IF NOT EXISTS public.atendimento_pessoas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    telefone TEXT NULL,
    tipo_atendimento TEXT NOT NULL DEFAULT 'Apometria',
    prioridade TEXT NOT NULL DEFAULT 'Normal' CHECK (prioridade IN ('Normal', 'Urgente')),
    motivo_urgencia TEXT NULL,
    observacoes TEXT NULL,
    data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'programado', 'compareceu', 'atendido', 'nao_compareceu', 'cancelado')),
    posicao_fila INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela: atendimento_programacoes (Agendamento em Sessões Específicas)
CREATE TABLE IF NOT EXISTS public.atendimento_programacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pessoa_id UUID NOT NULL REFERENCES public.atendimento_pessoas(id) ON DELETE RESTRICT,
    atividade_id UUID NOT NULL REFERENCES public.atividades(id) ON DELETE RESTRICT,
    event_date DATE NOT NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    ordem_sessao INTEGER NOT NULL DEFAULT 1,
    prioridade TEXT NOT NULL DEFAULT 'Normal' CHECK (prioridade IN ('Normal', 'Urgente')),
    status TEXT NOT NULL DEFAULT 'programado' CHECK (status IN ('programado', 'compareceu', 'atendido', 'nao_compareceu', 'cancelado')),
    observacoes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela: atendimento_capacidades (Capacidade Máxima por Atendimento/Sessão)
CREATE TABLE IF NOT EXISTS public.atendimento_capacidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atividade_id UUID NOT NULL UNIQUE REFERENCES public.atividades(id) ON DELETE RESTRICT,
    capacidade INTEGER NOT NULL DEFAULT 6 CHECK (capacidade >= 1),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela: atendimento_historico (Log Auditoria de Ações)
CREATE TABLE IF NOT EXISTS public.atendimento_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pessoa_id UUID NOT NULL REFERENCES public.atendimento_pessoas(id) ON DELETE RESTRICT,
    programacao_id UUID NULL REFERENCES public.atendimento_programacoes(id) ON DELETE SET NULL,
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    dados_anteriores JSONB NULL,
    dados_novos JSONB NULL,
    observacao TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Índices de Otimização
CREATE INDEX IF NOT EXISTS idx_atendimento_pessoas_posicao ON public.atendimento_pessoas(posicao_fila) WHERE status = 'aguardando';
CREATE INDEX IF NOT EXISTS idx_atendimento_pessoas_status ON public.atendimento_pessoas(status);
CREATE INDEX IF NOT EXISTS idx_atendimento_programacoes_date ON public.atendimento_programacoes(event_date, atividade_id);
CREATE INDEX IF NOT EXISTS idx_atendimento_programacoes_pessoa ON public.atendimento_programacoes(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_atendimento_historico_pessoa ON public.atendimento_historico(pessoa_id);

-- 6. Habilitação de RLS e Políticas de Acesso (Exclusivas para Administrators)

ALTER TABLE public.atendimento_pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_programacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_capacidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimento_historico ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
  tbl TEXT;
  r RECORD;
BEGIN
  FOR tbl IN VALUES ('atendimento_pessoas'), ('atendimento_programacoes'), ('atendimento_capacidades'), ('atendimento_historico') LOOP
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public') LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- atendimento_pessoas policies
CREATE POLICY "atendimento_pessoas_select" ON public.atendimento_pessoas FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "atendimento_pessoas_insert" ON public.atendimento_pessoas FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "atendimento_pessoas_update" ON public.atendimento_pessoas FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "atendimento_pessoas_delete" ON public.atendimento_pessoas FOR DELETE TO authenticated USING (public.is_admin());

-- atendimento_programacoes policies
CREATE POLICY "atendimento_programacoes_select" ON public.atendimento_programacoes FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "atendimento_programacoes_insert" ON public.atendimento_programacoes FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "atendimento_programacoes_update" ON public.atendimento_programacoes FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "atendimento_programacoes_delete" ON public.atendimento_programacoes FOR DELETE TO authenticated USING (public.is_admin());

-- atendimento_capacidades policies
CREATE POLICY "atendimento_capacidades_select" ON public.atendimento_capacidades FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "atendimento_capacidades_insert" ON public.atendimento_capacidades FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "atendimento_capacidades_update" ON public.atendimento_capacidades FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "atendimento_capacidades_delete" ON public.atendimento_capacidades FOR DELETE TO authenticated USING (public.is_admin());

-- atendimento_historico policies
CREATE POLICY "atendimento_historico_select" ON public.atendimento_historico FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "atendimento_historico_insert" ON public.atendimento_historico FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "atendimento_historico_update" ON public.atendimento_historico FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "atendimento_historico_delete" ON public.atendimento_historico FOR DELETE TO authenticated USING (public.is_admin());

-- 7. Popula capacidades padrão (6 pessoas por vaga em atividades ativas regulares)
INSERT INTO public.atendimento_capacidades (atividade_id, capacidade, active)
SELECT id, 6, true FROM public.atividades WHERE active = true AND event_date IS NULL
ON CONFLICT (atividade_id) DO NOTHING;

COMMIT;
