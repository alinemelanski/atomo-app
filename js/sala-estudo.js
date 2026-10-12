/* js/sala-estudo.js — Mesa de leitura AO VIVO do Clube do Livro (áudio via Daily.co)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa.

   COMO FUNCIONA (pra aprender):
   - O áudio é de verdade: o Daily.co cuida do microfone e de juntar as vozes.
   - Cada pessoa da chamada vira um avatar SENTADO AO REDOR da mesa. Pra
     colocar N pessoas num círculo, cada uma ganha um ângulo (360° / N) e a
     posição sai do seno/cosseno desse ângulo — trigonometria de escola!
   - No meio da mesa tem uma ROLETA (uma seta que gira). Quem toca em
     "girar roleta" sorteia uma pessoa e manda o resultado pra todo mundo
     da sala (sendAppMessage do Daily). Assim TODOS veem a seta parar na
     mesma pessoa, não cada um com um sorteio diferente. */

let chamadaDailyAtual = null;
let participantesSalaReais = {}; // session_id -> { nome, mudo, eu, foto }
let falandoAgoraSessionId = null;
let micLigadoSala = true;
let modoRoleta = 'ler';           // 'ler' | 'discussao'
let anguloSetaAtual = 0;          // quanto a seta já girou (vai acumulando)
let escolhidoRoletaId = null;     // session_id de quem a roleta escolheu
let roletaGirando = false;

// A ordem dos assentos precisa ser IGUAL em todos os celulares (senão a seta
// pararia em pessoas diferentes). Ordenar pelo session_id garante isso.
function assentosOrdenados() {
  return Object.entries(participantesSalaReais).sort((a, b) => a[0].localeCompare(b[0]));
}

function renderParticipantesSala() {
  const wrap = document.getElementById('salaGradeParticipantes');
  const lista = assentosOrdenados();
  const n = lista.length;
  wrap.innerHTML = lista.map(([sessionId, p], i) => {
    // ângulo do assento: começa em cima (-90°) e vai no sentido do relógio
    const ang = (-90 + i * (360 / n)) * Math.PI / 180;
    const raio = 41; // % do tamanho da roda (a mesa tem 34%, os avatares ficam na borda)
    const x = 50 + raio * Math.cos(ang);
    const y = 50 + raio * Math.sin(ang);
    const cor = CORES_COMUNIDADE[i % CORES_COMUNIDADE.length];
    const falando = sessionId === falandoAgoraSessionId;
    const escolhido = sessionId === escolhidoRoletaId && !roletaGirando;
    const rosto = p.foto
      ? `<div class="sala-p-avatar" style="background-image:url('${p.foto}'); background-size:cover; background-position:center;"></div>`
      : `<div class="sala-p-avatar" style="background:${cor}">${ATOMO_AVATAR_SVG}</div>`;
    const micIcone = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="9" height="9">${p.mudo
      ? '<path d="M4 4l16 16"/><path d="M12 3a4 4 0 0 1 4 4v5c0 .5-.08 1-.24 1.4M8 8v4a4 4 0 0 0 5.3 3.8"/><path d="M6 11v1a6 6 0 0 0 8.7 5.3M12 18v3"/>'
      : '<path d="M12 3a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4Z"/><path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3"/>'}</svg>`;
    return `
      <div class="mesa-assento ${p.eu ? 'sala-p-voce' : ''} ${escolhido ? 'escolhido' : ''}" style="left:${x}%; top:${y}%;">
        <div class="sala-p-avatar-wrap ${falando ? 'falando' : ''} ${p.mudo ? 'mudo' : ''}">
          ${rosto}
          <div class="sala-p-mic">${micIcone}</div>
        </div>
        <div class="sala-p-nome">${p.eu ? 'você' : p.nome}</div>
      </div>`;
  }).join('');
}

// c = { salaId, titulo, mesaEyebrow, mesaTitulo, mesaSub }
window.iniciarSalaEstudo = async function (c) {
  document.getElementById('salaEstudoTitulo').textContent = c.titulo;
  document.getElementById('salaMesaEyebrow').textContent = c.mesaEyebrow;
  document.getElementById('salaMesaTitulo').textContent = c.mesaTitulo;
  document.getElementById('salaMesaSub').textContent = c.mesaSub || '';

  micLigadoSala = true;
  document.getElementById('salaBtnMic').classList.add('on');
  escolhidoRoletaId = null;
  trocarModoRoleta('ler');
  participantesSalaReais = { eu: { nome: window.MEU_HANDLE || 'você', mudo: false, eu: true, foto: window.MINHA_FOTO || '' } };
  renderParticipantesSala();
  document.getElementById('salaEstudoOverlay').classList.add('open');

  await entrarNaChamadaDeAudio(c.salaId);
};

// entra de verdade na sala de áudio (Daily.co) — se o servidor ainda não
// tiver a chave configurada, ou der qualquer erro de rede/permissão de
// microfone, a mesa continua aberta (a roleta funciona), com um aviso
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
      // alguém girou a roleta → anima aqui também, parando na MESMA pessoa
      .on('app-message', (ev) => {
        const m = ev && ev.data;
        if (m && m.tipo === 'roleta') animarRoleta(m.alvo, m.voltas, m.modo, m.quemGirou);
      })
      .on('error', (ev) => { console.log('erro sala de áudio:', ev); mostrarToast('🎙 a sala de áudio caiu — o resto continua funcionando'); });

    // userData viaja junto com a pessoa: é assim que os outros recebem a SUA foto
    await chamadaDailyAtual.join({
      url: dados.url,
      userName: window.MEU_HANDLE || 'alguém',
      userData: { foto: window.MINHA_FOTO || '' },
    });
    atualizarParticipantesSalaDaily();
  } catch (erro) {
    console.log('erro ao entrar na sala de áudio:', erro.message);
    mostrarToast('🎙 não consegui ligar o áudio (talvez falte permissão de microfone) — a mesa continua aberta');
  }
}

function atualizarParticipantesSalaDaily() {
  if (!chamadaDailyAtual) return;
  const todos = chamadaDailyAtual.participants();
  const novo = {};
  Object.values(todos).forEach(p => {
    novo[p.session_id] = {
      nome: p.local ? (window.MEU_HANDLE || 'você') : (p.user_name || 'alguém'),
      mudo: !p.audio,
      eu: !!p.local,
      foto: (p.userData && p.userData.foto) || '',
    };
  });
  participantesSalaReais = novo;
  renderParticipantesSala();
}

window.sairSalaEstudo = function () {
  document.getElementById('salaEstudoOverlay').classList.remove('open');
  if (chamadaDailyAtual) {
    chamadaDailyAtual.leave().catch(() => {});
    chamadaDailyAtual.destroy().catch(() => {});
    chamadaDailyAtual = null;
  }
  participantesSalaReais = {};
  falandoAgoraSessionId = null;
};

window.toggleMicSalaEstudo = function () {
  micLigadoSala = !micLigadoSala;
  document.getElementById('salaBtnMic').classList.toggle('on', micLigadoSala);
  if (chamadaDailyAtual) chamadaDailyAtual.setLocalAudio(micLigadoSala);
};

// ---------- ROLETA ----------
window.trocarModoRoleta = function (modo) {
  modoRoleta = modo;
  document.getElementById('mesaModoLer').classList.toggle('on', modo === 'ler');
  document.getElementById('mesaModoDiscussao').classList.toggle('on', modo === 'discussao');
  if (!roletaGirando && !escolhidoRoletaId) {
    document.getElementById('mesaResultado').textContent = modo === 'ler'
      ? 'gire a roleta pra sortear quem lê'
      : 'gire a roleta pra sortear quem começa';
  }
};

window.girarRoletaMesa = function () {
  if (roletaGirando) return;
  const lista = assentosOrdenados();
  if (!lista.length) return;
  const alvo = lista[Math.floor(Math.random() * lista.length)][0];
  const voltas = 4 + Math.floor(Math.random() * 3); // 4 a 6 voltas inteiras antes de parar
  // manda pra todo mundo da chamada ('*' = todos menos eu) e anima aqui
  if (chamadaDailyAtual) {
    try { chamadaDailyAtual.sendAppMessage({ tipo: 'roleta', alvo, voltas, modo: modoRoleta, quemGirou: window.MEU_HANDLE || '' }, '*'); } catch (e) { /* sem chamada: só local */ }
  }
  animarRoleta(alvo, voltas, modoRoleta, null);
};

function animarRoleta(alvoId, voltas, modo, quemGirou) {
  const lista = assentosOrdenados();
  const i = lista.findIndex(([id]) => id === alvoId);
  if (i < 0) return;
  if (modo && modo !== modoRoleta) trocarModoRoleta(modo);

  roletaGirando = true;
  escolhidoRoletaId = alvoId;
  renderParticipantesSala(); // tira o destaque anterior enquanto gira
  document.getElementById('mesaBtnGirar').disabled = true;
  document.getElementById('mesaResultado').textContent = quemGirou ? `@${quemGirou} girou a roleta...` : 'girando...';

  // a seta aponta pra cima em 0°; o assento i fica em i * (360/n) graus.
  // Somamos voltas inteiras (360° cada) + o que falta pra chegar no assento.
  const destino = i * (360 / lista.length);
  const atualNoCirculo = ((anguloSetaAtual % 360) + 360) % 360;
  let falta = destino - atualNoCirculo;
  if (falta < 0) falta += 360;
  anguloSetaAtual += voltas * 360 + falta;
  const seta = document.getElementById('mesaRoletaSeta');
  seta.style.transform = `rotate(${anguloSetaAtual}deg)`;

  setTimeout(() => {
    roletaGirando = false;
    renderParticipantesSala();
    document.getElementById('mesaBtnGirar').disabled = false;
    const p = participantesSalaReais[alvoId] || {};
    const nome = p.eu ? 'você' : '@' + (p.nome || 'alguém');
    const frase = modoRoleta === 'ler'
      ? (p.eu ? 'é a sua vez de ler em voz alta 📖' : `${nome} lê agora 📖`)
      : (p.eu ? 'você começa a discussão 💬' : `${nome} começa a discussão 💬`);
    document.getElementById('mesaResultado').textContent = frase;
    if (navigator.vibrate) navigator.vibrate(30);
  }, 3300); // mesmo tempo da transition da seta no CSS (3.2s) + folguinha
}
