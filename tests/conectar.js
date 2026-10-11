require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY
);

async function testarConexao() {
  const { data, error } = await supabase.from('posts').select('*');

  if (error) {
    console.log("deu erro:", error.message);
  } else {
    console.log("conectou! posts encontrados:", data);
  }
}

testarConexao();