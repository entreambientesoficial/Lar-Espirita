import { supabase } from './supabase';

/**
 * SERVIÇOS DE FILA DE ATENDIMENTO PÚBLICO (CHAMADAS RPC TRANSACIONAIS)
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

    if (status === 'aguardando' || !status) {
      query = query.order('posicao_fila', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
    } else {
      query = query.order('updated_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // 2. Cadastrar pessoa na fila (Via RPC Transacional - Admin via auth.uid())
  createPessoa: async (pessoaData, { placeAsPriority = false } = {}) => {
    const { data, error } = await supabase.rpc('atendimento_cadastrar_pessoa', {
      p_nome: pessoaData.nome,
      p_telefone: pessoaData.telefone || null,
      p_tipo_atendimento: pessoaData.tipo_atendimento || 'Apometria',
      p_prioridade: pessoaData.prioridade || 'Normal',
      p_motivo_urgencia: pessoaData.motivo_urgencia || null,
      p_observacoes: pessoaData.observacoes || null,
      p_data_entrada: pessoaData.data_entrada || new Date().toISOString().split('T')[0],
      p_place_as_priority: placeAsPriority,
    });

    if (error) throw error;
    return data;
  },

  // 2.1 Cadastrar e programar diretamente pessoa urgente (Com reagendamento automático em vaga futura)
  createAndProgramUrgente: async ({
    nome,
    telefone,
    tipo_atendimento,
    motivo_urgencia,
    observacoes,
    data_entrada,
    atividadeId,
    eventDate,
    startTime,
    endTime,
    forceOverCapacity = false,
  }) => {
    const { data, error } = await supabase.rpc('atendimento_cadastrar_e_programar_urgente', {
      p_nome: nome,
      p_telefone: telefone || null,
      p_tipo_atendimento: tipo_atendimento || 'Apometria',
      p_motivo_urgencia: motivo_urgencia,
      p_observacoes: observacoes || null,
      p_data_entrada: data_entrada || new Date().toISOString().split('T')[0],
      p_atividade_id: atividadeId,
      p_event_date: eventDate,
      p_start_time: startTime,
      p_end_time: endTime,
      p_force_over_capacity: forceOverCapacity,
    });

    if (error) throw error;
    return data;
  },

  // 3. Atualizar dados cadastrais de uma pessoa
  updatePessoa: async (id, updates) => {
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
      action: 'EDICAO_PESSOA',
      dados_anteriores: previous,
      dados_novos: updated,
      observacao: 'Dados cadastrais atualizados.',
    });

    return updated;
  },

  // 4. Reorganizar posição manual na fila (Via RPC Transacional)
  reorganizePosition: async (pessoaId, newPos) => {
    const { error } = await supabase.rpc('atendimento_mover_posicao', {
      p_pessoa_id: pessoaId,
      p_new_pos: newPos,
    });

    if (error) throw error;
  },

  // 5. Excluir pessoa da fila (Via RPC Transacional)
  deletePessoa: async (pessoaId) => {
    const { error } = await supabase.rpc('atendimento_excluir_pessoa', {
      p_pessoa_id: pessoaId,
    });

    if (error) throw error;
  },

  // 6. Capacidades por atividade
  getCapacidades: async () => {
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

  updateCapacidade: async (atividadeId, capacidade) => {
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

  // 7. Cálculo de Previsão Aproximada
  calculatePrevisao: (posicaoFila, totalCapacidadeSemanal) => {
    if (!posicaoFila || posicaoFila <= 0) return 'Previsão ainda não disponível';
    if (!totalCapacidadeSemanal || totalCapacidadeSemanal <= 0) {
      return 'Configure a quantidade de atendimentos por sessão para calcular a previsão.';
    }

    const semanasEstimadas = Math.ceil(posicaoFila / totalCapacidadeSemanal);
    const minSemanas = Math.max(1, semanasEstimadas - 1);
    const maxSemanas = semanasEstimadas + 1;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + semanasEstimadas * 7);

    const monthName = targetDate.toLocaleDateString('pt-BR', { month: 'long' });
    const quinzena = targetDate.getDate() <= 15 ? 'primeira quinzena' : 'segunda quinzena';
    const year = targetDate.getFullYear();

    return `Previsão aproximada: ${minSemanas} a ${maxSemanas} semanas (${quinzena} de ${monthName} de ${year})`;
  },

  // 8. Programar Atendimento (Via RPC Transacional)
  programarAtendimento: async ({
    pessoaId,
    atividadeId,
    eventDate,
    startTime,
    endTime,
    observacoes = '',
    forceOverCapacity = false,
  }) => {
    const { data, error } = await supabase.rpc('atendimento_programar_pessoa', {
      p_pessoa_id: pessoaId,
      p_atividade_id: atividadeId,
      p_event_date: eventDate,
      p_start_time: startTime,
      p_end_time: endTime,
      p_observacoes: observacoes || null,
      p_force_over_capacity: forceOverCapacity,
    });

    if (error) throw error;

    if (data && data.over_capacity) {
      return {
        overCapacity: true,
        capacity: data.capacity,
        currentCount: data.count,
        lastNormalPerson: data.last_normal_pessoa_id ? { pessoa_id: data.last_normal_pessoa_id } : null,
      };
    }

    return { overCapacity: false, programacao_id: data.programacao_id };
  },

  // 9. Remanejar Pessoa em Sessão Cheia para Encaixe de Urgência (Via RPC Transacional)
  remanejarEInserirUrgencia: async ({
    pessoaUrgenteId,
    atividadeId,
    eventDate,
    startTime,
    endTime,
    pessoaParaRemanejarId,
  }) => {
    const { error } = await supabase.rpc('atendimento_remanejar_urgencia', {
      p_pessoa_urgente_id: pessoaUrgenteId,
      p_atividade_id: atividadeId,
      p_event_date: eventDate,
      p_start_time: startTime,
      p_end_time: endTime,
      p_pessoa_remanejar_id: pessoaParaRemanejarId || null,
    });

    if (error) throw error;
  },

  // 10. Buscar Agendamentos do Dia
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

  // 11. Buscar Todos os Agendamentos Programados
  getAllProgramacoes: async () => {
    const { data, error } = await supabase
      .from('atendimento_programacoes')
      .select('*, atendimento_pessoas(*), atividades(*)')
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data || [];
  },

  // 12. Atualizar Status do Agendamento (Via RPC Transacional)
  updateStatusProgramacao: async ({
    programacaoId,
    novoStatus,
    posicaoRetorno = 1,
    observacao = '',
  }) => {
    const { error } = await supabase.rpc('atendimento_atualizar_status_programacao', {
      p_programacao_id: programacaoId,
      p_novo_status: novoStatus,
      p_posicao_retorno: posicaoRetorno,
      p_observacao: observacao || null,
    });

    if (error) throw error;
  },

  // 13. Registrar Log no Histórico
  logHistorico: async ({
    pessoa_id,
    programacao_id = null,
    action,
    dados_anteriores = null,
    dados_novos = null,
    observacao = null,
  }) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { error } = await supabase.from('atendimento_historico').insert([
      {
        pessoa_id,
        programacao_id,
        admin_id: userData.user.id,
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

  // 15. Buscar Histórico de uma Pessoa
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
