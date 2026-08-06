-- ============================================================
-- Migration Idempotente e Transacional: RPC Reagendamento Atendimento
-- Projeto: Portal do Voluntário - Apometria Elos de Amor e Paz
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.atendimento_reagendar_programacao(
  p_programacao_id UUID,
  p_nova_atividade_id UUID,
  p_nova_event_date DATE,
  p_nova_start_time TIME,
  p_nova_end_time TIME,
  p_observacoes TEXT,
  p_force_over_capacity BOOLEAN DEFAULT false,
  p_ignore_availability_conflict BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
  v_old_prog public.atendimento_programacoes;
  v_person public.atendimento_pessoas;
  v_bumped_person public.atendimento_pessoas;
  v_atv_event_date DATE;
  v_atv_dow INT;
  v_atv_start TIME;
  v_atv_end TIME;
  v_cap_max INT;
  v_count INT;
  v_dow INT;
  v_start_hour INT;
  v_period_name TEXT;
  v_last_normal_prog public.atendimento_programacoes;
  v_search_date DATE;
  v_next_date DATE;
  v_future_atividade_id UUID;
  v_future_start_time TIME;
  v_future_end_time TIME;
  v_future_cap_max INT;
  v_future_count INT;
  v_found_slot BOOLEAN := false;
  v_extra_rec RECORD;
  v_new_prog public.atendimento_programacoes;
  v_reagendado_prog public.atendimento_programacoes;
BEGIN
  -- 1. Validar se o chamador é admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem executar esta ação.';
  END IF;

  v_admin_id := auth.uid();

  -- Advisory lock transacional para garantir concorrência
  PERFORM pg_advisory_xact_lock(74639201);

  -- 2. Validar agendamento anterior e seu status (somente programado ou compareceu)
  SELECT * INTO v_old_prog
  FROM public.atendimento_programacoes
  WHERE id = p_programacao_id;

  IF v_old_prog.id IS NULL THEN
    RAISE EXCEPTION 'O agendamento anterior informado não foi encontrado.';
  END IF;

  IF v_old_prog.status NOT IN ('programado', 'compareceu') THEN
    RAISE EXCEPTION 'Apenas agendamentos ativos com status Programado ou Compareceu podem ser reagendados. O agendamento atual está como %s.', v_old_prog.status;
  END IF;

  SELECT * INTO v_person
  FROM public.atendimento_pessoas
  WHERE id = v_old_prog.pessoa_id;

  IF v_person.id IS NULL THEN
    RAISE EXCEPTION 'A pessoa associada a este agendamento não foi encontrada.';
  END IF;

  -- 3. Validar nova atividade, data e horários obrigatórios
  IF p_nova_event_date IS NULL THEN
    RAISE EXCEPTION 'A nova data do atendimento é obrigatória.';
  END IF;

  IF p_nova_event_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'A nova data do atendimento não pode ser anterior à data atual.';
  END IF;

  IF p_nova_start_time IS NULL OR p_nova_end_time IS NULL THEN
    RAISE EXCEPTION 'Os horários de início e término são obrigatórios.';
  END IF;

  IF p_nova_end_time <= p_nova_start_time THEN
    RAISE EXCEPTION 'O horário de término deve ser posterior ao horário de início.';
  END IF;

  SELECT event_date, day_of_week, start_time, end_time 
  INTO v_atv_event_date, v_atv_dow, v_atv_start, v_atv_end
  FROM public.atividades
  WHERE id = p_nova_atividade_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A nova atividade/sessão selecionada é inválida ou está inativa.';
  END IF;

  -- Correspondência de dia da semana ou data do evento
  IF v_atv_event_date IS NULL THEN
    IF v_atv_dow IS NOT NULL AND EXTRACT(DOW FROM p_nova_event_date)::INTEGER != v_atv_dow THEN
      RAISE EXCEPTION 'A data selecionada (%s) não corresponde ao dia da semana oficial desta atividade regular.', p_nova_event_date;
    END IF;
  ELSE
    IF p_nova_event_date != v_atv_event_date THEN
      RAISE EXCEPTION 'Para atendimentos extras, a data informada (%s) deve ser exatamente igual à data cadastrada no evento (%s).', p_nova_event_date, v_atv_event_date;
    END IF;
  END IF;

  -- Correspondência de horários oficiais da sessão
  IF v_atv_start IS NOT NULL AND v_atv_end IS NOT NULL THEN
    IF p_nova_start_time != v_atv_start OR p_nova_end_time != v_atv_end THEN
      RAISE EXCEPTION 'Os horários fornecidos (%s - %s) não correspondem aos horários oficiais da sessão (%s - %s).', p_nova_start_time, p_nova_end_time, v_atv_start, v_atv_end;
    END IF;
  END IF;

  -- 4. Validar disponibilidade da pessoa a ser reagendada (se restrições ativas e não ignoradas no modal)
  IF NOT p_ignore_availability_conflict THEN
    v_dow := EXTRACT(DOW FROM p_nova_event_date)::INTEGER;
    v_start_hour := EXTRACT(HOUR FROM p_nova_start_time)::INTEGER;
    IF v_start_hour < 18 THEN v_period_name := 'tarde'; ELSE v_period_name := 'noite'; END IF;

    IF v_person.dias_disponiveis IS NOT NULL AND jsonb_array_length(v_person.dias_disponiveis) > 0 THEN
      IF NOT (v_person.dias_disponiveis @> jsonb_build_array(v_dow)) THEN
        RAISE EXCEPTION 'Conflito de disponibilidade: A pessoa não possui o dia da semana da sessão selecionada em sua disponibilidade.';
      END IF;
    END IF;

    IF v_person.periodos_disponiveis IS NOT NULL AND jsonb_array_length(v_person.periodos_disponiveis) > 0 THEN
      IF NOT (v_person.periodos_disponiveis @> jsonb_build_array(v_period_name)) THEN
        RAISE EXCEPTION 'Conflito de disponibilidade: A pessoa não possui o período (%s) em sua disponibilidade.', v_period_name;
      END IF;
    END IF;

    IF v_person.datas_indisponiveis IS NOT NULL AND jsonb_array_length(v_person.datas_indisponiveis) > 0 THEN
      IF (v_person.datas_indisponiveis @> jsonb_build_array(p_nova_event_date::text)) THEN
        RAISE EXCEPTION 'Conflito de disponibilidade: A data % foi cadastrada como indisponível para esta pessoa.', p_nova_event_date;
      END IF;
    END IF;
  END IF;

  -- 5. Validar capacidade da nova sessão considerando apenas status IN ('programado', 'compareceu')
  SELECT COALESCE(capacidade, 9) INTO v_cap_max
  FROM public.atendimento_capacidades
  WHERE atividade_id = p_nova_atividade_id;
  IF v_cap_max IS NULL THEN v_cap_max := 9; END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.atendimento_programacoes
  WHERE atividade_id = p_nova_atividade_id 
    AND event_date = p_nova_event_date 
    AND status IN ('programado', 'compareceu') 
    AND id != p_programacao_id;

  IF v_count >= v_cap_max THEN
    IF NOT p_force_over_capacity THEN
      RAISE EXCEPTION 'A sessão selecionada já atingiu a capacidade máxima (%s vagas ativas). Marque a opção de encaixe para remanejar uma pessoa com prioridade Normal.', v_cap_max;
    END IF;

    -- Localizar a última pessoa com prioridade NORMAL na nova sessão para desencaixar de forma segura
    SELECT * INTO v_last_normal_prog
    FROM public.atendimento_programacoes
    WHERE atividade_id = p_nova_atividade_id 
      AND event_date = p_nova_event_date 
      AND status = 'programado' 
      AND prioridade = 'Normal'
      AND id != p_programacao_id
    ORDER BY ordem_sessao DESC
    LIMIT 1;

    IF v_last_normal_prog.id IS NULL THEN
      RAISE EXCEPTION 'A sessão está cheia apenas com atendimentos Urgentes. Não há nenhuma pessoa com prioridade Normal que possa ser remanejada nesta sessão.';
    END IF;

    -- Obter os dados completos da pessoa desencaixada para validar rigorosamente a disponibilidade dela
    SELECT * INTO v_bumped_person
    FROM public.atendimento_pessoas
    WHERE id = v_last_normal_prog.pessoa_id;

    -- Busca próxima sessão futura compatível com a disponibilidade da pessoa desencaixada e com vaga livre
    IF v_atv_event_date IS NULL THEN
      -- Sessão Regular: percorrer semanas futuras (até 52 semanas)
      FOR i IN 1..52 LOOP
        v_search_date := p_nova_event_date + (i * 7);
        v_dow := EXTRACT(DOW FROM v_search_date)::INTEGER;
        v_start_hour := EXTRACT(HOUR FROM COALESCE(p_nova_start_time, v_atv_start, '13:30'::TIME))::INTEGER;
        IF v_start_hour < 18 THEN v_period_name := 'tarde'; ELSE v_period_name := 'noite'; END IF;

        -- Validar disponibilidade da pessoa desencaixada (sempre obrigatória)
        IF v_bumped_person.dias_disponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.dias_disponiveis) > 0 THEN
          IF NOT (v_bumped_person.dias_disponiveis @> jsonb_build_array(v_dow)) THEN CONTINUE; END IF;
        END IF;

        IF v_bumped_person.periodos_disponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.periodos_disponiveis) > 0 THEN
          IF NOT (v_bumped_person.periodos_disponiveis @> jsonb_build_array(v_period_name)) THEN CONTINUE; END IF;
        END IF;

        IF v_bumped_person.datas_indisponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.datas_indisponiveis) > 0 THEN
          IF (v_bumped_person.datas_indisponiveis @> jsonb_build_array(v_search_date::text)) THEN CONTINUE; END IF;
        END IF;

        -- Verificar capacidade da atividade regular na data futura
        SELECT COALESCE(capacidade, 9) INTO v_future_cap_max
        FROM public.atendimento_capacidades
        WHERE atividade_id = p_nova_atividade_id;
        IF v_future_cap_max IS NULL THEN v_future_cap_max := 9; END IF;

        SELECT COUNT(*) INTO v_future_count
        FROM public.atendimento_programacoes
        WHERE atividade_id = p_nova_atividade_id 
          AND event_date = v_search_date 
          AND status IN ('programado', 'compareceu');

        IF v_future_count < v_future_cap_max THEN
          v_next_date := v_search_date;
          v_future_atividade_id := p_nova_atividade_id;
          v_future_start_time := COALESCE(p_nova_start_time, v_atv_start);
          v_future_end_time := COALESCE(p_nova_end_time, v_atv_end);
          v_found_slot := true;
          EXIT;
        END IF;
      END LOOP;
    ELSE
      -- Atendimento Extra: percorrer todas as futuras atividades extras ativas do mesmo tipo em ordem cronológica
      FOR v_extra_rec IN 
        SELECT id, event_date, start_time, end_time 
        FROM public.atividades
        WHERE name = (SELECT name FROM public.atividades WHERE id = p_nova_atividade_id)
          AND active = true
          AND event_date IS NOT NULL
          AND (event_date > p_nova_event_date OR (event_date = p_nova_event_date AND start_time > p_nova_start_time))
        ORDER BY event_date ASC, start_time ASC
      LOOP
        v_dow := EXTRACT(DOW FROM v_extra_rec.event_date)::INTEGER;
        v_start_hour := EXTRACT(HOUR FROM COALESCE(v_extra_rec.start_time, '13:30'::TIME))::INTEGER;
        IF v_start_hour < 18 THEN v_period_name := 'tarde'; ELSE v_period_name := 'noite'; END IF;

        -- Validar disponibilidade da pessoa desencaixada
        IF v_bumped_person.dias_disponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.dias_disponiveis) > 0 THEN
          IF NOT (v_bumped_person.dias_disponiveis @> jsonb_build_array(v_dow)) THEN CONTINUE; END IF;
        END IF;

        IF v_bumped_person.periodos_disponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.periodos_disponiveis) > 0 THEN
          IF NOT (v_bumped_person.periodos_disponiveis @> jsonb_build_array(v_period_name)) THEN CONTINUE; END IF;
        END IF;

        IF v_bumped_person.datas_indisponiveis IS NOT NULL AND jsonb_array_length(v_bumped_person.datas_indisponiveis) > 0 THEN
          IF (v_bumped_person.datas_indisponiveis @> jsonb_build_array(v_extra_rec.event_date::text)) THEN CONTINUE; END IF;
        END IF;

        -- Verificar capacidade especifica daquela atividade extra futura
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
      RAISE EXCEPTION 'Não foi encontrada nenhuma sessão futura disponível e compatível com as restrições de disponibilidade da pessoa desencaixada. Operação cancelada com rollback integral.';
    END IF;

    -- Cancela o agendamento da pessoa normal desencaixada
    UPDATE public.atendimento_programacoes
    SET status = 'cancelado', updated_at = NOW()
    WHERE id = v_last_normal_prog.id;

    -- Reagenda a pessoa desencaixada utilizando o ID da nova sessão futura encontrada e recalcula ordem_sessao
    INSERT INTO public.atendimento_programacoes (
      pessoa_id, atividade_id, event_date, start_time, end_time, ordem_sessao, prioridade, status, observacoes
    ) VALUES (
      v_last_normal_prog.pessoa_id, v_future_atividade_id, v_next_date, v_future_start_time, v_future_end_time, v_future_count + 1, 'Normal', 'programado', 'Reagendado automaticamente devido a encaixe em reagendamento'
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
      format('Desencaixado da sessão do dia %s e reagendado automaticamente para a sessão do dia %s.', p_nova_event_date, v_next_date)
    );
  END IF;

  -- 6. Cancelar agendamento anterior da pessoa que está sendo reagendada
  UPDATE public.atendimento_programacoes
  SET status = 'cancelado', updated_at = NOW()
  WHERE id = p_programacao_id;

  -- 7. Recalcular a ocupação ativa final da sessão de destino após eventuais cancelamentos/remanejamentos
  SELECT COUNT(*) INTO v_count
  FROM public.atendimento_programacoes
  WHERE atividade_id = p_nova_atividade_id 
    AND event_date = p_nova_event_date 
    AND status IN ('programado', 'compareceu');

  -- 8. Criar nova programação para a pessoa com a ordem da sessão rigorosamente recalculada
  INSERT INTO public.atendimento_programacoes (
    pessoa_id, atividade_id, event_date, start_time, end_time, ordem_sessao, prioridade, status, observacoes
  ) VALUES (
    v_person.id,
    p_nova_atividade_id,
    p_nova_event_date,
    p_nova_start_time,
    p_nova_end_time,
    v_count + 1,
    v_person.prioridade,
    'programado',
    NULLIF(trim(p_observacoes), '')
  ) RETURNING * INTO v_new_prog;

  -- 9. Atualizar status da pessoa para programado
  UPDATE public.atendimento_pessoas
  SET status = 'programado', posicao_fila = NULL, updated_at = NOW()
  WHERE id = v_person.id;

  -- 10. Registrar histórico completo do reagendamento
  INSERT INTO public.atendimento_historico (
    pessoa_id, programacao_id, admin_id, action, dados_anteriores, dados_novos, observacao
  ) VALUES (
    v_person.id,
    v_new_prog.id,
    v_admin_id,
    'REAGENDAMENTO_ATENDIMENTO',
    to_jsonb(v_old_prog),
    to_jsonb(v_new_prog),
    format('Reagendado da data %s para a nova data %s. %s', v_old_prog.event_date, p_nova_event_date, COALESCE(trim(p_observacoes), ''))
  );

  RETURN to_jsonb(v_new_prog);
END;
$$;

-- Permissões REVOKE e GRANT com Assinatura Completa
REVOKE ALL ON FUNCTION public.atendimento_reagendar_programacao(UUID, UUID, DATE, TIME, TIME, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atendimento_reagendar_programacao(UUID, UUID, DATE, TIME, TIME, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

COMMIT;
