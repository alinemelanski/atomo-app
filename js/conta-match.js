/* js/conta-match.js — Match, sair da conta, editar perfil, avatar, overlays
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

window.abrirMatch = async function () {
document.getElementById('matchOverlay').classList.add('open');
document.getElementById('matchCirculos').innerHTML = `<div class="visitor-lock-note">Procurando gente com interesse parecido...</div>`;

const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const { data: todosUsuarios } = await supabaseClient
  .from('usuarios').select('id, handle, avatar_url, assuntos_favoritos, genero, match_preferencia').neq('id', meuId);

const compativeis = (todosUsuarios || [])
  .filter(u => {
    // se você definiu preferência, o gênero da pessoa precisa bater (a não ser que você aceite "Todos")
    const euAceito = !minhaMatchPref.length || minhaMatchPref.includes('Todos') || minhaMatchPref.includes(u.genero);
    return euAceito;
  })
  .map(u => {
    const interesses = u.assuntos_favoritos || [];
    const emComum = interesses.filter(a => assuntosFavoritos.includes(a));
    return { ...u, emComum: emComum.length };
  })
  .filter(u => u.emComum > 0)
  .sort((a, b) => b.emComum - a.emComum);

if (!compativeis.length) {
  document.getElementById('matchCirculos').innerHTML = `<div class="visitor-lock-note">Ninguém com interesse em comum ainda. Volte mais tarde 🌱</div>`;
  return;
}

window.MATCH_CANDIDATOS = compativeis;

document.getElementById('matchCirculos').innerHTML = compativeis.map((u, i) => `
    <div style="text-align:center; cursor:pointer;" onclick="abrirDetalheMatch(${i})">
      <div class="friend-avatar" style="width:64px; height:64px; font-size:22px; margin:0 auto 6px; ${avatarEstiloBg(u.avatar_url)}">${avatarConteudo(u.avatar_url)}</div>
      <div style="font-size:10px; color:var(--ink-dim); font-weight:800;">@${u.handle}</div>
    </div>`).join('');
};

window.abrirDetalheMatch = function (i) {
const pessoa = window.MATCH_CANDIDATOS[i];
window.MATCH_CANDIDATO_ATUAL = pessoa;
const avatarEl = document.getElementById('matchConfirmAvatar');
if (pessoa.avatar_url) {
  avatarEl.style.backgroundImage = `url('${pessoa.avatar_url}')`;
  avatarEl.style.backgroundSize = 'cover';
  avatarEl.innerHTML = '';
} else {
  avatarEl.style.backgroundImage = '';
  avatarEl.innerHTML = ATOMO_AVATAR_SVG;
}
document.getElementById('matchConfirmTitulo').textContent = `Dar match com @${pessoa.handle}?`;
document.getElementById('matchConfirmOverlay').classList.add('open');
};

window.confirmarMatch = async function () {
const pessoa = window.MATCH_CANDIDATO_ATUAL;
closeOverlay('matchConfirmOverlay');
if (!pessoa) return;

const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

await supabaseClient.from('seguidores').insert({ seguidor_id: meuId, seguido_id: pessoa.id }).select();

const { data: elaMeSegue } = await supabaseClient
  .from('seguidores').select('id').eq('seguidor_id', pessoa.id).eq('seguido_id', meuId).maybeSingle();

if (elaMeSegue) {
  if (navigator.vibrate) navigator.vibrate([20, 50, 20, 50, 20]);
  mostrarToast('💛 Deu match! Abrindo conversa...');
  closeOverlay('matchOverlay');
  abrirDm(pessoa.id, pessoa.handle);
} else {
  mostrarToast(`Interesse registrado! Se @${pessoa.handle} também topar, vira match.`);
}
};

window.sairDaConta = async function () {
console.log('1. clicou em sair');
const { error } = await supabaseClient.auth.signOut();
console.log('2. signOut terminou, erro:', error);
location.reload();
};

window.abrirEditarPerfil = function () {
  document.getElementById('perfilInfoOverlay').classList.remove('open');
  document.getElementById('editNomeInput').value = document.getElementById('profNome').textContent;
  document.getElementById('editHandleInput').value = document.getElementById('profHandle').textContent.replace('@', '');
  document.getElementById('editBioInput').value = document.getElementById('profBio').textContent;
  renderGeneroGrid();
  document.getElementById('editarPerfilOverlay').classList.add('open');
};
let arquivoAvatarEscolhido = null;

window.previewAvatarEscolhido = function (el) {
const input = el || document.getElementById('editAvatarInput');
if (!input.files || !input.files[0]) return;
arquivoAvatarEscolhido = input.files[0];

const preview = document.getElementById('editAvatarPreview');
preview.src = URL.createObjectURL(arquivoAvatarEscolhido);
preview.style.display = 'block';
};

async function subirAvatar(usuarioId) {
if (!arquivoAvatarEscolhido) return null;

// IMPORTANTE: o upload de avatar NAO vai mais direto do navegador pro
// Supabase Storage. Existe um bug confirmado nas politicas de RLS do
// bucket "avatars": mesmo com uma politica de INSERT corretamente
// configurada (testado ate com "with check (bucket_id = 'avatars')",
// sem checar mais nada), o Supabase recusa qualquer objeto NOVO nesse
// bucket - so aceita quando ja existe um arquivo com aquele nome (UPDATE).
// Isso trava qualquer usuario que nunca subiu avatar antes. A solucao foi
// mover o upload pro servidor (rota /api/upload-avatar em servidor.js),
// que usa a service role e ignora RLS - so quem manda um token valido do
// proprio usuario consegue subir avatar, e so na propria pasta.
try {
  const base64Completo = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(arquivoAvatarEscolhido);
  });
  const imagemBase64 = base64Completo.split(',')[1];

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    mostrarToast('❌ sessão expirada, sai e entra de novo');
    return null;
  }

  const resp = await fetch(`${API_BASE}/api/upload-avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      imagemBase64,
      contentType: arquivoAvatarEscolhido.type || 'image/jpeg'
    })
  });
  const resultado = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    console.log('ERRO COMPLETO DO UPLOAD DE AVATAR:', resultado);
    mostrarToast('❌ erro no upload: ' + (resultado.erro || 'desconhecido'));
    return null;
  }

  return resultado.url;
} catch (e) {
  console.log('ERRO INESPERADO NO UPLOAD DE AVATAR:', e);
  mostrarToast('❌ erro no upload');
  return null;
}
}
// ---------- arrastar da borda esquerda pra voltar (swipe-back), mesma
// sensação de navegação nativa do iOS/Android nas telas cheias ----------
(function configurarSwipeBackOverlays() {
const LIMIAR_BORDA = 28;
const LIMIAR_ARRASTO = 70;
const LIMIAR_VERTICAL = 60;
let overlayAtual = null, inicioX = 0, inicioY = 0, arrastando = false;

document.addEventListener('touchstart', (e) => {
  const overlay = e.target.closest('.dm-chat-overlay.open');
  if (!overlay) return;
  const toque = e.touches[0];
  if (toque.clientX > LIMIAR_BORDA) return;
  overlayAtual = overlay;
  inicioX = toque.clientX;
  inicioY = toque.clientY;
  arrastando = true;
  overlayAtual.classList.add('sem-transicao-swipe');
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (!arrastando || !overlayAtual) return;
  const toque = e.touches[0];
  const dx = toque.clientX - inicioX;
  const dy = Math.abs(toque.clientY - inicioY);
  if (dy > LIMIAR_VERTICAL) { arrastando = false; overlayAtual.classList.remove('sem-transicao-swipe'); overlayAtual.style.transform = ''; return; }
  if (dx > 0) overlayAtual.style.transform = `translateX(${Math.min(dx, 140)}px)`;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  if (!arrastando || !overlayAtual) return;
  const toque = e.changedTouches[0];
  const dx = toque.clientX - inicioX;
  const overlayFechando = overlayAtual;
  overlayFechando.classList.remove('sem-transicao-swipe');
  overlayFechando.style.transform = '';
  if (dx > LIMIAR_ARRASTO && typeof window.closeOverlay === 'function') {
    window.closeOverlay(overlayFechando.id);
  }
  overlayAtual = null;
  arrastando = false;
}, { passive: true });
})();

window.closeOverlay = function (id) {
document.getElementById(id).classList.remove('open');
// sair da conversa de DM sempre resincroniza a lista/bolinha de não lida —
// rede de segurança pro caso da marcação de "lida" lá dentro ter atrasado
// ou falhado por algum motivo (RLS, corrida com o realtime, etc.)
if (id === 'dmChatOverlay' && typeof atualizarBadgeMensagens === 'function') {
  atualizarBadgeMensagens();
  desconectarCanalDigitando();
}
};
window.salvarPerfil = async function () {
const nome = document.getElementById('editNomeInput').value.trim();
const handle = document.getElementById('editHandleInput').value.trim().replace('@', '');
const bio = document.getElementById('editBioInput').value.trim();
if (!nome || !handle) {
  mostrarToast('❌ preenche nome e @usuário');
  return;
}

const btnSalvar = document.getElementById('btnSalvarPerfil');
if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.textContent = 'Salvando...'; }

const { data: sessionData } = await supabaseClient.auth.getSession();
const usuarioId = sessionData.session.user.id;

const novoAvatarUrl = await subirAvatar(usuarioId);
if (arquivoAvatarEscolhido && !novoAvatarUrl) {
  // subirAvatar ja mostrou o toast de erro especifico do upload
  if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar'; }
  return;
}

const dadosParaSalvar = { nome, handle, bio, genero: meuGenero };
if (novoAvatarUrl) dadosParaSalvar.avatar_url = novoAvatarUrl;

const { error } = await supabaseClient
  .from('usuarios')
  .update(dadosParaSalvar)
  .eq('id', usuarioId);

if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar'; }
if (error) { mostrarToast('❌ erro: ' + error.message); return; }

document.getElementById('profNome').textContent = nome;
document.getElementById('profHandle').textContent = '@' + handle;
document.getElementById('profBio').textContent = bio;
if (novoAvatarUrl) aplicarFotoPerfil(novoAvatarUrl);
const elSaudacaoHomeEdit = document.getElementById('homeSaudacaoTitulo');
if (elSaudacaoHomeEdit) {
  const primeiroNomeEdit = (nome && nome.trim().split(/\s+/)[0]) || (handle && ('@' + handle)) || 'por aqui';
  elSaudacaoHomeEdit.textContent = 'Olá, ' + primeiroNomeEdit;
}

closeOverlay('editarPerfilOverlay');
mostrarToast('✨ Perfil atualizado');
};

function aplicarFotoPerfil(url) {
['perfilProprioAvatarTop', 'perfilProprioAvatarPopup'].forEach(id => {
  const avatarDiv = document.getElementById(id);
  if (!avatarDiv) return;
  avatarDiv.style.backgroundImage = `url('${url}')`;
  avatarDiv.style.backgroundSize = 'cover';
  avatarDiv.style.backgroundPosition = 'center';
  avatarDiv.textContent = '';
});
}
