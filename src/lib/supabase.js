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
    const { data } = await supabase
      .from('atividades')
      .select('*')
      .order('day_of_week', { ascending: true });
    return data || [];
  },

  // Buscar atividade confirmada pelo voluntário hoje (via confirmação na Agenda)
  getTodayActivity: async (userId) => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    const { data } = await supabase
      .from('presencas')
      .select('id, atividades(*)')
      .eq('user_id', userId)
      .gte('checkin_time', startOfDay)
      .lt('checkin_time', endOfDay)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    // Retorna os dados da atividade + presenca_id para permitir cancelamento
    return { presenca_id: data.id, ...data.atividades };
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
