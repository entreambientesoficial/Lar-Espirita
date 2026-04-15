import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * SERVIÇOS DE DADOS REAIS
 */
export const dataService = {
  // Buscar agenda completa
  getAgenda: async () => {
    const { data, error } = await supabase
      .from('atividades')
      .select('*')
      .order('day_of_week', { ascending: true });
    return data || [];
  },

  // Buscar atividade de hoje para o voluntário
  getTodayActivity: async (userId) => {
    // Busca a atividade que condiz com o dia da semana atual
    const today = new Date().getDay(); // 0 (Dom) a 6 (Sáb)
    const { data, error } = await supabase
      .from('atividades')
      .select('*')
      .eq('day_of_week', today)
      .limit(1)
      .single();
    
    return data;
  },

  // Registrar presença
  registerPresence: async (userId, activityId) => {
    const { data, error } = await supabase
      .from('presencas')
      .insert([
        { user_id: userId, atividade_id: activityId }
      ]);
    return { data, error };
  },

  // Escutar presenças em tempo real (para Admin)
  subscribeToPresences: (callback) => {
    return supabase
      .channel('realtime-presencas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'presencas' }, callback)
      .subscribe();
  }
}
