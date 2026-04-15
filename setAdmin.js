import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oqsoxkfbnacpvoxckjks.supabase.co';
const supabaseKey = 'sb_publishable_UthanSHpfvH2Lm283s6CXQ_xaDe-UYA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setAdmin() {
  const email = 'delarco.ada@gmail.com';
  console.log(`Buscando perfil para: ${email}`);
  
  let { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', email)
    .single();

  if (error && error.code !== 'PGRST116') {
      console.error("Erro ao buscar profile", error);
  }

  if (profile) {
     console.log(`Perfil encontrado. Alterando role para admin...`);
     const { error: updateError } = await supabase
       .from('profiles')
       .update({ role: 'admin' })
       .eq('id', profile.id);
     
     if (updateError) {
         console.error("Erro ao atualizar profile (Possível falha de RLS devido a chave anônima)", updateError);
     } else {
         console.log("Sucesso! Usuário atualizado para Admin na tabela profiles.");
     }
  } else {
      console.log("Usuário não encontrado na tabela profiles.");
  }
}

setAdmin();
