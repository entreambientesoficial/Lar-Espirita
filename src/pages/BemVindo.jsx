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
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 sm:p-6 font-body overflow-y-auto bg-[#07091b]">
      {/* Background Image Layer */}
      <div 
        className="fixed inset-0 z-0 bg-cover md:bg-contain bg-no-repeat bg-center"
        style={{ 
          backgroundImage: "url('/img-apoio/capa-apometria.jpg')"
        }}
      />
      
      {/* Subtle Overlay */}
      <div className="fixed inset-0 z-1 bg-black/30 backdrop-blur-[2px]" />

      {/* Single Central Card */}
      <div className="relative z-10 w-full max-w-sm mx-auto my-auto transition-all duration-300">
        <div className="bg-white/85 backdrop-blur-md border border-white/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-950/30 text-slate-800 transition-all duration-300">
          
          {/* Header Section */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-4">
              {/* Soft Luminous Aura Glow */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300 opacity-65 blur-md animate-pulse" />
              
              {/* Logo Circle Container */}
              <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-white shadow-md bg-slate-900 flex items-center justify-center">
                <img 
                  src="/img-apoio/logo-elos.jpg" 
                  alt="Logo Apometria Elos de Amor e Paz" 
                  className="w-full h-full object-cover rounded-full transform transition-transform duration-500 hover:scale-105" 
                />
              </div>
            </div>

            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 font-headline tracking-tight leading-tight px-2">
              Apometria Elos <br /> de Amor e Paz
            </h1>
            <p className="mt-2 text-primary font-black text-[10px] uppercase tracking-[0.25em] bg-primary/10 border border-primary/20 px-3 py-1 rounded-full shadow-sm">
              PORTAL DO VOLUNTÁRIO
            </p>
          </div>

          {/* Card Content Area - Smooth Transition */}
          {!showEmailForm ? (
            /* Initial State View */
            <div className="space-y-4 animate-in fade-in duration-300">
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full bg-white text-slate-700 py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-sm border border-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-all duration-150 text-sm"
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
                className="w-full bg-primary text-white py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 text-sm"
              >
                <span className="material-symbols-outlined text-lg">mail</span>
                <span>Entrar com e-mail</span>
              </button>

              <div className="pt-2 flex flex-col items-center gap-2 border-t border-slate-200/60">
                <button 
                  type="button"
                  onClick={() => {
                    setShowEmailForm(true);
                    setIsSignUp(true);
                    setIsReset(false);
                    setMessage({ text: '', type: '' });
                  }} 
                  className="text-xs font-semibold text-slate-600 hover:text-primary transition-colors py-1 text-center"
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
                  className="text-xs font-medium text-slate-500 hover:text-primary transition-colors py-1 text-center"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>
          ) : (
            /* Email Form View */
            <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-300">
              <div className="text-center pb-1">
                <h2 className="font-headline font-bold text-sm text-slate-800">
                  {isReset ? 'Recuperar Senha' : (isSignUp ? 'Configurar Primeiro Acesso' : 'Entrar com e-mail')}
                </h2>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                  <input 
                    type="email" 
                    placeholder="E-mail" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none shadow-sm text-slate-800 placeholder:text-slate-400 transition-all"
                  />
                </div>

                {!isReset && (
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                    <input 
                      type="password" 
                      placeholder="Senha" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none shadow-sm text-slate-800 placeholder:text-slate-400 transition-all"
                    />
                  </div>
                )}
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold text-center">
                  {authError}
                </div>
              )}

              {message.text && (
                <div className={`p-3 rounded-xl border text-xs font-semibold text-center ${
                  message.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}>
                  {message.text}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 px-4 rounded-xl font-bold shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 text-sm"
              >
                {loading ? 'Processando...' : (isReset ? 'Enviar Link' : (isSignUp ? 'Ativar meu Acesso' : 'Entrar'))}
              </button>

              <div className="pt-2 flex flex-col items-center gap-2 border-t border-slate-200/60">
                {!isReset && !isSignUp && (
                  <div className="flex items-center justify-between w-full text-xs px-1">
                    <button 
                      type="button" 
                      onClick={() => { setIsSignUp(true); setMessage({ text: '', type: '' }); }} 
                      className="text-slate-600 hover:text-primary transition-colors font-medium"
                    >
                      Primeiro acesso?
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setIsReset(true); setMessage({ text: '', type: '' }); }} 
                      className="text-slate-500 hover:text-primary transition-colors font-medium"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                {(isReset || isSignUp) && (
                  <button 
                    type="button" 
                    onClick={() => { setIsReset(false); setIsSignUp(false); setMessage({ text: '', type: '' }); }} 
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    Já tem conta? Entrar com e-mail
                  </button>
                )}

                <button 
                  type="button" 
                  onClick={handleBack} 
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1 mt-1 py-1"
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

