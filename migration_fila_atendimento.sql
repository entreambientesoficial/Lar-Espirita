-- ============================================================
-- Migration Idempotente e Transacional: Módulo Fila de Atendimento
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
    posicao_fila INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir que a coluna posicao_fila seja NULLABLE se a tabela já existia
ALTER TABLE public.atendimento_pessoas ALTER COLUMN posicao_fila DROP NOT NULL;

-- Constraint Idempotente de Coerência de Posição
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_posicao_fila_positive' 
      AND conrelid = 'public.atendimento_pessoas'::regclass
  ) THEN
    ALTER TABLE public.atendimento_pessoas DROP CONSTRAINT check_posicao_fila_positive;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_posicao_fila_coherency' 
      AND conrelid = 'public.atendimento_pessoas'::regclass
  ) THEN
    ALTER TABLE public.atendimento_pessoas 
    ADD CONSTRAINT check_posicao_fila_coherency 
    CHECK (
      (status = 'aguardando' AND posicao_fila IS NOT NULL AND posicao_fila >= 1) OR
      (status != 'aguardando' AND posicao_fila IS NULL)
    );
  END IF;
END $$;

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

-- 4. Tabela: atendimento_historico (Log Auditoria de Ações - IMUTÁVEL)
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

-- 5. Índices de Otimização e Unicidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_posicao_aguardando 
ON public.atendimento_pessoas (posicao_fila) 
WHERE (status = 'aguardando');

CREATE INDEX IF NOT EXISTS idx_atendimento_pessoas_status ON public.atendimento_pessoas(status);
CREATE INDEX IF NOT EXISTS idx_atendimento_programacoes_date ON public.atendimento_programacoes(event_date, atividade_id);
CREATE INDEX IF NOT EXISTS idx_atendimento_programacoes_pessoa ON public.atendimento_programacoes(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_atendimento_historico_pessoa ON public.atendimento_historico(pessoa_id);

-- 6. Habilitação de RLS e Políticas de Acesso Restritas

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

-- atendimento_historico policies (IMUTÁVEL: Apenas SELECT e INSERT. Proibido UPDATE e DELETE)
CREATE POLICY "atendimento_historico_select" ON public.atendimento_historico FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "atendimento_historico_insert" ON public.atendimento_historico FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- 7. Popula capacidades padrão (6 vagas por atividade regular ativa)
INSERT INTO public.atendimento_capacidades (atividade_id, capacidade, active)
SELECT id, 6, true FROM public.atividades WHERE active = true AND event_date IS NULL
ON CONFLICT (atividade_id) DO NOTHING;

-- ============================================================
-- 8. FUNÇÕES INTERNAS E RPCs TRANSACIONAIS (SECURITY DEFINER)
-- ============================================================

-- FUNÇÃO INTERNA: Inserção / Retorno Seguro na Fila sem Conflito de Índice Único
CREATE OR REPLACE FUNCTION public._atendimento_inserir_na_fila_seguro(
  p_pessoa_id UUID,
  p_target_pos INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_old_pos INT;
  v_status TEXT;
  v_max_pos INT;
  v_final_pos INT;
  v_offset INT;
BEGIN
  -- Advisory lock transacional
  PERFORM pg_advisory_xact_lock(74639201);

  SELECT posicao_fila, status INTO v_old_pos, v_status
  FROM public.atendimento_pessoas
  WHERE id = p_pessoa_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Pessoa não encontrada.';
  END IF;

  -- Se a pessoa já está aguardando, delega para mover posição
  IF v_status = 'aguardando' THEN
    PERFORM public.atendimento_mover_posicao(p_pessoa_id, p_target_pos);
    RETURN p_target_pos;
  END IF;

  SELECT COUNT(*) INTO v_max_pos 
  FROM public.atendimento_pessoas 
  WHERE status = 'aguardando';

  -- Offset dinâmico baseado no maior valor atual
  SELECT COALESCE(MAX(posicao_fila), 0) + 1000000 INTO v_offset 
  FROM public.atendimento_pessoas 
  WHERE status = 'aguardando';

  v_final_pos := GREATEST(1, LEAST(COALESCE(p_target_pos, 1), v_max_pos + 1));

  -- 1. Abre espaço na posição desejada (Deslocamento em 2 etapas)
  IF v_final_pos <= v_max_pos THEN
    UPDATE public.atendimento_pessoas
    SET posicao_fila = posicao_fila + v_offset
    WHERE status = 'aguardando' AND posicao_fila >= v_final_pos;

    UPDATE public.atendimento_pessoas
    SET posicao_fila = (posicao_fila - v_offset) + 1
    WHERE status = 'aguardando' AND posicao_fila >= v_offset;
  END IF;

  -- 2. Define o status como aguardando e atribui a posição final aberta simultaneamente
  UPDATE public.atendimento_pessoas
  SET status = 'aguardando',
      posicao_fila = v_final_pos,
      updated_at = NOW()
  WHERE id = p_pessoa_id;

  RETURN v_final_pos;
END;
$$;

-- RPC 1: Cadastrar Pessoa com Advisory Lock e Deslocamento Seguro
CREATE OR REPLACE FUNCTION public.atendimento_cadastrar_pessoa(
  p_nome TEXT,
  p_telefone TEXT,
  p_tipo_atendimento TEXT,
  p_prioridade TEXT,
  p_motivo_urgencia TEXT,
  p_observacoes TEXT,
  p_data_entrada DATE,
  p_place_as_priority BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
  v_target_pos INT;
  v_offset INT;
  v_new_person public.atendimento_pessoas;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem executar esta ação.';
  END IF;

  v_admin_id := auth.uid();

  -- Validações de entrada
  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RAISE EXCEPTION 'O nome da pessoa não pode ficar em branco.';
  END IF;

  IF p_prioridade NOT IN ('Normal', 'Urgente') THEN
    RAISE EXCEPTION 'Prioridade inválida. Use Normal ou Urgente.';
  END IF;

  IF p_prioridade = 'Urgente' AND (p_motivo_urgencia IS NULL OR trim(p_motivo_urgencia) = '') THEN
    RAISE EXCEPTION 'Para atendimentos urgentes, o motivo da urgência é obrigatório.';
  END IF;

  -- Advisory lock transacional
  PERFORM pg_advisory_xact_lock(74639201);

  SELECT COALESCE(MAX(posicao_fila), 0) + 1000000 INTO v_offset 
  FROM public.atendimento_pessoas 
  WHERE status = 'aguardando';

  IF p_place_as_priority THEN
    v_target_pos := 1;
    -- Deslocamento seguro em 2 etapas
    UPDATE public.atendimento_pessoas 
    SET posicao_fila = posicao_fila + v_offset 
    WHERE status = 'aguardando';

    UPDATE public.atendimento_pessoas 
    SET posicao_fila = (posicao_fila - v_offset) + 1 
    WHERE status = 'aguardando' AND posicao_fila >= v_offset;
  ELSE
    SELECT COALESCE(MAX(posicao_fila), 0) + 1 
    INTO v_target_pos 
    FROM public.atendimento_pessoas 
    WHERE status = 'aguardando';
  END IF;

  INSERT INTO public.atendimento_pessoas (
    nome, telefone, tipo_atendimento, prioridade, motivo_urgencia, observacoes, data_entrada, status, posicao_fila
  ) VALUES (
    trim(p_nome),
    NULLIF(trim(p_telefone), ''),
    COALESCE(NULLIF(trim(p_tipo_atendimento), ''), 'Apometria'),
    COALESCE(p_prioridade, 'Normal'),
    CASE WHEN p_prioridade = 'Urgente' THEN trim(p_motivo_urgencia) ELSE NULL END,
    NULLIF(trim(p_observacoes), ''),
    COALESCE(p_data_entrada, CURRENT_DATE),
    'aguardando',
    v_target_pos
  ) RETURNING * INTO v_new_person;

  -- Log de auditoria
  INSERT INTO public.atendimento_historico (
    pessoa_id, admin_id, action, dados_novos, observacao
  ) VALUES (
    v_new_person.id,
    v_admin_id,
    'CADASTRO_PESSOA',
    to_jsonb(v_new_person),
    CASE WHEN p_place_as_priority THEN 'Cadastrado como urgência na 1ª posição da fila.' ELSE format('Cadastrado na posição #%s.', v_target_pos) END
  );

  RETURN to_jsonb(v_new_person);
END;
$$;

-- RPC 1.1: Cadastrar e Programar Imediatamente Paciente Urgente com Reagendamento Automático em Vaga Futura
CREATE OR REPLACE FUNCTION public.atendimento_cadastrar_e_programar_urgente(
  p_nome TEXT,
  p_telefone TEXT,
  p_tipo_atendimento TEXT,
  p_motivo_urgencia TEXT,
  p_observacoes TEXT,
  p_data_entrada DATE,
  p_atividade_id UUID,
  p_event_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_force_over_capacity BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
  v_new_person public.atendimento_pessoas;
  v_cap_max INT;
  v_count INT;
  v_last_normal_prog public.atendimento_programacoes;
  v_next_date DATE;
  v_search_date DATE;
  v_found_slot BOOLEAN := false;
  v_future_count INT;
  v_atv_dow INT;
  v_atv_event_date DATE;
  v_atv_start TIME;
  v_atv_end TIME;
  v_new_prog public.atendimento_programacoes;
  v_reagendado_prog public.atendimento_programacoes;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem executar esta ação.';
  END IF;

  v_admin_id := auth.uid();

  PERFORM pg_advisory_xact_lock(74639201);

  -- Validações básicas de entrada
  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RAISE EXCEPTION 'O nome da pessoa não pode ficar em branco.';
  END IF;

  IF p_motivo_urgencia IS NULL OR trim(p_motivo_urgencia) = '' THEN
    RAISE EXCEPTION 'Para atendimentos urgentes, o motivo da urgência é obrigatório.';
  END IF;

  SELECT event_date, day_of_week, start_time, end_time 
  INTO v_atv_event_date, v_atv_dow, v_atv_start, v_atv_end
  FROM public.atividades
  WHERE id = p_atividade_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A atividade/sessão selecionada é inválida ou está inativa.';
  END IF;

  IF p_event_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'A data do atendimento não pode ser anterior à data atual.';
  END IF;

  IF v_atv_event_date IS NULL THEN
    IF v_atv_dow IS NOT NULL AND EXTRACT(DOW FROM p_event_date)::INTEGER != v_atv_dow THEN
      RAISE EXCEPTION 'A data selecionada (%s) não corresponde ao dia da semana oficial desta atividade regular.', p_event_date;
    END IF;
  ELSE
    IF p_event_date != v_atv_event_date THEN
      RAISE EXCEPTION 'Para atendimentos extras, a data informada (%s) deve ser exatamente igual à data cadastrada no evento (%s).', p_event_date, v_atv_event_date;
    END IF;
  END IF;

  -- Busca capacidade máxima e agendamentos atuais na sessão
  SELECT COALESCE(capacidade, 6) INTO v_cap_max
  FROM public.atendimento_capacidades
  WHERE atividade_id = p_atividade_id;
  IF v_cap_max IS NULL THEN v_cap_max := 6; END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.atendimento_programacoes
  WHERE atividade_id = p_atividade_id AND event_date = p_event_date AND status != 'cancelado';

  -- Se sessão estiver cheia
  IF v_count >= v_cap_max THEN
    IF NOT p_force_over_capacity THEN
      RAISE EXCEPTION 'A sessão selecionada já atingiu a capacidade máxima (%s vagas). Marque a opção "Ignorar capacidade e encaixar como urgência" para realizar o remanejamento.', v_cap_max;
    END IF;

    -- Localiza o último paciente NORMAL programado nesta sessão
    SELECT * INTO v_last_normal_prog
    FROM public.atendimento_programacoes
    WHERE atividade_id = p_atividade_id AND event_date = p_event_date AND status = 'programado' AND prioridade = 'Normal'
    ORDER BY ordem_sessao DESC
    LIMIT 1;

    IF v_last_normal_prog.id IS NULL THEN
      RAISE EXCEPTION 'A sessão está cheia apenas com pacientes Urgentes. Não há nenhum paciente Normal que possa ser remanejado nesta sessão.';
    END IF;

    -- Busca próxima sessão futura com vaga disponível (até 52 semanas no futuro)
    IF v_atv_event_date IS NULL THEN
      v_search_date := p_event_date + INTERVAL '7 days';
      FOR i IN 1..52 LOOP
        SELECT COUNT(*) INTO v_future_count
        FROM public.atendimento_programacoes
        WHERE atividade_id = p_atividade_id AND event_date = v_search_date AND status != 'cancelado';

        IF v_future_count < v_cap_max THEN
          v_next_date := v_search_date;
          v_found_slot := true;
          EXIT;
        END IF;
        v_search_date := v_search_date + INTERVAL '7 days';
      END LOOP;
    ELSE
      SELECT event_date INTO v_next_date
      FROM public.atividades
      WHERE name = (SELECT name FROM public.atividades WHERE id = p_atividade_id)
        AND active = true
        AND event_date > p_event_date
      ORDER BY event_date ASC
      LIMIT 1;

      IF v_next_date IS NOT NULL THEN
        SELECT COUNT(*) INTO v_future_count
        FROM public.atendimento_programacoes
        WHERE atividade_id = p_atividade_id AND event_date = v_next_date AND status != 'cancelado';
        IF v_future_count < v_cap_max THEN
          v_found_slot := true;
        END IF;
      END IF;
    END IF;

    IF NOT v_found_slot OR v_next_date IS NULL THEN
      RAISE EXCEPTION 'Não foi encontrada nenhuma sessão futura com vaga disponível para reagendar o paciente desencaixado. Operação cancelada.';
    END IF;

    -- Cancela o agendamento atual da pessoa normal
    UPDATE public.atendimento_programacoes
    SET status = 'cancelado', updated_at = NOW()
    WHERE id = v_last_normal_prog.id;

    -- Reagenda o paciente normal diretamente para a próxima sessão futura com vaga
    INSERT INTO public.atendimento_programacoes (
      pessoa_id, atividade_id, event_date, start_time, end_time, ordem_sessao, prioridade, status, observacoes
    ) VALUES (
      v_last_normal_prog.pessoa_id, p_atividade_id, v_next_date, COALESCE(p_start_time, v_atv_start), COALESCE(p_end_time, v_atv_end), v_future_count + 1, 'Normal', 'programado', 'Reagendado automaticamente devido a encaixe de urgência'
    ) RETURNING * INTO v_reagendado_prog;

    INSERT INTO public.atendimento_historico (
      pessoa_id, programacao_id, admin_id, action, dados_anteriores, dados_novos, observacao
    ) VALUES (
      v_last_normal_prog.pessoa_id,
      v_reagendado_prog.id,
      v_admin_id,
      'REMANEJAMENTO_URGENCIA_REAGENDADO',
      to_jsonb(v_last_normal_prog),
      to_jsonb(v_reagendado_prog),
      format('Desencaixado da sessão do dia %s devido a urgência e reagendado automaticamente para a próxima sessão livre em %s.', p_event_date, v_next_date)
    );
  END IF;

  -- 4. Cadastra a nova pessoa urgente com status = 'programado' e posicao_fila = NULL
  INSERT INTO public.atendimento_pessoas (
    nome, telefone, tipo_atendimento, prioridade, motivo_urgencia, observacoes, data_entrada, status, posicao_fila
  ) VALUES (
    trim(p_nome),
    NULLIF(trim(p_telefone), ''),
    COALESCE(NULLIF(trim(p_tipo_atendimento), ''), 'Apometria'),
    'Urgente',
    trim(p_motivo_urgencia),
    NULLIF(trim(p_observacoes), ''),
    COALESCE(p_data_entrada, CURRENT_DATE),
    'programado',
    NULL
  ) RETURNING * INTO v_new_person;

  -- 5. Programação do paciente urgente na sessão escolhida
  INSERT INTO public.atendimento_programacoes (
    pessoa_id, atividade_id, event_date, start_time, end_time, ordem_sessao, prioridade, status, observacoes
  ) VALUES (
    v_new_person.id, p_atividade_id, p_event_date, COALESCE(p_start_time, v_atv_start), COALESCE(p_end_time, v_atv_end), v_count + 1, 'Urgente', 'programado', 'Cadastrado e programado diretamente como Urgência'
  ) RETURNING * INTO v_new_prog;

  -- Histórico do cadastro urgente
  INSERT INTO public.atendimento_historico (
    pessoa_id, programacao_id, admin_id, action, dados_novos, observacao
  ) VALUES (
    v_new_person.id,
    v_new_prog.id,
    v_admin_id,
    'CADASTRO_E_PROGRAMACAO_URGENTE',
    to_jsonb(v_new_prog),
    format('Cadastrado como Urgência e programado diretamente para a sessão do dia %s.', p_event_date)
  );

  RETURN to_jsonb(v_new_person);
END;
$$;

-- RPC 2: Mover Posição na Fila de Forma Segura em 2 Etapas com Faixa Dinâmica
CREATE OR REPLACE FUNCTION public.atendimento_mover_posicao(
  p_pessoa_id UUID,
  p_new_pos INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
  v_old_pos INT;
  v_max_pos INT;
  v_target_pos INT;
  v_offset INT;
  v_status TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem executar esta ação.';
  END IF;

  v_admin_id := auth.uid();

  IF p_new_pos IS NULL OR p_new_pos < 1 THEN
    RAISE EXCEPTION 'A posição de destino deve ser um número maior ou igual a 1.';
  END IF;

  PERFORM pg_advisory_xact_lock(74639201);

  SELECT posicao_fila, status INTO v_old_pos, v_status
  FROM public.atendimento_pessoas
  WHERE id = p_pessoa_id;

  IF v_status IS NULL OR v_status != 'aguardando' THEN
    RAISE EXCEPTION 'A pessoa especificada não foi encontrada ou não está aguardando na fila.';
  END IF;

  SELECT COUNT(*) INTO v_max_pos FROM public.atendimento_pessoas WHERE status = 'aguardando';
  v_target_pos := GREATEST(1, LEAST(p_new_pos, v_max_pos));

  IF v_old_pos = v_target_pos THEN
    RETURN;
  END IF;

  -- Offset dinâmico baseado no maior valor atual + 1.000.000
  SELECT COALESCE(MAX(posicao_fila), 0) + 1000000 INTO v_offset 
  FROM public.atendimento_pessoas 
  WHERE status = 'aguardando';

  -- Step 0: Retira temporariamente a pessoa do alcance normal usando offset dinâmico
  UPDATE public.atendimento_pessoas 
  SET posicao_fila = v_offset + v_max_pos + 100 
  WHERE id = p_pessoa_id;

  -- Deslocamento em 2 Etapas com limites perfeitamente dinâmicos
  IF v_old_pos > v_target_pos THEN
    -- Movimento para CIMA: Desloca o intervalo [v_target_pos .. v_old_pos - 1] para +1
    UPDATE public.atendimento_pessoas
    SET posicao_fila = posicao_fila + v_offset
    WHERE status = 'aguardando' AND posicao_fila >= v_target_pos AND posicao_fila < v_old_pos;

    UPDATE public.atendimento_pessoas
    SET posicao_fila = (posicao_fila - v_offset) + 1
    WHERE status = 'aguardando' AND posicao_fila >= (v_target_pos + v_offset) AND posicao_fila < (v_old_pos + v_offset);
  ELSE
    -- Movimento para BAIXO: Desloca o intervalo [v_old_pos + 1 .. v_target_pos] para -1
    UPDATE public.atendimento_pessoas
    SET posicao_fila = posicao_fila + v_offset
    WHERE status = 'aguardando' AND posicao_fila > v_old_pos AND posicao_fila <= v_target_pos;

    UPDATE public.atendimento_pessoas
    SET posicao_fila = (posicao_fila - v_offset) - 1
    WHERE status = 'aguardando' AND posicao_fila > (v_old_pos + v_offset) AND posicao_fila <= (v_target_pos + v_offset);
  END IF;

  -- Step 3: Define a posição final desejada
  UPDATE public.atendimento_pessoas
  SET posicao_fila = v_target_pos, updated_at = NOW()
  WHERE id = p_pessoa_id;

  INSERT INTO public.atendimento_historico (
    pessoa_id, admin_id, action, dados_anteriores, dados_novos, observacao
  ) VALUES (
    p_pessoa_id,
    v_admin_id,
    'REORGANIZACAO_FILA',
    jsonb_build_object('posicao_fila', v_old_pos),
    jsonb_build_object('posicao_fila', v_target_pos),
    format('Posição alterada de #%s para #%s.', v_old_pos, v_target_pos)
  );
END;
$$;

-- RPC 3: Programar Pessoa com Validações Estritas de Horário, Data, Atividade e Agendamento Ativo Único
CREATE OR REPLACE FUNCTION public.atendimento_programar_pessoa(
  p_pessoa_id UUID,
  p_atividade_id UUID,
  p_event_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_observacoes TEXT,
  p_force_over_capacity BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
  v_cap_max INT;
  v_count INT;
  v_last_normal_prog public.atendimento_programacoes;
  v_old_pos INT;
  v_offset INT;
  v_person public.atendimento_pessoas;
  v_new_prog public.atendimento_programacoes;
  v_active_count INT;
  v_atv_event_date DATE;
  v_atv_dow INT;
  v_atv_start TIME;
  v_atv_end TIME;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem executar esta ação.';
  END IF;

  v_admin_id := auth.uid();

  -- Validações de Horário e Data Básicas
  IF p_event_date IS NULL THEN
    RAISE EXCEPTION 'A data do atendimento é obrigatoria.';
  END IF;

  IF p_event_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'A data do atendimento não pode ser anterior à data atual.';
  END IF;

  IF p_start_time IS NULL OR p_end_time IS NULL THEN
    RAISE EXCEPTION 'Os horários de início e término são obrigatórios.';
  END IF;

  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'O horário de término deve ser posterior ao horário de início.';
  END IF;

  -- Validação de existência da atividade, dia da semana e correspondência da data
  SELECT event_date, day_of_week, start_time, end_time 
  INTO v_atv_event_date, v_atv_dow, v_atv_start, v_atv_end
  FROM public.atividades
  WHERE id = p_atividade_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A atividade/sessão selecionada é inválida ou está inativa.';
  END IF;

  -- 1. Atividade Regular (event_date IS NULL): p_event_date deve corresponder ao day_of_week
  IF v_atv_event_date IS NULL THEN
    IF v_atv_dow IS NOT NULL AND EXTRACT(DOW FROM p_event_date)::INTEGER != v_atv_dow THEN
      RAISE EXCEPTION 'A data selecionada (%s) não corresponde ao dia da semana oficial desta atividade regular.', p_event_date;
    END IF;
  ELSE
    -- 2. Atendimento Extra (event_date IS NOT NULL): p_event_date deve ser exatamente igual à data cadastrada
    IF p_event_date != v_atv_event_date THEN
      RAISE EXCEPTION 'Para atendimentos extras, a data informada (%s) deve ser exatamente igual à data cadastrada no evento (%s).', p_event_date, v_atv_event_date;
    END IF;
  END IF;

  -- 3. Correspondência de horários oficiais da sessão
  IF v_atv_start IS NOT NULL AND v_atv_end IS NOT NULL THEN
    IF p_start_time != v_atv_start OR p_end_time != v_atv_end THEN
      RAISE EXCEPTION 'Os horários fornecidos (%s - %s) não correspondem aos horários oficiais da sessão (%s - %s).', p_start_time, p_end_time, v_atv_start, v_atv_end;
    END IF;
  END IF;

  SELECT * INTO v_person FROM public.atendimento_pessoas WHERE id = p_pessoa_id;
  IF v_person.id IS NULL THEN
    RAISE EXCEPTION 'Pessoa não encontrada.';
  END IF;

  -- Validação de Agendamento Ativo Único (Impedir múltipla programação ativa independente da data)
  SELECT COUNT(*) INTO v_active_count
  FROM public.atendimento_programacoes
  WHERE pessoa_id = p_pessoa_id AND status IN ('programado', 'compareceu');

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'Esta pessoa já possui um agendamento ativo (programado ou compareceu) no sistema. Conclua ou cancele o agendamento atual antes de criar um novo.';
  END IF;

  PERFORM pg_advisory_xact_lock(74639201);

  -- Busca capacidade máxima
  SELECT COALESCE(capacidade, 6) INTO v_cap_max
  FROM public.atendimento_capacidades
  WHERE atividade_id = p_atividade_id;

  IF v_cap_max IS NULL THEN v_cap_max := 6; END IF;

  -- Conta agendamentos ativos na sessão
  SELECT COUNT(*) INTO v_count
  FROM public.atendimento_programacoes
  WHERE atividade_id = p_atividade_id AND event_date = p_event_date AND status != 'cancelado';

  IF v_count >= v_cap_max AND NOT p_force_over_capacity THEN
    SELECT * INTO v_last_normal_prog
    FROM public.atendimento_programacoes
    WHERE atividade_id = p_atividade_id AND event_date = p_event_date AND status = 'programado' AND prioridade = 'Normal'
    ORDER BY ordem_sessao DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'over_capacity', true,
      'capacity', v_cap_max,
      'count', v_count,
      'last_normal_pessoa_id', v_last_normal_prog.pessoa_id,
      'last_normal_programacao_id', v_last_normal_prog.id
    );
  END IF;

  v_old_pos := v_person.posicao_fila;

  INSERT INTO public.atendimento_programacoes (
    pessoa_id, atividade_id, event_date, start_time, end_time, ordem_sessao, prioridade, status, observacoes
  ) VALUES (
    p_pessoa_id, p_atividade_id, p_event_date, p_start_time, p_end_time, v_count + 1, v_person.prioridade, 'programado', NULLIF(trim(p_observacoes), '')
  ) RETURNING * INTO v_new_prog;

  -- Atualiza status e define posicao_fila = NULL
  UPDATE public.atendimento_pessoas
  SET status = 'programado', posicao_fila = NULL, updated_at = NOW()
  WHERE id = p_pessoa_id;

  -- Recompactação segura em 2 etapas da fila restante se a pessoa estava aguardando
  IF v_person.status = 'aguardando' AND v_old_pos IS NOT NULL THEN
    SELECT COALESCE(MAX(posicao_fila), 0) + 1000000 INTO v_offset 
    FROM public.atendimento_pessoas 
    WHERE status = 'aguardando';

    UPDATE public.atendimento_pessoas
    SET posicao_fila = posicao_fila + v_offset
    WHERE status = 'aguardando' AND posicao_fila > v_old_pos;

    UPDATE public.atendimento_pessoas
    SET posicao_fila = (posicao_fila - v_offset) - 1
    WHERE status = 'aguardando' AND posicao_fila >= v_offset;
  END IF;

  INSERT INTO public.atendimento_historico (
    pessoa_id, programacao_id, admin_id, action, dados_novos, observacao
  ) VALUES (
    p_pessoa_id, v_new_prog.id, v_admin_id, 'PROGRAMACAO_ATENDIMENTO', to_jsonb(v_new_prog), format('Programado para %s.', p_event_date)
  );

  RETURN jsonb_build_object('over_capacity', false, 'programacao_id', v_new_prog.id);
END;
$$;

-- RPC 4: Remanejar Paciente em Caso de Urgência com Garantia Estrita de Capacidade
CREATE OR REPLACE FUNCTION public.atendimento_remanejar_urgencia(
  p_pessoa_urgente_id UUID,
  p_atividade_id UUID,
  p_event_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_pessoa_remanejar_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
  v_prog_antiga public.atendimento_programacoes;
  v_pessoa_urgente public.atendimento_pessoas;
  v_pessoa_remanejar public.atendimento_pessoas;
  v_cap_max INT;
  v_count INT;
  v_retorno_pos INT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem executar esta ação.';
  END IF;

  v_admin_id := auth.uid();

  PERFORM pg_advisory_xact_lock(74639201);

  -- Validação da pessoa urgente
  SELECT * INTO v_pessoa_urgente FROM public.atendimento_pessoas WHERE id = p_pessoa_urgente_id;
  IF v_pessoa_urgente.id IS NULL THEN
    RAISE EXCEPTION 'Pessoa urgente não encontrada.';
  END IF;

  IF v_pessoa_urgente.prioridade != 'Urgente' THEN
    RAISE EXCEPTION 'A pessoa selecionada para encaixe não possui prioridade Urgente.';
  END IF;

  -- Busca capacidade máxima e contagem atual
  SELECT COALESCE(capacidade, 6) INTO v_cap_max
  FROM public.atendimento_capacidades
  WHERE atividade_id = p_atividade_id;
  IF v_cap_max IS NULL THEN v_cap_max := 6; END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.atendimento_programacoes
  WHERE atividade_id = p_atividade_id AND event_date = p_event_date AND status != 'cancelado';

  -- Se a sessão está cheia, o remanejamento da pessoa normal é OBRIGATÓRIO
  IF v_count >= v_cap_max THEN
    IF p_pessoa_remanejar_id IS NULL THEN
      RAISE EXCEPTION 'A sessão está com a capacidade preenchida (%s vagas). É obrigatório selecionar uma pessoa Normal para remanejar.', v_cap_max;
    END IF;

    SELECT * INTO v_pessoa_remanejar FROM public.atendimento_pessoas WHERE id = p_pessoa_remanejar_id;
    IF v_pessoa_remanejar.id IS NULL THEN
      RAISE EXCEPTION 'Pessoa indicada para remanejamento não encontrada.';
    END IF;

    IF v_pessoa_remanejar.prioridade = 'Urgente' THEN
      RAISE EXCEPTION 'Não é permitido desencaixar/remanejar um paciente com prioridade Urgente.';
    END IF;

    SELECT * INTO v_prog_antiga
    FROM public.atendimento_programacoes
    WHERE pessoa_id = p_pessoa_remanejar_id AND event_date = p_event_date AND atividade_id = p_atividade_id AND status = 'programado';

    IF v_prog_antiga.id IS NULL THEN
      RAISE EXCEPTION 'A pessoa a ser remanejada não possui um agendamento programado nesta sessão e data.';
    END IF;

    -- 1. Cancela o agendamento da pessoa normal
    UPDATE public.atendimento_programacoes
    SET status = 'cancelado', updated_at = NOW()
    WHERE id = v_prog_antiga.id;

    -- 2. Retorna a pessoa normal para a posição #1 da fila de forma 100% segura
    v_retorno_pos := public._atendimento_inserir_na_fila_seguro(p_pessoa_remanejar_id, 1);

    INSERT INTO public.atendimento_historico (
      pessoa_id, programacao_id, admin_id, action, dados_anteriores, observacao
    ) VALUES (
      p_pessoa_remanejar_id,
      v_prog_antiga.id,
      v_admin_id,
      'REMANEJAMENTO_URGENCIA',
      to_jsonb(v_prog_antiga),
      format('Remanejado da sessão do dia %s devido ao encaixe de urgência. Retornado à posição #%s da fila de espera.', p_event_date, v_retorno_pos)
    );
  END IF;

  -- 3. Programa a pessoa urgente na sessão
  PERFORM public.atendimento_programar_pessoa(
    p_pessoa_urgente_id, p_atividade_id, p_event_date, p_start_time, p_end_time, 'Encaixe de Urgência em Sessão Cheia', true
  );
END;
$$;

-- RPC 5: Atualizar Status do Agendamento / Retornar Seguro à Fila
CREATE OR REPLACE FUNCTION public.atendimento_atualizar_status_programacao(
  p_programacao_id UUID,
  p_novo_status TEXT,
  p_posicao_retorno INT,
  p_observacao TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
  v_prog public.atendimento_programacoes;
  v_old_status TEXT;
  v_final_pos INT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem executar esta ação.';
  END IF;

  v_admin_id := auth.uid();

  IF p_novo_status NOT IN ('compareceu', 'atendido', 'nao_compareceu', 'cancelado', 'retornar_fila') THEN
    RAISE EXCEPTION 'Status inválido fornecido.';
  END IF;

  PERFORM pg_advisory_xact_lock(74639201);

  SELECT * INTO v_prog FROM public.atendimento_programacoes WHERE id = p_programacao_id;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;

  v_old_status := v_prog.status;

  IF p_novo_status = 'retornar_fila' THEN
    -- Cancela o agendamento
    UPDATE public.atendimento_programacoes SET status = 'cancelado', updated_at = NOW() WHERE id = p_programacao_id;
    -- Reinsere com segurança na fila de espera abrindo o slot primeiro
    v_final_pos := public._atendimento_inserir_na_fila_seguro(v_prog.pessoa_id, COALESCE(p_posicao_retorno, 1));

    INSERT INTO public.atendimento_historico (
      pessoa_id, programacao_id, admin_id, action, dados_anteriores, dados_novos, observacao
    ) VALUES (
      v_prog.pessoa_id, p_programacao_id, v_admin_id, 'STATUS_RETORNAR_FILA', jsonb_build_object('status', v_old_status), jsonb_build_object('status', 'aguardando'), format('Retornado à fila de espera na posição #%s.', v_final_pos)
    );
  ELSE
    UPDATE public.atendimento_programacoes SET status = p_novo_status, updated_at = NOW() WHERE id = p_programacao_id;
    UPDATE public.atendimento_pessoas SET status = p_novo_status, posicao_fila = NULL, updated_at = NOW() WHERE id = v_prog.pessoa_id;

    INSERT INTO public.atendimento_historico (
      pessoa_id, programacao_id, admin_id, action, dados_anteriores, dados_novos, observacao
    ) VALUES (
      v_prog.pessoa_id, p_programacao_id, v_admin_id, format('STATUS_%s', upper(p_novo_status)), jsonb_build_object('status', v_old_status), jsonb_build_object('status', p_novo_status), NULLIF(trim(p_observacao), '')
    );
  END IF;
END;
$$;

-- RPC 6: Exclusão Segura de Pessoa (Com verificação rigorosa de histórico e descarte de fila)
CREATE OR REPLACE FUNCTION public.atendimento_excluir_pessoa(
  p_pessoa_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
  v_pos INT;
  v_status TEXT;
  v_offset INT;
  v_hist_count INT;
  v_prog_count INT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem executar esta ação.';
  END IF;

  v_admin_id := auth.uid();

  PERFORM pg_advisory_xact_lock(74639201);

  SELECT COUNT(*) INTO v_hist_count FROM public.atendimento_historico WHERE pessoa_id = p_pessoa_id;
  SELECT COUNT(*) INTO v_prog_count FROM public.atendimento_programacoes WHERE pessoa_id = p_pessoa_id;

  IF v_hist_count > 0 OR v_prog_count > 0 THEN
    RAISE EXCEPTION 'Esta pessoa possui histórico ou agendamentos vinculados. Ela não pode ser excluída fisicamente. Altere o status para Cancelado.';
  END IF;

  SELECT posicao_fila, status INTO v_pos, v_status FROM public.atendimento_pessoas WHERE id = p_pessoa_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Pessoa não encontrada.';
  END IF;

  DELETE FROM public.atendimento_pessoas WHERE id = p_pessoa_id;

  IF v_status = 'aguardando' AND v_pos IS NOT NULL THEN
    SELECT COALESCE(MAX(posicao_fila), 0) + 1000000 INTO v_offset 
    FROM public.atendimento_pessoas 
    WHERE status = 'aguardando';

    UPDATE public.atendimento_pessoas
    SET posicao_fila = posicao_fila + v_offset
    WHERE status = 'aguardando' AND posicao_fila > v_pos;

    UPDATE public.atendimento_pessoas
    SET posicao_fila = (posicao_fila - v_offset) - 1
    WHERE status = 'aguardando' AND posicao_fila >= v_offset;
  END IF;
END;
$$;

-- ============================================================
-- 9. REVOKE & GRANT DE PERMISSÕES COM ASSINATURAS COMPLETAS
-- ============================================================

REVOKE ALL ON FUNCTION public._atendimento_inserir_na_fila_seguro(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atendimento_cadastrar_pessoa(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atendimento_cadastrar_e_programar_urgente(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID, DATE, TIME, TIME, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atendimento_mover_posicao(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atendimento_programar_pessoa(UUID, UUID, DATE, TIME, TIME, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atendimento_remanejar_urgencia(UUID, UUID, DATE, TIME, TIME, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atendimento_atualizar_status_programacao(UUID, TEXT, INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atendimento_excluir_pessoa(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.atendimento_cadastrar_pessoa(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_cadastrar_e_programar_urgente(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID, DATE, TIME, TIME, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_mover_posicao(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_programar_pessoa(UUID, UUID, DATE, TIME, TIME, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_remanejar_urgencia(UUID, UUID, DATE, TIME, TIME, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_atualizar_status_programacao(UUID, TEXT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atendimento_excluir_pessoa(UUID) TO authenticated;

COMMIT;
