/* js/descobrir-itens.js — Preview de livro, cards e paginação do Descobrir, notícias
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

window.abrirLivroPreview = async function (i) {
  const item = window.ITENS_LIVROS_ATUAIS[i];
  if (!item) return;

  document.getElementById('livroPreviewTitulo').textContent = item.title;
  const corpo = document.getElementById('livroPreviewCorpo');
  document.getElementById('livroPreviewOverlay').classList.add('open');

  // capa "de livro de verdade" (nada de iframe genérico do Google) — a
  // mesma moldura pra qualquer fonte, com fallback num retângulo colorido
  // quando não tem imagem de capa disponível
  const capaUrl = item.capa || (item.coverId ? `https://covers.openlibrary.org/b/id/${item.coverId}-L.jpg` : null);
  const heroHtml = `
      <div class="livro-hero">
        ${capaUrl
        ? `<img class="capa-img" src="${capaUrl}" alt="" onerror="mostrarCapaVaziaLivro(this)">`
        : `<div class="capa-vazia">${icone('livro', 36, i)}</div>`}
        <div class="titulo-livro">${item.title}</div>
        ${item.autor ? `<div class="autor-livro">${item.autor}</div>` : ''}
      </div>`;

  if (item.fonte === 'Gutendex' && item.gutendexId) {
    corpo.innerHTML = heroHtml + `
        <div class="bio-box">clássico de domínio público — dá pra ler o livro inteiro, direto por aqui</div>
        <button class="post-btn" style="width:100%; padding:13px;" onclick="abrirLeitorLivroGutendex(${i})">${icone('livro',14)} ler</button>
        ${item.link ? `<div style="text-align:center; margin-top:10px;"><div class="livro-link-externo" onclick="window.open('${item.link}', '_blank')">${icone('link',13)} ver na página do Gutenberg</div></div>` : ''}
      `;
    return;
  }

  // Wikisource: transcrição de voluntários (não é OCR), texto limpo — usa
  // o mesmo leitor paginado do Gutendex, só muda de onde busca o texto
  if (item.fonte === 'Wikisource' && item.wikisourceTitulo) {
    corpo.innerHTML = heroHtml + `
        <div class="bio-box">domínio público (Wikisource) — dá pra ler o texto inteiro, direto por aqui</div>
        <button class="post-btn" style="width:100%; padding:13px;" onclick="abrirLeitorLivroWikisource(${i})">${icone('livro',14)} ler</button>
        ${item.link ? `<div style="text-align:center; margin-top:10px;"><div class="livro-link-externo" onclick="window.open('${item.link}', '_blank')">${icone('link',13)} ver na Wikisource</div></div>` : ''}
      `;
    return;
  }

  // Open Library: quando o Internet Archive tem uma cópia digitalizada de
  // acesso público, o livro dá pra ler de verdade aqui dentro, com o
  // visualizador do próprio archive.org (leitor real, confiável, nada de
  // API antiga do Google que parou de funcionar).
  if (item.fonte === 'Open Library' && item.leituraCompleta && item.iaId) {
    corpo.innerHTML = heroHtml + `
        <div class="bio-box">esse aqui dá pra ler completo, direto por aqui</div>
        <button class="post-btn" style="width:100%; padding:13px;" onclick="abrirLeitorOpenLibrary(${i})">${icone('livro',14)} ler</button>
      `;
    return;
  }

  // Google Books só libera consulta de metadados pela API (o visualizador
  // incorporado antigo do Google foi descontinuado e parou de funcionar) —
  // então aqui é só descrição + link pra abrir a amostra no site deles.
  const avisoAmostraGoogle = item.fonte === 'Google Books' && !item.leituraCompleta
    ? `<div class="bio-box" style="margin-bottom:10px;">👀 o Google só libera uma amostra desse livro pra ler — pra ler ele inteiro é preciso comprar ou pegar emprestado no site deles.</div>`
    : '';

  corpo.innerHTML = heroHtml + avisoAmostraGoogle + `
      <div class="discover-desc" style="margin-bottom:14px;">${item.desc}</div>
      ${item.link
      ? `<div style="text-align:center;"><div class="livro-link-externo" onclick="window.open('${item.link}', '_blank')">${icone('link',13)} abrir no site de origem</div></div>`
      : `<div class="visitor-lock-note">Prévia não disponível pra este livro.</div>`}
    `;
};

function cardDescobrirHtml(d, i) {
return `
      <div class="discover-card ${d.destaque ? 'discover-card-destaque' : ''}">
        <span class="discover-kind">${d.kind}</span>
        ${d.imagemUrl ? `<img src="${d.imagemUrl}" alt="" loading="lazy" style="width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:12px; margin:8px 0; display:block;">` : ''}
        <div class="discover-title">${d.title}</div>
        <div class="discover-desc">${d.desc}</div>
        ${d.filmeId || d.previewUrl || d.collectionId
        ? `<div class="auto-previa" data-auto-previa data-tipo="${d.filmeId ? 'Filme' : d.previewUrl ? 'Música' : 'Podcast'}" ${d.previewUrl ? `data-url="${d.previewUrl}"` : ''} ${d.filmeId ? `data-filme="${d.filmeId}"` : ''} ${d.collectionId && !d.filmeId && !d.previewUrl ? `data-podcast="${d.collectionId}"` : ''} onclick="cliquePreviaAuto(this)"></div>`
        : ''}
            <div class="post-actions" style="margin-top:10px;">
          <div class="post-action" onclick="comentarItemDescobrir(${i})">${icone('comentar',14,i)}</div>
          <div class="post-action" onclick="compartilharItemDescobrir(${i})">${icone('compartilhar',14,i)}</div>
        </div>  
       </div>`;
}

function ordenarItensDescobrir(itens) {
return modoDescobrirAtivo === 'relevante'
  ? [...itens].sort((a, b) => {
      const scoreA = (a.destaque ? 2 : 0) + (assuntosFavoritos.some(fav => a.kind.includes(fav)) ? 1 : 0) + (a.notas ? Math.min(a.notas / 1000, 1) : 0);
      const scoreB = (b.destaque ? 2 : 0) + (assuntosFavoritos.some(fav => b.kind.includes(fav)) ? 1 : 0) + (b.notas ? Math.min(b.notas / 1000, 1) : 0);
      return scoreB - scoreA;
    })
  : itens;
}

// noticias em alta (GNews) com cache de 1h -- a API tem cota limitada e a
// lista de manchetes nao muda de minuto em minuto, entao nao faz sentido
// buscar de novo a cada render; 1h por enquanto esta bom.
async function buscarNoticiasEmAlta() {
const CACHE_KEY = 'atomo_noticias_cache_v1';
const UMA_HORA_MS = 60 * 60 * 1000;
try {
  const cacheRaw = localStorage.getItem(CACHE_KEY);
  if (cacheRaw) {
    const cache = JSON.parse(cacheRaw);
    if (cache && Array.isArray(cache.itens) && (Date.now() - cache.ts) < UMA_HORA_MS) {
      return cache.itens;
    }
  }
} catch (e) { /* localStorage indisponivel -- segue sem cache */ }

let itens = [];
try {
  const resp = await fetch(`${API_BASE}/api/noticias-em-alta`);
  const dados = await resp.json();
  itens = (dados.articles || []).filter(a => a.title).slice(0, 5).map(a => ({
    kind: '📰 Notícia',
    title: a.title,
    desc: a.description || (a.source && a.source.name) || '',
    imagemUrl: a.image || null,
    postUrl: a.url,
  }));
} catch (e) { console.log('erro noticias descobrir:', e); }

// so guarda no cache quando realmente veio alguma noticia -- se a busca
// falhou ou veio vazia (servidor dormindo, chave nao configurada no Render
// etc.), nao trava esse resultado vazio por 1h, deixa tentar de novo no
// proximo carregamento
if (itens.length) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), itens })); } catch (e) {}
}

return itens;
}

async function buscarPaginaDescobrir(pagina) {
const itensPagina = [];

if (pagina === 1) {
  try {
    const itensNoticias = await buscarNoticiasEmAlta();
    if (itensNoticias.length) itensPagina.push(itensNoticias[Math.floor(Math.random() * itensNoticias.length)]);
  } catch (e) { console.log('erro noticias descobrir:', e); }
}

try {
  const respFilmes = await fetch(`${API_BASE}/api/filmes-em-cartaz?pagina=${pagina}`);
  const dadosFilmes = await respFilmes.json();
     (dadosFilmes.results || []).slice(0, 6).forEach(f => {
    itensPagina.push({ kind: '🍿 Filme', title: f.title, desc: f.overview || 'Sem sinopse disponível.', regiao: 'br', filmeId: f.id });
  });
} catch (e) { console.log('erro filmes descobrir:', e); }

try {
  const buscandoTag = !!termoBuscaDescobrir;
  // uma tag aleatória de vez em quando não tem nada de PT recente — tenta
  // até 3 tags diferentes antes de desistir, pra não deixar o Mural vazio
  // à toa (a busca por termo do usuário não varia, só a vitrine padrão)
  const tagsPraTentar = buscandoTag
    ? [termoBuscaDescobrir]
    : embaralhar([...TUMBLR_TAGS_PADRAO]).slice(0, 3);
  const variar = buscandoTag ? '' : '&variar=true';

  for (const tag of tagsPraTentar) {
    const respTumblr = await fetch(`${API_BASE}/api/tumblr-tag?tag=${encodeURIComponent(tag)}${variar}`);
    const dadosTumblr = await respTumblr.json();
    const posts = dadosTumblr.posts || [];
    if (posts.length) {
      posts.forEach(p => {
        itensPagina.push({
          kind: '🎨 Mural',
          title: p.blogName ? `@${p.blogName}` : 'Achado por aí',
          desc: p.texto || 'Sem descrição disponível.',
          imagemUrl: p.imagemUrl,
          postUrl: p.postUrl,
          notas: p.notas || 0,
          destaque: true,
        });
      });
      break;
    }
  }
} catch (e) { console.log('erro tumblr descobrir:', e); }

return itensPagina;
}

let discoverPagina = 1;
let discoverCarregandoMais = false;

async function renderDiscover() {
const lista = document.getElementById('discoverList');
lista.innerHTML = skeletonCardsHtml(4);
discoverPagina = 1;

const itensReais = await buscarPaginaDescobrir(1);
const itensFiltrados = ordenarItensDescobrir(itensReais);

window.ITENS_DESCOBRIR_ATUAIS = itensFiltrados;
lista.innerHTML = itensFiltrados.length
  ? itensFiltrados.map((d, i) => cardDescobrirHtml(d, i)).join('')
  : `<div class="visitor-lock-note">Nada por aqui ainda.</div>`;
}

window.carregarMaisDescobrir = async function () {
if (discoverCarregandoMais) return;
discoverCarregandoMais = true;
discoverPagina++;
const novosItens = await buscarPaginaDescobrir(discoverPagina);
const todosItens = ordenarItensDescobrir([...(window.ITENS_DESCOBRIR_ATUAIS || []), ...novosItens]);
window.ITENS_DESCOBRIR_ATUAIS = todosItens;
document.getElementById('discoverList').innerHTML = todosItens.length
  ? todosItens.map((d, i) => cardDescobrirHtml(d, i)).join('')
  : `<div class="visitor-lock-note">Nada por aqui ainda.</div>`;
discoverCarregandoMais = false;
};

let discoverPendente = null;
