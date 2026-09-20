require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function simularVisita() {
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'teste2@gmail.com',
    password: '12345',
  });
  if (loginError) { console.log('erro no login:', loginError.message); return; }

  const SEU_ID_REAL = '94390f2d-f05d-4f49-a77a-008cc7a61396';

  const { error } = await supabase.from('visitas').insert({
    visitante_id: loginData.user.id,
    visitado_id: SEU_ID_REAL,
  });

  console.log(error ? 'erro: ' + error.message : 'visita registrada com sucesso!');
}

simularVisita();