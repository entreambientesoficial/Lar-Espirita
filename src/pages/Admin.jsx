import React, { useState, useEffect } from 'react';
import { supabase, dataService } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const Admin = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('presenca'); 
  const [presences, setPresences] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para novo pré-cadastro
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => {
    fetchInitialData();
    const channel = supabase
      .channel('admin-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'presencas' }, () => fetchInitialData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchInitialData = async () => {
    // 1. Buscar Presenças
    const { data: presenceData } = await supabase
      .from('presencas')
      .select(`id, checkin_time, profiles ( name ), atividades ( name )`)
      .order('id', { ascending: false });

    if (presenceData) {
      const formatted = presenceData.map(p => ({
        time: new Date(p.checkin_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        name: p.profiles?.name || 'Anônimo',
        activity: p.atividades?.name || 'Desconhecida',
        status: 'Presente'
      })).sort((a, b) => a.name.localeCompare(b.name));
      setPresences(formatted);
    }

    // 2. Buscar Usuários Reais e Pré-cadastros
    const { data: userData } = await supabase.from('profiles').select('*').order('name', { ascending: true });
    if (userData) setUsers(userData);
    
    setLoading(false);
  };

  const handleRegisterMedium = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('pre_cadastros')
      .insert([{ name: newName, email: newEmail, role: 'volunteer' }]);

    if (!error) {
      const msg = `Olá ${newName.split(' ')[0]}! Seu acesso ao Portal do Voluntário da Casa Espírita foi liberado. ✨\n\nLink: ${window.location.origin}\nE-mail: ${newEmail}\n\nVocê pode entrar com sua conta Google ou criar uma senha no primeiro acesso!`;
      setInviteMsg(msg);
      setNewName('');
      setNewEmail('');
      fetchInitialData();
    } else {
      alert("Erro ao cadastrar: " + error.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("Convite copiado!");
    setInviteMsg('');
  };

  const toggleAdmin = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'volunteer' : 'admin';
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    fetchInitialData();
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 pb-32 font-body">
      {/* Header */}
      <section className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8 animate-in fade-in duration-700">
        <div className="space-y-2">
          <h2 className="font-headline font-extrabold text-primary tracking-tight text-4xl">Gestão da Casa</h2>
          <p className="text-on-surface-variant font-medium">Controle de presenças e voluntariado.</p>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-gray-200 mb-8">
        <button onClick={() => setActiveTab('presenca')} className={`pb-4 px-2 font-bold transition-all relative ${activeTab === 'presenca' ? 'text-primary' : 'text-gray-400'}`}>
          Presenças Hoje {activeTab === 'presenca' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-full"></div>}
        </button>
        <button onClick={() => setActiveTab('usuarios')} className={`pb-4 px-2 font-bold transition-all relative ${activeTab === 'usuarios' ? 'text-primary' : 'text-gray-400'}`}>
          Médiuns & Gestores {activeTab === 'usuarios' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-full"></div>}
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-primary animate-pulse">Carregando...</div>
      ) : activeTab === 'presenca' ? (
        /* Attendance Tab */
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 animate-in fade-in">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-8 py-5">Médium</th>
                <th className="px-8 py-5">Atividade</th>
                <th className="px-8 py-5">Hora</th>
                <th className="px-8 py-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {presences.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/20">
                  <td className="px-8 py-6 font-bold text-primary">{row.name}</td>
                  <td className="px-8 py-6 text-sm text-gray-500">{row.activity}</td>
                  <td className="px-8 py-6 text-sm font-mono">{row.time}</td>
                  <td className="px-8 py-6 text-right">
                    <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full uppercase">Presente</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {presences.length === 0 && <div className="p-20 text-center text-gray-300 italic">Nenhuma presença registrada agora.</div>}
        </div>
      ) : (
        /* Users & Registration Tab */
        <div className="space-y-8 animate-in fade-in">
          {/* Registration Form */}
          <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10">
            <h3 className="font-headline font-bold text-xl text-primary mb-6">Cadastrar Novo Médium</h3>
            <form onSubmit={handleRegisterMedium} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input 
                type="text" placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} required
                className="px-4 py-3 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <input 
                type="email" placeholder="E-mail Pessoal" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                className="px-4 py-3 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <button type="submit" className="bg-primary text-white font-bold rounded-xl hover:brightness-110 transition-all">
                Autorizar Acesso
              </button>
            </form>

            {inviteMsg && (
              <div className="mt-6 p-6 bg-white rounded-2xl border-2 border-dashed border-primary/20 space-y-4">
                <p className="text-xs font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">check_circle</span> Convite Gerado:
                </p>
                <div className="bg-gray-50 p-4 rounded-xl text-xs font-mono text-gray-600 whitespace-pre-wrap">{inviteMsg}</div>
                <button 
                  onClick={() => copyToClipboard(inviteMsg)}
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                >
                   <span className="material-symbols-outlined text-sm">content_copy</span> Copiar Convite para WhatsApp
                </button>
              </div>
            )}
          </div>

          /* Users Table */
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="px-8 py-5">Nome</th>
                  <th className="px-8 py-5">E-mail</th>
                  <th className="px-8 py-5">Papel/Cargo</th>
                  <th className="px-8 py-5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u, i) => (
                  <tr key={i} className="hover:bg-gray-50/20">
                    <td className="px-8 py-6 font-bold text-primary">{u.name}</td>
                    <td className="px-8 py-6 text-sm text-gray-500">{u.email}</td>
                    <td className="px-8 py-6 uppercase text-[10px] font-black tracking-widest text-primary/60">{u.role}</td>
                    <td className="px-8 py-6 text-right">
                      {u.id !== profile?.id && (
                        <button onClick={() => toggleAdmin(u.id, u.role)} className="text-xs font-bold text-primary hover:underline">
                          {u.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
};

export default Admin;
