require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY
);

async function cadastrar() {
  const { data, error } = await supabase.auth.signUp({
    email: 'alinemelanski10@gmail.com',
    password: 'umaSenhaForte123',
  });

  if (error) {
    console.log("deu erro:", error.message);
  } else {
    console.log("cadastrado! id do usuário:", data.user.id);
  }
}

cadastrar();