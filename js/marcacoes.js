/* js/marcacoes.js — GRIFOS coloridos (com nota) e MARCADORES de página, nos dois leitores:
   - leitor de epub (livros da estante) → posição guardada como "cfi" (o endereço exato do trecho no epub)
   - leitor de texto (livros grátis: Gutendex, Wikisource, Archive) → posição = número da página
   Tudo fica salvo no Supabase (grifos_livro e marcadores_livro), então não some ao trocar de celular.
   Os grifos também aparecem em "Meus destaques", junto com os importados do Kindle.
   Script comum (sem módulo): usa leitorEpubAtual e leitorLivroAtual, que vêm do leitor.js. */

// cores do marca-texto: o nome é o que vai pro banco; o valor é a cor na tela
const CORES_GRIFO = {
  amarelo: '#F4D35E',
  salvia: '#A9C4A4',
  terracota: '#E8A48C',
  lilas: '#C9B6E4',
};
window.CORES_GRIFO = CORES_GRIFO; // "Meus destaques" (estante.js) usa pra mostrar a cor de cada grifo

// grifos e marcadores do livro aberto agora (carregados ao abrir o livro)
let marcacoesAtuais = { grifos: [], marcadores: [] };
let abaMarcacoes = 'grifos';

// qual leitor está aberto? (o de epub tem prioridade se, por acaso, os dois estiverem)
function leitorAberto() {
  if (typeof leitorEpubAtual !== 'undefined' && leitorEpubAtual) return 'epub';
  if (typeof leitorLivroAtual !== 'undefined' && leitorLivroAtual) return 'texto';
  return null;
}

// filtro do Supabase pro livro aberto: epub → estante_id; livro grátis → livro_chave
function filtrarPeloLivro(consulta) {
  return leitorAberto() === 'epub'
    ? consulta.eq('estante_id', leitorEpubAtual.item.id)
    : consulta.eq('livro_chave', leitorLivroAtual.chave);
}

function dadosDoLivroAberto() {
  if (leitorAberto() === 'epub') {
    const it = leitorEpubAtual.item;
    return { estante_id: it.id, livro_titulo: it.titulo, livro_autor: it.autor || null };
  }
  const it = leitorLivroAtual.item;
  return { estante_id: null, livro_chave: leitorLivroAtual.chave, livro_titulo: it.title, livro_autor: (it.authors && it.authors[0] && it.authors[0].name) || it.author || null };
}

// ---------- carregar ao abrir o livro ----------
async function carregarMarcacoesDoLivro() {
  marcacoesAtuais = { grifos: [], marcadores: [] };
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session || !leitorAberto()) return;
  const meuId = sessionData.session.user.id;
  const [g, m] = await Promise.all([
    filtrarPeloLivro(supabaseClient.from('grifos_livro').select('*').eq('usuario_id', meuId)).order('criado_em', { ascending: true }),
    filtrarPeloLivro(supabaseClient.from('marcadores_livro').select('*').eq('usuario_id', meuId)).order('criado_em', { ascending: true }),
  ]);
  // se o SQL novo ainda não rodou, essas consultas dão erro: o leitor continua funcionando sem marcações
  marcacoesAtuais.grifos = g.error ? [] : (g.data || []);
  marcacoesAtuais.marcadores = m.error ? [] : (m.data || []);
}

// epub: pinta os grifos salvos no livro e acerta a fitinha do marcador
window.prepararMarcacoesEpub = async function () {
  await carregarMarcacoesDoLivro();
  if (!leitorEpubAtual) return;
  marcacoesAtuais.grifos.filter(g => g.cfi).forEach(pintarGrifoEpub);
  atualizarFitaMarcador();
};

// texto: redesenha a página já com os grifos e acerta a fitinha
window.prepararMarcacoesLivro = async function () {
  await carregarMarcacoesDoLivro();
  if (!leitorLivroAtual) return;
  renderPaginaLivroAtual();
};

// ---------- GRIFAR ----------
// epub.js desenha o grifo como um retângulo colorido por cima do texto (annotations.highlight)
function pintarGrifoEpub(g) {
  try {
    leitorEpubAtual.rendition.annotations.highlight(g.cfi, { id: g.id }, () => {}, 'grifo-hl',
      { fill: CORES_GRIFO[g.cor] || CORES_GRIFO.amarelo, 'fill-opacity': '0.4', 'mix-blend-mode': 'multiply' });
  } catch (e) { /* cfi de outra edição do livro: ignora esse grifo */ }
}

// texto da seleção atual em qualquer um dos leitores
function selecaoDoLeitor() {
  if (leitorAberto() === 'epub') return leitorEpubAtual.selecaoAtual || '';
  if (leitorLivroAtual.textoGuardado) return leitorLivroAtual.textoGuardado;
  const sel = window.getSelection();
  return sel ? sel.toString().trim() : '';
}

function esconderBarrasGrifar() {
  ['grifarBarra', 'grifarBarraLivro'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = 'none'; });
}

// salva o grifo no banco (com fallback se o SQL novo ainda não rodou)
async function salvarGrifo(cor, nota) {
  const texto = selecaoDoLeitor();
  if (!texto || texto.length < 3) { mostrarToast('selecione um trecho primeiro'); return null; }
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return null;
  const linha = Object.assign({ usuario_id: sessionData.session.user.id, texto, cor, nota: nota || null }, dadosDoLivroAberto());
  if (leitorAberto() === 'epub') linha.cfi = leitorEpubAtual.selecaoCfi || null;
  else linha.pagina = leitorLivroAtual.paginaIdx;

  let { data, error } = await supabaseClient.from('grifos_livro').insert(linha).select().single();
  if (error && /cor|nota|cfi|pagina|livro_chave/.test(error.message)) {
    // banco ainda sem as colunas novas: salva o básico (aparece em Meus destaques, sem cor/posição)
    const { usuario_id, texto: t, estante_id, livro_titulo, livro_autor } = linha;
    ({ data, error } = await supabaseClient.from('grifos_livro').insert({ usuario_id, texto: t, estante_id, livro_titulo, livro_autor }).select().single());
    if (!error) mostrarToast('grifado (rode o SQL dos grifos pra guardar a cor e a posição)');
  }
  if (error) { mostrarToast('❌ não consegui grifar: ' + error.message); return null; }
  marcacoesAtuais.grifos.push(data);
  return data;
}

// toque numa bolinha de cor: grifa na hora
window.grifarComCor = async function (cor) {
  const g = await salvarGrifo(cor);
  if (!g) return;
  if (leitorAberto() === 'epub') {
    if (g.cfi) pintarGrifoEpub(g);
    try { leitorEpubAtual.selecaoContents.window.getSelection().removeAllRanges(); } catch (e) { /* ok */ }
    leitorEpubAtual.selecaoAtual = null;
  } else {
    window.getSelection().removeAllRanges();
    renderPaginaLivroAtual();
  }
  esconderBarrasGrifar();
  if (typeof vibrar === 'function') vibrar(10);
  mostrarToast('🖍️ grifado');
};

// "nota": abre o popup pra escrever um comentário junto do grifo
let textoGrifoComNota = '';
window.abrirNotaGrifo = function () {
  textoGrifoComNota = selecaoDoLeitor();
  if (!textoGrifoComNota) { mostrarToast('selecione um trecho primeiro'); return; }
  document.getElementById('notaGrifoTrecho').textContent = '“' + textoGrifoComNota.slice(0, 160) + (textoGrifoComNota.length > 160 ? '…' : '') + '”';
  document.getElementById('notaGrifoInput').value = '';
  document.getElementById('notaGrifoOverlay').classList.add('show');
  setTimeout(() => document.getElementById('notaGrifoInput').focus(), 150);
};
window.fecharNotaGrifo = function () { document.getElementById('notaGrifoOverlay').classList.remove('show'); };
window.salvarNotaGrifo = async function () {
  const nota = document.getElementById('notaGrifoInput').value.trim();
  // ao tocar no campo de nota, a seleção do livro some: por isso o trecho foi guardado
  // em textoGrifoComNota na hora de abrir o popup, e é ele que vai pro banco
  if (leitorAberto() === 'epub') leitorEpubAtual.selecaoAtual = textoGrifoComNota;
  else leitorLivroAtual.textoGuardado = textoGrifoComNota;
  const g = await salvarGrifo('amarelo', nota);
  if (!g) return;
  fecharNotaGrifo();
  esconderBarrasGrifar();
  if (leitorAberto() === 'epub' && g.cfi) pintarGrifoEpub(g);
  else if (leitorAberto() === 'texto') { leitorLivroAtual.textoGuardado = null; renderPaginaLivroAtual(); }
  mostrarToast('🖍️ grifado com nota');
};

// "compartilhar": grifa e já abre o cartão de citação (vira imagem pro feed ou conversa)
window.grifarECompartilhar = async function () {
  const g = await salvarGrifo('amarelo');
  if (!g) return;
  if (leitorAberto() === 'epub' && g.cfi) pintarGrifoEpub(g);
  else if (leitorAberto() === 'texto') renderPaginaLivroAtual();
  esconderBarrasGrifar();
  abrirCartaoDoGrifo(g);
};

function abrirCartaoDoGrifo(g) {
  abrirCitacaoPronta(g.texto, g.livro_titulo, g.livro_autor); // já abre com a citação pronta (cartoes.js)
}

// compatibilidade: o botão antigo "grifar esse trecho" chamava esta função
window.grifarSelecaoAtual = window.grifarECompartilhar;

// leitor de texto: mostra a barra de grifar quando a pessoa seleciona um trecho da página
document.addEventListener('selectionchange', () => {
  if (leitorAberto() !== 'texto') return;
  const barra = document.getElementById('grifarBarraLivro');
  const pagina = document.getElementById('leitorLivroPagina');
  const sel = window.getSelection();
  const dentro = sel && sel.rangeCount && pagina.contains(sel.anchorNode);
  barra.style.display = dentro && sel.toString().trim().length > 3 ? 'flex' : 'none';
});

// leitor de texto: desenha a página com os grifos pintados (<mark>)
// PRA APRENDER: em vez de innerHTML com o texto direto (perigoso: o texto do livro poderia
// conter "<script>"), o texto é escapado e só as marcas <mark> que NÓS criamos viram HTML.
function escaparTextoLeitor(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
window.desenharPaginaComGrifos = function (pagEl, texto, paginaIdx) {
  const grifos = marcacoesAtuais.grifos.filter(g => g.pagina === paginaIdx && g.texto);
  if (!grifos.length) { pagEl.textContent = texto; return; }
  // acha onde cada grifo começa e termina na página
  const trechos = [];
  grifos.forEach(g => {
    const inicio = texto.indexOf(g.texto);
    if (inicio >= 0) trechos.push({ inicio, fim: inicio + g.texto.length, cor: g.cor });
  });
  trechos.sort((a, b) => a.inicio - b.inicio);
  let html = '', pos = 0;
  trechos.forEach(t => {
    if (t.inicio < pos) return; // grifo encavalado em outro: pula
    html += escaparTextoLeitor(texto.slice(pos, t.inicio));
    html += `<mark class="grifo-texto" style="background:${CORES_GRIFO[t.cor] || CORES_GRIFO.amarelo};">${escaparTextoLeitor(texto.slice(t.inicio, t.fim))}</mark>`;
    pos = t.fim;
  });
  html += escaparTextoLeitor(texto.slice(pos));
  pagEl.innerHTML = html;
};

// ---------- MARCADOR DE PÁGINA (a fitinha no topo) ----------
function posicaoAtual() {
  if (leitorAberto() === 'epub') {
    const loc = leitorEpubAtual.rendition.currentLocation();
    const cfi = loc && loc.start && loc.start.cfi;
    if (!cfi) return null;
    const pct = document.getElementById('leitorEpubProgresso').textContent || '';
    return { posicao: cfi, rotulo: pct ? 'em ' + pct : 'marcador' };
  }
  if (leitorAberto() === 'texto') {
    return { posicao: String(leitorLivroAtual.paginaIdx), rotulo: 'pág. ' + (leitorLivroAtual.paginaIdx + 1) };
  }
  return null;
}

function marcadorDaPosicaoAtual() {
  const p = posicaoAtual();
  return p ? marcacoesAtuais.marcadores.find(m => m.posicao === p.posicao) : null;
}

// fitinha preenchida = esta página tem marcador
window.atualizarFitaMarcador = function () {
  const marcado = !!marcadorDaPosicaoAtual();
  ['fitaMarcadorEpub', 'fitaMarcadorLivro'].forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.toggle('ativo', marcado);
    b.setAttribute('aria-pressed', marcado ? 'true' : 'false');
  });
};

window.alternarMarcador = async function () {
  const p = posicaoAtual();
  if (!p) return;
  const existente = marcadorDaPosicaoAtual();
  if (existente) {
    const { error } = await supabaseClient.from('marcadores_livro').delete().eq('id', existente.id);
    if (error) { mostrarToast('❌ ' + error.message); return; }
    marcacoesAtuais.marcadores = marcacoesAtuais.marcadores.filter(m => m.id !== existente.id);
    mostrarToast('marcador removido');
  } else {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) return;
    const { estante_id, livro_chave, livro_titulo } = dadosDoLivroAberto();
    const { data, error } = await supabaseClient.from('marcadores_livro').insert({
      usuario_id: sessionData.session.user.id, estante_id, livro_chave: livro_chave || null, livro_titulo, posicao: p.posicao, rotulo: p.rotulo,
    }).select().single();
    if (error) { mostrarToast(/marcadores_livro/.test(error.message) ? '❌ falta rodar o SQL dos marcadores' : '❌ ' + error.message); return; }
    marcacoesAtuais.marcadores.push(data);
    if (typeof vibrar === 'function') vibrar(10);
    mostrarToast('📑 página marcada');
  }
  atualizarFitaMarcador();
};

// ---------- TELA "MARCAÇÕES" (grifos + marcadores do livro aberto) ----------
window.abrirMarcacoes = function () {
  if (!leitorAberto()) return;
  const d = dadosDoLivroAberto();
  document.getElementById('marcacoesLivroTitulo').textContent = d.livro_titulo || 'Marcações';
  desenharMarcacoes();
  document.getElementById('marcacoesOverlay').classList.add('open');
};

window.trocarAbaMarcacoes = function (aba) {
  abaMarcacoes = aba;
  desenharMarcacoes();
};

function desenharMarcacoes() {
  document.querySelectorAll('.marcacoes-aba').forEach(b => {
    const ativo = b.dataset.aba === abaMarcacoes;
    b.classList.toggle('ativo', ativo);
    b.setAttribute('aria-selected', ativo ? 'true' : 'false');
  });
  const { grifos, marcadores } = marcacoesAtuais;
  document.getElementById('marcacoesContaGrifos').textContent = grifos.length;
  document.getElementById('marcacoesContaMarcadores').textContent = marcadores.length;
  const lista = document.getElementById('marcacoesLista');

  if (abaMarcacoes === 'grifos') {
    lista.innerHTML = grifos.length
      ? grifos.slice().reverse().map(g => `
        <div class="marcacao-item" role="button" tabindex="0" onclick="irParaMarcacao('grifo', '${g.id}')">
          <span class="marcacao-cor" style="background:${CORES_GRIFO[g.cor] || CORES_GRIFO.amarelo};"></span>
          <div class="marcacao-corpo">
            <div class="marcacao-texto">“${escaparTextoLeitor(g.texto)}”</div>
            ${g.nota ? `<div class="marcacao-nota">${icone('editar', 12)} ${escaparTextoLeitor(g.nota)}</div>` : ''}
            <div class="marcacao-meta">${g.pagina != null ? 'pág. ' + (g.pagina + 1) : ''}</div>
          </div>
          <div class="marcacao-acoes">
            <button class="btn-icone btn-icone-mini" aria-label="Compartilhar como cartão" onclick="event.stopPropagation(); compartilharGrifoMarcacoes('${g.id}')">${icone('compartilhar', 14)}</button>
            <button class="btn-icone btn-icone-mini terracota" aria-label="Apagar grifo" onclick="event.stopPropagation(); apagarMarcacao('grifo', '${g.id}')">${icone('lixeira', 14)}</button>
          </div>
        </div>`).join('')
      : `<div class="marcacoes-vazio">Nenhum grifo ainda.<br>Selecione um trecho do livro e escolha uma cor.</div>`;
  } else {
    lista.innerHTML = marcadores.length
      ? marcadores.slice().reverse().map(m => `
        <div class="marcacao-item" role="button" tabindex="0" onclick="irParaMarcacao('marcador', '${m.id}')">
          <span class="marcacao-fita">${iconeFita()}</span>
          <div class="marcacao-corpo">
            <div class="marcacao-texto">${escaparTextoLeitor(m.rotulo || 'marcador')}</div>
            <div class="marcacao-meta">marcado em ${new Date(m.criado_em).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</div>
          </div>
          <div class="marcacao-acoes">
            <button class="btn-icone btn-icone-mini terracota" aria-label="Apagar marcador" onclick="event.stopPropagation(); apagarMarcacao('marcador', '${m.id}')">${icone('lixeira', 14)}</button>
          </div>
        </div>`).join('')
      : `<div class="marcacoes-vazio">Nenhuma página marcada.<br>Toque na fitinha no topo do leitor pra marcar.</div>`;
  }
}

function iconeFita() {
  return '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>';
}

// tocar numa marcação leva direto pro trecho/página
window.irParaMarcacao = function (tipo, id) {
  const item = (tipo === 'grifo' ? marcacoesAtuais.grifos : marcacoesAtuais.marcadores).find(x => x.id === id);
  if (!item) return;
  closeOverlay('marcacoesOverlay');
  if (leitorAberto() === 'epub') {
    const destino = tipo === 'grifo' ? item.cfi : item.posicao;
    if (destino) leitorEpubAtual.rendition.display(destino);
    else mostrarToast('esse grifo é antigo e não guardou a posição');
  } else {
    const pagina = tipo === 'grifo' ? item.pagina : parseInt(item.posicao, 10);
    if (pagina == null || isNaN(pagina)) { mostrarToast('esse grifo é antigo e não guardou a página'); return; }
    leitorLivroAtual.paginaIdx = Math.min(pagina, leitorLivroAtual.paginas.length - 1);
    renderPaginaLivroAtual();
  }
};

window.compartilharGrifoMarcacoes = function (id) {
  const g = marcacoesAtuais.grifos.find(x => x.id === id);
  if (g) abrirCartaoDoGrifo(g);
};

window.apagarMarcacao = function (tipo, id) {
  const tabela = tipo === 'grifo' ? 'grifos_livro' : 'marcadores_livro';
  const g = tipo === 'grifo' ? marcacoesAtuais.grifos.find(x => x.id === id) : null;
  marcacoesAtuais.grifosApagadoCfi = g && g.cfi; // pra tirar a cor do epub depois de apagar
  abrirConfirmGenerico(tipo === 'grifo' ? 'Apagar esse grifo?' : 'Apagar esse marcador?', 'Ele sai das suas marcações.', async () => {
    const { error } = await supabaseClient.from(tabela).delete().eq('id', id);
    if (error) { mostrarToast('❌ ' + error.message); return; }
    if (tipo === 'grifo') {
      marcacoesAtuais.grifos = marcacoesAtuais.grifos.filter(g => g.id !== id);
      if (leitorAberto() === 'epub') {
        const apagado = marcacoesAtuais.grifosApagadoCfi;
        if (apagado) { try { leitorEpubAtual.rendition.annotations.remove(apagado, 'highlight'); } catch (e) { /* ok */ } }
      }
      else renderPaginaLivroAtual();
    } else {
      marcacoesAtuais.marcadores = marcacoesAtuais.marcadores.filter(m => m.id !== id);
      atualizarFitaMarcador();
    }
    desenharMarcacoes();
  });
};
