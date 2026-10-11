/* js/sequencia-selos.js — Sequência de escrita (streak), selos conquistados e coleção de selos
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- sequência de escrita: marcos e proteção (inspirado no Duolingo) ----------
const MARCOS_SEQUENCIA = [7, 30, 100, 365];
let streakAtual = 0;

window.abrirDetalheSequencia = function () {
  document.getElementById('seqPopupNum').textContent = streakAtual;
  const proximo = MARCOS_SEQUENCIA.find(m => m > streakAtual) || MARCOS_SEQUENCIA[MARCOS_SEQUENCIA.length - 1];
  const anterior = [0, ...MARCOS_SEQUENCIA].reverse().find(m => m <= streakAtual) || 0;
  const pct = Math.min(100, ((streakAtual - anterior) / (proximo - anterior)) * 100);
  document.getElementById('seqProgressFill').style.width = pct + '%';
  const faltam = proximo - streakAtual;
  document.getElementById('seqProgressLabel').textContent = faltam > 0
    ? `${faltam} dia${faltam > 1 ? 's' : ''} pro seu marco de ${proximo} dias`
    : `Marco de ${proximo} dias alcançado!`;
  if (window.STREAK_EM_CHANCE) document.getElementById('seqProgressLabel').textContent += ' · 🛟 chance usada: escreva hoje pra manter';
  document.getElementById('sequenciaPopupBg').classList.add('show');
};
window.fecharSequenciaPopup = function () {
  document.getElementById('sequenciaPopupBg').classList.remove('show');
};

// ofensiva (sequência de dias escrevendo) com UMA CHANCE de recuperação:
// se a pessoa esquecer exatamente 1 dia, a sequência não zera — esse dia em branco é perdoado
// (não conta como dia escrito). Cada chance só volta a valer depois de 7 dias escritos,
// então dá pra errar de vez em quando mas não vira regra. Dois dias seguidos em branco zera.
const DIAS_ENTRE_CHANCES = 7;
window.STREAK_EM_CHANCE = false;      // true = ontem passou em branco, hoje ainda dá pra salvar
window.MELHOR_STREAK_HISTORICO = 0;   // maior sequência já feita (pra nunca perder selo já ganho)

async function calcularStreakReal(usuarioId) {
  const { data: posts } = await supabaseClient
    .from('posts')
    .select('criado_em')
    .eq('autor_id', usuarioId)
    .order('criado_em', { ascending: false });

  window.STREAK_EM_CHANCE = false;
  window.MELHOR_STREAK_HISTORICO = 0;
  if (!posts || !posts.length) return 0;

  const diasUnicos = [...new Set(posts.map(p => p.criado_em.slice(0, 10)))].sort().reverse(); // do mais novo pro mais antigo
  const diffDias = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);

  // melhor sequência de todos os tempos (mesma regra da chance), do mais antigo pro mais novo
  const crescente = [...diasUnicos].reverse();
  let corrida = 1, desdeChance = DIAS_ENTRE_CHANCES, melhor = 1;
  for (let i = 1; i < crescente.length; i++) {
    const d = diffDias(crescente[i], crescente[i - 1]);
    if (d === 1) { corrida++; desdeChance++; }
    else if (d === 2 && desdeChance >= DIAS_ENTRE_CHANCES) { corrida++; desdeChance = 0; }
    else { corrida = 1; desdeChance = DIAS_ENTRE_CHANCES; }
    if (corrida > melhor) melhor = corrida;
  }
  window.MELHOR_STREAK_HISTORICO = melhor;

  // sequência de agora
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasoTopo = diffDias(hoje, diasUnicos[0]); // 0 = escreveu hoje, 1 = ontem, 2 = ontem ficou em branco
  if (atrasoTopo > 2) return 0;
  let streak = 1;
  let desdeUltimaChance = DIAS_ENTRE_CHANCES;
  if (atrasoTopo === 2) { window.STREAK_EM_CHANCE = true; desdeUltimaChance = 0; }
  for (let i = 0; i < diasUnicos.length - 1; i++) {
    const d = diffDias(diasUnicos[i], diasUnicos[i + 1]);
    if (d === 1) { streak++; desdeUltimaChance++; }
    else if (d === 2 && desdeUltimaChance >= DIAS_ENTRE_CHANCES) { streak++; desdeUltimaChance = 0; }
    else break;
  }
  return streak;
}

// ---------- selos conquistados ficam guardados (não dependem da sequência de agora) ----------
let selosGanhos = new Set(); // números 1..20, um por semana completa de sequência

async function carregarSelosGanhos(usuarioId) {
  const chave = 'atomo_selos_' + usuarioId;
  const conjunto = new Set();
  try { JSON.parse(localStorage.getItem(chave) || '[]').forEach(n => conjunto.add(n)); } catch (e) { /* cache vazio */ }
  const noBanco = new Set();
  let leuBanco = false;
  try {
    const { data, error } = await supabaseClient.from('selos_desbloqueados').select('selo_numero').eq('usuario_id', usuarioId);
    if (!error && data) { leuBanco = true; data.forEach(r => { conjunto.add(r.selo_numero); noBanco.add(r.selo_numero); }); }
  } catch (e) { /* tabela indisponível: segue com o cache do aparelho */ }
  // quem já fez 7+ dias seguidos em algum momento tem o selo, mesmo que a sequência tenha zerado depois
  const maior = Math.max(streakAtual, window.MELHOR_STREAK_HISTORICO || 0);
  for (let n = 1; n <= Math.min(Math.floor(maior / 7), SELOS.length); n++) conjunto.add(n);
  selosGanhos = conjunto;
  try { localStorage.setItem(chave, JSON.stringify([...conjunto])); } catch (e) { /* sem storage */ }
  if (leuBanco) {
    const faltando = [...conjunto].filter(n => !noBanco.has(n));
    if (faltando.length) {
      try { await supabaseClient.from('selos_desbloqueados').insert(faltando.map(n => ({ usuario_id: usuarioId, selo_numero: n }))); } catch (e) { /* tenta de novo na próxima entrada */ }
    }
  }
  renderSelosPerfil();
}
const seloDesbloqueado = (indice, semanasCompletas) => selosGanhos.has(indice + 1) || indice < semanasCompletas;

window.simularDiaSequencia = async function () {
const antigo = streakAtual;
streakAtual++;
atualizarStreakPill(streakAtual);
fecharSequenciaPopup();
renderSelosPerfil();

const { data: sessionData } = await supabaseClient.auth.getSession();
await supabaseClient.from('usuarios').update({ streak_atual: streakAtual }).eq('id', sessionData.session.user.id);

setTimeout(async () => {
  const ganhouSelo = await checarNovoSelo(antigo, streakAtual);
  if (!ganhouSelo) checarMarco(streakAtual);
}, 400);
};

function checarMarco(novoValor) {
  if (MARCOS_SEQUENCIA.includes(novoValor)) {
    document.getElementById('marcoTitulo').textContent = `${novoValor} dias seguidos!`;
    document.getElementById('marcoTexto').textContent = novoValor >= 100
      ? 'Isso é raro demais. Seu diário é uma parte da sua rotina agora'
      : 'Sua sequência de escrita tá firme. Continue assim';
    document.getElementById('marcoCelebracao').classList.add('show');
  }
}
window.fecharMarco = function () {
  document.getElementById('marcoCelebracao').classList.remove('show');
};

// ---------- coleção de selos (1 por semana de sequência) ----------
const SELOS = [
{nome:"Primeiro Capítulo (Iniciante)",cor:"#D9714A",imagem:"./selos/01.webp",frase:"O começo de tudo: sua primeira semana de leitura."},
{nome:"Leitor Assíduo",cor:"#4A9B8E",imagem:"./selos/02.webp",frase:"Ler virou parte da sua rotina."},
{nome:"Sábio Júnior",cor:"#8A6540",imagem:"./selos/03.webp",frase:"Você já sabe mais do que finge não saber."},
{nome:"Caçador de Histórias",cor:"#6B7A99",imagem:"./selos/04.webp",frase:"Nenhuma trama escapa de você."},
{nome:"Místico do Conhecimento",cor:"#C99A3E",imagem:"./selos/05.webp",frase:"As palavras já revelam seus segredos pra você."},
{nome:"Viajante do Tempo",cor:"#5A9BAE",imagem:"./selos/06.webp",frase:"Cada livro é uma nova época que você visita."},
{nome:"Estrela da Leitura",cor:"#E8A83D",imagem:"./selos/07.webp",frase:"Seu brilho ilumina até as páginas mais densas."},
{nome:"Guardião da Livraria",cor:"#E06B6B",imagem:"./selos/08.webp",frase:"Protetor(a) de todo livro que passa pelas suas mãos."},
{nome:"Mensageiro do Saber",cor:"#7C9473",imagem:"./selos/09.webp",frase:"Leva conhecimento pra onde quer que vá."},
{nome:"Grão-Mestre (Sapo sábio)",cor:"#B5563C",imagem:"./selos/10.webp",frase:"Sabedoria silenciosa de quem já viu de tudo."},
{nome:"Alquimista das Palavras",cor:"#9B6B9E",imagem:"./selos/11.webp",frase:"Transforma frases em ouro puro."},
{nome:"Bardíssimo",cor:"#3E8E7E",imagem:"./selos/12.webp",frase:"Suas histórias já viraram lenda entre os amigos."},
{nome:"Colecionador de Memórias",cor:"#C77B3E",imagem:"./selos/13.webp",frase:"Cada capítulo lido é uma lembrança guardada."},
{nome:"Escrita Imperial",cor:"#6E5A8C",imagem:"./selos/14.webp",frase:"Reina absoluto(a) sobre suas próprias palavras."},
{nome:"Sonhador de Páginas",cor:"#A9A15A",imagem:"./selos/15.webp",frase:"Vive entre mundos que só existem no papel."},
{nome:"Leitor de Estrelas",cor:"#4A6FA5",imagem:"./selos/16.webp",frase:"Enxerga histórias onde ninguém mais olha."},
{nome:"Aventureiro Gourmet",cor:"#D4986B",imagem:"./selos/17.webp",frase:"Devora cada história com apetite de sobra."},
{nome:"Escalador de Biblioteca",cor:"#5C8A5C",imagem:"./selos/18.webp",frase:"Não tem estante alta demais pra você."},
{nome:"Mestre das Lendas",cor:"#A15C3E",imagem:"./selos/19.webp",frase:"Já é referência entre os grandes leitores."},
{nome:"Supremo Leitor de Elite (Nível Máximo / Master)",cor:"#C9A227",imagem:"./selos/20.webp",frase:"O topo. Ninguém lê como você."}
];

function conteudoSelo(selo) {
  return `<img src="${selo.imagem}" alt="${selo.nome}" loading="lazy">`;
}

// cadeado desenhado a mao (nunca emoji generico) pro selo de-facto ainda
// nao alcancado -- fica por cima do icone (que ja aparece dessaturado via
// .bloqueado no css), como um pino fixo no canto, sem ser afetado pelo
// filtro de grayscale/opacidade do icone.
const ICONE_CADEADO_SELO = '<div class="selo-lock-pin"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2.4"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>';

window.abrirSeloIndividual = function (nome) {
const selo = SELOS.find(s => s.nome === nome);
const svgEl = document.getElementById('seloIndividualSvg');
svgEl.innerHTML = conteudoSelo(selo);
svgEl.classList.remove('abrindo');
void svgEl.offsetWidth;
svgEl.classList.add('abrindo');
document.getElementById('seloIndividualTitulo').textContent = selo.nome;
document.getElementById('seloIndividualFrase').textContent = selo.frase || '';
document.getElementById('seloIndividualOverlay').classList.add('show');
};

window.fecharSeloIndividual = function () {
document.getElementById('seloIndividualOverlay').classList.remove('show');
};

window.abrirColecaoSelos = function () {
  document.getElementById('sequenciaPopupBg').classList.remove('show');
  const semanasCompletas = Math.floor(streakAtual / 7);
  const totalDesbloqueados = SELOS.filter((s, i) => seloDesbloqueado(i, semanasCompletas)).length;
  document.getElementById('selosSub').textContent = `${totalDesbloqueados} de ${SELOS.length} selos desbloqueados`;
  document.getElementById('selosGrid').innerHTML = SELOS.map((s, i) => {
    const desbloqueado = seloDesbloqueado(i, semanasCompletas);
    return `<div class="selo-item ${desbloqueado ? '' : 'bloqueado'}">
        <div class="selo-circulo">${conteudoSelo(s)}</div>
        ${desbloqueado ? '' : ICONE_CADEADO_SELO}
        <div class="selo-nome">${s.nome}</div>
      </div>`;
  }).join('');
  document.getElementById('colecaoSelosOverlay').classList.add('open');
  renderSelosPerfil();
};
