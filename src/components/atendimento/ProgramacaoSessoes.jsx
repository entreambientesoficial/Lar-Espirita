import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';
import { useAuth } from '../../context/AuthContext';
import ModalReagendarAtendimento from './ModalReagendarAtendimento';

const ProgramacaoSessoes = ({ onShowToast }) => {
  const { profile } = useAuth();
  const [capacidades, setCapacidades] = useState([]);
  const [programacoes, setProgramacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado do Accordion de Configuração de Vagas (Fechado por padrão)
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Estados para edição por sessão: { [atividadeId]: { qSalas: number, aPorSala: number } }
  const [editingCapMap, setEditingCapMap] = useState({});
  const [savingCapId, setSavingCapId] = useState(null);

  // Modal Reagendar
  const [reagendarItem, setReagendarItem] = useState(null);
  const [isReagendarOpen, setIsReagendarOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const caps = await atendimentoService.getCapacidades();
      setCapacidades(caps);

      const capMap = {};
      caps.forEach(c => {
        capMap[c.id] = {
          qSalas: c.quantidade_salas !== undefined ? c.quantidade_salas : 3,
          aPorSala: c.atendimentos_por_sala !== undefined ? c.atendimentos_por_sala : 3,
        };
      });
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
    const config = editingCapMap[atividadeId] || { qSalas: 3, aPorSala: 3 };
    const qSalas = parseInt(config.qSalas, 10);
    const aPorSala = parseInt(config.aPorSala, 10);

    if (isNaN(qSalas) || qSalas < 1) {
      onShowToast('Informe uma quantidade de salas válida (mínimo 1).', 'error');
      return;
    }
    if (isNaN(aPorSala) || aPorSala < 1) {
      onShowToast('Informe uma quantidade de atendimentos por sala válida (mínimo 1).', 'error');
      return;
    }

    setSavingCapId(atividadeId);
    try {
      await atendimentoService.updateCapacidade(atividadeId, qSalas, aPorSala);
      onShowToast('Configuração de vagas atualizada com sucesso!', 'success');
      loadData();
    } catch (err) {
      onShowToast('Erro ao atualizar vagas: ' + err.message, 'error');
    } finally {
      setSavingCapId(null);
    }
  };

  const handleRescheduled = (msg) => {
    onShowToast(msg, 'success');
    loadData();
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

  // Cálculos de resumo para a barra do Accordion
  const totalWeeklyCapacity = capacidades.reduce((acc, c) => acc + (c.capacidade || 9), 0);
  const numSessoes = capacidades.length;
  const avgVagasPorSessao = numSessoes > 0 ? Math.round(totalWeeklyCapacity / numSessoes) : 9;

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* 1. SEÇÃO PRINCIPAL: Todos os Atendimentos Programados (Visível no Topo) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h3 className="font-headline font-bold text-xl text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">event</span>
            Todos os Atendimentos Programados
          </h3>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {programacoes.filter(p => p.status === 'programado').length} ativos
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 italic">Carregando agendamentos...</div>
        ) : programacoes.length > 0 ? (
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-left min-w-[750px]">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Pessoa</th>
                  <th className="px-6 py-4">Trabalho / Sala / Sessão</th>
                  <th className="px-6 py-4">Prioridade</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {programacoes.map(p => {
                  const activityName = p.atividades?.name || 'Apometria';
                  // Identificação visual dinâmica da Sala baseada no encaixe por sessão (UI apenas)
                  const roomNum = p.ordem_sessao ? Math.ceil(p.ordem_sessao / 3) : 1;
                  const displaySessao = `${activityName} • Sala ${roomNum}`;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-primary">
                        {p.event_date ? p.event_date.split('-').reverse().join('/') : '-'}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-800">
                        {p.atendimento_pessoas?.nome || 'Pessoa sem nome'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-primary block">{displaySessao}</span>
                        {p.start_time && (
                          <span className="text-xs text-gray-400 font-mono">
                            {p.start_time.slice(0, 5)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                          p.prioridade === 'Urgente'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          {p.prioridade}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          p.status === 'programado' ? 'bg-indigo-50 text-indigo-700' :
                          p.status === 'compareceu' ? 'bg-emerald-50 text-emerald-700' :
                          p.status === 'atendido' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {p.status === 'programado' && (
                          <button
                            onClick={() => {
                              setReagendarItem(p);
                              setIsReagendarOpen(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-all"
                          >
                            Reagendar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center text-gray-400 italic border border-gray-100 shadow-sm">
            Nenhum agendamento programado até o momento.
          </div>
        )}
      </div>

      {/* 2. SEÇÃO SECUNDÁRIA: Configuração de Vagas por Sessão (Accordion Fechado por Padrão) */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          className="w-full p-6 sm:p-8 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/5 text-primary rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">meeting_room</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-headline font-bold text-xl text-primary">Configuração de vagas</h3>
                <span className="px-3 py-1 bg-primary/5 text-primary border border-primary/10 rounded-full font-bold text-xs">
                  {numSessoes} sessões • {avgVagasPorSessao} vagas por sessão • {totalWeeklyCapacity} vagas por semana
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Defina a quantidade de salas e atendimentos por sala para calcular a capacidade máxima de cada trabalho.
              </p>
            </div>
          </div>
          <span className={`material-symbols-outlined text-gray-400 transition-transform duration-200 shrink-0 ${
            isConfigOpen ? 'rotate-180' : ''
          }`}>
            expand_more
          </span>
        </button>

        {isConfigOpen && (
          <div className="p-6 sm:p-8 pt-2 border-t border-gray-100 space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {capacidades.map((item) => {
                const config = editingCapMap[item.id] || { qSalas: 3, aPorSala: 3 };
                const numSalas = parseInt(config.qSalas, 10) || 0;
                const numAtend = parseInt(config.aPorSala, 10) || 0;
                const capCalculada = Math.max(0, numSalas * numAtend);

                return (
                  <div key={item.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-200/70 space-y-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-primary text-base">
                          {item.name} • {numSalas} {numSalas === 1 ? 'Sala' : 'Salas'}
                        </h4>
                        <span className="text-xs text-gray-500 font-medium block mt-0.5">
                          {DAY_NAMES[item.day_of_week]} • {item.start_time ? item.start_time.slice(0, 5) : item.time_range}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400 block">Capacidade</span>
                        <span className="inline-block px-2.5 py-1 bg-primary text-white rounded-xl font-bold text-xs shadow-sm">
                          {capCalculada} vagas
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/60">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                          Salas
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={config.qSalas}
                          onChange={e => setEditingCapMap({
                            ...editingCapMap,
                            [item.id]: { ...config, qSalas: e.target.value }
                          })}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-primary text-center outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                          Atend. / Sala
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={config.aPorSala}
                          onChange={e => setEditingCapMap({
                            ...editingCapMap,
                            [item.id]: { ...config, aPorSala: e.target.value }
                          })}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-primary text-center outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-gray-200/60 text-xs font-semibold text-gray-600">
                      <div className="text-[11px]">
                        Salas: <strong className="text-primary">{numSalas}</strong> | Atend./sala: <strong className="text-primary">{numAtend}</strong>
                      </div>
                      <button
                        onClick={() => handleSaveCapacidade(item.id)}
                        disabled={savingCapId === item.id}
                        className="w-full sm:w-auto px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {savingCapId === item.id ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {capacidades.length === 0 && (
                <div className="col-span-3 text-center py-8 text-gray-400 italic">
                  Nenhuma atividade regular ativa cadastrada na Agenda.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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

export default ProgramacaoSessoes;
