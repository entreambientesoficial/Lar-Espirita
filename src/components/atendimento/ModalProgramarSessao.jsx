import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';
import { useAuth } from '../../context/AuthContext';

const ModalProgramarSessao = ({ isOpen, onClose, person, onProgrammed, onRequestUrgentBump }) => {
  const { profile } = useAuth();
  const [capacidades, setCapacidades] = useState([]);
  const [selectedAtividade, setSelectedAtividade] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAtividades();
      // Sugere a próxima terça, quarta ou quinta feira
      const defaultDate = getNextServiceDate();
      setEventDate(defaultDate);
      setObservacoes('');
      setErrorMsg('');
    }
  }, [isOpen]);

  const loadAtividades = async () => {
    try {
      const list = await atendimentoService.getCapacidades();
      setCapacidades(list);
      if (list && list.length > 0) {
        setSelectedAtividade(list[0].id);
      }
    } catch (err) {
      console.error(err);
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

  if (!isOpen || !person) return null;

  const handleProgramar = async (e) => {
    e.preventDefault();
    if (!selectedAtividade || !eventDate) {
      setErrorMsg('Selecione o atendimento e a data desejada.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const atividade = capacidades.find(a => a.id === selectedAtividade);
      const result = await atendimentoService.programarAtendimento({
        pessoaId: person.id,
        atividadeId: selectedAtividade,
        eventDate,
        startTime: atividade?.start_time || '13:30:00',
        endTime: atividade?.end_time || '16:30:00',
        adminId: profile.id,
        observacoes,
      });

      if (result.overCapacity) {
        setLoading(false);
        // Chama o callback para abrir o modal de confirmação de urgência
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

      onProgrammed(`Atendimento programado com sucesso para ${eventDate}!`);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao programar atendimento.');
    } finally {
      setLoading(false);
    }
  };

  const selectedActivityObj = capacidades.find(a => a.id === selectedAtividade);

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
              <p className="text-xs text-gray-400">Selecione o trabalho e a data para {person.nome}.</p>
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
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Atendimento / Sessão *
            </label>
            <select
              value={selectedAtividade}
              onChange={e => setSelectedAtividade(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary"
            >
              {capacidades.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.start_time ? item.start_time.slice(0, 5) : item.time_range}) - Vagas: {item.capacidade}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
              Data do Atendimento *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-primary"
            />
          </div>

          {selectedActivityObj && (
            <div className="bg-primary/5 p-3 rounded-2xl text-xs text-primary font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">info</span>
              <span>
                Capacidade configurada: <strong>{selectedActivityObj.capacidade} vagas</strong> nesta sessão.
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
              disabled={loading}
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
