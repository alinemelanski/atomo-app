require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function fazerContaTesteSeguirVoce() {
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'teste2@gmail.com',
    password: process.env.TESTE_SENHA_CONTA2,
  });
  if (loginError) { console.log('erro no login:', loginError.message); return; }

  await supabase.from('usuarios').upsert({
    id: loginData.user.id,
    nome: 'Conta de Teste',
    handle: 'conta_teste',
  });

  const SEU_ID_REAL = '61dfe6bb-2db2-4eb1-83e8-ea71b54d5d3c';

  const { error } = await supabase.from('seguidores').insert({
    seguidor_id: loginData.user.id,
    seguido_id: SEU_ID_REAL,
  });

  console.log(error ? 'erro: ' + error.message : 'pronto! a conta de teste agora segue você.');
}

fazerContaTesteSeguirVoce();