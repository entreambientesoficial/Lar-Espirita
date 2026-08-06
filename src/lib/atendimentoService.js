import { supabase } from './supabase';

/**
 * SERVIÇOS DE FILA DE ATENDIMENTO PÚBLICO (CHAMADAS RPC TRANSACIONAIS E CONTROLE DE DISPONIBILIDADE)
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

    // Atualiza campos de disponibilidade se informados
    if (
      pessoaData.dias_disponiveis ||
      pessoaData.periodos_disponiveis ||
      pessoaData.datas_indisponiveis ||
      pessoaData.observacoes_disponibilidade
    ) {
      await supabase
        .from('atendimento_pessoas')
        .update({
          dias_disponiveis: pessoaData.dias_disponiveis || null,
          periodos_disponiveis: pessoaData.periodos_disponiveis || null,
          datas_indisponiveis: pessoaData.datas_indisponiveis || null,
          observacoes_disponibilidade: pessoaData.observacoes_disponibilidade || null,
        })
        .eq('id', data.id);
    }

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
    dias_disponiveis = null,
    periodos_disponiveis = null,
    datas_indisponiveis = null,
    observacoes_disponibilidade = null,
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
      p_dias_disponiveis: dias_disponiveis || null,
      p_periodos_disponiveis: periodos_disponiveis || null,
      p_datas_indisponiveis: datas_indisponiveis || null,
      p_observacoes_disponibilidade: observacoes_disponibilidade || null,
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
      observacao: 'Dados cadastrais e de disponibilidade atualizados.',
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
      caps.forEach(c => {
        capMap[c.atividade_id] = {
          quantidade_salas: c.quantidade_salas ?? 3,
          atendimentos_por_sala: c.atendimentos_por_sala ?? 3,
          capacidade: (c.quantidade_salas ?? 3) * (c.atendimentos_por_sala ?? 3),
        };
      });
    }

    return (atividades || []).map(a => {
      const config = capMap[a.id] || { quantidade_salas: 3, atendimentos_por_sala: 3, capacidade: 9 };
      return {
        ...a,
        quantidade_salas: config.quantidade_salas,
        atendimentos_por_sala: config.atendimentos_por_sala,
        capacidade: config.quantidade_salas * config.atendimentos_por_sala,
      };
    });
  },

  updateCapacidade: async (atividadeId, quantidadeSalas, atendimentosPorSala) => {
    const qSalas = Math.max(1, parseInt(quantidadeSalas, 10) || 3);
    const aPorSala = Math.max(1, parseInt(atendimentosPorSala, 10) || 3);
    const capacidadeCalculada = qSalas * aPorSala;

    const { data, error } = await supabase
      .from('atendimento_capacidades')
      .upsert(
        {
          atividade_id: atividadeId,
          quantidade_salas: qSalas,
          atendimentos_por_sala: aPorSala,
          capacidade: capacidadeCalculada,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'atividade_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * 7. Cálculo de Previsão Realista RESPEITANDO A DATA DE ENTRADA (strictly > data_entrada)
   *    E TODAS AS RESTRIÇÕES DE DISPONIBILIDADE DO PACIENTE.
   */
  calculatePrevisaoReal: (posicaoFila, capacidades = [], programacoes = [], pessoa = null) => {
    if (!posicaoFila || posicaoFila <= 0) return null;
    if (!capacidades || capacidades.length === 0) {
      return { text: 'Aguardando sessões', formattedDate: null };
    }

    const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    // Mapeia ocupação por sessão e data YYYY-MM-DD_atividadeId (Apenas agendamentos ativos)
    const ocupacaoMap = {};
    (programacoes || []).forEach(p => {
      if (p.event_date && ['programado', 'compareceu'].includes(p.status)) {
        const key = `${p.event_date}_${p.atividade_id}`;
        ocupacaoMap[key] = (ocupacaoMap[key] || 0) + 1;
      }
    });

    const dataEntradaRef = pessoa?.data_entrada || new Date().toISOString().split('T')[0];

    const diasDisp = Array.isArray(pessoa?.dias_disponiveis) ? pessoa.dias_disponiveis.map(Number) : null;
    const periodosDisp = Array.isArray(pessoa?.periodos_disponiveis) ? pessoa.periodos_disponiveis : null;
    const datasIndisp = Array.isArray(pessoa?.datas_indisponiveis) ? pessoa.datas_indisponiveis : [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessoesProjetadas = [];

    for (let dayOffset = 0; dayOffset <= 365; dayOffset++) {
      const currentDate = new Date(today);
      currentDate.setDate(currentDate.getDate() + dayOffset);

      const dateStr = currentDate.toISOString().split('T')[0];

      // Regra 1: Previsão automática NUNCA considera o mesmo dia do cadastro (strictly > data_entrada)
      if (dateStr <= dataEntradaRef) {
        continue;
      }

      const dow = currentDate.getDay();

      // Regra 2: Filtra por dias da semana disponíveis se especificado
      if (diasDisp && diasDisp.length > 0 && !diasDisp.includes(dow)) {
        continue;
      }

      // Regra 3: Filtra por datas específicas indisponíveis
      if (datasIndisp && datasIndisp.includes(dateStr)) {
        continue;
      }

      // Busca sessões regulares e extras ativas
      const regSessoes = capacidades.filter(c => c.day_of_week === dow && !c.event_date);
      const extraSessoes = capacidades.filter(c => c.event_date === dateStr);

      const sessoesDoDia = [...regSessoes, ...extraSessoes];
      sessoesDoDia.sort((a, b) => (a.start_time || '00:00').localeCompare(b.start_time || '00:00'));

      sessoesDoDia.forEach(sessao => {
        const startTime = sessao.start_time || '13:30';
        const startHour = parseInt(startTime.split(':')[0], 10);
        const periodName = startHour < 18 ? 'tarde' : 'noite';

        // Regra 4: Filtra por período disponível (tarde vs noite)
        if (periodosDisp && periodosDisp.length > 0 && !periodosDisp.includes(periodName)) {
          return;
        }

        const capTotal = sessao.capacidade || (sessao.quantidade_salas * sessao.atendimentos_por_sala) || 9;
        const ocupado = ocupacaoMap[`${dateStr}_${sessao.id}`] || 0;
        const vagasLivres = Math.max(0, capTotal - ocupado);

        if (vagasLivres > 0) {
          sessoesProjetadas.push({
            dateStr,
            dowName: DAY_NAMES[dow],
            timeStr: startTime.slice(0, 5),
            atividadeName: sessao.name,
            vagasLivres,
          });
        }
      });
    }

    let pessoasAlocadas = 0;
    for (const sessao of sessoesProjetadas) {
      if (pessoasAlocadas + sessao.vagasLivres >= posicaoFila) {
        const parts = sessao.dateStr.split('-');
        const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;

        return {
          formattedDate,
          rawDate: sessao.dateStr,
          dayOfWeek: sessao.dowName,
          time: sessao.timeStr,
          atividadeName: sessao.atividadeName,
          text: `${formattedDate} (${sessao.dowName} - ${sessao.timeStr})`,
        };
      }
      pessoasAlocadas += sessao.vagasLivres;
    }

    return {
      text: 'Sem previsão disponível para as restrições informadas.',
      formattedDate: null,
    };
  },

  // Mantido para compatibilidade prévia
  calculatePrevisao: (posicaoFila, totalCapacidadeSemanal) => {
    if (!posicaoFila || posicaoFila <= 0) return 'Previsão ainda não disponível';
    if (!totalCapacidadeSemanal || totalCapacidadeSemanal <= 0) {
      return 'Configure a quantidade de atendimentos por sessão para calcular a previsão.';
    }
    const semanasEstimadas = Math.ceil(posicaoFila / totalCapacidadeSemanal);
    const minSemanas = Math.max(1, semanasEstimadas - 1);
    const maxSemanas = semanasEstimadas + 1;
    return `${minSemanas} a ${maxSemanas} semanas`;
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

  // 8.1 Reagendar Atendimento (Via RPC Transacional Única no PostgreSQL)
  reagendarAtendimento: async ({
    pessoaId,
    oldProgramacaoId,
    atividadeId,
    eventDate,
    startTime,
    endTime,
    observacoes = '',
    forceOverCapacity = false,
    ignoreAvailabilityConflict = false,
  }) => {
    const { data, error } = await supabase.rpc('atendimento_reagendar_programacao', {
      p_programacao_id: oldProgramacaoId,
      p_nova_atividade_id: atividadeId,
      p_nova_event_date: eventDate,
      p_nova_start_time: startTime,
      p_nova_end_time: endTime,
      p_observacoes: observacoes || null,
      p_force_over_capacity: forceOverCapacity,
      p_ignore_availability_conflict: ignoreAvailabilityConflict,
    });

    if (error) throw error;
    return data;
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

  // 14. Buscar Histórico Geral de Auditoria com Relacionamentos Completos
  getHistoricoGeral: async () => {
    const { data, error } = await supabase
      .from('atendimento_historico')
      .select('*, atendimento_pessoas(*), atendimento_programacoes(*), profiles(name)')
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
