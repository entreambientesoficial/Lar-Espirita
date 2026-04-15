import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BemVindo = () => {
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, session } = useAuth();
  
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
    <div className="min-h-screen relative flex flex-col items-center justify-center p-8 font-body overflow-hidden">
      {/* Background Image Layer - FULL SCREEN COVER */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-no-repeat"
        style={{ 
          backgroundImage: "url('/img-apoio/tela-login.png')",
          backgroundPosition: '50% 10%' 
        }}
      ></div>
      
      {/* Subtle Overlay to ensure readability while preserving image colors */}
      <div className="absolute inset-0 z-1 bg-white/40 backdrop-blur-[0.5px]"></div>

      <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-sm z-10 transition-all">
        {/* Header Section */}
        <div className="space-y-4 text-center animate-in fade-in slide-in-from-bottom-6 duration-1000">
          <div className="w-24 h-24 mx-auto rounded-full bg-white shadow-2xl flex items-center justify-center p-2 border-4 border-primary/10">
            <img src="/img-apoio/logo.jpg" alt="Logo" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-extrabold text-primary font-headline tracking-tight leading-tight px-4 bg-white/20 rounded-xl py-1">
              Lar Beneficente <br /> Eurípedes Barsanulfo
            </h1>
            <p className="text-on-surface-variant font-black text-[10px] uppercase tracking-[0.3em] bg-white/30 inline-block px-2 rounded">Portal do Voluntário</p>
          </div>
        </div>

        {/* Action Section */}
        <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
          
          {!isReset && (
            <button 
              onClick={signInWithGoogle}
              className="w-full bg-white text-on-surface py-3.5 rounded-2xl font-bold flex items-center justify-center gap-4 shadow-xl border border-gray-100 hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              <span className="text-sm">Entrar com Google</span>
            </button>
          )}

          {!isReset && (
            <div className="flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-primary/20"></div>
              <span className="text-[10px] uppercase font-black text-primary/40 tracking-widest">ou e-mail</span>
              <div className="h-[1px] flex-1 bg-primary/20"></div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-center font-headline font-bold text-lg text-primary bg-white/20 rounded-lg inline-block w-full">
              {isReset ? 'Recuperar Senha' : (isSignUp ? 'Configurar Primeiro Acesso' : 'Acessar com Senha')}
            </h2>

            <div className="space-y-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 text-xl">mail</span>
                <input 
                  type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full pl-12 pr-4 py-3.5 bg-white/90 border border-white/50 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 outline-none shadow-xl"
                />
              </div>

              {!isReset && (
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 text-xl">lock</span>
                  <input 
                    type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="w-full pl-12 pr-4 py-3.5 bg-white/90 border border-white/50 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 outline-none shadow-xl"
                  />
                </div>
              )}
            </div>

            {message.text && (
              <p className={`text-center text-xs font-bold p-3 rounded-xl shadow-sm ${message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                {message.text}
              </p>
            )}

            <button 
              type="submit" disabled={loading}
              className="w-full bg-primary text-white py-3.5 rounded-2xl font-bold shadow-2xl shadow-primary/40 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? 'Processando...' : (isReset ? 'Enviar Link' : (isSignUp ? 'Ativar meu Acesso' : 'Entrar'))}
            </button>
          </form>

          {/* Helper Links */}
          <div className="flex flex-col items-center gap-3">
            {!isReset ? (
              <>
                <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm font-bold text-primary hover:text-primary/70">
                  {isSignUp ? 'Voltar para o Login' : 'Primeiro acesso? Crie sua senha aqui ou acesse com sua conta Google'}
                </button>
                <button onClick={() => setIsReset(true)} className="text-xs font-bold text-primary/60 hover:underline">
                  Esqueci minha senha
                </button>
              </>
            ) : (
              <button onClick={() => setIsReset(false)} className="text-sm font-bold text-primary">
                Voltar para o Login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BemVindo;
