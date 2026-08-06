import { supabase } from './supabase';

/**
 * SERVIÇOS DE FILA DE ATENDIMENTO PÚBLICO (ISOLADO DO FLUXO DE MÉDIUNS)
 */
export const atendimentoService = {
  // 1. Buscar pessoas da fila (com filtros e busca)
  getPessoas: async ({ search = '', status = '', prioridade = '', tipo = '' } = {}) => {
    let query = supabase.from('atendimento_pessoas').select('*');

    if (status) {
      query = query.eq('status', status);
    }
    if (prioridade) {
      query = query.eq('prioridade', prioridade);
    }
    if (tipo) {
      query = query.eq('tipo_atendimento', tipo);
    }
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`nome.ilike.${term},telefone.ilike.${term}`);
    }

    // Se filtrando por aguardando, ordena pela posição na fila
    if (status === 'aguardando' || !status) {
      query = query.order('posicao_fila', { ascending: true }).order('created_at', { ascending: true });
    } else {
      query = query.order('updated_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // 2. Cadastrar pessoa na fila
  createPessoa: async (pessoaData, adminId, { placeAsPriority = false } = {}) => {
    // Buscar maior posição atual entre pessoas aguardando
    const { data: currentQueue } = await supabase
      .from('atendimento_pessoas')
      .select('posicao_fila')
      .eq('status', 'aguardando')
      .order('posicao_fila', { ascending: false })
      .limit(1);

    const maxPos = currentQueue && currentQueue.length > 0 ? currentQueue[0].posicao_fila : 0;

    let targetPos = maxPos + 1;

    if (placeAsPriority) {
      targetPos = 1;
      // Empurra todas as pessoas aguardando 1 posição para baixo
      const { data: waitingList } = await supabase
        .from('atendimento_pessoas')
        .select('id, posicao_fila')
        .eq('status', 'aguardando')
        .order('posicao_fila', { ascending: false });

      if (waitingList && waitingList.length > 0) {
        for (const item of waitingList) {
          await supabase
            .from('atendimento_pessoas')
            .update({ posicao_fila: item.posicao_fila + 1 })
            .eq('id', item.id);
        }
      }
    }

    const payload = {
      nome: pessoaData.nome.trim(),
      telefone: pessoaData.telefone ? pessoaData.telefone.trim() : null,
      tipo_atendimento: pessoaData.tipo_atendimento || 'Apometria',
      prioridade: pessoaData.prioridade || 'Normal',
      motivo_urgencia: pessoaData.prioridade === 'Urgente' ? pessoaData.motivo_urgencia?.trim() : null,
      observacoes: pessoaData.observacoes ? pessoaData.observacoes.trim() : null,
      data_entrada: pessoaData.data_entrada || new Date().toISOString().split('T')[0],
      status: 'aguardando',
      posicao_fila: targetPos,
    };

    const { data: created, error } = await supabase
      .from('atendimento_pessoas')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    // Log no histórico
    await atendimentoService.logHistorico({
      pessoa_id: created.id,
      admin_id: adminId,
      action: 'CADASTRO_PESSOA',
      dados_novos: created,
      observacao: placeAsPriority ? 'Cadastrado como urgência na 1ª posição da fila.' : `Cadastrado na posição ${targetPos}.`,
    });

    return created;
  },

  // 3. Atualizar dados de uma pessoa
  updatePessoa: async (id, updates, adminId) => {
    const { data: previous } = await supabase
      .from('atendimento_pessoas')
      .select('*')
      .eq('id', id)
      .single();

    const { data: updated, error } = await supabase
      .from('atendimento_pessoas')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await atendimentoService.logHistorico({
      pessoa_id: id,
      admin_id: adminId,
      action: 'EDICAO_PESSOA',
      dados_anteriores: previous,
      dados_novos: updated,
      observacao: 'Dados cadastrais atualizados.',
    });

    return updated;
  },

  // 4. Reorganizar posição manual na fila (Sem deixar buracos ou duplicatas)
  reorganizePosition: async (pessoaId, newPos, adminId) => {
    const { data: targetPerson } = await supabase
      .from('atendimento_pessoas')
      .select('*')
      .eq('id', pessoaId)
      .single();

    if (!targetPerson || targetPerson.status !== 'aguardando') return;

    const oldPos = targetPerson.posicao_fila;
    if (oldPos === newPos) return;

    // Buscar lista ordenada de pessoas aguardando
    const { data: waitingList } = await supabase
      .from('atendimento_pessoas')
      .select('id, posicao_fila')
      .eq('status', 'aguardando')
      .order('posicao_fila', { ascending: true });

    if (!waitingList || waitingList.length === 0) return;

    // Garante limites válidos
    const finalPos = Math.max(1, Math.min(newPos, waitingList.length));

    // Remove a pessoa da lista temporária e reinsere na nova posição
    const rest = waitingList.filter(p => p.id !== pessoaId);
    rest.splice(finalPos - 1, 0, { id: pessoaId, posicao_fila: finalPos });

    // Atualiza posições no BD
    for (let i = 0; i < rest.length; i++) {
      const item = rest[i];
      const correctPos = i + 1;
      if (item.posicao_fila !== correctPos || item.id === pessoaId) {
        await supabase
          .from('atendimento_pessoas')
          .update({ posicao_fila: correctPos, updated_at: new Date().toISOString() })
          .eq('id', item.id);
      }
    }

    await atendimentoService.logHistorico({
      pessoa_id: pessoaId,
      admin_id: adminId,
      action: 'REORGANIZACAO_FILA',
      dados_anteriores: { posicao_fila: oldPos },
      dados_novos: { posicao_fila: finalPos },
      observacao: `Posição alterada de #${oldPos} para #${finalPos}.`,
    });
  },

  // 5. Excluir pessoa da fila (Permitido apenas se não houver agendamentos/histórico associados)
  deletePessoa: async (pessoaId, adminId) => {
    // Verifica agendamentos vinculados
    const { count: progCount } = await supabase
      .from('atendimento_programacoes')
      .select('id', { count: 'exact', head: true })
      .eq('pessoa_id', pessoaId);

    if (progCount && progCount > 0) {
      throw new Error('Esta pessoa já possui histórico de agendamentos e não pode ser excluída fisicamente. Altere o status para Cancelado.');
    }

    const { data: person } = await supabase
      .from('atendimento_pessoas')
      .select('nome, posicao_fila, status')
      .eq('id', pessoaId)
      .single();

    // Remove registros de histórico atrelados
    await supabase.from('atendimento_historico').delete().eq('pessoa_id', pessoaId);

    // Deleta a pessoa
    const { error } = await supabase.from('atendimento_pessoas').delete().eq('id', pessoaId);
    if (error) throw error;

    // Se estava na fila de espera, reordena os demais
    if (person && person.status === 'aguardando') {
      const { data: waitingList } = await supabase
        .from('atendimento_pessoas')
        .select('id, posicao_fila')
        .eq('status', 'aguardando')
        .order('posicao_fila', { ascending: true });

      if (waitingList) {
        for (let i = 0; i < waitingList.length; i++) {
          await supabase
            .from('atendimento_pessoas')
            .update({ posicao_fila: i + 1 })
            .eq('id', waitingList[i].id);
        }
      }
    }
  },

  // 6. Capacidade de atendimentos por atividade
  getCapacidades: async () => {
    // Busca atividades regulares ativas
    const { data: atividades } = await supabase
      .from('atividades')
      .select('*')
      .neq('active', false)
      .is('event_date', null)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false });

    const { data: caps } = await supabase.from('atendimento_capacidades').select('*');

    const capMap = {};
    if (caps) {
      caps.forEach(c => { capMap[c.atividade_id] = c.capacidade; });
    }

    return (atividades || []).map(a => ({
      ...a,
      capacidade: capMap[a.id] !== undefined ? capMap[a.id] : 6,
    }));
  },

  updateCapacidade: async (atividadeId, capacidade, adminId) => {
    const { data, error } = await supabase
      .from('atendimento_capacidades')
      .upsert(
        { atividade_id: atividadeId, capacidade, active: true, updated_at: new Date().toISOString() },
        { onConflict: 'atividade_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 7. Cálculo de Previsão Aproximada de Atendimento
  calculatePrevisao: (posicaoFila, totalCapacidadeSemanal) => {
    if (!posicaoFila || posicaoFila <= 0) return 'Previsão ainda não disponível';
    if (!totalCapacidadeSemanal || totalCapacidadeSemanal <= 0) {
      return 'Configure a quantidade de atendimentos por sessão para calcular a previsão.';
    }

    // Semanas estimadas
    const semanasEstimadas = Math.ceil(posicaoFila / totalCapacidadeSemanal);
    const minSemanas = Math.max(1, semanasEstimadas - 1);
    const maxSemanas = semanasEstimadas + 1;

    // Calcular quinzena/mês estimado
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + semanasEstimadas * 7);

    const monthName = targetDate.toLocaleDateString('pt-BR', { month: 'long' });
    const quinzena = targetDate.getDate() <= 15 ? 'primeira quinzena' : 'segunda quinzena';
    const year = targetDate.getFullYear();

    return `Previsão aproximada: ${minSemanas} a ${maxSemanas} semanas (${quinzena} de ${monthName} de ${year})`;
  },

  // 8. Programar atendimento para uma pessoa em data/sessão específica
  programarAtendimento: async ({
    pessoaId,
    atividadeId,
    eventDate,
    startTime,
    endTime,
    adminId,
    observacoes = '',
    forceOverCapacity = false,
  }) => {
    // Verifica capacidade da sessão
    const { data: capRecord } = await supabase
      .from('atendimento_capacidades')
      .select('capacidade')
      .eq('atividade_id', atividadeId)
      .maybeSingle();

    const capacidadeMax = capRecord ? capRecord.capacidade : 6;

    // Conta agendamentos ativos já feitos para este dia e sessão
    const { data: currentProgs } = await supabase
      .from('atendimento_programacoes')
      .select('id, pessoa_id, prioridade, status, ordem_sessao, atendimento_pessoas(nome)')
      .eq('atividade_id', atividadeId)
      .eq('event_date', eventDate)
      .neq('status', 'cancelado')
      .order('ordem_sessao', { ascending: true });

    const activeCount = currentProgs ? currentProgs.length : 0;

    // Se sessão está cheia e não foi forçado a encaixe urgente
    if (activeCount >= capacidadeMax && !forceOverCapacity) {
      // Localizar última pessoa normal da sessão para remanejamento
      const normalList = (currentProgs || []).filter(p => p.prioridade !== 'Urgente' && p.status === 'programado');
      const lastNormal = normalList.length > 0 ? normalList[normalList.length - 1] : null;

      return {
        overCapacity: true,
        capacity: capacidadeMax,
        currentCount: activeCount,
        lastNormalPerson: lastNormal,
      };
    }

    // Busca dados da pessoa
    const { data: person } = await supabase
      .from('atendimento_pessoas')
      .select('*')
      .eq('id', pessoaId)
      .single();

    const nextOrdem = activeCount + 1;

    // Criar agendamento
    const { data: newProg, error: progErr } = await supabase
      .from('atendimento_programacoes')
      .insert([
        {
          pessoa_id: pessoaId,
          atividade_id: atividadeId,
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime,
          ordem_sessao: nextOrdem,
          prioridade: person.prioridade,
          status: 'programado',
          observacoes: observacoes || null,
        },
      ])
      .select()
      .single();

    if (progErr) throw progErr;

    // Atualiza status da pessoa para 'programado'
    await supabase
      .from('atendimento_pessoas')
      .update({ status: 'programado', updated_at: new Date().toISOString() })
      .eq('id', pessoaId);

    // Se a pessoa estava na fila de espera, reajusta a posição dos demais que ficaram aguardando
    const { data: waitingList } = await supabase
      .from('atendimento_pessoas')
      .select('id, posicao_fila')
      .eq('status', 'aguardando')
      .order('posicao_fila', { ascending: true });

    if (waitingList) {
      for (let i = 0; i < waitingList.length; i++) {
        await supabase
          .from('atendimento_pessoas')
          .update({ posicao_fila: i + 1 })
          .eq('id', waitingList[i].id);
      }
    }

    // Registra histórico
    await atendimentoService.logHistorico({
      pessoa_id: pessoaId,
      programacao_id: newProg.id,
      admin_id: adminId,
      action: 'PROGRAMACAO_ATENDIMENTO',
      dados_novos: newProg,
      observacao: `Programado para ${eventDate} às ${startTime ? startTime.slice(0, 5) : 'horário da sessão'}.`,
    });

    return { overCapacity: false, programacao: newProg };
  },

  // 9. Remanejar pessoa em caso de urgência em sessão cheia
  remanejarEInserirUrgencia: async ({
    pessoaUrgenteId,
    atividadeId,
    eventDate,
    startTime,
    endTime,
    pessoaParaRemanejarId,
    adminId,
  }) => {
    // 1. Programar pessoa urgente na sessão
    const result = await atendimentoService.programarAtendimento({
      pessoaId: pessoaUrgenteId,
      atividadeId,
      eventDate,
      startTime,
      endTime,
      adminId,
      forceOverCapacity: true,
    });

    // 2. Se houver pessoa normal para remanejar
    if (pessoaParaRemanejarId) {
      // Cancela o agendamento atual da pessoa remanejada
      const { data: progAntiga } = await supabase
        .from('atendimento_programacoes')
        .select('*')
        .eq('pessoa_id', pessoaParaRemanejarId)
        .eq('event_date', eventDate)
        .eq('atividade_id', atividadeId)
        .single();

      if (progAntiga) {
        await supabase
          .from('atendimento_programacoes')
          .update({ status: 'cancelado', updated_at: new Date().toISOString() })
          .eq('id', progAntiga.id);

        // Reinsere a pessoa no status 'aguardando' na 1ª posição da fila
        await supabase
          .from('atendimento_pessoas')
          .update({ status: 'aguardando', updated_at: new Date().toISOString() })
          .eq('id', pessoaParaRemanejarId);

        await atendimentoService.reorganizePosition(pessoaParaRemanejarId, 1, adminId);

        await atendimentoService.logHistorico({
          pessoa_id: pessoaParaRemanejarId,
          programacao_id: progAntiga.id,
          admin_id: adminId,
          action: 'REMANEJAMENTO_URGENCIA',
          dados_anteriores: progAntiga,
          observacao: `Remanejado automaticamente da sessão ${eventDate} devido ao encaixe de urgência. Retornado à 1ª posição da fila.`,
        });
      }
    }

    return result;
  },

  // 10. Buscar atendimentos programados do dia
  getProgramacoesDia: async (dateStr) => {
    const todayStr = dateStr || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('atendimento_programacoes')
      .select('*, atendimento_pessoas(*), atividades(*)')
      .eq('event_date', todayStr)
      .neq('status', 'cancelado')
      .order('start_time', { ascending: true, nullsFirst: false })
      .order('ordem_sessao', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // 11. Buscar todos os atendimentos programados (futuros e passados)
  getAllProgramacoes: async () => {
    const { data, error } = await supabase
      .from('atendimento_programacoes')
      .select('*, atendimento_pessoas(*), atividades(*)')
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data || [];
  },

  // 12. Atualizar status do agendamento (compareceu, atendido, nao_compareceu, cancelado, retornar_fila)
  updateStatusProgramacao: async ({
    programacaoId,
    novoStatus,
    adminId,
    posicaoRetorno = 1,
    observacao = '',
  }) => {
    const { data: prog } = await supabase
      .from('atendimento_programacoes')
      .select('*, atendimento_pessoas(*)')
      .eq('id', programacaoId)
      .single();

    if (!prog) throw new Error('Agendamento não encontrado.');

    const oldStatus = prog.status;

    // Atualiza status do agendamento
    const { data: updatedProg, error } = await supabase
      .from('atendimento_programacoes')
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', programacaoId)
      .select()
      .single();

    if (error) throw error;

    // Atualiza status da pessoa
    if (novoStatus === 'atendido' || novoStatus === 'compareceu' || novoStatus === 'nao_compareceu' || novoStatus === 'cancelado') {
      await supabase
        .from('atendimento_pessoas')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', prog.pessoa_id);
    }

    // Se retornando para a fila
    if (novoStatus === 'retornar_fila') {
      // Marca agendamento como cancelado
      await supabase
        .from('atendimento_programacoes')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('id', programacaoId);

      // Marca pessoa como 'aguardando'
      await supabase
        .from('atendimento_pessoas')
        .update({ status: 'aguardando', updated_at: new Date().toISOString() })
        .eq('id', prog.pessoa_id);

      // Reorganiza na posição desejada
      await atendimentoService.reorganizePosition(prog.pessoa_id, posicaoRetorno, adminId);
    }

    // Registra no histórico
    await atendimentoService.logHistorico({
      pessoa_id: prog.pessoa_id,
      programacao_id: programacaoId,
      admin_id: adminId,
      action: `STATUS_${novoStatus.toUpperCase()}`,
      dados_anteriores: { status: oldStatus },
      dados_novos: { status: novoStatus },
      observacao: observacao || `Status alterado de ${oldStatus} para ${novoStatus}.`,
    });

    return updatedProg;
  },

  // 13. Registrar Log no Histórico
  logHistorico: async ({
    pessoa_id,
    programacao_id = null,
    admin_id,
    action,
    dados_anteriores = null,
    dados_novos = null,
    observacao = null,
  }) => {
    const { error } = await supabase.from('atendimento_historico').insert([
      {
        pessoa_id,
        programacao_id,
        admin_id,
        action,
        dados_anteriores,
        dados_novos,
        observacao,
      },
    ]);
    if (error) console.error('Erro ao registrar histórico:', error);
  },

  // 14. Buscar Histórico Geral de Auditoria
  getHistoricoGeral: async () => {
    const { data, error } = await supabase
      .from('atendimento_historico')
      .select('*, atendimento_pessoas(nome), profiles(name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return data || [];
  },

  // 15. Buscar Histórico Específico de uma Pessoa
  getHistoricoPessoa: async (pessoaId) => {
    const { data, error } = await supabase
      .from('atendimento_historico')
      .select('*, profiles(name)')
      .eq('pessoa_id', pessoaId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
