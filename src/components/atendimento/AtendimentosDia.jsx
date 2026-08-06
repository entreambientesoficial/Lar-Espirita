import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';
import { useAuth } from '../../context/AuthContext';

const AtendimentosDia = ({ onShowToast }) => {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [programacoes, setProgramacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modais de Retorno / Reagendamento
  const [retornarPerson, setRetornarPerson] = useState(null);
  const [retornarPos, setRetornarPos] = useState(1);
  const [isRetornarOpen, setIsRetornarOpen] = useState(false);

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
        adminId: profile.id,
        ...extraData,
      });

      const labelMap = {
        compareceu: 'Chegada/Comparecimento registrado!',
        atendido: 'Atendimento finalizado com sucesso!',
        nao_compareceu: 'Falta registrada no histórico.',
        cancelado: 'Agendamento cancelado.',
        retornar_fila: 'Paciente retornado à fila de espera.',
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
            <span className="material-symbols-outlined text-primary">today</span>
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
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Lista de Atendimentos Agrupados */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 italic">Carregando atendimentos da data...</div>
      ) : Object.keys(grouped).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([sessaoNome, list]) => (
            <div key={sessaoNome} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">self_improvement</span>
                  <h4 className="font-headline font-bold text-lg text-primary">{sessaoNome}</h4>
                </div>
                <span className="text-xs font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full">
                  {list.length} pessoas agendadas
                </span>
              </div>

              <div className="divide-y divide-gray-50">
                {list.map((prog) => {
                  const person = prog.atendimento_pessoas;
                  const isUrgente = prog.prioridade === 'Urgente';

                  return (
                    <div key={prog.id} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-primary/5 text-primary rounded-2xl flex items-center justify-center font-bold text-sm shrink-0">
                          #{prog.ordem_sessao}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-bold text-primary text-base">{person?.nome || 'Paciente sem nome'}</h5>
                            {isUrgente && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-md uppercase">
                                Urgente
                              </span>
                            )}
                          </div>

                          {person?.telefone && (
                            <p className="text-xs text-gray-400 font-mono flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">phone</span>
                              {person.telefone}
                            </p>
                          )}

                          {prog.observacoes && (
                            <p className="text-xs text-gray-500 italic">Obs: {prog.observacoes}</p>
                          )}
                        </div>
                      </div>

                      {/* Botões de Ação Operational */}
                      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                        {prog.status === 'programado' && (
                          <button
                            onClick={() => handleUpdateStatus(prog.id, 'compareceu')}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-blue-700 transition-all"
                          >
                            Compareceu
                          </button>
                        )}

                        {(prog.status === 'programado' || prog.status === 'compareceu') && (
                          <button
                            onClick={() => handleUpdateStatus(prog.id, 'atendido')}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition-all"
                          >
                            Atendimento Realizado
                          </button>
                        )}

                        {prog.status === 'programado' && (
                          <button
                            onClick={() => handleUpdateStatus(prog.id, 'nao_compareceu')}
                            className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-amber-600 transition-all"
                          >
                            Não Compareceu
                          </button>
                        )}

                        {prog.status !== 'atendido' && (
                          <button
                            onClick={() => {
                              setRetornarPerson(prog);
                              setIsRetornarOpen(true);
                            }}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition-all"
                          >
                            Retornar à Fila
                          </button>
                        )}

                        <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase ml-2 ${
                          prog.status === 'atendido' ? 'bg-emerald-100 text-emerald-800' :
                          prog.status === 'compareceu' ? 'bg-blue-100 text-blue-800' :
                          prog.status === 'nao_compareceu' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {prog.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-3xl p-12 text-center text-gray-400 italic border border-dashed border-gray-200">
          Nenhum atendimento programado para esta data ({selectedDate.split('-').reverse().join('/')}).
        </div>
      )}

      {/* Modal Retornar à Fila */}
      {isRetornarOpen && retornarPerson && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full space-y-5 border border-gray-100 shadow-2xl animate-in zoom-in-95 duration-200">
            <h4 className="font-headline font-bold text-base text-primary">Retornar à Fila de Espera</h4>
            <p className="text-xs text-gray-500 font-medium">
              Defina a posição em que <strong>{retornarPerson.atendimento_pessoas?.nome}</strong> deve ser reinserido na fila de espera:
            </p>

            <form onSubmit={handleConfirmRetornarFila} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-primary/70 block mb-1">
                  Posição na Fila
                </label>
                <input
                  type="number"
                  min="1"
                  value={retornarPos}
                  onChange={e => setRetornarPos(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-primary text-center outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRetornarOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-primary text-white font-bold rounded-xl text-xs shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95"
                >
                  Confirmar Retorno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtendimentosDia;
