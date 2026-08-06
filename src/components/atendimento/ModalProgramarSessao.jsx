import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';
import { useAuth } from '../../context/AuthContext';

const ModalProgramarSessao = ({ isOpen, onClose, person, onProgrammed, onRequestUrgentBump }) => {
  const { profile } = useAuth();
  const [capacidades, setCapacidades] = useState([]);
  const [programacoes, setProgramacoes] = useState([]);
  const [selectedAtividade, setSelectedAtividade] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
      const defaultDate = getNextServiceDate();
      setEventDate(defaultDate);
      setSelectedAtividade('');
      setObservacoes('');
      setErrorMsg('');
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const caps = await atendimentoService.getCapacidades();
      setCapacidades(caps || []);
      const progs = await atendimentoService.getAllProgramacoes();
      setProgramacoes(progs || []);
    } catch (err) {
      console.error('Erro ao carregar sessões e agendamentos:', err);
    }
  };

  const getNextServiceDate = () => {
    const d = new Date();
    // Procura próxima terça (2), quarta (3) ou quinta (4)
    while (![2, 3, 4].includes(d.getDay())) {
      d.setDate(d.getDate() + 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * Filtra as sessões válidas para a data selecionada usando data local e calcula vagas restantes
   */
  const getSessoesDisponiveisParaData = (dataStr) => {
    if (!dataStr) return [];
    const parts = dataStr.split('-');
    if (parts.length !== 3) return [];

    const [year, month, day] = parts.map(Number);
    // Cria objeto Date em fuso horário local (evita deslocamento UTC)
    const localDate = new Date(year, month - 1, day);
    const targetDow = localDate.getDay(); // 0 = Dom, 1 = Seg, 2 = Ter, 3 = Qua...

    const filtered = capacidades.filter(a => {
      if (a.active === false) return false;

      // 1. Atividade regular: event_date IS NULL e day_of_week igual ao dia da semana da data
      if (a.event_date === null || a.event_date === undefined) {
        return Number(a.day_of_week) === targetDow;
      }

      // 2. Atendimento extra: event_date exatamente igual à data selecionada
      return a.event_date === dataStr;
    });

    // Calcula vagas reais restantes (capacidade configurada - programações ativas na data)
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

    // Ordenar por start_time crescente
    withVagas.sort((a, b) => (a.start_time || '00:00').localeCompare(b.start_time || '00:00'));
    return withVagas;
  };

  if (!isOpen || !person) return null;

  const sessoesDisponiveis = getSessoesDisponiveisParaData(eventDate);
  const selectedActivityObj = sessoesDisponiveis.find(a => a.id === selectedAtividade);

  const handleProgramar = async (e) => {
    e.preventDefault();
    if (!eventDate || !selectedAtividade) {
      setErrorMsg('Selecione a data e a sessão de atendimento.');
      return;
    }

    const atividade = sessoesDisponiveis.find(a => a.id === selectedAtividade);
    if (!atividade) {
      setErrorMsg('A sessão selecionada não é válida para a data informada. Por favor, selecione uma opção da lista.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const result = await atendimentoService.programarAtendimento({
        pessoaId: person.id,
        atividadeId: selectedAtividade,
        eventDate,
        startTime: atividade.start_time || '13:30:00',
        endTime: atividade.end_time || '16:30:00',
        observacoes,
      });

      if (result.overCapacity) {
        setLoading(false);
        // Chama callback para abrir confirmação de desencaixe/urgência
        onRequestUrgentBump({
          person,
          atividade,
          eventDate,
          capacity: result.capacity,
          lastNormalPerson: result.lastNormalPerson,
        });
        onClose();
        return;
      }

      onProgrammed(`Atendimento programado com sucesso para ${eventDate.split('-').reverse().join('/')}!`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao programar atendimento.');
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
              <span className="material-symbols-outlined text-xl">event_available</span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-primary">Programar Atendimento</h3>
              <p className="text-xs text-gray-400">Selecione a data e o trabalho para {person.nome}.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleProgramar} className="space-y-4">
          {/* Campo 1: Data do Atendimento */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Data do Atendimento *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={e => {
                setEventDate(e.target.value);
                setSelectedAtividade(''); // Limpa imediatamente a sessão ao alterar a data
              }}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary"
            />
          </div>

          {/* Campo 2: Atendimento / Sessão */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Atendimento / Sessão *
            </label>
            <select
              value={selectedAtividade}
              onChange={e => setSelectedAtividade(e.target.value)}
              disabled={!eventDate}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">
                {!eventDate ? 'Selecione primeiro a data...' : 'Selecione uma sessão...'}
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
            <div className="bg-primary/5 p-3 rounded-2xl text-xs text-primary font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">info</span>
                <span>
                  Capacidade configurada: <strong>{selectedActivityObj.capMax} vagas</strong>
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                selectedActivityObj.vagasRestantes > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {selectedActivityObj.vagasRestantes} {selectedActivityObj.vagasRestantes === 1 ? 'vaga disponível' : 'vagas disponíveis'}
              </span>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Observações do Agendamento (Opcional)
            </label>
            <textarea
              rows="2"
              placeholder="Anotações para o dia do atendimento..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-xs text-gray-700"
            />
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
              disabled={loading || !eventDate || !selectedAtividade}
              className="flex-1 py-3 bg-primary text-white font-bold rounded-xl text-xs shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Programando...' : 'Confirmar Programação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalProgramarSessao;
