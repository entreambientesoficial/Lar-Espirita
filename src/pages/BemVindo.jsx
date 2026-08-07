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
    <div className="min-h-screen relative flex flex-col justify-between items-center p-4 sm:p-6 md:p-8 font-body overflow-y-auto bg-[#07091b]">
      {/* Background Image Layer - PRESERVED 100% */}
      <div 
        className="fixed inset-0 z-0 bg-cover md:bg-contain bg-no-repeat bg-center"
        style={{ 
          backgroundImage: "url('/img-apoio/capa-apometria.jpg')"
        }}
      />
      
      {/* Subtle Overlay */}
      <div className="fixed inset-0 z-1 bg-black/20 backdrop-blur-[0.5px]" />

      {/* TOP SECTION: Header positioned below the top golden lotus symbol */}
      <div className="relative z-10 w-full max-w-md pt-12 sm:pt-16 md:pt-20 text-center">
        <div className="flex flex-col items-center space-y-2">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 group animate-entry-logo">
            {/* Soft Luminous Aura Glow */}
            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300 opacity-75 blur-md" />
            
            {/* Logo Circle Container */}
            <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-white/90 shadow-[0_0_25px_rgba(255,255,255,0.7),0_0_40px_rgba(96,165,250,0.5)] bg-slate-900 flex items-center justify-center">
              <img 
                src="/img-apoio/logo-elos.jpg" 
                alt="Logo Apometria Elos de Amor e Paz" 
                className="w-full h-full object-cover rounded-full" 
              />
            </div>
          </div>

          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white font-headline tracking-tight leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-entry-title">
              Apometria Elos de Amor e Paz
            </h1>
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION: Completely open & clear to show central artwork & chakras */}
      <div className="flex-1 w-full" />

      {/* BOTTOM SECTION: Two side-by-side rectangular buttons at the bottom of the screen */}
      <div className="relative z-10 w-full max-w-md pb-2 sm:pb-4 mt-auto transition-all duration-300">
        {!showEmailForm ? (
          <div className="space-y-3">
            {/* Two Side-by-Side Compact Rectangular Buttons */}
            <div className="flex items-center justify-center gap-3 w-full animate-entry-buttons">
              <button
                type="button"
                onClick={signInWithGoogle}
                className="flex-1 bg-white/95 hover:bg-white text-slate-800 py-3 px-3 sm:px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl border border-white/80 active:scale-[0.98] transition-all text-xs sm:text-sm"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowEmailForm(true);
                  setIsSignUp(false);
                  setIsReset(false);
                  setMessage({ text: '', type: '' });
                }}
                className="flex-1 bg-primary/95 hover:bg-primary text-white py-3 px-3 sm:px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl border border-blue-400/30 backdrop-blur-md active:scale-[0.98] transition-all text-xs sm:text-sm"
              >
                <span className="material-symbols-outlined text-base sm:text-lg">mail</span>
                <span>E-mail</span>
              </button>
            </div>

            {/* Micro Links below buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-1 animate-entry-links">
              <button 
                type="button"
                onClick={() => {
                  setShowEmailForm(true);
                  setIsSignUp(true);
                  setIsReset(false);
                  setMessage({ text: '', type: '' });
                }} 
                className="text-xs font-semibold text-blue-100 hover:text-white bg-slate-950/60 hover:bg-slate-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 shadow-md transition-all"
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
                className="text-xs font-medium text-blue-200/90 hover:text-white transition-colors py-1"
              >
                Esqueci minha senha
              </button>
            </div>
          </div>
        ) : (
          /* EXPANDED EMAIL FORM AT THE BOTTOM IN DARK GLASS */
          <form onSubmit={handleSubmit} className="bg-slate-950/80 backdrop-blur-xl border border-white/20 p-4 sm:p-5 rounded-3xl shadow-2xl space-y-3.5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center">
              <h2 className="font-headline font-bold text-xs sm:text-sm text-white bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-lg inline-block border border-white/15">
                {isReset ? 'Recuperar Senha' : (isSignUp ? 'Configurar Primeiro Acesso' : 'Entrar com e-mail')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">mail</span>
                <input 
                  type="email" 
                  placeholder="E-mail" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900/90 border border-white/20 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-400 outline-none text-white placeholder:text-slate-400 backdrop-blur-md transition-all"
                />
              </div>

              {!isReset && (
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">lock</span>
                  <input 
                    type="password" 
                    placeholder="Senha" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900/90 border border-white/20 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-400 outline-none text-white placeholder:text-slate-400 backdrop-blur-md transition-all"
                  />
                </div>
              )}
            </div>

            {authError && (
              <div className="p-2.5 rounded-xl bg-red-500/90 text-white text-xs font-bold text-center border border-red-400/40 shadow-sm">
                {authError}
              </div>
            )}

            {message.text && (
              <div className={`p-2.5 rounded-xl border text-xs font-bold text-center ${
                message.type === 'success' 
                  ? 'bg-emerald-500/90 text-white border-emerald-400/40' 
                  : 'bg-red-500/90 text-white border-red-400/40'
              }`}>
                {message.text}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button 
                type="button" 
                onClick={handleBack} 
                className="w-1/3 py-2.5 px-3 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-white/15 transition-all text-center"
              >
                ← Voltar
              </button>

              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 bg-primary hover:bg-blue-600 text-white py-2.5 px-4 rounded-xl font-bold shadow-xl border border-blue-400/30 active:scale-[0.98] transition-all disabled:opacity-50 text-xs sm:text-sm"
              >
                {loading ? 'Processando...' : (isReset ? 'Enviar Link' : (isSignUp ? 'Ativar Acesso' : 'Entrar'))}
              </button>
            </div>

            {!isReset && !isSignUp && (
              <div className="flex items-center justify-between w-full text-[11px] pt-1 text-slate-300 px-1">
                <button 
                  type="button" 
                  onClick={() => { setIsSignUp(true); setMessage({ text: '', type: '' }); }} 
                  className="hover:text-white transition-colors"
                >
                  Primeiro acesso?
                </button>
                <button 
                  type="button" 
                  onClick={() => { setIsReset(true); setMessage({ text: '', type: '' }); }} 
                  className="hover:text-white transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default BemVindo;


