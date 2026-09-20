require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY
);

async function loginECriarPerfil() {
  // 1. login
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'alinemelanski10@gmail.com',
    password: 'umaSenhaForte123',
  });

  if (loginError) {
    console.log("erro no login:", loginError.message);
    return;
  }
  console.log("logado! id:", loginData.user.id);

  // 2. criar a linha do perfil na tabela usuarios, usando o mesmo id
  const { data: perfilData, error: perfilError } = await supabase
    .from('usuarios')
    .insert({
      id: loginData.user.id,
      nome: 'Ana Arte',
      handle: 'ana_art',
    })
    .select();

  if (perfilError) {
    console.log("erro ao criar perfil:", perfilError.message);
  } else {
    console.log("perfil criado:", perfilData);
  }
}

loginECriarPerfil();