/* js/feedback-sensorial.js — Vibração e sons suaves (puxar pra atualizar, notificações, selos...)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- preferências (guardadas só neste aparelho) ----------
// "sons" e "vibração" podem ser desligados em Configurações. O navegador NÃO deixa um site saber se o
// celular está no silencioso: no iPhone o som do Web Audio já fica mudo no modo silencioso; no Android
// não existe essa informação, então ali vale o interruptor de Configurações.
let sonsAtivos = true;
let vibracaoAtiva = true;
try {
  sonsAtivos = localStorage.getItem('atomo_sons') !== '0';
  vibracaoAtiva = localStorage.getItem('atomo_vibracao') !== '0';
} catch (e) { /* sem storage: fica ligado */ }

// ---------- vibração ----------
// padrao: número (ms) ou lista [vibra, pausa, vibra...]. Sempre curtinho e discreto.
function vibrar(padrao) {
  if (!vibracaoAtiva || !navigator.vibrate) return;
  try { navigator.vibrate(padrao); } catch (e) { /* aparelho sem vibração */ }
}

// ---------- sons sintetizados (sem arquivos de áudio, volume baixinho) ----------
let ctxSom = null;
let ultimoSomEm = {};

function prepararAudio() {
  // 'ambient' (Safari): respeita o botão de silencioso e não interrompe música/podcast de quem está ouvindo
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* sem suporte */ }
  if (!ctxSom) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctxSom = new AC(); } catch (e) { return null; }
  }
  if (ctxSom.state === 'suspended') ctxSom.resume().catch(() => {});
  return ctxSom;
}
// navegadores só liberam áudio depois do primeiro toque na tela
['touchstart', 'pointerdown', 'click', 'keydown'].forEach(ev =>
  window.addEventListener(ev, () => { if (sonsAtivos) prepararAudio(); }, { passive: true, once: false }));

// uma nota suave: começa devagar e some em curva (sem "clique" áspero)
function notaSuave(ctx, freq, inicio, dur, volume, tipo) {
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = tipo || 'sine';
  osc.frequency.setValueAtTime(freq, inicio);
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.exponentialRampToValueAtTime(volume, inicio + 0.015);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
  osc.connect(ganho).connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + dur + 0.05);
}

const SONS_ATOMO = {
  puxar:      [[660, 0, 0.09, 0.035]],
  atualizou:  [[523, 0, 0.12, 0.04], [659, 0.07, 0.16, 0.04]],
  notificacao:[[784, 0, 0.18, 0.05], [1047, 0.12, 0.28, 0.045]],
  selo:       [[523, 0, 0.3, 0.05], [659, 0.1, 0.3, 0.05], [784, 0.2, 0.32, 0.05], [1047, 0.3, 0.5, 0.05]],
};

function tocarSom(nome) {
  if (!sonsAtivos || document.visibilityState === 'hidden') return;
  const notas = SONS_ATOMO[nome];
  if (!notas) return;
  const agora = Date.now();
  if (ultimoSomEm[nome] && agora - ultimoSomEm[nome] < 400) return; // não repete em sequência
  ultimoSomEm[nome] = agora;
  const ctx = prepararAudio();
  if (!ctx || ctx.state !== 'running') return; // ainda sem toque na tela: fica quieto
  const t0 = ctx.currentTime + 0.01;
  notas.forEach(([freq, atraso, dur, vol]) => notaSuave(ctx, freq, t0 + atraso, dur, vol, nome === 'selo' ? 'triangle' : 'sine'));
}

// ---------- interruptores em Configurações ----------
function atualizarInterruptoresSensoriais() {
  const s = document.getElementById('sonsSwitch');
  const v = document.getElementById('vibracaoSwitch');
  if (s) s.classList.toggle('on', sonsAtivos);
  if (v) v.classList.toggle('on', vibracaoAtiva);
}
window.toggleSons = function () {
  sonsAtivos = !sonsAtivos;
  try { localStorage.setItem('atomo_sons', sonsAtivos ? '1' : '0'); } catch (e) { /* sem storage */ }
  atualizarInterruptoresSensoriais();
  if (sonsAtivos) { prepararAudio(); tocarSom('atualizou'); }
};
window.toggleVibracao = function () {
  vibracaoAtiva = !vibracaoAtiva;
  try { localStorage.setItem('atomo_vibracao', vibracaoAtiva ? '1' : '0'); } catch (e) { /* sem storage */ }
  atualizarInterruptoresSensoriais();
  if (vibracaoAtiva) vibrar(15);
};
atualizarInterruptoresSensoriais();
