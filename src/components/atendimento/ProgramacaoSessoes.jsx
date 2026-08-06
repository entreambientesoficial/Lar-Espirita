import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';
import { useAuth } from '../../context/AuthContext';

const ProgramacaoSessoes = ({ onShowToast }) => {
  const { profile } = useAuth();
  const [capacidades, setCapacidades] = useState([]);
  const [programacoes, setProgramacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para edição rápida de capacidade
  const [editingCapMap, setEditingCapMap] = useState({});
  const [savingCapId, setSavingCapId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const caps = await atendimentoService.getCapacidades();
      setCapacidades(caps);

      const capMap = {};
      caps.forEach(c => { capMap[c.id] = c.capacidade || 6; });
      setEditingCapMap(capMap);

      const progs = await atendimentoService.getAllProgramacoes();
      setProgramacoes(progs);
    } catch (err) {
      console.error(err);
      onShowToast('Erro ao carregar agendamentos: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCapacidade = async (atividadeId) => {
    const val = parseInt(editingCapMap[atividadeId], 10);
    if (isNaN(val) || val < 1) {
      onShowToast('Por favor, informe um número de vagas válido (mínimo 1).', 'error');
      return;
    }

    setSavingCapId(atividadeId);
    try {
      await atendimentoService.updateCapacidade(atividadeId, val, profile.id);
      onShowToast('Capacidade da sessão atualizada com sucesso!', 'success');
      loadData();
    } catch (err) {
      onShowToast('Erro ao atualizar capacidade: ' + err.message, 'error');
    } finally {
      setSavingCapId(null);
    }
  };

  const DAY_NAMES = {
    0: 'Domingo',
    1: 'Segunda-feira',
    2: 'Terça-feira',
    3: 'Quarta-feira',
    4: 'Quinta-feira',
    5: 'Sexta-feira',
    6: 'Sábado',
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Configuração de Capacidades das Sessões */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="font-headline font-bold text-xl text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">settings_suggest</span>
              Configuração de Vagas por Sessão
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Defina a quantidade máxima de pessoas atendidas em cada trabalho regular.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {capacidades.map((item) => (
            <div key={item.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-200/70 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-primary text-base">{item.name}</h4>
                  <span className="text-xs text-gray-500 font-medium">
                    {DAY_NAMES[item.day_of_week]} • {item.start_time ? item.start_time.slice(0, 5) : item.time_range}
                  </span>
                </div>
                <span className="w-8 h-8 bg-primary/5 text-primary rounded-xl flex items-center justify-center font-bold text-sm">
                  {editingCapMap[item.id] || 6}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-200/50">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                    Vagas por sessão
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={editingCapMap[item.id] !== undefined ? editingCapMap[item.id] : 6}
                    onChange={e => setEditingCapMap({ ...editingCapMap, [item.id]: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-primary text-center"
                  />
                </div>
                <button
                  onClick={() => handleSaveCapacidade(item.id)}
                  disabled={savingCapId === item.id}
                  className="mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  {savingCapId === item.id ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ))}

          {capacidades.length === 0 && (
            <div className="col-span-3 text-center py-8 text-gray-400 italic">
              Nenhuma atividade regular ativa cadastrada na Agenda.
            </div>
          )}
        </div>
      </div>

      {/* Lista de Atendimentos Programados */}
      <div className="space-y-4">
        <h3 className="font-headline font-bold text-xl text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">event</span>
          Todos os Atendimentos Programados
        </h3>

        {loading ? (
          <div className="py-12 text-center text-gray-400 italic">Carregando agendamentos...</div>
        ) : programacoes.length > 0 ? (
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Paciente</th>
                  <th className="px-6 py-4">Trabalho / Sessão</th>
                  <th className="px-6 py-4">Prioridade</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {programacoes.map((prog) => (
                  <tr key={prog.id} className="hover:bg-gray-50/30">
                    <td className="px-6 py-4 text-sm font-bold text-secondary">
                      {prog.event_date ? prog.event_date.split('-').reverse().join('/') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-primary text-sm">{prog.atendimento_pessoas?.nome || 'Sem nome'}</div>
                      <div className="text-xs text-gray-400 font-mono">{prog.atendimento_pessoas?.telefone}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                      {prog.atividades?.name || 'Apometria'} ({prog.start_time ? prog.start_time.slice(0, 5) : '13:30'})
                    </td>
                    <td className="px-6 py-4">
                      {prog.prioridade === 'Urgente' ? (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase">
                          Urgente
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] font-black rounded-full uppercase">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[10px] font-black rounded-full uppercase ${
                        prog.status === 'atendido' ? 'bg-emerald-50 text-emerald-700' :
                        prog.status === 'compareceu' ? 'bg-blue-50 text-blue-700' :
                        prog.status === 'nao_compareceu' ? 'bg-amber-50 text-amber-700' :
                        prog.status === 'cancelado' ? 'bg-red-50 text-red-600' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {prog.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-3xl p-12 text-center text-gray-400 italic border border-dashed border-gray-200">
            Nenhum atendimento programado até o momento.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgramacaoSessoes;
