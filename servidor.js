require('dotenv').config({ path: './servidor.env' });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// mesma URL e chave publicável (anon) que o front-end já usa — não é segredo,
// é protegida por RLS no banco (só permite INSERT na tabela de lista de espera)
const supabase = createClient(
  'https://wfhikucbygmjeawrfsfq.supabase.co',
  'sb_publishable_Sqnu4JCusHeikELanoyPpQ_M0UCLEeP'
);

// ---------- notificação push externa (manhã/noite) ----------
const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:alinemelanski10@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.log('push não configurado: faltam VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no servidor.env');
}

// cliente com a service role — só usado nas rotas de push, que precisam ler
// e gravar dado de QUALQUER usuário (o RLS normal só deixa cada pessoa mexer
// nos próprios dados, o que não serve pro servidor mandar notificação pra
// todo mundo). NUNCA usar essa chave no front-end.
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient('https://wfhikucbygmjeawrfsfq.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// ---------- upload de avatar (via service role, contorna bug de RLS no INSERT do bucket avatars) ----------
// o client do navegador nao consegue inserir um avatar NOVO no bucket "avatars" -
// existe algum bug nas politicas de RLS do storage que rejeita insert mesmo com
// uma politica corretamente configurada (testado e confirmado com a Aline).
// pra nao depender disso, o upload passa a ser feito aqui no servidor com a
// service role, que ignora RLS - so quem tem o token valido do proprio usuario
// pode subir avatar, e so na propria pasta (usuarioId vem do token, nunca do body).
app.post('/api/upload-avatar', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ erro: 'sem token de autenticacao' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData || !userData.user) {
      return res.status(401).json({ erro: 'token invalido ou expirado' });
    }
    const usuarioId = userData.user.id;

    if (!supabaseAdmin) {
      return res.status(500).json({ erro: 'upload de avatar nao configurado no servidor (falta SUPABASE_SERVICE_ROLE_KEY)' });
    }

    const { imagemBase64, contentType } = req.body || {};
    if (!imagemBase64) return res.status(400).json({ erro: 'imagem faltando' });

    const buffer = Buffer.from(imagemBase64, 'base64');
    // GIF animado como avatar: confere o limite de 3 MB e se o arquivo começa mesmo com "GIF8"
    // (a assinatura que todo GIF tem), porque o contentType vem do navegador e não é confiável.
    if (contentType === 'image/gif') {
      if (buffer.length > 3 * 1024 * 1024) return res.status(400).json({ erro: 'GIF grande demais (máximo 3 MB)' });
      if (buffer.slice(0, 4).toString('latin1') !== 'GIF8') return res.status(400).json({ erro: 'arquivo não é um GIF válido' });
    }
    // o nome fica avatar.jpg mesmo pra GIF: quem manda no formato é o contentType gravado junto,
    // e manter o mesmo nome faz o upsert substituir o avatar antigo (sem sobrar arquivo velho).
    const caminho = `${usuarioId}/avatar.jpg`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(caminho, buffer, { upsert: true, contentType: contentType || 'image/jpeg' });

    if (uploadError) {
      console.log('ERRO UPLOAD AVATAR (servidor):', uploadError);
      return res.status(500).json({ erro: uploadError.message });
    }

    const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(caminho);
    res.json({ url: urlData.publicUrl + '?v=' + Date.now() });
  } catch (e) {
    console.log('ERRO INESPERADO upload-avatar:', e);
    res.status(500).json({ erro: 'erro interno no upload' });
  }
});

app.get('/api/push/chave-publica', (req, res) => {
  res.json({ chave: VAPID_PUBLIC_KEY || null });
});

app.post('/api/push/inscrever', async (req, res) => {
  const { usuarioId, subscription } = req.body || {};
  if (!usuarioId || !subscription || !subscription.endpoint) {
    return res.status(400).json({ erro: 'dados incompletos' });
  }
  if (!supabaseAdmin) return res.status(500).json({ erro: 'push não configurado no servidor' });

  const { error } = await supabaseAdmin.from('push_subscriptions').upsert({
    usuario_id: usuarioId,
    endpoint: subscription.endpoint,
    p256dh: (subscription.keys && subscription.keys.p256dh) || '',
    auth: (subscription.keys && subscription.keys.auth) || '',
  }, { onConflict: 'endpoint' });

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

// dispara UMA notificação de teste na hora, pro próprio usuário logado conferir
// se o push tá chegando no aparelho — não depende de horário nem passa pelas
// checagens de "já mandou hoje" do cron
app.post('/api/push/testar', async (req, res) => {
  const { usuarioId } = req.body || {};
  if (!usuarioId) return res.status(400).json({ erro: 'usuarioId obrigatório' });
  if (!supabaseAdmin || !VAPID_PUBLIC_KEY) return res.status(500).json({ erro: 'push não configurado no servidor' });

  try {
    const enviadas = await enviarPushParaUsuario(usuarioId, 'Teste 🔔', 'Se você tá vendo isso, as notificações push do Átomo estão funcionando!');
    res.json({ ok: true, enviadas });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// dispara push pros eventos do dia a dia (curtida, comentário, novo seguidor,
// mensagem nova). O client chama essa rota logo depois de gravar o evento real
// no Supabase — o título/corpo da notificação sempre vêm de um modelo fixo aqui,
// nunca de texto livre do client, então não dá pra usar isso pra mandar spam.
const MODELOS_NOTIFICACAO_PUSH = {
  curtida: (d) => ({ titulo: '❤️ Nova curtida', corpo: `@${d.de || 'alguém'} curtiu seu post` }),
  comentario: (d) => ({ titulo: '💬 Novo comentário', corpo: `@${d.de || 'alguém'} comentou: "${String(d.texto || '').slice(0, 80)}"` }),
  seguidor: (d) => ({ titulo: '➕ Novo seguidor', corpo: `@${d.de || 'alguém'} começou a te seguir` }),
  mensagem: (d) => ({ titulo: '✉️ Nova mensagem', corpo: `@${d.de || 'alguém'} te mandou uma mensagem` }),
  apoio_abraco: (d) => ({ titulo: '🫂 Alguém te mandou um abraço', corpo: `@${d.de || 'alguém'} te mandou um abraço` }),
  apoio_conselho: (d) => ({ titulo: '💬 Você recebeu um conselho', corpo: `@${d.de || 'alguém'}: "${String(d.texto || '').slice(0, 80)}"` }),
  apoio_musica: (d) => ({ titulo: '🎵 Alguém te mandou uma música', corpo: `@${d.de || 'alguém'} te mandou uma música: "${String(d.texto || '').slice(0, 80)}"` }),
  livro_autoral_aprovado: (d) => ({ titulo: '✅ Seu livro foi aprovado', corpo: `"${d.titulo || 'seu livro'}" já está na estante autoral` }),
  livro_autoral_recusado: (d) => ({ titulo: '📬 Seu livro precisa de ajustes', corpo: `"${d.titulo || 'seu livro'}" foi recusado: ${String(d.motivo || '').slice(0, 100)}` }),
  venda_autoral_vendedor: (d) => ({ titulo: '💰 Você vendeu um livro!', corpo: `"${d.titulo || 'seu livro'}" acabou de ser comprado` }),
  venda_autoral_comprador: (d) => ({ titulo: '✅ Compra confirmada', corpo: `"${d.titulo || 'o livro'}" já está liberado na sua estante` }),
};

app.post('/api/push/notificar', async (req, res) => {
  const { usuarioId, tipo, dados } = req.body || {};
  if (!usuarioId || !tipo) return res.status(400).json({ erro: 'dados incompletos' });
  const modelo = MODELOS_NOTIFICACAO_PUSH[tipo];
  if (!modelo) return res.status(400).json({ erro: 'tipo inválido' });

  try {
    const { titulo, corpo } = modelo(dados || {});
    // só repassa pro service worker o que ele precisa pra montar o link —
    // nunca o texto livre que a pessoa digitou, então continua sem dar pra
    // usar isso pra levar quem clica pra qualquer lugar arbitrário
    const dadosExtra = { tipo, post_id: (dados || {}).post_id || null, ator_id: (dados || {}).ator_id || null };
    const enviadas = await enviarPushParaUsuario(usuarioId, titulo, corpo, dadosExtra);
    res.json({ ok: true, enviadas });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// ============ ESTANTE AUTORAL (marketplace de autor independente) ============
// qualquer leitor publica sem aprovação prévia; o livro fica "em_revisao" até
// passar pela revisão. O banco trava (via trigger) quem pode mudar status/
// motivo_recusa/revisado_em -- só dá pra escrever esses campos com a service
// role, por isso aprovar/recusar/reenviar sempre passam por aqui, nunca por
// escrita direta do client.
const EMAIL_ADMIN_ESTANTE_AUTORAL = process.env.EMAIL_ADMIN_ESTANTE_AUTORAL || 'alinemelanski10@gmail.com';

// pega o usuário a partir do token Bearer que o client manda -- mesmo padrão
// já usado em /api/upload-avatar
async function usuarioDoToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData || !userData.user) return null;
  return userData.user;
}

// ---------- avisar seguidores quando alguém publica um post ----------
// Antes não existia: publicar só gravava o post, e quem seguia nunca ficava sabendo.
// Por que pelo servidor? O banco não deixa um usuário criar notificação pra
// outros à vontade (foi uma brecha que fechamos). Aqui, com a service role,
// o servidor confere tudo antes:
//   1. quem pede é quem diz ser (token de login);
//   2. o post é mesmo dela, é público e é recente (últimos 5 minutos);
//   3. pula seguidor que desligou "Notificações de amigos" (notif_ativado = false);
//   4. no máximo 1 aviso do mesmo autor a cada 30 min pra cada seguidor (anti-spam).
const ANTISPAM_POST_AMIGO_MIN = 30;

// Teste rápido pelo navegador: abrir https://atomo-app.onrender.com/api/notificar-seguidores
// Se aparecer {"ok":true,...} é porque o Render já está com esta versão do servidor.
app.get('/api/notificar-seguidores', (req, res) => {
  res.json({ ok: true, rota: 'notificar-seguidores', admin: !!supabaseAdmin, push: typeof enviarPushParaUsuario === 'function' });
});

app.post('/api/notificar-seguidores', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ erro: 'admin não configurado' });
  try {
    const usuario = await usuarioDoToken(req);
    if (!usuario) return res.status(401).json({ erro: 'precisa estar logado' });

    // o post mais recente e público dessa pessoa, feito agora há pouco.
    // 5 minutos (e não 2) porque o Render gratuito "dorme": o 1º pedido depois
    // de um tempo parado pode levar ~1 min só pra servidor acordar.
    const doisMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: post } = await supabaseAdmin
      .from('posts').select('id, texto, privado, clube_id, comunidade_estudo_id')
      .eq('autor_id', usuario.id).eq('privado', false)
      .is('clube_id', null).is('comunidade_estudo_id', null)
      .gte('criado_em', doisMinAtras)
      .order('criado_em', { ascending: false }).limit(1).maybeSingle();
    if (!post) return res.json({ ok: true, avisados: 0, motivo: 'nenhum post público recente' });

    const { data: autor } = await supabaseAdmin.from('usuarios').select('handle').eq('id', usuario.id).maybeSingle();
    const handle = autor ? autor.handle : 'alguém';

    // quem segue o autor
    const { data: seg } = await supabaseAdmin.from('seguidores').select('seguidor_id').eq('seguido_id', usuario.id);
    let ids = [...new Set((seg || []).map(s => s.seguidor_id))].filter(id => id !== usuario.id);
    if (!ids.length) return res.json({ ok: true, avisados: 0 });

    // tira quem desligou os avisos
    const { data: prefs } = await supabaseAdmin.from('usuarios').select('id, notif_ativado').in('id', ids);
    const desligados = new Set((prefs || []).filter(p => p.notif_ativado === false).map(p => p.id));
    ids = ids.filter(id => !desligados.has(id));

    // anti-spam: tira quem já recebeu aviso desse autor nos últimos 30 min
    const limite = new Date(Date.now() - ANTISPAM_POST_AMIGO_MIN * 60 * 1000).toISOString();
    const { data: recentes } = await supabaseAdmin.from('notificacoes').select('usuario_id')
      .eq('ator_id', usuario.id).eq('tipo', 'post_amigo').gte('criado_em', limite).in('usuario_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    const jaAvisados = new Set((recentes || []).map(r => r.usuario_id));
    ids = ids.filter(id => !jaAvisados.has(id));
    if (!ids.length) return res.json({ ok: true, avisados: 0 });

    const trecho = (post.texto || '').replace(/\s+/g, ' ').slice(0, 60);
    const { error } = await supabaseAdmin.from('notificacoes').insert(ids.map(id => ({
      usuario_id: id, tipo: 'post_amigo', titulo: `@${handle} postou`, subtitulo: trecho, post_id: post.id, ator_id: usuario.id,
    })));
    if (error) return res.status(500).json({ erro: error.message });

    // push pro celular, um por um (sem esperar terminar pra responder o app)
    ids.forEach(id => enviarPushParaUsuario(id, `@${handle} postou`, trecho || 'tem post novo no Átomo', { tipo: 'post_amigo', post_id: post.id, ator_id: usuario.id }).catch(() => {}));
    res.json({ ok: true, avisados: ids.length });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

app.post('/api/estante-autoral/reenviar', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ erro: 'estante autoral não configurada no servidor (falta SUPABASE_SERVICE_ROLE_KEY)' });
  const usuario = await usuarioDoToken(req);
  if (!usuario) return res.status(401).json({ erro: 'token inválido ou expirado' });

  const { livroId } = req.body || {};
  if (!livroId) return res.status(400).json({ erro: 'faltou livroId' });

  const { data: livro, error: erroLivro } = await supabaseAdmin.from('livros_autorais').select('autor_id, status').eq('id', livroId).maybeSingle();
  if (erroLivro || !livro) return res.status(404).json({ erro: 'livro não encontrado' });
  if (livro.autor_id !== usuario.id) return res.status(403).json({ erro: 'esse livro não é seu' });
  if (livro.status !== 'recusado') return res.status(400).json({ erro: 'só dá pra reenviar um livro recusado' });

  const { error } = await supabaseAdmin.from('livros_autorais')
    .update({ status: 'em_revisao', motivo_recusa: null, revisado_em: null }).eq('id', livroId);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

app.post('/api/estante-autoral/revisar', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ erro: 'estante autoral não configurada no servidor (falta SUPABASE_SERVICE_ROLE_KEY)' });
  const usuario = await usuarioDoToken(req);
  if (!usuario) return res.status(401).json({ erro: 'token inválido ou expirado' });
  if ((usuario.email || '').toLowerCase() !== EMAIL_ADMIN_ESTANTE_AUTORAL.toLowerCase()) {
    return res.status(403).json({ erro: 'só quem revisa a estante autoral pode fazer isso' });
  }

  const { livroId, aprovado, motivo } = req.body || {};
  if (!livroId) return res.status(400).json({ erro: 'faltou livroId' });
  if (!aprovado && !(motivo || '').trim()) return res.status(400).json({ erro: 'recusar exige um motivo escrito' });

  const { data: livro, error: erroLivro } = await supabaseAdmin.from('livros_autorais').select('autor_id, titulo').eq('id', livroId).maybeSingle();
  if (erroLivro || !livro) return res.status(404).json({ erro: 'livro não encontrado' });

  const patch = aprovado
    ? { status: 'aprovado', motivo_recusa: null, revisado_em: new Date().toISOString() }
    : { status: 'recusado', motivo_recusa: (motivo || '').trim(), revisado_em: new Date().toISOString() };

  const { error } = await supabaseAdmin.from('livros_autorais').update(patch).eq('id', livroId);
  if (error) return res.status(500).json({ erro: error.message });

  enviarPushParaUsuario(
    livro.autor_id,
    ...(aprovado
      ? [MODELOS_NOTIFICACAO_PUSH.livro_autoral_aprovado({ titulo: livro.titulo }).titulo, MODELOS_NOTIFICACAO_PUSH.livro_autoral_aprovado({ titulo: livro.titulo }).corpo]
      : [MODELOS_NOTIFICACAO_PUSH.livro_autoral_recusado({ titulo: livro.titulo, motivo }).titulo, MODELOS_NOTIFICACAO_PUSH.livro_autoral_recusado({ titulo: livro.titulo, motivo }).corpo]),
    { tipo: aprovado ? 'livro_autoral_aprovado' : 'livro_autoral_recusado' }
  ).catch(() => {});

  res.json({ ok: true });
});

// compra com split via Asaas -- checkout hospedado pelo próprio Asaas (o
// comprador preenche CPF/cartão/Pix LÁ, nunca no nosso app), com split de
// 100% pro wallet da autora/autor (sem taxa de plataforma pra gente; a taxa
// do próprio Asaas já sai da parte dela/dele). A venda só vira 'pago' quando
// o webhook confirmar -- nunca antes, nunca só pela resposta do checkout.
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_API_BASE = process.env.ASAAS_API_BASE || 'https://api.asaas.com/v3';
// token nosso (nada a ver com a API key do Asaas) que o Asaas devolve em todo
// webhook no header "asaas-access-token" -- é assim que a gente confirma que
// a notificação é real e não de qualquer um batendo nessa URL. Gerar com
// algo tipo `openssl rand -hex 32` e colar aqui E em /configurar-webhook.
const ASAAS_WEBHOOK_AUTH_TOKEN = process.env.ASAAS_WEBHOOK_AUTH_TOKEN || '';
const FRONT_BASE_URL = process.env.FRONT_BASE_URL || 'https://atomoapp.netlify.app';

app.post('/api/estante-autoral/comprar', async (req, res) => {
  if (!ASAAS_API_KEY) return res.status(503).json({ erro: 'pagamento ainda não configurado' });
  if (!supabaseAdmin) return res.status(500).json({ erro: 'estante autoral não configurada no servidor' });
  const usuario = await usuarioDoToken(req);
  if (!usuario) return res.status(401).json({ erro: 'token inválido ou expirado' });

  const { livroId } = req.body || {};
  if (!livroId) return res.status(400).json({ erro: 'faltou livroId' });

  const { data: livro, error: erroLivro } = await supabaseAdmin.from('livros_autorais').select('*').eq('id', livroId).eq('status', 'aprovado').maybeSingle();
  if (erroLivro || !livro) return res.status(404).json({ erro: 'livro não encontrado' });
  if (livro.autor_id === usuario.id) return res.status(400).json({ erro: 'você não pode comprar o próprio livro' });

  const { data: autor, error: erroAutor } = await supabaseAdmin.from('usuarios').select('asaas_wallet_id').eq('id', livro.autor_id).maybeSingle();
  if (erroAutor || !autor || !autor.asaas_wallet_id) {
    return res.status(400).json({ erro: 'a pessoa que publicou esse livro ainda não configurou como recebe o pagamento' });
  }

  const { data: vendaPaga } = await supabaseAdmin.from('vendas_autorais').select('id').eq('livro_id', livroId).eq('comprador_id', usuario.id).eq('status', 'pago').maybeSingle();
  if (vendaPaga) return res.status(400).json({ erro: 'você já comprou esse livro' });

  const { data: vendaNova, error: erroVenda } = await supabaseAdmin.from('vendas_autorais').insert({
    livro_id: livroId, comprador_id: usuario.id, autor_id: livro.autor_id, preco_centavos: livro.preco_centavos, status: 'pendente',
  }).select().single();
  if (erroVenda) return res.status(500).json({ erro: erroVenda.message });

  try {
    const respCheckout = await fetch(`${ASAAS_API_BASE}/checkouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        billingTypes: ['PIX', 'CREDIT_CARD'],
        chargeTypes: ['DETACHED'],
        minutesToExpire: 60,
        callback: {
          successUrl: `${FRONT_BASE_URL}/?compra=sucesso`,
          cancelUrl: `${FRONT_BASE_URL}/?compra=cancelada`,
          expiredUrl: `${FRONT_BASE_URL}/?compra=expirada`,
        },
        items: [{ name: String(livro.titulo).slice(0, 100), description: 'Livro digital — Estante Autoral Átomo', quantity: 1, value: livro.preco_centavos / 100 }],
        splits: [{ walletId: autor.asaas_wallet_id, percentualValue: 100 }],
        externalReference: String(vendaNova.id),
      }),
    });
    const dadosCheckout = await respCheckout.json();
    if (!respCheckout.ok) {
      console.log('erro ao criar checkout Asaas:', respCheckout.status, dadosCheckout);
      await supabaseAdmin.from('vendas_autorais').update({ status: 'cancelado' }).eq('id', vendaNova.id);
      return res.status(500).json({ erro: (dadosCheckout.errors && dadosCheckout.errors[0] && dadosCheckout.errors[0].description) || 'não consegui criar a cobrança' });
    }

    await supabaseAdmin.from('vendas_autorais').update({ asaas_payment_id: dadosCheckout.id }).eq('id', vendaNova.id);
    res.json({ checkoutUrl: dadosCheckout.link });
  } catch (erro) {
    console.log('erro inesperado comprar estante autoral:', erro.message);
    await supabaseAdmin.from('vendas_autorais').update({ status: 'cancelado' }).eq('id', vendaNova.id);
    res.status(500).json({ erro: 'não consegui processar a compra agora' });
  }
});

// Asaas manda aqui quando um checkout é pago. Responde 200 rápido (é o que o
// Asaas exige pra não ficar reentregando) e só DEPOIS processa. Confere o
// header asaas-access-token antes de confiar em qualquer coisa do corpo --
// sem isso, qualquer um que descobrisse essa URL poderia fingir uma venda.
app.post('/api/estante-autoral/webhook-asaas', async (req, res) => {
  const tokenRecebido = req.headers['asaas-access-token'] || '';
  if (!ASAAS_WEBHOOK_AUTH_TOKEN || tokenRecebido !== ASAAS_WEBHOOK_AUTH_TOKEN) {
    console.log('webhook Asaas com token inválido ou não configurado');
    return res.status(401).end();
  }
  res.status(200).end();

  try {
    if (!supabaseAdmin) return;
    const evento = req.body || {};
    const eventosQueConfirmamPagamento = ['CHECKOUT_PAID', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
    if (!eventosQueConfirmamPagamento.includes(evento.event)) return;

    const dadosPagamento = evento.payment || evento.checkout || {};
    const vendaId = dadosPagamento.externalReference;
    if (!vendaId) return;

    const { data: venda } = await supabaseAdmin.from('vendas_autorais').select('*').eq('id', vendaId).maybeSingle();
    if (!venda || venda.status === 'pago') return; // já processado (entrega "at least once") ou venda não existe

    await supabaseAdmin.from('vendas_autorais').update({
      status: 'pago', pago_em: new Date().toISOString(), asaas_payment_id: dadosPagamento.id || venda.asaas_payment_id,
    }).eq('id', venda.id);

    const { data: livro } = await supabaseAdmin.from('livros_autorais').select('titulo').eq('id', venda.livro_id).maybeSingle();
    const dadosNotificacao = { titulo: livro ? livro.titulo : null };
    const modeloVendedor = MODELOS_NOTIFICACAO_PUSH.venda_autoral_vendedor(dadosNotificacao);
    const modeloComprador = MODELOS_NOTIFICACAO_PUSH.venda_autoral_comprador(dadosNotificacao);
    enviarPushParaUsuario(venda.autor_id, modeloVendedor.titulo, modeloVendedor.corpo, { tipo: 'venda_autoral_vendedor' }).catch(() => {});
    enviarPushParaUsuario(venda.comprador_id, modeloComprador.titulo, modeloComprador.corpo, { tipo: 'venda_autoral_comprador' }).catch(() => {});
  } catch (erro) {
    console.log('erro processando webhook Asaas:', erro.message);
  }
});

// link assinado (expira em 1h) pro epub -- só pra quem comprou (ou é a
// própria autora/autor). Nunca serve o arquivo público direto.
// Grava a capa de um livro autoral que foi enviado SEM capa (o app tira a capa
// de dentro do próprio epub e manda o link aqui). Pode: quem escreveu o livro
// ou a conta que revisa a Loja. Por segurança, só aceita link de imagem do
// NOSSO storage (midia-posts) — ninguém consegue apontar a capa pra outro site.
app.post('/api/estante-autoral/capa', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ erro: 'não configurado' });
  const usuario = await usuarioDoToken(req);
  if (!usuario) return res.status(401).json({ erro: 'token inválido ou expirado' });
  const { livroId, capaUrl } = req.body || {};
  if (!livroId || !capaUrl) return res.status(400).json({ erro: 'faltou livroId ou capaUrl' });
  if (!String(capaUrl).startsWith('https://wfhikucbygmjeawrfsfq.supabase.co/storage/v1/object/public/midia-posts/')) {
    return res.status(400).json({ erro: 'capa precisa estar no storage do app' });
  }
  const { data: livro } = await supabaseAdmin.from('livros_autorais').select('autor_id').eq('id', livroId).maybeSingle();
  if (!livro) return res.status(404).json({ erro: 'livro não encontrado' });
  // capa também é só do AUTOR (mesma regra da rota /editar)
  if (livro.autor_id !== usuario.id) return res.status(403).json({ erro: 'só quem escreveu o livro pode mudar a capa' });
  const { error } = await supabaseAdmin.from('livros_autorais').update({ capa_url: capaUrl }).eq('id', livroId);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

// Editar livro da Loja: SÓ o autor que enviou o livro, e só SINOPSE, CATEGORIA e CAPA.
// Título, preço e o arquivo continuam travados (mudar isso seria outro livro).
const CATEGORIAS_LOJA = ['Romance', 'Fantasia', 'Ficção científica', 'Suspense e mistério', 'Terror', 'Poesia',
  'Contos e crônicas', 'Jovem adulto', 'LGBT+', 'Infantil', 'Biografia e memórias', 'Autoajuda', 'Não ficção', 'HQ e mangá', 'Outros'];
app.post('/api/estante-autoral/editar', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ erro: 'não configurado' });
  const usuario = await usuarioDoToken(req);
  if (!usuario) return res.status(401).json({ erro: 'token inválido ou expirado' });
  const { livroId, descricao, categoria, capaUrl } = req.body || {};
  if (!livroId) return res.status(400).json({ erro: 'faltou livroId' });

  const patch = {};
  if (descricao !== undefined) {
    const texto = String(descricao || '').trim();
    if (texto.length > 3000) return res.status(400).json({ erro: 'a sinopse pode ter até 3000 letras' });
    patch.descricao = texto || null;
  }
  if (categoria !== undefined) {
    // até 2 categorias, guardadas juntas separadas por "|" (ex.: "Romance|LGBT+")
    const lista = [...new Set(String(categoria || '').split('|').map((c) => c.trim()).filter(Boolean))];
    if (!lista.length || lista.length > 2 || !lista.every((c) => CATEGORIAS_LOJA.includes(c))) {
      return res.status(400).json({ erro: 'escolha de 1 a 2 categorias da lista' });
    }
    patch.categoria = lista.join('|');
  }
  if (capaUrl) {
    if (!String(capaUrl).startsWith('https://wfhikucbygmjeawrfsfq.supabase.co/storage/v1/object/public/midia-posts/')) {
      return res.status(400).json({ erro: 'capa precisa estar no storage do app' });
    }
    patch.capa_url = capaUrl;
  }
  if (!Object.keys(patch).length) return res.status(400).json({ erro: 'nada pra mudar' });

  const { data: livro } = await supabaseAdmin.from('livros_autorais').select('autor_id').eq('id', livroId).maybeSingle();
  if (!livro) return res.status(404).json({ erro: 'livro não encontrado' });
  // só o AUTOR que enviou o livro edita — nem a conta admin passa daqui
  if (livro.autor_id !== usuario.id) return res.status(403).json({ erro: 'só quem escreveu o livro pode editar' });

  const { error } = await supabaseAdmin.from('livros_autorais').update(patch).eq('id', livroId);
  if (error) return res.status(500).json({ erro: /categoria/.test(error.message) ? 'falta rodar o SQL sql_pendente_loja_categoria.sql' : error.message });
  res.json({ ok: true });
});

app.post('/api/estante-autoral/arquivo', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ erro: 'não configurado' });
  const usuario = await usuarioDoToken(req);
  if (!usuario) return res.status(401).json({ erro: 'token inválido ou expirado' });

  const { livroId } = req.body || {};
  if (!livroId) return res.status(400).json({ erro: 'faltou livroId' });

  const { data: livro } = await supabaseAdmin.from('livros_autorais').select('autor_id, arquivo_path').eq('id', livroId).maybeSingle();
  if (!livro || !livro.arquivo_path) return res.status(404).json({ erro: 'livro não encontrado' });

  let podeBaixar = livro.autor_id === usuario.id
    || (usuario.email || '').toLowerCase() === EMAIL_ADMIN_ESTANTE_AUTORAL.toLowerCase(); // quem revisa precisa ler o livro
  if (!podeBaixar) {
    const { data: venda } = await supabaseAdmin.from('vendas_autorais').select('id').eq('livro_id', livroId).eq('comprador_id', usuario.id).eq('status', 'pago').maybeSingle();
    podeBaixar = !!venda;
  }
  if (!podeBaixar) return res.status(403).json({ erro: 'você ainda não comprou esse livro' });

  const { data: assinada, error } = await supabaseAdmin.storage.from('estante-autoral-epubs').createSignedUrl(livro.arquivo_path, 3600);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ url: assinada.signedUrl });
});

// configuração de uma vez só: registra nosso webhook no Asaas (ele reaproveita
// se já existir um com essa mesma URL, então rodar de novo não duplica). Só a
// conta administradora pode chamar isso.
// Só responde "já está configurado?" — o app usa pra esconder o botão de
// configurar quando não precisa mais dele.
app.get('/api/estante-autoral/webhook-status', async (req, res) => {
  const usuario = await usuarioDoToken(req);
  if (!usuario || (usuario.email || '').toLowerCase() !== EMAIL_ADMIN_ESTANTE_AUTORAL.toLowerCase()) {
    return res.status(403).json({ erro: 'só a conta administradora' });
  }
  if (!ASAAS_API_KEY) return res.json({ configurado: false });
  try {
    const resp = await fetch(`${ASAAS_API_BASE}/webhooks`, { headers: { 'access_token': ASAAS_API_KEY } });
    const lista = await resp.json();
    const configurado = (lista.data || []).some((w) => /\/api\/estante-autoral\/webhook-asaas$/.test(w.url || '') && /^https:/.test(w.url || ''));
    res.json({ configurado });
  } catch (e) {
    res.json({ configurado: true }); // na dúvida, não fica mostrando o botão
  }
});

app.post('/api/estante-autoral/configurar-webhook', async (req, res) => {
  if (!ASAAS_API_KEY) return res.status(503).json({ erro: 'ASAAS_API_KEY não configurada' });
  if (!ASAAS_WEBHOOK_AUTH_TOKEN) return res.status(500).json({ erro: 'falta ASAAS_WEBHOOK_AUTH_TOKEN no servidor.env/Render' });
  const usuario = await usuarioDoToken(req);
  if (!usuario || (usuario.email || '').toLowerCase() !== EMAIL_ADMIN_ESTANTE_AUTORAL.toLowerCase()) {
    return res.status(403).json({ erro: 'só a conta administradora pode configurar isso' });
  }

  // O Asaas precisa conseguir chamar esse endereço pela internet. "localhost"
  // só existe dentro do seu computador — se registrar ele, os pagamentos nunca
  // seriam confirmados. Então, rodando local, o servidor recusa e explica.
  if (/localhost|127\.0\.0\.1/.test(req.get('host') || '')) {
    return res.status(400).json({ erro: 'configure o webhook pelo app publicado (Render), não pelo localhost — o Asaas não enxerga o seu computador' });
  }
  // atrás do Render o protocolo chega como http; o Asaas exige https
  const urlWebhook = `https://${req.get('host')}/api/estante-autoral/webhook-asaas`;

  try {
    const respLista = await fetch(`${ASAAS_API_BASE}/webhooks`, { headers: { 'access_token': ASAAS_API_KEY } });
    const listaAtual = await respLista.json();
    if (!respLista.ok) return res.status(500).json({ erro: 'não consegui consultar os webhooks existentes' });
    const jaExiste = (listaAtual.data || []).some((w) => w.url === urlWebhook);
    if (jaExiste) return res.json({ ok: true, mensagem: 'webhook já estava configurado' });

    const respCriar = await fetch(`${ASAAS_API_BASE}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        name: 'Átomo - Estante Autoral',
        url: urlWebhook,
        email: EMAIL_ADMIN_ESTANTE_AUTORAL,
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        authToken: ASAAS_WEBHOOK_AUTH_TOKEN,
        sendType: 'SEQUENTIALLY',
        events: ['CHECKOUT_PAID', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'],
      }),
    });
    const dadosCriar = await respCriar.json();
    if (!respCriar.ok) {
      console.log('erro ao criar webhook Asaas:', respCriar.status, dadosCriar);
      return res.status(500).json({ erro: (dadosCriar.errors && dadosCriar.errors[0] && dadosCriar.errors[0].description) || 'erro ao criar webhook' });
    }
    res.json({ ok: true, mensagem: 'webhook configurado' });
  } catch (erro) {
    res.status(500).json({ erro: 'não consegui falar com o Asaas agora' });
  }
});

// ============ SUPORTE E FEEDBACK (caixinha em Configurações) ============
// manda um e-mail pra você (via Resend) toda vez que alguém usa a caixinha de
// sugestão/reclamação em Configurações. Não guarda nada no banco — só repassa.
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FEEDBACK_DESTINO = process.env.EMAIL_FEEDBACK_DESTINO || 'alinemelanski10@gmail.com';

app.post('/api/feedback', async (req, res) => {
  const { mensagem, tipo, usuarioHandle, usuarioEmail } = req.body || {};
  const texto = (mensagem || '').trim();
  if (!texto) return res.status(400).json({ erro: 'escreve uma mensagem antes de mandar' });
  if (texto.length > 2000) return res.status(400).json({ erro: 'mensagem muito longa' });
  if (!RESEND_API_KEY) return res.status(500).json({ erro: 'envio de feedback não configurado no servidor (falta RESEND_API_KEY)' });

  const assunto = `[Átomo] ${tipo === 'reclamacao' ? 'Reclamação' : 'Sugestão'} de @${usuarioHandle || 'alguém'}`;
  const agoraBrasilia = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const corpo = `${texto}\n\n---\nde: @${usuarioHandle || 'desconhecido'}${usuarioEmail ? ' (' + usuarioEmail + ')' : ''}\nenviado em: ${agoraBrasilia}`;

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Átomo <onboarding@resend.dev>',
        to: EMAIL_FEEDBACK_DESTINO,
        subject: assunto,
        text: corpo,
        reply_to: usuarioEmail || undefined,
      }),
    });
    if (!resposta.ok) {
      const erroTxt = await resposta.text();
      console.log('erro ao mandar feedback por e-mail:', erroTxt);
      return res.status(500).json({ erro: 'não consegui enviar agora, tenta de novo' });
    }
    res.json({ ok: true });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// painel de métricas privado — só pra você acompanhar quantos usuários o
// Átomo tem, protegido por senha (ADMIN_SECRET), sem link em nenhum lugar
// do app pros outros usuários
// ---------- registro de erros (o app manda, o servidor grava em erros_app) ----------
// Por que passa pelo servidor e não grava direto do navegador? Porque a tabela
// erros_app fica trancada pro público (RLS sem policy). Só o servidor, com a
// service role, grava — e aqui dá pra limitar tamanho e quantidade, pra
// ninguém usar essa porta pra encher o banco de lixo.
const limiteErrosPorIp = new Map(); // ip -> { janelaInicio, quantidade }
const MAX_ERROS_POR_MINUTO = 30;
function corta(texto, max) { return texto == null ? null : String(texto).slice(0, max); }

async function gravarErro({ mensagem, pilha, tela, origem, navegador, usuarioId }) {
  if (!supabaseAdmin || !mensagem) return;
  try {
    await supabaseAdmin.from('erros_app').insert({
      mensagem: corta(mensagem, 1000),
      pilha: corta(pilha, 4000),
      tela: corta(tela, 120),
      origem: origem || 'front',
      navegador: corta(navegador, 300),
      usuario_id: usuarioId || null,
    });
  } catch (e) { console.log('não consegui gravar erro:', e.message); } // nunca deixa o registro de erro virar outro erro
}

app.post('/api/erros', async (req, res) => {
  // limite simples por IP: no máximo 30 erros por minuto
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?';
  const agora = Date.now();
  const reg = limiteErrosPorIp.get(ip) || { janelaInicio: agora, quantidade: 0 };
  if (agora - reg.janelaInicio > 60000) { reg.janelaInicio = agora; reg.quantidade = 0; }
  reg.quantidade++;
  limiteErrosPorIp.set(ip, reg);
  if (reg.quantidade > MAX_ERROS_POR_MINUTO) return res.status(429).json({ ok: false });

  const { mensagem, pilha, tela, navegador } = req.body || {};
  if (!mensagem) return res.status(400).json({ ok: false });
  // quem estava logado vem do token (nunca do corpo da requisição, que dá pra falsificar)
  let usuarioId = null;
  try { const u = await usuarioDoToken(req); usuarioId = u ? u.id : null; } catch (e) { /* sem login: segue anônimo */ }
  await gravarErro({ mensagem, pilha, tela, origem: 'front', navegador, usuarioId });
  res.json({ ok: true });
});

// erros do próprio servidor também vão pra tabela (origem "back")
process.on('unhandledRejection', (motivo) => {
  console.log('erro não tratado no servidor:', motivo);
  gravarErro({ mensagem: String((motivo && motivo.message) || motivo), pilha: motivo && motivo.stack, origem: 'back', tela: 'servidor' });
});

// painel: lista os erros abertos e marca como resolvido
app.get('/api/admin/erros', async (req, res) => {
  const segredo = req.query.segredo || req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || segredo !== process.env.ADMIN_SECRET) return res.status(401).json({ erro: 'não autorizado' });
  if (!supabaseAdmin) return res.status(500).json({ erro: 'admin não configurado no servidor' });
  const { data, error } = await supabaseAdmin
    .from('erros_app').select('id, criado_em, mensagem, pilha, tela, origem, navegador')
    .eq('resolvido', false).order('criado_em', { ascending: false }).limit(60);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true, erros: data });
});

app.post('/api/admin/erros/resolver', async (req, res) => {
  const segredo = req.query.segredo || req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || segredo !== process.env.ADMIN_SECRET) return res.status(401).json({ erro: 'não autorizado' });
  if (!supabaseAdmin) return res.status(500).json({ erro: 'admin não configurado no servidor' });
  // resolve todos os erros com a MESMA mensagem de uma vez (o mesmo bug costuma aparecer várias vezes)
  const { mensagem } = req.body || {};
  if (!mensagem) return res.status(400).json({ erro: 'faltou a mensagem' });
  const { error } = await supabaseAdmin.from('erros_app').update({ resolvido: true }).eq('mensagem', mensagem).eq('resolvido', false);
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true });
});

app.get('/api/admin/metricas', async (req, res) => {
  const segredo = req.query.segredo || req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || segredo !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }
  if (!supabaseAdmin) return res.status(500).json({ erro: 'admin não configurado no servidor' });

  try {
    const agora = new Date();
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();

    const contar = async (tabela, filtros) => {
      let q = supabaseAdmin.from(tabela).select('*', { count: 'exact', head: true });
      if (filtros) q = filtros(q);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    };

    const [
      totalUsuarios,
      novosHoje,
      novos7dias,
      novos30dias,
      totalPosts,
      posts7dias,
      inscricoesPush,
      notifAtivada,
    ] = await Promise.all([
      contar('usuarios'),
      contar('usuarios', q => q.gte('criado_em', inicioHoje)),
      contar('usuarios', q => q.gte('criado_em', seteDiasAtras)),
      contar('usuarios', q => q.gte('criado_em', trintaDiasAtras)),
      contar('posts'),
      contar('posts', q => q.gte('criado_em', seteDiasAtras)),
      contar('push_subscriptions'),
      contar('usuarios', q => q.eq('notif_ativado', true)),
    ]);

    // usuários ativos = quem postou algo nos últimos 7 dias (contagem de autores únicos)
    const { data: autoresRecentes, error: erroAutores } = await supabaseAdmin
      .from('posts')
      .select('autor_id')
      .gte('criado_em', seteDiasAtras);
    if (erroAutores) throw erroAutores;
    const usuariosAtivos7dias = new Set((autoresRecentes || []).map(p => p.autor_id)).size;

    // uso por dia (tabela eventos_app): quantas pessoas ABRIRAM o app em cada
    // um dos últimos 14 dias, e quantas leram hoje. Se a tabela ainda não foi
    // criada no Supabase, esses números só vêm vazios (o resto do painel funciona).
    let ativosPorDia = null, ativosHoje = null, leitoresHoje = null, errosAbertos = null;
    try {
      const hojeBr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
      const inicio = new Date(Date.now() - 13 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const { data: eventos, error: erroEventos } = await supabaseAdmin
        .from('eventos_app').select('tipo, dia').gte('dia', inicio).limit(20000);
      if (!erroEventos) {
        const porDia = {};
        for (let i = 13; i >= 0; i--) {
          porDia[new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })] = 0;
        }
        (eventos || []).forEach(e => { if (e.tipo === 'abriu_app' && porDia[e.dia] !== undefined) porDia[e.dia]++; });
        ativosPorDia = Object.entries(porDia).map(([dia, n]) => ({ dia, n }));
        ativosHoje = porDia[hojeBr] || 0;
        leitoresHoje = (eventos || []).filter(e => e.tipo === 'leu' && e.dia === hojeBr).length;
      }
      errosAbertos = await contar('erros_app', q => q.eq('resolvido', false));
    } catch (e) { /* tabelas novas ainda não criadas */ }

    res.json({
      ok: true,
      geradoEm: agora.toISOString(),
      totalUsuarios,
      novosHoje,
      novos7dias,
      novos30dias,
      usuariosAtivos7dias,
      totalPosts,
      posts7dias,
      inscricoesPush,
      notifAtivada,
      ativosHoje,
      ativosPorDia,
      leitoresHoje,
      errosAbertos,
    });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// mensagens variadas — a manhã sempre pergunta/convida (sono, sonho), a
// noite é sempre uma reflexão filosófica curta sobre a vida/o dia — nunca
// uma pergunta, nunca um convite pra escrever, só um pensamento pra levar
const MENSAGENS_MANHA = [
  'Bom dia! Como foi seu sono essa noite? 🌙',
  'Lembra do seu sonho de hoje? Anota antes que ele escape.',
  'Dormiu bem essa noite? O Átomo tá esperando por você.',
  'Que tal começar o dia registrando como você acordou?',
  'Bom dia! Um minutinho pra escrever sobre a noite que passou.',
  'Como foi acordar hoje? Guarda esse momento no seu diário.',
  'Que sonho você levou dessa noite? Registra antes que ele se apague.',
  'Bom dia! O que você imagina pro seu dia hoje?',
  'Dormiu bem? Um registro rápido já é um bom começo de dia.',
  'O que passou pela sua cabeça assim que você abriu os olhos hoje?',
  'Bom dia! O que está nos seus planos pra hoje?',
  'Como foi a virada da noite pro dia? Vale anotar essa sensação.',
  'Bom dia! Teve algum sonho que ainda ecoa na sua mente?',
  'O corpo descansou? E a mente, como acordou hoje?',
  'Bom dia! Um novo dia começando — o que ele guarda pra você?',
];
const MENSAGENS_NOITE = [
  'Otimismo é a fé que conduz à realização. — Helen Keller',
  'Nada é permanente neste mundo, nem mesmo os nossos problemas. — Charles Chaplin',
  'Tudo parece impossível até que seja feito. — Nelson Mandela',
  'O futuro depende do que fazemos no presente. — Mahatma Gandhi',
  'No meio da dificuldade encontra-se a oportunidade. — Albert Einstein',
  'Não importa o quão devagar você vá, desde que não pare. — Confúcio',
  'Tudo vale a pena quando a alma não é pequena. — Fernando Pessoa',
  'Mantenha o rosto voltado para o sol, e as sombras ficarão para trás. — Walt Whitman',
  'Onde há vontade, há um caminho. — Provérbio popular',
  'Aprender é a única coisa de que a mente nunca se cansa. — Leonardo da Vinci',
  'Quem tem um porquê para viver pode suportar quase qualquer como. — Friedrich Nietzsche',
  'Enquanto há vida, há esperança. — Cícero',
  'A esperança é o sonho de um homem acordado. — Aristóteles',
  'A vida é curta, mas há sempre tempo para a gentileza. — Ralph Waldo Emerson',
  'Se você pode sonhar, você pode realizar. — Walt Disney',
  'Um pessimista vê a dificuldade em cada oportunidade; um otimista vê a oportunidade em cada dificuldade. — Winston Churchill',
  'Nunca é tarde demais para ser quem você poderia ter sido. — George Eliot',
  'A maior descoberta da minha geração é que o ser humano pode mudar sua vida mudando sua atitude. — William James',
  'Muitos dos fracassos da vida são de pessoas que não perceberam o quão perto do sucesso estavam quando desistiram. — Thomas Edison',
  'Se você pensa que pode, ou pensa que não pode, de qualquer forma você está certo. — Henry Ford',
  'Tem domínio sobre a tua mente, ou ela terá domínio sobre ti. — Marco Aurélio',
  'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis. — Sêneca',
  'A mente é tudo. Aquilo em que você pensa, você se torna. — Buda',
  'A felicidade nunca diminui quando compartilhada. — Buda',
  'Este é o dia que o Senhor fez; regozijemo-nos, e alegremo-nos nele. — Salmos 118:24',
  'O choro pode durar uma noite, mas a alegria vem pela manhã. — Salmos 30:5',
  'O Senhor é a minha luz e a minha salvação. — Salmos 27:1',
  'Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará. — Salmos 37:5',
  'Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum, porque tu estás comigo. — Salmos 23:4',
  'O Senhor é o meu pastor, nada me faltará. — Salmos 23:1',
  'De dia o Senhor mandará a sua benignidade, e de noite a sua canção estará comigo. — Salmos 42:8',
  'Aquietai-vos, e sabei que eu sou Deus. — Salmos 46:10',
];
const MENSAGENS_LEMBRETE_LEITURA = [
  '📚 que tal ler um pouquinho agora?',
  '📖 um capítulo já ajuda a manter o hábito vivo.',
  '📚 hora de voltar pro seu livro.',
  '📖 alguns minutos de leitura fazem bem pro seu dia.',
];
const OFFSET_MANHA_MIN = 15; // "bom dia" chega 15min DEPOIS do horário de acordar de cada um
const OFFSET_NOITE_MIN = 30; // "reflexão do dia" chega 30min ANTES do horário de dormir de cada um
const JANELA_CRON_MIN = 6; // tolerância entre disparos do agendador externo
// escolhe a mensagem do dia por rotação (não por sorteio), pra nunca repetir
// em dias seguidos — cada dia do calendário sempre cai num índice diferente
// do anterior, e só volta a repetir depois de passar por todas as frases
function indiceRotativoDoDia(dataYyyyMmDd, tamanho) {
  const [ano, mes, dia] = dataYyyyMmDd.split('-').map(Number);
  const diasDesdeEpoca = Math.floor(Date.UTC(ano, mes - 1, dia) / 86400000);
  return ((diasDesdeEpoca % tamanho) + tamanho) % tamanho;
}

// ---------- frases da noite: baralho embaralhado ----------
// Problema antigo: a escolha era "dia % tamanho", ou seja, a lista andava em ordem. Como os 8 Salmos
// estavam todos juntos no fim da lista, chegava Salmo 8 dias seguidos.
// Agora: a cada "ciclo" (uma volta completa pela lista) a lista é EMBARALHADA de um jeito novo, e os
// Salmos são espalhados entre as outras frases, sem nunca ficar dois seguidos. Nenhuma frase repete
// antes de todas terem saído.

// gerador de números pseudoaleatórios com semente (mulberry32): a mesma semente sempre dá a mesma
// sequência. É por isso que o servidor reiniciar no Render não muda a frase do dia.
function criarSorteio(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // número entre 0 e 1
  };
}

// embaralha uma cópia da lista (Fisher-Yates: troca cada posição, de trás pra frente, com uma posição sorteada)
function embaralharLista(lista, sorteio) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(sorteio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// monta a ordem de UM ciclo: comuns embaralhadas e "raras" (os Salmos) espalhadas entre elas.
// Divide o ciclo em blocos do mesmo tamanho e põe 1 rara por bloco, nunca na primeira nem na última
// posição do bloco. Assim: nunca duas raras coladas, nem no começo/fim do ciclo (o fim de um ciclo
// encosta no começo do próximo).
function ordemDoCiclo(lista, ehRara, ciclo) {
  const sorteio = criarSorteio(ciclo * 2654435761 + 12345);
  const comuns = embaralharLista(lista.filter(f => !ehRara(f)), sorteio);
  const raras = embaralharLista(lista.filter(ehRara), sorteio);
  if (!raras.length) return comuns;
  const tamBloco = Math.floor(lista.length / raras.length);
  if (tamBloco < 3) return embaralharLista(lista, sorteio); // poucas comuns: embaralha tudo e pronto
  const posicoesRaras = new Set(raras.map((_, i) => i * tamBloco + 1 + Math.floor(sorteio() * (tamBloco - 2))));
  const resultado = [];
  let iComum = 0, iRara = 0;
  for (let pos = 0; pos < lista.length; pos++) {
    resultado.push(posicoesRaras.has(pos) ? raras[iRara++] : comuns[iComum++]);
  }
  return resultado;
}

const ehSalmo = (frase) => / — Salmos \d/.test(frase);

// frase do dia: descobre em que ciclo e em que posição do ciclo estamos e pega a frase certa do baralho
function mensagemEmbaralhadaDoDia(lista, dataYyyyMmDd, ehRara) {
  const [ano, mes, dia] = dataYyyyMmDd.split('-').map(Number);
  const diasDesdeEpoca = Math.floor(Date.UTC(ano, mes - 1, dia) / 86400000);
  const ciclo = Math.floor(diasDesdeEpoca / lista.length);
  const posicao = diasDesdeEpoca % lista.length;
  return ordemDoCiclo(lista, ehRara, ciclo)[posicao];
}

async function enviarPushParaUsuario(usuarioId, titulo, corpo, dadosExtra) {
  // push ainda não configurado no servidor (faltam segredos no .env) — sai sem
  // quebrar quem chamou, pra dar pra chamar essa função de qualquer lugar sem medo
  if (!supabaseAdmin || !VAPID_PUBLIC_KEY) return 0;
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('*').eq('usuario_id', usuarioId);
  let enviadas = 0;
  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        // manda o "tipo"/post_id/ator_id junto do texto — é isso que o service
        // worker usa pra saber pra onde levar quem clicar na notificação (antes
        // não ia nada disso e clicar só abria o app na tela padrão, sem levar
        // a lugar nenhum de verdade)
        JSON.stringify({ titulo, corpo, dados: dadosExtra || null })
      );
      enviadas++;
    } catch (erro) {
      if (erro.statusCode === 404 || erro.statusCode === 410) {
        // inscrição expirou/foi revogada do lado do navegador — limpa do banco
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      } else {
        console.log('erro ao enviar push pra', usuarioId, ':', erro.message);
      }
    }
  }
  return enviadas;
}

// ---------- pergunta do dia (conta oficial @Átomo) ----------
// Toda manhã o bot @Átomo publica UMA pergunta no Feed (a mesma pra todo mundo),
// e a notificação da manhã de cada pessoa passa a trazer essa pergunta no texto.
// Quem toca na notificação cai direto nos comentários do post — responder é
// comentar, e comentar conta como dia escrito na pílula.
//
// A lista é escrita à mão (não gerada por IA), em português e inglês, pra o
// texto sempre soar natural. A ordem é rotativa (indiceRotativoDoDia): só
// repete uma pergunta depois de passar por todas.
// Pra acrescentar: é só colocar mais um { pt, en } no fim da lista.
const PERGUNTAS_DO_DIA = [
  { pt: 'Qual livro você gostaria de ler de novo pela primeira vez?', en: 'Which book would you love to read again for the first time?' },
  { pt: 'Que frase de um livro nunca saiu da sua cabeça?', en: 'What line from a book has never left your mind?' },
  { pt: 'O que você aprendeu essa semana que ninguém te ensinou?', en: 'What did you learn this week that nobody taught you?' },
  { pt: 'Qual personagem você seria, se pudesse escolher?', en: 'If you could be any character, who would you be?' },
  { pt: 'Que cheiro te leva direto pra infância?', en: 'What smell takes you straight back to childhood?' },
  { pt: 'Qual foi a última coisa que te fez rir sozinho?', en: 'What was the last thing that made you laugh alone?' },
  { pt: 'Se o seu dia de ontem fosse um título de livro, qual seria?', en: 'If yesterday were a book title, what would it be?' },
  { pt: 'Que lugar você queria conhecer só por causa de um livro ou filme?', en: 'What place do you want to visit just because of a book or a film?' },
  { pt: 'Qual conselho você daria pra você de cinco anos atrás?', en: 'What advice would you give yourself five years ago?' },
  { pt: 'Que música está tocando na sua cabeça hoje?', en: 'What song is stuck in your head today?' },
  { pt: 'Qual livro você indicaria pra alguém que diz que não gosta de ler?', en: 'What book would you give to someone who says they don\'t like reading?' },
  { pt: 'O que te deixa em paz de verdade?', en: 'What truly brings you peace?' },
  { pt: 'Qual pequena coisa melhorou o seu dia recentemente?', en: 'What small thing made your day better recently?' },
  { pt: 'Que hábito você está tentando construir?', en: 'What habit are you trying to build?' },
  { pt: 'Qual final de livro ou filme você mudaria?', en: 'Which book or movie ending would you change?' },
  { pt: 'Se você escrevesse um livro, sobre o que seria?', en: 'If you wrote a book, what would it be about?' },
  { pt: 'Qual é a sua palavra preferida em português?', en: 'What is your favorite word in your language?' },
  { pt: 'Que pergunta você gostaria que te fizessem mais vezes?', en: 'What question do you wish people asked you more often?' },
  { pt: 'Qual autor você gostaria de conhecer pessoalmente?', en: 'Which author would you like to meet in person?' },
  { pt: 'O que você faria com um dia inteiro só pra você?', en: 'What would you do with a whole day just for yourself?' },
  { pt: 'Qual foi o melhor presente que você já ganhou sem ser coisa?', en: 'What is the best gift you ever got that wasn\'t a thing?' },
  { pt: 'Que livro você abandonou e acha que merece uma segunda chance?', en: 'What book did you give up on that deserves a second chance?' },
  { pt: 'Qual é o seu canto preferido pra ler?', en: 'Where is your favorite spot to read?' },
  { pt: 'O que você queria ter coragem de fazer?', en: 'What do you wish you had the courage to do?' },
  { pt: 'Que história de família você mais gosta de contar?', en: 'What family story do you love telling the most?' },
  { pt: 'Qual livro te fez chorar?', en: 'Which book made you cry?' },
  { pt: 'Como seria o seu dia perfeito de domingo?', en: 'What would your perfect Sunday look like?' },
  { pt: 'O que você aprendeu com alguém mais novo que você?', en: 'What have you learned from someone younger than you?' },
  { pt: 'Qual é a lembrança mais bonita que você tem de uma viagem?', en: 'What is your most beautiful memory from a trip?' },
  { pt: 'Que assunto você conseguiria falar por horas?', en: 'What topic could you talk about for hours?' },
  { pt: 'Qual livro você leu na hora certa da vida?', en: 'Which book did you read at exactly the right time in your life?' },
  { pt: 'O que você gostaria de aprender este ano?', en: 'What would you like to learn this year?' },
  { pt: 'Qual personagem parece muito com alguém que você conhece?', en: 'Which character reminds you a lot of someone you know?' },
  { pt: 'O que te faz sentir em casa?', en: 'What makes you feel at home?' },
  { pt: 'Qual foi a última vez que você fez algo pela primeira vez?', en: 'When was the last time you did something for the first time?' },
  { pt: 'Que poema ou verso você sabe de cor?', en: 'What poem or verse do you know by heart?' },
  { pt: 'Qual é a sua comida de conforto?', en: 'What is your comfort food?' },
  { pt: 'O que você está esperando ansiosamente?', en: 'What are you looking forward to?' },
  { pt: 'Qual livro mudou a forma como você vê o mundo?', en: 'Which book changed the way you see the world?' },
  { pt: 'Que pessoa te inspira e por quê?', en: 'Who inspires you, and why?' },
  { pt: 'Se você pudesse morar dentro de um livro, qual seria?', en: 'If you could live inside a book, which one would it be?' },
  { pt: 'O que você agradece hoje?', en: 'What are you grateful for today?' },
  { pt: 'Qual foi a decisão mais difícil que acabou dando certo?', en: 'What hard decision turned out to be right?' },
  { pt: 'Que filme você assiste toda vez que passa?', en: 'What movie do you watch every time it\'s on?' },
  { pt: 'Qual é o primeiro livro de que você se lembra?', en: 'What is the first book you remember?' },
  { pt: 'O que você faria se não tivesse medo de errar?', en: 'What would you do if you weren\'t afraid of failing?' },
  { pt: 'Que som você acha bonito?', en: 'What sound do you find beautiful?' },
  { pt: 'Qual clássico você ainda quer ler?', en: 'Which classic do you still want to read?' },
  { pt: 'O que você diria pra quem está começando algo novo?', en: 'What would you tell someone starting something new?' },
  { pt: 'Qual é a sua estação do ano preferida e por quê?', en: 'What is your favorite season, and why?' },
  { pt: 'Que livro você daria de presente sem pensar duas vezes?', en: 'What book would you gift without thinking twice?' },
  { pt: 'O que te tira da cama nos dias difíceis?', en: 'What gets you out of bed on hard days?' },
  { pt: 'Qual cena de livro você gostaria de ver num filme?', en: 'Which book scene would you love to see in a film?' },
  { pt: 'Que tradição você quer manter pra sempre?', en: 'Which tradition do you want to keep forever?' },
  { pt: 'O que você está lendo agora e por que escolheu esse livro?', en: 'What are you reading now, and why did you pick it?' },
  { pt: 'Qual foi a melhor conversa que você teve recentemente?', en: 'What was the best conversation you had recently?' },
  { pt: 'Que parte de você mudou nos últimos anos?', en: 'Which part of you has changed in the last few years?' },
  { pt: 'Qual livro brasileiro todo mundo deveria ler?', en: 'Which Brazilian book should everyone read?' },
  { pt: 'O que você gostaria de ouvir hoje?', en: 'What would you like to hear today?' },
  { pt: 'Se a sua vida tivesse uma trilha sonora, qual seria a primeira música?', en: 'If your life had a soundtrack, what would the first song be?' }
];

// garante que o post da pergunta de HOJE existe (cria uma vez por dia) e devolve { id, pergunta }.
// Se o cron rodar várias vezes no mesmo dia, ele reaproveita o post já criado.
async function garantirPerguntaDoDia(hojeBrasilia) {
  if (!supabaseAdmin) return null;
  const botId = await buscarIdContaBotAtomo();
  if (!botId) return null;
  const pergunta = PERGUNTAS_DO_DIA[indiceRotativoDoDia(hojeBrasilia, PERGUNTAS_DO_DIA.length)];

  // já postou hoje? (olha o último post desse tipo e compara o dia em Brasília)
  const { data: ultimo } = await supabaseAdmin
    .from('posts').select('id, criado_em')
    .eq('autor_id', botId).eq('tipo', 'Pergunta do dia')
    .order('criado_em', { ascending: false }).limit(1).maybeSingle();
  if (ultimo) {
    const diaDoUltimo = new Date(ultimo.criado_em).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // en-CA = AAAA-MM-DD
    if (diaDoUltimo === hojeBrasilia) return { id: ultimo.id, pergunta };
  }

  const { data: novo, error } = await supabaseAdmin.from('posts').insert({
    autor_id: botId,
    texto: pergunta.pt,
    tipo: 'Pergunta do dia',
    privado: false,
  }).select('id').single();
  if (error) { console.log('pergunta do dia: erro ao postar:', error.message); return null; }
  return { id: novo.id, pergunta };
}

// o app pode pedir a pergunta de hoje (nos dois idiomas) — útil pro inglês
app.get('/api/pergunta-do-dia', (req, res) => {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  res.json(PERGUNTAS_DO_DIA[indiceRotativoDoDia(hoje, PERGUNTAS_DO_DIA.length)]);
});

// chamada por um agendador EXTERNO (o Render free não fica ligado sozinho o
// tempo todo — ver README/instruções) a cada poucos minutos. Protegida por
// segredo compartilhado (CRON_SECRET) pra ninguém de fora disparar notificação.
async function rodarCronNotificacoes(req, res) {
  const segredo = req.query.segredo || req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }
  if (!supabaseAdmin || !VAPID_PUBLIC_KEY) {
    return res.status(500).json({ erro: 'push não configurado no servidor' });
  }

  try {
    const agoraBrasiliaStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const agoraBrasilia = new Date(agoraBrasiliaStr);
    const minutosAgora = agoraBrasilia.getHours() * 60 + agoraBrasilia.getMinutes();
    const y = agoraBrasilia.getFullYear();
    const m = String(agoraBrasilia.getMonth() + 1).padStart(2, '0');
    const d = String(agoraBrasilia.getDate()).padStart(2, '0');
    const hojeBrasilia = `${y}-${m}-${d}`;

    // manha: dispara quando "agora" bate com horario_acordar_min + 15min
    // (ex: acordou 10:00 -> notificação por volta de 10:15)
    const { data: candidatosManha } = await supabaseAdmin
      .from('usuarios')
      .select('id, horario_acordar_min, ultima_notif_manha_data')
      .not('horario_acordar_min', 'is', null)
      .gte('horario_acordar_min', minutosAgora - OFFSET_MANHA_MIN)
      .lt('horario_acordar_min', minutosAgora - OFFSET_MANHA_MIN + JANELA_CRON_MIN);

    const precisamManha = (candidatosManha || []).filter(u => u.ultima_notif_manha_data !== hojeBrasilia);

    // noite: dispara quando "agora" bate com horario_dormir_min - 30min
    // (ex: dorme 23:00 -> reflexão por volta de 22:30) -- por pessoa, não mais
    // um horário fixo igual pra todo mundo
    const { data: candidatosNoite } = await supabaseAdmin
      .from('usuarios')
      .select('id, horario_dormir_min, ultima_notif_noite_data')
      .not('horario_dormir_min', 'is', null)
      .gte('horario_dormir_min', minutosAgora + OFFSET_NOITE_MIN)
      .lt('horario_dormir_min', minutosAgora + OFFSET_NOITE_MIN + JANELA_CRON_MIN);

    const precisamNoite = (candidatosNoite || []).filter(u => u.ultima_notif_noite_data !== hojeBrasilia);

    let totalEnviadas = 0;
    // a partir das 5h o bot já publica a pergunta do dia (uma vez só por dia);
    // assim ela já está no Feed quando o primeiro "bom dia" sair
    const perguntaHoje = (minutosAgora >= 5 * 60 || precisamManha.length) ? await garantirPerguntaDoDia(hojeBrasilia) : null;
    for (const u of precisamManha) {
      if (perguntaHoje) {
        // a notificação da manhã agora É a pergunta do dia; tocar nela abre
        // os comentários do post do @Átomo (tipo 'pergunta_do_dia' → sw.js monta a URL)
        totalEnviadas += await enviarPushParaUsuario(u.id, 'Pergunta do dia', perguntaHoje.pergunta.pt, { tipo: 'pergunta_do_dia', post_id: perguntaHoje.id });
      } else {
        // sem conta do bot (ou erro ao postar): volta pro "bom dia" de antes, pra ninguém ficar sem nada
        const msg = MENSAGENS_MANHA[indiceRotativoDoDia(hojeBrasilia, MENSAGENS_MANHA.length)];
        totalEnviadas += await enviarPushParaUsuario(u.id, 'Bom dia 🌙', msg);
      }
      await supabaseAdmin.from('usuarios').update({ ultima_notif_manha_data: hojeBrasilia }).eq('id', u.id);
    }
    for (const u of precisamNoite) {
      const msg = mensagemEmbaralhadaDoDia(MENSAGENS_NOITE, hojeBrasilia, ehSalmo);
      totalEnviadas += await enviarPushParaUsuario(u.id, 'Reflexão do dia', msg);
      await supabaseAdmin.from('usuarios').update({ ultima_notif_noite_data: hojeBrasilia }).eq('id', u.id);
    }

    // lembretes de itens do checklist (Home) — cada item pode ter um horário
    // próprio escolhido pelo usuário; só avisa quem ainda não marcou como feito
    // e ainda não recebeu o aviso hoje.
    // Antes exigia horario_lembrete_min >= minutosAgora (so pegava o horario
    // "vindo ai"), entao se a pessoa marcasse um horario que ja tinha passado
    // no dia (ou perdesse a janela de 6min por qualquer motivo), o lembrete só
    // disparava no dia seguinte na mesma hora -- podia demorar quase 24h. Agora
    // so olha pra frente ate +6min (não avisa antes da hora) mas NAO tem mais
    // piso pra trás: qualquer horario que ja passou hoje e ainda nao foi
    // avisado dispara na proxima rodada do cron (efeito "atrasado, mas hoje
    // mesmo"), sem interferir em nada do bloco de manha/noite acima, que
    // continua com a logica de sempre.
    const { data: itensLembrete } = await supabaseAdmin
      .from('checklist_itens')
      .select('id, usuario_id, texto, horario_lembrete_min, ultimo_lembrete_data, feito')
      .not('horario_lembrete_min', 'is', null)
      .eq('feito', false)
      .lt('horario_lembrete_min', minutosAgora + JANELA_CRON_MIN);

    const precisamLembrete = (itensLembrete || []).filter(it => it.ultimo_lembrete_data !== hojeBrasilia);

    for (const it of precisamLembrete) {
      totalEnviadas += await enviarPushParaUsuario(it.usuario_id, '✅ Lembrete', it.texto);
      await supabaseAdmin.from('checklist_itens').update({ ultimo_lembrete_data: hojeBrasilia }).eq('id', it.id);
    }

    // lembrete diario de leitura — oferecido pra pessoa logo que ela termina um
    // livro (ver salvarProgressoEpub no front); mesma lógica de janela/piso do
    // lembrete de checklist acima, só que lendo de usuarios em vez de itens.
    const { data: usuariosLembreteLeitura } = await supabaseAdmin
      .from('usuarios')
      .select('id, horario_lembrete_leitura_min, ultimo_lembrete_leitura_data')
      .not('horario_lembrete_leitura_min', 'is', null)
      .lt('horario_lembrete_leitura_min', minutosAgora + JANELA_CRON_MIN);

    const precisamLembreteLeitura = (usuariosLembreteLeitura || []).filter(u => u.ultimo_lembrete_leitura_data !== hojeBrasilia);

    for (const u of precisamLembreteLeitura) {
      const msg = MENSAGENS_LEMBRETE_LEITURA[indiceRotativoDoDia(hojeBrasilia, MENSAGENS_LEMBRETE_LEITURA.length)];
      totalEnviadas += await enviarPushParaUsuario(u.id, 'Lembrete de leitura', msg);
      await supabaseAdmin.from('usuarios').update({ ultimo_lembrete_leitura_data: hojeBrasilia }).eq('id', u.id);
    }

    // "Seu dia" — o texto do resumo agora é montado no próprio app (js/configuracoes.js),
    // na hora em que a pessoa abre a Home. O servidor só avisa, uma vez por dia, na
    // mesma janela da notificação da noite, pra quem registrou ao menos um momento.
    // A linha em resumos_dia (texto vazio) serve só pra não avisar duas vezes.
    let resumosGerados = 0;
    if (precisamNoite.length) {
      const inicioHojeUTC = new Date(Date.UTC(agoraBrasilia.getFullYear(), agoraBrasilia.getMonth(), agoraBrasilia.getDate(), 3, 0, 0));
      const idsNoiteAgora = precisamNoite.map(u => u.id);
      const { data: eventosHoje } = await supabaseAdmin
        .from('humor_eventos')
        .select('usuario_id')
        .in('usuario_id', idsNoiteAgora)
        .gte('criado_em', inicioHojeUTC.toISOString());

      const idsComMomentos = [...new Set((eventosHoje || []).map(e => e.usuario_id))];
      for (const usuarioId of idsComMomentos) {
        const { data: jaAvisou } = await supabaseAdmin
          .from('resumos_dia').select('id').eq('usuario_id', usuarioId).eq('data', hojeBrasilia).maybeSingle();
        if (jaAvisou) continue;
        await supabaseAdmin.from('resumos_dia').insert({ usuario_id: usuarioId, data: hojeBrasilia, texto: '' });
        totalEnviadas += await enviarPushParaUsuario(usuarioId, '📊 Seu dia no Átomo', 'abre o app pra ver como foi o seu dia');
        resumosGerados++;
      }
    }

    res.json({ ok: true, manha: precisamManha.length, noite: precisamNoite.length, lembretes: precisamLembrete.length, resumos: resumosGerados, notificacoesEnviadas: totalEnviadas });
  } catch (erro) {
    console.log('erro no cron de notificações:', erro.message);
    res.status(500).json({ erro: erro.message });
  }
}

// aceita GET e POST — alguns serviços de cron externos (como o cron-job.org
// no plano grátis) só mandam GET por padrão
app.get('/api/cron/notificacoes', rodarCronNotificacoes);
app.post('/api/cron/notificacoes', rodarCronNotificacoes);

app.post('/api/lista-espera', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValido) return res.status(400).json({ erro: 'e-mail inválido' });

  const { error } = await supabase.from('lista_espera').insert({ email });

  if (error) {
    if (error.code === '23505') {
      // e-mail já cadastrado — trata como sucesso, não precisa assustar quem tenta de novo
      return res.json({ ok: true, jaCadastrado: true });
    }
    console.log('erro ao inserir na lista de espera:', error.message);
    return res.status(500).json({ erro: 'não consegui salvar seu e-mail, tenta de novo' });
  }

  res.json({ ok: true });
});

// SEGURANÇA: nunca escrever chave de API no log (nem um pedaço dela) — o log
// fica guardado no Render e qualquer pessoa com acesso ao painel leria a chave.
// Pra conferir se a chave carregou, basta dizer SIM ou NÃO:
console.log('chave TMDB carregada:', process.env.TMDB_API_KEY ? 'sim' : 'NÃO', '| chave TMDB v3:', process.env.TMDB_API_KEY_V3 ? 'sim' : 'NÃO');

app.get('/api/buscar-filme', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });

  const urlCompleta = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY_V3}&query=${encodeURIComponent(termo)}&language=pt-BR`;
  console.log('URL SENDO CHAMADA:', urlCompleta);

  try {
    const resposta = await fetch(urlCompleta);
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar no TMDB' });
  }
});

app.get('/api/filme-trailer', async (req, res) => {
  const filmeId = req.query.id;
  if (!filmeId) return res.status(400).json({ erro: 'faltou o parâmetro id' });

  try {
    const resposta = await fetch(
      `https://api.themoviedb.org/3/movie/${filmeId}/videos?api_key=${process.env.TMDB_API_KEY_V3}&language=pt-BR`
    );
    const dados = await resposta.json();
    const trailer = (dados.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
    res.json({ url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null });
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar trailer' });
  }
});

app.get('/api/buscar-musica', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });

  try {
    const resposta = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(termo)}`);
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar no Deezer' });
  }
});

app.get('/api/buscar-livro', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });

  try {
    const resposta = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(termo)}&key=${process.env.GOOGLE_BOOKS_API_KEY}&maxResults=5`
    );
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar no Google Books' });
  }
});

app.get('/api/filmes-em-cartaz', async (req, res) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const resposta = await fetch(
      `https://api.themoviedb.org/3/movie/now_playing?api_key=${process.env.TMDB_API_KEY_V3}&language=pt-BR&region=BR&page=${pagina}`
    );
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar filmes em cartaz' });
  }
});

// ============ POSTS AUTOMÁTICOS DE SUGESTÃO DE FILME (conta bot @Átomo) ============
// gera 1 sugestão de filme por dia (por gênero do TMDB) e posta como se fosse
// um post normal da conta bot @Átomo, aparecendo no feed de todo mundo, com
// curtir/comentar normalmente. evita repetir filme já sugerido antes.
const BOT_HANDLE_ATOMO = process.env.BOT_HANDLE_ATOMO || 'Átomo';

async function buscarIdContaBotAtomo() {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin.from('usuarios').select('id').ilike('handle', BOT_HANDLE_ATOMO).maybeSingle();
  return data ? data.id : null;
}

async function buscarSugestoesFilmePorGenero(generoId, jaPostadosIds, quantidade) {
  // pega os mais bem avaliados do gênero, com um mínimo de votos pra não cair
  // num filme obscuro com nota 10 e 4 votos só. Busca `quantidade` filmes
  // diferentes (pra post de lista, tipo "3 sugestões de domingo").
  const escolhidos = [];
  for (let pagina = 1; pagina <= 5 && escolhidos.length < quantidade; pagina++) {
    const resposta = await fetch(
      `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY_V3}&language=pt-BR&region=BR&sort_by=vote_average.desc&vote_count.gte=200&with_genres=${generoId}&page=${pagina}`
    );
    const dados = await resposta.json();
    for (const f of (dados.results || [])) {
      if (jaPostadosIds.includes(f.id)) continue;
      if (escolhidos.some(e => e.id === f.id)) continue;
      escolhidos.push(f);
      if (escolhidos.length >= quantidade) break;
    }
  }
  return escolhidos;
}

async function buscarTrailerParaSugestao(filmeId) {
  try {
    const resposta = await fetch(
      `https://api.themoviedb.org/3/movie/${filmeId}/videos?api_key=${process.env.TMDB_API_KEY_V3}&language=pt-BR`
    );
    const dados = await resposta.json();
    const trailer = (dados.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
    return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
  } catch (erro) {
    return null;
  }
}

function gerarLegendaSugestaoFilme(filme, generoLabel) {
  const ano = filme.release_date ? filme.release_date.slice(0, 4) : '';
  const nota = filme.vote_average ? filme.vote_average.toFixed(1) : null;
  let texto = `🎬 sugestão pra hoje: que tal assistir "${filme.title}"${ano ? ' (' + ano + ')' : ''}?`;
  if (generoLabel) texto += ` um dos melhores em ${generoLabel} do momento`;
  if (nota) texto += `, nota ${nota} na crítica`;
  texto += '.';
  if (filme.overview) {
    const sinopseCurta = filme.overview.length > 180 ? filme.overview.slice(0, 177) + '...' : filme.overview;
    texto += `\n\n${sinopseCurta}`;
  }
  return texto;
}

// abertura do post de LISTA varia com o dia da semana (o cron roda TODO dia às
// 21h, não só domingo -- antes ficava fixo em "domingão" mesmo numa terça)
const ABERTURAS_LISTA_FILME_POR_DIA = [
  '🍿 domingão pede sofá, pipoca e um crush novo de cinema', // 0 = domingo
  '🎬 pra amenizar a segunda, um filminho cai bem',          // 1 = segunda
  '🍿 terça também merece sessão de cinema',                 // 2 = terça
  '🎬 meio da semana pede uma pausa com filme bom',          // 3 = quarta
  '🍿 quinta de esquentar pro fim de semana com um filme',   // 4 = quinta
  '🎉 sextou! hora de maratonar',                            // 5 = sexta
  '🍿 sabadão pede sofá, pipoca e um filme bom',             // 6 = sábado
];

// legenda pra post de LISTA (vários filmes no mesmo post) -- a abertura muda
// de acordo com o dia da semana (ver ABERTURAS_LISTA_FILME_POR_DIA acima)
function gerarLegendaListaFilmes(filmes, generoLabel) {
  const agoraBrasiliaStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  const diaSemana = new Date(agoraBrasiliaStr).getDay();
  const abertura = `${ABERTURAS_LISTA_FILME_POR_DIA[diaSemana]} — ${filmes.length} sugestões de ${generoLabel || 'filme'} pra hoje:`;
  const linhas = filmes.map((f, i) => {
    const ano = f.release_date ? f.release_date.slice(0, 4) : '';
    const nota = f.vote_average ? f.vote_average.toFixed(1) : null;
    return `${i + 1}. "${f.title}"${ano ? ' (' + ano + ')' : ''}${nota ? ' — nota ' + nota : ''}`;
  }).join('\n');
  return `${abertura}\n\n${linhas}`;
}

async function postarSugestaoFilmeDoDia(generoId, generoLabel, forcar, quantidade) {
  if (!supabaseAdmin) return { ok: false, motivo: 'supabase admin não configurado' };
  if (!process.env.TMDB_API_KEY_V3) return { ok: false, motivo: 'TMDB não configurado' };

  const botId = await buscarIdContaBotAtomo();
  if (!botId) return { ok: false, motivo: `conta bot "@${BOT_HANDLE_ATOMO}" não encontrada (confira o handle salvo no banco)` };

  const agoraBrasiliaStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  const agoraBrasilia = new Date(agoraBrasiliaStr);
  const hojeBrasilia = `${agoraBrasilia.getFullYear()}-${String(agoraBrasilia.getMonth() + 1).padStart(2, '0')}-${String(agoraBrasilia.getDate()).padStart(2, '0')}`;

  if (!forcar) {
    const { data: botUsuario } = await supabaseAdmin.from('usuarios').select('ultimo_post_filme_data').eq('id', botId).maybeSingle();
    if (botUsuario && botUsuario.ultimo_post_filme_data === hojeBrasilia) {
      return { ok: false, motivo: 'já postou uma sugestão hoje' };
    }
  }

  const { data: postsAnteriores } = await supabaseAdmin
    .from('posts').select('ref_filme_id').eq('autor_id', botId).not('ref_filme_id', 'is', null);
  const jaPostadosIds = (postsAnteriores || []).map(p => Number(p.ref_filme_id)).filter(n => !isNaN(n));

  const filmes = await buscarSugestoesFilmePorGenero(generoId, jaPostadosIds, quantidade || 1);
  if (!filmes.length) return { ok: false, motivo: 'nenhum filme novo encontrado nesse gênero (já sugeriu todos os bons?)' };

  const filmeCapa = filmes[0];
  const trailer = await buscarTrailerParaSugestao(filmeCapa.id);
  const texto = filmes.length > 1
    ? gerarLegendaListaFilmes(filmes, generoLabel)
    : gerarLegendaSugestaoFilme(filmeCapa, generoLabel);

  const { error } = await supabaseAdmin.from('posts').insert({
    autor_id: botId,
    texto,
    tipo: 'Filme',
    privado: false,
    ref_titulo: filmeCapa.title,
    ref_autor: filmeCapa.release_date ? filmeCapa.release_date.slice(0, 4) : null,
    ref_citacao: null,
    ref_trailer: trailer,
    ref_filme_id: filmeCapa.id,
    ref_capa: filmeCapa.poster_path ? `https://image.tmdb.org/t/p/w500${filmeCapa.poster_path}` : null,
  });

  if (error) return { ok: false, motivo: error.message };

  await supabaseAdmin.from('usuarios').update({ ultimo_post_filme_data: hojeBrasilia }).eq('id', botId);

  return { ok: true, filmes: filmes.map(f => f.title) };
}

async function rodarCronSugestaoFilme(req, res) {
  const segredo = req.query.segredo || req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }
  const generoId = req.query.genero || '53'; // 53 = suspense/thriller no TMDB
  const generoLabel = req.query.generoLabel || 'suspense';
  const forcar = req.query.forcar === 'true' || req.query.forcar === '1';
  const quantidade = Math.max(1, Math.min(5, parseInt(req.query.quantidade, 10) || 1));

  const resultado = await postarSugestaoFilmeDoDia(generoId, generoLabel, forcar, quantidade);
  res.json(resultado);
}

app.get('/api/cron/sugestao-filme', rodarCronSugestaoFilme);
app.post('/api/cron/sugestao-filme', rodarCronSugestaoFilme);

// troca 1 filme específico (por título/trecho) dentro do ÚLTIMO post de lista
// que o bot postou, mantendo os outros da lista e a legenda igual — usado
// quando ela não curtiu uma das sugestões (ex: "troca o do Batman")
async function trocarFilmeNoUltimoPost(termoRemover, generoId, generoLabel) {
  if (!supabaseAdmin) return { ok: false, motivo: 'supabase admin não configurado' };
  if (!process.env.TMDB_API_KEY_V3) return { ok: false, motivo: 'TMDB não configurado' };

  const botId = await buscarIdContaBotAtomo();
  if (!botId) return { ok: false, motivo: 'conta bot não encontrada' };

  const { data: ultimoPost } = await supabaseAdmin
    .from('posts').select('id, texto, ref_filme_id')
    .eq('autor_id', botId).eq('tipo', 'Filme')
    .order('criado_em', { ascending: false }).limit(1).maybeSingle();
  if (!ultimoPost) return { ok: false, motivo: 'nenhum post de filme do bot encontrado' };

  const linhas = ultimoPost.texto.split('\n');
  const termoLower = termoRemover.toLowerCase();
  let indice = -1;
  let numeroItem = null;
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/^(\d+)\.\s+"(.+?)"/);
    if (m && m[2].toLowerCase().includes(termoLower)) {
      indice = i;
      numeroItem = m[1];
      break;
    }
  }
  if (indice === -1) return { ok: false, motivo: `não achei nenhum filme com "${termoRemover}" na última lista` };

  const titulosNaLista = linhas
    .map(l => l.match(/^\d+\.\s+"(.+?)"/))
    .filter(Boolean)
    .map(m => m[1].toLowerCase());

  const { data: postsAnteriores } = await supabaseAdmin
    .from('posts').select('ref_filme_id').eq('autor_id', botId).not('ref_filme_id', 'is', null);
  const jaPostadosIds = (postsAnteriores || []).map(p => Number(p.ref_filme_id)).filter(n => !isNaN(n));

  let substituto = null;
  for (let pagina = 1; pagina <= 5 && !substituto; pagina++) {
    const resposta = await fetch(
      `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY_V3}&language=pt-BR&region=BR&sort_by=vote_average.desc&vote_count.gte=200&with_genres=${generoId}&page=${pagina}`
    );
    const dados = await resposta.json();
    for (const f of (dados.results || [])) {
      if (jaPostadosIds.includes(f.id)) continue;
      if (titulosNaLista.includes(f.title.toLowerCase())) continue;
      if (f.title.toLowerCase().includes(termoLower)) continue;
      substituto = f;
      break;
    }
  }
  if (!substituto) return { ok: false, motivo: 'não achei um filme substituto novo nesse gênero' };

  const ano = substituto.release_date ? substituto.release_date.slice(0, 4) : '';
  const nota = substituto.vote_average ? substituto.vote_average.toFixed(1) : null;
  linhas[indice] = `${numeroItem}. "${substituto.title}"${ano ? ' (' + ano + ')' : ''}${nota ? ' — nota ' + nota : ''}`;
  const novoTexto = linhas.join('\n');

  const atualizacao = { texto: novoTexto };
  if (numeroItem === '1') {
    const trailer = await buscarTrailerParaSugestao(substituto.id);
    atualizacao.ref_titulo = substituto.title;
    atualizacao.ref_autor = ano || null;
    atualizacao.ref_trailer = trailer;
    atualizacao.ref_filme_id = substituto.id;
    atualizacao.ref_capa = substituto.poster_path ? `https://image.tmdb.org/t/p/w500${substituto.poster_path}` : null;
  }

  const { error } = await supabaseAdmin.from('posts').update(atualizacao).eq('id', ultimoPost.id);
  if (error) return { ok: false, motivo: error.message };

  return { ok: true, trocado_por: substituto.title };
}

async function rodarCronTrocarFilme(req, res) {
  const segredo = req.query.segredo || req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' });
  }
  const termo = req.query.termo;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro termo (nome do filme a trocar)' });
  const generoId = req.query.genero || '53';
  const generoLabel = req.query.generoLabel || 'suspense';

  const resultado = await trocarFilmeNoUltimoPost(termo, generoId, generoLabel);
  res.json(resultado);
}

app.get('/api/cron/trocar-filme', rodarCronTrocarFilme);
app.post('/api/cron/trocar-filme', rodarCronTrocarFilme);

app.get('/api/musicas-em-alta', async (req, res) => {
  try {
    const resposta = await fetch('https://api.deezer.com/chart/0/tracks?limit=10');
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar músicas em alta' });
  }
});

// busca "radios" (estacoes por estilo, tipo indie, mpb, lo-fi...) no Deezer pelo nome.
// se a busca direta nao achar nada, cai pra lista completa de radios e filtra pelo titulo.
app.get('/api/buscar-radio', async (req, res) => {
  const termo = (req.query.q || '').trim();
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });
  try {
    const respBusca = await fetch(`https://api.deezer.com/search/radio?q=${encodeURIComponent(termo)}`);
    const dadosBusca = await respBusca.json();
    if (dadosBusca && Array.isArray(dadosBusca.data) && dadosBusca.data.length) {
      return res.json(dadosBusca);
    }
    const respLista = await fetch('https://api.deezer.com/radio');
    const dadosLista = await respLista.json();
    const termoBusca = termo.toLowerCase();
    const filtrados = (dadosLista.data || []).filter(r => (r.title || '').toLowerCase().includes(termoBusca));
    res.json({ data: filtrados });
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar rádios no Deezer' });
  }
});

// faixas de uma "radio" (estacao por estilo) especifica do Deezer, pelo id escolhido
app.get('/api/radio-faixas', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ erro: 'faltou o parâmetro id' });
  try {
    const resposta = await fetch(`https://api.deezer.com/radio/${encodeURIComponent(id)}/tracks`);
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar faixas do rádio' });
  }
});

function limparHtmlTumblr(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// heurística de idioma: português x espanhol compartilham muito acento e
// vocabulário, então checar só "tem acento" não distingue os dois (era o bug
// antigo). Aqui a gente pesa sinais que só existem num idioma ou no outro:
// ã/õ/â/ê/ô/ç só existem em português; ñ só existe em espanhol. Depois some
// um empurrãozinho de palavras típicas de cada lado.
function pareceTextoEmPortugues(texto) {
  if (!texto) return 0;
  const t = ' ' + texto.toLowerCase() + ' ';
  let pontos = 0;
  if (/[ãõ]/.test(t)) pontos += 5;
  if (/[âêô]/.test(t)) pontos += 2;
  if (/ç/.test(t)) pontos += 2;
  if (/ñ/.test(t)) pontos -= 6;
  const sinaisPt = [' não ', ' então ', ' também ', ' ainda ', ' você ', ' vocês ', ' muito ',
    ' coisa ', ' com ', ' uma ', ' um ', ' são ', ' isso ', ' fazer ', ' trabalho', ' história',
    ' mãe', ' irmã', 'ção ', 'ções ', ' hoje ', ' aqui '];
  sinaisPt.forEach(p => { if (t.includes(p)) pontos += 1; });
  const sinaisEs = [' el ', ' los ', ' las ', ' una ', ' unos ', ' unas ', ' muy ', ' así ',
    ' cómo ', ' qué ', ' años', ' hacer ', ' cosa ', ' trabajo', ' él ', ' ella ', ' usted',
    ' entonces', ' pero ', ' más ', ' dónde', ' cuándo', ' señor', ' mujer', ' hijo ', ' hija '];
  sinaisEs.forEach(p => { if (t.includes(p)) pontos -= 2; });
  return pontos;
}

app.get('/api/tumblr-tag', async (req, res) => {
  const tag = (req.query.tag || '').trim();
  const variar = req.query.variar === 'true';
  if (!tag) return res.status(400).json({ erro: 'faltou o parâmetro tag' });
  if (!process.env.TUMBLR_API_KEY) {
    console.log('TUMBLR_API_KEY não configurada no servidor.env — Tumblr não vai trazer post nenhum até isso ser adicionado');
    return res.status(500).json({ erro: 'Tumblr não configurado no servidor (falta TUMBLR_API_KEY)' });
  }

  try {
    // npf=true força o Tumblr a devolver os posts no formato novo (blocos de
    // conteúdo), que é o que a gente sabe ler abaixo — sem isso, a API manda
    // o formato clássico (campos como "body"/"caption"/"photos"), que ficava
    // de fora do parser e por isso vinha tudo "sem texto"/sem imagem.
    //
    // quando "variar" está ligado (a tela do Descobrir sem busca do usuário),
    // pula pra um ponto aleatório dos últimos 3 dias da tag em vez de sempre
    // pegar o topo — assim a atualização automática/puxar-pra-atualizar não
    // fica sempre mostrando os mesmos posts "congelados".
    let paramBefore = '';
    if (variar) {
      const agora = Math.floor(Date.now() / 1000);
      const janela = 60 * 60 * 24 * 3;
      const before = agora - Math.floor(Math.random() * janela);
      paramBefore = `&before=${before}`;
    }

    const resposta = await fetch(
      `https://api.tumblr.com/v2/tagged?tag=${encodeURIComponent(tag)}&api_key=${process.env.TUMBLR_API_KEY}&limit=30&npf=true${paramBefore}`
    );
    const dados = await resposta.json();
    let postsBrutos = Array.isArray(dados.response) ? dados.response : [];

    // descarta o que claramente não é português (o texto ainda vai ser
    // extraído de novo dentro do .map() abaixo, mas aqui já dá pra checar o
    // texto cru/legendas pra tirar do páreo posts em espanhol etc. antes de
    // decidir os 15 mais populares — senão um post espanhol popular podia
    // ocupar a vaga de um post em português menos curtido)
    postsBrutos = postsBrutos.filter(p => {
      const pistaTexto = [
        p.summary,
        ...(Array.isArray(p.content) ? p.content.map(b => b.text || b.title || b.description || '') : []),
        p.body, p.caption, p.title,
      ].filter(Boolean).join(' ');
      // limiar mais rígido do que antes (> -4 só descartava o que parecia
      // claramente espanhol) — mas > 2 acabou rejeitando até legenda curta e
      // genuinamente em português sem acento nenhum (ex: "isso é muito bom"
      // só pontua 1). > 0 já exclui o que tem cara de espanhol/neutro sem
      // descartar português comum de legenda curta.
      return pareceTextoEmPortugues(pistaTexto) > 0;
    });

    // prioriza quem tem mais nota (curtida + reblog) — sem piso fixo de nota
    // (uma tag menos movimentada podia zerar os resultados), só pega os mais
    // populares de quem sobrou do filtro de português acima, e ainda
    // embaralha um pouco o topo pra não ficar sempre a mesma ordem
    postsBrutos = postsBrutos
      .slice()
      .sort((a, b) => (b.note_count || 0) - (a.note_count || 0))
      .slice(0, 15);
    for (let i = postsBrutos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [postsBrutos[i], postsBrutos[j]] = [postsBrutos[j], postsBrutos[i]];
    }

    const posts = postsBrutos.map(p => {
      let texto = '';
      let imagemUrl = null;

      const blocos = Array.isArray(p.content) ? p.content : [];
      blocos.forEach(bloco => {
        if (bloco.type === 'text' && bloco.text) {
          texto += (texto ? '\n' : '') + bloco.text;
        }
        if (bloco.type === 'link') {
          const partes = [bloco.title, bloco.description].filter(Boolean).join(' — ');
          if (partes) texto += (texto ? '\n' : '') + partes;
        }
        if (bloco.type === 'image' && !imagemUrl && Array.isArray(bloco.media) && bloco.media[0]) {
          imagemUrl = bloco.media[0].url;
        }
        if (bloco.type === 'video' && !imagemUrl && bloco.poster && bloco.poster[0]) {
          imagemUrl = bloco.poster[0].url;
        }
      });

      // se por algum motivo esse post não veio no formato novo (ex.: alguns
      // reblogs antigos), tenta ler o formato clássico do Tumblr como reserva
      if (!texto && !imagemUrl) {
        if (p.type === 'text') {
          texto = limparHtmlTumblr(p.body) || limparHtmlTumblr(p.title);
        } else if (p.type === 'photo') {
          texto = limparHtmlTumblr(p.caption);
          if (Array.isArray(p.photos) && p.photos[0] && p.photos[0].original_size) {
            imagemUrl = p.photos[0].original_size.url || null;
          }
        } else if (p.type === 'quote') {
          texto = [p.text, p.source ? limparHtmlTumblr(p.source) : ''].filter(Boolean).join(' — ');
        } else if (p.type === 'link') {
          texto = [p.title, p.description ? limparHtmlTumblr(p.description) : ''].filter(Boolean).join(' — ');
        } else if (p.type === 'chat') {
          texto = limparHtmlTumblr(p.body);
        } else if (p.type === 'video') {
          texto = limparHtmlTumblr(p.caption);
        } else if (p.type === 'answer') {
          texto = [p.question, p.answer].filter(Boolean).join(' — ');
        } else if (p.type === 'audio') {
          texto = limparHtmlTumblr(p.caption);
        }
      }

      return {
        id: p.id,
        blogName: p.blog_name || null,
        texto: texto || 'Sem texto neste post.',
        imagemUrl,
        tags: p.tags || [],
        postUrl: p.post_url || null,
        notas: p.note_count || 0,
      };
    });

    res.json({ posts });
  } catch (erro) {
    console.log('erro Tumblr (tagged):', erro.message);
    res.status(500).json({ erro: 'erro ao buscar no tumblr' });
  }
});

// autores brasileiros consagrados, usados como vitrine padrão da aba Livros
// (busca por autor é muito mais confiável pra vir em português do que um
// termo genérico tipo "subject:fiction", que nas APIs de livro devolve
// sobretudo clássicos em inglês mesmo com o filtro de idioma ligado)
const AUTORES_BRASILEIROS_DESTAQUE = [
  'Machado de Assis', 'Clarice Lispector', 'Jorge Amado', 'Guimarães Rosa',
  'Carolina Maria de Jesus', 'Graciliano Ramos', 'Cecília Meireles',
  'Lima Barreto', 'Rachel de Queiroz', 'Conceição Evaristo',
  'Ariano Suassuna', 'Raduan Nassar', 'Chico Buarque', 'Paulo Coelho',
];

// cache em memória da vitrine de livros gratuitos: a primeira pessoa a pedir cada página/busca
// paga o tempo das fontes externas (Open Library, Gutendex, Wikisource...), as seguintes recebem
// a mesma resposta na hora. Só guarda resposta que veio com livros (nunca guarda falha) e some em 15 min.
const CACHE_LIVROS = new Map(); // url -> { quando, corpo }
const CACHE_LIVROS_TTL_MS = 15 * 60 * 1000;
const CACHE_LIVROS_MAX = 300;
app.use('/api/livros-em-destaque', (req, res, next) => {
  const chave = req.originalUrl;
  const guardado = CACHE_LIVROS.get(chave);
  if (guardado && Date.now() - guardado.quando < CACHE_LIVROS_TTL_MS) {
    res.set('X-Cache', 'HIT');
    res.set('Cache-Control', 'public, max-age=300');
    return res.json(guardado.corpo);
  }
  const jsonOriginal = res.json.bind(res);
  res.json = (corpo) => {
    if (res.statusCode === 200 && corpo && Array.isArray(corpo.items) && corpo.items.length) {
      if (CACHE_LIVROS.size >= CACHE_LIVROS_MAX) CACHE_LIVROS.delete(CACHE_LIVROS.keys().next().value);
      CACHE_LIVROS.set(chave, { quando: Date.now(), corpo });
    }
    return jsonOriginal(corpo);
  };
  next();
});

app.get('/api/livros-em-destaque', async (req, res) => {
  // junta 3 fontes de livro numa lista só, cada uma no seu try/catch — se uma
  // cair, as outras continuam aparecendo normal. Todo item vira o mesmo
  // formato { volumeInfo: { title, description } } que o front-end já espera
  // (era o formato nativo da Google Books, agora virou o "padrão" da rota).
  //
  // aceita ?q=termo opcional: sem termo, devolve a lista curada de sempre
  // (ficção recente/popular); com termo, busca esse termo nas 3 fontes e
  // devolve mais resultados por fonte (é uma busca de verdade, não só a
  // vitrine padrão).
  const termo = (req.query.q || '').trim();
  const buscando = termo.length > 0;
  // quando a chamada só vai usar os resultados do Google Books (ex: escolher
  // o "livro atual" do clube), nem vale a pena chamar Open Library e
  // Gutendex — economiza 2 requisições externas inteiras e a busca fica
  // bem mais rápida
  const somenteGoogle = req.query.somenteGoogle === '1';
  // idioma do app de quem pediu: em inglês, o Gutenberg e a Open Library
  // também trazem livros em inglês; o que não tiver tradução continua em
  // português (cada livro volta com "idioma" pra o app mostrar a etiqueta PT/EN)
  const idiomaApp = req.query.idioma === 'en' ? 'en' : 'pt';
  const limite = buscando ? 10 : 5;
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const itens = [];
  const autorVitrine = AUTORES_BRASILEIROS_DESTAQUE[(pagina - 1) % AUTORES_BRASILEIROS_DESTAQUE.length];

  // as 3 fontes agora rodam EM PARALELO (antes era uma await depois da outra,
  // then na pratica a busca demorava a soma do tempo das 3 — agora demora
  // so o tempo da mais lenta das 3). Cada uma continua com seu try/catch
  // isolado: se uma falhar ou demorar mais, as outras aparecem normal.
  const [itensGoogle, itensOpenLibrary, itensGutendex, itensWikisource] = await Promise.all([
    // Google Books só entra na listagem quando somenteGoogle=1 for pedido
    // explicitamente (ex: escolher o "livro atual" do clube) — na aba normal
    // de "livros gratuitos" ele saía da lista quase sempre como amostra, sem
    // deixar a pessoa ler o livro inteiro, então não faz sentido aparecer lá.
    !somenteGoogle ? Promise.resolve([]) : (async () => {
      const out = [];
      try {
        const queryGoogle = buscando ? `q=${encodeURIComponent(termo)}` : `q=${encodeURIComponent('inauthor:"' + autorVitrine + '"')}`;
        const startIndex = (pagina - 1) * limite;
        const resposta = await fetch(
          `https://www.googleapis.com/books/v1/volumes?${queryGoogle}&langRestrict=pt&key=${process.env.GOOGLE_BOOKS_API_KEY}&maxResults=${limite}&startIndex=${startIndex}`
        );
        if (!resposta.ok) throw new Error(`resposta ${resposta.status} (${(resposta.headers.get('content-type') || '').split(';')[0]})`);
        const dados = await resposta.json();
        (dados.items || []).forEach(l => {
          // antes só pegava "thumbnail" (a miniatura baixa) — agora prioriza os
          // tamanhos maiores que a Google Books às vezes manda (igual já
          // fazíamos na busca de livro pra citação), e ainda pede um zoom maior
          // e tira o efeito de "canto dobrado" da URL, que também limitava a
          // resolução mesmo quando só tinha a miniatura mesmo
          const linksImagemGoogle = l.volumeInfo?.imageLinks || {};
          const capaGoogleBruta = linksImagemGoogle.large || linksImagemGoogle.medium || linksImagemGoogle.small
            || linksImagemGoogle.thumbnail || linksImagemGoogle.smallThumbnail || null;
          const capaGoogle = capaGoogleBruta
            ? capaGoogleBruta.replace(/&edge=curl/, '').replace(/zoom=\d/, 'zoom=3')
            : null;
          // a API do Google Books quase sempre só libera uma amostra do livro —
          // só dá pra ler o livro inteiro por lá quando é domínio público ou a
          // editora liberou visualização completa. Marca isso pra avisar a
          // pessoa antes dela clicar, em vez de deixar ela descobrir sozinha
          // depois de abrir o Google Play Livros.
          const leituraCompleta = l.accessInfo?.viewability === 'ALL_PAGES' || l.accessInfo?.publicDomain === true;
          out.push({
            fonte: 'Google Books',
            idioma: 'pt',
            googleId: l.id || null,
            capa: capaGoogle ? capaGoogle.replace('http://', 'https://') : null,
            autor: (l.volumeInfo?.authors || []).join(', '),
            leituraCompleta,
            volumeInfo: {
              title: l.volumeInfo?.title || 'Sem título',
              description: l.volumeInfo?.description || 'Sem descrição disponível.',
              link: l.volumeInfo?.infoLink || l.volumeInfo?.previewLink || null,
            },
          });
        });
      } catch (erro) {
        console.log('erro Google Books (livros em destaque):', erro.message);
      }
      return out;
    })(),
    somenteGoogle ? Promise.resolve([]) : (async () => {
      const out = [];
      try {
        const queryOpenLibrary = buscando ? `q=${encodeURIComponent(termo)}` : `author=${encodeURIComponent(autorVitrine)}`;
        const resposta = await fetch(
          `https://openlibrary.org/search.json?${queryOpenLibrary}&language=${idiomaApp === 'en' ? 'eng' : 'por'}&limit=${limite}&page=${pagina}`,
          { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
        );
        if (!resposta.ok) throw new Error(`resposta ${resposta.status} (${(resposta.headers.get('content-type') || '').split(';')[0]})`);
        const dados = await resposta.json();
        (dados.docs || []).forEach(l => {
          const autores = (l.author_name || []).join(', ');
          const ano = l.first_publish_year ? ` (${l.first_publish_year})` : '';
          // quando o Internet Archive tem uma cópia digitalizada de acesso
          // público, dá pra ler o livro de verdade dentro do app (visualizador
          // do próprio archive.org, embutido em iframe — bem mais confiável
          // que o visualizador antigo do Google Books, que parou de funcionar)
          const iaId = Array.isArray(l.ia) && l.ia.length ? l.ia[0] : null;
          const leituraCompleta = !!iaId && l.ebook_access === 'public';
          out.push({
            fonte: 'Open Library',
            idioma: idiomaApp,
            coverId: l.cover_i || null,
            capa: l.cover_i ? `https://covers.openlibrary.org/b/id/${l.cover_i}-L.jpg` : null,
            autor: autores,
            iaId,
            leituraCompleta,
            volumeInfo: {
              title: l.title || 'Sem título',
              description: autores ? `${autores}${ano}` : 'Sem descrição disponível.',
              link: l.key ? `https://openlibrary.org${l.key}` : null,
            },
          });
        });
      } catch (erro) {
        console.log('erro Open Library (livros em destaque):', erro.message);
      }
      return out;
    })(),
    somenteGoogle ? Promise.resolve([]) : (async () => {
      const out = [];
      try {
        const queryGutendex = buscando ? `search=${encodeURIComponent(termo)}` : `search=${encodeURIComponent(autorVitrine)}`;
        const resposta = await fetch(
          `https://gutendex.com/books/?languages=${idiomaApp === 'en' ? 'en,pt' : 'pt'}&${queryGutendex}&page=${pagina}`,
          { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
        );
        if (!resposta.ok) throw new Error(`resposta ${resposta.status} (${(resposta.headers.get('content-type') || '').split(';')[0]})`);
        const dados = await resposta.json();
        (dados.results || []).forEach(l => {
          // só entra na lista quem realmente dá pra ler dentro do app — sem
          // text/plain nem text/html no Gutendex não tem prévia nenhuma pra
          // mostrar (era isso que fazia clicar em alguns livros só dar erro sem
          // avisar antes; agora esses nem aparecem na lista de livros gratuitos)
          const temTextoLegivel = Object.keys(l.formats || {}).some(k => k.startsWith('text/plain') || k.startsWith('text/html'));
          if (!temTextoLegivel) return;
          if (out.length >= limite) return;

          const autores = (l.authors || []).map(a => a.name).join(', ');
          out.push({
            fonte: 'Gutendex',
            idioma: (l.languages || [])[0] === 'en' ? 'en' : 'pt',
            gutendexId: l.id || null,
            capa: (l.formats && l.formats['image/jpeg']) || null,
            autor: autores,
            volumeInfo: {
              title: l.title || 'Sem título',
              description: autores ? `${autores} · clássico de domínio público` : 'Clássico de domínio público.',
              link: l.id ? `https://www.gutenberg.org/ebooks/${l.id}` : null,
            },
          });
        });
      } catch (erro) {
        console.log('erro Gutendex (livros em destaque):', erro.message);
      }
      return out;
    })(),
    somenteGoogle ? Promise.resolve([]) : (async () => {
      // Wikisource (pt.wikisource.org) - acervo de clássicos brasileiros e
      // portugueses de domínio público, texto transcrito por voluntários
      // (não é OCR de digitalização, então sai limpo no leitor do app,
      // diferente do Internet Archive)
      const out = [];
      try {
        const queryWikisource = buscando ? termo : autorVitrine;
        const resposta = await fetch(
          `https://pt.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(queryWikisource)}&srnamespace=0&srlimit=${limite}&format=json`,
          { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
        );
        if (!resposta.ok) throw new Error(`resposta ${resposta.status} (${(resposta.headers.get('content-type') || '').split(';')[0]})`);
        const dados = await resposta.json();
        const resultados = (dados.query && dados.query.search) || [];
        // 30 palavras era baixo demais -- deixava passar pagina-indice/stub
        // (ex.: uma pagina de sumario com so titulos de capitulo) como se
        // fosse o livro em si, dai o leitor abria e mostrava um monte de
        // '=====' e titulo solto em vez do texto de verdade. 400 palavras
        // corta esse tipo de pagina sem tirar livro/conto real da lista.
        const resultadosComTexto = resultados.filter(r => (r.wordcount || 0) >= 400);

        // Wikisource divide muita obra em subpáginas por capítulo/seção
        // (ex: "Ressurreição (Machado de Assis)/Advertência") e a busca por
        // palavra às vezes acha justo uma dessas subpáginas em vez da
        // página raiz da obra — foi o bug que ela viu (abria só a
        // "Advertência", uma página curtinha, em vez do livro inteiro).
        // Correção: sempre usa o título RAIZ (antes da primeira "/"), que é
        // a página real do livro — é nela que /api/livro-texto-wikisource
        // consegue achar os capítulos depois via action=parse — e
        // deduplica pra não repetir o mesmo livro várias vezes na lista.
        const raizPorTitulo = new Map();
        resultadosComTexto.forEach(r => {
          const raiz = r.title.split('/')[0];
          if (!raizPorTitulo.has(raiz)) raizPorTitulo.set(raiz, { ...r, title: raiz });
        });
        const resultadosValidos = [...raizPorTitulo.values()];

        // busca capa (pageimage) em lote pra quem sobrou — melhor esforço,
        // boa parte das obras na Wikisource não tem imagem associada (é um
        // acervo de texto, não de capas), então isso só preenche quando
        // existe; se a chamada falhar ou vier vazia, todo mundo cai no
        // fallback visual que o app já usa pra "sem capa"
        const capasPorTitulo = {};
        if (resultadosValidos.length) {
          try {
            const titulosLote = resultadosValidos.map(r => r.title).join('|');
            const respCapas = await fetch(
              `https://pt.wikisource.org/w/api.php?action=query&titles=${encodeURIComponent(titulosLote)}&prop=pageimages&piprop=thumbnail&pithumbsize=300&format=json&formatversion=2`,
              { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
            );
            const dadosCapas = await respCapas.json();
            ((dadosCapas.query && dadosCapas.query.pages) || []).forEach(p => {
              if (p.thumbnail && p.thumbnail.source) capasPorTitulo[p.title] = p.thumbnail.source;
            });
          } catch (erroCapa) {
            console.log('erro ao buscar capas Wikisource (segue sem capa):', erroCapa.message);
          }
        }

        resultadosValidos.forEach(r => {
          const descricaoLimpa = (r.snippet || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
          out.push({
            fonte: 'Wikisource',
            idioma: 'pt',
            wikisourceTitulo: r.title,
            capa: capasPorTitulo[r.title] || null,
            autor: '',
            leituraCompleta: true,
            volumeInfo: {
              title: r.title || 'Sem título',
              description: descricaoLimpa || 'Domínio público, transcrição da Wikisource.',
              link: r.title ? `https://pt.wikisource.org/wiki/${encodeURIComponent(r.title)}` : null,
            },
          });
        });
      } catch (erro) {
        console.log('erro Wikisource (livros em destaque):', erro.message);
      }
      return out;
    })(),
  ]);
  itens.push(...itensGoogle, ...itensOpenLibrary, ...itensGutendex, ...itensWikisource);

  // ordena em duas camadas: primeiro quem dá pra ler dentro do app de
  // verdade (Gutendex sempre, Open Library só quando tem cópia completa no
  // Internet Archive) — Google Books e Open Library sem cópia completa vão
  // pro final, já que só abrem uma amostra ou o site de origem. Dentro de
  // cada grupo, reforça a prioridade de português: mesmo pedindo só PT nas
  // 3 fontes, o filtro de idioma de cada API (principalmente o langRestrict
  // do Google Books) às vezes deixa passar item em outro idioma — inclusive
  // espanhol, que compartilha muito acento com o português (por isso usa a
  // mesma heurística pareceTextoEmPortugues() de cima, que já pesa isso).
  const daPraLerNoApp = it => it.fonte === 'Gutendex' || it.fonte === 'Wikisource' || (it.fonte === 'Open Library' && it.leituraCompleta);
  itens.sort((a, b) => {
    const legivelA = daPraLerNoApp(a) ? 1 : 0;
    const legivelB = daPraLerNoApp(b) ? 1 : 0;
    if (legivelA !== legivelB) return legivelB - legivelA;
    const scoreA = pareceTextoEmPortugues((a.volumeInfo.title || '') + ' ' + (a.volumeInfo.description || ''));
    const scoreB = pareceTextoEmPortugues((b.volumeInfo.title || '') + ' ' + (b.volumeInfo.description || ''));
    return scoreB - scoreA;
  });

  res.json({ items: itens });
});

// tira o cabeçalho/rodapé padrão do Project Gutenberg (licença, sumário de
// catalogação etc.) e deixa só o miolo do livro — cobre tanto o texto de
// marcação mais novo ("START OF THE PROJECT GUTENBERG EBOOK") quanto o
// formato mais antigo usado em livros catalogados há mais tempo ("START OF
// THIS PROJECT GUTENBERG EBOOK"); quando não acha os marcadores (raro),
// cai no comportamento antigo de pular os primeiros 5% do arquivo
function limparBoilerplateGutenberg(bruto) {
  const marcaInicio = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i;
  const marcaFim = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i;

  const mInicio = bruto.match(marcaInicio);
  const mFim = bruto.match(marcaFim);

  let texto = bruto;
  if (mInicio) texto = texto.slice(mInicio.index + mInicio[0].length);
  if (mFim) {
    const idxFim = texto.search(marcaFim);
    if (idxFim > -1) texto = texto.slice(0, idxFim);
  }

  if (!mInicio) {
    // marcadores não encontrados — mantém o comportamento antigo como rede de segurança
    texto = bruto.slice(Math.min(3000, Math.floor(bruto.length * 0.05)));
  }

  return texto.trim();
}

const LIMITE_TEXTO_LIVRO = 5_000_000; // ~5MB — cobre praticamente qualquer clássico, evita caso patológico

app.get('/api/livro-texto', async (req, res) => {
  // pega o texto integral (domínio público) de um livro do Gutendex pra
  // mostrar no leitor de verdade dentro do app — o front-end é quem divide
  // isso em páginas pro modo de leitura com deslizar
  const id = (req.query.id || '').trim();
  if (!id) return res.status(400).json({ erro: 'faltou o parâmetro id' });

  try {
    const respLivro = await fetch(`https://gutendex.com/books/${encodeURIComponent(id)}`);
    const livro = await respLivro.json();
    const formatos = livro.formats || {};

    const chaveTxt = Object.keys(formatos).find(k => k.startsWith('text/plain'));
    const chaveHtml = Object.keys(formatos).find(k => k.startsWith('text/html'));
    const urlEscolhida = formatos[chaveTxt] || formatos[chaveHtml];

    if (!urlEscolhida) {
      return res.json({
        titulo: livro.title || 'Sem título',
        autor: (livro.authors || []).map(a => a.name).join(', '),
        texto: '',
        erro: 'Esse livro não tem texto disponível pra leitura.',
      });
    }

    const respTexto = await fetch(urlEscolhida);
    let bruto = await respTexto.text();

    if (!chaveTxt && chaveHtml) {
      bruto = bruto.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
    }

    let texto = limparBoilerplateGutenberg(bruto);
    let truncado = false;
    if (texto.length > LIMITE_TEXTO_LIVRO) {
      texto = texto.slice(0, LIMITE_TEXTO_LIVRO);
      truncado = true;
    }

    res.json({
      titulo: livro.title || 'Sem título',
      autor: (livro.authors || []).map(a => a.name).join(', '),
      texto: texto || 'Prévia não disponível pra este livro.',
      truncado,
    });
  } catch (erro) {
    console.log('erro ao buscar texto do livro (Gutendex):', erro.message);
    // 200 com aviso amigável em vez de 500 — o Gutendex faz parte da internet
    // e falha na hora vez ou outra; melhor a pessoa ver "tenta de novo" do
    // que um erro cru no console sem explicação nenhuma
    res.json({ erro: 'não consegui carregar o livro', texto: '' });
  }
});

// pega o texto integral (domínio público, transcrição da Wikisource) de uma
// página pra mostrar no mesmo leitor de verdade usado pro Gutendex — o
// front-end é quem divide isso em páginas pro modo de leitura com deslizar
// busca o texto de UMA página da Wikisource -- acha subpáginas de capítulo
// (via action=parse, que preserva a ordem em que os links aparecem na
// página, importante pq ordem alfabética quebra numeração romana:
// "Capítulo IX" viria antes de "Capítulo V") e concatena tudo; se não achar
// capítulo nenhum, cai pro texto direto da própria página. Devolve também
// os links da página, pra quem chamou decidir se essa página é uma
// DESAMBIGUAÇÃO (ex: "A Caridade (Machado de Assis)" que só lista variantes
// tipo "A caridade (Machado de Assis, 1864)" em vez do poema em si).
async function buscarTextoPaginaWikisource(titulo) {
  const respParse = await fetch(
    `https://pt.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(titulo)}&prop=links&redirects=1&format=json&formatversion=2`,
    { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
  );
  const dadosParse = await respParse.json();
  // action=parse com redirects=1 pode resolver pra um titulo diferente do
  // que a gente mandou (ex: "Helena" redireciona pra "Helena (Machado de
  // Assis)") -- se a gente continuar filtrando subpaginas pelo titulo
  // ORIGINAL, nunca acha "Helena (Machado de Assis)/Capitulo I" e cai no
  // fallback de pagina unica, que fica vazio (pagina so tem indice). Usa o
  // titulo resolvido (dadosParse.parse.title) pra montar o prefixo.
  const tituloResolvido = (dadosParse.parse && dadosParse.parse.title) || titulo;
  const prefixoSubpagina = tituloResolvido + '/';
  const todosLinks = (dadosParse.parse && dadosParse.parse.links) || [];
  const titulosCapitulos = todosLinks
    .filter(l => l.ns === 0 && l.exists && l.title && l.title.startsWith(prefixoSubpagina))
    .map(l => l.title);

  console.log(`[wikisource] titulo="${titulo}" | links na página: ${todosLinks.length} | subpáginas de capítulo achadas: ${titulosCapitulos.length}${dadosParse.parse ? ` | título real após redirect: "${dadosParse.parse.title}"` : ' | ATENÇÃO: action=parse não achou essa página'}`);

  let textoFinal = '';

  if (titulosCapitulos.length) {
    const LOTE = 20; // a API aceita várias "titles" numa chamada só, separadas por |
    const textoPorTitulo = {};
    for (let i = 0; i < titulosCapitulos.length; i += LOTE) {
      const lote = titulosCapitulos.slice(i, i + LOTE);
      const respLote = await fetch(
        `https://pt.wikisource.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(lote.join('|'))}&format=json&formatversion=2`,
        { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
      );
      const dadosLote = await respLote.json();
      ((dadosLote.query && dadosLote.query.pages) || []).forEach(p => {
        textoPorTitulo[p.title] = (p.extract || '').trim();
      });
    }
    // remonta na ORDEM certa dos capítulos (não na ordem que a API devolveu)
    textoFinal = titulosCapitulos.map(t => textoPorTitulo[t]).filter(Boolean).join('\n\n');
  }

  if (!textoFinal) {
    // não é um livro dividido em capítulos (ou os capítulos vieram vazios)
    // — usa o texto direto da própria página, do jeito que já fazia antes
    const resposta = await fetch(
      `https://pt.wikisource.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&titles=${encodeURIComponent(tituloResolvido)}&format=json&formatversion=2`,
      { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
    );
    const dados = await resposta.json();
    const pagina = dados.query && dados.query.pages && dados.query.pages[0];
    textoFinal = (pagina && pagina.extract || '').trim();
    console.log(`[wikisource] caiu no fallback de página única | texto direto veio com ${textoFinal.length} caracteres`);
  }

  return { texto: textoFinal, todosLinks };
}

// tira o "(...)" do final do título pra comparar só a parte do nome —
// "A Caridade (Machado de Assis)" e "A caridade (Machado de Assis, 1864)"
// viram os dois "a caridade", o que deixa achar as variantes certas
function baseDoTitulo(titulo) {
  return titulo.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
}

app.get('/api/livro-texto-wikisource', async (req, res) => {
  const titulo = (req.query.titulo || '').trim();
  if (!titulo) return res.status(400).json({ erro: 'faltou o parâmetro titulo' });

  try {
    let { texto: textoFinal, todosLinks } = await buscarTextoPaginaWikisource(titulo);

    // ALGUMAS páginas não são o texto em si, são uma DESAMBIGUAÇÃO — uma
    // lista de variantes (ex: "A Caridade (Machado de Assis)" que só
    // aponta pra "A caridade (..., ortografia atualizada)" e "A caridade
    // (..., 1864)"). A wikisource sempre usa a frase "pode estar à procura
    // de" nessas páginas, é um jeito confiável de detectar isso. Quando
    // acontece, segue pro primeiro link da própria página que compartilha
    // o mesmo nome base (preferindo a versão com ortografia atualizada,
    // que costuma ser a mais completa/legível).
    if (textoFinal && /pode estar à procura de/i.test(textoFinal)) {
      const baseAlvo = baseDoTitulo(titulo);
      const candidatos = todosLinks
        .filter(l => l.ns === 0 && l.exists && l.title && l.title !== titulo && baseDoTitulo(l.title) === baseAlvo)
        .map(l => l.title);
      const escolhido = candidatos.find(t => /ortografia atualizada/i.test(t)) || candidatos[0];

      if (escolhido) {
        console.log(`[wikisource] "${titulo}" é página de desambiguação | seguindo para "${escolhido}"`);
        const seguido = await buscarTextoPaginaWikisource(escolhido);
        if (seguido.texto) textoFinal = seguido.texto;
      }
    }

    if (!textoFinal) {
      return res.json({ titulo, autor: '', texto: '', erro: 'Esse texto não tem conteúdo disponível pra leitura.' });
    }

    let truncado = false;
    if (textoFinal.length > LIMITE_TEXTO_LIVRO) {
      textoFinal = textoFinal.slice(0, LIMITE_TEXTO_LIVRO);
      truncado = true;
    }

    res.json({ titulo, autor: '', texto: textoFinal, truncado });
  } catch (erro) {
    console.log('erro ao buscar texto do livro (Wikisource):', erro.message);
    res.json({ erro: 'não consegui carregar o livro', texto: '' });
  }
});

// texto OCR (djvu) de um item do Internet Archive — usado pra fazer os
// livros do Open Library/archive.org abrirem no MESMO leitor paginado
// (estilo Kindle) que Gutendex/Wikisource já usam, em vez do player
// genérico incorporado do archive.org. Lê o metadata do item pra achar o
// nome real do arquivo _djvu.txt (não assume o nome, cada item pode variar)
// — se não existir esse arquivo, devolve erro e o front cai pro player
// incorporado como estava antes (nada quebra).
app.get('/api/livro-texto-arquivo', async (req, res) => {
  const iaId = (req.query.iaId || '').trim();
  if (!iaId) return res.status(400).json({ erro: 'faltou o parâmetro iaId' });

  try {
    const respMeta = await fetch(`https://archive.org/metadata/${encodeURIComponent(iaId)}`);
    if (!respMeta.ok) throw new Error(`metadata ${respMeta.status}`);
    const dadosMeta = await respMeta.json();
    const arquivoTexto = (dadosMeta.files || []).find(f =>
      f.format === 'DjVuTXT' || (f.name || '').toLowerCase().endsWith('_djvu.txt')
    );

    if (!arquivoTexto) {
      return res.json({ texto: '', erro: 'Esse item não tem texto OCR disponível.' });
    }

    const respTexto = await fetch(`https://archive.org/download/${encodeURIComponent(iaId)}/${encodeURIComponent(arquivoTexto.name)}`);
    if (!respTexto.ok) throw new Error(`download ${respTexto.status}`);
    let texto = (await respTexto.text()).trim();

    if (!texto) {
      return res.json({ texto: '', erro: 'Esse item não tem texto OCR disponível.' });
    }

    let truncado = false;
    if (texto.length > LIMITE_TEXTO_LIVRO) {
      texto = texto.slice(0, LIMITE_TEXTO_LIVRO);
      truncado = true;
    }

    res.json({ texto, truncado });
  } catch (erro) {
    console.log('erro ao buscar texto OCR do Internet Archive:', erro.message);
    res.json({ erro: 'não consegui carregar o texto', texto: '' });
  }
});

app.get('/api/buscar-podcast', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });

  try {
    const resposta = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(termo)}&entity=podcast&limit=5`);
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar no iTunes' });
  }
});

app.get('/api/podcasts-em-alta', async (req, res) => {
  try {
    const resposta = await fetch('https://itunes.apple.com/search?term=podcast&entity=podcast&limit=5&sort=popularity');
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar podcasts em alta' });
  }
});

app.get('/api/podcast-episodio', async (req, res) => {
  const collectionId = req.query.id;
  if (!collectionId) return res.status(400).json({ erro: 'faltou o parâmetro id' });

  try {
    const resposta = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=podcastEpisode&limit=1`);
    const dados = await resposta.json();
    const episodio = (dados.results || []).find(r => r.episodeUrl);
    res.json({ url: episodio ? episodio.episodeUrl : null });
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar episódio' });
  }
});

// tema clima - clima real via lat/lon (API Ninjas),
// devolve só o essencial que o app precisa pra decidir o estado visual.
app.get('/api/clima', async (req, res) => {
  if (!process.env.API_NINJAS_KEY) {
    return res.status(500).json({ erro: 'faltou configurar API_NINJAS_KEY no servidor.env' });
  }
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ erro: 'lat e lon são obrigatórios' });
  try {
    const resposta = await fetch(`https://api.api-ninjas.com/v1/weather?lat=${lat}&lon=${lon}`, {
      headers: { 'X-Api-Key': process.env.API_NINJAS_KEY },
    });
    const dados = await resposta.json();
    if (!dados || dados.error) {
      console.log('clima sem retorno da API Ninjas — status:', resposta.status, 'corpo:', JSON.stringify(dados));
      return res.status(500).json({ erro: 'falha ao buscar clima' });
    }
    res.json({
      weather: dados.weather || dados.weather_description || '',
      weather_description: dados.weather_description || '',
      is_day: typeof dados.is_day === 'boolean' ? dados.is_day : null,
      cloud_pct: dados.cloud_pct,
      temp: dados.temp,
    });
  } catch (erro) {
    console.log('erro ao buscar clima:', erro.message);
    res.status(500).json({ erro: 'falha ao buscar clima' });
  }
});

app.get('/api/noticias-em-alta', async (req, res) => {
  try {
    const resposta = await fetch(
      `https://gnews.io/api/v4/top-headlines?lang=pt&country=br&max=5&apikey=${process.env.GNEWS_API_KEY}`
    );
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar notícias' });
  }
});

app.get('/api/buscar-gif', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });

  try {
    const resposta = await fetch(
      `https://api.klipy.co/api/v1/${process.env.KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(termo)}&customer_id=atomo-user&per_page=12`
    );
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar GIF' });
  }
});

app.get('/api/gifs-em-alta', async (req, res) => {
  try {
    const resposta = await fetch(
      `https://api.klipy.co/api/v1/${process.env.KLIPY_API_KEY}/gifs/trending?customer_id=atomo-user&per_page=30`
    );
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar gifs em alta' });
  }
});

// figurinhas de verdade — trocado de Klipy pra Giphy (a API de Sticker da
// Klipy dizia "chave inválida" só pra figurinha, mesmo a mesma chave indo bem
// pro GIF; provavelmente precisa de habilitação separada por produto que não
// dava pra resolver só no código). O formato de resposta do Giphy é público,
// documentado e estável há anos — precisa de GIPHY_API_KEY no servidor.env
// (grátis em developers.giphy.com, cria um app e a chave sai na hora).
app.get('/api/buscar-sticker', async (req, res) => {
  const termo = req.query.q;
  if (!termo) return res.status(400).json({ erro: 'faltou o parâmetro q' });
  if (!process.env.GIPHY_API_KEY) return res.status(500).json({ erro: 'busca de figurinha não configurada no servidor (falta GIPHY_API_KEY)' });

  try {
    const resposta = await fetch(
      `https://api.giphy.com/v1/stickers/search?api_key=${process.env.GIPHY_API_KEY}&q=${encodeURIComponent(termo)}&limit=16&rating=g&lang=pt`
    );
    const dados = await resposta.json();
    if (!resposta.ok) console.log('Giphy stickers/search não-OK:', resposta.status, JSON.stringify(dados).slice(0, 300));
    res.json(dados);
  } catch (erro) {
    console.log('erro ao buscar sticker (Giphy):', erro.message);
    res.status(500).json({ erro: 'falha ao buscar figurinha' });
  }
});

app.get('/api/stickers-em-alta', async (req, res) => {
  if (!process.env.GIPHY_API_KEY) return res.status(500).json({ erro: 'figurinhas em alta não configuradas no servidor (falta GIPHY_API_KEY)' });
  try {
    const resposta = await fetch(
      `https://api.giphy.com/v1/stickers/trending?api_key=${process.env.GIPHY_API_KEY}&limit=24&rating=g`
    );
    const dados = await resposta.json();
    if (!resposta.ok) console.log('Giphy stickers/trending não-OK:', resposta.status, JSON.stringify(dados).slice(0, 300));
    res.json(dados);
  } catch (erro) {
    console.log('erro ao buscar stickers em alta (Giphy):', erro.message);
    res.status(500).json({ erro: 'falha ao buscar figurinhas em alta' });
  }
});

// ---------- sala de call de estudo ao vivo — áudio de verdade via Daily.co ----------
// decisão do provedor: Daily.co (10 mil minutos grátis por mês, integração
// mais simples pra quem tá aprendendo backend do zero — só REST API + SDK
// JS, sem precisar montar servidor de mídia próprio). Pra ligar de vez:
// 1) criar conta grátis em https://dashboard.daily.co
// 2) em Developers, copiar a "API key"
// 3) colar em DAILY_API_KEY no servidor.env (local) e nas variáveis de
//    ambiente do Render (produção) — sem isso esse endpoint responde 503 e
//    a sala continua funcionando só visualmente, sem travar o app.
const DAILY_API_KEY = process.env.DAILY_API_KEY || '';

app.post('/api/sala/entrar', async (req, res) => {
  if (!DAILY_API_KEY) {
    return res.status(503).json({ erro: 'áudio ao vivo ainda não configurado' });
  }

  const salaId = (req.body && req.body.salaId || '').toString().trim();
  if (!salaId) return res.status(400).json({ erro: 'faltou salaId' });

  // nome da sala no Daily só aceita letra/número/hífen — um nome fixo por
  // comunidade garante que toda sessão daquela comunidade cai na MESMA sala
  const nomeSala = ('atomo-' + salaId).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 100);

  try {
    // já existe? reaproveita
    const respGet = await fetch(`https://api.daily.co/v1/rooms/${nomeSala}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });
    if (respGet.ok) {
      const dadosGet = await respGet.json();
      return res.json({ url: dadosGet.url });
    }

    // não existe ainda -- cria uma sala pública nova com esse nome fixo
    const respCriar = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nomeSala,
        privacy: 'public',
        properties: { enable_screenshare: false, enable_chat: false, start_video_off: true, start_audio_off: false },
      }),
    });
    if (!respCriar.ok) {
      const erroTxt = await respCriar.text();
      console.log('erro ao criar sala Daily:', respCriar.status, erroTxt.slice(0, 300));
      return res.status(500).json({ erro: 'não consegui criar a sala de áudio' });
    }
    const dadosCriar = await respCriar.json();
    res.json({ url: dadosCriar.url });
  } catch (erro) {
    console.log('erro sala Daily:', erro.message);
    res.status(500).json({ erro: 'não consegui abrir a sala de áudio' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));