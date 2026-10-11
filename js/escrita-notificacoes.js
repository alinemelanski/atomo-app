/* js/escrita-notificacoes.js — Clima do dia, prompt do momento, sino de notificações, pop-up de escrita rápida
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- clima real do dia, mostrado no topo da tela de escrever ----------
const CLIMA_WMO = {
  0: { ic: 'sol', txt: 'céu limpo' }, 1: { ic: 'sol', txt: 'poucas nuvens' },
  2: { ic: 'nublado', txt: 'parcialmente nublado' }, 3: { ic: 'nublado', txt: 'nublado' },
  45: { ic: 'nevoeiro', txt: 'nevoeiro' }, 48: { ic: 'nevoeiro', txt: 'nevoeiro' },
  51: { ic: 'chuva', txt: 'garoa fraca' }, 53: { ic: 'chuva', txt: 'garoa' }, 55: { ic: 'chuva', txt: 'garoa forte' },
  56: { ic: 'chuva', txt: 'garoa congelante' }, 57: { ic: 'chuva', txt: 'garoa congelante' },
  61: { ic: 'chuva', txt: 'chuva fraca' }, 63: { ic: 'chuva', txt: 'chuva' }, 65: { ic: 'chuva', txt: 'chuva forte' },
  66: { ic: 'chuva', txt: 'chuva congelante' }, 67: { ic: 'chuva', txt: 'chuva congelante' },
  71: { ic: 'neve', txt: 'neve fraca' }, 73: { ic: 'neve', txt: 'neve' }, 75: { ic: 'neve', txt: 'neve forte' },
  77: { ic: 'neve', txt: 'grãos de neve' },
  80: { ic: 'chuva', txt: 'pancadas de chuva' }, 81: { ic: 'chuva', txt: 'pancadas de chuva' }, 82: { ic: 'chuva', txt: 'pancadas fortes' },
  85: { ic: 'neve', txt: 'pancadas de neve' }, 86: { ic: 'neve', txt: 'pancadas de neve' },
  95: { ic: 'tempestade', txt: 'trovoada' }, 96: { ic: 'tempestade', txt: 'trovoada com granizo' }, 99: { ic: 'tempestade', txt: 'trovoada com granizo' }
};

function renderClimaWidget(temp, codigo) {
  const wrap = document.getElementById('climaWidget');
  if (!wrap) return;
  const info = CLIMA_WMO[codigo] || { ic: 'nublado', txt: 'tempo variável' };
  wrap.innerHTML = icone(info.ic, 15) + ' <span>' + temp + '°C · ' + info.txt + '</span>';
  wrap.style.display = 'flex';
}

function carregarClimaWidget() {
  try {
    const hojeChave = fmtDataISO(new Date());
    const cacheBruto = localStorage.getItem('atomoClimaCache');
    const cache = cacheBruto ? JSON.parse(cacheBruto) : null;
    if (cache && cache.data === hojeChave) { renderClimaWidget(cache.temp, cache.codigo); return; }
  } catch (e) { /* localStorage pode falhar em aba anônima — segue sem cache */ }

  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(function (pos) {
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,weather_code')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        const temp = Math.round(json.current.temperature_2m);
        const codigo = json.current.weather_code;
        try {
          localStorage.setItem('atomoClimaCache', JSON.stringify({ data: fmtDataISO(new Date()), temp: temp, codigo: codigo }));
        } catch (e) { /* segue sem cache */ }
        renderClimaWidget(temp, codigo);
      })
      .catch(function () { /* clima é só um detalhe a mais, falha silenciosa */ });
  }, function () { /* permissão negada — widget fica escondido */ }, { timeout: 8000 });
}

// ---------- prompt do composer muda pelo horário, dá cara de ritual diário ----------
function aplicarPromptDoMomento() {
  const h = new Date().getHours();
  let prompt = 'O que você quer compartilhar hoje?';
  if (h >= 5 && h < 12) prompt = 'Como você tá começando o dia?';
  else if (h >= 12 && h < 18) prompt = 'O que tá passando pela sua cabeça agora?';
  else prompt = 'O que ficou na sua cabeça hoje?';
  document.getElementById('composerText').placeholder = prompt;
}

// ---------- notificações (sino sempre visível, visualizações agrupadas) ----------

async function carregarNotificacoes() {
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const { data, error } = await supabaseClient
  .from('notificacoes')
  .select('*')
  .eq('usuario_id', meuId)
  .order('criado_em', { ascending: false });

if (error) { console.log('erro ao carregar notificacoes:', error.message); return; }

window.NOTIFICACOES_REAIS = data || [];

const naoLidas = window.NOTIFICACOES_REAIS.filter(n => !n.lida).length;
const badge = document.getElementById('notifBadge');
badge.textContent = naoLidas > 9 ? '9+' : naoLidas;
badge.classList.toggle('hide', naoLidas === 0);
}

window.irParaPostDaNotif = async function (postId) {
closeOverlay('notifOverlay');
showScreen2('descobrir');
const idx = feedPosts.findIndex(p => p.id === postId);
if (idx >= 0) {
  abrirComentarios(idx);
} else {
  mostrarToast('Esse post não está carregado no feed agora');
}
};

// leva pro lugar certo de acordo com o tipo da notificação — antes só
// funcionava pra comentário (e só se o post já estivesse carregado no feed)
window.abrirNotificacao = async function (n) {
closeOverlay('notifOverlay');
if (n.tipo === 'comentario' || n.tipo === 'curtida') {
  if (n.post_id) { irParaPostDaNotif(n.post_id); } else { showScreen2('descobrir'); }
} else if (n.tipo === 'seguidor' && n.ator_id) {
  abrirPerfilAlheio(n.ator_id);
} else if (n.tipo === 'mensagem' && n.ator_id) {
  const { data: usuario } = await supabaseClient.from('usuarios').select('handle').eq('id', n.ator_id).maybeSingle();
  abrirDm(n.ator_id, usuario ? usuario.handle : 'alguém');
} else if (n.tipo === 'pergunta') {
  abrirPerguntasPendentes();
}
};

window.openNotifs = async function () {
document.getElementById('notifOverlay').classList.add('open');

await carregarNotificacoes();
const lista = window.NOTIFICACOES_REAIS || [];

document.getElementById('notifList').innerHTML = lista.length
  ? lista.map((n, i) => `<div class="notif-item" onclick="abrirNotificacao(window.NOTIFICACOES_REAIS[${i}])" style="cursor:pointer;"><div class="ic">${n.tipo === 'comentario' ? icone('comentar',18) : n.tipo === 'curtida' ? icone('curtir',18) : n.tipo === 'seguidor' ? icone('pessoa',18) : n.tipo === 'pergunta' ? icone('pergunta',18) : n.tipo === 'mensagem' ? icone('comentar',18) : icone('sino',18)}</div><div><div class="n-t">${n.titulo}</div><div class="n-s">${n.subtitulo || ''}</div></div></div>`).join('')
  : `<div class="visitor-lock-note">Nenhuma notificação ainda 🌱</div>`;

const { data: sessionData } = await supabaseClient.auth.getSession();
await supabaseClient.from('notificacoes').update({ lida: true }).eq('usuario_id', sessionData.session.user.id).eq('lida', false);
};

// ---------- pop-up de escrita rápida ----------
let wpPrivado = false;
window.abrirWritePopup = function (icon, titulo, sub) {
  document.getElementById('writePopupIcon').textContent = icon;
  document.getElementById('writePopupTitle').textContent = titulo;
  document.getElementById('writePopupSub').textContent = sub;
  document.getElementById('writePopupBg').classList.add('show');
  setTimeout(() => document.getElementById('writePopupText').focus(), 200);
};
window.fecharWritePopup = function () {
  document.getElementById('writePopupBg').classList.remove('show');
  document.getElementById('writePopupText').value = '';
};

window.toggleWritePopupPrivado = function () {
  wpPrivado = !wpPrivado;
  document.getElementById('wpPrivIcon').textContent = wpPrivado ? '🔒' : '🌍';
  document.getElementById('wpPrivLabel').textContent = wpPrivado ? 'Só eu' : 'Compartilhável';
};

// ---------- publicar do pop-up de escrita ----------

 window.publicarWritePopup = async function () {
  const texto = document.getElementById('writePopupText').value.trim();
  if (!texto) return;
  const tipo = 'Assunto';
  const textoFinal = discoverPendenteReal !== null ? `${texto} (sobre: "${discoverPendenteReal.title}")` : texto;

  const { data: sessionData } = await supabaseClient.auth.getSession();

  const { error } = await supabaseClient.from('posts').insert({
    autor_id: sessionData.session.user.id,
    texto: textoFinal,
    tipo: tipo,
    privado: wpPrivado,
  });

  if (error) { mostrarToast('❌ erro: ' + error.message); return; }

  mostrarToast(wpPrivado ? '🔒 Guardado só pra você' : '✨ Compartilhado no feed');
  discoverPendenteReal = null;
  renderFeed();
  renderDiary();
  fecharWritePopup();
};

// simula visualizações chegando AGRUPADAS (nunca uma por pessoa — isso vira MSN chato)
let vizAcumuladas = 0;
function simularNovaVisualizacao() {
  vizAcumuladas++;
  document.getElementById('viewsCount').textContent = parseInt(document.getElementById('viewsCount').textContent) + 1;
  // reescreve a notificação de hoje em vez de empilhar uma por pessoa
  if (NOTIFICACOES[0] && NOTIFICACOES[0].agrupavel) {
    NOTIFICACOES[0].sub = `${vizAcumuladas} pessoas viram seu perfil hoje`;
    atualizarNotifBadge();
  } else {
    notifNaoLidas++;
    NOTIFICACOES.unshift({ icon: '👀', titulo: 'Novas visualizações', sub: `${vizAcumuladas} pessoa viu seu perfil hoje`, tempo: 'agora', agrupavel: true });
    atualizarNotifBadge();
  }
}
