/* js/configuracoes.js — Configurações: Match, seu dia (resumo), ícone de streak, ordem dos tipos, modo escuro
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

// ---------- seu dia (montado aqui no aparelho, na hora, com o que a pessoa fez hoje) ----------
// Não depende de servidor, agendador nem IA: junta os toques de humor, o que foi escrito, a leitura
// e a sequência de hoje num cartão com título, barra de humor, texto e uma dica pro fim do dia.
const SUBSTANTIVO_HUMOR = { feliz: 'alegria', calma: 'calma', triste: 'tristeza', ansiosa: 'ansiedade', brava: 'raiva' };
const TITULOS_DIA = {
  feliz: ['Um dia de brilho', 'Hoje teve leveza', 'Dia bom de guardar'],
  calma: ['Um dia sereno', 'Hoje foi de respirar fundo', 'Um dia de ritmo calmo'],
  triste: ['Um dia mais pesado', 'Hoje pediu delicadeza', 'Dia de sentir devagar'],
  ansiosa: ['Um dia de mente acelerada', 'Hoje a cabeça correu', 'Dia de muitas voltas por dentro'],
  brava: ['Um dia de faíscas', 'Hoje teve intensidade', 'Dia de sentimento forte'],
  misto: ['Um dia de várias estações', 'Hoje teve de tudo um pouco'],
  escrita: ['Seu dia em palavras', 'Hoje você escreveu'],
};
const DICAS_DIA = {
  feliz: ['Guarde esse momento: escreva em uma linha o que fez o dia bom.', 'Conte a alguém o que te deixou bem hoje. Alegria dividida rende mais.', 'Anote o que ajudou o dia a ser bom, assim dá pra repetir amanhã.'],
  calma: ['Aproveite o embalo: dez minutos de leitura antes de dormir fecham bem o dia.', 'Repare no que trouxe essa calma hoje e deixe anotado.', 'Dia calmo é bom pra planejar o amanhã com leveza. Escolha uma coisa só.'],
  triste: ['Beba água, abra a janela e, se der, dê uma volta curta. O corpo ajuda a cabeça.', 'Escrever sobre o que pesou, mesmo em poucas linhas, costuma aliviar.', 'Hoje o mínimo já basta. Descansar também conta.'],
  ansiosa: ['Respire em quatro tempos: inspire contando 4, segure 4, solte contando 6. Repita cinco vezes.', 'Escreva as três coisas que mais ocupam a cabeça e escolha só uma pra amanhã.', 'Alongue pescoço e ombros por um minuto antes de dormir.'],
  brava: ['Escreva sem filtro o que irritou e depois feche o caderno. Sai da cabeça pro papel.', 'Uma caminhada curta ajuda a soltar a tensão do corpo.', 'Água fria no rosto e três respirações lentas ajudam a baixar a temperatura.'],
  misto: ['Dia cheio de emoções pede um fim de noite simples: luz baixa e alguns minutos sem tela.'],
  escrita: ['Releia o que escreveu hoje. Costuma mostrar o que realmente importou.'],
};

// escolhe por rotação do dia (não por sorteio), pra não mudar de texto toda vez que o card recarrega
function escolherDoDia(lista, deslocamento) {
  const diaDoAno = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);
  return lista[(diaDoAno + (deslocamento || 0)) % lista.length];
}

function horaCurta(iso) {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
}

function limparTrecho(texto, max) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '') + '…' : t;
}

// monta o conteúdo (puro: recebe dados, devolve título/texto/dica/contagens) — fácil de testar
function montarResumoDoDia({ eventos, posts, leuHoje, hora }) {
  const n = eventos.length;
  const contagem = {};
  eventos.forEach(e => { contagem[e.emocao] = (contagem[e.emocao] || 0) + 1; });
  const ordenadas = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  const dominante = ordenadas.length ? ordenadas[0][0] : null;
  const misto = ordenadas.length >= 4 || (ordenadas.length >= 3 && ordenadas[0][1] / n < 0.45);

  const chaveTitulo = !n ? 'escrita' : (misto ? 'misto' : dominante);
  const titulo = escolherDoDia(TITULOS_DIA[chaveTitulo] || TITULOS_DIA.escrita, 0);
  const dica = escolherDoDia(DICAS_DIA[chaveTitulo] || DICAS_DIA.escrita, 1);

  const frases = [];
  if (n === 1) {
    frases.push(`Você registrou um momento hoje: ${SUBSTANTIVO_HUMOR[eventos[0].emocao]}, às ${horaCurta(eventos[0].criado_em)}.`);
  } else if (n > 1 && ordenadas.length === 1) {
    frases.push(`Você registrou ${n} momentos e todos de ${SUBSTANTIVO_HUMOR[dominante]}: esse foi o tom do dia.`);
  } else if (n > 1) {
    const primeiro = eventos[0], ultimo = eventos[n - 1];
    frases.push(`Você registrou ${n} momentos. O dia começou com ${SUBSTANTIVO_HUMOR[primeiro.emocao]} (${horaCurta(primeiro.criado_em)}) e o último registro foi de ${SUBSTANTIVO_HUMOR[ultimo.emocao]} (${horaCurta(ultimo.criado_em)}).`);
    // horário mais movimentado, se algum horário teve 2+ toques
    const porHora = {};
    eventos.forEach(e => { const h = new Date(e.criado_em).getHours(); (porHora[h] = porHora[h] || []).push(e); });
    const pico = Object.entries(porHora).sort((a, b) => b[1].length - a[1].length)[0];
    if (pico && pico[1].length >= 2) {
      const emocoesPico = {};
      pico[1].forEach(e => { emocoesPico[e.emocao] = (emocoesPico[e.emocao] || 0) + 1; });
      const emocaoPico = Object.entries(emocoesPico).sort((a, b) => b[1] - a[1])[0][0];
      frases.push(`Perto das ${String(pico[0]).padStart(2, '0')}h foi o momento mais movimentado, com ${SUBSTANTIVO_HUMOR[emocaoPico]}.`);
    }
    if (!misto) frases.push(`${SUBSTANTIVO_HUMOR[dominante][0].toUpperCase() + SUBSTANTIVO_HUMOR[dominante].slice(1)} foi o que mais apareceu.`);
  }

  let trechoDestaque = null;
  if (posts.length) {
    frases.push(`Você escreveu ${posts.length === 1 ? 'uma vez' : posts.length + ' vezes'} hoje.`);
    const maior = posts.slice().sort((a, b) => String(b.texto || '').length - String(a.texto || '').length)[0];
    if (maior && String(maior.texto || '').trim().length >= 12) trechoDestaque = limparTrecho(maior.texto, 90);
  }
  if (leuHoje) frases.push('E ainda passou pelos seus livros hoje.');

  return { titulo, texto: frases.join(' '), dica, destaque: trechoDestaque, contagem: ordenadas, total: n, escritas: posts.length, saudacao: hora < 19 ? 'seu dia até agora' : 'seu dia' };
}

async function carregarResumoDia() {
  const wrap = document.getElementById('homeResumoWrap');
  if (!wrap) return;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData || !sessionData.session) return;
  const meuId = sessionData.session.user.id;

  const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
  const hojeISO = fmtDataISO(new Date());
  try { if (localStorage.getItem('atomo_resumo_dispensado') === hojeISO) { wrap.style.display = 'none'; return; } } catch (e) { /* sem storage */ }

  const [respEventos, respPosts, respLeitura] = await Promise.all([
    supabaseClient.from('humor_eventos').select('emocao, criado_em').eq('usuario_id', meuId).gte('criado_em', inicioHoje.toISOString()).order('criado_em', { ascending: true }),
    supabaseClient.from('posts').select('texto, tipo, privado').eq('autor_id', meuId).is('clube_id', null).gte('criado_em', inicioHoje.toISOString()),
    supabaseClient.from('logs_leitura').select('data', { count: 'exact', head: true }).eq('usuario_id', meuId).eq('data', hojeISO),
  ]);
  const eventos = respEventos.data || [];
  const posts = (respPosts.data || []).filter(p => String(p.texto || '').trim());
  if (!eventos.length && !posts.length) { wrap.style.display = 'none'; return; }

  const r = montarResumoDoDia({ eventos, posts, leuHoje: (respLeitura.count || 0) > 0, hora: new Date().getHours() });
  window.RESUMO_DIA_ATUAL = r;

  document.getElementById('resumoDiaRotulo').textContent = r.saudacao;
  document.getElementById('resumoDiaTitulo').textContent = r.titulo;
  document.getElementById('resumoDiaBarra').innerHTML = r.total
    ? r.contagem.map(([emo, qtd]) => `<span class="home-resumo-barra-seg" style="flex:${qtd}; background:${HUMOR_CORES[emo] || 'var(--accent-a)'};" title="${SUBSTANTIVO_HUMOR[emo]}: ${qtd}"></span>`).join('')
      + '' : '';
  document.getElementById('resumoDiaBarraLegenda').innerHTML = r.total
    ? r.contagem.map(([emo, qtd]) => `<span class="home-resumo-leg"><i style="background:${HUMOR_CORES[emo] || 'var(--accent-a)'};"></i>${SUBSTANTIVO_HUMOR[emo]} ${qtd}</span>`).join('')
    : '';
  document.getElementById('resumoDiaBarraWrap').style.display = r.total ? '' : 'none';

  document.getElementById('resumoDiaTexto').textContent = r.texto;
  const elDestaque = document.getElementById('resumoDiaDestaque');
  if (r.destaque) { elDestaque.textContent = '“' + r.destaque + '”'; elDestaque.style.display = ''; } else { elDestaque.style.display = 'none'; }
  document.getElementById('resumoDiaElogio').textContent = r.dica;
  document.getElementById('resumoDiaElogio').style.display = '';

  const stats = [];
  if (r.total) stats.push({ n: r.total, l: r.total === 1 ? 'momento' : 'momentos', ic: 'sol' });
  if (r.escritas) stats.push({ n: r.escritas, l: r.escritas === 1 ? 'escrita' : 'escritas', ic: 'editar' });
  stats.push({ n: streakAtual, l: streakAtual === 1 ? 'dia seguido' : 'dias seguidos', ic: 'fogo' });
  document.getElementById('resumoDiaStats').innerHTML = stats.map(s => `<div class="home-resumo-stat">${icone(s.ic, 12)} ${s.n} ${s.l}</div>`).join('');
  wrap.style.display = '';
}

window.dispensarResumoDia = function () {
  document.getElementById('homeResumoWrap').style.display = 'none';
  try { localStorage.setItem('atomo_resumo_dispensado', fmtDataISO(new Date())); } catch (e) { /* sem storage */ }
};

// o texto compartilhado leva título, resumo e dica — nunca o trecho do que foi escrito (pode ser diário privado)
window.compartilharResumoDia = async function () {
  const r = window.RESUMO_DIA_ATUAL;
  if (!r) return;
  const texto = `📊 ${r.titulo}\n${r.texto}\n\n${r.dica}\n\nAtomo · meu diário tem visitas.`;
  if (navigator.share) {
    try { await navigator.share({ text: texto }); return; } catch (e) { return; }
  }
  try { await navigator.clipboard.writeText(texto); mostrarToast('📋 copiado! cola onde quiser'); }
  catch (e) { mostrarToast('não deu pra copiar dessa vez'); }
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
