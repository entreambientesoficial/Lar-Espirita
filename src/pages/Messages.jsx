import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const Messages = () => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('mensagens')
      .select(`id, content, is_broadcast, created_at, profiles!inner (id, name, role)`)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) {
      setMessages(data);
    }
  };

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel('messages-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, () => {
        fetchMessages();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Roll scroll down on message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);

    const { error } = await supabase.from('mensagens').insert([{
      profile_id: profile.id,
      content: newMessage.trim(),
      is_broadcast: profile.role === 'admin' ? isBroadcast : false
    }]);

    if (!error) {
      setNewMessage('');
      if (isBroadcast) setIsBroadcast(false);
    }
    setSending(false);
  };

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 pb-32 h-[calc(100vh-80px)] flex flex-col font-body">
      {/* Header */}
      <section className="mb-6 flex-shrink-0 animate-in fade-in duration-700">
        <h2 className="font-headline font-extrabold text-primary tracking-tight text-3xl">Painel de Mensagens</h2>
        <p className="text-on-surface-variant font-medium text-sm mt-1">Mural de avisos e bate-papo da Casa.</p>
      </section>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 overflow-y-auto space-y-6 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 opacity-50">
             <span className="material-symbols-outlined text-4xl">forum</span>
             <p>Nenhuma mensagem ainda.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.profiles.id === profile.id;
            const isAlert = msg.is_broadcast;

            if (isAlert) {
              return (
                <div key={msg.id} className="w-full flex justify-center animate-in slide-in-from-bottom-2 fade-in">
                  <div className="bg-primary/10 border-2 border-primary/20 w-full max-w-lg rounded-2xl p-6 text-center shadow-lg shadow-primary/5">
                    <div className="flex items-center justify-center gap-2 text-primary font-black uppercase tracking-widest text-[10px] mb-3">
                      <span className="material-symbols-outlined text-sm">campaign</span> 
                      Comunicado Oficial
                    </div>
                    <p className="text-primary font-medium text-lg leading-relaxed">{msg.content}</p>
                    <div className="mt-4 text-[10px] text-primary/60 font-bold uppercase">Enviado por: {msg.profiles.name} às {formatTime(msg.created_at)}</div>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in`}>
                <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name */}
                  <span className="text-[10px] font-bold text-gray-400 mb-1 px-1 flex items-center gap-1 uppercase tracking-wider">
                    {msg.profiles.name} 
                    {msg.profiles.role === 'admin' && <span className="material-symbols-outlined text-[10px] text-primary/60" title="Gestor">verified</span>}
                  </span>
                  
                  {/* Bubble */}
                  <div className={`px-5 py-3 rounded-2xl text-sm ${
                    isMe 
                    ? 'bg-primary text-white rounded-br-sm shadow-md shadow-primary/10' 
                    : 'bg-gray-100 text-gray-700 rounded-bl-sm border border-gray-200'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-[9px] text-gray-300 mt-1 px-1 font-mono">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <section className="mt-4 bg-white p-4 rounded-3xl shadow-lg border border-gray-100 flex-shrink-0 animate-in slide-in-from-bottom-4">
        <form onSubmit={handleSendMessage} className="space-y-3">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Digite aqui..."
              className="flex-1 bg-gray-50 border-none px-5 py-3 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none text-sm placeholder:text-gray-400"
              disabled={sending}
              maxLength={500}
            />
            <button 
              type="submit" 
              disabled={sending || !newMessage.trim()}
              className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center hover:bg-primary/90 transition-transform active:scale-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">send</span>
            </button>
          </div>
          {profile?.role === 'admin' && (
            <label className="flex items-center gap-2 cursor-pointer group px-2 select-none">
              <input 
                type="checkbox" 
                checked={isBroadcast}
                onChange={e => setIsBroadcast(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary accent-primary focus:ring-primary/20"
              />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-primary transition-colors">
                 Enviar como Comunicado Oficial
              </span>
            </label>
          )}
        </form>
      </section>
    </main>
  );
};

export default Messages;
