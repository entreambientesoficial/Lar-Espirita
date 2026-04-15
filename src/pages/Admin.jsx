import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, dataService } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CHECKIN_TOKEN } from '../lib/checkinToken';

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
    // 1. Buscar confirmações de hoje (com e sem QR check-in)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const { data: presenceData } = await supabase
      .from('presencas')
      .select(`id, checkin_time, qr_checkin, profiles ( name ), atividades ( name )`)
      .gte('checkin_time', startOfDay)
      .lt('checkin_time', endOfDay)
      .order('checkin_time', { ascending: true });

    if (presenceData) {
      const formatted = presenceData.map(p => ({
        time:       new Date(p.checkin_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        name:       p.profiles?.name || 'Anônimo',
        activity:   p.atividades?.name || 'Desconhecida',
        qr_checkin: p.qr_checkin,
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      alert('Por favor, insira um endereço de e-mail válido.');
      return;
    }

    const phoneDigits = newPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      alert('Por favor, insira um número de telefone válido com DDD (ex: (11) 90000-0000).');
      return;
    }

    const { data: existing } = await supabase
      .from('pre_cadastros')
      .select('id')
      .eq('email', newEmail.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      alert('Este e-mail já está cadastrado no sistema.');
      return;
    }

    const { error } = await supabase
      .from('pre_cadastros')
      .insert([{ name: newName.trim(), email: newEmail.toLowerCase().trim(), phone: newPhone, role: 'volunteer' }]);

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
    if (userId === profile?.id) return;

    if (currentRole === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        alert('Não é possível remover o único administrador do sistema.');
        return;
      }
    }

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
        <button onClick={() => setActiveTab('qrcode')} className={`pb-4 px-2 font-bold transition-all relative ${activeTab === 'qrcode' ? 'text-primary' : 'text-gray-400'}`}>
          QR Code da Casa {activeTab === 'qrcode' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-full"></div>}
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
                <th className="px-6 py-5 whitespace-nowrap">Confirmou às</th>
                <th className="px-6 py-5 whitespace-nowrap text-center">Check-in QR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {presences.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/20">
                  <td className="px-6 py-6 font-bold text-primary whitespace-nowrap">{row.name}</td>
                  <td className="px-6 py-6 text-sm text-gray-500 whitespace-nowrap">{row.activity}</td>
                  <td className="px-6 py-6 text-sm font-mono whitespace-nowrap">{row.time}</td>
                  <td className="px-6 py-6 text-center whitespace-nowrap">
                    {row.qr_checkin
                      ? <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full uppercase">Realizado</span>
                      : <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full uppercase">Pendente</span>
                    }
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
      ) : activeTab === 'qrcode' ? (
        /* QR Code Tab */
        <div className="flex flex-col items-center gap-8 animate-in fade-in">
          <div className="bg-white rounded-3xl p-10 border border-gray-100 shadow-sm flex flex-col items-center gap-6 max-w-sm w-full">
            <div className="space-y-1 text-center">
              <h3 className="font-headline font-bold text-xl text-primary">QR Code de Presença</h3>
              <p className="text-gray-500 text-sm">Imprima e fixe em local visível na Casa para os voluntários escanearem.</p>
            </div>

            <div id="qrcode-print-area" className="bg-white p-6 rounded-2xl border-2 border-gray-100 flex flex-col items-center gap-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Lar Beneficente Eurípedes Barsanulfo</p>
              <QRCodeSVG
                value={CHECKIN_TOKEN}
                size={220}
                bgColor="#ffffff"
                fgColor="#1a237e"
                level="H"
                marginSize={4}
              />
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Escaneie para confirmar presença</p>
            </div>

            <button
              onClick={() => {
                const area = document.getElementById('qrcode-print-area').innerHTML;
                const win = window.open('', '_blank');
                win.document.title = 'QR Code - Presença';
                win.document.head.innerHTML = `<style>
                  body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;}
                  .wrap{text-align:center;padding:40px;border:2px solid #e5e7eb;border-radius:16px;}
                  p{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.15em;color:#9ca3af;margin:8px 0;}
                  @media print{body{height:auto;}}
                </style>`;
                win.document.body.innerHTML = `<div class="wrap">${area}</div>`;
                win.onload = () => win.print();
                win.print();
              }}
              className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">print</span>
              Imprimir QR Code
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 max-w-sm w-full flex gap-3">
            <span className="material-symbols-outlined text-amber-500 text-xl shrink-0">info</span>
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              Este QR Code é único e exclusivo desta Casa. Apenas voluntários com o app instalado conseguem usá-lo para registrar presença.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default Admin;
