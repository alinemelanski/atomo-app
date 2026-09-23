require('dotenv').config({ path: './servidor.env' });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

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
  console.log('push não configurado: faltam VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no .env');
}

// cliente com a service role — só usado nas rotas de push, que precisam ler
// e gravar dado de QUALQUER usuário (o RLS normal só deixa cada pessoa mexer
// nos próprios dados, o que não serve pro servidor mandar notificação pra
// todo mundo). NUNCA usar essa chave no front-end.
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient('https://wfhikucbygmjeawrfsfq.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

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

// painel de métricas privado — só pra você acompanhar quantos usuários o
// Átomo tem, protegido por senha (ADMIN_SECRET), sem link em nenhum lugar
// do app pros outros usuários
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
  'Cada dia é uma página que não se reescreve — essa também deixou sua marca.',
  'O tempo não pede licença pra passar. Só pede atenção.',
  'Nem todo dia precisa de sentido. Alguns só precisam ser vividos até o fim.',
  'Há um segredo escondido em cada dia comum, como uma semente dentro da casca.',
  'A vida não é feita só dos grandes dias, mas da soma silenciosa dos comuns.',
  'O que passou hoje não volta — mas também não se perde. Vira quem você é amanhã.',
  'Existe uma sabedoria simples em ter chegado até aqui, até esta noite.',
  'Debaixo da rotina de qualquer dia, sempre mora algo que vale guardar.',
  'A vida se escreve em dias comuns — hoje foi mais um capítulo silencioso.',
  'Ninguém vive o mesmo dia duas vezes. Esse aqui já foi só seu.',
  'Há mais poesia no cotidiano do que se costuma perceber.',
  'O fim de um dia é sempre um pequeno adeus — e um pequeno recomeço.',
  'Nem tudo que vivemos precisa ser lembrado. Basta ter sido vivido.',
  'Entre o barulho do dia e o silêncio da noite, mora um instante de paz.',
  'A vida não espera — ela simplesmente acontece, um dia de cada vez.',
  'Há beleza até nos dias mais comuns, se alguém parar pra olhar.',
  'O que fica de um dia não são as horas, é o que elas tocaram em você.',
  'Toda noite é um convite silencioso a soltar o que já passou.',
  'A vida é feita de pequenas despedidas diárias — essa é mais uma.',
  'Nem todo dia muda tudo. Mas todo dia muda alguma coisa.',
];
const HORARIO_NOITE_MIN = 21 * 60; // 21h00 (horário de Brasília) — fixo pra todo mundo
const JANELA_CRON_MIN = 6; // tolerância entre disparos do agendador externo

// escolhe a mensagem do dia por rotação (não por sorteio), pra nunca repetir
// em dias seguidos — cada dia do calendário sempre cai num índice diferente
// do anterior, e só volta a repetir depois de passar por todas as frases
function indiceRotativoDoDia(dataYyyyMmDd, tamanho) {
  const [ano, mes, dia] = dataYyyyMmDd.split('-').map(Number);
  const diasDesdeEpoca = Math.floor(Date.UTC(ano, mes - 1, dia) / 86400000);
  return ((diasDesdeEpoca % tamanho) + tamanho) % tamanho;
}

async function enviarPushParaUsuario(usuarioId, titulo, corpo) {
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('*').eq('usuario_id', usuarioId);
  let enviadas = 0;
  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ titulo, corpo })
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

    const { data: candidatosManha } = await supabaseAdmin
      .from('usuarios')
      .select('id, horario_acordar_min, ultima_notif_manha_data')
      .not('horario_acordar_min', 'is', null)
      .gte('horario_acordar_min', minutosAgora)
      .lt('horario_acordar_min', minutosAgora + JANELA_CRON_MIN);

    const precisamManha = (candidatosManha || []).filter(u => u.ultima_notif_manha_data !== hojeBrasilia);

    let precisamNoite = [];
    const dentroJanelaNoite = minutosAgora >= HORARIO_NOITE_MIN && minutosAgora < HORARIO_NOITE_MIN + JANELA_CRON_MIN;
    if (dentroJanelaNoite) {
      const { data: todos } = await supabaseAdmin.from('usuarios').select('id, ultima_notif_noite_data');
      precisamNoite = (todos || []).filter(u => u.ultima_notif_noite_data !== hojeBrasilia);
    }

    let totalEnviadas = 0;
    for (const u of precisamManha) {
      const msg = MENSAGENS_MANHA[indiceRotativoDoDia(hojeBrasilia, MENSAGENS_MANHA.length)];
      totalEnviadas += await enviarPushParaUsuario(u.id, 'Bom dia 🌙', msg);
      await supabaseAdmin.from('usuarios').update({ ultima_notif_manha_data: hojeBrasilia }).eq('id', u.id);
    }
    for (const u of precisamNoite) {
      const msg = MENSAGENS_NOITE[indiceRotativoDoDia(hojeBrasilia, MENSAGENS_NOITE.length)];
      totalEnviadas += await enviarPushParaUsuario(u.id, 'Reflexão do dia', msg);
      await supabaseAdmin.from('usuarios').update({ ultima_notif_noite_data: hojeBrasilia }).eq('id', u.id);
    }

    res.json({ ok: true, manha: precisamManha.length, noite: precisamNoite.length, notificacoesEnviadas: totalEnviadas });
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

console.log('TOKEN CARREGADO:', process.env.TMDB_API_KEY ? process.env.TMDB_API_KEY.slice(0, 20) + '...' : 'VAZIO/UNDEFINED');
console.log('V3 EM JSON:', JSON.stringify(process.env.TMDB_API_KEY_V3));

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

app.get('/api/musicas-em-alta', async (req, res) => {
  try {
    const resposta = await fetch('https://api.deezer.com/chart/0/tracks?limit=10');
    const dados = await resposta.json();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar músicas em alta' });
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
      return pareceTextoEmPortugues(pistaTexto) > -4;
    });

    // prioriza quem tem mais nota (curtida + reblog), e ainda embaralha um
    // pouco o topo pra não ficar sempre a mesma ordem nos posts mais populares
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
  const limite = buscando ? 10 : 5;
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const itens = [];
  const autorVitrine = AUTORES_BRASILEIROS_DESTAQUE[(pagina - 1) % AUTORES_BRASILEIROS_DESTAQUE.length];

  // Google Books
  try {
    const queryGoogle = buscando ? `q=${encodeURIComponent(termo)}` : `q=${encodeURIComponent('inauthor:"' + autorVitrine + '"')}`;
    const startIndex = (pagina - 1) * limite;
    const resposta = await fetch(
      `https://www.googleapis.com/books/v1/volumes?${queryGoogle}&langRestrict=pt&key=${process.env.GOOGLE_BOOKS_API_KEY}&maxResults=${limite}&startIndex=${startIndex}`
    );
    const dados = await resposta.json();
    (dados.items || []).forEach(l => {
      const capaGoogle = l.volumeInfo?.imageLinks?.thumbnail || l.volumeInfo?.imageLinks?.smallThumbnail || null;
      itens.push({
        fonte: 'Google Books',
        googleId: l.id || null,
        capa: capaGoogle ? capaGoogle.replace('http://', 'https://') : null,
        autor: (l.volumeInfo?.authors || []).join(', '),
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

  // Open Library — sem chave, sem limite de cota, catálogo enorme
  try {
    const queryOpenLibrary = buscando ? `q=${encodeURIComponent(termo)}` : `author=${encodeURIComponent(autorVitrine)}`;
    const resposta = await fetch(
      `https://openlibrary.org/search.json?${queryOpenLibrary}&language=por&limit=${limite}&page=${pagina}`,
      { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
    );
    const dados = await resposta.json();
    (dados.docs || []).forEach(l => {
      const autores = (l.author_name || []).join(', ');
      const ano = l.first_publish_year ? ` (${l.first_publish_year})` : '';
      itens.push({
        fonte: 'Open Library',
        coverId: l.cover_i || null,
        capa: l.cover_i ? `https://covers.openlibrary.org/b/id/${l.cover_i}-L.jpg` : null,
        autor: autores,
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

  // Gutendex — Projeto Gutenberg, clássicos de domínio público (a obra continua viva!)
  try {
    const queryGutendex = buscando ? `search=${encodeURIComponent(termo)}` : `search=${encodeURIComponent(autorVitrine)}`;
    const resposta = await fetch(
      `https://gutendex.com/books/?languages=pt&${queryGutendex}&page=${pagina}`,
      { headers: { 'User-Agent': 'Atomo-app (projeto de estudo)' } }
    );
    const dados = await resposta.json();
    (dados.results || []).slice(0, limite).forEach(l => {
      const autores = (l.authors || []).map(a => a.name).join(', ');
      itens.push({
        fonte: 'Gutendex',
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

  // reforça a prioridade de português: mesmo pedindo só PT nas 3 fontes,
  // o filtro de idioma de cada API (principalmente o langRestrict do
  // Google Books) às vezes deixa passar item em outro idioma — inclusive
  // espanhol, que compartilha muito acento com o português (por isso usa a
  // mesma heurística pareceTextoEmPortugues() de cima, que já pesa isso).
  // Reordena pra deixar os que claramente parecem PT-BR primeiro, sem
  // descartar os outros (sort estável: dentro de cada grupo a ordem
  // original das fontes continua igual).
  itens.sort((a, b) => {
    const scoreA = pareceTextoEmPortugues((a.volumeInfo.title || '') + ' ' + (a.volumeInfo.description || ''));
    const scoreB = pareceTextoEmPortugues((b.volumeInfo.title || '') + ' ' + (b.volumeInfo.description || ''));
    return scoreB - scoreA;
  });

  res.json({ items: itens });
});

app.get('/api/livro-texto', async (req, res) => {
  // pega um trecho de verdade do texto integral de um livro do Gutendex
  // (domínio público) pra mostrar como prévia dentro do próprio app
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
        texto: 'Prévia não disponível pra este livro.',
      });
    }

    const respTexto = await fetch(urlEscolhida);
    let bruto = await respTexto.text();

    if (!chaveTxt && chaveHtml) {
      bruto = bruto.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
    }

    // pula licença/sumário do início do arquivo do Gutenberg e pega um trecho do miolo
    const inicio = Math.min(3000, Math.floor(bruto.length * 0.05));
    const trecho = bruto.slice(inicio, inicio + 6000).trim();

    res.json({
      titulo: livro.title || 'Sem título',
      autor: (livro.authors || []).map(a => a.name).join(', '),
      texto: trecho || 'Prévia não disponível pra este livro.',
    });
  } catch (erro) {
    console.log('erro ao buscar texto do livro (Gutendex):', erro.message);
    res.status(500).json({ erro: 'não consegui carregar a prévia' });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));