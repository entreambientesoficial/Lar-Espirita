import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../lib/supabase';

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodayActivity = async () => {
      if (profile) {
        const data = await dataService.getTodayActivity(profile.id);
        setActivity(data);
        setLoading(false);
      }
    };
    fetchTodayActivity();
  }, [profile]);

  return (
    <main className="max-w-md mx-auto px-6 py-8 space-y-10 font-body">
      {/* Header: User Profile Summary */}
      <section className="flex justify-between items-start animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold text-primary font-headline tracking-tight">
            Olá, {profile?.name?.split(' ')[0] || 'Voluntário'}
          </h2>
          <p className="text-on-surface-variant font-medium text-sm">Que a paz esteja com você hoje.</p>
        </div>
      </section>

      {/* Main Feature: Today's Assignment */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-black text-primary/40">Seu Trabalho Hoje</h3>
          <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full uppercase">Confirmado</span>
        </div>
        
        {loading ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm flex items-center justify-center border border-gray-100 italic text-gray-400">
            Buscando escala...
          </div>
        ) : activity ? (
          <div className="group relative bg-white rounded-3xl p-8 space-y-6 shadow-xl shadow-primary/5 border border-gray-100 transition-all hover:scale-[1.01] animate-in zoom-in duration-500">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
              <span className="material-symbols-outlined text-8xl text-primary">{activity.icon || 'star'}</span>
            </div>
            
            <div className="space-y-4">
              <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                <span className="material-symbols-outlined text-3xl">{activity.icon || 'spa'}</span>
              </div>
              <div className="space-y-1">
                <h4 className="text-2xl font-bold text-primary font-headline tracking-tight">{activity.name}</h4>
                <p className="text-on-surface-variant font-medium text-sm leading-relaxed">{activity.description}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
              <div className="flex flex-col">
                <span className="text-primary font-black text-lg tracking-tight">{activity.time_range}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">PRESENÇA CONFIRMADA</span>
              </div>
              <button 
                onClick={() => navigate('/checkin')}
                className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
              >
                Check-in
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-3xl p-12 flex flex-col items-center text-center space-y-4 animate-in fade-in duration-1000">
            <span className="material-symbols-outlined text-4xl text-gray-300">event_busy</span>
            <div>
              <p className="text-gray-500 font-bold text-sm">Sem escala para hoje</p>
              <p className="text-gray-400 text-xs mt-1">Aproveite o dia para reflexão e descanso.</p>
            </div>
          </div>
        )}
      </section>

      {/* Secondary Feature: Reflection Card */}
      <section className="space-y-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-black text-primary/40 px-1">Reflexão do Dia</h3>
        <div className="relative rounded-3xl overflow-hidden aspect-[4/3] shadow-2xl group border border-white/20 animate-in slide-in-from-bottom-8 duration-1000 delay-300">
          <img 
            src="/img-apoio/caridade.png" 
            alt="Reflexão" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent p-8 flex flex-col justify-end">
            <blockquote className="space-y-4">
              <p className="text-white text-xl font-medium leading-relaxed italic">
                "Fora da caridade não há salvação."
              </p>
              <cite className="text-white/60 text-xs font-black uppercase tracking-widest block not-italic">— Allan Kardec</cite>
            </blockquote>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Dashboard;
