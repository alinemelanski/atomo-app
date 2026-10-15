/* js/estante-autoral.js — Estante autoral: marketplace de livros de autores independentes
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- estante autoral: marketplace de livro de autor independente ----------
// qualquer leitor pode publicar sem aprovação prévia -- entra em fila de revisão
// (so_admin aprova/recusa) antes de aparecer pra outras pessoas. aprovar/recusar/
// reenviar depois de recusado sempre passa pelo backend (servidor.js), nunca
// escrita direta do client -- o banco tem um trigger que trava isso.
let subModoAutoral = 'comprar'; // comprar | meus | revisao
let souAdminEstanteAutoral = false;
let livroAutoralRecusarAtualId = null;
let notaAutoralEscolhida = 0;
const LABEL_STATUS_AUTORAL = { em_revisao: 'em revisão', aprovado: 'aprovado', recusado: 'recusado' };

// Categorias da Loja (a MESMA lista está no servidor.js, rota /editar — se mudar uma, muda a outra)
const CATEGORIAS_AUTORAIS = ['Romance', 'Fantasia', 'Ficção científica', 'Suspense e mistério', 'Terror', 'Poesia',
  'Contos e crônicas', 'Jovem adulto', 'LGBT+', 'Infantil', 'Biografia e memórias', 'Autoajuda', 'Não ficção', 'HQ e mangá', 'Outros'];
let categoriaFiltroAutoral = 'todas'; // filtro da vitrine
let categoriaEnvioAutoral = '';       // categoria escolhida ao publicar
let categoriaEdicaoAutoral = '';      // categoria escolhida ao editar
let arquivoCapaEdicaoAutoral = null;  // capa nova escolhida ao editar
let livroAutoralEditandoId = null;

// protege textos escritos pelas pessoas antes de virar HTML
function escaparAutoral(texto) {
  return String(texto || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// botõezinhos de categoria (usados ao publicar e ao editar)
function chipsCategoriasHtml(selecionada, funcao) {
  return CATEGORIAS_AUTORAIS.map((c) =>
    `<button type="button" class="autoral-categoria-chip${c === selecionada ? ' on' : ''}" aria-pressed="${c === selecionada}" onclick="${funcao}('${c}')">${c}</button>`
  ).join('');
}

function estanteAutoralCabecalhoHtml() {
  const abas = [['comprar', 'descobrir']];
  if (window.TEM_LIVROS_AUTORAIS_PROPRIOS) abas.push(['meus', 'meus livros']);
  if (window.TEM_COMPRAS_AUTORAIS) abas.push(['compras', 'comprados']);
  if (souAdminEstanteAutoral) abas.push(['revisao', 'revisão']);
  return `<div class="autoral-sub-row">${abas.map(([v, l]) =>
    `<div class="feed-modo-chip${subModoAutoral === v ? ' on' : ''}" onclick="trocarSubModoAutoral('${v}')">${l}</div>`
  ).join('')}</div>`;
}

window.trocarSubModoAutoral = function (modo) {
  subModoAutoral = modo;
  renderEstanteAutoral();
};

async function renderEstanteAutoral() {
  const lista = document.getElementById('lojaList');
  lista.innerHTML = skeletonCardsHtml(3);

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    lista.innerHTML = `<div class="visitor-lock-note">Entra na sua conta pra ver a estante autoral.</div>`;
    return;
  }
  const usuarioId = sessionData.session.user.id;
  souAdminEstanteAutoral = sessionData.session.user.email === 'alinemelanski10@gmail.com';

  const [{ count: meusEnvios }, { count: minhasCompras }] = await Promise.all([
    supabaseClient.from('livros_autorais').select('id', { count: 'exact', head: true }).eq('autor_id', usuarioId),
    supabaseClient.from('vendas_autorais').select('id', { count: 'exact', head: true }).eq('comprador_id', usuarioId).eq('status', 'pago'),
  ]);
  window.TEM_LIVROS_AUTORAIS_PROPRIOS = (meusEnvios || 0) > 0;
  window.TEM_COMPRAS_AUTORAIS = (minhasCompras || 0) > 0;

  if (subModoAutoral === 'meus' && !window.TEM_LIVROS_AUTORAIS_PROPRIOS) subModoAutoral = 'comprar';
  if (subModoAutoral === 'revisao' && !souAdminEstanteAutoral) subModoAutoral = 'comprar';
  if (subModoAutoral === 'compras' && !window.TEM_COMPRAS_AUTORAIS) subModoAutoral = 'comprar';

  if (subModoAutoral === 'meus') return renderMeusLivrosAutorais(usuarioId);
  if (subModoAutoral === 'revisao') return renderRevisaoLivrosAutorais();
  if (subModoAutoral === 'compras') return renderComprasAutorais(usuarioId);
  return renderVitrineLivrosAutorais();
}

async function renderVitrineLivrosAutorais() {
  const lista = document.getElementById('lojaList');
  const { data, error } = await supabaseClient
    .from('livros_autorais')
    .select('*, usuarios(handle), avaliacoes_autorais(nota)')
    .eq('status', 'aprovado')
    .order('criado_em', { ascending: false });

  window.ITENS_ESTANTE_AUTORAL = data || [];

  const convite = `<div class="clube-cap-card" style="cursor:pointer; margin-bottom:12px;" onclick="abrirEnviarLivroAutoral()">
        <div class="clube-cap-info">
          <div class="clube-cap-kicker">${icone('caixa',10)} publicar</div>
          <div class="clube-cap-valor" style="font-size:15px;">tem um livro seu? publique aqui</div>
        </div>
      </div>`;

  if (error) {
    lista.innerHTML = estanteAutoralCabecalhoHtml() + convite + `<div class="visitor-lock-note">Não consegui carregar a estante autoral agora${error.message.includes('livros_autorais') ? ' — falta rodar o SQL no banco' : ''}.</div>`;
    return;
  }

  window.CONVITE_ESTANTE_AUTORAL = convite;
  desenharVitrineAutoral();
}

// Desenha a vitrine a partir do que já foi carregado — trocar de categoria
// não consulta o banco de novo, só filtra a lista que já está na memória.
function desenharVitrineAutoral() {
  const lista = document.getElementById('lojaList');
  const todos = window.ITENS_ESTANTE_AUTORAL || [];
  if (!todos.length) {
    lista.innerHTML = estanteAutoralCabecalhoHtml() + (window.CONVITE_ESTANTE_AUTORAL || '') +
      estadoVazio('ainda não tem livro nenhum aqui', 'seja a primeira pessoa a publicar um livro');
    return;
  }
  // só mostra no filtro as categorias que têm livro (pra não ter filtro vazio)
  const presentes = CATEGORIAS_AUTORAIS.filter((c) => todos.some((d) => d.categoria === c));
  if (categoriaFiltroAutoral !== 'todas' && !presentes.includes(categoriaFiltroAutoral)) categoriaFiltroAutoral = 'todas';
  const filtros = presentes.length
    ? `<div class="autoral-filtro-row" role="tablist" aria-label="Filtrar por categoria">${['todas'].concat(presentes).map((c) =>
        `<button type="button" class="feed-modo-chip${categoriaFiltroAutoral === c ? ' on' : ''}" role="tab" aria-selected="${categoriaFiltroAutoral === c}" onclick="filtrarCategoriaAutoral('${c}')">${c}</button>`
      ).join('')}</div>`
    : '';
  const visiveis = todos.filter((d) => categoriaFiltroAutoral === 'todas' || d.categoria === categoriaFiltroAutoral);
  // o índice passado pro card é o da lista COMPLETA (o detalhe abre por ele)
  lista.innerHTML = estanteAutoralCabecalhoHtml() + (window.CONVITE_ESTANTE_AUTORAL || '') + filtros +
    `<div class="livros-grid">${visiveis.map((d) => cardLivroAutoralHtml(d, todos.indexOf(d))).join('')}</div>`;
}

window.filtrarCategoriaAutoral = function (categoria) {
  categoriaFiltroAutoral = categoria;
  desenharVitrineAutoral();
};

function cardLivroAutoralHtml(d, i) {
  const cor = CORES_LOMBADA_ESTANTE[i % CORES_LOMBADA_ESTANTE.length];
  const capaEstilo = d.capa_url ? `background-image:url('${d.capa_url}');` : `background:${cor};`;
  const preco = (d.preco_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  return `<div class="livro-grid-card" onclick="abrirLivroAutoralDetalhe(${i})">
        <div class="livro-grid-capa" style="${capaEstilo}">
          ${!d.capa_url ? `<div class="capa-fallback-titulo">${d.titulo}</div>` : ''}
          <span class="livro-grid-idioma">${(d.idioma || 'pt').toUpperCase()}</span>
        </div>
        <div class="livro-grid-meta">
          <div class="livro-grid-titulo">${d.titulo}</div>
          <div class="livro-grid-fonte">@${d.usuarios ? d.usuarios.handle : 'alguém'}</div>
          ${d.categoria ? `<div class="autoral-categoria-tag">${escaparAutoral(d.categoria)}</div>` : ''}
          <div class="autoral-preco-tag">R$ ${preco}</div>
        </div>
      </div>`;
}

window.abrirLivroAutoralDetalhe = async function (i) {
  const d = window.ITENS_ESTANTE_AUTORAL[i];
  if (!d) return;
  window.LIVRO_AUTORAL_ATUAL = d;
  notaAutoralEscolhida = 0;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session ? sessionData.session.user.id : null;
  const souAutor = !!(meuId && meuId === d.autor_id);

  let jaComprou = false;
  if (meuId && !souAutor) {
    const { data: venda } = await supabaseClient.from('vendas_autorais').select('id').eq('livro_id', d.id).eq('comprador_id', meuId).eq('status', 'pago').maybeSingle();
    jaComprou = !!venda;
  }

  const notas = (d.avaliacoes_autorais || []).map(a => a.nota);
  const media = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : null;
  const preco = (d.preco_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const cor = CORES_LOMBADA_ESTANTE[i % CORES_LOMBADA_ESTANTE.length];
  const botaoAcao = souAutor ? '' : (jaComprou
    ? `<button class="post-btn" style="width:100%; margin-bottom:10px;" onclick="baixarLivroAutoralComprado(${d.id})">baixar epub</button>`
    : `<button class="post-btn" style="width:100%; margin-bottom:10px;" onclick="comprarLivroAutoral(${d.id})">comprar por R$ ${preco}</button>`);

  document.getElementById('livroAutoralDetalheConteudo').innerHTML = `
      <div class="livro-grid-capa" style="${d.capa_url ? `background-image:url('${d.capa_url}');` : `background:${cor};`} height:220px; border-radius:16px; margin-bottom:14px;">
        ${!d.capa_url ? `<div class="capa-fallback-titulo">${d.titulo}</div>` : ''}
      </div>
      <div style="font-family:'Fraunces',serif; font-size:21px; font-weight:700;">${d.titulo}</div>
      <div style="color:var(--ink-faint); font-size:13px; margin:2px 0 10px;">@${d.usuarios ? d.usuarios.handle : 'alguém'}${media ? ` · ⭐ ${media} (${notas.length})` : ''}</div>
      ${d.categoria ? `<div class="autoral-categoria-tag" style="margin-bottom:12px;">${escaparAutoral(d.categoria)}</div>` : ''}
      ${d.descricao ? `<div class="autoral-sinopse-titulo">Sinopse</div><div class="autoral-sinopse">${escaparAutoral(d.descricao)}</div>` : ''}
      ${botaoAcao}
      ${jaComprou ? avaliarLivroAutoralHtml() : ''}
      <div id="livroAutoralAvaliacoesLista"></div>`;

  document.getElementById('livroAutoralDetalheOverlay').classList.add('open');
  renderAvaliacoesLivroAutoral(d.id);
  // livro sem capa e quem abriu é quem escreveu: busca a capa de dentro do epub
  if (!d.capa_url && souAutor) completarCapaLivroAutoral(d);
};

function avaliarLivroAutoralHtml() {
  return `<div style="margin:14px 0; padding-top:10px; border-top:1px solid var(--card-b);">
      <div style="font-size:12px; font-weight:700; color:var(--ink-faint); margin-bottom:6px;">deixar uma avaliação</div>
      <div class="autoral-nota-row" id="autoralNotaRow">
        ${[1, 2, 3, 4, 5].map(n => `<div class="autoral-nota-btn" data-nota="${n}" onclick="escolherNotaAutoral(${n})">${n}</div>`).join('')}
      </div>
      <textarea id="autoralComentarioInput" class="busca-input" style="width:100%; min-height:54px; margin:8px 0;" placeholder="um comentário (opcional)"></textarea>
      <button class="post-btn" style="width:100%;" onclick="enviarAvaliacaoAutoral()">enviar avaliação</button>
    </div>`;
}

window.escolherNotaAutoral = function (n) {
  notaAutoralEscolhida = n;
  document.querySelectorAll('#autoralNotaRow .autoral-nota-btn').forEach(b => b.classList.toggle('on', Number(b.dataset.nota) <= n));
};

window.enviarAvaliacaoAutoral = async function () {
  if (!notaAutoralEscolhida) { mostrarToast('escolhe uma nota de 1 a 5'); return; }
  const d = window.LIVRO_AUTORAL_ATUAL;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;
  const comentario = document.getElementById('autoralComentarioInput').value.trim();
  const { error } = await supabaseClient.from('avaliacoes_autorais').upsert({
    livro_id: d.id, usuario_id: usuarioId, nota: notaAutoralEscolhida, comentario: comentario || null,
  }, { onConflict: 'livro_id,usuario_id' });
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('⭐ avaliação enviada');
  notaAutoralEscolhida = 0;
  renderAvaliacoesLivroAutoral(d.id);
};

async function renderAvaliacoesLivroAutoral(livroId) {
  const wrap = document.getElementById('livroAutoralAvaliacoesLista');
  if (!wrap) return;
  const { data } = await supabaseClient.from('avaliacoes_autorais').select('nota, comentario, criado_em, usuarios(handle)').eq('livro_id', livroId).order('criado_em', { ascending: false });
  wrap.innerHTML = (data && data.length)
    ? data.map(a => `<div class="autoral-avaliacao-row"><span class="autoral-avaliacao-nota">⭐ ${a.nota}</span> @${a.usuarios ? a.usuarios.handle : 'alguém'}${a.comentario ? ` — ${a.comentario}` : ''}</div>`).join('')
    : '';
}

window.comprarLivroAutoral = async function (livroId) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
  if (!token) { mostrarToast('entra na sua conta primeiro'); return; }
  mostrarToast('abrindo pagamento...');
  try {
    const resp = await fetch(`${API_BASE}/api/estante-autoral/comprar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ livroId }),
    });
    const resultado = await resp.json().catch(() => ({}));
    if (!resp.ok || !resultado.checkoutUrl) { mostrarToast('💳 ' + (resultado.erro || 'pagamento ainda não disponível')); return; }
    window.location.href = resultado.checkoutUrl;
  } catch (e) {
    mostrarToast('❌ erro ao processar a compra');
  }
};

window.baixarLivroAutoralComprado = async function (livroId) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
  if (!token) { mostrarToast('entra na sua conta primeiro'); return; }
  mostrarToast('gerando link...');
  try {
    const resp = await fetch(`${API_BASE}/api/estante-autoral/arquivo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ livroId }),
    });
    const resultado = await resp.json().catch(() => ({}));
    if (!resp.ok || !resultado.url) { mostrarToast('❌ ' + (resultado.erro || 'não consegui gerar o link')); return; }
    window.open(resultado.url, '_blank');
  } catch (e) {
    mostrarToast('❌ erro ao baixar o livro');
  }
};

let arquivoCapaAutoralEscolhido = null;
let arquivoEpubAutoralEscolhido = null;

// idioma em que o livro foi escrito (aparece como etiqueta PT/EN na estante)
let idiomaLivroAutoral = 'pt';
window.escolherIdiomaLivroAutoral = function (idioma) {
  idiomaLivroAutoral = idioma;
  document.getElementById('autoralIdiomaPt').classList.toggle('on', idioma === 'pt');
  document.getElementById('autoralIdiomaEn').classList.toggle('on', idioma === 'en');
};

window.abrirEnviarLivroAutoral = function () {
  escolherIdiomaLivroAutoral(idiomaAtual === 'en' ? 'en' : 'pt');
  document.getElementById('autoralTituloInput').value = '';
  document.getElementById('autoralDescricaoInput').value = '';
  document.getElementById('autoralPrecoInput').value = '';
  categoriaEnvioAutoral = '';
  document.getElementById('autoralCategoriasEnvio').innerHTML = chipsCategoriasHtml('', 'escolherCategoriaEnvioAutoral');
  arquivoCapaAutoralEscolhido = null;
  arquivoEpubAutoralEscolhido = null;
  document.getElementById('autoralCapaPreviewTxt').textContent = 'escolher capa (opcional)';
  document.getElementById('autoralEpubPreviewTxt').textContent = 'escolher arquivo epub';
  document.getElementById('enviarLivroAutoralOverlay').classList.add('open');
  preencherWalletNoEnvio();
};

// dentro de "enviar livro": a wallet aparece de novo, já preenchida, pra conferir
async function preencherWalletNoEnvio() {
  const wrap = document.getElementById('autoralWalletEnvioWrap');
  if (!wrap) return;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  const { data: perfil } = await supabaseClient.from('usuarios').select('asaas_wallet_id').eq('id', sessionData.session.user.id).maybeSingle();
  wrap.innerHTML = carteiraAutoralCardHtml(perfil);
}

window.escolherCategoriaEnvioAutoral = function (categoria) {
  categoriaEnvioAutoral = categoria;
  document.getElementById('autoralCategoriasEnvio').innerHTML = chipsCategoriasHtml(categoria, 'escolherCategoriaEnvioAutoral');
};

window.escolherCapaAutoral = function () {
  const input = document.getElementById('autoralCapaInput');
  if (!input.files || !input.files[0]) return;
  arquivoCapaAutoralEscolhido = input.files[0];
  document.getElementById('autoralCapaPreviewTxt').textContent = arquivoCapaAutoralEscolhido.name;
};

window.escolherEpubAutoral = function () {
  const input = document.getElementById('autoralEpubInput');
  if (!input.files || !input.files[0]) return;
  arquivoEpubAutoralEscolhido = input.files[0];
  document.getElementById('autoralEpubPreviewTxt').textContent = arquivoEpubAutoralEscolhido.name;
  if (!arquivoCapaAutoralEscolhido) {
    extrairCapaDoEpub(arquivoEpubAutoralEscolhido).then(capa => {
      if (capa && !arquivoCapaAutoralEscolhido) document.getElementById('autoralCapaPreviewTxt').textContent = 'capa encontrada dentro do epub ✓';
    }).catch(() => {});
  }
};

// =====================================================================
// CAPA DE DENTRO DO EPUB
// =====================================================================
// PRA APRENDER: um arquivo .epub é, na verdade, um .zip com páginas HTML e
// imagens dentro. Um arquivo "índice" (o .opf) lista tudo e, quase sempre,
// diz qual imagem é a capa. O caminho até ela:
//   1. META-INF/container.xml → diz onde está o .opf
//   2. no .opf, procura (nesta ordem):
//        <meta name="cover" content="ID">          (epub 2)
//        <item properties="cover-image" ...>         (epub 3)
//        uma imagem com "cover"/"capa" no nome
//        a primeira imagem da lista (muitos livros feitos no Word/Calibre)
//   3. lê essa imagem de dentro do zip e devolve como arquivo
// JSZip é a biblioteca que abre o .zip no navegador (a mesma que o leitor usa).
async function extrairCapaDoEpub(arquivoEpub) {
  await carregarEpubJs(); // carrega o JSZip sob demanda
  const zip = await JSZip.loadAsync(arquivoEpub);
  const container = await zip.file('META-INF/container.xml').async('string');
  const caminhoOpf = (container.match(/full-path="([^"]+)"/) || [])[1];
  if (!caminhoOpf) return null;
  const opf = await zip.file(caminhoOpf).async('string');
  const pasta = caminhoOpf.includes('/') ? caminhoOpf.slice(0, caminhoOpf.lastIndexOf('/') + 1) : '';

  const doc = new DOMParser().parseFromString(opf, 'application/xml');
  const itens = [...doc.getElementsByTagName('item')];
  const imagens = itens.filter(it => /^image\//.test(it.getAttribute('media-type') || ''));
  const metaCapa = [...doc.getElementsByTagName('meta')].find(m => m.getAttribute('name') === 'cover');
  const idCapa = metaCapa && metaCapa.getAttribute('content');
  const escolhida = (idCapa && itens.find(it => it.getAttribute('id') === idCapa))
    || itens.find(it => /cover-image/.test(it.getAttribute('properties') || ''))
    || imagens.find(it => /cover|capa/i.test((it.getAttribute('href') || '') + (it.getAttribute('id') || '')))
    || imagens[0];
  if (!escolhida) return null;

  const href = decodeURIComponent(escolhida.getAttribute('href'));
  const arquivoImg = zip.file(pasta + href) || zip.file(href);
  if (!arquivoImg) return null;
  const blob = await arquivoImg.async('blob');
  const tipo = escolhida.getAttribute('media-type') || 'image/jpeg';
  const extensao = tipo.split('/')[1].replace('jpeg', 'jpg');
  return new File([blob], 'capa-do-epub.' + extensao, { type: tipo });
}

// sobe a imagem no storage público e devolve o link
async function subirCapaAutoral(usuarioId, arquivo) {
  const caminho = `${usuarioId}/${Date.now()}-${arquivo.name}`;
  const { error } = await supabaseClient.storage.from('midia-posts').upload(caminho, arquivo);
  if (error) return null;
  return supabaseClient.storage.from('midia-posts').getPublicUrl(caminho).data.publicUrl;
}

// Livro que já está na Loja SEM capa: quem escreveu (ou quem revisa) abre o
// livro, o app baixa o epub, tira a capa de dentro e grava pelo servidor.
async function completarCapaLivroAutoral(d) {
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session.access_token;
    const respArq = await fetch(`${API_BASE}/api/estante-autoral/arquivo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ livroId: d.id }),
    });
    const { url } = await respArq.json();
    if (!url) return;
    const epub = await (await fetch(url)).blob();
    const capa = await extrairCapaDoEpub(epub);
    if (!capa) { mostrarToast('esse epub não tem imagem de capa dentro'); return; }
    const capaUrl = await subirCapaAutoral(sessionData.session.user.id, capa);
    if (!capaUrl) return;
    const resp = await fetch(`${API_BASE}/api/estante-autoral/capa`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ livroId: d.id, capaUrl }),
    });
    if (!resp.ok) return;
    d.capa_url = capaUrl;
    // troca o retângulo colorido pela capa na hora
    const caixa = document.querySelector('#livroAutoralDetalheConteudo .livro-grid-capa');
    if (caixa) { caixa.style.background = ''; caixa.style.backgroundImage = `url('${capaUrl}')`; caixa.innerHTML = ''; }
    mostrarToast('📕 capa colocada (veio de dentro do epub)');
  } catch (e) { console.log('não consegui tirar a capa do epub:', e.message); }
}

// Aviso antes de publicar: o preço é simbólico, pra comunidade Átomo.
// enviarLivroAutoral() mostra o popup; "publicar" chama de novo com confirmado = true.
window.fecharAvisoPrecoAutoral = function () {
  document.getElementById('autoralAvisoPrecoOverlay').classList.remove('show');
};
window.confirmarAvisoPrecoAutoral = function () {
  fecharAvisoPrecoAutoral();
  enviarLivroAutoral(true);
};

window.enviarLivroAutoral = async function (confirmado) {
  const titulo = document.getElementById('autoralTituloInput').value.trim();
  const descricao = document.getElementById('autoralDescricaoInput').value.trim();
  const precoTexto = document.getElementById('autoralPrecoInput').value.replace(',', '.').trim();
  const preco = Math.round(parseFloat(precoTexto) * 100);

  if (!titulo) { mostrarToast('escreve um título'); return; }
  if (!precoTexto || isNaN(preco) || preco <= 0) { mostrarToast('escreve um preço válido'); return; }
  if (!categoriaEnvioAutoral) { mostrarToast('escolhe uma categoria'); return; }
  if (!arquivoEpubAutoralEscolhido) { mostrarToast('escolhe o arquivo epub'); return; }
  if (confirmado !== true) {
    // mostra o valor que a pessoa digitou dentro do aviso
    document.getElementById('autoralAvisoPrecoValor').textContent = 'R$ ' + (preco / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('autoralAvisoPrecoOverlay').classList.add('show');
    return;
  }

  mostrarToast('enviando...');
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;

  // capa: a que a pessoa escolheu; se não escolheu nenhuma, tira de dentro do epub
  let arquivoCapa = arquivoCapaAutoralEscolhido;
  if (!arquivoCapa) {
    try { arquivoCapa = await extrairCapaDoEpub(arquivoEpubAutoralEscolhido); } catch (e) { arquivoCapa = null; }
  }
  const capaUrl = arquivoCapa ? await subirCapaAutoral(usuarioId, arquivoCapa) : null;

  const caminhoEpub = `${usuarioId}/${Date.now()}-${arquivoEpubAutoralEscolhido.name}`;
  const { error: erroEpub } = await supabaseClient.storage.from('estante-autoral-epubs').upload(caminhoEpub, arquivoEpubAutoralEscolhido);
  if (erroEpub) { mostrarToast('❌ erro no upload do epub: ' + erroEpub.message); return; }

  const novoLivro = {
    autor_id: usuarioId,
    titulo,
    descricao: descricao || null,
    preco_centavos: preco,
    capa_url: capaUrl,
    arquivo_path: caminhoEpub,
    idioma: idiomaLivroAutoral,
    categoria: categoriaEnvioAutoral,
  };
  let { error } = await supabaseClient.from('livros_autorais').insert(novoLivro);
  // se a coluna "idioma" ainda não foi criada no banco (SQL pendente), envia sem ela
  // em vez de travar a publicação do livro
  if (error && /idioma/.test(error.message)) {
    delete novoLivro.idioma;
    ({ error } = await supabaseClient.from('livros_autorais').insert(novoLivro));
  }
  // mesma ideia pra "categoria" (sql/sql_pendente_loja_categoria.sql ainda não rodado)
  if (error && /categoria/.test(error.message)) {
    delete novoLivro.categoria;
    ({ error } = await supabaseClient.from('livros_autorais').insert(novoLivro));
  }

  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('📚 livro enviado! entra na fila de revisão');
  closeOverlay('enviarLivroAutoralOverlay');
  trocarSubModoAutoral('meus');
};

async function renderMeusLivrosAutorais(usuarioId) {
  const lista = document.getElementById('lojaList');
  const [{ data, error }, { data: perfil }] = await Promise.all([
    supabaseClient.from('livros_autorais').select('*').eq('autor_id', usuarioId).order('criado_em', { ascending: false }),
    supabaseClient.from('usuarios').select('asaas_wallet_id').eq('id', usuarioId).maybeSingle(),
  ]);
  if (error) { lista.innerHTML = estanteAutoralCabecalhoHtml() + `<div class="visitor-lock-note">Não consegui carregar.</div>`; return; }
  window.MEUS_LIVROS_AUTORAIS = data || [];
  lista.innerHTML = estanteAutoralCabecalhoHtml() +
    // a caixa da wallet só aparece enquanto ela não foi salva; depois ela
    // mora dentro de "enviar outro livro" (pra conferir antes de publicar)
    (perfil && perfil.asaas_wallet_id ? '' : carteiraAutoralCardHtml(perfil)) +
    `<button class="post-btn" style="width:100%; margin-bottom:12px;" onclick="abrirEnviarLivroAutoral()">+ enviar outro livro</button>` +
    (data && data.length ? data.map((d, i) => cardMeuLivroAutoralHtml(d, i)).join('') : estadoVazio('nenhum livro enviado ainda', ''));
}

function carteiraAutoralCardHtml(perfil) {
  const wallet = perfil && perfil.asaas_wallet_id ? perfil.asaas_wallet_id : '';
  return `<div class="clube-cap-card" style="flex-direction:column; align-items:flex-start; margin-bottom:12px;">
        <div class="clube-cap-info" style="margin-bottom:8px;">
          <div class="clube-cap-kicker">${icone('moeda',10)} recebimento</div>
          <div class="clube-cap-valor" style="font-size:14px;">pra receber suas vendas, cola aqui sua wallet id do Asaas</div>
        </div>
        <input id="autoralWalletInput" class="busca-input" style="width:100%; margin-bottom:8px;" placeholder="wallet id do Asaas" value="${wallet}" oninput="document.getElementById('autoralWalletBtn').textContent = 'salvar'">
        <button class="post-btn" id="autoralWalletBtn" style="width:100%;" onclick="salvarWalletAutoral()">${wallet ? 'salvo ✓' : 'salvar'}</button>
      </div>`;
}

window.salvarWalletAutoral = async function () {
  // PRA APRENDER: o resultado aparece no PRÓPRIO botão ("salvando..." →
  // "salvo ✓"), não só no aviso que some — assim dá pra ver que funcionou.
  const btn = document.getElementById('autoralWalletBtn');
  const valor = document.getElementById('autoralWalletInput').value.trim();
  if (!valor) { mostrarToast('cola sua wallet id primeiro'); return; }
  // a wallet id do Asaas é um código no formato 8-4-4-4-12 (letras e números)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)) {
    if (btn) btn.textContent = 'código inválido — confere e cola de novo';
    return;
  }
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session ? sessionData.session.user.id : null;
  if (!usuarioId) { if (btn) btn.textContent = 'entra na sua conta de novo'; return; }
  if (btn) { btn.disabled = true; btn.textContent = 'salvando...'; }
  const { error } = await supabaseClient.from('usuarios').update({ asaas_wallet_id: valor }).eq('id', usuarioId);
  if (btn) btn.disabled = false;
  if (error) {
    if (btn) btn.textContent = 'não salvou — tenta de novo';
    mostrarToast('❌ erro: ' + error.message);
    return;
  }
  if (btn) btn.textContent = 'salvo ✓';
  mostrarToast('💰 wallet salva');
  // na aba "meus livros", a caixa some depois de salvar (fica guardada)
  if (subModoAutoral === 'meus') setTimeout(() => renderEstanteAutoral(), 900);
};

function cardMeuLivroAutoralHtml(d, i) {
  const preco = (d.preco_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  return `<div class="clube-cap-card" style="flex-direction:column; align-items:flex-start; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center; gap:8px;">
          <div class="clube-cap-info"><div class="clube-cap-valor" style="font-size:16px;">${d.titulo}</div><div class="clube-cap-pagina">R$ ${preco}</div></div>
          <span class="autoral-status-badge ${d.status}">${LABEL_STATUS_AUTORAL[d.status] || d.status}</span>
        </div>
        ${d.categoria ? `<div class="autoral-categoria-tag" style="margin-top:6px;">${escaparAutoral(d.categoria)}</div>` : ''}
        ${d.status === 'recusado' && d.motivo_recusa ? `<div class="autoral-motivo">motivo: ${d.motivo_recusa}</div><button class="post-btn" style="margin-top:8px;" onclick="reenviarLivroAutoral(${d.id})">corrigir e reenviar</button>` : ''}
        <button class="btn-acao btn-acao-contorno-salvia btn-mini" style="margin-top:10px;" onclick="abrirEditarLivroAutoral(${i})">${icone('editar', 14)} editar sinopse, categoria e capa</button>
      </div>`;
}

// ---------- editar livro: só sinopse, categoria e capa ----------
window.abrirEditarLivroAutoral = function (i) {
  const d = (window.MEUS_LIVROS_AUTORAIS || [])[i];
  if (!d) return;
  livroAutoralEditandoId = d.id;
  categoriaEdicaoAutoral = d.categoria || '';
  arquivoCapaEdicaoAutoral = null;
  document.getElementById('autoralEditarTitulo').textContent = d.titulo;
  document.getElementById('autoralEditarSinopse').value = d.descricao || '';
  document.getElementById('autoralEditarCategorias').innerHTML = chipsCategoriasHtml(categoriaEdicaoAutoral, 'escolherCategoriaEdicaoAutoral');
  const capa = document.getElementById('autoralEditarCapaPreview');
  capa.style.backgroundImage = d.capa_url ? `url('${d.capa_url}')` : '';
  capa.textContent = d.capa_url ? '' : 'sem capa';
  document.getElementById('autoralEditarCapaInput').value = '';
  document.getElementById('editarLivroAutoralOverlay').classList.add('open');
};

window.escolherCategoriaEdicaoAutoral = function (categoria) {
  categoriaEdicaoAutoral = categoria;
  document.getElementById('autoralEditarCategorias').innerHTML = chipsCategoriasHtml(categoria, 'escolherCategoriaEdicaoAutoral');
};

window.escolherCapaEdicaoAutoral = function () {
  const input = document.getElementById('autoralEditarCapaInput');
  if (!input.files || !input.files[0]) return;
  arquivoCapaEdicaoAutoral = input.files[0];
  // mostra a capa nova na hora (antes de salvar), lendo o arquivo do próprio aparelho
  const capa = document.getElementById('autoralEditarCapaPreview');
  capa.style.backgroundImage = `url('${URL.createObjectURL(arquivoCapaEdicaoAutoral)}')`;
  capa.textContent = '';
};

window.salvarEdicaoLivroAutoral = async function () {
  if (!livroAutoralEditandoId) return;
  if (!categoriaEdicaoAutoral) { mostrarToast('escolhe uma categoria'); return; }
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  mostrarToast('salvando...');

  const corpo = { livroId: livroAutoralEditandoId, descricao: document.getElementById('autoralEditarSinopse').value, categoria: categoriaEdicaoAutoral };
  if (arquivoCapaEdicaoAutoral) {
    const capaUrl = await subirCapaAutoral(sessionData.session.user.id, arquivoCapaEdicaoAutoral);
    if (!capaUrl) { mostrarToast('❌ não consegui subir a capa'); return; }
    corpo.capaUrl = capaUrl;
  }
  try {
    // passa pelo servidor: ele confere que você é quem escreveu e só deixa mudar esses 3 campos
    const resp = await fetch(`${API_BASE}/api/estante-autoral/editar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionData.session.access_token },
      body: JSON.stringify(corpo),
    });
    const resultado = await resp.json().catch(() => ({}));
    if (!resp.ok) { mostrarToast('❌ ' + (resultado.erro || 'não consegui salvar')); return; }
  } catch (e) { mostrarToast(mensagemServidorForaDoAr()); return; }
  mostrarToast('✅ livro atualizado');
  closeOverlay('editarLivroAutoralOverlay');
  renderEstanteAutoral();
};

window.reenviarLivroAutoral = async function (livroId) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
  if (!token) return;
  const resp = await fetch(`${API_BASE}/api/estante-autoral/reenviar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ livroId }),
  });
  const resultado = await resp.json().catch(() => ({}));
  if (!resp.ok) { mostrarToast('❌ ' + (resultado.erro || 'erro ao reenviar')); return; }
  mostrarToast('📬 reenviado pra revisão');
  renderEstanteAutoral();
};

async function renderComprasAutorais(usuarioId) {
  const lista = document.getElementById('lojaList');
  const { data, error } = await supabaseClient.from('vendas_autorais').select('id, livro_id, pago_em, livros_autorais(titulo, capa_url)').eq('comprador_id', usuarioId).eq('status', 'pago').order('pago_em', { ascending: false });
  if (error) { lista.innerHTML = estanteAutoralCabecalhoHtml() + `<div class="visitor-lock-note">Não consegui carregar.</div>`; return; }
  window.MINHAS_COMPRAS_AUTORAIS = data || [];
  lista.innerHTML = estanteAutoralCabecalhoHtml() +
    (data && data.length ? data.map((d, i) => cardCompraAutoralHtml(d, i)).join('') : estadoVazio('nenhuma compra ainda', ''));
}

function cardCompraAutoralHtml(d, i) {
  const livro = d.livros_autorais || {};
  const cor = CORES_LOMBADA_ESTANTE[i % CORES_LOMBADA_ESTANTE.length];
  const capaEstilo = livro.capa_url ? `background-image:url('${livro.capa_url}');` : `background:${cor};`;
  return `<div class="clube-cap-card" style="align-items:center; gap:10px; margin-bottom:10px; cursor:pointer;" onclick="baixarLivroAutoralComprado(${d.livro_id})">
        <div class="livro-grid-capa" style="${capaEstilo} width:46px; height:62px; border-radius:6px; flex-shrink:0;"></div>
        <div class="clube-cap-info"><div class="clube-cap-valor" style="font-size:15px;">${livro.titulo || 'livro'}</div><div class="clube-cap-pagina">toque pra baixar</div></div>
      </div>`;
}

async function renderRevisaoLivrosAutorais() {
  const lista = document.getElementById('lojaList');
  const { data, error } = await supabaseClient.from('livros_autorais').select('*, usuarios(handle)').eq('status', 'em_revisao').order('criado_em', { ascending: true });
  if (error) { lista.innerHTML = estanteAutoralCabecalhoHtml() + `<div class="visitor-lock-note">Não consegui carregar.</div>`; return; }
  window.FILA_REVISAO_AUTORAL = data || [];
  // o botão do webhook começa ESCONDIDO e só aparece se o servidor disser que
  // ainda não está configurado (depois de configurado, some de vez)
  const configWebhook = `<div id="autoralWebhookWrap"></div>`;
  lista.innerHTML = estanteAutoralCabecalhoHtml() + configWebhook +
    (data && data.length ? data.map((d, i) => cardRevisaoAutoralHtml(d, i)).join('') : estadoVazio('fila vazia', 'nenhum livro esperando revisão agora'));
  mostrarBotaoWebhookSePrecisar();
}

async function mostrarBotaoWebhookSePrecisar() {
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const resp = await fetch(`${SERVIDOR_PUBLICADO}/api/estante-autoral/webhook-status`, {
      headers: { Authorization: 'Bearer ' + sessionData.session.access_token },
    });
    const { configurado } = await resp.json();
    const wrap = document.getElementById('autoralWebhookWrap');
    if (wrap && configurado === false) {
      wrap.innerHTML = `<button class="post-btn" style="width:100%; margin-bottom:12px; background:var(--card-b); color:var(--ink);" onclick="configurarWebhookAsaas()">configurar webhook do Asaas (uma vez só)</button>`;
    }
  } catch (e) { /* servidor fora do ar: não mostra nada */ }
}

const SERVIDOR_PUBLICADO = 'https://atomo-app.onrender.com';
window.configurarWebhookAsaas = async function () {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
  if (!token) { mostrarToast('entra na sua conta de novo pra configurar'); return; }
  mostrarToast('configurando o webhook...');
  try {
    // SEMPRE no servidor publicado (Render), mesmo testando no localhost:
    // o webhook é o endereço que o Asaas chama pela internet, então ele tem
    // que ser o do Render — o seu computador o Asaas não consegue alcançar.
    const resp = await fetch(`${SERVIDOR_PUBLICADO}/api/estante-autoral/configurar-webhook`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    const resultado = await resp.json().catch(() => ({}));
    if (!resp.ok) { mostrarToast('❌ ' + (resultado.erro || 'erro ao configurar')); return; }
    mostrarToast('✅ ' + (resultado.mensagem || 'webhook configurado'));
    const wrapWebhook = document.getElementById('autoralWebhookWrap');
    if (wrapWebhook) wrapWebhook.innerHTML = ''; // pronto: o botão some
  } catch (e) {
    mostrarToast('❌ o servidor do Render não respondeu — espera uns segundos (ele pode estar acordando) e tenta de novo');
  }
};

function cardRevisaoAutoralHtml(d, i) {
  const preco = (d.preco_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  return `<div class="clube-cap-card" style="flex-direction:column; align-items:flex-start; margin-bottom:10px;">
        <div class="clube-cap-info"><div class="clube-cap-valor" style="font-size:16px;">${d.titulo}</div><div class="clube-cap-pagina">@${d.usuarios ? d.usuarios.handle : 'alguém'} · R$ ${preco}</div></div>
        ${d.descricao ? `<div style="font-size:12.5px; color:var(--ink-dim); margin:6px 0;">${d.descricao}</div>` : ''}
        <div style="display:flex; gap:8px; width:100%; margin-top:8px;">
          <button class="post-btn" style="flex:1;" onclick="aprovarLivroAutoral(${d.id})">aprovar</button>
          <button class="post-btn" style="flex:1; background:var(--card-b); color:var(--ink);" onclick="abrirRecusarLivroAutoral(${d.id})">recusar</button>
        </div>
      </div>`;
}

window.aprovarLivroAutoral = async function (livroId) {
  await enviarRevisaoAutoral(livroId, true, null);
};

window.abrirRecusarLivroAutoral = function (livroId) {
  livroAutoralRecusarAtualId = livroId;
  document.getElementById('autoralRecusarMotivoInput').value = '';
  document.getElementById('autoralRecusarPopupOverlay').classList.add('show');
};

window.fecharPopupRecusarAutoral = function () {
  document.getElementById('autoralRecusarPopupOverlay').classList.remove('show');
};

window.confirmarRecusarLivroAutoral = async function () {
  const motivo = document.getElementById('autoralRecusarMotivoInput').value.trim();
  if (!motivo) { mostrarToast('escreve um motivo pra ela poder corrigir'); return; }
  fecharPopupRecusarAutoral();
  await enviarRevisaoAutoral(livroAutoralRecusarAtualId, false, motivo);
};

async function enviarRevisaoAutoral(livroId, aprovado, motivo) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
  if (!token) { mostrarToast('entra na sua conta de novo pra revisar'); return; }
  // PRA APRENDER: antes, se o servidor não respondesse, o fetch "explodia" em
  // silêncio e parecia que o botão não fazia nada. Agora: aviso na hora,
  // try/catch pra pegar falha de rede e uma mensagem dizendo o que aconteceu.
  mostrarToast(aprovado ? 'aprovando...' : 'recusando...');
  try {
    const resp = await fetch(`${API_BASE}/api/estante-autoral/revisar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ livroId, aprovado, motivo }),
    });
    const resultado = await resp.json().catch(() => ({}));
    if (!resp.ok) { mostrarToast('❌ ' + (resultado.erro || 'erro ' + resp.status)); return; }
    mostrarToast(aprovado ? '✅ aprovado — já está na Loja' : '🚫 recusado');
    renderEstanteAutoral();
  } catch (e) {
    mostrarToast(mensagemServidorForaDoAr());
  }
}

// mensagem pra quando o servidor nem responde (rede caiu, Render acordando,
// ou — testando no computador — o servidor.js não está rodando)
function mensagemServidorForaDoAr() {
  return API_BASE.includes('localhost')
    ? '❌ o servidor local não respondeu — rode "node servidor.js" no terminal'
    : '❌ o servidor não respondeu — espera uns segundos (ele pode estar acordando) e tenta de novo';
}
