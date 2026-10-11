/* js/configuracoes.js — Configurações: Match, resumo do dia, ícone de streak, ordem dos tipos, modo escuro
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

window.openConfig = function () {
document.getElementById('configOverlay').classList.add('open');
renderMatchPrefGrid();
renderEmojiStreakGrid();
atualizarVisibilidadeMatchPref();
};

window.closeConfig = function () { document.getElementById('configOverlay').classList.remove('open'); };

let matchAtivado = false;
const MATCH_PREFS = ['Mulher', 'Homem', 'Não-binário', 'Todos'];
let minhaMatchPref = [];
const GENERO_OPCOES = ['Mulher', 'Homem', 'Não-binário'];
let meuGenero = null;

function renderGeneroGrid() {
document.getElementById('generoGrid').innerHTML = GENERO_OPCOES.map(g =>
  `<div class="onboard-topic-chip ${meuGenero === g ? 'on' : ''}" onclick="selecionarGenero('${g}')">${g}</div>`
).join('');
}

window.selecionarGenero = function (g) {
meuGenero = (meuGenero === g) ? null : g;
renderGeneroGrid();
};

// ---------- resumo do dia (gerado pelo servidor, so le/dispensa/compartilha aqui) ----------
async function carregarResumoDia() {
const { data: sessionData } = await supabaseClient.auth.getSession();
if (!sessionData || !sessionData.session) return;
const meuId = sessionData.session.user.id;
const [{ data: resumo }, livrosResp] = await Promise.all([
  supabaseClient.from('resumos_dia').select('*').eq('usuario_id', meuId).order('criado_em', { ascending: false }).limit(1).maybeSingle(),
  supabaseClient.from('estante_pessoal').select('id', { count: 'exact', head: true }).eq('usuario_id', meuId).not('finalizado_em', 'is', null),
]);
const wrap = document.getElementById('homeResumoWrap');
if (!resumo || resumo.dispensado) { wrap.style.display = 'none'; return; }
const idadeHoras = (Date.now() - new Date(resumo.criado_em).getTime()) / 3600000;
if (idadeHoras > 24) { wrap.style.display = 'none'; return; }
document.getElementById('resumoDiaTexto').textContent = resumo.texto;

const elElogio = document.getElementById('resumoDiaElogio');
if (resumo.elogio) { elElogio.textContent = '✨ ' + resumo.elogio; elElogio.style.display = ''; }
else { elElogio.style.display = 'none'; }

const livrosLidos = livrosResp.count || 0;
const stats = [
  { n: streakAtual, l: streakAtual === 1 ? 'dia seguido' : 'dias seguidos', ic: 'fogo' },
  { n: livrosLidos, l: livrosLidos === 1 ? 'livro lido' : 'livros lidos', ic: 'livro' },
];
document.getElementById('resumoDiaStats').innerHTML = stats.map(s => `<div class="home-resumo-stat">${icone(s.ic, 12)} ${s.n} ${s.l}</div>`).join('');

window.RESUMO_DIA_ID_ATUAL = resumo.id;
wrap.style.display = '';
}

window.dispensarResumoDia = async function () {
document.getElementById('homeResumoWrap').style.display = 'none';
if (window.RESUMO_DIA_ID_ATUAL) {
  await supabaseClient.from('resumos_dia').update({ dispensado: true }).eq('id', window.RESUMO_DIA_ID_ATUAL);
}
};

window.compartilharResumoDia = async function () {
const texto = document.getElementById('resumoDiaTexto').textContent;
if (navigator.share) {
  try { await navigator.share({ text: '📊 ' + texto }); return; } catch (e) { return; }
}
try { await navigator.clipboard.writeText(texto); mostrarToast('📋 copiado! cola onde quiser'); }
catch (e) { mostrarToast('não deu pra copiar dessa vez'); }
};

// monta a narrativa do resumo a partir dos toques de humor de hoje (mesma
// lógica de gerarTextoResumo do servidor, só que aqui é pra testar na hora
// pelo console, sem esperar a janela das 21h do cron)
function gerarTextoResumoClient(eventos) {
const NOMES = { feliz: 'feliz', calma: 'calma', triste: 'triste', ansiosa: 'ansiosa', brava: 'brava' };
const negativas = ['brava', 'ansiosa', 'triste'];
const contagem = {};
eventos.forEach((e) => { contagem[e.emocao] = (contagem[e.emocao] || 0) + 1; });
const dominante = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0];

const picos = [];
let streakEmocao = null, streakInicio = null, streakCount = 0;
eventos.forEach((e) => {
  if (negativas.includes(e.emocao)) {
    if (streakEmocao === e.emocao && (new Date(e.criado_em) - new Date(streakInicio)) <= 90 * 60 * 1000) {
      streakCount++;
    } else {
      streakEmocao = e.emocao; streakInicio = e.criado_em; streakCount = 1;
    }
    if (streakCount === 2) picos.push({ emocao: e.emocao, hora: e.criado_em });
  } else {
    streakEmocao = null; streakCount = 0;
  }
});

const formatarHora = (iso) => {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
};

const frases = [];
frases.push(`seu dia começou registrando ${NOMES[eventos[0].emocao]} às ${formatarHora(eventos[0].criado_em)}.`);
picos.slice(0, 2).forEach((p) => frases.push(`às ${formatarHora(p.hora)} você teve um pico de ${NOMES[p.emocao]}.`));
if (!picos.length) frases.push(`você se manteve majoritariamente ${NOMES[dominante]} ao longo do dia.`);
else frases.push(`no geral, ${NOMES[dominante]} foi o que mais apareceu.`);
return frases.join(' ');
}

// função de teste - chame window.simularResumoDia() pelo console pra gerar o
// resumo de hoje na hora, sem esperar a janela das 21h do cron do servidor
// (precisa ter tocado em pelo menos 1 carinha de humor hoje)
window.simularResumoDia = async function () {
const { data: sessionData } = await supabaseClient.auth.getSession();
if (!sessionData || !sessionData.session) return;
const meuId = sessionData.session.user.id;
const hojeStr = new Date().toISOString().slice(0, 10);
const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);

const { data: eventos } = await supabaseClient.from('humor_eventos')
  .select('emocao, criado_em').eq('usuario_id', meuId)
  .gte('criado_em', inicioHoje.toISOString()).order('criado_em', { ascending: true });

if (!eventos || !eventos.length) {
  mostrarToast('toque em pelo menos uma carinha de humor hoje antes de simular');
  return;
}
const texto = gerarTextoResumoClient(eventos);
const { error } = await supabaseClient.from('resumos_dia')
  .upsert({ usuario_id: meuId, data: hojeStr, texto, dispensado: false }, { onConflict: 'usuario_id,data' });
if (error) { mostrarToast('❌ erro ao simular: ' + error.message); return; }
mostrarToast('📊 resumo simulado!');
carregarResumoDia();
};

function renderMatchPrefGrid() {
document.getElementById('matchPrefGrid').innerHTML = MATCH_PREFS.map(p =>
  `<div class="onboard-topic-chip ${minhaMatchPref.includes(p) ? 'on' : ''}" onclick="toggleMatchPref('${p}')">${p}</div>`
).join('');
}

window.toggleMatchPref = async function (p) {
if (minhaMatchPref.includes(p)) {
  minhaMatchPref = minhaMatchPref.filter(x => x !== p);
} else {
  minhaMatchPref.push(p);
}
renderMatchPrefGrid();
const { data: sessionData } = await supabaseClient.auth.getSession();
await supabaseClient.from('usuarios').update({ match_preferencia: minhaMatchPref }).eq('id', sessionData.session.user.id);
// configurou: some com a grade de novo, pra não ficar ocupando espaço à toa.
// só volta se desligar e ligar o Match de novo (fica claro lá no toggleMatch)
matchPrefGridAberto = false;
atualizarVisibilidadeMatchPref();
};

let ordemTipos = [...TIPOS];
let tiposOcultos = [];

const ICONES_STREAK = ['novelo', 'fogo', 'estrela', 'broto', 'xicara', 'livro'];
// quem já tinha escolhido um emoji antigo continua funcionando — só convertemos pro icone novo
const MAPA_EMOJI_STREAK_ANTIGO = { '🧶': 'novelo', '🔥': 'fogo', '⭐': 'estrela', '🌱': 'broto', '☕': 'xicara', '📖': 'livro' };
let meuEmojiStreak = 'novelo';

function normalizarIconeStreak(valor) {
if (ICONE_SVG[valor]) return valor;
return MAPA_EMOJI_STREAK_ANTIGO[valor] || 'novelo';
}

function iconeStreakHtml(nome) {
return `<span class="icon-svg" style="width:15px;height:15px;vertical-align:-2px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONE_SVG[nome] || ICONE_SVG.novelo}</svg></span>`;
}

function renderEmojiStreakGrid() {
document.getElementById('emojiStreakGrid').innerHTML = ICONES_STREAK.map(nome =>
  `<div class="emoji-streak-opcao ${meuEmojiStreak === nome ? 'on' : ''}" onclick="escolherEmojiStreak('${nome}')"><span class="icon-svg" style="width:19px;height:19px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONE_SVG[nome]}</svg></span></div>`
).join('');
}

window.escolherEmojiStreak = async function (nome) {
meuEmojiStreak = nome;
renderEmojiStreakGrid();
document.getElementById('streakEmoji').innerHTML = iconeStreakHtml(nome);
const { data: sessionData } = await supabaseClient.auth.getSession();
await supabaseClient.from('usuarios').update({ emoji_streak: nome }).eq('id', sessionData.session.user.id);
};

window.abrirReordenarTipos = function () {
document.getElementById('reordenarTiposOverlay').classList.add('open');
renderReordenarLista();
};

// sem arrastar — a versão com "segure e arraste" ficava lenta e difícil de
// usar direito no celular (o toque conflitava com a rolagem da lista), então
// a reordenação agora é só pelas setinhas (curtas, confiáveis) + um botão
// pra esconder o tipo do composer sem precisar excluir ele de verdade
function renderReordenarLista() {
document.getElementById('reordenarTiposList').innerHTML = ordemTipos.map((t, i) => {
  const oculto = tiposOcultos.includes(t);
  return `
    <div class="reordenar-item ${oculto ? 'oculto' : ''}">
      <span>${t}</span>
      <div class="reordenar-setas">
        <button class="reordenar-ocultar ${oculto ? 'on' : ''}" title="${oculto ? 'mostrar de novo' : 'esconder do composer'}" onclick="toggleTipoOculto('${t}')">${oculto ? '✕' : '✓'}</button>
        <button class="reordenar-seta" ${i === 0 ? 'disabled' : ''} onclick="moverTipoOrdem(${i}, -1)">${icone('setaCima', 13)}</button>
        <button class="reordenar-seta" ${i === ordemTipos.length - 1 ? 'disabled' : ''} onclick="moverTipoOrdem(${i}, 1)">${icone('setaBaixo', 13)}</button>
      </div>
    </div>`;
}).join('');
}

window.moverTipoOrdem = async function (i, direcao) {
const destino = i + direcao;
if (destino < 0 || destino >= ordemTipos.length) return;
const [item] = ordemTipos.splice(i, 1);
ordemTipos.splice(destino, 0, item);
renderReordenarLista();
await salvarPreferenciasTipos();
};

window.toggleTipoOculto = async function (t) {
const jaOculto = tiposOcultos.includes(t);
// não deixa esconder todo mundo — sempre sobra pelo menos 1 tipo pra postar
if (!jaOculto && tiposOcultos.length >= ordemTipos.length - 1) {
  mostrarToast('❌ precisa deixar pelo menos um tipo visível');
  return;
}
tiposOcultos = jaOculto ? tiposOcultos.filter(x => x !== t) : [...tiposOcultos, t];
renderReordenarLista();
await salvarPreferenciasTipos();
};

async function salvarPreferenciasTipos() {
const { data: sessionData } = await supabaseClient.auth.getSession();
await supabaseClient.from('usuarios').update({ ordem_tipos: ordemTipos, tipos_ocultos: tiposOcultos }).eq('id', sessionData.session.user.id);
renderTypeChips();
}

 let matchPrefGridAberto = false;

 window.toggleMatch = async function () {
matchAtivado = !matchAtivado;
document.getElementById('matchSwitch').classList.toggle('on', matchAtivado);
document.getElementById('matchBtnTopo').style.display = matchAtivado ? 'flex' : 'none';
// ligou agora: abre a grade pra escolher; desligou: fecha
matchPrefGridAberto = matchAtivado;
atualizarVisibilidadeMatchPref();

const { data: sessionData } = await supabaseClient.auth.getSession();
await supabaseClient.from('usuarios').update({ match_ativado: matchAtivado }).eq('id', sessionData.session.user.id);
};

function atualizarVisibilidadeMatchPref() {
const row = document.getElementById('matchPrefRow');
if (row) row.style.display = (matchAtivado && matchPrefGridAberto) ? '' : 'none';
}

// ---------- temas especiais de inclusao: diversidade (LGBTQIA+) e girassol
// só a propria pilula, tocando nela -- nao mexe em mais nada do app (pedido
// da usuaria depois de ver o tema antigo mudando a cor do app inteiro).
// Guarda so no aparelho (localStorage), nao precisa de conta nem de internet.
let arcoIrisPilulaAtivo = false;
try { arcoIrisPilulaAtivo = localStorage.getItem('atomoArcoIrisPilula') === '1'; } catch (e) {}

function aplicarArcoIrisPilula(ativo) {
const pilula = document.getElementById('homeDiarioStreak');
if (pilula) pilula.classList.toggle('arco-iris-on', ativo);
arcoIrisPilulaAtivo = ativo;
try { localStorage.setItem('atomoArcoIrisPilula', ativo ? '1' : '0'); } catch (e) {}
}
aplicarArcoIrisPilula(arcoIrisPilulaAtivo);

window.alternarArcoIrisPilula = function () {
aplicarArcoIrisPilula(!arcoIrisPilulaAtivo);
};

// pilula de sequencia: numero + barrinha que enche ao longo da semana (reinicia
// a cada 7 dias, assim sempre da pra ver progresso em vez de ficar sempre cheia)
function atualizarStreakPill(dias) {
const elCount = document.getElementById('streakCount');
if (elCount) elCount.textContent = dias;
const fill = document.getElementById('streakFill');
if (fill) {
  const pct = dias > 0 ? (((dias - 1) % 7) + 1) / 7 * 100 : 0;
  requestAnimationFrame(() => { fill.style.width = pct + '%'; });
}
}
window.atualizarStreakPill = atualizarStreakPill;

let darkMode = false;
window.toggleDarkMode = async function () {
  console.log('1. função chamada');
  darkMode = !darkMode;
  document.getElementById('device').setAttribute('data-theme', darkMode ? 'dark' : 'light');
  document.getElementById('darkSwitch').classList.toggle('on', darkMode);
  console.log('2. visual atualizado, darkMode =', darkMode);

  const { data: sessionData } = await supabaseClient.auth.getSession();
  console.log('3. sessão obtida:', sessionData.session ? 'existe' : 'NULA');

  const resultado = await supabaseClient.from('usuarios').update({ modo_escuro: darkMode }).eq('id', sessionData.session.user.id).select();
  console.log('4. resultado do update:', resultado);
};
