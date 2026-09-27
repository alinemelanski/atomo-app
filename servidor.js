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
const HORARIO_NOITE_MIN = 21 * 60; // 21h00 (horário de Brasília) — fixo pra todo mundo
const HORARIO_SIGNO_MIN = 8 * 60; // 08h00 - horóscopo chega de manhã, hora de checar o dia
const JANELA_CRON_MIN = 6; // tolerância entre disparos do agendador externo
const MIN_EVENTOS_PRO_RESUMO = 3; // dia com poucos toques de humor não rende resumo que preste

// monta a narrativa do "resumo do dia" a partir dos toques de humor registrados
// (humor_eventos), em ordem cronológica. Regra: 2+ toques da mesma emoção
// negativa (brava/ansiosa/triste) dentro de 90min vira "pico"; senão, so aponta
// a emoção que mais apareceu no dia.
function gerarTextoResumo(eventos) {
  if (!eventos || !eventos.length) return null;
  const NOMES = { feliz: 'feliz', calma: 'calma', triste: 'triste', ansiosa: 'ansiosa', brava: 'brava' };
  const negativas = ['brava', 'ansiosa', 'triste'];

  const contagem = {};
  eventos.forEach((e) => { contagem[e.emocao] = (contagem[e.emocao] || 0) + 1; });
  const dominante = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0];

  const picos = [];
  let streakEmocao = null, streakInicio = null, streakCount = 0;
  eventos.forEach((e) => {
    if (negativas.includes(e.emocao)) {
      if (streakEmocao === e.emocao && (new Date(e.criado_em) - new Date(streakInicio)) <= 90 * 60 * 1000) {
        streakCount++;
      } else {
        streakEmocao = e.emocao; streakInicio = e.criado_em; streakCount = 1;
      }
      if (streakCount === 2) picos.push({ emocao: e.emocao, hora: e.criado_em });
    } else {
      streakEmocao = null; streakCount = 0;
    }
  });

  const formatarHora = (iso) => {
    const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
  };

  const frases = [];
  frases.push(`seu dia começou registrando ${NOMES[eventos[0].emocao]} às ${formatarHora(eventos[0].criado_em)}.`);
  picos.slice(0, 2).forEach((p) => frases.push(`às ${formatarHora(p.hora)} você teve um pico de ${NOMES[p.emocao]}.`));
  if (!picos.length) frases.push(`você se manteve majoritariamente ${NOMES[dominante]} ao longo do dia.`);
  else frases.push(`no geral, ${NOMES[dominante]} foi o que mais apareceu.`);
  return frases.join(' ');
}

// versão "de verdade" do resumo do dia, escrita por IA (Gemini, plano gratuito
// do Google AI Studio — basta gerar uma chave em aistudio.google.com e colar
// em GEMINI_API_KEY no servidor.env). Olha não só os toques de humor, mas
// também o que a pessoa escreveu no diário/postou hoje, e fecha sempre com
// uma dica/exercício combinando com o humor do dia. Se a chave não estiver
// configurada, ou a chamada falhar por qualquer motivo (rede, cota, etc.),
// devolve null — quem chamou cai de volta pro gerarTextoResumo (template),
// então o recurso nunca quebra o cron mesmo sem IA disponível.
async function gerarResumoComIA(eventos, postsHoje) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const NOMES = { feliz: 'feliz', calma: 'calma', triste: 'triste', ansiosa: 'ansiosa', brava: 'brava' };
    const formatarHora = (iso) => {
      const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      return String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
    };

    const linhasHumor = eventos.map((e) => `- ${formatarHora(e.criado_em)}: sentiu-se ${NOMES[e.emocao] || e.emocao}`).join('\n');
    const linhasPosts = (postsHoje && postsHoje.length)
      ? postsHoje.map((p) => `- (${p.tipo || 'anotação'}) "${(p.texto || '').slice(0, 220)}"`).join('\n')
      : '- (não escreveu nada no diário/feed hoje)';

    const prompt = `Toques de humor de hoje (em ordem):\n${linhasHumor}\n\nO que a pessoa escreveu/postou hoje:\n${linhasPosts}\n\nEscreva o resumo do dia dessa pessoa.`;

    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: 'Você escreve o "resumo do dia" de um app de diário pessoal chamado Átomo, em português do Brasil. '
              + 'Tom: acolhedor e natural, como uma amiga observadora — nunca clínico, nunca soando como diagnóstico psicológico. '
              + 'Baseie-se nos toques de humor registrados e no que a pessoa escreveu/postou no dia (cite algo específico do que ela escreveu, se houver). '
              + 'Feche sempre com uma dica prática e curta (um exercício, respiração, alongamento, ou pequena atitude) que combine com o humor predominante do dia. '
              + 'No máximo 5 frases curtas, sem markdown, sem listas, no máximo 1 emoji.'
          }]
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.85 }
      })
    });

    if (!resp.ok) { console.log('gemini resumo: status', resp.status, await resp.text()); return null; }
    const data = await resp.json();
    const texto = data && data.candidates && data.candidates[0] && data.candidates[0].content
      && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
      && data.candidates[0].content.parts[0].text;
    return texto ? texto.trim() : null;
  } catch (erro) {
    console.log('erro ao gerar resumo do dia com IA:', erro.message);
    return null;
  }
}

// escolhe a mensagem do dia por rotação (não por sorteio), pra nunca repetir
// em dias seguidos — cada dia do calendário sempre cai num índice diferente
// do anterior, e só volta a repetir depois de passar por todas as frases
function indiceRotativoDoDia(dataYyyyMmDd, tamanho) {
  const [ano, mes, dia] = dataYyyyMmDd.split('-').map(Number);
  const diasDesdeEpoca = Math.floor(Date.UTC(ano, mes - 1, dia) / 86400000);
  return ((diasDesdeEpoca % tamanho) + tamanho) % tamanho;
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

    // lembretes de itens do checklist (Home) — cada item pode ter um horário
    // próprio escolhido pelo usuário; só avisa quem ainda não marcou como feito
    // e ainda não recebeu o aviso hoje
    const { data: itensLembrete } = await supabaseAdmin
      .from('checklist_itens')
      .select('id, usuario_id, texto, horario_lembrete_min, ultimo_lembrete_data, feito')
      .not('horario_lembrete_min', 'is', null)
      .eq('feito', false)
      .gte('horario_lembrete_min', minutosAgora)
      .lt('horario_lembrete_min', minutosAgora + JANELA_CRON_MIN);

    const precisamLembrete = (itensLembrete || []).filter(it => it.ultimo_lembrete_data !== hojeBrasilia);

    for (const it of precisamLembrete) {
      totalEnviadas += await enviarPushParaUsuario(it.usuario_id, '✅ Lembrete', it.texto);
      await supabaseAdmin.from('checklist_itens').update({ ultimo_lembrete_data: hojeBrasilia }).eq('id', it.id);
    }

    // resumo do dia — gerado uma vez, no fim do dia (mesma janela da notificação
    // da noite), a partir dos toques de humor registrados hoje (humor_eventos).
    // dia com poucos toques não gera resumo nenhum (não tem narrativa que preste).
    let resumosGerados = 0;
    if (dentroJanelaNoite) {
      const inicioHojeUTC = new Date(Date.UTC(agoraBrasilia.getFullYear(), agoraBrasilia.getMonth(), agoraBrasilia.getDate(), 3, 0, 0));
      const { data: eventosHoje } = await supabaseAdmin
        .from('humor_eventos')
        .select('usuario_id, emocao, criado_em')
        .gte('criado_em', inicioHojeUTC.toISOString())
        .order('criado_em', { ascending: true });

      const porUsuario = {};
      (eventosHoje || []).forEach((e) => {
        if (!porUsuario[e.usuario_id]) porUsuario[e.usuario_id] = [];
        porUsuario[e.usuario_id].push(e);
      });

      for (const usuarioId of Object.keys(porUsuario)) {
        const eventosDoUsuario = porUsuario[usuarioId];
        if (eventosDoUsuario.length < MIN_EVENTOS_PRO_RESUMO) continue;

        const { data: jaTemResumo } = await supabaseAdmin
          .from('resumos_dia').select('id').eq('usuario_id', usuarioId).eq('data', hojeBrasilia).maybeSingle();
        if (jaTemResumo) continue;

        const { data: postsHoje } = await supabaseAdmin
          .from('posts').select('tipo, texto').eq('autor_id', usuarioId)
          .is('clube_id', null).gte('criado_em', inicioHojeUTC.toISOString());

        const texto = (await gerarResumoComIA(eventosDoUsuario, postsHoje)) || gerarTextoResumo(eventosDoUsuario);
        if (!texto) continue;
        await supabaseAdmin.from('resumos_dia').insert({ usuario_id: usuarioId, data: hojeBrasilia, texto });
        totalEnviadas += await enviarPushParaUsuario(usuarioId, '📊 Seu resumo do dia chegou', 'toque pra ver como foi seu dia');
        resumosGerados++;
      }
    }

    // aviso do cartão de signo (opcional, só quem ativou e escolheu o signo) —
    // um teaser de manhã; o texto de verdade só é buscado quando abre o app
    // (evita gastar cota da API de horóscopo com gente que nem vai abrir)
    let signosAvisados = 0;
    const dentroJanelaSigno = minutosAgora >= HORARIO_SIGNO_MIN && minutosAgora < HORARIO_SIGNO_MIN + JANELA_CRON_MIN;
    if (dentroJanelaSigno) {
      const { data: usuariosComSigno } = await supabaseAdmin
        .from('usuarios')
        .select('id, ultimo_signo_notif_data')
        .eq('signo_ativado', true)
        .not('meu_signo', 'is', null);
      const precisamSigno = (usuariosComSigno || []).filter(u => u.ultimo_signo_notif_data !== hojeBrasilia);
      for (const u of precisamSigno) {
        totalEnviadas += await enviarPushParaUsuario(u.id, '✨ Seu horóscopo chegou', 'confira como está seu dia');
        await supabaseAdmin.from('usuarios').update({ ultimo_signo_notif_data: hojeBrasilia }).eq('id', u.id);
        signosAvisados++;
      }
    }

    res.json({ ok: true, manha: precisamManha.length, noite: precisamNoite.length, lembretes: precisamLembrete.length, resumos: resumosGerados, signos: signosAvisados, notificacoesEnviadas: totalEnviadas });
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

// legenda pra post de LISTA (vários filmes no mesmo post) — usada no especial
// de domingo, com a abertura pedida por ela (pipoca, domingão, crush)
function gerarLegendaListaFilmes(filmes, generoLabel) {
  const abertura = `🍿 domingão pede sofá, pipoca e um crush novo de cinema — ${filmes.length} sugestões de ${generoLabel || 'filme'} pra hoje:`;
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
  const limite = buscando ? 10 : 5;
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const itens = [];
  const autorVitrine = AUTORES_BRASILEIROS_DESTAQUE[(pagina - 1) % AUTORES_BRASILEIROS_DESTAQUE.length];

  // as 3 fontes agora rodam EM PARALELO (antes era uma await depois da outra,
  // then na pratica a busca demorava a soma do tempo das 3 — agora demora
  // so o tempo da mais lenta das 3). Cada uma continua com seu try/catch
  // isolado: se uma falhar ou demorar mais, as outras aparecem normal.
  const [itensGoogle, itensOpenLibrary, itensGutendex] = await Promise.all([
    (async () => {
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
          `https://openlibrary.org/search.json?${queryOpenLibrary}&language=por&limit=${limite}&page=${pagina}`,
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
          `https://gutendex.com/books/?languages=pt&${queryGutendex}&page=${pagina}`,
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
  ]);
  itens.push(...itensGoogle, ...itensOpenLibrary, ...itensGutendex);

  // ordena em duas camadas: primeiro quem dá pra ler dentro do app de
  // verdade (Gutendex sempre, Open Library só quando tem cópia completa no
  // Internet Archive) — Google Books e Open Library sem cópia completa vão
  // pro final, já que só abrem uma amostra ou o site de origem. Dentro de
  // cada grupo, reforça a prioridade de português: mesmo pedindo só PT nas
  // 3 fontes, o filtro de idioma de cada API (principalmente o langRestrict
  // do Google Books) às vezes deixa passar item em outro idioma — inclusive
  // espanhol, que compartilha muito acento com o português (por isso usa a
  // mesma heurística pareceTextoEmPortugues() de cima, que já pesa isso).
  const daPraLerNoApp = it => it.fonte === 'Gutendex' || (it.fonte === 'Open Library' && it.leituraCompleta);
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

// mapa signo em portugues -> parametro em ingles que a API Ninjas espera
const SIGNO_PARA_ZODIAC = {
  'Áries': 'aries', 'Touro': 'taurus', 'Gêmeos': 'gemini', 'Câncer': 'cancer',
  'Leão': 'leo', 'Virgem': 'virgo', 'Libra': 'libra', 'Escorpião': 'scorpio',
  'Sagitário': 'sagittarius', 'Capricórnio': 'capricorn', 'Aquário': 'aquarius', 'Peixes': 'pisces',
};

// traduz um texto curto en->pt-BR via MyMemory (gratuita, sem chave). A API
// Ninjas do horóscopo só devolve em inglês, e o app é todo em português - sem
// isso o cartão do signo ia destoar do resto (regra da Aline: nada de "sensação
// estrangeira/genérica" no app). Se a tradução falhar por qualquer motivo,
// devolve o texto original em inglês em vez de quebrar o cartão.
async function traduzirParaPortugues(texto) {
  if (!texto) return texto;
  try {
    const resposta = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=en|pt-BR`
    );
    const dados = await resposta.json();
    const traduzido = dados && dados.responseData && dados.responseData.translatedText;
    return traduzido || texto;
  } catch (erro) {
    console.log('erro ao traduzir horóscopo:', erro.message);
    return texto;
  }
}

// horoscopo diario (cartao "signo" na Home) - via API Ninjas (só devolve em
// inglês), traduzido pro português antes de mandar pro app.
app.get('/api/horoscopo', async (req, res) => {
  if (!process.env.API_NINJAS_KEY) {
    return res.status(500).json({ erro: 'faltou configurar API_NINJAS_KEY no servidor.env' });
  }
  const zodiac = SIGNO_PARA_ZODIAC[req.query.signo];
  if (!zodiac) return res.status(400).json({ erro: 'signo inválido' });
  try {
    const resposta = await fetch(`https://api.api-ninjas.com/v1/horoscope?zodiac_sign=${zodiac}`, {
      headers: { 'X-Api-Key': process.env.API_NINJAS_KEY },
    });
    const dados = await resposta.json();
    if (!dados.horoscope) return res.json({ texto: null });
    const texto = await traduzirParaPortugues(dados.horoscope);
    res.json({ texto });
  } catch (erro) {
    res.status(500).json({ erro: 'falha ao buscar horóscopo' });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));