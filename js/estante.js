/* js/estante.js — Minha estante, sequência de leitura, estatísticas, upload de epub, Kindle
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- minha estante (upload de epub, leitura privada) ----------
window.ITENS_ESTANTE_ATUAIS = [];

// ---------- sequência de leitura (streak), inspirado no calendário do Fable ----------
function fmtDataISO(d) { return d.toISOString().slice(0, 10); }

async function registrarLeituraHoje() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  await supabaseClient.from('logs_leitura').upsert(
    { usuario_id: sessionData.session.user.id, data: fmtDataISO(new Date()) },
    { onConflict: 'usuario_id,data', ignoreDuplicates: true }
  );
}

async function streakLeituraHtml(usuarioId) {
  const hoje = new Date();
  const hojeChave = fmtDataISO(hoje);
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const primeiroDiaMes = new Date(anoAtual, mesAtual, 1);
  const ultimoDiaMes = new Date(anoAtual, mesAtual + 1, 0);
  const totalDiasMes = ultimoDiaMes.getDate();
  const offsetInicio = primeiroDiaMes.getDay(); // 0 = domingo

  const { data } = await supabaseClient
    .from('logs_leitura')
    .select('data')
    .eq('usuario_id', usuarioId)
    .gte('data', fmtDataISO(primeiroDiaMes))
    .lte('data', fmtDataISO(ultimoDiaMes));
  const datasLidas = new Set((data || []).map(d => d.data));

  // a sequência (streak) olha pra trás no tempo independente do mês exibido no calendário
  const inicioStreak = new Date(hoje);
  inicioStreak.setDate(inicioStreak.getDate() - 120);
  const { data: dataStreak } = await supabaseClient
    .from('logs_leitura')
    .select('data')
    .eq('usuario_id', usuarioId)
    .gte('data', fmtDataISO(inicioStreak));
  const datasParaStreak = new Set((dataStreak || []).map(d => d.data));
  let streak = 0;
  let cursor = new Date(hoje);
  if (!datasParaStreak.has(fmtDataISO(cursor))) cursor.setDate(cursor.getDate() - 1);
  // mesma chance de recuperação da ofensiva de escrita: 1 dia em branco é perdoado
  // (não conta como lido), e a chance só volta depois de 7 dias lidos
  let desdeChanceLeitura = 7;
  while (true) {
    if (datasParaStreak.has(fmtDataISO(cursor))) {
      streak++; desdeChanceLeitura++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      const antes = new Date(cursor);
      antes.setDate(antes.getDate() - 1);
      if (desdeChanceLeitura >= 7 && datasParaStreak.has(fmtDataISO(antes))) { desdeChanceLeitura = 0; cursor = antes; }
      else break;
    }
  }

  const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  let cabecalho = diasSemana.map(d => `<div style="text-align:center; font-size:10px; font-weight:700; color:var(--ink-faint); letter-spacing:0.5px;">${d}</div>`).join('');

  let celulas = '';
  for (let i = 0; i < offsetInicio; i++) celulas += `<div></div>`;
  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const d = new Date(anoAtual, mesAtual, dia);
    const chave = fmtDataISO(d);
    const lido = datasLidas.has(chave);
    const ehHoje = chave === hojeChave;
    const delay = (Math.min(dia, 20) * 0.012).toFixed(3);

    let classe = 'leitura-dia-cell';
    if (ehHoje) classe += lido ? ' hoje-lido' : ' hoje-nao-lido';

    if (lido) {
      celulas += `<div title="${chave}" class="${classe}" style="animation-delay:${delay}s;">
          <svg class="estante-dia-lido-atomo" viewBox="0 0 100 100" fill="currentColor"><path d="M18 12 L42 6 L58 4 L74 14 L88 10 L94 26 L96 44 L90 58 L94 74 L82 84 L66 96 L48 92 L30 98 L14 88 L6 72 L4 54 L10 38 L6 22 Z"/></svg>
          <span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:10.5px; font-weight:700; font-family:'DM Sans', sans-serif; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.5);">${dia}</span>
        </div>`;
    } else {
      celulas += `<div title="${chave}" class="${classe}" style="animation-delay:${delay}s;">${dia}</div>`;
    }
  }

  const nomesMes = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  return `
      <div class="bio-box" style="margin-bottom:14px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
          <div class="discover-title" style="margin:0; text-transform:capitalize;">${nomesMes[mesAtual]}</div>
          <div style="font-family:'Baloo 2'; font-size:15px; color:var(--accent-a); font-weight:800;">${streak} dia${streak === 1 ? '' : 's'} seguidos</div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; margin:8px 0 4px;">${cabecalho}</div>
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px;">${celulas}</div>
      </div>`;
}

// ---------- estatísticas de leitura: páginas lidas e horas, acumulado vitalício ----------
async function estatisticasLeituraHtml(usuarioId) {
  const { data } = await supabaseClient.from('estatisticas_leitura').select('*').eq('usuario_id', usuarioId).maybeSingle();
  const paginas = data ? data.paginas_lidas : 0;
  const minutos = data ? data.minutos_leitura : 0;
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  const horasTexto = horas > 0 ? `${horas}h${minutosRestantes ? ' ' + minutosRestantes + 'min' : ''}` : `${minutosRestantes}min`;

  return `
      <div style="display:flex; gap:8px; margin-bottom:14px;">
        <div class="bio-box" style="flex:1; margin-bottom:0; text-align:center;">
          <div style="font-family:'Baloo 2'; font-size:20px; color:var(--accent-a); font-weight:800;">${paginas.toLocaleString('pt-BR')}</div>
          <div style="font-size:10.5px; color:var(--ink-faint); font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;">${icone('livro',12)} páginas lidas</div>
        </div>
        <div class="bio-box" style="flex:1; margin-bottom:0; text-align:center;">
          <div style="font-family:'Baloo 2'; font-size:20px; color:var(--accent-b); font-weight:800;">${horasTexto}</div>
          <div style="font-size:10.5px; color:var(--ink-faint); font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;">${icone('relogio',12)} tempo de leitura</div>
        </div>
      </div>`;
}

// =====================================================================
// MINHA ESTANTE — visual novo (do design que a Aline fez no ElevenLabs)
// =====================================================================
// Estrutura da tela, de cima pra baixo:
//   1. título "Minha estante" escrito à mão + frase pequena
//   2. filtros: todos · lendo · lidos · quero ler
//   3. card grande "Continuar lendo" (o livro que você leu por último)
//   4. grade de 2 colunas com os outros livros (capa, progresso e 4 ações)
//   5. "enviar um epub" e "destaques do Kindle" (mesma largura)
//   6. sua sequência, estatísticas e o que você comprou na Loja
//
// PRA APRENDER: os filtros NÃO buscam de novo no banco. A lista inteira já
// está em window.ITENS_ESTANTE_ATUAIS; o filtro só escolhe quais mostrar.
// Por isso cada card guarda o índice ORIGINAL (i) do livro na lista inteira:
// é ele que o leitor (abrirLeitorEpub(i)) usa pra abrir o livro certo.
let filtroEstante = 'todos';
let estanteExtrasHtml = { streak: '', stats: '', compras: '' };

// em que "prateleira" o livro está, pelo progresso
function situacaoLivro(d) {
  const pct = Math.round(d.progresso_percentual || 0);
  if (pct >= 95 || d.finalizado_em) return 'lidos';
  if (pct > 0) return 'lendo';
  return 'quero';
}

async function renderEstante() {
  const lista = document.getElementById('livrosList');
  lista.innerHTML = skeletonCardsHtml(3);

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    lista.innerHTML = `<div class="visitor-lock-note">Entra na sua conta pra ver sua estante.</div>`;
    return;
  }
  const usuarioId = sessionData.session.user.id;

  const [streakHtml, estatisticasHtml, { data, error }, comprasResp] = await Promise.all([
    streakLeituraHtml(usuarioId),
    estatisticasLeituraHtml(usuarioId),
    supabaseClient.from('estante_pessoal').select('*').eq('usuario_id', usuarioId).order('adicionado_em', { ascending: false }),
    // livros comprados na Loja (estante autoral) também moram na sua estante
    supabaseClient.from('vendas_autorais').select('id, livro_id, pago_em, livros_autorais(titulo, capa_url, arquivo_path, usuarios(handle))').eq('comprador_id', usuarioId).eq('status', 'pago').order('pago_em', { ascending: false }),
  ]);
  const compras = (comprasResp && !comprasResp.error && comprasResp.data) || [];
  window.MINHAS_COMPRAS_AUTORAIS = compras;
  // livros comprados na Loja moram NA estante, como qualquer livro (com progresso, grifos e marcadores).
  // Normalmente o servidor já colocou ao confirmar o pagamento; se algum ficou de fora, entra agora.
  const naEstante = new Set((data || []).filter(x => x.livro_autoral_id).map(x => Number(x.livro_autoral_id)));
  const faltando = compras.filter(c => c.livros_autorais && !naEstante.has(Number(c.livro_id)));
  if (!error && faltando.length) {
    const linhas = faltando.map(c => ({
      usuario_id: usuarioId, titulo: c.livros_autorais.titulo,
      autor: c.livros_autorais.usuarios ? '@' + c.livros_autorais.usuarios.handle : null,
      capa_url: c.livros_autorais.capa_url || null, arquivo_path: c.livros_autorais.arquivo_path || 'loja', livro_autoral_id: c.livro_id,
    }));
    const { data: novos, error: erroNovos } = await supabaseClient.from('estante_pessoal').insert(linhas).select();
    if (!erroNovos && novos) data.unshift(...novos);
    else if (erroNovos && /livro_autoral_id/.test(erroNovos.message)) console.log('falta rodar sql/sql_pendente_loja_estante.sql');
  }
  estanteExtrasHtml = { streak: streakHtml, stats: estatisticasHtml, compras: '' };

  if (error) {
    lista.innerHTML = cabecalhoEstanteHtml() + `<div class="visitor-lock-note">Não consegui carregar sua estante agora${error.message.includes('estante_pessoal') ? ' — a tabela ainda não existe no banco, falta rodar a migração' : ''}.</div>`;
    return;
  }

  window.ITENS_ESTANTE_ATUAIS = data || [];
  desenharEstante();
}

function cabecalhoEstanteHtml() {
  return `
    <header class="estante-cabeca">
      <h2 class="estante-titulo">Minha estante</h2>
      <div class="estante-subtitulo">pequenas histórias, grandes dias</div>
    </header>`;
}

// desenha a tela a partir da lista que já está em memória (filtrar é instantâneo)
function desenharEstante() {
  const lista = document.getElementById('livrosList');
  const todos = (window.ITENS_ESTANTE_ATUAIS || []).map((d, i) => ({ d, i })); // guarda o índice original

  // "Continuar lendo" = o livro em andamento que você leu por último
  const lendo = todos.filter(x => situacaoLivro(x.d) === 'lendo')
    .sort((a, b) => new Date(b.d.lido_em || b.d.adicionado_em) - new Date(a.d.lido_em || a.d.adicionado_em));
  const destaque = filtroEstante === 'todos' || filtroEstante === 'lendo' ? lendo[0] : null;

  const visiveis = todos.filter(x => {
    if (destaque && x.i === destaque.i) return false; // já aparece em cima
    if (filtroEstante === 'todos') return true;
    if (filtroEstante === 'quero') return x.d.quero_ler || situacaoLivro(x.d) === 'quero';
    return situacaoLivro(x.d) === filtroEstante;
  });

  const filtros = [['todos', 'todos'], ['lendo', 'lendo'], ['lidos', 'lidos'], ['quero', 'quero ler']];
  const vazio = !todos.length
    ? estadoVazio('sua estante tá vazia', 'envia um epub pra começar a ler por aqui, sincronizado em qualquer aparelho')
    : (!destaque && !visiveis.length ? `<div class="visitor-lock-note">Nenhum livro aqui ainda.</div>` : '');

  lista.innerHTML = cabecalhoEstanteHtml() + `
    <div class="estante-filtros" role="tablist">
      ${filtros.map(([v, rot]) => `<button class="feed-modo-chip${filtroEstante === v ? ' on' : ''}" role="tab" aria-selected="${filtroEstante === v}" onclick="filtrarEstante('${v}')">${rot}</button>`).join('')}
    </div>
    ${destaque ? cardContinuarLendoHtml(destaque.d, destaque.i) : ''}
    ${visiveis.length ? `<div class="estante-grade">${visiveis.map(x => cardEstanteHtml(x.d, x.i)).join('')}</div>` : ''}
    ${vazio}
    <div class="botoes-par estante-envios">
      <button class="btn-acao btn-acao-contorno-salvia" onclick="abrirUploadEpub()">${icone('instalar', 18)}enviar um epub</button>
      <button class="btn-acao btn-acao-terracota" onclick="abrirImportarKindle()">${icone('estante', 18)}destaques do Kindle</button>
    </div>
    ${estanteExtrasHtml.streak}${estanteExtrasHtml.stats}${estanteExtrasHtml.compras}`;
  ativarSegurarParaRemover();
}

window.filtrarEstante = function (v) { filtroEstante = v; desenharEstante(); };

// capa: a imagem do livro, ou uma "capa de papel" com o título em letra de livro
function capaEstanteHtml(d, classe) {
  // livro comprado na Loja ganha uma fitinha terracota no canto, pra diferenciar dos epubs que você subiu
  const fita = d.livro_autoral_id ? `<span class="fita-loja" aria-label="comprado na Loja">Loja</span>` : '';
  return d.capa_url
    ? `<div class="${classe}${fita ? ' com-fita-loja' : ''}" style="background-image:url('${d.capa_url}');">${fita}</div>`
    : `<div class="${classe} capa-papel${fita ? ' com-fita-loja' : ''}"><span class="capa-papel-titulo">${d.titulo}</span>${d.autor ? `<span class="capa-papel-autor">${d.autor}</span>` : ''}${fita}</div>`;
}

function barraProgressoHtml(pct) {
  return `<div class="estante-progresso"><div class="estante-progresso-trilho"><div class="estante-progresso-cheio" style="width:${pct}%"></div></div><span>${pct}%</span></div>`;
}

// as 4 ações do card (no mesmo estilo dos botões dos posts)
function acoesLivroHtml(d, i) {
  return `
    <div class="post-actions estante-acoes" onclick="event.stopPropagation()">
      <div class="post-action${d.favorito ? ' liked' : ''}" onclick="favoritarLivroEstante(${i}, event)" aria-label="Favoritar">${icone('curtir', 14)}</div>
      <div class="post-action" onclick="comentarLivroEstante(${i})" aria-label="Comentar no feed">${icone('comentar', 14)}</div>
      <div class="post-action" onclick="compartilharLivroEstante(${i})" aria-label="Compartilhar no feed">${icone('compartilhar', 14)}</div>
      <div class="post-action${d.quero_ler ? ' ativo' : ''}" onclick="queroLerLivroEstante(${i})" aria-label="Quero ler">${icone('salvar', 14)}</div>
    </div>`;
}

function cardContinuarLendoHtml(d, i) {
  const pct = Math.round(d.progresso_percentual || 0);
  return `
    <div class="estante-continuar" data-estante-i="${i}" onclick="abrirLeitorEpub(${i})">
      ${capaEstanteHtml(d, 'estante-continuar-capa')}
      <div class="estante-continuar-info">
        <div class="estante-continuar-kicker">Continuar lendo</div>
        <div class="estante-continuar-titulo">${d.titulo}</div>
        ${d.autor ? `<div class="estante-continuar-autor">${d.autor}</div>` : ''}
        ${barraProgressoHtml(pct)}
        <div class="estante-continuar-botoes" onclick="event.stopPropagation()">
          <button class="btn-acao btn-acao-salvia" onclick="abrirLeitorEpub(${i})"><span class="icon-svg" style="width:18px;height:18px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 5.5v13l10-6.5z"/></svg></span>Continuar</button>
          <button class="btn-icone${d.quero_ler ? ' terracota ativo' : ''}" onclick="queroLerLivroEstante(${i})" aria-label="Quero ler">${icone('salvar', 18)}</button>
        </div>
      </div>
    </div>`;
}

function cardEstanteHtml(d, i) {
  const pct = Math.round(d.progresso_percentual || 0);
  return `
    <div class="estante-livro-card" data-estante-i="${i}" style="animation-delay:${Math.min(i, 10) * 0.05}s;" onclick="abrirLeitorEpub(${i})" title="${d.titulo}">
      ${capaEstanteHtml(d, 'estante-livro-capa')}
      <div class="estante-livro-info">
        <div class="estante-livro-titulo">${d.titulo}</div>
        ${d.autor ? `<div class="estante-livro-autor">${d.autor}</div>` : ''}
        ${barraProgressoHtml(pct)}
      </div>
      ${acoesLivroHtml(d, i)}
    </div>`;
}

// ---------- ações dos cards ----------
// grava uma coluna e redesenha; se o SQL novo ainda não rodou, avisa com calma
async function atualizarLivroEstante(i, patch) {
  const item = window.ITENS_ESTANTE_ATUAIS[i];
  if (!item) return false;
  const { error } = await supabaseClient.from('estante_pessoal').update(patch).eq('id', item.id);
  if (error) {
    mostrarToast(/favorito|quero_ler/.test(error.message) ? 'falta rodar o SQL da estante nova no Supabase' : '❌ erro: ' + error.message);
    return false;
  }
  Object.assign(item, patch);
  desenharEstante();
  return true;
}

window.favoritarLivroEstante = async function (i, evt) {
  const item = window.ITENS_ESTANTE_ATUAIS[i];
  if (!item) return;
  if (!item.favorito && evt) explodirCurtida(evt.currentTarget); // raios do kit ao favoritar
  atualizarLivroEstante(i, { favorito: !item.favorito });
};

window.queroLerLivroEstante = async function (i) {
  const item = window.ITENS_ESTANTE_ATUAIS[i];
  if (!item) return;
  const ok = await atualizarLivroEstante(i, { quero_ler: !item.quero_ler });
  if (ok) mostrarToast(item.quero_ler ? '🔖 na sua lista "quero ler"' : 'saiu da lista "quero ler"');
};

// comentar = escreve um post no feed sobre o livro (mesmo popup do Descobrir)
window.comentarLivroEstante = function (i) {
  const item = window.ITENS_ESTANTE_ATUAIS[i];
  if (!item) return;
  discoverPendenteReal = { title: item.titulo };
  abrirWritePopup('💬', 'O que você está achando?', item.titulo + ' — seu comentário vai pro feed');
};

window.compartilharLivroEstante = async function (i) {
  const item = window.ITENS_ESTANTE_ATUAIS[i];
  if (!item) return;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const pct = Math.round(item.progresso_percentual || 0);
  const texto = pct >= 95 ? `📖 terminei de ler ${item.titulo}${item.autor ? ' — ' + item.autor : ''}` : `📖 estou lendo ${item.titulo}${item.autor ? ' — ' + item.autor : ''}`;
  const { error } = await supabaseClient.from('posts').insert({
    autor_id: sessionData.session.user.id, texto, tipo: 'Livro', privado: false, imagem_url: item.capa_url || null,
  });
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('↗ Compartilhado no seu feed');
  if (typeof avisarSeguidores === 'function') avisarSeguidores();
};

// ---------- remover: SEGURAR o dedo no livro ----------
// O design não tem lixeira à vista; pra tirar um livro, segura ~0,6s em cima
// dele e aparece a confirmação (popup do próprio app, nunca o do navegador).
function ativarSegurarParaRemover() {
  document.querySelectorAll('#livrosList [data-estante-i]').forEach(el => {
    let timer = null, segurou = false;
    const comecar = () => { segurou = false; timer = setTimeout(() => { segurou = true; if (navigator.vibrate) navigator.vibrate(20); excluirDoEstante(Number(el.dataset.estanteI)); }, 600); };
    const cancelar = () => clearTimeout(timer);
    el.addEventListener('pointerdown', comecar);
    ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach(ev => el.addEventListener(ev, ev === 'pointermove' ? (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) cancelar(); } : cancelar));
    // se segurou, o "clique" que vem depois não deve abrir o livro
    el.addEventListener('click', (e) => { if (segurou) { e.stopPropagation(); e.preventDefault(); segurou = false; } }, true);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}

// cores usadas nas capas sem imagem da Loja (estante-autoral.js usa)
const CORES_LOMBADA_ESTANTE = ['var(--accent-a)', 'var(--accent-b)', 'var(--pink)', 'var(--yellow)', '#8FA06E', '#6FA3C9'];

window.abrirUploadEpub = function () {
  const input = document.getElementById('uploadEpubInput');
  input.value = '';
  input.click();
};

window.escolherArquivoEpub = async function () {
  const input = document.getElementById('uploadEpubInput');
  if (!input.files || !input.files[0]) return;
  const arquivo = input.files[0];
  const titulo = arquivo.name.replace(/\.epub$/i, '');

  mostrarToast('enviando epub...');

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;
  const caminho = `${usuarioId}/${Date.now()}-${arquivo.name}`;

  const { error: erroUpload } = await supabaseClient.storage.from('estante-epubs').upload(caminho, arquivo);
  if (erroUpload) { mostrarToast('❌ erro no upload: ' + erroUpload.message); return; }

  const { error } = await supabaseClient.from('estante_pessoal').insert({
    usuario_id: usuarioId,
    titulo,
    autor: null,
    arquivo_path: caminho,
    formato: 'epub',
  });

  if (error) { mostrarToast('❌ erro: ' + error.message); return; }

  mostrarToast('📘 livro enviado pra sua estante');
  renderEstante();
};

// ---------- importar destaques do Kindle (My Clippings.txt, sem precisar de senha/API) ----------
// "destaques do Kindle" agora abre a tela MEUS DESTAQUES: ela mostra tudo que
// você grifou (no leitor do app ou no Kindle) e tem o botão de importar.
// Antes o botão só abria a escolha de arquivo, sem explicar nada, e os
// destaques importados não apareciam em lugar nenhum.
window.abrirImportarKindle = function () {
  document.getElementById('destaquesOverlay').classList.add('open');
  renderDestaques();
};

// abre/fecha o balãozinho de ajuda
window.alternarBalaoKindle = function (btn) {
  const balao = document.getElementById('kindleBalao');
  const abrir = balao.hidden;
  balao.hidden = !abrir;
  btn.classList.toggle('ativo', abrir);
  btn.setAttribute('aria-expanded', abrir);
};

window.escolherArquivoKindleAgora = function () {
  const input = document.getElementById('importarKindleInput');
  input.value = '';
  input.click();
};

window.DESTAQUES_ATUAIS = [];
async function renderDestaques() {
  const wrap = document.getElementById('destaquesLista');
  // balãozinho explicando passo a passo (aparece aberto até a pessoa importar
  // a primeira vez; depois vira um "?" que abre e fecha o balão)
  let jaImportou = false;
  try { jaImportou = localStorage.getItem('atomoKindleJaImportou') === '1'; } catch (e) { /* sem storage */ }
  const intro = `
    <div class="kindle-ajuda">
      <div class="kindle-ajuda-linha">
        <button class="btn-acao btn-acao-terracota" onclick="escolherArquivoKindleAgora()">${icone('instalar', 18)}importar do Kindle</button>
        <button class="btn-icone kindle-ajuda-btn${jaImportou ? '' : ' ativo'}" onclick="alternarBalaoKindle(this)" aria-label="Como funciona?" aria-expanded="${!jaImportou}">?</button>
      </div>
      <div class="kindle-balao" id="kindleBalao" ${jaImportou ? 'hidden' : ''}>
        <div class="kindle-balao-titulo">como trazer seus destaques do Kindle</div>
        <ol>
          <li>Ligue o Kindle no computador com o <b>cabo USB</b>. Ele aparece como um pendrive.</li>
          <li>Abra a pasta <b>documents</b> dentro do Kindle.</li>
          <li>Toque em <b>importar do Kindle</b> e escolha o arquivo <b>My Clippings.txt</b>.</li>
        </ol>
        <p>Pronto: todos os trechos que você marcou no Kindle aparecem aqui, separados por livro. Pode importar de novo sempre que marcar coisas novas.</p>
      </div>
    </div>`;
  wrap.innerHTML = intro + `<div class="visitor-lock-note">Carregando...</div>`;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  const { data, error } = await supabaseClient.from('grifos_livro').select('*')
    .eq('usuario_id', sessionData.session.user.id).order('criado_em', { ascending: false });
  if (error) { wrap.innerHTML = intro + `<div class="visitor-lock-note">Não consegui carregar seus destaques.</div>`; return; }
  window.DESTAQUES_ATUAIS = data || [];
  if (!data || !data.length) {
    wrap.innerHTML = intro + estadoVazio('nenhum destaque ainda', 'grife um trecho no leitor ou importe do Kindle');
    return;
  }
  // agrupa por livro (PRA APRENDER: reduce monta um objeto { "título": [destaques...] })
  const porLivro = data.reduce((acc, d, i) => {
    const chave = d.livro_titulo || 'sem título';
    (acc[chave] = acc[chave] || { autor: d.livro_autor, itens: [] }).itens.push({ d, i });
    return acc;
  }, {});
  wrap.innerHTML = intro + Object.entries(porLivro).map(([titulo, g]) => `
    <section class="destaques-livro">
      <div class="destaques-livro-cab">
        <div class="destaques-livro-titulo">${titulo}</div>
        ${g.autor ? `<div class="destaques-livro-autor">${g.autor}</div>` : ''}
        <span class="destaques-livro-conta">${g.itens.length}</span>
      </div>
      ${g.itens.map(({ d, i }) => `
        <figure class="destaque-card"${d.cor && window.CORES_GRIFO ? ` style="border-left:4px solid ${CORES_GRIFO[d.cor] || 'transparent'};"` : ''}>
          <blockquote>${d.texto}</blockquote>
          ${d.nota ? `<figcaption class="destaque-nota">${icone('editar', 12)} ${d.nota}</figcaption>` : ''}
          <div class="destaque-acoes">
            <button class="btn-icone btn-icone-mini" onclick="compartilharDestaque(${i})" aria-label="Virar cartão de citação">${icone('compartilhar', 14)}</button>
            <button class="btn-icone btn-icone-mini terracota" onclick="apagarDestaque(${i})" aria-label="Apagar destaque">${icone('lixeira', 14)}</button>
          </div>
        </figure>`).join('')}
    </section>`).join('');
}

// abre o mesmo cartão de citação que o leitor usa, já preenchido
window.compartilharDestaque = function (i) {
  const d = window.DESTAQUES_ATUAIS[i];
  if (!d) return;
  document.getElementById('citacaoTextoInput').value = d.texto;
  document.getElementById('citacaoTituloInput').value = d.livro_titulo || '';
  document.getElementById('citacaoAutorInput').value = d.livro_autor || '';
  window.CITACAO_CLUBE_ID = null;
  mostrarPreviaCitacao(false);
  document.getElementById('citacaoAcoes').style.display = 'none';
  document.getElementById('citacaoCartaoOverlay').classList.add('open');
};

window.apagarDestaque = function (i) {
  const d = window.DESTAQUES_ATUAIS[i];
  if (!d) return;
  abrirConfirmGenerico('Apagar esse destaque?', 'Ele sai da sua lista de destaques.', async () => {
    const { error } = await supabaseClient.from('grifos_livro').delete().eq('id', d.id);
    if (error) { mostrarToast('❌ erro: ' + error.message); return; }
    renderDestaques();
  });
};

// o My Clippings.txt separa cada destaque por uma linha "==========", no formato:
// Título (Autor)
// - Seu destaque na página X | local Y-Z | Adicionado em ...
// (linha em branco)
// texto do destaque
function parseKindleClippings(textoArquivo) {
  const blocos = textoArquivo.split(/\r?\n==========\r?\n?/).map(b => b.trim()).filter(Boolean);
  const destaques = [];
  for (const bloco of blocos) {
    const linhas = bloco.split(/\r?\n/).map(l => l.trim()).filter((l, idx) => !(idx > 0 && l === '' ));
    if (linhas.length < 2) continue;
    const linhaTitulo = linhas[0];
    const linhaMeta = linhas[1] || '';
    if (!/highlight|destaque/i.test(linhaMeta)) continue; // pula anotações e marcadores, só importa destaques
    const corpo = linhas.slice(2).join(' ').trim();
    if (!corpo) continue;
    const m = linhaTitulo.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    destaques.push({
      titulo: m ? m[1].trim() : linhaTitulo,
      autor: m ? m[2].trim() : null,
      texto: corpo,
    });
  }
  return destaques;
}

window.escolherArquivoKindle = async function () {
  const input = document.getElementById('importarKindleInput');
  if (!input.files || !input.files[0]) return;
  const arquivo = input.files[0];

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  const usuarioId = sessionData.session.user.id;

  const textoArquivo = await arquivo.text();
  const destaques = parseKindleClippings(textoArquivo);
  if (!destaques.length) { mostrarToast('não achei destaques nesse arquivo — confere se é o My Clippings.txt do seu Kindle'); return; }

  mostrarToast(`importando ${destaques.length} destaque${destaques.length === 1 ? '' : 's'}...`);
  const linhas = destaques.map(d => ({
    usuario_id: usuarioId,
    estante_id: null,
    livro_titulo: d.titulo,
    livro_autor: d.autor,
    texto: d.texto,
  }));
  const { error } = await supabaseClient.from('grifos_livro').insert(linhas);
  if (error) { mostrarToast('❌ erro ao importar: ' + error.message); return; }
  mostrarToast(`📚 ${destaques.length} destaque${destaques.length === 1 ? '' : 's'} do Kindle importado${destaques.length === 1 ? '' : 's'}!`);
  try { localStorage.setItem('atomoKindleJaImportou', '1'); } catch (e) { /* sem storage */ }
  renderDestaques();
};

window.excluirDoEstante = async function (i) {
  const item = window.ITENS_ESTANTE_ATUAIS[i];
  if (!item) return;
  // livro comprado é seu pra sempre: não sai da estante (e o arquivo é da autora, não seu)
  if (item.livro_autoral_id) { mostrarToast('livro comprado na Loja fica sempre na sua estante 📚'); return; }
  abrirConfirmGenerico('Tirar "' + item.titulo + '" da estante?', 'O arquivo do livro é apagado. Não tem como desfazer.', async () => {
    await supabaseClient.storage.from('estante-epubs').remove([item.arquivo_path]);
    await supabaseClient.from('estante_pessoal').delete().eq('id', item.id);
    mostrarToast('removido da estante');
    renderEstante();
  });
};
