/* js/perfil.js — Selos no perfil, perfil de outras pessoas, perguntas anônimas, pedido de apoio
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

function renderSelosPerfil() {
  const semanasCompletas = Math.floor(streakAtual / 7);
  const desbloqueados = SELOS.filter((s, i) => seloDesbloqueado(i, semanasCompletas));
  document.getElementById('selosPerfilRow').innerHTML = desbloqueados.map(s =>
    `<div class="selo-circulo" onclick="abrirSeloIndividual('${s.nome}')" title="${s.nome}${s.frase ? ' — ' + s.frase : ''}">${conteudoSelo(s)}</div>`
  ).join('');
}

 // selos de outra pessoa: lê da tabela selos_desbloqueados (leitura liberada pra quem está logado)
async function renderSelosPerfilAlheio(autorId) {
  const linha = document.getElementById('perfilAlheioSelos');
  linha.innerHTML = '';
  try {
    const { data, error } = await supabaseClient.from('selos_desbloqueados').select('selo_numero').eq('usuario_id', autorId).order('selo_numero');
    if (error || !data) return;
    if (window.PERFIL_ALHEIO_ATUAL_ID !== autorId) return; // abriu outro perfil enquanto carregava
    linha.innerHTML = data.map(r => SELOS[r.selo_numero - 1]).filter(Boolean).map(s =>
      `<div class="selo-circulo" onclick="abrirSeloIndividual('${s.nome}')" title="${s.nome}${s.frase ? ' — ' + s.frase : ''}">${conteudoSelo(s)}</div>`
    ).join('');
  } catch (e) { /* sem selos: deixa a linha vazia */ }
}

// pílula "dias escrevendo" de outra pessoa.
// O número vem da função dias_escrevendo() do banco (rpc = chamar uma função
// do Postgres pelo Supabase). Ela olha as datas das escritas da pessoa e
// devolve só o número — o diário dela continua 100% privado.
async function renderStreakPerfilAlheio(autorId) {
  const wrap = document.getElementById('perfilAlheioStreakWrap');
  if (!wrap) return;
  wrap.style.display = 'none';
  try {
    const { data: dias, error } = await supabaseClient.rpc('dias_escrevendo', { p_usuario: autorId });
    if (error) { console.log('pílula do perfil alheio:', error.message); return; } // função ainda não criada no banco: só não mostra
    if (window.PERFIL_ALHEIO_ATUAL_ID !== autorId) return; // abriu outro perfil enquanto carregava
    document.getElementById('perfilAlheioStreakTxt').textContent =
      dias > 0 ? t(dias === 1 ? 'pilula_dia' : 'pilula_dias', { n: dias }) : t('pilula_zero');
    // mesma barrinha da sua pílula: enche ao longo de cada semana
    const pct = dias > 0 ? (((dias - 1) % 7) + 1) / 7 * 100 : 0;
    const fill = document.getElementById('perfilAlheioStreakFill');
    fill.style.width = '0%';
    wrap.style.display = '';
    requestAnimationFrame(() => { fill.style.width = pct + '%'; });
  } catch (e) { /* sem rede: só não mostra a pílula */ }
}

//checar novo selo(streak antigo e streak novo

async function checarNovoSelo(streakAntigo, streakNovo) {

const semanasAntes = Math.floor(streakAntigo / 7);
const semanasDepois = Math.floor(streakNovo / 7);
if (semanasDepois > semanasAntes && semanasDepois <= SELOS.length) {
  const selo = SELOS[semanasDepois - 1];

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!selosGanhos.has(semanasDepois)) {
    selosGanhos.add(semanasDepois);
    try { localStorage.setItem('atomo_selos_' + sessionData.session.user.id, JSON.stringify([...selosGanhos])); } catch (e) { /* sem storage */ }
    await supabaseClient.from('selos_desbloqueados').insert({
      usuario_id: sessionData.session.user.id,
      selo_numero: semanasDepois,
    });
    renderSelosPerfil();
  }

  const svgGrandeEl = document.getElementById('seloGrandeSvg');
  svgGrandeEl.innerHTML = conteudoSelo(selo);
  svgGrandeEl.classList.remove('celebra');
  void svgGrandeEl.offsetWidth;
  svgGrandeEl.classList.add('celebra');
  document.getElementById('seloTitulo').textContent = `Novo selo: "${selo.nome}"`;
  document.getElementById('seloTexto').textContent = selo.frase || 'Uma semana inteira escrevendo. Guardado na sua coleção \ud83d\udcee';
  document.getElementById('seloCelebracao').classList.add('show');
  vibrar([30, 60, 30, 60, 90]); tocarSom('selo');
  return true;
}
return false;
}

window.fecharSeloCelebracao = function () {
document.getElementById('seloCelebracao').classList.remove('show');

};

let perfilAlheioPostsAtuais = [];

function renderPerfilAlheioPosts() {
const lista = perfilAlheioPostsAtuais;
document.getElementById('perfilAlheioPosts').innerHTML = lista.length
  ? lista.map((p, i) => `
        <div class="post">
          <div class="post-body">${formatarMencoes(p.texto)}</div>
          <div style="font-size:10px; color:var(--ink-faint); margin-top:6px; margin-bottom:8px;">${p.tipo} · ${p.tempo}</div>
          <div class="post-actions">
            <div class="post-action ${p.curtiu ? 'liked' : ''}${p.id === postRecemCurtidoId ? ' pulando' : ''}" onclick="curtirPostAlheio(${i}, event)">${icone('curtir',14,i)} ${p.likes}</div>
            <div class="post-action" onclick="abrirComentarios(${i}, perfilAlheioPostsAtuais)">${icone('comentar',14,i)} ${p.comentarios.length}</div>
          </div>
        </div>`).join('')
  : `<div class="visitor-lock-note">Nada compartilhado ainda.</div>`;
postRecemCurtidoId = null; // já pulou: no próximo desenho ninguém pula
}

window.curtirPostAlheio = async function (i, evt) {
vibrar(15);
const post = perfilAlheioPostsAtuais[i];
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const jaCurtia = post.curtiu;
post.curtiu = !jaCurtia;
post.likes = (post.likes || 0) + (jaCurtia ? -1 : 1);
postRecemCurtidoId = jaCurtia ? null : post.id; // só este coração pula (variável criada em feed.js)
renderPerfilAlheioPosts();

let erro;
if (jaCurtia) {
  ({ error: erro } = await supabaseClient.from('curtidas').delete().eq('post_id', post.id).eq('usuario_id', meuId));
} else {
  ({ error: erro } = await supabaseClient.from('curtidas').insert({ post_id: post.id, usuario_id: meuId }));
}

if (erro) {
  post.curtiu = jaCurtia;
  post.likes = (post.likes || 0) + (jaCurtia ? 1 : -1);
  renderPerfilAlheioPosts();
  mostrarToast('❌ erro ao curtir: ' + erro.message);
} else if (!jaCurtia && post.autor_id !== meuId) {
  const { data: donoDoPost } = await supabaseClient.from('usuarios').select('notif_ativado').eq('id', post.autor_id).maybeSingle();
  if (!donoDoPost || donoDoPost.notif_ativado !== false) {
    const { error: erroNotif } = await supabaseClient.from('notificacoes').insert({
      usuario_id: post.autor_id,
      tipo: 'curtida',
      titulo: 'Nova curtida',
      subtitulo: `@${window.MEU_HANDLE || 'alguém'} curtiu seu post`,
      post_id: post.id,
      ator_id: meuId,
    });
    if (erroNotif) console.log('erro ao criar notificação de curtida:', erroNotif.message);
  }
  notificarPushEvento(post.autor_id, 'curtida', { post_id: post.id, ator_id: meuId });
}
};

// Estrela dourada quando a pessoa é favorita: liga/desliga a classe .favoritado
// no botão do perfil da conversa e no item "Favoritar" do menu do perfil
// (a cor fica no CSS: css/mensagens.css)
window.marcarFavoritoVisual = function (favorito) {
const labelChat = document.getElementById('dmInfoFavoritarLabel');
if (labelChat && labelChat.parentElement) labelChat.parentElement.classList.toggle('favoritado', !!favorito);
const btnPerfil = document.getElementById('perfilAlheioFavoritarBtn');
if (btnPerfil) btnPerfil.classList.toggle('favoritado', !!favorito);
};

window.favoritarUsuarioAtual = async function () {
const autorId = window.PERFIL_ALHEIO_ATUAL_ID;
if (!autorId) return;
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;
const btnPerfil = document.getElementById('perfilAlheioFavoritarBtn');
const labelChat = document.getElementById('dmInfoFavoritarLabel');
const { data: jaFavoritado } = await supabaseClient.from('amigos_favoritos').select('amigo_id').eq('usuario_id', meuId).eq('amigo_id', autorId).maybeSingle();
if (jaFavoritado) {
  const { error } = await supabaseClient.from('amigos_favoritos').delete().eq('usuario_id', meuId).eq('amigo_id', autorId);
  if (error) { mostrarToast('❌ ' + error.message); return; }
  mostrarToast('☆ removido dos favoritos');
  if (btnPerfil) btnPerfil.innerHTML = icone('estrela',13) + ' Favoritar';
  if (labelChat) labelChat.textContent = 'Favoritar';
  marcarFavoritoVisual(false);
} else {
  const { error } = await supabaseClient.from('amigos_favoritos').insert({ usuario_id: meuId, amigo_id: autorId });
  if (error) { mostrarToast('❌ ' + error.message); return; }
  mostrarToast('⭐ adicionado aos favoritos');
  if (btnPerfil) btnPerfil.innerHTML = icone('estrela',13) + ' Desfavoritar';
  if (labelChat) labelChat.textContent = 'Desfavoritar';
  marcarFavoritoVisual(true);
}
};

window.abrirPerfilAlheio = async function (autorId) {
window.PERFIL_ALHEIO_ATUAL_ID = autorId;
// limpa a foto de quem foi aberto antes, pra ela não aparecer enquanto o novo perfil carrega
const avatarAnterior = document.getElementById('perfilAlheioAvatar');
if (avatarAnterior) { avatarAnterior.style.backgroundImage = 'none'; avatarAnterior.textContent = ''; }

const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

if (autorId === meuId) {
  showScreen2('perfil');
  return;
}

const { data: usuario } = await supabaseClient
  .from('usuarios').select('*').eq('id', autorId).maybeSingle();

if (!usuario) return;
  const { data: sessionData2 } = await supabaseClient.auth.getSession();
const { data: jaBloqueado } = await supabaseClient.from('bloqueios').select('id').eq('usuario_id', sessionData2.session.user.id).eq('bloqueado_id', autorId).maybeSingle();
document.getElementById('perfilAlheioBloquearBtn').innerHTML = jaBloqueado ? (icone('check',13) + ' Desbloquear') : (icone('bloquear',13) + ' Bloquear');
const { data: jaFavoritado } = await supabaseClient.from('amigos_favoritos').select('amigo_id').eq('usuario_id', meuId).eq('amigo_id', autorId).maybeSingle();
document.getElementById('perfilAlheioFavoritarBtn').innerHTML = jaFavoritado ? (icone('estrela',13) + ' Desfavoritar') : (icone('estrela',13) + ' Favoritar');
marcarFavoritoVisual(!!jaFavoritado);
document.getElementById('perfilAlheioTitulo').textContent = '@' + usuario.handle;
document.getElementById('perfilAlheioNome').textContent = usuario.nome;
document.getElementById('perfilAlheioHandle').textContent = '@' + usuario.handle;
document.getElementById('perfilAlheioBio').textContent = usuario.bio || '';
renderSelosPerfilAlheio(autorId); // selos da pessoa (qualquer um pode ver)
renderStreakPerfilAlheio(autorId); // dias escrevendo da pessoa (só o número)

// A tela do perfil de outra pessoa é UMA SÓ e é reaproveitada pra todo mundo.
// Bug antigo: ao abrir alguém SEM foto depois de alguém COM foto, a foto da
// pessoa anterior continuava no fundo (ninguém apagava o backgroundImage) e a
// inicial aparecia por cima dela. Agora os dois casos limpam o que o outro deixou.
const avatarDiv = document.getElementById('perfilAlheioAvatar');
if (usuario.avatar_url) {
  avatarDiv.style.backgroundImage = `url('${usuario.avatar_url}')`;
  avatarDiv.style.backgroundSize = 'cover';
  avatarDiv.style.backgroundPosition = 'center';
  avatarDiv.textContent = '';
} else {
  avatarDiv.style.backgroundImage = 'none';
  avatarDiv.innerHTML = ATOMO_AVATAR_SVG; // sem foto: cara do átomo
}

const { data: jaSigo } = await supabaseClient
  .from('seguidores').select('id').eq('seguidor_id', meuId).eq('seguido_id', autorId).maybeSingle();

const btnSeguir = document.getElementById('perfilAlheioSeguirBtn');
btnSeguir.textContent = jaSigo ? 'Seguindo' : 'Seguir';
btnSeguir.classList.toggle('pendente', !!jaSigo);
btnSeguir.dataset.autorId = autorId;
btnSeguir.dataset.jaSigo = jaSigo ? 'sim' : 'nao';
document.getElementById('perfilAlheioMenu').style.display = 'none';

const { count: countSeguidores } = await supabaseClient
  .from('seguidores').select('id', { count: 'exact', head: true }).eq('seguido_id', autorId);
const { count: countSeguindo } = await supabaseClient
  .from('seguidores').select('id', { count: 'exact', head: true }).eq('seguidor_id', autorId);
document.getElementById('perfilAlheioSeguidoresCount').textContent = countSeguidores || 0;
document.getElementById('perfilAlheioSeguindoCount').textContent = countSeguindo || 0;

const { data: posts } = await supabaseClient
  .from('posts').select('*').eq('autor_id', autorId).eq('privado', false).is('clube_id', null).is('comunidade_estudo_id', null)
  .order('criado_em', { ascending: false });

const idsPosts = (posts || []).map(p => p.id);
const { data: curtidasPerfil } = await supabaseClient
  .from('curtidas').select('post_id, usuario_id').in('post_id', idsPosts.length ? idsPosts : [0]);
const { data: comentariosPerfil } = await supabaseClient
  .from('comentarios').select('post_id').in('post_id', idsPosts.length ? idsPosts : [0]);

perfilAlheioPostsAtuais = (posts || []).map(p => {
  const curtidasDesse = (curtidasPerfil || []).filter(c => c.post_id === p.id);
  return {
    id: p.id,
    autor_id: p.autor_id,
    autor: usuario.handle,
    texto: p.texto,
    tipo: p.tipo,
    tempo: formatarTempoRelativo(p.criado_em),
    likes: curtidasDesse.length,
    curtiu: curtidasDesse.some(c => c.usuario_id === meuId),
    comentarios: (comentariosPerfil || []).filter(c => c.post_id === p.id),
  };
});
renderPerfilAlheioPosts();

await supabaseClient.from('visitas').insert({ visitante_id: meuId, visitado_id: autorId });
await renderPerguntasPublicas(autorId, 'perfilAlheioPerguntasArea');
await renderPedidoApoioAlheio(autorId);

document.getElementById('perfilAlheioOverlay').classList.add('open');
};

window.enviarDmDoPerfilAlheio = async function () {
const autorId = window.PERFIL_ALHEIO_ATUAL_ID;
if (!autorId) return;
const nome = document.getElementById('perfilAlheioNome').textContent || 'alguém';
closeOverlay('perfilAlheioOverlay');
await abrirDm(autorId, nome);
};

window.seguirDoOverlay = async function () {
const btn = document.getElementById('perfilAlheioSeguirBtn');
const autorId = btn.dataset.autorId;
const jaSigo = btn.dataset.jaSigo === 'sim';

const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

if (jaSigo) {
  const { error } = await supabaseClient.from('seguidores').delete().eq('seguidor_id', meuId).eq('seguido_id', autorId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  btn.textContent = 'Seguir';
  btn.classList.remove('pendente');
  btn.dataset.jaSigo = 'nao';
  mostrarToast('Deixou de seguir');
} else {
  const { error } = await supabaseClient.from('seguidores').insert({ seguidor_id: meuId, seguido_id: autorId });
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  btn.textContent = 'Seguindo';
  btn.classList.add('pendente');
  btn.dataset.jaSigo = 'sim';
  mostrarToast('💛 Agora você segue essa pessoa');
  await notificarNovoSeguidor(autorId, meuId);
}
};

async function notificarNovoSeguidor(seguidoId, seguidorId) {
if (seguidoId === seguidorId) return;
const { data: dono } = await supabaseClient.from('usuarios').select('notif_ativado, handle').eq('id', seguidoId).maybeSingle();
if (dono && dono.notif_ativado === false) return;
const { data: euUsuario } = await supabaseClient.from('usuarios').select('handle').eq('id', seguidorId).maybeSingle();
await supabaseClient.from('notificacoes').insert({
  usuario_id: seguidoId,
  tipo: 'seguidor',
  titulo: 'Novo seguidor',
  subtitulo: euUsuario ? `@${euUsuario.handle} começou a te seguir` : 'Alguém começou a te seguir',
  ator_id: seguidorId,
});
notificarPushEvento(seguidoId, 'seguidor', { ator_id: seguidorId });
}

// ---------- perguntas anônimas ----------
window.abrirPerguntaAnonima = function () {
if (!window.PERFIL_ALHEIO_ATUAL_ID) return;
document.getElementById('perguntaAnonimaTexto').value = '';
document.getElementById('perguntaAnonimaPopupBg').classList.add('show');
};

window.enviarPerguntaAnonima = async function () {
const texto = document.getElementById('perguntaAnonimaTexto').value.trim();
if (!texto) return;
const destinatarioId = window.PERFIL_ALHEIO_ATUAL_ID;
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const { error } = await supabaseClient.from('perguntas_anonimas').insert({
  destinatario_id: destinatarioId,
  remetente_id: meuId,
  pergunta: texto,
});

document.getElementById('perguntaAnonimaPopupBg').classList.remove('show');
if (error) { mostrarToast('❌ erro: ' + error.message); return; }
mostrarToast('❓ Pergunta enviada, sem o seu nome');

const { data: dono } = await supabaseClient.from('usuarios').select('notif_ativado').eq('id', destinatarioId).maybeSingle();
if (!dono || dono.notif_ativado !== false) {
  await supabaseClient.from('notificacoes').insert({
    usuario_id: destinatarioId,
    tipo: 'pergunta',
    titulo: 'Nova pergunta anônima',
    subtitulo: 'Alguém te mandou uma pergunta sem se identificar',
  });
}
};

async function renderPerguntasPublicas(autorId, containerId) {
const container = document.getElementById(containerId);
if (!container) return;
const { data: perguntas } = await supabaseClient
  .from('perguntas_anonimas')
  .select('id, pergunta, resposta, respondida_em')
  .eq('destinatario_id', autorId)
  .eq('respondida', true)
  .order('respondida_em', { ascending: false });

if (!perguntas || !perguntas.length) { container.innerHTML = ''; return; }

container.innerHTML = `
    <div style="font-size:11.5px; font-weight:800; color:var(--ink-dim); margin-bottom:8px;">❓ Perguntas anônimas respondidas</div>
    ${perguntas.map(p => `
      <div class="post" style="margin-bottom:8px;">
        <div style="font-size:12px; color:var(--ink-faint); margin-bottom:4px;">❓ ${p.pergunta}</div>
        <div class="post-body">${formatarMencoes(p.resposta)}</div>
      </div>`).join('')}
  `;
}

window.abrirPerguntasPendentes = async function () {
document.getElementById('perfilInfoOverlay').classList.remove('open');
document.getElementById('perguntasPendentesOverlay').classList.add('open');
await renderPerguntasPendentes();
};

async function renderPerguntasPendentes() {
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;
const { data: pendentes } = await supabaseClient
  .from('perguntas_anonimas')
  .select('id, pergunta, criado_em')
  .eq('destinatario_id', meuId)
  .eq('respondida', false)
  .order('criado_em', { ascending: false });

const lista = document.getElementById('perguntasPendentesList');
lista.innerHTML = (pendentes && pendentes.length)
  ? pendentes.map(p => `
      <div class="post" style="margin-bottom:10px;">
        <div class="post-body" style="margin-bottom:8px;">❓ ${p.pergunta}</div>
        <textarea id="respostaPergunta${p.id}" placeholder="Escreva sua resposta (vai aparecer pública no seu perfil e no feed)..." style="margin-bottom:8px;"></textarea>
        <div class="post-actions">
          <div class="post-action" onclick="responderPergunta(${p.id})">${icone('check',13)} Responder</div>
          <div class="post-action" onclick="descartarPergunta(${p.id})">${icone('lixeira',13)} Descartar</div>
        </div>
      </div>`).join('')
  : `<div class="visitor-lock-note">Nenhuma pergunta por enquanto.</div>`;

atualizarBadgePerguntasPendentes(pendentes ? pendentes.length : 0);
}

window.responderPergunta = async function (id) {
const campoResposta = document.getElementById(`respostaPergunta${id}`);
const resposta = campoResposta ? campoResposta.value.trim() : '';
if (!resposta) { mostrarToast('Escreve uma resposta antes de enviar'); return; }

const { data: linhaPergunta } = await supabaseClient.from('perguntas_anonimas').select('pergunta').eq('id', id).maybeSingle();
const perguntaOriginal = linhaPergunta ? linhaPergunta.pergunta : '';

const { error } = await supabaseClient.from('perguntas_anonimas')
  .update({ resposta, respondida: true, respondida_em: new Date().toISOString() })
  .eq('id', id);

if (error) { mostrarToast('❌ erro: ' + error.message); return; }

// a resposta também vai pro feed público (a pergunta continua anônima: quem perguntou não aparece)
try {
  const { data: sessaoResp } = await supabaseClient.auth.getSession();
  if (perguntaOriginal && sessaoResp.session) {
    await supabaseClient.from('posts').insert({
      autor_id: sessaoResp.session.user.id,
      texto: `❓ ${perguntaOriginal}\n\n${resposta}`,
      tipo: 'Assunto',
      privado: false,
    });
  }
} catch (e) { console.log('não consegui publicar a resposta no feed:', e); }

mostrarToast('✅ Resposta publicada no seu perfil e no feed');
avisarSeguidores();
await renderPerguntasPendentes();
await carregarPerguntasPublicasMinhas();
if (typeof carregarPostsReais === 'function') carregarPostsReais();
};

window.descartarPergunta = async function (id) {
const { error } = await supabaseClient.from('perguntas_anonimas').delete().eq('id', id);
if (error) { mostrarToast('❌ erro: ' + error.message); return; }
await renderPerguntasPendentes();
};

async function carregarPerguntasPublicasMinhas() {
if (!window.MEU_USUARIO_ID) return;
await renderPerguntasPublicas(window.MEU_USUARIO_ID, 'meuPerguntasArea');
}

// ---------- "o que eu preciso agora" -- pedidos de apoio entre amigos (seção
// separada das perguntas anônimas: aqui a pessoa aparece, e os amigos ajudam
// de verdade com abraço, conselho ou música) ----------
async function renderMeuPedidoApoio() {
const container = document.getElementById('meuApoioArea');
if (!container) return;
container.innerHTML = ''; // opção pausada por enquanto (a pedido da Aline)
return;
if (!window.MEU_USUARIO_ID) return;

const { data: pedido } = await supabaseClient.from('pedidos_apoio')
  .select('id, texto, criado_em').eq('usuario_id', window.MEU_USUARIO_ID).eq('ativo', true)
  .order('criado_em', { ascending: false }).limit(1).maybeSingle();

if (!pedido) {
  container.innerHTML = `
      <div class="apoio-card">
        <div class="apoio-card-titulo">💛 o que você precisa agora?</div>
        <div class="apoio-input-row">
          <input type="text" id="apoioNovoInput" placeholder="ex: um conselho, uma música, um abraço..." maxlength="140" onkeydown="if(event.key==='Enter') criarPedidoApoio()" />
          <button class="apoio-pedir-btn" onclick="criarPedidoApoio()">pedir</button>
        </div>
      </div>`;
  return;
}

const { data: respostas } = await supabaseClient.from('respostas_apoio').select('tipo').eq('pedido_id', pedido.id);
const porTipo = { abraco: 0, conselho: 0, musica: 0 };
(respostas || []).forEach(r => { if (porTipo[r.tipo] != null) porTipo[r.tipo]++; });

container.innerHTML = `
    <div class="apoio-card">
      <div class="apoio-card-titulo">💛 o que você precisa agora</div>
      <div class="apoio-texto-atual">${pedido.texto}</div>
      <div class="apoio-contagens">
        <div class="apoio-contagem-chip">${icone('curtir', 12)} ${porTipo.abraco}</div>
        <div class="apoio-contagem-chip">${icone('comentar', 12)} ${porTipo.conselho}</div>
        <div class="apoio-contagem-chip">${icone('nota', 12)} ${porTipo.musica}</div>
      </div>
      <div class="apoio-acoes-row">
        <button class="resumo-acao-btn compartilhar" onclick="abrirRespostasApoio(${pedido.id})">ver respostas</button>
        <button class="resumo-acao-btn dispensar" onclick="encerrarPedidoApoio(${pedido.id})">não preciso mais</button>
      </div>
    </div>`;
}

window.criarPedidoApoio = async function () {
const input = document.getElementById('apoioNovoInput');
const texto = input ? input.value.trim() : '';
if (!texto) { mostrarToast('escreve o que você precisa antes de pedir'); return; }
const { data: sessionData } = await supabaseClient.auth.getSession();
if (!sessionData.session) return;
const meuId = sessionData.session.user.id;
await supabaseClient.from('pedidos_apoio').update({ ativo: false }).eq('usuario_id', meuId).eq('ativo', true);
const { error } = await supabaseClient.from('pedidos_apoio').insert({ usuario_id: meuId, texto, ativo: true });
if (error) { mostrarToast('❌ erro: ' + error.message); return; }
mostrarToast('💛 pedido publicado no seu perfil');
renderMeuPedidoApoio();
};

window.encerrarPedidoApoio = async function (id) {
await supabaseClient.from('pedidos_apoio').update({ ativo: false }).eq('id', id);
renderMeuPedidoApoio();
};

window.abrirRespostasApoio = async function (pedidoId) {
const { data: respostas } = await supabaseClient.from('respostas_apoio')
  .select('tipo, conteudo, criado_em, usuario_id').eq('pedido_id', pedidoId).order('criado_em', { ascending: false });

const idsUsuarios = [...new Set((respostas || []).map(r => r.usuario_id))];
let perfis = {};
if (idsUsuarios.length) {
  const { data: usuarios } = await supabaseClient.from('usuarios').select('id, handle, nome').in('id', idsUsuarios);
  (usuarios || []).forEach(u => { perfis[u.id] = u; });
}

const LABEL_TIPO = { abraco: '🫂 mandou um abraço', conselho: '💬 deixou um conselho', musica: '🎵 mandou uma música' };
document.getElementById('respostasApoioList').innerHTML = (respostas && respostas.length)
  ? respostas.map(r => {
      const p = perfis[r.usuario_id];
      const nome = p ? (p.nome || ('@' + p.handle)) : 'alguém';
      return `
          <div class="friend-row">
            <div class="friend-info">
              <div class="n">${nome}</div>
              <div class="s" style="white-space:normal; line-height:1.4;">${LABEL_TIPO[r.tipo] || r.tipo}${r.conteudo ? ': ' + r.conteudo : ''}</div>
              <div class="s" style="opacity:.6; margin-top:2px;">${formatarTempoRelativo(r.criado_em)}</div>
            </div>
          </div>`;
    }).join('')
  : `<div class="visitor-lock-note">Ninguém respondeu ainda.</div>`;
document.getElementById('respostasApoioOverlay').classList.add('open');
};

// ---------- pedido de apoio no perfil de outra pessoa (quem visita responde) ----------
async function renderPedidoApoioAlheio(autorId) {
const container = document.getElementById('perfilAlheioApoioArea');
if (!container) return;

const { data: pedido } = await supabaseClient.from('pedidos_apoio')
  .select('id, texto, usuario_id').eq('usuario_id', autorId).eq('ativo', true)
  .order('criado_em', { ascending: false }).limit(1).maybeSingle();

if (!pedido) { container.innerHTML = ''; return; }

container.innerHTML = `
    <div class="apoio-card">
      <div class="apoio-card-titulo">💛 pediu apoio</div>
      <div class="apoio-texto-atual">${pedido.texto}</div>
      <div class="apoio-resposta-btns">
        <button class="apoio-resposta-btn" onclick="enviarRespostaApoio(${pedido.id}, '${pedido.usuario_id}', 'abraco')">${icone('curtir', 18)} abraço</button>
        <button class="apoio-resposta-btn" onclick="abrirCaixaRespostaApoio('conselho')">${icone('comentar', 18)} conselho</button>
        <button class="apoio-resposta-btn" onclick="abrirCaixaRespostaApoio('musica')">${icone('nota', 18)} música</button>
      </div>
      <div class="apoio-resposta-caixa" id="apoioCaixaConselho">
        <input type="text" id="apoioInputConselho" placeholder="escreve um conselho..." maxlength="280" />
        <button class="apoio-resposta-enviar" onclick="enviarRespostaApoio(${pedido.id}, '${pedido.usuario_id}', 'conselho')">${icone('enviar', 14, 0, '#fff')}</button>
      </div>
      <div class="apoio-resposta-caixa" id="apoioCaixaMusica">
        <input type="text" id="apoioInputMusica" placeholder="nome da música ou link..." maxlength="200" />
        <button class="apoio-resposta-enviar" onclick="enviarRespostaApoio(${pedido.id}, '${pedido.usuario_id}', 'musica')">${icone('enviar', 14, 0, '#fff')}</button>
      </div>
    </div>`;
}

window.abrirCaixaRespostaApoio = function (tipo) {
document.getElementById('apoioCaixaConselho').classList.toggle('on', tipo === 'conselho');
document.getElementById('apoioCaixaMusica').classList.toggle('on', tipo === 'musica');
};

window.enviarRespostaApoio = async function (pedidoId, destinatarioId, tipo) {
let conteudo = null;
if (tipo === 'conselho') {
  const input = document.getElementById('apoioInputConselho');
  conteudo = input ? input.value.trim() : '';
  if (!conteudo) { mostrarToast('escreve o conselho antes de enviar'); return; }
} else if (tipo === 'musica') {
  const input = document.getElementById('apoioInputMusica');
  conteudo = input ? input.value.trim() : '';
  if (!conteudo) { mostrarToast('cola o nome ou link da música'); return; }
}

const { data: sessionData } = await supabaseClient.auth.getSession();
if (!sessionData.session) return;
const meuId = sessionData.session.user.id;

const { error } = await supabaseClient.from('respostas_apoio').insert({ pedido_id: pedidoId, usuario_id: meuId, tipo, conteudo });
if (error) { mostrarToast('❌ erro: ' + error.message); return; }

const LABEL = { abraco: '🫂 abraço enviado', conselho: '💬 conselho enviado', musica: '🎵 música enviada' };
mostrarToast(LABEL[tipo] || 'enviado');
if (tipo === 'conselho') document.getElementById('apoioInputConselho').value = '';
if (tipo === 'musica') document.getElementById('apoioInputMusica').value = '';
document.getElementById('apoioCaixaConselho').classList.remove('on');
document.getElementById('apoioCaixaMusica').classList.remove('on');

notificarPushEvento(destinatarioId, 'apoio_' + tipo, { texto: conteudo });
};

async function atualizarBadgePerguntasPendentes(contagemConhecida) {
let n = contagemConhecida;
if (n === undefined) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  const { count } = await supabaseClient
    .from('perguntas_anonimas')
    .select('id', { count: 'exact', head: true })
    .eq('destinatario_id', sessionData.session.user.id)
    .eq('respondida', false);
  n = count || 0;
}
const badge = document.getElementById('perguntasPendentesBadge');
if (!badge) return;
badge.textContent = n;
badge.style.display = n > 0 ? 'inline-block' : 'none';
}

window.togglePerfilAlheioMenu = function () {
const menu = document.getElementById('perfilAlheioMenu');
menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
};
window.fecharPerfilAlheioMenu = function () {
document.getElementById('perfilAlheioMenu').style.display = 'none';
};
