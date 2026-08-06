import React, { useState, useEffect } from 'react';
import { atendimentoService } from '../../lib/atendimentoService';

const FilaDashboardHeader = () => {
  const [stats, setStats] = useState({
    naFila: 0,
    programados: 0,
    hoje: 0,
    urgentes: 0,
    totalVagas: 54,
    ocupacaoRate: 0,
    lastUpdate: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
    const interval = setInterval(loadDashboardStats, 30000); // Atualização periódica a cada 30s
    return () => clearInterval(interval);
  }, []);

  const loadDashboardStats = async () => {
    try {
      const fila = await atendimentoService.getFilaEspera();
      const progs = await atendimentoService.getAllProgramacoes();

      const todayStr = new Date().toISOString().split('T')[0];

      const naFila = (fila || []).filter(p => p.status === 'aguardando').length;
      const urgentes = (fila || []).filter(p => p.status === 'aguardando' && p.prioridade === 'Urgente').length;
      const programados = (progs || []).filter(p => p.status === 'programado').length;
      const hoje = (progs || []).filter(p => p.event_date === todayStr && ['programado', 'compareceu', 'atendido'].includes(p.status)).length;

      const totalVagas = 54;
      const ocupacaoRate = Math.round((programados / totalVagas) * 100);

      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setStats({
        naFila,
        programados,
        hoje,
        urgentes,
        totalVagas,
        ocupacaoRate,
        lastUpdate: now,
      });
    } catch (err) {
      console.error('Erro ao carregar estatísticas do dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Barra superior de Métricas Secundárias */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-gray-500 bg-white px-5 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-primary">
            <span className="material-symbols-outlined text-sm">update</span>
            Última atualização: <strong className="font-mono text-gray-800">{stats.lastUpdate || '--:--:--'}</strong>
          </span>
          <span className="hidden sm:inline text-gray-300">|</span>
          <span className="hidden sm:flex items-center gap-1 text-gray-600">
            Total da semana: <strong className="text-primary">{stats.totalVagas} vagas</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span>Taxa de ocupação:</span>
          <span className="px-2.5 py-0.5 bg-primary/10 text-primary font-bold rounded-full text-[11px]">
            {stats.ocupacaoRate}%
          </span>
        </div>
      </div>

      {/* Grid com os 4 Cards de Indicadores Rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Pessoas na fila */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Pessoas na fila</span>
            <span className="material-symbols-outlined text-xl text-primary/70">hourglass_top</span>
          </div>
          <div className="text-2xl font-black text-primary font-headline">
            {loading ? '...' : stats.naFila}
          </div>
        </div>

        {/* Card 2: Atendimentos programados */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Programados</span>
            <span className="material-symbols-outlined text-xl text-amber-600/70">calendar_month</span>
          </div>
          <div className="text-2xl font-black text-gray-800 font-headline">
            {loading ? '...' : stats.programados}
          </div>
        </div>

        {/* Card 3: Atendimentos de hoje */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Atendimentos hoje</span>
            <span className="material-symbols-outlined text-xl text-green-600/70">check_circle</span>
          </div>
          <div className="text-2xl font-black text-gray-800 font-headline">
            {loading ? '...' : stats.hoje}
          </div>
        </div>

        {/* Card 4: Urgências pendentes */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-amber-600">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">Urgências</span>
            <span className="material-symbols-outlined text-xl text-amber-600">warning</span>
          </div>
          <div className="text-2xl font-black text-amber-900 font-headline">
            {loading ? '...' : stats.urgentes}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilaDashboardHeader;
