import React, { useState, useEffect } from 'react';
import { dataService } from '../lib/supabase';

const Agenda = () => {
  const [activities, setActivities] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() || 1); // Padrão: Hoje ou Segunda
  const [loading, setLoading] = useState(true);

  // Mapeamento de nomes de dias
  const days = [
    { id: 1, label: 'Segunda', short: 'Seg' },
    { id: 2, label: 'Terça', short: 'Ter' },
    { id: 3, label: 'Quarta', short: 'Qua' },
    { id: 4, label: 'Quinta', short: 'Qui' },
    { id: 5, label: 'Sexta', short: 'Sex' },
    { id: 6, label: 'Sábado', short: 'Sáb' },
  ];

  useEffect(() => {
    const fetchAgenda = async () => {
      const data = await dataService.getAgenda();
      setActivities(data);
      setLoading(false);
    };
    fetchAgenda();
  }, []);

  const getDayDate = (dayIndex) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0-6
    const diff = dayIndex - currentDay;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);
    
    return {
      day: targetDate.getDate(),
      month: targetDate.toLocaleDateString('pt-BR', { month: 'long' })
    };
  };

  const filteredActivities = activities.filter(item => item.day_of_week === selectedDay);
  const selectedDayInfo = getDayDate(selectedDay);

  return (
    <main className="max-w-md mx-auto px-6 py-8 space-y-8 font-body">
      {/* Header Section */}
      <section className="space-y-2 animate-in fade-in duration-700">
        <h2 className="text-3xl font-extrabold text-primary font-headline tracking-tight">Agenda Semanal</h2>
        <p className="text-on-surface-variant font-medium text-xs uppercase tracking-[0.2em]">{selectedDayInfo.month} de 2026</p>
      </section>

      {/* Horizontal Day Selector */}
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

      {/* Agenda List */}
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
            {filteredActivities.map((item, index) => (
              <div 
                key={index} 
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-start gap-4 transition-all hover:border-primary/20 animate-in slide-in-from-bottom-4 duration-500"
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
                  <div className="pt-3 flex gap-2">
                     <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Confirmar Presença</button>
                  </div>
                </div>
              </div>
            ))}
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
