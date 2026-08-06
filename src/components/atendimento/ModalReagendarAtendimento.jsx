import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';
import { supabase } from '../../lib/supabase';

const ModalReagendarAtendimento = ({ isOpen, onClose, programacaoItem, onRescheduled }) => {
  const [capacidades, setCapacidades] = useState([]);
  const [programacoes, setProgramacoes] = useState([]);
  const [selectedAtividade, setSelectedAtividade] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [forceOverCapacity, setForceOverCapacity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [availabilityWarning, setAvailabilityWarning] = useState('');

  useEffect(() => {
    if (isOpen && programacaoItem) {
      loadData();
      const defaultDate = getNextServiceDate();
      setEventDate(defaultDate);
      setSelectedAtividade(''); // NUNCA seleciona sessão por default!
      setObservacoes('');
      setForceOverCapacity(false);
      setErrorMsg('');
      setAvailabilityWarning('');
    }
  }, [isOpen, programacaoItem]);

  useEffect(() => {
    if (eventDate && selectedAtividade && programacaoItem?.atendimento_pessoas) {
      checkAvailabilityConflict();
    } else {
      setAvailabilityWarning('');
    }
  }, [eventDate, selectedAtividade]);

  const loadData = async () => {
    try {
      // 1. Carrega todas as atividades ativas (regulares e extras)
      const { data: atvs } = await supabase
        .from('atividades')
        .select('*')
        .neq('active', false)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: false });

      // 2. Carrega capacidades personalizadas das atividades
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

      const listWithCap = (atvs || []).map(a => {
        const config = capMap[a.id] || { quantidade_salas: 3, atendimentos_por_sala: 3, capacidade: 9 };
        return {
          ...a,
          quantidade_salas: config.quantidade_salas,
          atendimentos_por_sala: config.atendimentos_por_sala,
          capacidade: config.quantidade_salas * config.atendimentos_por_sala,
        };
      });

      setCapacidades(listWithCap);

      // 3. Carrega programações ativas para cálculo de ocupação por data
      const progs = await atendimentoService.getAllProgramacoes();
      setProgramacoes(progs || []);
    } catch (err) {
      console.error('Erro ao carregar sessões e agendamentos:', err);
    }
  };

  const getNextServiceDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (![2, 3, 4].includes(d.getDay())) {
      d.setDate(d.getDate() + 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * Filtra rigorosamente as sessões válidas para a nova data selecionada (fuso horário local)
   */
  const getSessoesDisponiveisParaData = (dataStr) => {
    if (!dataStr) return [];
    const parts = dataStr.split('-');
    if (parts.length !== 3) return [];

    const [year, month, day] = parts.map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return [];

    // Fuso horário local absoluto
    const localDate = new Date(year, month - 1, day);
    const targetDow = localDate.getDay(); // 0 = Dom, 1 = Seg, 2 = Ter, 3 = Qua, 4 = Qui, 5 = Sex, 6 = Sáb

    const filtered = capacidades.filter(a => {
      if (a.active === false) return false;

      // 1. Atividade regular: event_date IS NULL/undefined e day_of_week igual ao targetDow da data
      if (a.event_date === null || a.event_date === undefined) {
        return Number(a.day_of_week) === targetDow;
      }

      // 2. Atendimento extra: event_date exatamente igual à data selecionada
      return a.event_date === dataStr;
    });

    // Calcula vagas reais restantes na data
    const withVagas = filtered.map(a => {
      const capMax = a.capacidade || 9;
      const ocupados = (programacoes || []).filter(p =>
        p.atividade_id === a.id &&
        p.event_date === dataStr &&
        ['programado', 'compareceu'].includes(p.status)
      ).length;

      const vagasRestantes = Math.max(0, capMax - ocupados);

      return {
        ...a,
        capMax,
        ocupados,
        vagasRestantes,
      };
    });

    // Ordenação por start_time crescente
    withVagas.sort((a, b) => (a.start_time || '00:00').localeCompare(b.start_time || '00:00'));
    return withVagas;
  };

  const checkAvailabilityConflict = () => {
    const pessoa = programacaoItem.atendimento_pessoas;
    if (!pessoa) return;

    const parts = eventDate.split('-');
    if (parts.length !== 3) return;
    const [year, month, day] = parts.map(Number);
    const d = new Date(year, month - 1, day);
    const dow = d.getDay();

    const sessoesDisponiveis = getSessoesDisponiveisParaData(eventDate);
    const atividade = sessoesDisponiveis.find(a => a.id === selectedAtividade);
    const startHour = atividade?.start_time ? parseInt(atividade.start_time.split(':')[0], 10) : 13;
    const periodName = startHour < 18 ? 'tarde' : 'noite';

    const conflicts = [];

    // Checa dia da semana
    if (Array.isArray(pessoa.dias_disponiveis) && pessoa.dias_disponiveis.length > 0) {
      const diasNum = pessoa.dias_disponiveis.map(Number);
      if (!diasNum.includes(dow)) {
        const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        conflicts.push(`A pessoa não marcou ${DAY_NAMES[dow]} como dia disponível.`);
      }
    }

    // Checa período
    if (Array.isArray(pessoa.periodos_disponiveis) && pessoa.periodos_disponiveis.length > 0) {
      if (!pessoa.periodos_disponiveis.includes(periodName)) {
        conflicts.push(`A pessoa não marcou o período da ${periodName} como disponível.`);
      }
    }

    // Checa datas indisponíveis
    if (Array.isArray(pessoa.datas_indisponiveis) && pessoa.datas_indisponiveis.includes(eventDate)) {
      conflicts.push(`A data ${eventDate.split('-').reverse().join('/')} foi cadastrada como indisponível pela pessoa.`);
    }

    if (conflicts.length > 0) {
      setAvailabilityWarning(conflicts.join(' '));
    } else {
      setAvailabilityWarning('');
    }
  };

  if (!isOpen || !programacaoItem) return null;

  const pessoa = programacaoItem.atendimento_pessoas;
  const sessoesDisponiveis = getSessoesDisponiveisParaData(eventDate);
  const selectedActivityObj = sessoesDisponiveis.find(a => a.id === selectedAtividade);
  const isSessionValid = !!selectedActivityObj;

  const handleReagendarSubmit = async (e) => {
    e.preventDefault();
    if (!eventDate || !selectedAtividade) {
      setErrorMsg('Selecione primeiro a nova data e a nova sessão de atendimento.');
      return;
    }

    const sessoesValidas = getSessoesDisponiveisParaData(eventDate);
    const atividade = sessoesValidas.find(a => a.id === selectedAtividade);

    if (!atividade) {
      setErrorMsg('A sessão selecionada não é válida para a nova data informada. Por favor, escolha uma opção da lista.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      await atendimentoService.reagendarAtendimento({
        pessoaId: pessoa.id,
        oldProgramacaoId: programacaoItem.id,
        atividadeId: selectedAtividade,
        eventDate,
        startTime: atividade.start_time || '13:30:00',
        endTime: atividade.end_time || '16:30:00',
        observacoes,
        forceOverCapacity,
      });

      const formattedDate = eventDate.split('-').reverse().join('/');
      const formattedTime = atividade.start_time ? atividade.start_time.slice(0, 5) : '13:30';
      onRescheduled(`Atendimento reagendado com sucesso para ${formattedDate} às ${formattedTime}.`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao reagendar atendimento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 border border-gray-100 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">update</span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-primary">
                Reagendar Atendimento
              </h3>
              <p className="text-xs text-gray-400">
                Altere a data ou a sessão programada para esta pessoa.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Resumo da Pessoa */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/60 text-xs space-y-1">
          <div className="font-bold text-primary text-sm">{pessoa?.nome || 'Pessoa'}</div>
          {pessoa?.telefone && <div className="text-gray-500 font-mono">{pessoa.telefone}</div>}
          <div className="text-gray-600 font-medium pt-1 border-t border-gray-200/50">
            Agendamento Atual: <strong className="text-primary">{programacaoItem.event_date ? programacaoItem.event_date.split('-').reverse().join('/') : '-'}</strong> ({programacaoItem.atividades?.name || 'Sessão'})
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            {errorMsg}
          </div>
        )}

        {availabilityWarning && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold p-3 rounded-xl flex items-start gap-2">
            <span className="material-symbols-outlined text-sm text-amber-700 shrink-0 mt-0.5">warning</span>
            <div>
              <strong className="block text-amber-950 font-bold mb-0.5">Aviso de Restrição de Disponibilidade:</strong>
              {availabilityWarning}
            </div>
          </div>
        )}

        <form onSubmit={handleReagendarSubmit} className="space-y-4">
          {/* Campo 1: Nova Data do Atendimento */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Nova Data do Atendimento *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={e => {
                setEventDate(e.target.value);
                setSelectedAtividade(''); // Limpa a sessão ao alterar a data
                setErrorMsg('');
                setAvailabilityWarning('');
              }}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary"
            />
          </div>

          {/* Campo 2: Nova Sessão / Trabalho */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Nova Sessão / Trabalho *
            </label>
            <select
              value={selectedAtividade}
              onChange={e => setSelectedAtividade(e.target.value)}
              disabled={!eventDate}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">
                {!eventDate ? 'Selecione primeiro a nova data' : 'Selecione uma sessão...'}
              </option>
              {sessoesDisponiveis.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.start_time ? item.start_time.slice(0, 5) : ''}
                  {item.end_time ? ` - ${item.end_time.slice(0, 5)}` : ''} — {item.vagasRestantes} {item.vagasRestantes === 1 ? 'vaga disponível' : 'vagas disponíveis'}
                </option>
              ))}
            </select>
          </div>

          {selectedActivityObj && (
            <div className="bg-amber-50 p-3 rounded-2xl text-xs text-amber-900 border border-amber-200/60 font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-amber-700">info</span>
                <span>
                  Capacidade total: <strong>{selectedActivityObj.capMax} vagas</strong>
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                selectedActivityObj.vagasRestantes > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-200 text-amber-950'
              }`}>
                {selectedActivityObj.vagasRestantes} {selectedActivityObj.vagasRestantes === 1 ? 'vaga disponível' : 'vagas disponíveis'}
              </span>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Motivo do Reagendamento / Observações
            </label>
            <textarea
              rows="2"
              placeholder="Ex: Solicitado pela pessoa devido a imprevisto"
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-xs font-medium text-gray-700"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="forceOverCapReagendar"
              checked={forceOverCapacity}
              onChange={e => setForceOverCapacity(e.target.checked)}
              className="w-4 h-4 text-primary rounded focus:ring-primary"
            />
            <label htmlFor="forceOverCapReagendar" className="text-xs font-semibold text-gray-700 cursor-pointer">
              Ignorar capacidade se a sessão estiver cheia
            </label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !eventDate || !selectedAtividade || !isSessionValid}
              className="flex-1 py-3 bg-amber-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-600/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Reagendando...' : 'Confirmar Reagendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalReagendarAtendimento;
