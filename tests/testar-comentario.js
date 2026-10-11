require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function comentarComoTeste() {
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'teste2@gmail.com',
    password: process.env.TESTE_SENHA_CONTA2,
  });
  if (loginError) { console.log('erro no login:', loginError.message); return; }

  const { error } = await supabase.from('comentarios').insert({
    post_id: 10,
    autor_id: loginData.user.id,
    texto: 'comentário de teste, vindo do script!',
  });

  if (error) { console.log('erro ao comentar:', error.message); return; }

    await supabase.from('notificacoes').insert({
    usuario_id: '94390f2d-f05d-4f49-a77a-008cc7a61396',
    tipo: 'comentario',
    titulo: 'Novo comentário no seu post',
    subtitulo: 'comentário de teste, vindo do script!',
    post_id: 10,
  });

  console.log('comentário e notificação criados!');
}

comentarComoTeste();