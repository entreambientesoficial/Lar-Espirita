-- ============================================================
-- Migration Idempotente e Transacional: RPC Cadastrar e Programar Urgência
-- Projeto: Portal do Voluntário - Apometria Elos de Amor e Paz
-- ============================================================

BEGIN;

-- Criar ou atualizar a RPC public.atendimento_cadastrar_e_programar_urgente
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
  p_force_over_capacity BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
  v_person public.atendimento_pessoas;
  v_bumped_person public.atendimento_pessoas;
  v_atv_event_date DATE;
  v_atv_dow INT;
  v_atv_start TIME;
  v_atv_end TIME;
  v_cap_max INT;
  v_count INT;
  v_last_normal_prog public.atendimento_programacoes;
  v_search_date DATE;
  v_next_date DATE;
  v_future_atividade_id UUID;
  v_future_start_time TIME;
  v_future_end_time TIME;
  v_future_cap_max INT;
  v_future_count INT;
  v_found_slot BOOLEAN := false;
  v_dow INT;
  v_start_hour INT;
  v_period_name TEXT;
  v_extra_rec RECORD;
  v_reagendado_prog public.atendimento_programacoes;
  v_new_prog public.atendimento_programacoes;
BEGIN
  -- 1. Validar se o chamador é administrador
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem executar esta ação.';
  END IF;

  v_admin_id := auth.uid();

  -- Advisory lock transacional para concorrência
  PERFORM pg_advisory_xact_lock(74639202);

  -- 2. Validar parâmetros obrigatórios
  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RAISE EXCEPTION 'O nome da pessoa é obrigatório.';
  END IF;

  IF p_motivo_urgencia IS NULL OR trim(p_motivo_urgencia) = '' THEN
    RAISE EXCEPTION 'O motivo da urgência é obrigatório.';
  END IF;

  IF p_data_entrada IS NULL THEN
    RAISE EXCEPTION 'A data de entrada é obrigatória.';
  END IF;

  IF p_atividade_id IS NULL THEN
    RAISE EXCEPTION 'A sessão de atendimento é obrigatória.';
  END IF;

  IF p_event_date IS NULL THEN
    RAISE EXCEPTION 'A data do atendimento é obrigatória.';
  END IF;

  IF p_start_time IS NULL OR p_end_time IS NULL THEN
    RAISE EXCEPTION 'Os horários de início e término são obrigatórios.';
  END IF;

  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'O horário de término deve ser posterior ao horário de início.';
  END IF;

  -- 3. Validar existência da atividade no banco
  SELECT event_date, day_of_week, start_time, end_time
  INTO v_atv_event_date, v_atv_dow, v_atv_start, v_atv_end
  FROM public.atividades
  WHERE id = p_atividade_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A sessão/atividade selecionada é inválida ou está inativa.';
  END IF;

  -- 4. Checar capacidade da sessão e efetuar desencaixe se cheia e ignorar capacidade ativo
  SELECT COALESCE(capacidade, 9) INTO v_cap_max
  FROM public.atendimento_capacidades
  WHERE atividade_id = p_atividade_id;
  IF v_cap_max IS NULL THEN v_cap_max := 9; END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.atendimento_programacoes
  WHERE atividade_id = p_atividade_id
    AND event_date = p_event_date
    AND status IN ('programado', 'compareceu');

  IF v_count >= v_cap_max THEN
    IF NOT p_force_over_capacity THEN
      RAISE EXCEPTION 'A sessão selecionada já atingiu a capacidade máxima (%s vagas ativas). Marque a opção "Ignorar capacidade e encaixar como urgência" para remanejar uma pessoa da sessão.', v_cap_max;
    END IF;

    -- Buscar última pessoa Normal para remanejar
    SELECT * INTO v_last_normal_prog
    FROM public.atendimento_programacoes
    WHERE atividade_id = p_atividade_id
      AND event_date = p_event_date
      AND status = 'programado'
      AND prioridade = 'Normal'
    ORDER BY ordem_sessao DESC
    LIMIT 1;

    IF v_last_normal_prog.id IS NULL THEN
      RAISE EXCEPTION 'A sessão está cheia apenas com atendimentos Urgentes. Não há nenhuma pessoa com prioridade Normal que possa ser remanejada nesta sessão.';
    END IF;

    SELECT * INTO v_bumped_person
    FROM public.atendimento_pessoas
    WHERE id = v_last_normal_prog.pessoa_id;

    -- Encontrar próxima vaga futura respeitando a disponibilidade da pessoa desencaixada
    IF v_atv_event_date IS NULL THEN
      FOR i IN 1..52 LOOP
        v_search_date := p_event_date + (i * 7);
        v_dow := EXTRACT(DOW FROM v_search_date)::INTEGER;
        v_start_hour := EXTRACT(HOUR FROM COALESCE(p_start_time, v_atv_start, '13:30'::TIME))::INTEGER;
        IF v_start_hour < 18 THEN v_period_name := 'tarde'; ELSE v_period_name := 'noite'; END IF;

        IF v_bumped_person.dias_disponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.dias_disponiveis) > 0 THEN
          IF NOT (v_bumped_person.dias_disponiveis @> jsonb_build_array(v_dow)) THEN CONTINUE; END IF;
        END IF;

        IF v_bumped_person.periodos_disponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.periodos_disponiveis) > 0 THEN
          IF NOT (v_bumped_person.periodos_disponiveis @> jsonb_build_array(v_period_name)) THEN CONTINUE; END IF;
        END IF;

        IF v_bumped_person.datas_indisponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.datas_indisponiveis) > 0 THEN
          IF (v_bumped_person.datas_indisponiveis @> jsonb_build_array(v_search_date::text)) THEN CONTINUE; END IF;
        END IF;

        SELECT COALESCE(capacidade, 9) INTO v_future_cap_max
        FROM public.atendimento_capacidades
        WHERE atividade_id = p_atividade_id;
        IF v_future_cap_max IS NULL THEN v_future_cap_max := 9; END IF;

        SELECT COUNT(*) INTO v_future_count
        FROM public.atendimento_programacoes
        WHERE atividade_id = p_atividade_id
          AND event_date = v_search_date
          AND status IN ('programado', 'compareceu');

        IF v_future_count < v_future_cap_max THEN
          v_next_date := v_search_date;
          v_future_atividade_id := p_atividade_id;
          v_future_start_time := COALESCE(p_start_time, v_atv_start);
          v_future_end_time := COALESCE(p_end_time, v_atv_end);
          v_found_slot := true;
          EXIT;
        END IF;
      END LOOP;
    ELSE
      FOR v_extra_rec IN
        SELECT id, event_date, start_time, end_time
        FROM public.atividades
        WHERE name = (SELECT name FROM public.atividades WHERE id = p_atividade_id)
          AND active = true
          AND event_date IS NOT NULL
          AND (event_date > p_event_date OR (event_date = p_event_date AND start_time > p_start_time))
        ORDER BY event_date ASC, start_time ASC
      LOOP
        v_dow := EXTRACT(DOW FROM v_extra_rec.event_date)::INTEGER;
        v_start_hour := EXTRACT(HOUR FROM COALESCE(v_extra_rec.start_time, '13:30'::TIME))::INTEGER;
        IF v_start_hour < 18 THEN v_period_name := 'tarde'; ELSE v_period_name := 'noite'; END IF;

        IF v_bumped_person.dias_disponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.dias_disponiveis) > 0 THEN
          IF NOT (v_bumped_person.dias_disponiveis @> jsonb_build_array(v_dow)) THEN CONTINUE; END IF;
        END IF;

        IF v_bumped_person.periodos_disponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.periodos_disponiveis) > 0 THEN
          IF NOT (v_bumped_person.periodos_disponiveis @> jsonb_build_array(v_period_name)) THEN CONTINUE; END IF;
        END IF;

        IF v_bumped_person.datas_indisponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.datas_indisponiveis) > 0 THEN
          IF (v_bumped_person.datas_indisponiveis @> jsonb_build_array(v_extra_rec.event_date::text)) THEN CONTINUE; END IF;
        END IF;

        SELECT COALESCE(capacidade, 9) INTO v_future_cap_max
        FROM public.atendimento_capacidades
        WHERE atividade_id = v_extra_rec.id;
        IF v_future_cap_max IS NULL THEN v_future_cap_max := 9; END IF;

        SELECT COUNT(*) INTO v_future_count
        FROM public.atendimento_programacoes
        WHERE atividade_id = v_extra_rec.id
          AND event_date = v_extra_rec.event_date
          AND status IN ('programado', 'compareceu');

        IF v_future_count < v_future_cap_max THEN
          v_next_date := v_extra_rec.event_date;
          v_future_atividade_id := v_extra_rec.id;
          v_future_start_time := v_extra_rec.start_time;
          v_future_end_time := v_extra_rec.end_time;
          v_found_slot := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF NOT v_found_slot OR v_next_date IS NULL OR v_future_atividade_id IS NULL THEN
      RAISE EXCEPTION 'Não foi encontrada nenhuma sessão futura disponível para remanejar a pessoa desencaixada. Operação cancelada.';
    END IF;

    UPDATE public.atendimento_programacoes
    SET status = 'cancelado', updated_at = NOW()
    WHERE id = v_last_normal_prog.id;

    INSERT INTO public.atendimento_programacoes (
      pessoa_id, atividade_id, event_date, start_time, end_time, ordem_sessao, prioridade, status, observacoes
    ) VALUES (
      v_last_normal_prog.pessoa_id, v_future_atividade_id, v_next_date, v_future_start_time, v_future_end_time, v_future_count + 1, 'Normal', 'programado', 'Reagendado automaticamente devido a encaixe de urgência'
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
      format('Desencaixado da sessão do dia %s para atendimento urgente e reagendado automaticamente para a sessão do dia %s.', p_event_date, v_next_date)
    );
  END IF;

  -- 5. Cadastrar pessoa com prioridade Urgente e status programado
  INSERT INTO public.atendimento_pessoas (
    nome, telefone, tipo_atendimento, prioridade, motivo_urgencia, observacoes, data_entrada, status, posicao_fila
  ) VALUES (
    trim(p_nome),
    NULLIF(trim(p_telefone), ''),
    COALESCE(p_tipo_atendimento, 'Apometria'),
    'Urgente',
    trim(p_motivo_urgencia),
    NULLIF(trim(p_observacoes), ''),
    p_data_entrada,
    'programado',
    NULL
  ) RETURNING * INTO v_person;

  -- 6. Recalcular ocupação ativa da sessão após remanejamento
  SELECT COUNT(*) INTO v_count
  FROM public.atendimento_programacoes
  WHERE atividade_id = p_atividade_id
    AND event_date = p_event_date
    AND status IN ('programado', 'compareceu');

  -- 7. Criar programação para a pessoa urgente
  INSERT INTO public.atendimento_programacoes (
    pessoa_id, atividade_id, event_date, start_time, end_time, ordem_sessao, prioridade, status, observacoes
  ) VALUES (
    v_person.id,
    p_atividade_id,
    p_event_date,
    p_start_time,
    p_end_time,
    v_count + 1,
    'Urgente',
    'programado',
    NULLIF(trim(p_observacoes), '')
  ) RETURNING * INTO v_new_prog;

  -- 8. Log no histórico do sistema
  INSERT INTO public.atendimento_historico (
    pessoa_id, programacao_id, admin_id, action, dados_novos, observacao
  ) VALUES (
    v_person.id,
    v_new_prog.id,
    v_admin_id,
    'CADASTRO_E_PROGRAMACAO_URGENTE',
    to_jsonb(v_new_prog),
    format('Pessoa cadastrada com urgência e programada diretamente para a sessão do dia %s.', p_event_date)
  );

  RETURN to_jsonb(v_person);
END;
$$;

-- Permissões REVOKE e GRANT
REVOKE ALL ON FUNCTION public.atendimento_cadastrar_e_programar_urgente(
  TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID, DATE, TIME, TIME, BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.atendimento_cadastrar_e_programar_urgente(
  TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID, DATE, TIME, TIME, BOOLEAN
) TO authenticated;

-- Forçar recarga do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
