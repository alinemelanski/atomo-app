/* js/descobrir.js — Aba Descobrir, aba Livros e lista de clubes do livro
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- descobrir ----------
let regiaoAtiva = 'todos';
window.filtrarRegiao = function (r) {
  regiaoAtiva = r;
  document.querySelectorAll('.regiao-chip').forEach(c => c.classList.toggle('on', c.dataset.r === r));
  renderDiscover();
};

const TUMBLR_TAGS_PADRAO = ['diario', 'poesia', 'frases', 'leitura', 'reflexão', 'escrita', 'literatura brasileira', 'resenha'];
function embaralhar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}
let termoBuscaDescobrir = '';
let debounceBuscaDescobrir = null;
window.aoDigitarBuscaDescobrir = function () {
  clearTimeout(debounceBuscaDescobrir);
  debounceBuscaDescobrir = setTimeout(() => {
    termoBuscaDescobrir = document.getElementById('buscaDescobrirInput').value.trim();
    renderDiscover();
  }, 400);
};

let modoDescobrirAtivo = 'relevante';
window.trocarModoDescobrir = function (modo) {
modoDescobrirAtivo = modo;
document.querySelectorAll('.feed-modo-chip[data-modo-descobrir]').forEach(c => c.classList.toggle('on', c.dataset.modoDescobrir === modo));
renderDiscover();
};

// ---------- aba própria: livros ----------
let modoLivrosAtivo = 'clube';
window.trocarModoLivros = function (modo) {
  modoLivrosAtivo = modo;
  document.querySelectorAll('.feed-modo-chip[data-modo-livros]').forEach(c => c.classList.toggle('on', c.dataset.modoLivros === modo));
  // reinicia o "pulinho" do ícone, mesmo quando toca de novo no que já estava ativo
  const svgAtivo = document.querySelector('.feed-modo-chip[data-modo-livros="' + modo + '"] svg');
  if (svgAtivo) { svgAtivo.style.animation = 'none'; void svgAtivo.getBoundingClientRect(); svgAtivo.style.animation = ''; }
  document.getElementById('buscaLivrosWrap').style.display = modo === 'gratuitos' ? 'flex' : 'none';
  renderLivrosAtual();
};

window.renderLivrosAtual = function () {
  if (modoLivrosAtivo === 'clube') return renderClubes();
  if (modoLivrosAtivo === 'comunidades') return renderComunidades();
  if (modoLivrosAtivo === 'estante') return renderEstante();
  return renderLivros();
};

let termoBuscaLivros = '';
let debounceBuscaLivros = null;
window.aoDigitarBuscaLivros = function () {
  clearTimeout(debounceBuscaLivros);
  debounceBuscaLivros = setTimeout(() => {
    termoBuscaLivros = document.getElementById('buscaLivrosInput').value.trim();
    renderLivros();
  }, 400);
};

// ---------- clube do livro ----------
window.ITENS_CLUBES_ATUAIS = [];

async function renderClubes() {
  const lista = document.getElementById('livrosList');
  lista.innerHTML = skeletonCardsHtml(3);

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session ? sessionData.session.user.id : null;

  const { data: clubes, error } = await supabaseClient
    .from('clubes_livro')
    .select('*, clube_membros(usuario_id)')
    .order('criado_em', { ascending: false });

  if (error) {
    lista.innerHTML = `<div class="visitor-lock-note">Não consegui carregar os clubes agora${error.message.includes('clubes_livro') ? ' — a tabela ainda não existe no banco, falta rodar a migração' : ''}.</div>`;
    return;
  }

  window.ITENS_CLUBES_ATUAIS = clubes || [];
  const totalClubes = (clubes || []).length;
  const meusClubes = (clubes || []).filter(c => (c.clube_membros || []).some(m => m.usuario_id === meuId)).length;

  lista.innerHTML = `
      <div class="clube-lista-wrap">
        <svg class="clube-watermark" viewBox="0 0 100 100">
          <path d="M18 12 L42 6 L58 4 L74 14 L88 10 L94 26 L96 44 L90 58 L94 74 L82 84 L66 96 L48 92 L30 98 L14 88 L6 72 L4 54 L10 38 L6 22 Z" stroke-width="1.2"/>
          <path class="scribble-marca" d="M3,52 C7,39 27,32 51,37 C73,31 98,43 94,52 C99,61 77,68 48,62 C21,69 1,58 3,52 Z" transform="rotate(15 50 50)"/>
          <path class="scribble-marca" d="M6,47 C3,37 29,34 53,36 C71,29 95,44 91,54 C97,57 73,67 47,60 C25,72 2,55 6,47 Z" transform="rotate(95 50 50)"/>
        </svg>
        <div class="clube-titulo-grande">Clube do Livro</div>
        <div class="clube-sub-grande">${totalClubes} clube${totalClubes === 1 ? '' : 's'}${meusClubes ? ` · você participa de ${meusClubes}` : ''}</div>
        <button class="clube-criar-btn" onclick="abrirCriarClube()">Criar novo clube</button>
        ${clubes && clubes.length
        ? clubes.map((c, i) => cardClubeHtml(c, i, meuId)).join('')
        : estadoVazio('nenhum clube ainda', 'crie o primeiro e chame gente pra discutir livro junto')}
      </div>`;
  completarCapasClubes(clubes); // sem await: a lista aparece já, as capas chegam em seguida
}

function cardClubeHtml(c, i, meuId) {
  const membros = c.clube_membros || [];
  const souMembro = membros.some(m => m.usuario_id === meuId);
  const capa = c.livro_capa_url;
  // card COMPACTO: capa do livro nítida à esquerda + a mesma capa borrada no fundo
  // (data-clube-capa = lugar onde a capa entra depois, se ela vier do Google Books)
  return `
      <div class="clube-card-grande" style="animation-delay:${Math.min(i, 6) * 0.05}s;" onclick="abrirClube(${i})" data-clube-id="${c.id}">
        <div class="clube-card-fundo"${capa ? ` style="background-image:url('${capa}');"` : ''}></div>
        <div class="clube-card-scrim"></div>
        <div class="clube-card-livro-capa${capa ? '' : ' sem-capa'}"${capa ? ` style="background-image:url('${capa}');"` : ''}>${capa ? '' : icone('livro', 22, i, '#fff')}</div>
        <div class="clube-card-info">
          <div class="clube-card-pills">
            <span class="clube-card-pill">${icone('pessoas', 11, i)} ${membros.length}${souMembro ? ' · você' : ''}</span>
            ${c.privado ? `<span class="clube-card-pill">${icone('cadeado', 11, i)}</span>` : ''}
          </div>
          <div class="clube-card-nome">${c.nome}</div>
          <div class="clube-card-livro">${c.livro_titulo ? `${icone('livro', 12, i)} lendo agora: ${c.livro_titulo}` : 'sem livro definido ainda'}</div>
        </div>
      </div>`;
}

// ---------- capas que faltam: busca no Google Books ----------
// PRA APRENDER: os clubes de teste foram criados só com título e autor (sem
// link de capa). Depois que a lista aparece, procuramos a capa de cada um no
// Google Books (pelo nosso servidor, que guarda a chave da API) e:
//   1. colocamos a capa no card na hora;
//   2. tentamos salvar o link no banco (livro_capa_url). Só quem administra
//      o clube tem permissão (RLS) — se não tiver, tudo bem, a busca só
//      acontece de novo na próxima vez;
//   3. guardamos num "cache" da sessão pra não buscar o mesmo livro 2 vezes.
const CAPAS_CLUBE_CACHE = {};
async function completarCapasClubes(clubes) {
  const semCapa = (clubes || []).filter(c => !c.livro_capa_url && c.livro_titulo);
  for (const c of semCapa) {
    const chave = (c.livro_titulo + ' ' + (c.livro_autor || '')).trim();
    try {
      let capa = CAPAS_CLUBE_CACHE[chave];
      if (capa === undefined) {
        const resp = await fetch(`${API_BASE}/api/livros-em-destaque?q=${encodeURIComponent(chave)}&somenteGoogle=1`);
        const dados = await resp.json();
        const achado = (dados.items || []).find(l => l.fonte === 'Google Books' && l.capa);
        capa = achado ? achado.capa.replace('http://', 'https://') : null;
        CAPAS_CLUBE_CACHE[chave] = capa;
      }
      if (!capa) continue;
      c.livro_capa_url = capa; // o detalhe do clube também passa a ter a capa
      const card = document.querySelector(`.clube-card-grande[data-clube-id="${c.id}"]`);
      if (card) {
        card.querySelector('.clube-card-fundo').style.backgroundImage = `url('${capa}')`;
        const mini = card.querySelector('.clube-card-livro-capa');
        mini.classList.remove('sem-capa');
        mini.innerHTML = '';
        mini.style.backgroundImage = `url('${capa}')`;
      }
      supabaseClient.from('clubes_livro').update({ livro_capa_url: capa }).eq('id', c.id).then(() => {}, () => {});
    } catch (e) { /* sem capa: o card continua com o ícone */ }
  }
}
