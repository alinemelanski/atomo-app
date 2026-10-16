/* js/leitor.js — Leitor de epub e leitor de livros de texto (Gutendex etc.)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- leitor de epub (epub.js, carregado sob demanda) ----------
let epubJsCarregado = null;
function carregarEpubJs() {
  if (epubJsCarregado) return epubJsCarregado;
  epubJsCarregado = new Promise((resolve, reject) => {
    const jszip = document.createElement('script');
    jszip.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    jszip.onload = () => {
      const epub = document.createElement('script');
      epub.src = 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js';
      epub.onload = resolve;
      epub.onerror = reject;
      document.head.appendChild(epub);
    };
    jszip.onerror = reject;
    document.head.appendChild(jszip);
  });
  return epubJsCarregado;
}

let leitorEpubAtual = null;
window.abrirLeitorEpub = async function (i) {
  const item = window.ITENS_ESTANTE_ATUAIS[i];
  if (!item) return;

  document.getElementById('leitorEpubTitulo').textContent = item.titulo;
  document.getElementById('leitorEpubProgresso').textContent = Math.round(item.progresso_percentual || 0) + '%';
  document.getElementById('leitorEpubOverlay').classList.add('open');
  document.getElementById('epubViewerContainer').innerHTML = `<div class="visitor-lock-note">Abrindo...</div>`;
  document.getElementById('grifarBarra').style.display = 'none';

  try {
    await carregarEpubJs();
    const { data, error } = await supabaseClient.storage.from('estante-epubs').createSignedUrl(item.arquivo_path, 3600);
    if (error) throw error;

    document.getElementById('epubViewerContainer').innerHTML = '';
    const book = ePub(data.signedUrl);
    const rendition = book.renderTo('epubViewerContainer', { width: '100%', height: '100%' });
    await rendition.display(item.ultima_posicao || undefined);

    leitorEpubAtual = { book, rendition, item, inicioSessao: Date.now(), selecaoAtual: null };
    prepararMarcacoesEpub(); // pinta os grifos salvos e acerta a fitinha do marcador (marcacoes.js)

    rendition.on('relocated', (loc) => {
      const temLocations = book.locations && book.locations.length();
      const pct = temLocations
        ? Math.round(book.locations.percentageFromCfi(loc.start.cfi) * 100)
        : Math.round(item.progresso_percentual || 0);
      document.getElementById('leitorEpubProgresso').textContent = pct + '%';
      salvarProgressoEpub(loc.start.cfi, pct);
      if (temLocations) {
        const paginaAtual = book.locations.locationFromCfi(loc.start.cfi) + 1;
        registrarProgressoPaginas(paginaAtual);
      }
      atualizarFitaMarcador(); // mudou de página: a fitinha mostra se ESTA página está marcada
    });

    // seleção de texto na página — mostra a barrinha de "grifar"
    rendition.on('selected', (cfiRange, contents) => {
      const textoSelecionado = (contents.window.getSelection ? contents.window.getSelection().toString() : '').trim();
      const barra = document.getElementById('grifarBarra');
      if (textoSelecionado && textoSelecionado.length > 3) {
        leitorEpubAtual.selecaoAtual = textoSelecionado;
        leitorEpubAtual.selecaoCfi = cfiRange;       // endereço do trecho, pra pintar e voltar nele depois
        leitorEpubAtual.selecaoContents = contents;  // pra limpar a seleção depois de grifar
        barra.style.display = 'flex';
      } else {
        barra.style.display = 'none';
      }
    });

    book.ready.then(() => book.locations.generate(1000)).catch(() => {});
  } catch (e) {
    document.getElementById('epubViewerContainer').innerHTML = `<div class="visitor-lock-note">Não consegui abrir esse epub agora.</div>`;
  }
};

let debounceProgressoEpub = null;
function salvarProgressoEpub(cfi, pct) {
  clearTimeout(debounceProgressoEpub);
  debounceProgressoEpub = setTimeout(async () => {
    if (!leitorEpubAtual) return;
    // lido_em = "última vez que leu" — a estante usa pra escolher o livro do "Continuar lendo"
    const patch = { progresso_percentual: pct, ultima_posicao: cfi, lido_em: new Date().toISOString() };
    // primeira vez que passa de 95%, marca a data de conclusão (usada no resumo de leitura)
    let acabouDeTerminar = false;
    if (pct >= 95 && !leitorEpubAtual.item.finalizado_em) {
      patch.finalizado_em = new Date().toISOString();
      leitorEpubAtual.item.finalizado_em = patch.finalizado_em;
      acabouDeTerminar = true;
    }
    const { error: erroProgresso } = await supabaseClient.from('estante_pessoal').update(patch).eq('id', leitorEpubAtual.item.id);
    // se o SQL novo (coluna lido_em) ainda não rodou, salva o progresso sem ela — nunca perde o progresso
    if (erroProgresso && /lido_em/.test(erroProgresso.message)) {
      delete patch.lido_em;
      await supabaseClient.from('estante_pessoal').update(patch).eq('id', leitorEpubAtual.item.id);
    }
    leitorEpubAtual.item.progresso_percentual = pct;
    registrarLeituraHoje();
    if (acabouDeTerminar) document.getElementById('livroConcluidoOverlay').classList.add('open');
  }, 1500);
}

// ---------- contador de páginas lidas (acumulado, não conta 2x ao voltar/reler) ----------
let debounceProgressoPaginas = null;
function registrarProgressoPaginas(paginaAtual) {
  clearTimeout(debounceProgressoPaginas);
  debounceProgressoPaginas = setTimeout(async () => {
    if (!leitorEpubAtual) return;
    const item = leitorEpubAtual.item;
    const maxAnterior = item.pagina_max_alcancada || 0;
    if (paginaAtual <= maxAnterior) return; // já tinha chegado ali antes (voltou pra reler)
    const delta = paginaAtual - maxAnterior;
    item.pagina_max_alcancada = paginaAtual;
    await supabaseClient.from('estante_pessoal').update({ pagina_max_alcancada: paginaAtual }).eq('id', item.id);
    await incrementarEstatisticaLeitura({ paginas_lidas: delta });
  }, 1200);
}

// soma páginas/minutos na estatística de leitura vitalícia do usuário (cria a linha se não existir)
async function incrementarEstatisticaLeitura(delta) {
registrarEventoApp('leu'); // métrica: "leu hoje" (1 vez por dia)
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  const usuarioId = sessionData.session.user.id;
  const { data: atual } = await supabaseClient.from('estatisticas_leitura').select('*').eq('usuario_id', usuarioId).maybeSingle();
  const paginas = (atual ? atual.paginas_lidas : 0) + (delta.paginas_lidas || 0);
  const minutos = (atual ? atual.minutos_leitura : 0) + (delta.minutos_leitura || 0);
  await supabaseClient.from('estatisticas_leitura').upsert({ usuario_id: usuarioId, paginas_lidas: paginas, minutos_leitura: minutos, atualizado_em: new Date().toISOString() });
  if (delta.paginas_lidas) {
    const hojeChave = fmtDataISO(new Date());
    const { data: diaAtual } = await supabaseClient.from('leitura_diaria_paginas').select('paginas').eq('usuario_id', usuarioId).eq('data', hojeChave).maybeSingle();
    const paginasHoje = (diaAtual ? diaAtual.paginas : 0) + delta.paginas_lidas;
    await supabaseClient.from('leitura_diaria_paginas').upsert({ usuario_id: usuarioId, data: hojeChave, paginas: paginasHoje, atualizado_em: new Date().toISOString() });
  }
}

// grifar e marcador de página: ficam em js/marcacoes.js

window.paginaAnteriorEpub = function () { if (leitorEpubAtual) leitorEpubAtual.rendition.prev(); };
window.proximaPaginaEpub = function () { if (leitorEpubAtual) leitorEpubAtual.rendition.next(); };

window.fecharLeitorEpub = function () {
  closeOverlay('leitorEpubOverlay');
  if (leitorEpubAtual) {
    const minutosLidos = Math.round((Date.now() - leitorEpubAtual.inicioSessao) / 60000);
    if (minutosLidos > 0) incrementarEstatisticaLeitura({ minutos_leitura: minutosLidos });
    leitorEpubAtual.book.destroy();
    leitorEpubAtual = null;
  }
  renderEstante();
};

// ---------- leitor de livro do Gutendex (texto integral, folheável tipo Kindle) ----------
let leitorLivroAtual = null; // { paginas, paginaIdx, item, inicioSessao }

// divide o texto em "páginas" respeitando parágrafo inteiro sempre que dá
// (só quebra um parágrafo no meio quando ele sozinho já estoura o budget
// de caracteres da página) — não é medição de pixel real como um e-reader
// nativo, mas fica com cara de página de verdade em vez de rolagem infinita
function paginarTextoLivro(texto, charsPorPagina) {
  charsPorPagina = charsPorPagina || 1100;
  const paragrafos = texto.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const paginas = [];
  let atual = '';

  function fecharPagina() {
    if (atual.trim()) paginas.push(atual.trim());
    atual = '';
  }

  paragrafos.forEach(paragrafo => {
    if (paragrafo.length > charsPorPagina) {
      fecharPagina();
      let resto = paragrafo;
      while (resto.length > charsPorPagina) {
        let corte = resto.lastIndexOf(' ', charsPorPagina);
        if (corte < charsPorPagina * 0.5) corte = charsPorPagina;
        paginas.push(resto.slice(0, corte).trim());
        resto = resto.slice(corte).trim();
      }
      atual = resto;
      return;
    }
    if (atual && (atual.length + 2 + paragrafo.length) > charsPorPagina) fecharPagina();
    atual = atual ? atual + '\n\n' + paragrafo : paragrafo;
  });
  fecharPagina();

  return paginas.length ? paginas : [texto];
}

window.abrirLeitorLivroGutendex = async function (i) {
  const item = window.ITENS_LIVROS_ATUAIS[i];
  if (!item) return;

  document.getElementById('leitorLivroTitulo').textContent = item.title;
  document.getElementById('leitorLivroProgresso').textContent = '';
  document.getElementById('leitorLivroBarra').style.width = '0%';
  document.getElementById('leitorLivroPagina').innerHTML = `<div class="visitor-lock-note">Carregando o livro...</div>`;
  document.getElementById('leitorLivroOverlay').classList.add('open');

  try {
    const resp = await fetch(`${API_BASE}/api/livro-texto?id=${item.gutendexId}`);
    const dados = await resp.json();
    if (!dados.texto) {
      document.getElementById('leitorLivroPagina').innerHTML = `<div class="visitor-lock-note">${dados.erro || 'Não consegui carregar esse livro agora.'}</div>`;
      return;
    }
    leitorLivroAtual = { paginas: paginarTextoLivro(dados.texto), paginaIdx: 0, item, inicioSessao: Date.now(), chave: 'gutendex:' + item.gutendexId };
    renderPaginaLivroAtual();
    prepararMarcacoesLivro(); // grifos e marcadores desse livro (marcacoes.js)
    registrarLeituraHoje();
  } catch (e) {
    document.getElementById('leitorLivroPagina').innerHTML = `<div class="visitor-lock-note">Não consegui carregar esse livro agora — tenta de novo em instantes.</div>`;
  }
};

// mesmo leitor paginado do Gutendex, só busca o texto da Wikisource
window.abrirLeitorLivroWikisource = async function (i) {
  const item = window.ITENS_LIVROS_ATUAIS[i];
  if (!item) return;

  document.getElementById('leitorLivroTitulo').textContent = item.title;
  document.getElementById('leitorLivroProgresso').textContent = '';
  document.getElementById('leitorLivroBarra').style.width = '0%';
  document.getElementById('leitorLivroPagina').innerHTML = `<div class="visitor-lock-note">Carregando o texto...</div>`;
  document.getElementById('leitorLivroOverlay').classList.add('open');

  try {
    const resp = await fetch(`${API_BASE}/api/livro-texto-wikisource?titulo=${encodeURIComponent(item.wikisourceTitulo)}`);
    const dados = await resp.json();
    if (!dados.texto) {
      document.getElementById('leitorLivroPagina').innerHTML = `<div class="visitor-lock-note">${dados.erro || 'Não consegui carregar esse texto agora.'}</div>`;
      return;
    }
    leitorLivroAtual = { paginas: paginarTextoLivro(dados.texto), paginaIdx: 0, item, inicioSessao: Date.now(), chave: 'wikisource:' + item.wikisourceTitulo };
    renderPaginaLivroAtual();
    prepararMarcacoesLivro();
    registrarLeituraHoje();
  } catch (e) {
    document.getElementById('leitorLivroPagina').innerHTML = `<div class="visitor-lock-note">Não consegui carregar esse texto agora — tenta de novo em instantes.</div>`;
  }
};

// mesmo leitor paginado do Gutendex/Wikisource, só que busca o texto OCR
// (djvu) de um item do Internet Archive -- unifica o "estilo Kindle" pra
// TODA fonte que tem leitura completa. Se esse item específico não tiver
// texto OCR disponível, cai pro visualizador incorporado do archive.org
// como fallback (retorna false nesse caso, pra quem chamou decidir).
window.abrirLeitorOpenLibrary = async function (i) {
  const item = window.ITENS_LIVROS_ATUAIS[i];
  if (!item) return;
  const conseguiu = await abrirLeitorLivroArquivo(i);
  if (conseguiu) { registrarLeituraHoje(); return; }
  // esse item não tem texto OCR disponível -- cai pro visualizador
  // incorporado do próprio archive.org, que sempre funciona
  const corpo = document.getElementById('livroPreviewCorpo');
  corpo.innerHTML += `
      <div style="width:100%; height:460px; border-radius:12px; overflow:hidden; background:var(--accent-soft); margin-top:10px;">
        <iframe src="https://archive.org/embed/${item.iaId}" width="100%" height="100%" frameborder="0" allowfullscreen style="border:0;"></iframe>
      </div>`;
  registrarLeituraHoje();
};

window.abrirLeitorLivroArquivo = async function (i) {
  const item = window.ITENS_LIVROS_ATUAIS[i];
  if (!item || !item.iaId) return false;

  document.getElementById('leitorLivroTitulo').textContent = item.title;
  document.getElementById('leitorLivroProgresso').textContent = '';
  document.getElementById('leitorLivroBarra').style.width = '0%';
  document.getElementById('leitorLivroPagina').innerHTML = `<div class="visitor-lock-note">Carregando o livro...</div>`;
  document.getElementById('leitorLivroOverlay').classList.add('open');

  try {
    const resp = await fetch(`${API_BASE}/api/livro-texto-arquivo?iaId=${encodeURIComponent(item.iaId)}`);
    const dados = await resp.json();
    if (!dados.texto) {
      closeOverlay('leitorLivroOverlay');
      return false;
    }
    leitorLivroAtual = { paginas: paginarTextoLivro(dados.texto), paginaIdx: 0, item, inicioSessao: Date.now(), chave: 'archive:' + item.iaId };
    renderPaginaLivroAtual();
    prepararMarcacoesLivro();
    registrarLeituraHoje();
    return true;
  } catch (e) {
    closeOverlay('leitorLivroOverlay');
    return false;
  }
};

function renderPaginaLivroAtual() {
  if (!leitorLivroAtual) return;
  const { paginas, paginaIdx } = leitorLivroAtual;
  const pagEl = document.getElementById('leitorLivroPagina');
  desenharPaginaComGrifos(pagEl, paginas[paginaIdx] || '', paginaIdx); // texto + grifos pintados (marcacoes.js)
  atualizarFitaMarcador();
  const barraGrifar = document.getElementById('grifarBarraLivro');
  if (barraGrifar) barraGrifar.style.display = 'none';
  pagEl.scrollTop = 0;
  pagEl.style.animation = 'none';
  void pagEl.offsetWidth;
  pagEl.style.animation = '';
  document.getElementById('leitorLivroProgresso').textContent = `pág. ${paginaIdx + 1} de ${paginas.length}`;
  document.getElementById('leitorLivroBarra').style.width = Math.round(((paginaIdx + 1) / paginas.length) * 100) + '%';
}

window.proximaPaginaLivro = function () {
  if (!leitorLivroAtual) return;
  if (leitorLivroAtual.paginaIdx < leitorLivroAtual.paginas.length - 1) {
    leitorLivroAtual.paginaIdx++;
    renderPaginaLivroAtual();
  }
};

window.paginaAnteriorLivro = function () {
  if (!leitorLivroAtual) return;
  if (leitorLivroAtual.paginaIdx > 0) {
    leitorLivroAtual.paginaIdx--;
    renderPaginaLivroAtual();
  }
};

window.fecharLeitorLivro = function () {
  closeOverlay('leitorLivroOverlay');
  if (leitorLivroAtual) {
    const minutosLidos = Math.round((Date.now() - leitorLivroAtual.inicioSessao) / 60000);
    if (minutosLidos > 0) incrementarEstatisticaLeitura({ minutos_leitura: minutosLidos });
    leitorLivroAtual = null;
  }
};

// arrasta o dedo (ou o mouse, pra testar no navegador) pra trocar de página
(function configurarSwipeLeitorLivro() {
  const area = document.getElementById('leitorLivroArea');
  if (!area) return;
  let xInicio = null;
  let yInicio = null;

  area.addEventListener('touchstart', e => {
    xInicio = e.touches[0].clientX;
    yInicio = e.touches[0].clientY;
  }, { passive: true });

  area.addEventListener('touchend', e => {
    if (xInicio === null) return;
    const dx = e.changedTouches[0].clientX - xInicio;
    const dy = e.changedTouches[0].clientY - yInicio;
    xInicio = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return; // gesto mais vertical que horizontal — ignora
    if (dx < 0) proximaPaginaLivro(); else paginaAnteriorLivro();
  }, { passive: true });
})();
