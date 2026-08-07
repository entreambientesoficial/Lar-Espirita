import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    // Pegar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Ouvir mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data);
      setAuthError(null);
      setLoading(false);
      return;
    }

    // Tentar auto-recuperar perfil se o e-mail estiver em pre_cadastros
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email?.toLowerCase()?.trim();

      if (userEmail) {
        const { data: preData } = await supabase
          .from('pre_cadastros')
          .select('*')
          .ilike('email', userEmail)
          .maybeSingle();

        if (preData) {
          const { data: newProfile } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              name: preData.name || session.user?.user_metadata?.name || session.user?.user_metadata?.full_name || userEmail.split('@')[0],
              email: session.user.email,
              role: preData.role || 'volunteer',
              phone: preData.phone || null,
              active: true
            })
            .select()
            .single();

          if (newProfile) {
            setProfile(newProfile);
            setAuthError(null);
            setLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.error("Erro ao auto-recuperar perfil:", err);
    }

    // Sessão existe mas não há perfil nem pré-cadastro = e-mail não autorizado
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setAuthError('E-mail não autorizado. Solicite acesso à administração da Casa.');
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard'
      }
    });
  };

  const signUpWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + '/dashboard'
      }
    });
    return { data, error };
  };

  const signInWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  };

  const sendPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session, profile, loading, authError,
      signInWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordReset,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
