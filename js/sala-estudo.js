/* js/sala-estudo.js — Sala de call de estudo ao vivo (Daily.co)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- sala de call de estudo ao vivo — áudio de verdade via Daily.co ----------
// (o timer pomodoro e os modos discussão/silêncio ficam só no seu aparelho,
// não sincronizam entre quem tá na sala — só o áudio é compartilhado de
// verdade; sincronizar o timer entre todo mundo fica pra uma próxima)
let chamadaDailyAtual = null;
let participantesSalaReais = {}; // session_id -> { nome, mudo, eu }
let falandoAgoraSessionId = null;
let micLigadoSala = true;

function renderParticipantesSala() {
  const grid = document.getElementById('salaGradeParticipantes');
  const lista = Object.entries(participantesSalaReais);
  grid.innerHTML = lista.map(([sessionId, p], i) => {
    const cor = CORES_COMUNIDADE[i % CORES_COMUNIDADE.length];
    const falando = sessionId === falandoAgoraSessionId;
    const micIcone = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="9" height="9">${p.mudo
      ? '<path d="M4 4l16 16"/><path d="M12 3a4 4 0 0 1 4 4v5c0 .5-.08 1-.24 1.4M8 8v4a4 4 0 0 0 5.3 3.8"/><path d="M6 11v1a6 6 0 0 0 8.7 5.3M12 18v3"/>'
      : '<path d="M12 3a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4Z"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3"/>'}</svg>`;
    return `
      <div class="sala-participante ${p.eu ? 'sala-p-voce' : ''}">
        <div class="sala-p-avatar-wrap ${falando ? 'falando' : ''} ${p.mudo ? 'mudo' : ''}">
          <div class="sala-p-avatar" style="background:${cor}">${iniciaisNome(p.nome)}</div>
          <div class="sala-p-mic">${micIcone}</div>
        </div>
        <div class="sala-p-nome">${p.eu ? 'você' : p.nome}</div>
        <div class="sala-p-status"></div>
      </div>`;
  }).join('');
}

let intervalTimerSala = null, segundosRestantesSala = 18 * 60 + 42;
const CIRCUNF_SALA = 345.6;

function tickSalaTimer() {
  segundosRestantesSala = Math.max(0, segundosRestantesSala - 1);
  const m = String(Math.floor(segundosRestantesSala / 60)).padStart(2, '0');
  const s = String(segundosRestantesSala % 60).padStart(2, '0');
  const numEl = document.getElementById('salaTimerNum');
  if (numEl) numEl.textContent = `${m}:${s}`;
  const frac = segundosRestantesSala / (25 * 60);
  const ring = document.getElementById('salaTimerRing');
  if (ring) ring.setAttribute('stroke-dashoffset', CIRCUNF_SALA * (1 - frac));
}

window.iniciarSalaEstudo = async function (c) {
  document.getElementById('salaEstudoTitulo').textContent = c.titulo;
  document.getElementById('salaMesaEyebrow').textContent = c.mesaEyebrow;
  document.getElementById('salaMesaTitulo').textContent = c.mesaTitulo;
  document.getElementById('salaMesaSub').textContent = c.mesaSub || '';
  document.getElementById('salaMeuStatusTxt').textContent = c.meuStatus || 'por aqui';

  micLigadoSala = true;
  document.getElementById('salaBtnMic').classList.add('on');
  participantesSalaReais = { eu: { nome: window.MEU_HANDLE || 'você', mudo: false, eu: true } };
  renderParticipantesSala();
  document.getElementById('salaEstudoOverlay').classList.add('open');

  clearInterval(intervalTimerSala);
  intervalTimerSala = setInterval(tickSalaTimer, 1000);

  await entrarNaChamadaDeAudio(c.salaId);
};

// entra de verdade na sala de áudio (Daily.co) — se o servidor ainda não
// tiver a chave configurada, ou der qualquer erro de rede/permissão de
// microfone, a sala continua aberta só visualmente (timer funciona,
// ninguém trava), com um aviso em vez de fingir que tem áudio
async function entrarNaChamadaDeAudio(salaId) {
  try {
    const resp = await fetch(`${API_BASE}/api/sala/entrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salaId }),
    });
    const dados = await resp.json();
    if (!resp.ok || !dados.url) {
      mostrarToast(dados.erro ? '🎙 ' + dados.erro : '🎙 áudio ao vivo ainda não disponível');
      return;
    }

    if (typeof DailyIframe === 'undefined') { mostrarToast('🎙 não consegui carregar o áudio agora'); return; }

    chamadaDailyAtual = DailyIframe.createCallObject();
    chamadaDailyAtual
      .on('participant-joined', atualizarParticipantesSalaDaily)
      .on('participant-updated', atualizarParticipantesSalaDaily)
      .on('participant-left', atualizarParticipantesSalaDaily)
      .on('active-speaker-change', (ev) => {
        falandoAgoraSessionId = ev && ev.activeSpeaker ? ev.activeSpeaker.peerId : null;
        renderParticipantesSala();
      })
      .on('error', (ev) => { console.log('erro sala de áudio:', ev); mostrarToast('🎙 a sala de áudio caiu — o resto continua funcionando'); });

    await chamadaDailyAtual.join({ url: dados.url, userName: window.MEU_HANDLE || 'alguém' });
    atualizarParticipantesSalaDaily();
  } catch (erro) {
    console.log('erro ao entrar na sala de áudio:', erro.message);
    mostrarToast('🎙 não consegui ligar o áudio (talvez falte permissão de microfone) — a sala continua aberta');
  }
}

function atualizarParticipantesSalaDaily() {
  if (!chamadaDailyAtual) return;
  const todos = chamadaDailyAtual.participants();
  const novo = {};
  Object.values(todos).forEach(p => {
    novo[p.session_id] = { nome: p.local ? (window.MEU_HANDLE || 'você') : (p.user_name || 'alguém'), mudo: !p.audio, eu: !!p.local };
  });
  participantesSalaReais = novo;
  renderParticipantesSala();
}

window.sairSalaEstudo = function () {
  document.getElementById('salaEstudoOverlay').classList.remove('open');
  clearInterval(intervalTimerSala);
  if (chamadaDailyAtual) {
    chamadaDailyAtual.leave().catch(() => {});
    chamadaDailyAtual.destroy().catch(() => {});
    chamadaDailyAtual = null;
  }
  participantesSalaReais = {};
  falandoAgoraSessionId = null;
};

window.trocarModoSalaEstudo = function (modo) {
  ['salaModoDiscussao', 'salaModoSilencio', 'salaModoPomodoro'].forEach(id => document.getElementById(id).classList.remove('on'));
  const sub = document.getElementById('salaTimerSub');
  if (modo === 'discussao') { document.getElementById('salaModoDiscussao').classList.add('on'); sub.textContent = 'foco + conversa'; }
  if (modo === 'silencio') { document.getElementById('salaModoSilencio').classList.add('on'); sub.textContent = 'silêncio'; }
  if (modo === 'pomodoro') { document.getElementById('salaModoPomodoro').classList.add('on'); sub.textContent = 'pomodoro'; }
};

window.toggleMicSalaEstudo = function () {
  micLigadoSala = !micLigadoSala;
  document.getElementById('salaBtnMic').classList.toggle('on', micLigadoSala);
  if (chamadaDailyAtual) chamadaDailyAtual.setLocalAudio(micLigadoSala);
};
