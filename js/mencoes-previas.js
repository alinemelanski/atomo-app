/* js/mencoes-previas.js — @menções, embed de vídeo e prévias que tocam sozinhas
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- @mencoes ----------
window.MEUS_AMIGOS_MENCAO = [];

async function carregarAmigosParaMencao() {
  const meuId = window.MEU_USUARIO_ID;
  if (!meuId) return;
  const { data: seguindoRows } = await supabaseClient
    .from('seguidores').select('seguido_id').eq('seguidor_id', meuId);
  const ids = (seguindoRows || []).map(r => r.seguido_id);
  if (!ids.length) { window.MEUS_AMIGOS_MENCAO = []; return; }
  const { data: usuariosSeguidos } = await supabaseClient
    .from('usuarios').select('id, handle').in('id', ids);
  window.MEUS_AMIGOS_MENCAO = usuariosSeguidos || [];
}

let mencaoDropdownEl = null;
function fecharMencaoDropdown() {
  if (mencaoDropdownEl) { mencaoDropdownEl.remove(); mencaoDropdownEl = null; }
}

function aplicarMencaoEscolhida(inputEl, handle) {
  const val = inputEl.value;
  const pos = inputEl.selectionStart;
  const antesCursor = val.slice(0, pos);
  const m = antesCursor.match(/@([a-zA-Z0-9_.]*)$/);
  if (!m) { fecharMencaoDropdown(); return; }
  const inicio = pos - m[0].length;
  const novoValor = val.slice(0, inicio) + '@' + handle + ' ' + val.slice(pos);
  inputEl.value = novoValor;
  const novaPos = inicio + handle.length + 2;
  inputEl.focus();
  inputEl.setSelectionRange(novaPos, novaPos);
  fecharMencaoDropdown();
}

function abrirMencaoDropdown(inputEl, candidatos) {
  fecharMencaoDropdown();
  if (!candidatos.length) return;
  const rect = inputEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'mencao-dropdown';
  const altura = Math.min(candidatos.length, 5) * 36 + 8;
  el.style.left = Math.round(rect.left) + 'px';
  el.style.top = Math.round(rect.top - altura - 6) + 'px';
  el.style.width = Math.max(160, Math.round(rect.width * 0.75)) + 'px';
  el.innerHTML = candidatos.slice(0, 5).map(u => `<div class="mencao-item" data-handle="${u.handle}">@${u.handle}</div>`).join('');
  document.body.appendChild(el);
  el.querySelectorAll('.mencao-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      aplicarMencaoEscolhida(inputEl, item.dataset.handle);
    });
  });
  mencaoDropdownEl = el;
}

function atualizarMencaoDropdown(inputEl) {
  const val = inputEl.value;
  const pos = inputEl.selectionStart;
  const antesCursor = val.slice(0, pos);
  const m = antesCursor.match(/@([a-zA-Z0-9_.]*)$/);
  if (!m) { fecharMencaoDropdown(); return; }
  const termo = m[1].toLowerCase();
  const candidatos = (window.MEUS_AMIGOS_MENCAO || []).filter(u => u.handle.toLowerCase().includes(termo));
  abrirMencaoDropdown(inputEl, candidatos);
}

function ativarMencao(inputEl) {
  if (!inputEl || inputEl.dataset.mencaoAtiva) return;
  inputEl.dataset.mencaoAtiva = '1';
  inputEl.addEventListener('input', () => atualizarMencaoDropdown(inputEl));
  inputEl.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) atualizarMencaoDropdown(inputEl);
  });
  inputEl.addEventListener('blur', () => setTimeout(fecharMencaoDropdown, 150));
}

window.ativarMencaoEmTodosComposers = function () {
  ['composerText', 'composerExplorarText', 'clubeComposerText', 'comentarioInput', 'dmChatInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) ativarMencao(el);
  });
};

window.formatarMencoes = function (texto) {
  if (!texto) return texto;
  return texto.replace(/@([a-zA-Z0-9_.]+)/g, (match, handle) =>
    `<span class="mencao-texto-link" onclick="event.stopPropagation(); abrirPerfilPorHandle('${handle}')">@${handle}</span>`);
};

// ---------- embed automatico de video (link do youtube/vimeo colado no texto do post/diario) ----------
const REGEX_YOUTUBE_EMBED = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,15})/;
const REGEX_VIMEO_EMBED = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/;

window.extrairVideoEmbedHtml = function (texto) {
  if (!texto) return '';
  const mYoutube = texto.match(REGEX_YOUTUBE_EMBED);
  if (mYoutube) {
    return `<div class="post-video-embed" data-video-embed><iframe data-src="https://www.youtube.com/embed/${mYoutube[1]}" allow="autoplay; encrypted-media; fullscreen"></iframe></div>`;
  }
  const mVimeo = texto.match(REGEX_VIMEO_EMBED);
  if (mVimeo) {
    return `<div class="post-video-embed" data-video-embed><iframe data-src="https://player.vimeo.com/video/${mVimeo[1]}" allow="autoplay; encrypted-media; fullscreen"></iframe></div>`;
  }
  return '';
};

// ---------- prévias (filme, música, podcast e vídeo de post) tocam sozinhas, mudas, quando aparecem na tela ----------
// regras: só uma prévia de cada vez (a mais visível), sempre começa muda (o navegador só
// libera autoplay assim), toque no card liga/desliga o som, para ao sair da tela / da aba
// e respeita o "economizar dados" do celular
const CACHE_URL_PREVIA = new Map();
let previaAutoAtiva = null;
const previasVisiveis = new Map();
const economizandoDados = () => !!(navigator.connection && navigator.connection.saveData);

window.pararPreviaAuto = function () {
  if (!previaAutoAtiva) return;
  const { el, audio } = previaAutoAtiva;
  if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  el.innerHTML = '';
  el.classList.remove('audio');
  delete el.dataset.mudo;
  previaAutoAtiva = null;
};

async function urlPreviaAuto(el) {
  if (el.dataset.url) return el.dataset.url;
  const chave = el.dataset.filme ? 'f' + el.dataset.filme : el.dataset.podcast ? 'p' + el.dataset.podcast : null;
  if (!chave) return null;
  if (CACHE_URL_PREVIA.has(chave)) return CACHE_URL_PREVIA.get(chave);
  const rota = el.dataset.filme ? 'filme-trailer?id=' + el.dataset.filme : 'podcast-episodio?id=' + el.dataset.podcast;
  let url = null;
  try { const r = await fetch(API_BASE + '/api/' + rota); const d = await r.json(); url = d.url || null; } catch (e) { /* sem prévia */ }
  CACHE_URL_PREVIA.set(chave, url);
  return url;
}

async function tocarPreviaAuto(el) {
  if (previaAutoAtiva && previaAutoAtiva.el === el) return;
  if (economizandoDados() || document.hidden) return;
  window.pararPreviaAuto();
  const ficha = { el };
  previaAutoAtiva = ficha;
  const url = await urlPreviaAuto(el);
  if (previaAutoAtiva !== ficha) return; // saiu da tela enquanto buscava
  if (!url) { previaAutoAtiva = null; return; }
  const tipo = el.dataset.tipo;
  if (tipo === 'Música' || tipo === 'Podcast') {
    el.classList.add('audio');
    el.innerHTML = '<div class="eq"><i></i><i></i><i></i><i></i></div><div class="trilha"><div class="fill"></div></div><span class="som">🔇</span>';
    const audio = new Audio(url);
    audio.muted = true; audio.loop = true; audio.preload = 'auto';
    audio.ontimeupdate = () => {
      const fill = el.querySelector('.fill');
      if (fill && audio.duration) fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
    };
    ficha.audio = audio;
    audio.play().catch(() => {});
  } else {
    const id = (url.split('v=')[1] || '').split('&')[0];
    if (!id) { previaAutoAtiva = null; return; }
    el.dataset.mudo = '1';
    el.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id + '?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=' + id + '&enablejsapi=1" allow="autoplay; encrypted-media" tabindex="-1"></iframe><div class="auto-previa-toque"></div><span class="som">🔇</span>';
  }
}

// toque no card: se já está tocando, liga/desliga o som; se não, abre o pop-up de sempre
window.cliquePreviaAuto = function (el) {
  if (previaAutoAtiva && previaAutoAtiva.el === el) {
    const som = el.querySelector('.som');
    if (previaAutoAtiva.audio) {
      const a = previaAutoAtiva.audio;
      a.muted = !a.muted;
      if (som) som.textContent = a.muted ? '🔇' : '🔊';
    } else {
      const iframe = el.querySelector('iframe');
      const estavaMudo = el.dataset.mudo !== '0';
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: estavaMudo ? 'unMute' : 'mute', args: [] }), '*');
      }
      el.dataset.mudo = estavaMudo ? '0' : '1';
      if (som) som.textContent = estavaMudo ? '🔊' : '🔇';
    }
    return;
  }
  urlPreviaAuto(el).then(u => {
    if (u) { window.pararPreviaAuto(); abrirTrailerPopup(u, el.dataset.tipo); }
    else mostrarToast('😕 sem prévia disponível');
  });
};

function escolherPreviaMaisVisivel() {
  let melhor = null, maior = 0;
  previasVisiveis.forEach((ratio, el) => {
    if (!el.isConnected) { previasVisiveis.delete(el); return; }
    if (ratio > maior) { maior = ratio; melhor = el; }
  });
  if (melhor) tocarPreviaAuto(melhor); else window.pararPreviaAuto();
}

const observadorPrevias = new IntersectionObserver((entradas) => {
  entradas.forEach(en => {
    if (en.isIntersecting && en.intersectionRatio >= 0.6) previasVisiveis.set(en.target, en.intersectionRatio);
    else previasVisiveis.delete(en.target);
  });
  escolherPreviaMaisVisivel();
}, { threshold: [0, 0.6, 0.8, 1] });

// vídeos enviados nos posts: tocam mudos em loop enquanto aparecem, pausam ao sair
const observadorVideoPost = new IntersectionObserver((entradas) => {
  entradas.forEach(en => {
    const v = en.target;
    if (en.isIntersecting && !economizandoDados()) v.play().catch(() => {});
    else v.pause();
  });
}, { threshold: 0.55 });

document.addEventListener('click', (ev) => {
  const v = ev.target.closest && ev.target.closest('video[data-auto-video]');
  if (!v) return;
  v.muted = !v.muted;
  mostrarToast(v.muted ? '🔇 sem som' : '🔊 com som');
});

document.addEventListener('visibilitychange', () => { if (document.hidden) window.pararPreviaAuto(); });

function registrarPreviasAuto() {
  document.querySelectorAll('[data-auto-previa]:not([data-obs])').forEach(el => { el.dataset.obs = '1'; observadorPrevias.observe(el); });
  document.querySelectorAll('video[data-auto-video]:not([data-obs])').forEach(v => { v.dataset.obs = '1'; observadorVideoPost.observe(v); });
}
let registroAgendado = false;
new MutationObserver(() => {
  if (registroAgendado) return;
  registroAgendado = true;
  requestAnimationFrame(() => { registroAgendado = false; registrarPreviasAuto(); });
}).observe(document.body, { childList: true, subtree: true });
registrarPreviasAuto();

// ---------- autoplay do embed de video só quando o post passa pela tela ----------
// (exige mudo: navegador só deixa autoplay sem gesto do usuario se comecar mudo)
let observadorVideoEmbed = null;
window.ativarAutoplayVideoEmbeds = function () {
  if (!observadorVideoEmbed) {
    observadorVideoEmbed = new IntersectionObserver((entradas) => {
      entradas.forEach(entrada => {
        const iframe = entrada.target.querySelector('iframe[data-src]');
        if (!iframe) return;
        if (entrada.isIntersecting) {
          if (!iframe.getAttribute('src')) {
            const base = iframe.dataset.src;
            const separador = base.includes('?') ? '&' : '?';
            // tira titulo/autor/engrenagem/barra de progresso/marca do player, deixa so o video tocando
            const paramAutoplay = base.includes('vimeo.com')
              ? 'autoplay=1&muted=1&controls=0&title=0&byline=0&portrait=0'
              : 'autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&playsinline=1';
            iframe.src = base + separador + paramAutoplay;
          }
        } else if (iframe.getAttribute('src')) {
          iframe.removeAttribute('src'); // sai da tela -- para o video, so retoma quando voltar a aparecer
        }
      });
    }, { threshold: 0.55 });
  }
  document.querySelectorAll('[data-video-embed]').forEach(el => observadorVideoEmbed.observe(el));
};

// mesma formatacao de mencao de sempre, mas tambem detecta e embeda um
// link de video do youtube/vimeo colado no texto (usado só no corpo de
// posts/diario -- comentario, checklist e DM continuam só com mencao)
window.formatarMencoesEVideo = function (texto) {
  return formatarMencoes(texto) + window.extrairVideoEmbedHtml(texto);
};

window.abrirPerfilPorHandle = async function (handle) {
  const { data: usuarioMencionado } = await supabaseClient.from('usuarios').select('id').eq('handle', handle).maybeSingle();
  if (usuarioMencionado && usuarioMencionado.id) window.abrirPerfilAlheio(usuarioMencionado.id);
};

async function notificarMencoes(texto, meuId, contexto) {
  if (!texto) return;
  const handles = [...new Set((texto.match(/@([a-zA-Z0-9_.]+)/g) || []).map(h => h.slice(1)))];
  if (!handles.length) return;
  const { data: usuariosMencionados } = await supabaseClient.from('usuarios').select('id, handle').in('handle', handles);
  for (const u of (usuariosMencionados || [])) {
    if (u.id === meuId) continue;
    await supabaseClient.from('notificacoes').insert({
      usuario_id: u.id,
      tipo: 'mencao',
      titulo: 'Te mencionaram',
      subtitulo: `@${window.MEU_HANDLE || 'alguém'} te mencionou ${contexto || 'no Átomo'}`,
      ator_id: meuId,
    });
    notificarPushEvento(u.id, 'mencao', { ator_id: meuId });
  }
}
