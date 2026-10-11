require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY
);

async function cadastrar() {
  const { data, error } = await supabase.auth.signUp({
    email: 'alinemelanski10@gmail.com',
    password: process.env.TESTE_SENHA_PRINCIPAL,
  });

  if (error) {
    console.log("deu erro:", error.message);
  } else {
    console.log("cadastrado! id do usuário:", data.user.id);
  }
}

cadastrar();