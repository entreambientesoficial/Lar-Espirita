import React, { useState, useEffect } from 'react';
import { dataService, supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const Agenda = () => {
  const { profile } = useAuth();
  const [activities, setActivities]     = useState([]);
  const [selectedDay, setSelectedDay]   = useState(new Date().getDay() || 1);
  const [loading, setLoading]           = useState(true);
  // { [atividade_id]: presenca_id } — confirmações do usuário para hoje
  const [confirmacoes, setConfirmacoes] = useState({});
  const [confirming, setConfirming]     = useState(null); // id da atividade em processamento

  const todayDayOfWeek = new Date().getDay();

  const days = [
    { id: 1, label: 'Segunda', short: 'Seg' },
    { id: 2, label: 'Terça',   short: 'Ter' },
    { id: 3, label: 'Quarta',  short: 'Qua' },
    { id: 4, label: 'Quinta',  short: 'Qui' },
    { id: 5, label: 'Sexta',   short: 'Sex' },
    { id: 6, label: 'Sábado',  short: 'Sáb' },
  ];

  // Carrega todas as atividades da semana
  useEffect(() => {
    dataService.getAgenda().then(data => {
      setActivities(data);
      setLoading(false);
    });
  }, []);

  // Carrega as confirmações do usuário para hoje
  useEffect(() => {
    if (!profile) return;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    supabase
      .from('presencas')
      .select('id, atividade_id')
      .eq('user_id', profile.id)
      .gte('checkin_time', startOfDay)
      .lt('checkin_time', endOfDay)
      .then(({ data }) => {
        if (data) {
          const map = {};
          data.forEach(p => { map[p.atividade_id] = p.id; });
          setConfirmacoes(map);
        }
      });
  }, [profile]);

  const handleConfirmar = async (atividadeId) => {
    if (!profile || confirming) return;
    setConfirming(atividadeId);
    const { data, error } = await supabase
      .from('presencas')
      .insert([{ user_id: profile.id, atividade_id: atividadeId }])
      .select('id')
      .single();
    if (!error && data) {
      setConfirmacoes(prev => ({ ...prev, [atividadeId]: data.id }));
    }
    setConfirming(null);
  };

  const handleCancelar = async (atividadeId) => {
    const presencaId = confirmacoes[atividadeId];
    if (!presencaId) return;
    const { error } = await supabase.from('presencas').delete().eq('id', presencaId);
    if (!error) {
      setConfirmacoes(prev => {
        const next = { ...prev };
        delete next[atividadeId];
        return next;
      });
    }
  };

  const getDayDate = (dayIndex) => {
    const today = new Date();
    const diff = dayIndex - today.getDay();
    const target = new Date(today);
    target.setDate(today.getDate() + diff);
    return {
      day:   target.getDate(),
      month: target.toLocaleDateString('pt-BR', { month: 'long' }),
    };
  };

  const filteredActivities = activities.filter(item => item.day_of_week === selectedDay);
  const selectedDayInfo    = getDayDate(selectedDay);
  const isToday            = selectedDay === todayDayOfWeek;

  return (
    <main className="max-w-md mx-auto px-6 py-8 space-y-8 font-body">
      {/* Header */}
      <section className="space-y-2 animate-in fade-in duration-700">
        <h2 className="text-3xl font-extrabold text-primary font-headline tracking-tight">Agenda Semanal</h2>
        <p className="text-on-surface-variant font-medium text-xs uppercase tracking-[0.2em]">{selectedDayInfo.month} de 2026</p>
      </section>

      {/* Seletor de dia */}
      <section className="flex justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto no-scrollbar">
        {days.map((day) => {
          const isActive = selectedDay === day.id;
          const date = getDayDate(day.id);
          return (
            <button
              key={day.id}
              onClick={() => setSelectedDay(day.id)}
              className={`flex flex-col items-center min-w-[54px] p-3 rounded-xl transition-all ${
                isActive ? 'bg-primary text-white shadow-lg' : 'text-on-surface-variant hover:bg-gray-50'
              }`}
            >
              <span className="text-[10px] uppercase font-black tracking-widest leading-none mb-1">{day.short}</span>
              <span className="text-lg font-bold font-headline">{date.day}</span>
            </button>
          );
        })}
      </section>

      {/* Lista de atividades */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-[1px] flex-1 bg-gray-100"></div>
          <span className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">
            {days.find(d => d.id === selectedDay)?.label}
          </span>
          <div className="h-[1px] flex-1 bg-gray-100"></div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 italic">Carregando horários...</div>
        ) : filteredActivities.length > 0 ? (
          <div className="space-y-4">
            {filteredActivities.map((item, index) => {
              const isConfirmed = !!confirmacoes[item.id];
              return (
                <div
                  key={item.id || index}
                  className={`bg-white rounded-2xl p-6 border shadow-sm flex items-start gap-4 transition-all animate-in slide-in-from-bottom-4 duration-500 ${
                    isConfirmed ? 'border-secondary/30 bg-secondary/5' : 'border-gray-100 hover:border-primary/20'
                  }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center text-primary shrink-0 relative overflow-hidden">
                    <span className="material-symbols-outlined text-2xl">{item.icon || 'star'}</span>
                    <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                      <h4 className="text-lg font-bold text-primary font-headline leading-tight">{item.name}</h4>
                      <span className="text-sm font-black text-secondary">{item.time_range}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                      {item.description}
                    </p>

                    {/* Botões de confirmação — apenas para hoje */}
                    {isToday && (
                      <div className="pt-3 flex items-center gap-4">
                        {isConfirmed ? (
                          <>
                            <span className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">check_circle</span>
                              Confirmado
                            </span>
                            <button
                              onClick={() => handleCancelar(item.id)}
                              className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors underline underline-offset-2"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleConfirmar(item.id)}
                            disabled={!!confirming}
                            className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline disabled:opacity-40 transition-colors"
                          >
                            {confirming === item.id ? 'Confirmando...' : 'Confirmar Presença'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Dias futuros — sem ação disponível */}
                    {!isToday && (
                      <div className="pt-3">
                        <span className="text-[10px] font-medium text-gray-300 uppercase tracking-widest">
                          Confirmação disponível no dia
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-12 text-center space-y-2 border-2 border-dashed border-gray-200">
            <span className="material-symbols-outlined text-4xl text-gray-300">calendar_today</span>
            <p className="text-gray-400 text-sm font-medium">Não há atividades programadas para este dia.</p>
          </div>
        )}
      </section>
    </main>
  );
};

export default Agenda;
