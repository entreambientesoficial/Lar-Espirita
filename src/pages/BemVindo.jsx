import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BemVindo = () => {
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, session, authError } = useAuth();
  
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

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 md:p-8 font-body overflow-hidden bg-[#07091b]">
      {/* Background Image Layer - CONTAIN TO FIT PERFECTLY ON SCREEN */}
      <div 
        className="absolute inset-0 z-0 bg-contain bg-no-repeat bg-center"
        style={{ 
          backgroundImage: "url('/img-apoio/capa-apometria.jpg')"
        }}
      ></div>
      
      {/* Subtle Overlay - Soft vignette overlay to preserve full image visibility */}
      <div className="absolute inset-0 z-1 bg-black/20 backdrop-blur-[0.5px]"></div>

      <div className="flex flex-col items-center justify-center space-y-5 w-full max-w-sm z-10 transition-all my-auto py-4">
        {/* Header Section */}
        <div className="space-y-3 text-center animate-in fade-in slide-in-from-bottom-6 duration-1000">
          <div className="relative mx-auto w-24 h-24 md:w-28 md:h-28 group">
            {/* Soft Luminous Aura Glow */}
            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300 opacity-75 blur-md animate-pulse"></div>
            
            {/* Logo Circle Container */}
            <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-white/90 shadow-[0_0_25px_rgba(255,255,255,0.7),0_0_45px_rgba(96,165,250,0.5)] bg-slate-900 flex items-center justify-center">
              <img 
                src="/img-apoio/logo-elos.jpg" 
                alt="Logo Apometria Elos de Amor e Paz" 
                className="w-full h-full object-cover rounded-full transform transition-transform duration-500 hover:scale-105" 
              />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-extrabold text-white font-headline tracking-tight leading-tight px-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Apometria Elos <br /> de Amor e Paz
            </h1>
            <p className="text-blue-100 font-black text-[10px] uppercase tracking-[0.3em] bg-slate-950/60 backdrop-blur-md inline-block px-3 py-1 rounded-full border border-white/20 shadow-lg">
              Portal do Voluntário
            </p>
          </div>
        </div>

        {/* Action Section */}
        <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
          
          {!isReset && (
            <button
              onClick={signInWithGoogle}
              className="w-full bg-white text-slate-800 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-2xl border border-white/80 hover:bg-slate-50 active:scale-95 transition-all duration-150"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              <span className="text-sm">Entrar com Google</span>
            </button>
          )}

          {!isReset && (
            <div className="flex items-center gap-4 py-1">
              <div className="h-[1px] flex-1 bg-white/30"></div>
              <span className="text-[10px] uppercase font-black text-white/90 tracking-widest bg-slate-950/60 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10">ou e-mail</span>
              <div className="h-[1px] flex-1 bg-white/30"></div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="text-center">
              <h2 className="font-headline font-bold text-sm text-white bg-slate-950/70 backdrop-blur-md px-4 py-1.5 rounded-xl inline-block border border-white/20 shadow-lg">
                {isReset ? 'Recuperar Senha' : (isSignUp ? 'Configurar Primeiro Acesso' : 'Acessar com Senha')}
              </h2>
            </div>

            <div className="space-y-2.5">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">mail</span>
                <input 
                  type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full pl-12 pr-4 py-3.5 bg-white/95 border border-white/80 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-2xl text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {!isReset && (
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">lock</span>
                  <input 
                    type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="w-full pl-12 pr-4 py-3.5 bg-white/95 border border-white/80 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-2xl text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              )}
            </div>

            {authError && (
              <p className="text-center text-xs font-bold p-3 rounded-xl shadow-sm bg-red-500 text-white">
                {authError}
              </p>
            )}

            {message.text && (
              <p className={`text-center text-xs font-bold p-3 rounded-xl shadow-sm ${message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                {message.text}
              </p>
            )}

            <button 
              type="submit" disabled={loading}
              className="w-full bg-primary text-white py-3.5 rounded-2xl font-bold shadow-2xl shadow-primary/50 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 text-sm border border-white/20"
            >
              {loading ? 'Processando...' : (isReset ? 'Enviar Link' : (isSignUp ? 'Ativar meu Acesso' : 'Entrar'))}
            </button>
          </form>

          {/* Helper Links - Micro Dark Glass Badges */}
          <div className="flex flex-col items-center gap-2.5 pt-1">
            {!isReset ? (
              <>
                <button 
                  onClick={() => setIsSignUp(!isSignUp)} 
                  className="w-full py-3 px-4 text-xs font-semibold text-white bg-slate-950/80 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl hover:bg-slate-900 transition-all text-center leading-relaxed"
                >
                  {isSignUp ? '← Voltar para o Login' : 'Primeiro acesso? Crie sua senha aqui ou acesse com sua conta Google'}
                </button>
                <button 
                  onClick={() => setIsReset(true)} 
                  className="py-1.5 px-3 text-xs font-medium text-blue-200 bg-slate-950/60 backdrop-blur-sm rounded-full border border-white/10 hover:text-white hover:bg-slate-900 transition-all"
                >
                  Esqueci minha senha
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsReset(false)} 
                className="w-full py-3 px-4 text-xs font-bold text-white bg-slate-950/80 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl hover:bg-slate-900 transition-all text-center"
              >
                ← Voltar para o Login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BemVindo;
