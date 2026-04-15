import React, { useState, useEffect } from 'react';
import { supabase, dataService } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const formatPhone = (value) => {
  if (!value) return '';
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return `(${numbers}`;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const Admin = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('presenca'); 
  const [presences, setPresences] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para novo pré-cadastro
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');

  // Estados da Reflexão Diária
  const [reflectionQuote, setReflectionQuote] = useState('');
  const [reflectionAuthor, setReflectionAuthor] = useState('');
  const [reflectionImageUrl, setReflectionImageUrl] = useState('');
  const [savingReflection, setSavingReflection] = useState(false);

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
    
    // 3. Buscar Reflexão do Dia
    const { data: reflectionData } = await supabase.from('reflexao_diaria').select('*').eq('id', 1).single();
    if (reflectionData) {
      setReflectionQuote(reflectionData.quote || '');
      setReflectionAuthor(reflectionData.author || '');
      setReflectionImageUrl(reflectionData.image_url || '');
    }

    setLoading(false);
  };

  const handleSaveReflection = async (e) => {
    e.preventDefault();
    setSavingReflection(true);
    const { error } = await supabase
      .from('reflexao_diaria')
      .update({ quote: reflectionQuote, author: reflectionAuthor, image_url: reflectionImageUrl })
      .eq('id', 1);

    setSavingReflection(false);
    if (error) {
      alert("Erro ao salvar reflexão: " + error.message);
    } else {
      alert("Reflexão do Dia atualizada com sucesso (já pode ser vista pelos voluntários)!");
    }
  };

  const handleRegisterMedium = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('pre_cadastros')
      .insert([{ name: newName, email: newEmail, phone: newPhone, role: 'volunteer' }]);

    if (!error) {
      const msg = `Olá ${newName.split(' ')[0]}! Seu acesso ao Portal do Voluntário da Casa Espírita foi liberado. ✨\n\nLink: ${window.location.origin}\nE-mail: ${newEmail}\n\nVocê pode acessar com sua conta Google ou criar uma senha rápida no seu primeiro acesso!`;
      setInviteMsg(msg);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
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
          <h2 className="font-headline font-extrabold text-primary tracking-tight text-4xl">Administração</h2>
          <p className="text-on-surface-variant font-medium">Controle de presenças e voluntariado.</p>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-gray-200 mb-8">
        <button onClick={() => setActiveTab('presenca')} className={`pb-4 px-2 font-bold transition-all relative ${activeTab === 'presenca' ? 'text-primary' : 'text-gray-400'}`}>
          Presenças Hoje {activeTab === 'presenca' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-full"></div>}
        </button>
        <button onClick={() => setActiveTab('usuarios')} className={`pb-4 px-2 font-bold transition-all relative ${activeTab === 'usuarios' ? 'text-primary' : 'text-gray-400'}`}>
          Médiuns e Gestores {activeTab === 'usuarios' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-full"></div>}
        </button>
        <button onClick={() => setActiveTab('reflexao')} className={`pb-4 px-2 font-bold transition-all relative ${activeTab === 'reflexao' ? 'text-primary' : 'text-gray-400'}`}>
          Reflexão do Dia {activeTab === 'reflexao' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-full"></div>}
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-primary animate-pulse">Carregando...</div>
      ) : activeTab === 'presenca' ? (
        /* Attendance Tab */
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 overflow-x-auto animate-in fade-in">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-6 py-5 whitespace-nowrap">Médium</th>
                <th className="px-6 py-5 whitespace-nowrap">Atividade</th>
                <th className="px-6 py-5 whitespace-nowrap">Hora</th>
                <th className="px-6 py-5 whitespace-nowrap text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {presences.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/20">
                  <td className="px-6 py-6 font-bold text-primary whitespace-nowrap">{row.name}</td>
                  <td className="px-6 py-6 text-sm text-gray-500 whitespace-nowrap">{row.activity}</td>
                  <td className="px-6 py-6 text-sm font-mono whitespace-nowrap">{row.time}</td>
                  <td className="px-6 py-6 text-right whitespace-nowrap">
                    <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full uppercase">Presente</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {presences.length === 0 && <div className="p-20 text-center text-gray-300 italic">Nenhuma presença registrada agora.</div>}
        </div>
      ) : activeTab === 'usuarios' ? (
        /* Users & Registration Tab */
        <div className="space-y-8 animate-in fade-in">
          {/* Registration Form */}
          <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10">
            <h3 className="font-headline font-bold text-xl text-primary mb-6">Cadastrar Novo Médium</h3>
            <form onSubmit={handleRegisterMedium} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input 
                type="text" placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} required
                className="px-4 py-3 bg-white rounded-xl border-none shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <input 
                type="email" placeholder="E-mail Pessoal" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                className="px-4 py-3 bg-white rounded-xl border-none shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <input 
                type="tel" placeholder="WhatsApp (Ex: 11 90000-0000)" value={newPhone} onChange={e => setNewPhone(formatPhone(e.target.value))} required maxLength={15}
                className="px-4 py-3 bg-white rounded-xl border-none shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <button type="submit" className="px-4 py-3 bg-primary text-white font-bold rounded-xl hover:brightness-110 transition-all">
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

          {/* Users Table */}
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="px-6 py-5 whitespace-nowrap">Nome / Formação</th>
                  <th className="px-6 py-5 whitespace-nowrap">Contato</th>
                  <th className="px-6 py-5 whitespace-nowrap">Nível de Acesso</th>
                  <th className="px-6 py-5 whitespace-nowrap text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u, i) => (
                  <tr key={i} className="hover:bg-gray-50/20">
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="font-bold text-primary">{u.name}</div>
                      {u.cursos && u.cursos !== 'Nenhum curso / Não se aplica' && (
                        <div className="text-[10px] text-primary/60 font-bold uppercase tracking-widest mt-1 truncate max-w-[200px]" title={u.cursos}>
                          {u.cursos}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{u.email}</div>
                      {u.phone ? (
                        <div className="text-xs text-green-600 font-bold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">chat</span> {u.phone}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 mt-1 italic">Sem celular</div>
                      )}
                    </td>
                    <td className="px-6 py-6 uppercase text-[10px] font-black tracking-widest text-primary/60 whitespace-nowrap">{u.role}</td>
                    <td className="px-6 py-6 text-right whitespace-nowrap">
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
      ) : activeTab === 'reflexao' ? (
        /* Reflection Tab */
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm animate-in fade-in space-y-8">
          <div className="space-y-2">
            <h3 className="font-headline font-bold text-xl text-primary">Alterar a Reflexão do Dia</h3>
            <p className="text-gray-500 text-sm">Atualize a mensagem e a imagem de fundo que aparecem na tela de início de todos os voluntários.</p>
          </div>
          
          <form onSubmit={handleSaveReflection} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-primary uppercase tracking-wider">A Mensagem (Frase)</label>
                <textarea 
                  value={reflectionQuote} 
                  onChange={e => setReflectionQuote(e.target.value)} 
                  required
                  rows="4"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-primary uppercase tracking-wider">Autor da Frase</label>
                <input 
                  type="text" 
                  value={reflectionAuthor} 
                  onChange={e => setReflectionAuthor(e.target.value)} 
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-primary uppercase tracking-wider">Link da Imagem (URL)</label>
                <input 
                  type="url" 
                  placeholder="https://..."
                  value={reflectionImageUrl} 
                  onChange={e => setReflectionImageUrl(e.target.value)} 
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <p className="text-[10px] text-gray-400 font-medium">Copie o endereço de uma imagem na internet e cole aqui.</p>
              </div>

              <button 
                type="submit" 
                disabled={savingReflection}
                className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
              >
                {savingReflection ? 'Publicando...' : 'Salvar no App'}
              </button>
            </div>
            
            {/* Live Preview */}
            <div className="space-y-4">
              <label className="text-xs font-bold text-primary uppercase tracking-wider">Como vai ficar no celular dos voluntários:</label>
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex flex-col group max-w-[320px] mx-auto opacity-90 scale-90 md:scale-100 origin-top">
                <div className="overflow-hidden h-48 bg-gray-100 relative">
                  {reflectionImageUrl ? (
                    <img src={reflectionImageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" onError={(e) => e.target.src = '/img-apoio/caridade.png'} />
                  ) : (
                     <div className="absolute inset-0 flex items-center justify-center text-gray-300">Sem imagem</div>
                  )}
                </div>
                <div className="p-8 space-y-4 bg-primary/5">
                  <blockquote className="space-y-3">
                    <p className="text-primary text-xl font-medium leading-relaxed italic">
                      "{reflectionQuote || 'Sua mensagem aparecerá aqui...'}"
                    </p>
                    <cite className="text-primary/60 text-xs font-black uppercase tracking-widest block not-italic">— {reflectionAuthor || 'Autor'}</cite>
                  </blockquote>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
};

export default Admin;
