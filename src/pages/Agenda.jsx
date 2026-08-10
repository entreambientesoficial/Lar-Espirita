import React, { useState, useEffect } from 'react';
import { dataService, supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const Agenda = () => {
  const { profile } = useAuth();
  const [activities, setActivities]     = useState([]);
  const [selectedDay, setSelectedDay]   = useState(new Date().getDay() || 1);
  const [loading, setLoading]           = useState(true);
  // { [atividade_id]: presenca_id } — confirmações do usuário para o dia selecionado
  const [confirmacoes, setConfirmacoes] = useState({});
  const [confirming, setConfirming]     = useState(null); // id da atividade em processamento

  const days = [
    { id: 1, label: 'Segunda', short: 'Seg' },
    { id: 2, label: 'Terça',   short: 'Ter' },
    { id: 3, label: 'Quarta',  short: 'Qua' },
    { id: 4, label: 'Quinta',  short: 'Qui' },
    { id: 5, label: 'Sexta',   short: 'Sex' },
    { id: 6, label: 'Sábado',  short: 'Sáb' },
    { id: 0, label: 'Domingo', short: 'Dom' },
  ];

  // Carrega todas as atividades ativas da semana
  useEffect(() => {
    dataService.getAgenda().then(data => {
      setActivities(data);
      setLoading(false);
    });
  }, []);

  const getDayDate = (dayIndex) => {
    const today = new Date();
    const currentDay = today.getDay() === 0 ? 7 : today.getDay();
    const targetDay = dayIndex === 0 ? 7 : dayIndex;
    const diff = targetDay - currentDay;
    const target = new Date(today);
    target.setDate(today.getDate() + diff);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    return {
      day:   target.getDate(),
      month: target.toLocaleDateString('pt-BR', { month: 'long' }),
      fullDateStr: `${year}-${month}-${day}`
    };
  };

  const selectedDayInfo = getDayDate(selectedDay);

  // Carrega as confirmações do usuário para a data selecionada
  useEffect(() => {
    if (!profile || !selectedDayInfo?.fullDateStr) return;
    const dateStr = selectedDayInfo.fullDateStr; // "YYYY-MM-DD"
    const startOfDay = `${dateStr}T00:00:00`;
    const endOfDay   = `${dateStr}T23:59:59`;

    supabase
      .from('presencas')
      .select('id, atividade_id')
      .eq('user_id', profile.id)
      .gte('checkin_time', startOfDay)
      .lte('checkin_time', endOfDay)
      .then(({ data, error }) => {
        if (!error && data) {
          const map = {};
          data.forEach(p => { map[p.atividade_id] = p.id; });
          setConfirmacoes(map);
        } else {
          setConfirmacoes({});
        }
      });
  }, [profile, selectedDayInfo.fullDateStr]);

  const handleConfirmar = async (item) => {
    if (!profile || confirming) return;
    setConfirming(item.id);

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = selectedDayInfo.fullDateStr === todayStr;
    const timeToInsert = isToday 
      ? new Date().toISOString() 
      : `${selectedDayInfo.fullDateStr}T${item.start_time || '12:00:00'}`;

    const { data, error } = await supabase
      .from('presencas')
      .insert([
        { 
          user_id: profile.id, 
          atividade_id: item.id, 
          checkin_time: timeToInsert,
          qr_checkin: false 
        }
      ])
      .select('id')
      .single();

    if (!error && data) {
      setConfirmacoes(prev => ({ ...prev, [item.id]: data.id }));
    } else if (error) {
      console.error("Erro ao confirmar presença:", error);
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

  const filteredActivities = activities.filter(item => {
    if (item.active === false) return false;
    if (item.event_date) {
      return item.event_date === selectedDayInfo.fullDateStr;
    }
    return item.day_of_week === selectedDay && !item.event_date;
  });

  const formatTime = (item) => {
    if (item.start_time && item.end_time) {
      return `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}`;
    }
    return item.time_range ? item.time_range.replace(/\s+às\s+/g, ' - ').replace(/\s+–\s+/g, ' - ') : '';
  };

  return (
    <main className="max-w-md mx-auto px-6 py-8 space-y-8 font-body">
      {/* Header */}
      <section className="space-y-2 animate-in fade-in duration-700">
        <h2 className="text-3xl font-extrabold text-teal-900 font-headline tracking-tight flex items-center gap-2.5">
          <span className="material-symbols-outlined text-teal-700 text-3xl">calendar_month</span>
          Agenda Semanal
        </h2>
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
                isActive ? 'bg-teal-700 text-white shadow-lg shadow-teal-700/20' : 'text-on-surface-variant hover:bg-gray-50'
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
              const todayStr = new Date().toISOString().split('T')[0];
              const isPast = selectedDayInfo.fullDateStr < todayStr;

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
                      <span className="text-sm font-black text-secondary">{formatTime(item)}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                      {item.description}
                    </p>

                    {/* Botões de confirmação para hoje e dias futuros */}
                    {!isPast ? (
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
                              Cancelar Presença
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleConfirmar(item)}
                            disabled={!!confirming}
                            className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline disabled:opacity-40 transition-colors flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">add_circle</span>
                            {confirming === item.id ? 'Confirmando...' : 'Confirmar Presença'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="pt-3">
                        <span className="text-[10px] font-medium text-gray-300 uppercase tracking-widest">
                          Confirmação encerrada
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
