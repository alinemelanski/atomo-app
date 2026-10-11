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
  const lista = document.getElementById('livrosList');
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
  const lista = document.getElementById('livrosList');
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

  lista.innerHTML = estanteAutoralCabecalhoHtml() + convite +
    (data && data.length
      ? `<div class="livros-grid">${data.map((d, i) => cardLivroAutoralHtml(d, i)).join('')}</div>`
      : estadoVazio('ainda não tem livro nenhum aqui', 'seja a primeira pessoa a publicar um livro'));
}

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
      ${d.descricao ? `<div style="font-size:13.5px; line-height:1.5; margin-bottom:14px;">${d.descricao}</div>` : ''}
      ${botaoAcao}
      ${jaComprou ? avaliarLivroAutoralHtml() : ''}
      <div id="livroAutoralAvaliacoesLista"></div>`;

  document.getElementById('livroAutoralDetalheOverlay').classList.add('open');
  renderAvaliacoesLivroAutoral(d.id);
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
  arquivoCapaAutoralEscolhido = null;
  arquivoEpubAutoralEscolhido = null;
  document.getElementById('autoralCapaPreviewTxt').textContent = 'escolher capa (opcional)';
  document.getElementById('autoralEpubPreviewTxt').textContent = 'escolher arquivo epub';
  document.getElementById('enviarLivroAutoralOverlay').classList.add('open');
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
};

window.enviarLivroAutoral = async function () {
  const titulo = document.getElementById('autoralTituloInput').value.trim();
  const descricao = document.getElementById('autoralDescricaoInput').value.trim();
  const precoTexto = document.getElementById('autoralPrecoInput').value.replace(',', '.').trim();
  const preco = Math.round(parseFloat(precoTexto) * 100);

  if (!titulo) { mostrarToast('escreve um título'); return; }
  if (!precoTexto || isNaN(preco) || preco <= 0) { mostrarToast('escreve um preço válido'); return; }
  if (!arquivoEpubAutoralEscolhido) { mostrarToast('escolhe o arquivo epub'); return; }

  mostrarToast('enviando...');
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;

  let capaUrl = null;
  if (arquivoCapaAutoralEscolhido) {
    const caminhoCapa = `${usuarioId}/${Date.now()}-${arquivoCapaAutoralEscolhido.name}`;
    const { error: erroCapa } = await supabaseClient.storage.from('midia-posts').upload(caminhoCapa, arquivoCapaAutoralEscolhido);
    if (!erroCapa) {
      const { data: urlCapa } = supabaseClient.storage.from('midia-posts').getPublicUrl(caminhoCapa);
      capaUrl = urlCapa.publicUrl;
    }
  }

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
  };
  let { error } = await supabaseClient.from('livros_autorais').insert(novoLivro);
  // se a coluna "idioma" ainda não foi criada no banco (SQL pendente), envia sem ela
  // em vez de travar a publicação do livro
  if (error && /idioma/.test(error.message)) {
    delete novoLivro.idioma;
    ({ error } = await supabaseClient.from('livros_autorais').insert(novoLivro));
  }

  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('📚 livro enviado! entra na fila de revisão');
  closeOverlay('enviarLivroAutoralOverlay');
  trocarSubModoAutoral('meus');
};

async function renderMeusLivrosAutorais(usuarioId) {
  const lista = document.getElementById('livrosList');
  const [{ data, error }, { data: perfil }] = await Promise.all([
    supabaseClient.from('livros_autorais').select('*').eq('autor_id', usuarioId).order('criado_em', { ascending: false }),
    supabaseClient.from('usuarios').select('asaas_wallet_id').eq('id', usuarioId).maybeSingle(),
  ]);
  if (error) { lista.innerHTML = estanteAutoralCabecalhoHtml() + `<div class="visitor-lock-note">Não consegui carregar.</div>`; return; }
  window.MEUS_LIVROS_AUTORAIS = data || [];
  lista.innerHTML = estanteAutoralCabecalhoHtml() +
    carteiraAutoralCardHtml(perfil) +
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
        <input id="autoralWalletInput" class="busca-input" style="width:100%; margin-bottom:8px;" placeholder="wallet id do Asaas" value="${wallet}">
        <button class="post-btn" style="width:100%;" onclick="salvarWalletAutoral()">salvar</button>
      </div>`;
}

window.salvarWalletAutoral = async function () {
  const valor = document.getElementById('autoralWalletInput').value.trim();
  if (!valor) { mostrarToast('cola sua wallet id primeiro'); return; }
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session ? sessionData.session.user.id : null;
  if (!usuarioId) return;
  const { error } = await supabaseClient.from('usuarios').update({ asaas_wallet_id: valor }).eq('id', usuarioId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('💰 wallet salva');
};

function cardMeuLivroAutoralHtml(d, i) {
  const preco = (d.preco_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  return `<div class="clube-cap-card" style="flex-direction:column; align-items:flex-start; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center; gap:8px;">
          <div class="clube-cap-info"><div class="clube-cap-valor" style="font-size:16px;">${d.titulo}</div><div class="clube-cap-pagina">R$ ${preco}</div></div>
          <span class="autoral-status-badge ${d.status}">${LABEL_STATUS_AUTORAL[d.status] || d.status}</span>
        </div>
        ${d.status === 'recusado' && d.motivo_recusa ? `<div class="autoral-motivo">motivo: ${d.motivo_recusa}</div><button class="post-btn" style="margin-top:8px;" onclick="reenviarLivroAutoral(${d.id})">corrigir e reenviar</button>` : ''}
      </div>`;
}

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
  const lista = document.getElementById('livrosList');
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
  const lista = document.getElementById('livrosList');
  const { data, error } = await supabaseClient.from('livros_autorais').select('*, usuarios(handle)').eq('status', 'em_revisao').order('criado_em', { ascending: true });
  if (error) { lista.innerHTML = estanteAutoralCabecalhoHtml() + `<div class="visitor-lock-note">Não consegui carregar.</div>`; return; }
  window.FILA_REVISAO_AUTORAL = data || [];
  const configWebhook = `<button class="post-btn" style="width:100%; margin-bottom:12px; background:var(--card-b); color:var(--ink);" onclick="configurarWebhookAsaas()">configurar webhook do Asaas (uma vez só)</button>`;
  lista.innerHTML = estanteAutoralCabecalhoHtml() + configWebhook +
    (data && data.length ? data.map((d, i) => cardRevisaoAutoralHtml(d, i)).join('') : estadoVazio('fila vazia', 'nenhum livro esperando revisão agora'));
}

window.configurarWebhookAsaas = async function () {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
  if (!token) return;
  mostrarToast('configurando...');
  try {
    const resp = await fetch(`${API_BASE}/api/estante-autoral/configurar-webhook`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    const resultado = await resp.json().catch(() => ({}));
    if (!resp.ok) { mostrarToast('❌ ' + (resultado.erro || 'erro ao configurar')); return; }
    mostrarToast('✅ ' + (resultado.mensagem || 'webhook configurado'));
  } catch (e) {
    mostrarToast('❌ erro ao configurar webhook');
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
  if (!token) return;
  const resp = await fetch(`${API_BASE}/api/estante-autoral/revisar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ livroId, aprovado, motivo }),
  });
  const resultado = await resp.json().catch(() => ({}));
  if (!resp.ok) { mostrarToast('❌ ' + (resultado.erro || 'erro')); return; }
  mostrarToast(aprovado ? '✅ aprovado' : '🚫 recusado');
  renderEstanteAutoral();
}
