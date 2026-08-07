import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BemVindo = () => {
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, session, authError } = useAuth();
  
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Redireciona se já logado
  React.useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      if (isReset) {
        const { error } = await sendPasswordReset(email);
        if (error) throw error;
        setMessage({ text: 'Link de recuperação enviado para seu e-mail!', type: 'success' });
      } else if (isSignUp) {
        const { error } = await signUpWithEmail(email, password);
        if (error) throw error;
        setMessage({ text: 'Conta criada! Verifique seu e-mail para confirmar.', type: 'success' });
      } else {
        const { error } = await signInWithEmail(email, password);
        if (error) throw error;
        navigate('/dashboard');
      }
    } catch (err) {
      setMessage({ text: err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setShowEmailForm(false);
    setIsSignUp(false);
    setIsReset(false);
    setMessage({ text: '', type: '' });
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-between p-4 sm:p-6 md:p-8 font-body overflow-y-auto bg-[#07091b]">
      {/* Background Image Layer - PRESERVED 100% */}
      <div 
        className="fixed inset-0 z-0 bg-cover md:bg-contain bg-no-repeat bg-center"
        style={{ 
          backgroundImage: "url('/img-apoio/capa-apometria.jpg')"
        }}
      />
      
      {/* Subtle Overlay to enhance contrast without hiding the artwork */}
      <div className="fixed inset-0 z-1 bg-black/25 backdrop-blur-[0.5px]" />

      {/* Main Container */}
      <div className="flex flex-col items-center justify-between w-full max-w-sm z-10 my-auto py-6 space-y-6">
        
        {/* Header Section */}
        <div className="space-y-3 text-center animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="relative mx-auto w-24 h-24 sm:w-26 sm:h-26 group">
            {/* Soft Luminous Aura Glow */}
            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300 opacity-70 blur-md animate-pulse" />
            
            {/* Logo Circle Container */}
            <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-white/90 shadow-[0_0_25px_rgba(255,255,255,0.6),0_0_40px_rgba(96,165,250,0.4)] bg-slate-900 flex items-center justify-center">
              <img 
                src="/img-apoio/logo-elos.jpg" 
                alt="Logo Apometria Elos de Amor e Paz" 
                className="w-full h-full object-cover rounded-full transform transition-transform duration-500 hover:scale-105" 
              />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white font-headline tracking-tight leading-tight px-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              Apometria Elos <br /> de Amor e Paz
            </h1>
            <p className="text-blue-100 font-black text-[10px] uppercase tracking-[0.3em] bg-slate-950/60 backdrop-blur-md inline-block px-3 py-1 rounded-full border border-white/20 shadow-lg">
              Portal do Voluntário
            </p>
          </div>
        </div>

        {/* Dynamic Action Section */}
        <div className="w-full transition-all duration-300">
          {!showEmailForm ? (
            /* INITIAL COMPACT VIEW - PRESERVES ARTWORK BACKGROUND */
            <div className="space-y-3.5 animate-in fade-in duration-500">
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full bg-white/95 hover:bg-white text-slate-800 py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl border border-white/80 active:scale-[0.98] transition-all text-sm"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                <span>Entrar com Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowEmailForm(true);
                  setIsSignUp(false);
                  setIsReset(false);
                  setMessage({ text: '', type: '' });
                }}
                className="w-full bg-primary/90 hover:bg-primary text-white py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl border border-blue-400/30 backdrop-blur-md active:scale-[0.98] transition-all text-sm"
              >
                <span className="material-symbols-outlined text-lg">mail</span>
                <span>Entrar com e-mail</span>
              </button>

              <div className="flex flex-col items-center gap-2 pt-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEmailForm(true);
                    setIsSignUp(true);
                    setIsReset(false);
                    setMessage({ text: '', type: '' });
                  }} 
                  className="w-full py-2.5 px-4 text-xs font-semibold text-blue-100 bg-slate-950/50 hover:bg-slate-950/75 backdrop-blur-md rounded-2xl border border-white/15 shadow-lg transition-all text-center"
                >
                  Primeiro acesso? Crie sua senha
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setShowEmailForm(true);
                    setIsReset(true);
                    setIsSignUp(false);
                    setMessage({ text: '', type: '' });
                  }} 
                  className="py-1 px-3 text-xs font-medium text-blue-200/90 hover:text-white transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>
          ) : (
            /* EXPANDED EMAIL FORM IN DARK GLASS */
            <form onSubmit={handleSubmit} className="bg-slate-950/65 backdrop-blur-xl border border-white/20 p-5 rounded-3xl shadow-2xl space-y-4 animate-in fade-in duration-300">
              <div className="text-center">
                <h2 className="font-headline font-bold text-sm text-white bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-xl inline-block border border-white/15">
                  {isReset ? 'Recuperar Senha' : (isSignUp ? 'Configurar Primeiro Acesso' : 'Entrar com e-mail')}
                </h2>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                  <input 
                    type="email" 
                    placeholder="E-mail" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-white/20 rounded-2xl text-sm focus:ring-2 focus:ring-blue-400 outline-none text-white placeholder:text-slate-400 backdrop-blur-md transition-all"
                  />
                </div>

                {!isReset && (
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                    <input 
                      type="password" 
                      placeholder="Senha" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required
                      className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-white/20 rounded-2xl text-sm focus:ring-2 focus:ring-blue-400 outline-none text-white placeholder:text-slate-400 backdrop-blur-md transition-all"
                    />
                  </div>
                )}
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-red-500/90 text-white text-xs font-bold text-center border border-red-400/40 shadow-sm">
                  {authError}
                </div>
              )}

              {message.text && (
                <div className={`p-3 rounded-xl border text-xs font-bold text-center ${
                  message.type === 'success' 
                    ? 'bg-emerald-500/90 text-white border-emerald-400/40' 
                    : 'bg-red-500/90 text-white border-red-400/40'
                }`}>
                  {message.text}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary hover:bg-blue-600 text-white py-3.5 rounded-2xl font-bold shadow-xl border border-blue-400/30 active:scale-[0.98] transition-all disabled:opacity-50 text-sm"
              >
                {loading ? 'Processando...' : (isReset ? 'Enviar Link' : (isSignUp ? 'Ativar meu Acesso' : 'Entrar'))}
              </button>

              <div className="pt-2 flex flex-col items-center gap-2 border-t border-white/15">
                {!isReset && !isSignUp && (
                  <div className="flex items-center justify-between w-full text-xs px-1">
                    <button 
                      type="button" 
                      onClick={() => { setIsSignUp(true); setMessage({ text: '', type: '' }); }} 
                      className="text-blue-200 hover:text-white transition-colors"
                    >
                      Primeiro acesso?
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setIsReset(true); setMessage({ text: '', type: '' }); }} 
                      className="text-blue-300/80 hover:text-white transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                {(isReset || isSignUp) && (
                  <button 
                    type="button" 
                    onClick={() => { setIsReset(false); setIsSignUp(false); setMessage({ text: '', type: '' }); }} 
                    className="text-xs text-blue-200 hover:text-white underline font-semibold"
                  >
                    Já tem conta? Entrar com e-mail
                  </button>
                )}

                <button 
                  type="button" 
                  onClick={handleBack} 
                  className="text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1 mt-1 py-1"
                >
                  ← Voltar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default BemVindo;

