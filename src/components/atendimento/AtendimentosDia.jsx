import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';
import { useAuth } from '../../context/AuthContext';
import ModalReagendarAtendimento from './ModalReagendarAtendimento';

const AtendimentosDia = ({ onShowToast }) => {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [programacoes, setProgramacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Menu de opções [•••]
  const [openMenuId, setOpenMenuId] = useState(null);

  // Modais de Retorno / Reagendamento
  const [retornarPerson, setRetornarPerson] = useState(null);
  const [retornarPos, setRetornarPos] = useState(1);
  const [isRetornarOpen, setIsRetornarOpen] = useState(false);

  const [reagendarItem, setReagendarItem] = useState(null);
  const [isReagendarOpen, setIsReagendarOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await atendimentoService.getProgramacoesDia(selectedDate);
      setProgramacoes(data);
    } catch (err) {
      console.error(err);
      onShowToast('Erro ao carregar atendimentos do dia: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (programacaoId, novoStatus, extraData = {}) => {
    try {
      await atendimentoService.updateStatusProgramacao({
        programacaoId,
        novoStatus,
        ...extraData,
      });

      const labelMap = {
        compareceu: 'Chegada/Comparecimento registrado!',
        atendido: 'Atendimento finalizado com sucesso!',
        nao_compareceu: 'Falta registrada no histórico.',
        cancelado: 'Agendamento cancelado.',
        retornar_fila: 'Pessoa retornada à fila de espera.',
      };

      onShowToast(labelMap[novoStatus] || 'Status atualizado com sucesso!', 'success');
      loadData();
    } catch (err) {
      onShowToast('Erro ao atualizar status: ' + err.message, 'error');
    }
  };

  const handleConfirmRetornarFila = async (e) => {
    e.preventDefault();
    if (!retornarPerson) return;
    const pos = parseInt(retornarPos, 10) || 1;
    await handleUpdateStatus(retornarPerson.id, 'retornar_fila', { posicaoRetorno: pos });
    setIsRetornarOpen(false);
    setRetornarPerson(null);
  };

  const handleRescheduled = (msg) => {
    onShowToast(msg, 'success');
    loadData();
  };

  // Agrupa atendimentos por atividade/horário
  const grouped = programacoes.reduce((acc, prog) => {
    const key = prog.atividades?.name || 'Apometria';
    if (!acc[key]) acc[key] = [];
    acc[key].push(prog);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header & Seletor de Data */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="font-headline font-bold text-xl text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-green-600">check_circle</span>
            Atendimentos do Dia
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Controle operacional de chegada, atendimento e presenças do público.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Data:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400 italic">Carregando atendimentos do dia...</div>
      ) : Object.keys(grouped).length > 0 ? (
        <div className="space-y-6">
          {Object.keys(grouped).map(sessaoKey => (
            <div key={sessaoKey} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h4 className="font-bold text-primary text-base flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-600">groups</span>
                  {sessaoKey}
                </h4>
                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                  {grouped[sessaoKey].length} agendados
                </span>
              </div>

              <div className="divide-y divide-gray-50">
                {grouped[sessaoKey].map((prog) => {
                  const person = prog.atendimento_pessoas;
                  return (
                    <div key={prog.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center ${
                          prog.status === 'atendido' ? 'bg-emerald-100 text-emerald-800' :
                          prog.status === 'compareceu' ? 'bg-green-100 text-green-800' :
                          prog.status === 'nao_compareceu' ? 'bg-red-100 text-red-800' :
                          'bg-indigo-50 text-indigo-700'
                        }`}>
                          {prog.ordem_sessao || '-'}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            {person?.nome || 'Pessoa sem nome'}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              prog.prioridade === 'Urgente'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-sky-50 text-sky-700'
                            }`}>
                              {prog.prioridade}
                            </span>
                          </div>
                          {person?.telefone && (
                            <p className="text-xs text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-xs">phone</span>
                              {person.telefone}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botões de Ação Operational e Menu [•••] */}
                      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                        {/* Status Badge */}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                          prog.status === 'atendido' ? 'bg-emerald-100 text-emerald-900' :
                          prog.status === 'compareceu' ? 'bg-green-100 text-green-800' :
                          prog.status === 'nao_compareceu' ? 'bg-red-100 text-red-800' :
                          'bg-indigo-50 text-indigo-700'
                        }`}>
                          <span className="material-symbols-outlined text-sm">
                            {prog.status === 'atendido' ? 'check_circle' :
                             prog.status === 'compareceu' ? 'check' :
                             prog.status === 'nao_compareceu' ? 'close' : 'event'}
                          </span>
                          {prog.status === 'atendido' ? 'Atendido' :
                           prog.status === 'compareceu' ? 'Compareceu' :
                           prog.status === 'nao_compareceu' ? 'Não compareceu' : 'Programado'}
                        </span>

                        {/* Botão de Ação Primária Principal */}
                        {prog.status === 'programado' && (
                          <button
                            onClick={() => handleUpdateStatus(prog.id, 'compareceu')}
                            className="px-3.5 py-1.5 bg-green-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-green-700 transition-all flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">check</span>
                            Compareceu
                          </button>
                        )}

                        {prog.status === 'compareceu' && (
                          <button
                            onClick={() => handleUpdateStatus(prog.id, 'atendido')}
                            className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition-all flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            Finalizar
                          </button>
                        )}

                        {/* Menu de Opções Secundárias [•••] */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === prog.id ? null : prog.id)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all font-mono font-bold text-xs"
                            title="Mais opções"
                          >
                            •••
                          </button>

                          {openMenuId === prog.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-30 animate-in fade-in zoom-in-95">
                              {prog.status !== 'compareceu' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleUpdateStatus(prog.id, 'compareceu');
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-green-50 hover:text-green-800 rounded-xl flex items-center gap-2 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-sm">check</span>
                                  Marcar Compareceu
                                </button>
                              )}

                              {prog.status !== 'atendido' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleUpdateStatus(prog.id, 'atendido');
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl flex items-center gap-2 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-sm">check_circle</span>
                                  Marcar Atendido
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setReagendarItem(prog);
                                  setIsReagendarOpen(true);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-amber-50 hover:text-amber-900 rounded-xl flex items-center gap-2 transition-colors"
                              >
                                <span className="material-symbols-outlined text-sm">update</span>
                                Reagendar
                              </button>

                              {prog.status !== 'nao_compareceu' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleUpdateStatus(prog.id, 'nao_compareceu');
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-sm">close</span>
                                  Não Compareceu
                                </button>
                              )}

                              {prog.status !== 'atendido' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setRetornarPerson(prog);
                                    setIsRetornarOpen(true);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl flex items-center gap-2 transition-colors border-t border-gray-100 mt-1 pt-2"
                                >
                                  <span className="material-symbols-outlined text-sm">undo</span>
                                  Retornar à Fila
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center text-gray-400 italic border border-gray-100 shadow-sm">
          Nenhum atendimento agendado para a data selecionada.
        </div>
      )}

      {/* Modal Retornar à Fila */}
      {isRetornarOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 border border-gray-100 shadow-2xl">
            <h4 className="font-headline font-bold text-lg text-primary">Retornar à Fila de Espera</h4>
            <p className="text-xs text-gray-500">
              Escolha a posição em que {retornarPerson?.atendimento_pessoas?.nome} ficará na fila de espera.
            </p>
            <form onSubmit={handleConfirmRetornarFila} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  Posição Desejada
                </label>
                <input
                  type="number"
                  min="1"
                  value={retornarPos}
                  onChange={e => setRetornarPos(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-primary outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRetornarOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-primary text-white font-bold rounded-xl text-xs"
                >
                  Confirmar Retorno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reagendar */}
      <ModalReagendarAtendimento
        isOpen={isReagendarOpen}
        onClose={() => setIsReagendarOpen(false)}
        programacaoItem={reagendarItem}
        onRescheduled={handleRescheduled}
      />
    </div>
  );
};

export default AtendimentosDia;
