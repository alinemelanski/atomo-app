/* js/clima-tema.js — Tema Clima (fundo dinâmico conforme o clima real)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ==========================================================================
// TEMA CLIMA -- fundo dinamico baseado no clima real (localizacao) + hora do
// dia + estacao, inspirado na Princesa Mononoke. Mutuamente exclusivo com o
// modo escuro nativo: ligar o Clima desliga o escuro (e trava o toggle
// dele); desligar o Clima volta pro claro normal do Átomo.
// ==========================================================================
let climaAtivo = false;
let climaIntervalId = null;

function atualizarDisponibilidadeModoEscuro() {
  const sw = document.getElementById('darkSwitch');
  const desc = document.getElementById('darkModeDesc');
  if (!sw) return;
  sw.classList.toggle('desabilitado', climaAtivo);
  if (desc) desc.textContent = climaAtivo ? 'desative o Tema Clima pra poder usar' : 'troca a paleta clara pela escura';
}

window.toggleTemaClima = async function (semSalvar) {
  climaAtivo = !climaAtivo;
  document.getElementById('climaSwitch').classList.toggle('on', climaAtivo);
  document.getElementById('device').classList.toggle('clima-ativo', climaAtivo);
  atualizarDisponibilidadeModoEscuro();

  if (climaAtivo) {
    // clima manda no visual -- se tava no escuro, volta pro claro nativo por baixo
    if (darkMode) {
      darkMode = false;
      document.getElementById('device').setAttribute('data-theme', 'light');
      document.getElementById('darkSwitch').classList.remove('on');
    }
    iniciarTemaClima();
  } else {
    pararTemaClima();
    document.getElementById('climaOverlay').classList.remove('on');
  }

  if (!semSalvar) {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    await supabaseClient.from('usuarios').update({ tema_clima: climaAtivo, modo_escuro: climaAtivo ? false : darkMode }).eq('id', sessionData.session.user.id);
  }
};

function iniciarTemaClima() {
  atualizarClimaAgora();
  if (climaIntervalId) clearInterval(climaIntervalId);
  climaIntervalId = setInterval(atualizarClimaAgora, 30 * 60 * 1000);
}

function pararTemaClima() {
  if (climaIntervalId) { clearInterval(climaIntervalId); climaIntervalId = null; }
}

async function atualizarClimaAgora() {
  if (!navigator.geolocation) { avisarClimaSemLocalizacao(); return; }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { latitude, longitude } = pos.coords;
      const resposta = await fetch(`${API_BASE}/api/clima?lat=${latitude}&lon=${longitude}`);
      const dados = await resposta.json();
      if (dados && !dados.erro) aplicarEstadoClima(dados);
    } catch (erro) {
      console.log('erro ao buscar clima:', erro.message);
    }
  }, (erro) => {
    console.log('permissao de localizacao negada pro tema clima:', erro.message);
    avisarClimaSemLocalizacao();
  }, { maximumAge: 20 * 60 * 1000, timeout: 10000 });
}

function avisarClimaSemLocalizacao() {
  mostrarToast('preciso da sua localização pra mostrar o clima — ative a permissão e tenta ligar de novo');
  if (climaAtivo) toggleTemaClima();
}


// hemisferio sul (Brasil) -- so usada pra saber quando trocar "sol" por
// "primavera" (o resto do ano o dia claro continua com o visual de sol)
function calcularEstacaoAtual() {
  const agora = new Date();
  const mes = agora.getMonth() + 1;
  const dia = agora.getDate();
  if ((mes === 9 && dia >= 23) || mes === 10 || mes === 11 || (mes === 12 && dia < 21)) return 'primavera';
  if ((mes === 12 && dia >= 21) || mes === 1 || mes === 2 || (mes === 3 && dia < 20)) return 'verao';
  if ((mes === 3 && dia >= 20) || mes === 4 || mes === 5 || (mes === 6 && dia < 21)) return 'outono';
  return 'inverno';
}

function aplicarEstadoClima(dados) {
  let estado;
  if (dados.is_day === false) {
    estado = 'noite';
  } else {
    const categoria = (dados.weather || '').toLowerCase();
    if (categoria.includes('rain') || categoria.includes('drizzle') || categoria.includes('thunderstorm')) estado = 'chuva';
    else if (categoria.includes('cloud') || categoria.includes('mist') || categoria.includes('fog') || categoria.includes('haze') || categoria.includes('snow')) estado = 'nublado';
    else estado = (calcularEstacaoAtual() === 'primavera') ? 'primavera' : 'sol';
  }
  renderClimaOverlay(estado);
}

let climaEstadoAtual = null;
function renderClimaOverlay(estado) {
  const overlay = document.getElementById('climaOverlay');
  if (!overlay) return;
  overlay.classList.add('on');
  if (climaEstadoAtual === estado) return; // já tá nesse estado, não recria as particulas à toa
  climaEstadoAtual = estado;
  overlay.dataset.estado = estado;
  overlay.innerHTML = '';

  if (estado === 'sol') {
    const raiosPos = [12, 45, 72, 90];
    raiosPos.forEach((esq, i) => {
      const r = document.createElement('div'); r.className = 'clima-raio';
      r.style.left = esq + '%'; r.style.width = (50 + (i % 2) * 30) + 'px';
      r.style.opacity = (0.8 - i * 0.12).toFixed(2);
      r.style.animationDelay = (i * 1.3) + 's';
      overlay.appendChild(r);
    });
    for (let i = 0; i < 10; i++) {
      const m = document.createElement('div'); m.className = 'clima-mote';
      m.style.left = (Math.random() * 100) + '%'; m.style.top = (40 + Math.random() * 50) + '%';
      m.style.animationDuration = (5 + Math.random() * 3) + 's';
      m.style.animationDelay = (-Math.random() * 6) + 's';
      overlay.appendChild(m);
    }
  } else if (estado === 'nublado') {
    for (let i = 0; i < 10; i++) {
      const n = document.createElement('div'); n.className = 'clima-nuvem';
      n.style.top = (Math.random() * 80) + '%';
      n.style.width = (70 + Math.random() * 110) + 'px';
      n.style.opacity = (0.45 + Math.random() * 0.5).toFixed(2);
      n.style.animationDuration = (14 + Math.random() * 18) + 's';
      n.style.animationDelay = (-Math.random() * 25) + 's';
      overlay.appendChild(n);
    }
  } else if (estado === 'chuva') {
    for (let i = 0; i < 34; i++) {
      const g = document.createElement('div'); g.className = 'clima-gota';
      g.style.left = (Math.random() * 100) + '%';
      g.style.animationDuration = (0.5 + Math.random() * 0.4) + 's';
      g.style.animationDelay = (-Math.random() * 1) + 's';
      overlay.appendChild(g);
    }
  } else if (estado === 'noite') {
    const lua = document.createElement('div'); lua.className = 'clima-lua';
    overlay.appendChild(lua);
    for (let i = 0; i < 7; i++) {
      const v = document.createElement('div'); v.className = 'clima-vagalume';
      v.style.left = (Math.random() * 90) + '%'; v.style.top = (35 + Math.random() * 55) + '%';
      v.style.animationDuration = (4 + Math.random() * 2.5) + 's';
      v.style.animationDelay = (-Math.random() * 6) + 's';
      overlay.appendChild(v);
    }
  } else if (estado === 'primavera') {
    for (let i = 0; i < 18; i++) {
      const f = document.createElement('div'); f.className = 'clima-folha' + (i % 2 ? ' verde' : '');
      f.style.left = (Math.random() * 100) + '%';
      f.style.animationDuration = (5 + Math.random() * 5) + 's';
      f.style.animationDelay = (-Math.random() * 8) + 's';
      overlay.appendChild(f);
    }
  }
}
