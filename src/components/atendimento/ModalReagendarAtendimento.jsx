import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';
import { supabase } from '../../lib/supabase';

const ModalReagendarAtendimento = ({ isOpen, onClose, programacaoItem, onRescheduled }) => {
  const [atividades, setAtividades] = useState([]);
  const [selectedAtividade, setSelectedAtividade] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [forceOverCapacity, setForceOverCapacity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [availabilityWarning, setAvailabilityWarning] = useState('');

  useEffect(() => {
    if (isOpen && programacaoItem) {
      loadAtividades();
      setEventDate(programacaoItem.event_date || getNextServiceDate());
      setSelectedAtividade(programacaoItem.atividade_id || '');
      setObservacoes('');
      setForceOverCapacity(false);
      setErrorMsg('');
      setAvailabilityWarning('');
    }
  }, [isOpen, programacaoItem]);

  useEffect(() => {
    if (eventDate && selectedAtividade && programacaoItem?.atendimento_pessoas) {
      checkAvailabilityConflict();
    }
  }, [eventDate, selectedAtividade]);

  const loadAtividades = async () => {
    try {
      const { data } = await supabase
        .from('atividades')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });
      setAtividades(data || []);
      if (data && data.length > 0 && !selectedAtividade) {
        setSelectedAtividade(data[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar sessões:', err);
    }
  };

  const getNextServiceDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Garante sessionDate > data_entrada
    while (![2, 3, 4].includes(d.getDay())) {
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString().split('T')[0];
  };

  const checkAvailabilityConflict = () => {
    const pessoa = programacaoItem.atendimento_pessoas;
    if (!pessoa) return;

    const d = new Date(eventDate + 'T00:00:00');
    const dow = d.getDay();
    const atividade = atividades.find(a => a.id === selectedAtividade);
    const startHour = atividade?.start_time ? parseInt(atividade.start_time.split(':')[0], 10) : 13;
    const periodName = startHour < 18 ? 'tarde' : 'noite';

    const conflicts = [];

    // Checa dia da semana
    if (Array.isArray(pessoa.dias_disponiveis) && pessoa.dias_disponiveis.length > 0) {
      const diasNum = pessoa.dias_disponiveis.map(Number);
      if (!diasNum.includes(dow)) {
        const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        conflicts.push(`O paciente não marcou ${DAY_NAMES[dow]} como dia disponível.`);
      }
    }

    // Checa período
    if (Array.isArray(pessoa.periodos_disponiveis) && pessoa.periodos_disponiveis.length > 0) {
      if (!pessoa.periodos_disponiveis.includes(periodName)) {
        conflicts.push(`O paciente não marcou o período da ${periodName} como disponível.`);
      }
    }

    // Checa datas indisponíveis
    if (Array.isArray(pessoa.datas_indisponiveis) && pessoa.datas_indisponiveis.includes(eventDate)) {
      conflicts.push(`A data ${eventDate.split('-').reverse().join('/')} foi cadastrada como indisponível pelo paciente.`);
    }

    if (conflicts.length > 0) {
      setAvailabilityWarning(conflicts.join(' '));
    } else {
      setAvailabilityWarning('');
    }
  };

  if (!isOpen || !programacaoItem) return null;

  const pessoa = programacaoItem.atendimento_pessoas;

  const handleReagendarSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAtividade || !eventDate) {
      setErrorMsg('Selecione a nova sessão e a data desejada.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const atividade = atividades.find(a => a.id === selectedAtividade);

      await atendimentoService.reagendarAtendimento({
        pessoaId: pessoa.id,
        oldProgramacaoId: programacaoItem.id,
        atividadeId: selectedAtividade,
        eventDate,
        startTime: atividade?.start_time || '13:30:00',
        endTime: atividade?.end_time || '16:30:00',
        observacoes,
        forceOverCapacity,
      });

      onRescheduled(`Atendimento de ${pessoa?.nome} reagendado com sucesso para ${eventDate.split('-').reverse().join('/')}!`);
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
            <div className="w-10 h-10 bg-primary/5 text-primary rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">update</span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-primary">
                Reagendar Atendimento
              </h3>
              <p className="text-xs text-gray-400">
                Altere a data ou a sessão programada para este paciente.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Resumo do Paciente */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/60 text-xs space-y-1">
          <div className="font-bold text-primary text-sm">{pessoa?.nome || 'Paciente'}</div>
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
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Nova Data do Atendimento *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Nova Sessão / Trabalho *
            </label>
            <select
              value={selectedAtividade}
              onChange={e => setSelectedAtividade(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary"
            >
              {atividades.map(atv => (
                <option key={atv.id} value={atv.id}>
                  {atv.name} ({atv.start_time ? atv.start_time.slice(0, 5) : ''})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Motivo do Reagendamento / Observações
            </label>
            <textarea
              rows="2"
              placeholder="Ex: Solicitado pelo paciente devido a imprevisto"
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
              disabled={loading}
              className="flex-1 py-3 bg-primary text-white font-bold rounded-xl text-xs shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
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
