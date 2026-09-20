require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY
);

async function logarEPostar() {
  // login de novo (cada script roda separado, então precisa logar toda vez por enquanto)
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'alinemelanski10@gmail.com',
    password: 'umaSenhaForte123',
  });
  if (loginError) { console.log("erro no login:", loginError.message); return; }

  // criar o post, usando o id de quem logou como autor
  const { data, error } = await supabase
    .from('posts')
    .insert({
      autor_id: loginData.user.id,
      texto: 'meu primeiro post de verdade, salvo no banco!',
      tipo: 'Assunto',
      privado: false,
    })
    .select();

  if (error) {
    console.log("erro ao postar:", error.message);
  } else {
    console.log("post criado:", data);
  }
}

logarEPostar();