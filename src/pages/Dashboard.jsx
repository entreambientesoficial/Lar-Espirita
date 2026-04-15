import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dataService, supabase } from '../lib/supabase';

const formatPhone = (value) => {
  if (!value) return '';
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return `(${numbers}`;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const COURSE_OPTIONS = [
  "Curso Espiritismo - Nivel Iniciante",
  "Curso Espiritismo - Nível Intermediário",
  "Curso Espiritismo - Nível Avançado",
  "Curso Reiki - Nível I",
  "Curso Reiki - Nível II",
  "Curso Apometria",
  "Curso Cura"
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activity, setActivity] = useState(null);  // inclui presenca_id se confirmado
  const [loading, setLoading] = useState(true);

  // Estados do Questionário de Primeiro Acesso
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [reflection, setReflection] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;

      if (!profile.cursos || profile.cursos.trim() === '') {
        setShowQuestionnaire(true);
        setUserPhone(profile.phone || '');
      }

      // getTodayActivity agora retorna null se não houver confirmação na Agenda
      const data = await dataService.getTodayActivity(profile.id);
      setActivity(data);

      const { data: refData } = await supabase.from('reflexao_diaria').select('*').eq('id', 1).single();
      if (refData) setReflection(refData);

      setLoading(false);
    };
    fetchData();
  }, [profile]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    
    // Se não selecionou nada ou marcou que não possui
    const cursosFormatados = selectedCourses.length === 0 || selectedCourses.includes('Não possuo') 
      ? 'Nenhum curso / Não possui' 
      : selectedCourses.join(' • ');

    const { error } = await supabase
      .from('profiles')
      .update({ phone: userPhone, cursos: cursosFormatados })
      .eq('id', profile.id);

    if (!error) {
      // Atualiza o estado local para esconder o formulário e recarrega a pág para atualizar o app inteiro
      window.location.reload();
    } else {
      alert("Erro ao salvar perfil: " + error.message);
      setSavingProfile(false);
    }
  };

  const handleCancelCheckin = async () => {
    if (!activity?.presenca_id) return;
    const { error } = await supabase.from('presencas').delete().eq('id', activity.presenca_id);
    if (!error) setActivity(null);
  };

  if (showQuestionnaire) {
    return (
      <main className="max-w-md mx-auto px-6 py-12 space-y-8 font-body">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary mb-4">
            <span className="material-symbols-outlined text-3xl">school</span>
          </div>
          <h2 className="text-2xl font-extrabold text-primary font-headline tracking-tight">
            Complete seu Perfil
          </h2>
          <p className="text-on-surface-variant font-medium text-sm px-4">
            Para podermos direcionar os voluntários para as áreas corretas, informe seu preparo ou cursos realizados.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-3xl shadow-xl shadow-primary/5 border border-gray-100 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-primary uppercase tracking-wider">Telefone / WhatsApp</label>
            <input 
              type="tel" 
              placeholder="(11) 90000-0000" 
              value={userPhone} 
              onChange={e => setUserPhone(formatPhone(e.target.value))} 
              required
              maxLength={15}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-primary uppercase tracking-wider">Cursos e Formações</label>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-4">
              {COURSE_OPTIONS.map(course => (
                <label key={course} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={selectedCourses.includes(course)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCourses([...selectedCourses.filter(c => c !== 'Não possuo'), course]);
                      } else {
                        setSelectedCourses(selectedCourses.filter(c => c !== course));
                      }
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-primary accent-primary focus:ring-primary/20 transition-all cursor-pointer"
                  />
                  <span className="text-sm text-gray-700 font-medium group-hover:text-primary transition-colors">{course}</span>
                </label>
              ))}

              <hr className="border-gray-200 my-1"/>

              <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={selectedCourses.includes('Não possuo')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCourses(['Não possuo']); // Limpa os outros
                      } else {
                        setSelectedCourses([]);
                      }
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-gray-400 accent-gray-400 focus:ring-gray-200 transition-all cursor-pointer"
                  />
                  <span className="text-sm text-gray-500 italic group-hover:text-gray-700 transition-colors">Não possuo nenhum curso</span>
              </label>
            </div>
            <p className="text-[10px] text-gray-400 font-medium leading-tight mt-2 px-1">
              Marque todas as opções pertinentes ao seu preparo atual.
            </p>
          </div>

          <div className="flex gap-4">
            {profile?.cursos && profile.cursos.trim() !== '' && (
               <button 
                 type="button" 
                 onClick={() => setShowQuestionnaire(false)}
                 className="w-1/3 bg-gray-100 text-gray-500 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-95"
               >
                 Cancelar
               </button>
            )}
            <button 
              type="submit" 
              disabled={savingProfile}
              className="flex-1 bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
            >
              {savingProfile ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </main>
    );
  }

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
        <button 
          onClick={() => {
            setUserPhone(profile?.phone || '');
            const savedCursos = profile?.cursos || '';
            if (savedCursos === 'Nenhum curso / Não possui' || savedCursos === 'Nenhum curso / Não se aplica') {
              setSelectedCourses(['Não possuo']);
            } else {
              setSelectedCourses(savedCursos.split(' • '));
            }
            setShowQuestionnaire(true);
          }}
          className="w-10 h-10 bg-primary/5 border border-primary/10 text-primary rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors shadow-sm"
          title="Editar Perfil"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
        </button>
      </section>

      {/* Main Feature: Today's Assignment */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-black text-primary/40">Seu Trabalho Hoje</h3>
          {!loading && activity && (
            <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full uppercase">
              Confirmado
            </span>
          )}
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
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Presença Confirmada</span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => navigate('/checkin')}
                  className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                >
                  Check-in
                </button>
                {!activity.qr_checkin && (
                  <button
                    onClick={handleCancelCheckin}
                    className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors underline underline-offset-2"
                  >
                    Cancelar Presença
                  </button>
                )}
              </div>
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
      <section className="space-y-4 pt-4 animate-in slide-in-from-bottom-8 duration-1000 delay-300">
        <h3 className="text-2xl font-extrabold text-primary font-headline tracking-tight px-1">Reflexão do Dia</h3>
        
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex flex-col group">
          <div className="overflow-hidden h-48">
            <img
              src={reflection?.image_url || "/img-apoio/caridade.png"}
              alt="Reflexão"
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              onError={(e) => { e.target.onerror = null; e.target.src = '/img-apoio/caridade.png'; }}
            />
          </div>
          <div className="p-8 space-y-4 bg-primary/5">
            <blockquote className="space-y-3">
              <p className="text-primary text-xl font-medium leading-relaxed italic">
                "{reflection?.quote || 'Fora da caridade não há salvação.'}"
              </p>
              <cite className="text-primary/60 text-xs font-black uppercase tracking-widest block not-italic">— {reflection?.author || 'Allan Kardec'}</cite>
            </blockquote>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Dashboard;
