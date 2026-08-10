import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * SERVIÇOS DE DADOS REAIS
 */
export const dataService = {
  // Buscar agenda completa de atividades ativas
  getAgenda: async () => {
    const { data } = await supabase
      .from('atividades')
      .select('*')
      .neq('active', false)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false });
    return data || [];
  },

  // Buscar todas as atividades para administração (regulares e extras)
  getAllActivitiesForAdmin: async () => {
    const { data } = await supabase
      .from('atividades')
      .select('*')
      .order('event_date', { ascending: true, nullsFirst: true })
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false });
    return data || [];
  },

  // Criar nova atividade (regular ou extra)
  createActivity: async (activityData) => {
    const { data, error } = await supabase
      .from('atividades')
      .insert([activityData])
      .select()
      .single();
    return { data, error };
  },

  // Atualizar atividade existente
  updateActivity: async (id, activityData) => {
    const { data, error } = await supabase
      .from('atividades')
      .update(activityData)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  // Ativar/Desativar atividade
  toggleActivityActive: async (id, currentActiveState) => {
    const { data, error } = await supabase
      .from('atividades')
      .update({ active: !currentActiveState })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  // Excluir ou desativar atividade dependendo do histórico em presencas
  deleteActivity: async (id) => {
    // Verifica se há presenças vinculadas
    const { count, error: countErr } = await supabase
      .from('presencas')
      .select('id', { count: 'exact', head: true })
      .eq('atividade_id', id);

    if (countErr) return { error: countErr };

    if (count && count > 0) {
      // Se possui presenças vinculadas: desativa em vez de deletar
      const { data, error } = await supabase
        .from('atividades')
        .update({ active: false })
        .eq('id', id)
        .select()
        .single();
      return { data, deactivated: true, error };
    } else {
      // Sem presenças: exclusão física permitida
      const { error } = await supabase
        .from('atividades')
        .delete()
        .eq('id', id);
      return { deactivated: false, error };
    }
  },

  // Buscar atividade confirmada pelo voluntário hoje (via confirmação na Agenda)
  getTodayActivity: async (userId) => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    const { data } = await supabase
      .from('presencas')
      .select('id, qr_checkin, atividades(*)')
      .eq('user_id', userId)
      .gte('checkin_time', startOfDay)
      .lt('checkin_time', endOfDay)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    // Retorna dados da atividade + presenca_id e qr_checkin para controle de UI
    return { presenca_id: data.id, qr_checkin: data.qr_checkin, ...data.atividades };
  },

  // Buscar configurações de geolocalização e raio da Casa
  getCasaConfig: async () => {
    const { data, error } = await supabase
      .from('casa_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) {
      return { latitude: null, longitude: null, raio_metros: 100, janela_checkin_minutos: 30 };
    }
    return data;
  },

  // Atualizar configurações da Casa (admin)
  updateCasaConfig: async (configData) => {
    const { data, error } = await supabase
      .from('casa_config')
      .upsert([
        {
          id: 1,
          latitude: configData.latitude,
          longitude: configData.longitude,
          raio_metros: configData.raio_metros || 100,
          janela_checkin_minutos: configData.janela_checkin_minutos || 30,
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();
    return { data, error };
  },

  // Executar Check-in obrigatoriamente via RPC server-side (sem fallback client-side)
  realizarCheckin: async ({ atividadeId, method, lat = null, lng = null, accuracy = null }) => {
    const { data, error } = await supabase.rpc('realizar_checkin', {
      p_atividade_id: atividadeId,
      p_method: method,
      p_lat: lat,
      p_lng: lng,
      p_accuracy: accuracy
    });

    if (error) {
      console.error("Erro na RPC realizar_checkin:", error);
      return {
        success: false,
        rpcError: true,
        message: 'O serviço de check-in por geolocalização está indisponível no momento. Por favor, utilize o QR Code como método alternativo.'
      };
    }

    return data || { success: false, message: 'Resposta inválida do servidor.' };
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

/**
 * Cálculo da distância Haversine em metros
 */
export const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

