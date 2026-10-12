/* js/mensagens.js — Rascunhos, lista de conversas, abrir DM, presença, tema da conversa
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- rascunhos: o que a pessoa deixou escrito e não enviou fica guardado ----------
const RASCUNHO_CAMPOS = ['composerText', 'perfilComposerText', 'composerExplorarText', 'clubeComposerText', 'comunidadeComposerText'];
function rascunhoChave(campo) { return 'atomo_draft_' + (window.MEU_USUARIO_ID || 'anon') + '_' + campo; }
window.lerRascunho = function (campo) {
  try { return localStorage.getItem(rascunhoChave(campo)) || ''; } catch (e) { return ''; }
};
window.salvarRascunho = function (campo, texto) {
  try {
    const k = rascunhoChave(campo);
    if (texto && texto.trim()) localStorage.setItem(k, texto); else localStorage.removeItem(k);
  } catch (e) { /* sem storage: só não guarda */ }
};
// os campos de escrita guardam sozinhos o que a pessoa digita; quando o app limpa o campo
// (depois de publicar) o rascunho some junto, porque o setter de .value também avisa
window.iniciarRascunhos = function () {
  const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  RASCUNHO_CAMPOS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.rascunho) return;
    el.dataset.rascunho = '1';
    Object.defineProperty(el, 'value', {
      configurable: true,
      get() { return desc.get.call(this); },
      set(v) { desc.set.call(this, v); window.salvarRascunho(id, v); }
    });
    el.addEventListener('input', () => window.salvarRascunho(id, desc.get.call(el)));
    const salvo = window.lerRascunho(id);
    if (salvo && !desc.get.call(el)) desc.set.call(el, salvo);
  });
};

  // ---------- mensagens ----------
const MAX_CONVERSAS_FIXADAS = 3;

async function renderDmList() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  const meuId = sessionData.session.user.id;

  const { data: conversas, error } = await supabaseClient
    .from('conversas')
    .select('*')
    .or(`usuario1_id.eq.${meuId},usuario2_id.eq.${meuId}`);

  if (error) { console.log('erro ao carregar conversas:', error.message); return; }

  const conversasVisiveis = (conversas || []).filter(c => {
    const souUsuario1 = c.usuario1_id === meuId;
    return souUsuario1 ? !c.oculta_de_usuario1 : !c.oculta_de_usuario2;
  });

  let totalNaoLidas = 0;
  const linhas = await Promise.all(conversasVisiveis.map(async (c) => {
    const outroId = c.usuario1_id === meuId ? c.usuario2_id : c.usuario1_id;

    const { data: outroUsuario } = await supabaseClient
      .from('usuarios').select('handle, avatar_url').eq('id', outroId).maybeSingle();

    const { data: ultimaMsg } = await supabaseClient
      .from('mensagens').select('texto, criado_em').eq('conversa_id', c.id)
      .order('criado_em', { ascending: false }).limit(1).maybeSingle();

    const { count: naoLidas } = await supabaseClient
      .from('mensagens').select('id', { count: 'exact', head: true })
      .eq('conversa_id', c.id).eq('autor_id', outroId).eq('lida', false);
    const qtdNaoLidas = naoLidas || 0;
    totalNaoLidas += qtdNaoLidas;

    const nome = outroUsuario ? outroUsuario.handle : 'alguém';
    const avatarUrl = outroUsuario ? outroUsuario.avatar_url : null;
    const fixada = !!c.fixada;
    // ordem de chegada: a conversa com a mensagem mais recente (minha ou dela) sobe pro topo
    const ordem = new Date((ultimaMsg && ultimaMsg.criado_em) || c.criado_em || 0).getTime() || 0;
    // texto que a pessoa deixou escrito e não enviou aparece como "draft:"
    const rascunho = (window.lerRascunho && window.lerRascunho('dm_' + c.id)) || '';
    const rascunhoSeguro = rascunho.slice(0, 80).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return { fixada, ordem, html: `<div class="dm-swipe-wrap" id="swipeWrap-${c.id}">
        <div class="dm-swipe-actions">
          <button class="dm-swipe-btn fixar" onclick="event.stopPropagation(); toggleFixarConversa('${c.id}', ${fixada})">${icone('estrela', 17)}${fixada ? 'desafixar' : 'fixar'}</button>
          <button class="dm-swipe-btn deletar" onclick="event.stopPropagation(); deletarConversa('${c.id}', ${c.usuario1_id === meuId})">${icone('lixeira', 17)}esconder</button>
        </div>
        <div class="dm-list-row dm-swipe-content ${fixada ? 'fixada' : ''}" onclick="abrirDm('${outroId}', '${nome}')">
          <div class="friend-avatar" style="${avatarEstiloBg(avatarUrl)}">${avatarConteudo(avatarUrl)}</div>
          <div class="dm-preview"><div class="n">${fixada ? icone('estrela', 11) + ' ' : ''}@${nome}</div><div class="msg">${rascunho ? `<span class="dm-draft">draft:</span> ${rascunhoSeguro}` : (ultimaMsg ? ultimaMsg.texto : 'nenhuma mensagem ainda')}</div></div>
          ${qtdNaoLidas ? `<span class="dm-unread-badge">${qtdNaoLidas > 9 ? '9+' : qtdNaoLidas}</span>` : ''}
        </div>
      </div>` };
  }));

  // conversas fixadas (ate 3) sempre no topo; o resto por ordem de chegada (mais recente primeiro)
  linhas.sort((a, b) => ((b.fixada ? 1 : 0) - (a.fixada ? 1 : 0)) || (b.ordem - a.ordem));

  document.getElementById('dmListWrap').innerHTML = linhas.length
    ? linhas.map(l => l.html).join('')
    : `<div class="visitor-lock-note">Nenhuma conversa ainda — toca no + aqui em cima pra começar uma 💬</div>`;

  const badge = document.getElementById('msgTabBadge');
  if (badge) badge.classList.toggle('on', totalNaoLidas > 0);

  initSwipeDm();
}

window.atualizarBadgeMensagens = renderDmList;

// ---------- deslizar uma conversa pra fixar ou excluir ----------
function initSwipeDm() {
  document.querySelectorAll('.dm-swipe-content').forEach(el => {
    let startX = 0, deltaX = 0, arrastando = false;
    el.addEventListener('touchstart', e => {
      document.querySelectorAll('.dm-swipe-content.aberta').forEach(o => {
        if (o !== el) {
          o.style.transform = ''; o.classList.remove('aberta');
          const outroWrap = o.closest('.dm-swipe-wrap');
          if (outroWrap) outroWrap.classList.remove('aberta');
        }
      });
      startX = e.touches[0].clientX;
      arrastando = true;
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!arrastando) return;
      deltaX = e.touches[0].clientX - startX;
      const base = el.classList.contains('aberta') ? -140 : 0;
      const pos = Math.max(-150, Math.min(0, base + deltaX));
      el.style.transform = `translateX(${pos}px)`;
    }, { passive: true });
    el.addEventListener('touchend', () => {
      if (!arrastando) return;
      arrastando = false;
      const wrap = el.closest('.dm-swipe-wrap');
      const base = el.classList.contains('aberta') ? -140 : 0;
      const final = base + deltaX;
      if (final < -70) {
        el.style.transform = 'translateX(-140px)'; el.classList.add('aberta');
        if (wrap) wrap.classList.add('aberta');
      } else {
        el.style.transform = ''; el.classList.remove('aberta');
        if (wrap) wrap.classList.remove('aberta');
      }
      deltaX = 0;
    });
  });
}

window.toggleFixarConversa = async function (conversaId, estavaFixada) {
  if (!estavaFixada) {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const meuId = sessionData.session.user.id;
    const { data: conversas } = await supabaseClient
      .from('conversas').select('id').or(`usuario1_id.eq.${meuId},usuario2_id.eq.${meuId}`).eq('fixada', true);
    if ((conversas || []).length >= MAX_CONVERSAS_FIXADAS) {
      mostrarToast(`📌 só dá pra fixar até ${MAX_CONVERSAS_FIXADAS} conversas — desfixa uma antes`);
      return;
    }
  }
  const { error } = await supabaseClient.from('conversas').update({ fixada: !estavaFixada }).eq('id', conversaId);
  if (error) { mostrarToast('❌ ' + error.message); return; }
  renderDmList();
};

window.deletarConversa = function (conversaId, souUsuario1) {
  abrirConfirmGenerico(
    'Esconder conversa?',
    'Ela some só da sua lista de mensagens — a outra pessoa continua vendo normalmente.',
    async () => {
      const campo = souUsuario1 ? 'oculta_de_usuario1' : 'oculta_de_usuario2';
      const { error } = await supabaseClient.from('conversas').update({ [campo]: true }).eq('id', conversaId);
      if (error) { mostrarToast('❌ ' + error.message); return; }
      mostrarToast('🙈 conversa escondida');
      renderDmList();
    }
  );
};

// ---------- confirmacao generica em vidro (reaproveitavel pra qualquer acao destrutiva) ----------
window.abrirConfirmGenerico = function (titulo, texto, aoConfirmar) {
  document.getElementById('confirmGenericoTitulo').textContent = titulo;
  document.getElementById('confirmGenericoTexto').textContent = texto;
  document.getElementById('confirmGenericoBtn').onclick = () => { closeOverlay('confirmGenericoOverlay'); aoConfirmar(); };
  document.getElementById('confirmGenericoOverlay').classList.add('open');
};

// ---------- mensagens: lista de conversas (sem física de bolinha, só busca por nome) ----------
window.abrirTelaMensagens = async function () {
  await renderDmList();
};

// ---------- busca do Explorar: expande inline, sem precisar abrir pagina
// (mesmo padrao visual da busca de Mensagens) ----------
window.toggleBuscaExplorar = function () {
  const widget = document.getElementById('explorarBuscaWidget');
  const topRow = widget.closest('.explorar-top-row');
  const dropdown = document.getElementById('buscaConteudoList');
  const input = document.getElementById('buscaConteudoInput');
  const iconeSvg = document.getElementById('explorarBuscaIconeSvg');
  const vaiAbrir = !widget.classList.contains('aberto');

  widget.classList.toggle('aberto', vaiAbrir);
  if (topRow) topRow.classList.toggle('busca-aberta', vaiAbrir);
  iconeSvg.innerHTML = vaiAbrir
    ? '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="color:var(--ink-dim)"/>'
    : '<path d="M11,4.2 C15,3.9 18.3,7.1 18,11.1 C18.3,15.2 14.7,18.4 10.7,18 C6.7,18.3 3.5,14.8 3.9,10.8 C3.6,6.7 7,3.9 11,4.2 Z" stroke="currentColor" stroke-width="1.7" style="color:var(--ink-dim)"/><path d="M17,17.3 C18.4,18.6 19.7,19.9 21.1,21.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" style="color:var(--ink-dim)"/>';

  input.value = '';
  dropdown.innerHTML = '';
  dropdown.classList.remove('show');
  if (vaiAbrir) setTimeout(() => input.focus(), 200); else input.blur();
};

window.toggleBuscaPoteAmigos = function () {
  const widget = document.getElementById('msgBuscaWidget');
  const topRow = document.getElementById('msgTopRow');
  const vaiAbrir = !widget.classList.contains('aberto');
  widget.classList.toggle('aberto', vaiAbrir);
  if (topRow) topRow.classList.toggle('busca-aberta', vaiAbrir);
  const input = document.getElementById('msgBuscaInput');
  if (vaiAbrir) { input.value = ''; setTimeout(() => input.focus(), 200); }
};

// lupa da busca do pote: abre a busca completa de outras pessoas (com foto e bio),
// ja com o que a pessoa tinha digitado
window.confirmarBuscaOutrosUsuarios = async function () {
  const termo = document.getElementById('msgBuscaInput').value.trim();
  await abrirNovaConversa();
  const input = document.getElementById('buscaPessoasInput');
  if (input) { input.value = termo; filtrarPessoas(); }
};
async function encontrarOuCriarConversa(outroId, meuId) {
const { data: existente } = await supabaseClient
  .from('conversas')
  .select('id')
  .or(`and(usuario1_id.eq.${meuId},usuario2_id.eq.${outroId}),and(usuario1_id.eq.${outroId},usuario2_id.eq.${meuId})`)
  .maybeSingle();

if (existente) return existente.id;

const { data: nova, error } = await supabaseClient
  .from('conversas')
  .insert({ usuario1_id: meuId, usuario2_id: outroId })
  .select()
  .single();

if (error) { console.log('erro ao criar conversa:', error.message); return null; }
return nova.id;
}

let conversaAbertaId = null;
let dmOutroUsuarioIdAtual = null;

// ---------- indicador "digitando..." no cabecalho do chat (Supabase Realtime
// Broadcast -- efemero, nao grava nada no banco, um canal por conversa) ----------
let canalDigitando = null;
let ultimoEnvioDigitando = 0;
let timeoutDigitandoRemoto = null;

function conectarCanalDigitando(convId, meuId) {
if (canalDigitando) { supabaseClient.removeChannel(canalDigitando); canalDigitando = null; }
canalDigitando = supabaseClient
  .channel('digitando-' + convId)
  .on('broadcast', { event: 'digitando' }, (msg) => {
    if (!msg.payload || msg.payload.autor === meuId) return;
    const statusEl = document.getElementById('dmChatStatus');
    if (!statusEl) return;
    statusEl.innerHTML = 'digitando<span class="digitando-dots"><span>.</span><span>.</span><span>.</span></span>';
    clearTimeout(timeoutDigitandoRemoto);
    // se a pessoa parar de digitar (sem mandar novo aviso por 2.5s), volta
    // a mostrar o status normal (online/visto por ultimo)
    timeoutDigitandoRemoto = setTimeout(() => {
      if (dmOutroUsuarioIdAtual) atualizarStatusChatHeader(dmOutroUsuarioIdAtual);
    }, 2500);
  })
  .subscribe();
}

window.sinalizarDigitando = function () {
if (!canalDigitando || !conversaAbertaId) return;
const agora = Date.now();
if (agora - ultimoEnvioDigitando < 1500) return; // throttle -- nao manda a cada tecla
ultimoEnvioDigitando = agora;
supabaseClient.auth.getSession().then(({ data }) => {
  if (!data.session) return;
  canalDigitando.send({ type: 'broadcast', event: 'digitando', payload: { autor: data.session.user.id } });
});
};

function desconectarCanalDigitando() {
if (canalDigitando) { supabaseClient.removeChannel(canalDigitando); canalDigitando = null; }
clearTimeout(timeoutDigitandoRemoto);
}

let dmTemaCorAtual = '';

function aplicarTemaConversa(cor) {
const overlay = document.getElementById('dmChatOverlay');
dmTemaCorAtual = cor || '';
if (!overlay) return;
if (dmTemaCorAtual) overlay.style.setProperty('--dm-tema-cor', dmTemaCorAtual);
else overlay.style.removeProperty('--dm-tema-cor');
}

window.toggleTemaConversaPicker = function () {
const row = document.getElementById('dmTemaPickerRow');
if (!row) return;
row.style.display = row.style.display === 'none' ? 'flex' : 'none';
};

window.escolherTemaConversa = async function (cor) {
if (!conversaAbertaId) return;
const { error } = await supabaseClient.from('conversas').update({ tema_cor: cor || null }).eq('id', conversaAbertaId);
if (error) { mostrarToast('❌ ' + error.message); return; }
aplicarTemaConversa(cor);
document.querySelectorAll('.dm-tema-swatch').forEach((s) => s.classList.toggle('selecionado', (s.dataset.cor || '') === (cor || '')));
mostrarToast('🎨 tema da conversa atualizado');
};

window.verPerfilCompletoDaConversa = function () {
closeOverlay('dmInfoOverlay');
closeOverlay('dmChatOverlay');
if (dmOutroUsuarioIdAtual) abrirPerfilAlheio(dmOutroUsuarioIdAtual);
};

// mini-perfil de dentro do chat (tipo "info da conversa" do Messenger/Instagram):
// so mostra atalhos rapidos daquela conversa — pra abrir o perfil completo da
// pessoa, precisa tocar em "Perfil" aqui dentro (verPerfilCompletoDaConversa)
window.abrirPerfilDoChat = async function () {
if (!dmOutroUsuarioIdAtual) return;
window.PERFIL_ALHEIO_ATUAL_ID = dmOutroUsuarioIdAtual;

const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const { data: usuario } = await supabaseClient.from('usuarios').select('handle, avatar_url, ultima_atividade').eq('id', dmOutroUsuarioIdAtual).maybeSingle();
if (usuario) {
  document.getElementById('dmInfoNome').textContent = '@' + usuario.handle;
  const avatarDiv = document.getElementById('dmInfoAvatar');
  if (usuario.avatar_url) {
    avatarDiv.style.backgroundImage = `url('${usuario.avatar_url}')`;
    avatarDiv.style.backgroundSize = 'cover';
    avatarDiv.textContent = '';
  } else {
    avatarDiv.style.backgroundImage = 'none';
    avatarDiv.innerHTML = ATOMO_AVATAR_SVG; // sem foto: cara do átomo
  }
  const info = textoUltimaAtividade(usuario.ultima_atividade);
  const statusEl = document.getElementById('dmInfoStatus');
  if (info) { statusEl.textContent = info.texto; statusEl.classList.toggle('online', !!info.online); }
  else { statusEl.textContent = ''; statusEl.classList.remove('online'); }
}

const { data: jaFavoritado } = await supabaseClient.from('amigos_favoritos').select('amigo_id').eq('usuario_id', meuId).eq('amigo_id', dmOutroUsuarioIdAtual).maybeSingle();
document.getElementById('dmInfoFavoritarLabel').textContent = jaFavoritado ? 'Desfavoritar' : 'Favoritar';

const { data: jaBloqueado } = await supabaseClient.from('bloqueios').select('id').eq('usuario_id', meuId).eq('bloqueado_id', dmOutroUsuarioIdAtual).maybeSingle();
document.getElementById('dmInfoBloquearLabel').textContent = jaBloqueado ? 'Desbloquear' : 'Bloquear';

document.getElementById('dmTemaPickerRow').style.display = 'none';
document.querySelectorAll('.dm-tema-swatch').forEach((s) => s.classList.toggle('selecionado', (s.dataset.cor || '') === dmTemaCorAtual));

document.getElementById('dmInfoOverlay').classList.add('open');
};

function iniciarHeartbeatPresenca(meuId) {
const marcarAtivo = () => {
  supabaseClient.from('usuarios').update({ ultima_atividade: new Date().toISOString() }).eq('id', meuId).then(() => {});
};
marcarAtivo();
setInterval(marcarAtivo, 45000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') marcarAtivo(); });
}

window.denunciarUsuarioAtual = function () {
if (!window.PERFIL_ALHEIO_ATUAL_ID) return;
fecharPerfilAlheioMenu();
abrirDenuncia(null, window.PERFIL_ALHEIO_ATUAL_ID);
};

function textoUltimaAtividade(dataIso) {
if (!dataIso) return '';
const diffMs = Date.now() - new Date(dataIso).getTime();
const min = Math.floor(diffMs / 60000);
if (min < 2) return { texto: 'online', online: true };
if (min < 60) return { texto: `visto(a) por último há ${min} min`, online: false };
const h = Math.floor(min / 60);
if (h < 24) return { texto: `visto(a) por último há ${h}h`, online: false };
const d = Math.floor(h / 24);
return { texto: `visto(a) por último há ${d}d`, online: false };
}

async function atualizarStatusChatHeader(outroId) {
const statusEl = document.getElementById('dmChatStatus');
if (!statusEl) return;
const { data } = await supabaseClient.from('usuarios').select('ultima_atividade').eq('id', outroId).maybeSingle();
const info = textoUltimaAtividade(data && data.ultima_atividade);
if (!info) { statusEl.textContent = ''; statusEl.classList.remove('online'); return; }
statusEl.textContent = info.texto;
statusEl.classList.toggle('online', !!info.online);
}

window.abrirDm = async function (outroId, outroNome) {
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

conversaAbertaId = await encontrarOuCriarConversa(outroId, meuId);
if (!conversaAbertaId) { mostrarToast('❌ erro ao abrir conversa'); return; }

conectarCanalDigitando(conversaAbertaId, meuId);
dmOutroUsuarioIdAtual = outroId;
document.getElementById('dmChatName').textContent = '@' + outroNome;
document.getElementById('dmChatOverlay').classList.add('open');
atualizarStatusChatHeader(outroId);

// rascunho: volta o que a pessoa tinha deixado escrito nessa conversa (e guarda o que ela digitar daqui pra frente)
const dmInput = document.getElementById('dmChatInput');
if (dmInput) {
  if (!dmInput.dataset.rascunho) {
    dmInput.dataset.rascunho = '1';
    dmInput.addEventListener('input', () => { if (conversaAbertaId) window.salvarRascunho('dm_' + conversaAbertaId, dmInput.value); });
  }
  dmInput.value = window.lerRascunho('dm_' + conversaAbertaId);
}

const { data: convData } = await supabaseClient.from('conversas').select('tema_cor').eq('id', conversaAbertaId).maybeSingle();
aplicarTemaConversa(convData && convData.tema_cor);

await renderDmMsgs();
// pequeno delay pra deixar o overlay terminar de aparecer antes de focar —
// focar antes do tempo faz o teclado empurrar a tela no meio da transição
setTimeout(() => {
  const input = document.getElementById('dmChatInput');
  if (input) input.focus();
}, 150);
};


async function renderDmMsgs() {
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const { data, error } = await supabaseClient
  .from('mensagens')
  .select('*')
  .eq('conversa_id', conversaAbertaId)
  .order('criado_em', { ascending: true });

if (error) { console.log('erro ao carregar mensagens:', error.message); return; }

document.getElementById('dmMessages').innerHTML = (data && data.length)
  ? data.map(m => {
      let conteudo;
      let classeExtra = '';
      if (m.tipo_conteudo === 'audio') {
        conteudo = vozBubbleHtml(m);
      } else if (m.tipo_conteudo === 'sticker') {
        conteudo = stickerHtml(m.texto, 56);
        classeExtra = ' sticker-bubble';
      } else if (m.tipo_conteudo === 'gif' || m.tipo_conteudo === 'foto') {
        conteudo = `<img src="${m.texto}" style="max-width:160px; border-radius:12px; display:block;" />`;
      } else if (m.tipo_conteudo === 'post') {
        conteudo = dmPostCompartilhadoHtml(m.texto);
        classeExtra = ' post-share-bubble';
      } else {
        conteudo = formatarMencoes(m.texto);
      }
      return `<div class="dm-bubble ${m.autor_id === meuId ? 'own' : 'other'}${classeExtra}">${conteudo}</div>`;
    }).join('')
  : `<div class="dm-empty-state">${icone('comentar',34)}<div class="titulo">Comece a conversa</div><div class="sub">Manda um oi, um GIF ou um sticker — a conversa começa aqui 💬</div></div>`;

const wrap = document.getElementById('dmMessages');
wrap.scrollTop = wrap.scrollHeight;

// marca como lidas as mensagens da outra pessoa que eu acabei de ver
const idsNaoLidas = (data || []).filter(m => m.autor_id !== meuId && m.lida === false).map(m => m.id);
if (idsNaoLidas.length) {
  const { error: erroLida } = await supabaseClient.from('mensagens').update({ lida: true }).in('id', idsNaoLidas);
  if (erroLida) console.log('erro ao marcar mensagem como lida:', erroLida.message);
  atualizarBadgeMensagens();
}
}

// renderiza a bolha de "post compartilhado" dentro da DM — se o texto não for
// o JSON esperado (mensagem antiga/de outro tipo), cai pro texto puro
function dmPostCompartilhadoHtml(textoBruto) {
try {
  const p = JSON.parse(textoBruto);
  return `<div class="dm-post-share">
      <div class="autor">@${p.autor || 'alguém'}</div>
      <div class="trecho">${(p.texto || '').slice(0, 140)}</div>
      ${p.imagem_url ? `<img src="${p.imagem_url}" />` : ''}
      ${p.video_url ? `<video src="${p.video_url}" controls style="max-width:170px; border-radius:12px; display:block;"></video>` : ''}
    </div>`;
} catch (e) {
  return textoBruto;
}
}

window.enviarFotoDm = async function (el) {
const input = el || document.getElementById('dmFotoInput');
if (!input.files || !input.files[0]) return;
const arquivo = input.files[0];

const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const extensao = arquivo.name.split('.').pop();
const caminho = `${meuId}/dm-${Date.now()}.${extensao}`;

const { error: erroUpload } = await supabaseClient.storage.from('midia-posts').upload(caminho, arquivo);
if (erroUpload) { mostrarToast('❌ erro no upload: ' + erroUpload.message); return; }

const { data } = supabaseClient.storage.from('midia-posts').getPublicUrl(caminho);

const { error } = await supabaseClient.from('mensagens').insert({
  conversa_id: conversaAbertaId,
  autor_id: meuId,
  texto: data.publicUrl,
  tipo_conteudo: 'foto',
});

if (error) { mostrarToast('❌ erro: ' + error.message); return; }

input.value = '';
await renderDmMsgs();
};
