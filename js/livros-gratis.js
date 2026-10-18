/* js/livros-gratis.js — Cards e paginação dos livros gratuitos (cache de páginas)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

function skeletonCardsHtml(n) {
  return Array.from({ length: n }).map(() => `
      <div class="skeleton-card">
        <div class="skeleton-bar sk-w40"></div>
        <div class="skeleton-bar sk-w90"></div>
        <div class="skeleton-bar sk-w60"></div>
      </div>`).join('');
}

function cardLivroGridHtml(d, i) {
  const cor = CORES_LOMBADA_ESTANTE[i % CORES_LOMBADA_ESTANTE.length];
  const fonteTxt = d.fonte === 'Google Books' && !d.leituraCompleta
    ? 'amostra'
    : (d.fonte === 'Open Library' && d.leituraCompleta
      ? 'leitura completa'
      : (d.fonte === 'Wikisource' ? 'domínio público' : ''));
  const capaEstilo = d.capa ? `background-image:url('${d.capa}');` : `background:${cor};`;
  return `
        <div class="livro-grid-card" onclick="abrirLivroPreview(${i})">
          <div class="livro-grid-capa" style="${capaEstilo}">
            ${!d.capa ? `<div class="capa-fallback-titulo">${d.title}</div>` : ''}
            <span class="livro-grid-ribbon">Gratuito</span>
            <span class="livro-grid-idioma">${(d.idioma || 'pt').toUpperCase()}</span>
          </div>
          <div class="livro-grid-meta">
            <div class="livro-grid-titulo">${d.title}</div>
            ${fonteTxt ? `<div class="livro-grid-fonte">${fonteTxt}</div>` : ''}
          </div>
        </div>`;
}

// livros gratuitos mais rápidos depois da primeira leva: cada página fica guardada na memória
// (reabrir a aba ou voltar uma busca já feita é instantâneo) e a PRÓXIMA página já é buscada
// em segundo plano enquanto a pessoa olha a atual, então o "carregar mais" chega pronto
const CACHE_PAGINAS_LIVROS = new Map(); // "termo|pagina" -> { quando, promessa }
const CACHE_PAGINAS_LIVROS_TTL_MS = 10 * 60 * 1000;

function pedirPaginaLivros(pagina, termo) {
  const chave = termo + '|' + pagina;
  const guardada = CACHE_PAGINAS_LIVROS.get(chave);
  if (guardada && Date.now() - guardada.quando < CACHE_PAGINAS_LIVROS_TTL_MS) return guardada.promessa;
  if (CACHE_PAGINAS_LIVROS.size > 40) CACHE_PAGINAS_LIVROS.delete(CACHE_PAGINAS_LIVROS.keys().next().value);
  const promessa = buscarPaginaLivrosRede(pagina, termo);
  CACHE_PAGINAS_LIVROS.set(chave, { quando: Date.now(), promessa });
  promessa.then(itens => { if (!itens.length) CACHE_PAGINAS_LIVROS.delete(chave); }); // não guarda falha
  return promessa;
}

async function buscarPaginaLivros(pagina) {
  const termo = termoBuscaLivros;
  const itens = await pedirPaginaLivros(pagina, termo);
  if (itens.length && !(navigator.connection && navigator.connection.saveData)) {
    setTimeout(() => { if (modoLivrosAtivo === 'gratuitos') pedirPaginaLivros(pagina + 1, termo); }, 600);
  }
  return itens;
}

async function buscarPaginaLivrosRede(pagina, termoBuscaLivros) {
  // manda o idioma do app junto: em inglês o servidor também traz livros em inglês
  const url = termoBuscaLivros
    ? `${API_BASE}/api/livros-em-destaque?q=${encodeURIComponent(termoBuscaLivros)}&pagina=${pagina}&idioma=${idiomaAtual}`
    : `${API_BASE}/api/livros-em-destaque?pagina=${pagina}&idioma=${idiomaAtual}`;
  try {
    const resp = await fetch(url);
    const dados = await resp.json();
    return (dados.items || []).map(l => {
      const info = l.volumeInfo;
      return {
        kind: '📖 Livro',
        title: info.title || 'Sem título',
        desc: (info.description || 'Sem descrição disponível.').slice(0, 150),
        link: info.link || null,
        fonte: l.fonte || null,
        googleId: l.googleId || null,
        gutendexId: l.gutendexId || null,
        coverId: l.coverId || null,
        iaId: l.iaId || null,
        wikisourceTitulo: l.wikisourceTitulo || null,
        capa: l.capa || null,
        autor: l.autor || '',
        leituraCompleta: l.leituraCompleta === true,
        idioma: l.idioma || 'pt',
      };
    });
  } catch (e) { console.log('erro ao carregar livros:', e); return []; }
}

let livrosPagina = 1;
let livrosCarregandoMais = false;

async function renderLivros() {
  const lista = document.getElementById('livrosList');
  lista.innerHTML = skeletonCardsHtml(4);
  livrosPagina = 1;

  // vitrine padrão (sem busca): mostra na hora a última leva guardada no aparelho e atualiza por baixo
  const CHAVE_CACHE = 'atomo_livros_pagina1';
  let mostrouCache = false;
  if (!termoBuscaLivros) {
    try {
      const c = JSON.parse(localStorage.getItem(CHAVE_CACHE) || 'null');
      if (c && Array.isArray(c.itens) && c.itens.length && Date.now() - c.t < 6 * 60 * 60 * 1000) {
        window.ITENS_LIVROS_ATUAIS = c.itens;
        lista.innerHTML = `<div class="livros-grid">${c.itens.map((d, i) => cardLivroGridHtml(d, i)).join('')}</div>`;
        mostrouCache = true;
      }
    } catch (e) { /* cache ilegível: segue pela rede */ }
  }

  const itens = await buscarPaginaLivros(1);

  if (!termoBuscaLivros && itens.length) {
    try { localStorage.setItem(CHAVE_CACHE, JSON.stringify({ t: Date.now(), itens })); } catch (e) { /* sem espaço/storage */ }
  }
  if (mostrouCache) {
    // só troca a lista se a pessoa ainda não pediu mais livros e se algo realmente mudou
    const mudou = JSON.stringify((window.ITENS_LIVROS_ATUAIS || []).map(d => d.title)) !== JSON.stringify(itens.map(d => d.title));
    if (!itens.length || !mudou || livrosPagina !== 1) return;
  }

  window.ITENS_LIVROS_ATUAIS = itens;
  lista.innerHTML = itens.length
    ? `<div class="livros-grid">${itens.map((d, i) => cardLivroGridHtml(d, i)).join('')}</div>`
    : `<div class="visitor-lock-note">Nenhum livro encontrado ainda — tenta buscar por outro termo.</div>`;
}

window.carregarMaisLivros = async function () {
  if (modoLivrosAtivo !== 'gratuitos') return;
  if (livrosCarregandoMais) return;
  livrosCarregandoMais = true;
  livrosPagina++;
  const novos = await buscarPaginaLivros(livrosPagina);
  window.ITENS_LIVROS_ATUAIS = [...(window.ITENS_LIVROS_ATUAIS || []), ...novos];
  document.getElementById('livrosList').innerHTML = window.ITENS_LIVROS_ATUAIS.length
    ? `<div class="livros-grid">${window.ITENS_LIVROS_ATUAIS.map((d, i) => cardLivroGridHtml(d, i)).join('')}</div>`
    : `<div class="visitor-lock-note">Nenhum livro encontrado ainda — tenta buscar por outro termo.</div>`;
  livrosCarregandoMais = false;
};
