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

  // Estado para menu de opções [•••] por item ID
  const [openMenuId, setOpenMenuId] = useState(null);

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

  /**
   * Mapeamento exclusivamente visual da Sala com base no dia da semana (UI apenas):
   * Terça-feira (2) -> Sala 1
   * Quarta-feira (3) -> Sala 2
   * Quinta-feira (4) -> Sala 3
   */
  const getRoomNum = (dow) => {
    if (dow === 2) return 1;
    if (dow === 3) return 2;
    if (dow === 4) return 3;
    return 1;
  };

  // Cálculos de resumo para a barra do Accordion
  const totalWeeklyCapacity = capacidades.reduce((acc, c) => acc + (c.capacidade || 9), 0);
  const numSessoes = capacidades.length;

  // Filtragem estrita da lista operacional: exibe unicamente status 'programado' e 'compareceu'
  const activeProgramacoes = (programacoes || []).filter(p => ['programado', 'compareceu'].includes(p.status));

  // Agrupamento de Atendimentos Programados por DATA
  const groupedByDate = activeProgramacoes.reduce((acc, p) => {
    const dateKey = p.event_date || 'Sem data';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(p);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* 1. SEÇÃO PRINCIPAL: Todos os Atendimentos Programados (Agrupados por Data) */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h3 className="font-headline font-bold text-xl text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">calendar_month</span>
            Todos os Atendimentos Programados
          </h3>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {activeProgramacoes.length} ativos
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 italic">Carregando agendamentos...</div>
        ) : sortedDates.length > 0 ? (
          <div className="space-y-6">
            {sortedDates.map(dateKey => {
              const dateProgs = groupedByDate[dateKey];
              const parts = dateKey.split('-');
              let dateFormatted = dateKey;
              let dayOfWeekStr = '';

              if (parts.length === 3) {
                const [year, month, day] = parts.map(Number);
                const d = new Date(year, month - 1, day);
                dateFormatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
                dayOfWeekStr = DAY_NAMES[d.getDay()] || '';
              }

              // Agrupa por sessão no dia
              const sessoesNoDia = dateProgs.reduce((acc, p) => {
                const atvId = p.atividade_id || 'default';
                if (!acc[atvId]) {
                  acc[atvId] = {
                    atividade: p.atividades,
                    items: [],
                  };
                }
                acc[atvId].items.push(p);
                return acc;
              }, {});

              return (
                <div key={dateKey} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
                  {/* Cabeçalho da Data */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-3 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold">
                        <span className="material-symbols-outlined text-xl">event</span>
                      </div>
                      <div>
                        <h4 className="font-headline font-extrabold text-lg text-primary">
                          {dateFormatted} <span className="text-gray-400 font-normal text-sm">({dayOfWeekStr})</span>
                        </h4>
                        <span className="text-xs text-gray-500 font-medium">
                          {dateProgs.length} {dateProgs.length === 1 ? 'pessoa agendada' : 'pessoas agendadas'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Agrupamento por Trabalho / Sala na Data */}
                  <div className="space-y-6">
                    {Object.keys(sessoesNoDia).map(atvId => {
                      const sessaoGroup = sessoesNoDia[atvId];
                      const atv = sessaoGroup.atividade || {};
                      const roomNum = getRoomNum(atv.day_of_week);
                      const capMax = capacidades.find(c => c.id === atv.id)?.capacidade || 9;
                      const ocupados = sessaoGroup.items.length;
                      const pctOcupacao = Math.min(100, Math.round((ocupados / capMax) * 100));

                      return (
                        <div key={atvId} className="bg-gray-50/70 p-5 rounded-2xl border border-gray-200/60 space-y-4">
                          {/* Cabeçalho da Sessão com Nome Único, Badge de Sala e Barra de Progresso */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-200/50 pb-3">
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-primary text-base">
                                {atv.name || 'Apometria'}
                              </h5>
                              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300/60 rounded-md font-black text-xs">
                                Sala {roomNum}
                              </span>
                              <span className="text-xs text-gray-500 font-medium ml-1">
                                • {atv.start_time ? atv.start_time.slice(0, 5) : '13:30'}
                              </span>
                            </div>

                            {/* Barra de Progresso Simples de Ocupação */}
                            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-gray-200/80 shadow-2xs">
                              <span className="text-xs font-bold text-gray-700 whitespace-nowrap">
                                {ocupados} de {capMax} vagas
                              </span>
                              <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden shrink-0">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    pctOcupacao >= 100 ? 'bg-amber-600' : 'bg-emerald-600'
                                  }`}
                                  style={{ width: `${pctOcupacao}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>

                          {/* Lista de Pessoas na Sala */}
                          <div className="divide-y divide-gray-200/50">
                            {sessaoGroup.items.map(p => {
                              // Checa se veio de reagendamento
                              const prevCancelled = (programacoes || []).find(oldP =>
                                oldP.pessoa_id === p.pessoa_id &&
                                oldP.status === 'cancelado' &&
                                oldP.id !== p.id
                              );
                              const prevDateFormatted = prevCancelled?.event_date ? prevCancelled.event_date.split('-').reverse().join('/') : null;

                              return (
                                <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                      {p.atendimento_pessoas?.nome || 'Pessoa sem nome'}
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                        p.prioridade === 'Urgente'
                                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                          : 'bg-sky-50 text-sky-700'
                                      }`}>
                                        {p.prioridade}
                                      </span>
                                    </div>

                                    {prevDateFormatted && (
                                      <div className="text-[10px] text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">update</span>
                                        Reagendado de {prevDateFormatted} para {dateFormatted}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                      p.status === 'programado' ? 'bg-indigo-50 text-indigo-700' :
                                      p.status === 'compareceu' ? 'bg-green-100 text-green-800' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {p.status}
                                    </span>

                                    {/* Botão de Ação Secundária Dropdown [•••] */}
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-xl transition-all font-mono font-bold text-xs"
                                        title="Mais opções"
                                      >
                                        •••
                                      </button>

                                      {openMenuId === p.id && (
                                        <div className="absolute right-0 mt-1 w-44 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-30 animate-in fade-in zoom-in-95">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenMenuId(null);
                                              setReagendarItem(p);
                                              setIsReagendarOpen(true);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-amber-50 hover:text-amber-900 rounded-xl flex items-center gap-2 transition-colors"
                                          >
                                            <span className="material-symbols-outlined text-sm">update</span>
                                            Reagendar
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center text-gray-400 italic border border-gray-100 shadow-sm">
            Nenhum agendamento programado até o momento.
          </div>
        )}
      </div>

      {/* 2. SEÇÃO SECUNDÁRIA: Configuração de Vagas por Sessão (Accordion Recolhido por Padrão) */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          className="w-full p-6 sm:p-8 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">settings</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-headline font-bold text-xl text-primary">⚙ Configuração de vagas</h3>
                <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/60 rounded-full font-bold text-xs">
                  {numSessoes} sessões • {totalWeeklyCapacity} vagas semanais
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
                const roomNum = getRoomNum(item.day_of_week);

                return (
                  <div key={item.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-200/70 space-y-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-primary text-base">
                          {item.name}
                        </h4>
                        <span className="inline-block px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300/60 rounded-md font-black text-[11px] my-1">
                          Sala {roomNum}
                        </span>
                        <span className="text-xs text-gray-500 font-medium block">
                          {DAY_NAMES[item.day_of_week]} {item.start_time ? item.start_time.slice(0, 5) : item.time_range}
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
