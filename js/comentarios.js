/* js/comentarios.js — Comentários e compartilhar post
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- comentários ----------
let comentarioPostIdx = null;
let comentarioPostArray = null; // qual array o índice acima se refere — feedPosts por padrão,
                                 // mas pode ser outro (ex: posts de um perfil de outra pessoa)
let respostaPendenteId = null;

window.responderComentario = function (comentarioId, nome) {
  respostaPendenteId = comentarioId;
  const input = document.getElementById('comentarioInput');
  input.placeholder = `Respondendo @${nome}...`;
  input.focus();
};
window.abrirComentarios = async function (i, arr) {
comentarioPostIdx = i;
comentarioPostArray = arr || feedPosts;
const p = comentarioPostArray[i];
document.getElementById('comentariosPostOriginal').innerHTML = `
    <div class="post-head">
      ${avatarHtml(p.avatarUrl, p.iniciais)}
      <div class="post-who"><div class="n">@${p.autor}</div><div class="t">${p.tempo}</div></div>
      <span class="post-tag">${p.tipo}</span>
    </div>
    <div class="post-body">${formatarMencoes(p.texto)}</div>
    <div class="post-actions" style="margin-top:8px;">
      <div class="post-action ${p.curtiu ? 'liked' : ''}" id="curtirBtnComentarios" onclick="curtirPostComentarios(event)">${icone('curtir',14)} <span id="curtirCountComentarios">${p.likes}</span></div>
    </div>`;

const { data, error } = await supabaseClient
  .from('comentarios')
  .select('*, usuarios(handle, avatar_url)')
  .eq('post_id', p.id)
  .order('criado_em', { ascending: true });

const principais = (data || []).filter(c => !c.resposta_a_id);
const respostas = (data || []).filter(c => c.resposta_a_id);

function montarComentario(c, ehResposta) {
  const nome = c.usuarios ? c.usuarios.handle : 'alguem';
  const avatarUrlComentario = c.usuarios ? c.usuarios.avatar_url : null;
  return `<div class="comment-item" style="${ehResposta ? 'margin-left:30px;' : ''}">
      ${avatarHtml(avatarUrlComentario, nome[0], { classe: 'ic' })}
      <div>
        <div class="cn">@${nome}</div>
        <div class="ct">${formatarMencoes(c.texto)}</div>
        <div class="post-action" style="font-size:10px; margin-top:2px; cursor:pointer;" onclick="responderComentario(${c.id}, '${nome}')">${icone('responder',12)} responder</div>
      </div>
    </div>`;
}

document.getElementById('comentariosList').innerHTML = principais.length
  ? principais.map(c => {
      const filhos = respostas.filter(r => r.resposta_a_id === c.id);
      return montarComentario(c, false) + filhos.map(f => montarComentario(f, true)).join('');
    }).join('')
  : `<div class="visitor-lock-note">Seja a primeira pessoa a comentar 💬</div>`;
document.getElementById('comentariosOverlay').classList.add('open');
};

// curtir o post de dentro da tela de comentarios - faltava um jeito de curtir
// aqui (só dava pra curtir voltando pro feed), então quem abria o post por uma
// notificação (que já cai direto nos comentários) não conseguia curtir nada
window.curtirPostComentarios = async function (evt) {
const p = (comentarioPostArray || feedPosts)[comentarioPostIdx];
if (!p) return;
if (navigator.vibrate) navigator.vibrate(15);
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const jaCurtia = p.curtiu;
p.curtiu = !jaCurtia;
p.likes = (p.likes || 0) + (jaCurtia ? -1 : 1);
const btn = document.getElementById('curtirBtnComentarios');
const contador = document.getElementById('curtirCountComentarios');
if (btn) btn.classList.toggle('liked', p.curtiu);
if (contador) contador.textContent = p.likes;

let erro;
if (jaCurtia) {
  ({ error: erro } = await supabaseClient.from('curtidas').delete().eq('post_id', p.id).eq('usuario_id', meuId));
} else {
  ({ error: erro } = await supabaseClient.from('curtidas').insert({ post_id: p.id, usuario_id: meuId }));
}

if (erro) {
  p.curtiu = jaCurtia;
  p.likes = (p.likes || 0) + (jaCurtia ? 1 : -1);
  if (btn) btn.classList.toggle('liked', p.curtiu);
  if (contador) contador.textContent = p.likes;
  mostrarToast('❌ erro ao curtir: ' + erro.message);
  return;
}
if (!jaCurtia && p.autor_id !== meuId) {
  const { data: donoDoPost } = await supabaseClient.from('usuarios').select('notif_ativado').eq('id', p.autor_id).maybeSingle();
  if (!donoDoPost || donoDoPost.notif_ativado !== false) {
    await supabaseClient.from('notificacoes').insert({
      usuario_id: p.autor_id, tipo: 'curtida', titulo: 'Nova curtida',
      subtitulo: `@${window.MEU_HANDLE || 'alguém'} curtiu seu post`, post_id: p.id, ator_id: meuId,
    });
  }
  notificarPushEvento(p.autor_id, 'curtida', { post_id: p.id, ator_id: meuId });
}
if (comentarioPostArray === feedPosts || !comentarioPostArray) renderFeed();
};

function renderComentarios() {
  const lista = (comentarioPostArray || feedPosts)[comentarioPostIdx].comentarios;
  document.getElementById('comentariosList').innerHTML = lista.length
    ? lista.map(c => `<div class="comment-item"><div class="ic">${c.autor[0].toUpperCase()}</div><div><div class="cn">@${c.autor}</div><div class="ct">${formatarMencoes(c.texto)}</div></div></div>`).join('')
    : `<div class="visitor-lock-note">Seja a primeira pessoa a comentar 💬</div>`;
}
window.enviarComentario = async function () {
const input = document.getElementById('comentarioInput');
const texto = input.value.trim();
if (!texto) return;

const p = (comentarioPostArray || feedPosts)[comentarioPostIdx];
const { data: sessionData } = await supabaseClient.auth.getSession();

const { error } = await supabaseClient.from('comentarios').insert({
  post_id: p.id,
  autor_id: sessionData.session.user.id,
  texto: texto,
  resposta_a_id: respostaPendenteId,
});

if (error) { mostrarToast('❌ erro: ' + error.message); return; }

if (p.autor_id !== sessionData.session.user.id) {
  const { data: donoDoPost } = await supabaseClient.from('usuarios').select('notif_ativado').eq('id', p.autor_id).maybeSingle();
  if (!donoDoPost || donoDoPost.notif_ativado !== false) {
    await supabaseClient.from('notificacoes').insert({
      usuario_id: p.autor_id,
      tipo: 'comentario',
      titulo: 'Novo comentário no seu post',
      subtitulo: texto.slice(0, 60),
      post_id: p.id,
      ator_id: sessionData.session.user.id,
    });
    notificarPushEvento(p.autor_id, 'comentario', { texto, post_id: p.id, ator_id: sessionData.session.user.id });
  }
}
notificarMencoes(texto, sessionData.session.user.id, 'num comentário');

input.value = '';
input.placeholder = 'Escreva um comentário...';
respostaPendenteId = null;
const arrayAtual = comentarioPostArray;
abrirComentarios(comentarioPostIdx, arrayAtual);
if (arrayAtual === feedPosts || !arrayAtual) carregarPostsReais();
};

// ---------- compartilhar ----------
let compartilharPostIdx = null;
window.abrirCompartilhar = function (i) {
  compartilharPostIdx = i;
  document.getElementById('compartilharOpcoesPrincipais').style.display = 'block';
  document.getElementById('compartilharAmigosPicker').style.display = 'none';
  document.getElementById('compartilharPopupBg').classList.add('show');
};
window.fecharCompartilhar = function () {
  document.getElementById('compartilharPopupBg').classList.remove('show');
};
window.fecharPickerAmigos = function () {
  document.getElementById('compartilharAmigosPicker').style.display = 'none';
  document.getElementById('compartilharOpcoesPrincipais').style.display = 'block';
};
window.abrirEnviarParaAmigo = function () {
  const lista = (SEGUINDO || []);
  document.getElementById('compartilharOpcoesPrincipais').style.display = 'none';
  document.getElementById('compartilharAmigosPicker').style.display = 'block';
  const wrap = document.getElementById('compartilharAmigosLista');
  wrap.innerHTML = lista.length
    ? lista.map(a => `<div class="dm-list-row" onclick="enviarPostParaAmigo('${a.id}')"><div class="friend-avatar" style="${avatarEstiloBg(a.avatar)}">${avatarConteudo(a.avatar)}</div><div class="dm-preview"><div class="n">@${a.nome}</div></div></div>`).join('')
    : `<div class="visitor-lock-note">Você ainda não segue ninguém — segue alguém primeiro pra poder mandar posts 💬</div>`;
};
window.enviarPostParaAmigo = async function (amigoId) {
  const post = feedPosts[compartilharPostIdx];
  if (!post) return;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session.user.id;
  const conversaId = await encontrarOuCriarConversa(amigoId, meuId);
  if (!conversaId) { mostrarToast('❌ erro ao enviar'); return; }
  const payload = JSON.stringify({ texto: post.texto, autor: post.autor, tipo: post.tipo, imagem_url: post.imagem_url || null, video_url: post.video_url || null });
  const { error } = await supabaseClient.from('mensagens').insert({ conversa_id: conversaId, autor_id: meuId, texto: payload, tipo_conteudo: 'post' });
  if (error) { mostrarToast('❌ erro ao enviar: ' + error.message); return; }
  fecharCompartilhar();
  mostrarToast('📤 Post enviado!');
  notificarPushEvento(amigoId, 'mensagem', { ator_id: meuId });
};
window.repostarNoFeed = async function () {
  const original = feedPosts[compartilharPostIdx];
  if (!original) return;
  fecharCompartilhar();
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session.user.id;
  const { error } = await supabaseClient.from('posts').insert({
    autor_id: meuId,
    texto: `🔁 repostou de @${original.autor}: "${original.texto}"`,
    tipo: original.tipo,
    privado: false,
    imagem_url: original.imagem_url || null,
    video_url: original.video_url || null,
    ref_titulo: original.ref ? original.ref.titulo : null,
    ref_autor: original.ref ? original.ref.autor : null,
    ref_citacao: original.ref ? original.ref.citacao : null,
    ref_trailer: original.ref ? original.ref.trailer : null,
    ref_livro_id: original.ref ? original.ref.livroId : null,
    ref_filme_id: original.ref ? original.ref.filmeId : null,
    ref_capa: original.ref ? original.ref.capa : null,
  });
  if (error) { mostrarToast('❌ erro ao repostar: ' + error.message); return; }
  mostrarToast('🔁 Repostado no seu feed');
  carregarPostsReais();
};
window.copiarLink = async function () {
  const post = feedPosts[compartilharPostIdx];
  const textoCompartilhar = post ? `"${post.texto}" — via Átomo` : 'Átomo — meu diário e perfil intelectual';
  const urlApp = 'https://atomoapp.netlify.app';
  fecharCompartilhar();

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Átomo', text: textoCompartilhar, url: urlApp });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return; // usuário cancelou o compartilhamento, tudo bem
    }
  }

  try {
    await navigator.clipboard.writeText(`${textoCompartilhar}\n${urlApp}`);
    mostrarToast('🔗 Link copiado! Cole onde quiser compartilhar');
  } catch (e) {
    mostrarToast('😕 não consegui copiar o link — tenta de novo');
  }
};
