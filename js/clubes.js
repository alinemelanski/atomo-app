/* js/clubes.js — Clube do livro: criar, detalhe, ferramentas, mural, seguir direto do grupo
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

window.abrirCriarClube = function () {
  document.getElementById('criarClubeNome').value = '';
  document.getElementById('criarClubeDesc').value = '';
  document.getElementById('criarClubePrivado').checked = false;
  document.getElementById('criarClubeOverlay').classList.add('open');
};

window.salvarNovoClube = async function () {
  const nome = document.getElementById('criarClubeNome').value.trim();
  if (!nome) { mostrarToast('❌ dá um nome pro clube'); return; }
  const descricao = document.getElementById('criarClubeDesc').value.trim();
  const privado = document.getElementById('criarClubePrivado').checked;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;

  const { data, error } = await supabaseClient.from('clubes_livro').insert({
    nome, descricao: descricao || null, privado, criador_id: usuarioId,
  }).select().single();

  if (error) { mostrarToast('❌ erro: ' + error.message); return; }

  await supabaseClient.from('clube_membros').insert({ clube_id: data.id, usuario_id: usuarioId, papel: 'admin' });

  mostrarToast('✨ Clube criado!');
  closeOverlay('criarClubeOverlay');
  renderClubes();
};

let clubeAtualId = null;
let clubeLivroAtualCitacao = { titulo: '', autor: '' };
let clubeCapituloAtual = { capitulo: null, pagina: null };
let modoBuscaLivroClube = 'trocar'; // 'trocar' (define o livro atual) | 'sugerir' (roleta)
window.SUGESTOES_CLUBE_ATUAIS = [];
window.abrirClube = async function (i) {
  const c = window.ITENS_CLUBES_ATUAIS[i];
  if (!c) return;
  clubeAtualId = c.id;
  document.getElementById('clubeDetalheOverlay').classList.add('open');
  await renderClubeDetalhe();
};

async function renderClubeDetalhe() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session ? sessionData.session.user.id : null;

  const { data: c, error } = await supabaseClient
    .from('clubes_livro')
    .select('*, clube_membros(usuario_id, papel)')
    .eq('id', clubeAtualId)
    .single();

  if (error || !c) { mostrarToast('❌ não consegui abrir o clube'); closeOverlay('clubeDetalheOverlay'); return; }

  const membros = c.clube_membros || [];
  const souMembro = membros.some(m => m.usuario_id === meuId);
  const souAdmin = c.criador_id === meuId || membros.some(m => m.usuario_id === meuId && m.papel === 'admin');

  document.getElementById('clubeDetalheTitulo').textContent = c.nome;

  clubeLivroAtualCitacao = { titulo: c.livro_titulo || '', autor: c.livro_autor || '' };
  clubeCapituloAtual = { capitulo: c.capitulo_atual || null, pagina: c.pagina_atual || null };
  document.getElementById('clubeDetalheOverflowWrap').style.display = souMembro ? 'flex' : 'none';

  document.getElementById('clubeDetalheLivroAtual').innerHTML = c.livro_titulo ? `
      <div class="clube-hero-mini">
        <div class="clube-hero-mini-capa"${c.livro_capa_url ? ` style="background-image:url('${c.livro_capa_url}');"` : ' style="background:var(--accent-a);"'}></div>
        <div class="clube-hero-mini-info">
          <div class="clube-hero-mini-titulo">${c.livro_titulo}</div>
          ${c.livro_autor ? `<div class="clube-hero-mini-autor">${c.livro_autor}</div>` : ''}
        </div>
      </div>
    ` : `
      <div class="clube-hero-mini sem-livro">nenhum livro definido ainda</div>
    `;

  document.getElementById('clubeDetalheMeta').innerHTML = `
      <div class="clube-meta-pills">
        <span class="clube-meta-pill clube-meta-pill-clicavel" onclick="abrirMembrosClube()" role="button" title="ver os membros">${icone('pessoas',12)} ${membros.length} membro${membros.length === 1 ? '' : 's'}</span>
        ${c.privado ? `<span class="clube-meta-pill">${icone('cadeado',12)} privado</span>` : ''}
      </div>`;

  document.getElementById('clubeDetalheHeaderIcones').style.display = souMembro ? 'flex' : 'none';
  document.getElementById('clubeDetalheHeaderIcones').innerHTML = souMembro
    ? `${souAdmin ? `<button class="dm-header-icon-btn" title="mudar livro atual" onclick="mudarLivroAtualClube()">${icone('livro',15)}</button>` : ''}
         <button class="dm-header-icon-btn" title="criar citação" onclick="abrirCartaoCitacaoClubeAtual()">${icone('citacao',15)}</button>
         ${!c.privado ? `<button class="dm-header-icon-btn" title="convidar pro clube" onclick="abrirCompartilharClube()">${icone('convite',15)}</button>` : ''}`
    : '';

  document.getElementById('clubeDetalheAcoes').innerHTML = souMembro
    ? ''
    : `<button class="post-btn" onclick="entrarNoClube()">entrar no clube</button>`;

  document.getElementById('clubeDetalheComposerWrap').style.display = souMembro ? 'block' : 'none';

  await renderFerramentasClube(c, souMembro, souAdmin, meuId);
  await renderMuralClube();
}

// lista de membros do clube (abre ao tocar no chip "N membros")
window.abrirMembrosClube = async function () {
  document.getElementById('clubeMembrosOverlay').classList.add('open');
  await renderMembrosClube();
};

async function renderMembrosClube() {
  const wrap = document.getElementById('clubeMembrosLista');
  wrap.innerHTML = `<div class="visitor-lock-note">Carregando...</div>`;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session ? sessionData.session.user.id : null;

  await window.carregarSeguindoIds();
  const { data: c } = await supabaseClient.from('clubes_livro').select('criador_id').eq('id', clubeAtualId).single();
  const { data: membros, error } = await supabaseClient
    .from('clube_membros')
    .select('usuario_id, papel, entrou_em')
    .eq('clube_id', clubeAtualId)
    .order('entrou_em', { ascending: true });
  if (error) { wrap.innerHTML = `<div class="visitor-lock-note">Não consegui carregar os membros.</div>`; return; }

  // clube_membros aponta pra auth.users, então os perfis vêm numa segunda consulta
  const ids = (membros || []).map(m => m.usuario_id);
  const perfis = {};
  if (ids.length) {
    const { data: us } = await supabaseClient.from('usuarios').select('id, handle, avatar_url').in('id', ids);
    (us || []).forEach(u => { perfis[u.id] = u; });
  }

  wrap.innerHTML = (membros && membros.length ? membros.map((m, i) => {
    const u = perfis[m.usuario_id];
    const handle = u ? u.handle : 'alguém';
    const ehCriador = !!(c && m.usuario_id === c.criador_id);
    const ehEu = m.usuario_id === meuId;
    const cor = CORES_COMUNIDADE[i % CORES_COMUNIDADE.length];
    return `
        <div class="comunidade-membro-row">
          ${avatarSeguirHtml(m.usuario_id, u && u.avatar_url, handle, 36, cor)}
          <div style="flex:1; min-width:0;">
            <div class="comunidade-membro-handle">@${handle}${ehEu ? ' (você)' : ''}</div>
            <div class="comunidade-membro-papel">${ehCriador ? 'criador' : (m.papel === 'admin' ? 'admin' : 'membro')}</div>
          </div>
        </div>`;
  }).join('') : estadoVazio('sem membros ainda', ''));
}

window.fecharClubeDetalhe = function () {
  document.getElementById('clubeDetalheOverflowMenu').classList.remove('show');
  closeOverlay('clubeDetalheOverlay');
};

window.toggleClubeOverflowMenu = function () {
  document.getElementById('clubeDetalheOverflowMenu').classList.toggle('show');
};

window.enviarFotoClube = async function (el) {
  const input = el || document.getElementById('clubeFotoInput');
  if (!input.files || !input.files[0]) return;
  const arquivo = input.files[0];

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session.user.id;

  const extensao = arquivo.name.split('.').pop();
  const caminho = `${meuId}/clube-${Date.now()}.${extensao}`;

  const { error: erroUpload } = await supabaseClient.storage.from('midia-posts').upload(caminho, arquivo);
  if (erroUpload) { mostrarToast('❌ erro no upload: ' + erroUpload.message); return; }

  const { data } = supabaseClient.storage.from('midia-posts').getPublicUrl(caminho);

  const { error } = await supabaseClient.from('posts').insert({
    autor_id: meuId,
    texto: '',
    tipo: 'Clube',
    privado: false,
    clube_id: clubeAtualId,
    capitulo_livro: clubeCapituloAtual.capitulo || null,
    tem_spoiler: false,
    imagem_url: data.publicUrl,
  });

  input.value = '';
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  renderMuralClube();
};

window.enviarFotoComunidade = async function (el) {
  const input = el || document.getElementById('comunidadeFotoInput');
  if (!input.files || !input.files[0]) return;
  const arquivo = input.files[0];

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session.user.id;

  const extensao = arquivo.name.split('.').pop();
  const caminho = `${meuId}/comunidade-${Date.now()}.${extensao}`;

  const { error: erroUpload } = await supabaseClient.storage.from('midia-posts').upload(caminho, arquivo);
  if (erroUpload) { mostrarToast('❌ erro no upload: ' + erroUpload.message); return; }

  const { data } = supabaseClient.storage.from('midia-posts').getPublicUrl(caminho);

  const { error } = await supabaseClient.from('posts').insert({
    autor_id: meuId,
    texto: '',
    tipo: 'Comunidade',
    privado: false,
    comunidade_estudo_id: comunidadeEstudoAtualId,
    imagem_url: data.publicUrl,
  });

  input.value = '';
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  renderMuralComunidadeEstudo();
};

// abre um clube direto pelo id (usado pelo link de convite), sem depender
// do índice da lista já carregada na tela
window.abrirClubePorId = async function (id) {
  clubeAtualId = id;
  document.getElementById('clubeDetalheOverlay').classList.add('open');
  await renderClubeDetalhe();
};

let compartilharClubeContexto = { texto: '', link: '' };

window.abrirCompartilharClube = async function () {
  const { data: c } = await supabaseClient.from('clubes_livro').select('nome, livro_titulo, privado').eq('id', clubeAtualId).single();
  if (!c) { mostrarToast('❌ não consegui montar o convite'); return; }
  if (c.privado) { mostrarToast('🔒 clubes privados ainda não têm link de convite — chama a pessoa por DM'); return; }

  const link = `${window.location.origin}${window.location.pathname}?clube=${clubeAtualId}`;
  const texto = `📖 bora ler junto? entra no clube "${c.nome}"${c.livro_titulo ? ` — tamo lendo "${c.livro_titulo}"` : ''} no Átomo:`;
  compartilharClubeContexto = { texto, link };

  if (navigator.share) {
    try { await navigator.share({ title: c.nome, text: texto, url: link }); } catch (e) { /* cancelou, sem problema */ }
    return;
  }

  document.getElementById('compartilharClubeResumo').textContent = texto + ' ' + link;
  document.getElementById('compartilharClubeOverlay').classList.add('open');
};

window.compartilharClubeWhatsapp = function () {
  const { texto, link } = compartilharClubeContexto;
  window.open('https://wa.me/?text=' + encodeURIComponent(texto + ' ' + link), '_blank');
};

window.compartilharClubeTelegram = function () {
  const { texto, link } = compartilharClubeContexto;
  window.open('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(texto), '_blank');
};

window.compartilharClubeCopiar = async function () {
  const { texto, link } = compartilharClubeContexto;
  try {
    await navigator.clipboard.writeText(texto + ' ' + link);
    mostrarToast('✨ link copiado! cola onde quiser');
  } catch (e) {
    mostrarToast('não consegui copiar sozinho — copia esse link: ' + link);
  }
  closeOverlay('compartilharClubeOverlay');
};

// se a pessoa chegou aqui por um link de convite de clube (guardado no
// localStorage lá em cima), abre esse clube assim que ela estiver logada
window.verificarConviteClubePendente = async function () {
  const bruto = localStorage.getItem('atomoConviteClube');
  if (!bruto) return;
  let convite;
  try { convite = JSON.parse(bruto); } catch (e) { localStorage.removeItem('atomoConviteClube'); return; }
  const UM_DIA = 24 * 60 * 60 * 1000;
  if (!convite || !convite.id || Date.now() - convite.quando > UM_DIA) { localStorage.removeItem('atomoConviteClube'); return; }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return; // ainda não logou — deixa guardado pra tentar de novo depois
  // cadastro/perguntas de boas-vindas ainda na tela: espera terminar, depois leva pro grupo
  // (quem chama de novo é o fim do onboarding ou a entrada de quem já tinha tudo configurado)
  const onboardEl = document.getElementById('onboardOverlay');
  if (onboardEl && !onboardEl.classList.contains('hide')) return;

  localStorage.removeItem('atomoConviteClube');
  showScreen2('livros');
  trocarModoLivros('clube');
  await abrirClubePorId(convite.id);
};

function sugestaoClubeHtml(s, i, meuId, souAdmin) {
  const podeRemover = souAdmin || s.sugerido_por === meuId;
  return `
      <div class="discover-card" style="display:flex; gap:10px; align-items:center; margin-bottom:8px; animation-delay:${Math.min(i, 6) * 0.05}s;">
        ${s.capa_url
        ? `<img src="${s.capa_url}" alt="" style="width:40px; height:58px; object-fit:cover; border-radius:4px; flex-shrink:0;">`
        : `<div class="capa-vazia-mini" style="width:40px; height:58px;">${icone('livro',18,i,'#fff')}</div>`}
        <div style="min-width:0; flex:1;">
          <div class="discover-title" style="font-size:14px;">${s.titulo}</div>
          ${s.autor ? `<div class="discover-desc">${s.autor}</div>` : ''}
        </div>
        ${podeRemover ? `<div class="post-action" onclick="removerSugestaoClube(${i})">${icone('lixeira',14)}</div>` : ''}
      </div>`;
}

// ---------- ferramentas do clube: card grande com o capitulo/pagina atual (so o admin muda) ----------
function capituloCardHtml(souAdmin) {
  const cap = clubeCapituloAtual.capitulo;
  const pag = clubeCapituloAtual.pagina;
  return `
      <div class="clube-cap-card">
        <div class="clube-cap-info">
          <div class="clube-cap-kicker">${icone('marco',10)} onde o clube está</div>
          <div class="clube-cap-valor">${cap || 'capítulo ainda não definido'}</div>
          ${pag ? `<div class="clube-cap-pagina">página ${pag}</div>` : ''}
        </div>
        ${souAdmin ? `<button class="clube-cap-editar" onclick="abrirEditarCapituloClube()">${icone('editar',15)}</button>` : ''}
      </div>
      <div class="clube-cap-form" id="clubeCapFormWrap" style="display:none;">
        <div class="clube-cap-form-row">
          <input type="text" id="clubeCapInput" class="busca-input" placeholder="capítulo (ex: cap. 5)" style="flex:2;" value="${cap || ''}" />
          <input type="number" id="clubePagInput" class="busca-input" placeholder="página" style="flex:1;" value="${pag || ''}" />
        </div>
        <button class="post-btn" onclick="salvarCapituloClube()">avançar pra esse capítulo</button>
      </div>`;
}

window.abrirEditarCapituloClube = function () {
  const f = document.getElementById('clubeCapFormWrap');
  f.style.display = f.style.display === 'none' ? 'flex' : 'none';
};

window.salvarCapituloClube = async function () {
  const capitulo = document.getElementById('clubeCapInput').value.trim();
  const paginaTxt = document.getElementById('clubePagInput').value.trim();
  const pagina = paginaTxt ? parseInt(paginaTxt, 10) : null;
  const { error } = await supabaseClient.from('clubes_livro')
    .update({ capitulo_atual: capitulo || null, pagina_atual: pagina })
    .eq('id', clubeAtualId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  clubeCapituloAtual = { capitulo: capitulo || null, pagina };
  mostrarToast('📖 capítulo atualizado');
  document.getElementById('clubeDetalheFerramentas').innerHTML = capituloCardHtml(true);
};

async function renderFerramentasClube(c, souMembro, souAdmin, meuId) {
  const wrap = document.getElementById('clubeDetalheFerramentas');
  if (!souMembro) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = capituloCardHtml(souAdmin);
}

window.removerSugestaoClube = async function (i) {
  const s = (window.SUGESTOES_CLUBE_ATUAIS || [])[i];
  if (!s) return;
  await supabaseClient.from('clube_sugestoes_livro').delete().eq('id', s.id);
  renderClubeDetalhe();
};

window.girarRoletaClube = async function () {
  const lista = window.SUGESTOES_CLUBE_ATUAIS || [];
  if (lista.length < 1) { mostrarToast('❌ precisa de pelo menos 1 sugestão pra girar'); return; }
  const elResultado = document.getElementById('roletaResultadoTexto');
  const btn = document.getElementById('btnGirarRoleta');
  if (btn) btn.disabled = true;

  const vencedorIdx = Math.floor(Math.random() * lista.length);
  const totalPassos = 14 + vencedorIdx + Math.floor(Math.random() * lista.length);

  await new Promise(resolve => {
    let passo = 0;
    let atraso = 55;
    function girar() {
      const idx = passo % lista.length;
      if (elResultado) elResultado.innerHTML = `<span style="display:inline-flex; width:13px; height:13px; vertical-align:-2px; margin-right:4px; animation:pull-spin .5s linear infinite;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 8H15a3 3 0 0 1 3 3v1.2"/><path d="M9.3 5 6.5 8l2.8 3"/><path d="M17.5 16H9a3 3 0 0 1-3-3v-1.2"/><path d="M14.7 19l2.8-3-2.8-3"/></svg></span>${lista[idx].titulo}`;
      passo++;
      atraso += 14; // desacelera a cada passo, como uma roleta de verdade
      if (passo < totalPassos) setTimeout(girar, atraso);
      else {
        if (elResultado) elResultado.textContent = `🎉 sorteado: ${lista[vencedorIdx].titulo}`;
        resolve();
      }
    }
    girar();
  });

  const vencedor = lista[vencedorIdx];
  const { error } = await supabaseClient.from('clubes_livro').update({
    livro_titulo: vencedor.titulo,
    livro_autor: vencedor.autor || null,
    livro_capa_url: vencedor.capa_url || null,
    livro_google_id: vencedor.google_id || null,
  }).eq('id', clubeAtualId);
  if (error) { mostrarToast('❌ erro ao definir o livro: ' + error.message); if (btn) btn.disabled = false; return; }

  await supabaseClient.from('clube_sugestoes_livro').delete().eq('clube_id', clubeAtualId);
  mostrarToast(`📖 o clube vai ler: ${vencedor.titulo}`);
  renderClubeDetalhe();
};

window.abrirSugerirLivroRoleta = function () {
  modoBuscaLivroClube = 'sugerir';
  document.getElementById('buscaLivroClubeTitulo').textContent = 'Sugerir livro pra roleta';
  document.getElementById('buscaGuiaClubeInput').value = '';
  document.getElementById('guiaClubeResultados').innerHTML = '';
  document.getElementById('buscaLivroClubeOverlay').classList.add('open');
};

window.entrarNoClube = async function () {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;
  const { error } = await supabaseClient.from('clube_membros').insert({ clube_id: clubeAtualId, usuario_id: usuarioId, papel: 'membro' });
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('🎉 você entrou no clube');
  renderClubeDetalhe();
};

window.sairDoClube = async function () {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;
  await supabaseClient.from('clube_membros').delete().eq('clube_id', clubeAtualId).eq('usuario_id', usuarioId);
  mostrarToast('você saiu do clube');
  fecharClubeDetalhe();
  renderClubes();
};

window.mudarLivroAtualClube = function () {
  modoBuscaLivroClube = 'trocar';
  document.getElementById('buscaLivroClubeTitulo').textContent = 'Definir livro atual';
  document.getElementById('buscaGuiaClubeInput').value = '';
  document.getElementById('guiaClubeResultados').innerHTML = '';
  document.getElementById('buscaLivroClubeOverlay').classList.add('open');
};

let debounceGuiaClube = null;
window.aoDigitarGuiaClube = function () {
  clearTimeout(debounceGuiaClube);
  debounceGuiaClube = setTimeout(async () => {
    const termo = document.getElementById('buscaGuiaClubeInput').value.trim();
    const resultadosEl = document.getElementById('guiaClubeResultados');
    if (!termo) { resultadosEl.innerHTML = ''; return; }
    resultadosEl.innerHTML = skeletonCardsHtml(3);
    try {
      // somenteGoogle=1: aqui a gente só usa mesmo os resultados do Google Books
      // (filtro logo abaixo), então nem pede pro servidor buscar em Open Library
      // e Gutendex — a busca fica bem mais rápida
      const resp = await fetch(`${API_BASE}/api/livros-em-destaque?q=${encodeURIComponent(termo)}&somenteGoogle=1`);
      const dados = await resp.json();
      const itensGoogle = (dados.items || []).filter(l => l.fonte === 'Google Books');
      window.GUIA_CLUBE_ATUAL = itensGoogle;
      resultadosEl.innerHTML = itensGoogle.length
        ? itensGoogle.map((l, i) => `
              <div class="discover-card" style="cursor:pointer; display:flex; gap:10px; align-items:center;" onclick="escolherLivroClube(${i})">
                ${l.capa ? `<img src="${l.capa}" alt="" style="width:40px; height:58px; object-fit:cover; border-radius:4px;">` : ''}
                <div style="min-width:0;"><div class="discover-title" style="font-size:14px;">${l.volumeInfo.title}</div><div class="discover-desc">${l.autor || ''}</div></div>
              </div>`).join('')
        : `<div class="visitor-lock-note">Nada encontrado.</div>`;
    } catch (e) {
      resultadosEl.innerHTML = `<div class="visitor-lock-note">Erro na busca.</div>`;
    }
  }, 400);
};

window.escolherLivroClube = async function (i) {
  const l = window.GUIA_CLUBE_ATUAL[i];
  if (!l) return;

  if (modoBuscaLivroClube === 'sugerir') {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const meuId = sessionData.session.user.id;
    const { error } = await supabaseClient.from('clube_sugestoes_livro').insert({
      clube_id: clubeAtualId,
      sugerido_por: meuId,
      titulo: l.volumeInfo.title,
      autor: l.autor || null,
      capa_url: l.capa || null,
      google_id: l.googleId || null,
    });
    if (error) { mostrarToast('❌ erro: ' + error.message); return; }
    mostrarToast('🎲 sugestão adicionada pra roleta');
    closeOverlay('buscaLivroClubeOverlay');
    renderClubeDetalhe();
    return;
  }

  const { error } = await supabaseClient.from('clubes_livro').update({
    livro_titulo: l.volumeInfo.title,
    livro_autor: l.autor || null,
    livro_capa_url: l.capa || null,
    livro_google_id: l.googleId || null,
  }).eq('id', clubeAtualId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('📖 livro do clube atualizado');
  closeOverlay('buscaLivroClubeOverlay');
  renderClubeDetalhe();
};

// salas por capítulo (spoiler-free): filtra a discussão pelo trecho marcado
// em cada post, e esconde posts marcados como spoiler até a pessoa tocar
let postsMuralClubeAtuais = [];
let filtroCapituloMuralClube = 'geral';
let spoilersRevelados = new Set();
let muralClubeMeuId = null;

window.trocarFiltroMuralClube = function (valor) {
  filtroCapituloMuralClube = valor;
  renderizarListaMuralClube();
};

window.revelarSpoilerMural = function (postId) {
  spoilersRevelados.add(postId);
  renderizarListaMuralClube();
};

function capituloChipsHtml(posts, ativo) {
  const vistos = new Set();
  const capitulos = [];
  posts.forEach(p => { if (p.capitulo_livro && !vistos.has(p.capitulo_livro)) { vistos.add(p.capitulo_livro); capitulos.push(p.capitulo_livro); } });
  const chips = [`<div class="feed-modo-chip${ativo === 'geral' ? ' on' : ''}" onclick="trocarFiltroMuralClube('geral')">geral</div>`]
    .concat(capitulos.map(c => `<div class="feed-modo-chip${ativo === c ? ' on' : ''}" onclick="trocarFiltroMuralClube(${JSON.stringify(c).replace(/"/g, "'")})">${c}</div>`))
    .concat([`<div class="feed-modo-chip${ativo === 'tudo' ? ' on' : ''}" onclick="trocarFiltroMuralClube('tudo')">tudo</div>`]);
  return `<div class="feed-modo-row" style="margin-bottom:8px; flex-wrap:wrap;">${chips.join('')}</div>`;
}

// cor consistente por pessoa (hash simples do id), pra distinguir quem
// escreveu o que num grupo com varias pessoas digitando
function corIndicePorUsuario(id) {
  if (!id) return 0;
  let soma = 0;
  for (let i = 0; i < id.length; i++) soma += id.charCodeAt(i);
  return soma % 6;
}

// ---------- seguir direto do grupo: + na foto de quem ainda não sigo ----------
window.SEGUINDO_IDS = new Set();
window.carregarSeguindoIds = async function () {
  const { data: s } = await supabaseClient.auth.getSession();
  if (!s.session) return;
  const { data } = await supabaseClient.from('seguidores').select('seguido_id').eq('seguidor_id', s.session.user.id);
  window.SEGUINDO_IDS = new Set((data || []).map(r => r.seguido_id));
};

window.avatarSeguirHtml = function (userId, avatarUrl, handle, tam, fundoFallback) {
  const iniciais = String(handle || '?').replace('@', '').slice(0, 2).toUpperCase();
  const mostrarMais = !!userId && userId !== window.MEU_USUARIO_ID && !window.SEGUINDO_IDS.has(userId);
  let estilo = '';
  if (avatarUrl) estilo = "background-image:url('" + avatarUrl + "');background-size:cover;background-position:center;color:transparent;";
  else if (fundoFallback) estilo = 'background:' + fundoFallback + ';color:#fff;';
  return '<span class="avatar-seguir" data-uid="' + userId + '" style="width:' + tam + 'px;height:' + tam + 'px;">'
    + '<span class="avatar-seguir-foto" style="' + estilo + (tam >= 30 ? 'font-size:12px;' : '') + '">' + (avatarUrl ? '' : iniciais) + '</span>'
    + (mostrarMais ? '<button class="avatar-seguir-mais" aria-label="seguir @' + handle + '" onclick="event.stopPropagation(); seguirDoGrupo(\'' + userId + '\', this)">+</button>' : '')
    + '</span>';
};

window.seguirDoGrupo = async function (id, btn) {
  vibrar(10);
  btn.classList.add('ok'); btn.textContent = '✓';
  const { data: s } = await supabaseClient.auth.getSession();
  if (!s.session) return;
  const meuId = s.session.user.id;
  const { error } = await supabaseClient.from('seguidores').insert({ seguidor_id: meuId, seguido_id: id });
  if (error) { btn.classList.remove('ok'); btn.textContent = '+'; mostrarToast('❌ erro: ' + error.message); return; }
  window.SEGUINDO_IDS.add(id);
  mostrarToast('💛 Agora você segue essa pessoa');
  notificarNovoSeguidor(id, meuId);
  // o + some de todas as fotos dessa pessoa que estiverem na tela
  document.querySelectorAll('.avatar-seguir[data-uid="' + id + '"] .avatar-seguir-mais').forEach(b => {
    b.classList.add('ok'); b.textContent = '✓';
    setTimeout(() => b.remove(), 900);
  });
  if (typeof carregarAmigosEsugestoes === 'function') carregarAmigosEsugestoes();
};

function postClubeHtml(p) {
  const handle = p.usuarios ? p.usuarios.handle : 'alguem';
  const corpo = (p.texto || '').replace(/</g, '&lt;');
  const revelado = spoilersRevelados.has(p.id);
  const ehOwn = p.autor_id === muralClubeMeuId;
  const corIdx = corIndicePorUsuario(p.autor_id);
  const imagem = p.imagem_url ? `<img src="${p.imagem_url}" style="max-width:170px; border-radius:12px; display:block; ${corpo ? 'margin-bottom:6px;' : ''}" />` : '';
  const audio = p.audio_url ? vozBubbleHtml({ id: 'mural-' + p.id, texto: p.audio_url }) : '';
  const temSoMidia = !corpo && (p.imagem_url || p.audio_url);
  const conteudo = p.tem_spoiler && !revelado
    ? `<span style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;" onclick="revelarSpoilerMural('${p.id}')">${icone('alerta',13)} esse post tem spoiler — toca pra ver</span>`
    : audio + imagem + corpo;
  return `
      <div class="clube-msg-row ${ehOwn ? 'own' : 'other'}">
        ${!ehOwn ? `<div class="clube-msg-autor cor-${corIdx}" style="display:flex; align-items:center; gap:7px;">${avatarSeguirHtml(p.autor_id, p.usuarios && p.usuarios.avatar_url, handle, 24)}<span>@${handle}</span></div>` : ''}
        <div class="clube-msg-bolha${!ehOwn ? ' cor-' + corIdx : ''}"${temSoMidia && p.imagem_url ? ' style="padding:4px;"' : ''}>${conteudo}</div>
        <div class="clube-msg-meta">${formatarTempoRelativo(p.criado_em)}${p.capitulo_livro ? ` · ${p.capitulo_livro}` : ''}</div>
      </div>`;
}

function renderizarListaMuralClube() {
  const wrap = document.getElementById('clubeDetalheMural');
  const posts = postsMuralClubeAtuais;
  const temCapitulos = posts.some(p => p.capitulo_livro);

  const filtrados = filtroCapituloMuralClube === 'tudo' ? posts
    : filtroCapituloMuralClube === 'geral' ? posts.filter(p => !p.capitulo_livro)
    : posts.filter(p => p.capitulo_livro === filtroCapituloMuralClube);

  const chipsHtml = temCapitulos ? capituloChipsHtml(posts, filtroCapituloMuralClube) : '';
  wrap.innerHTML = chipsHtml + (filtrados.length
    ? filtrados.map(p => postClubeHtml(p)).join('')
    : `<div class="dm-empty-state">${icone('comentar',34)}<div class="titulo">${temCapitulos && filtroCapituloMuralClube !== 'tudo' ? 'Nada por aqui ainda' : 'Comece a conversa'}</div><div class="sub">${temCapitulos && filtroCapituloMuralClube !== 'tudo' ? 'ninguém comentou esse trecho ainda.' : 'manda a primeira mensagem pro grupo do clube.'}</div></div>`);
  wrap.scrollTop = wrap.scrollHeight;
}

async function renderMuralClube() {
  const wrap = document.getElementById('clubeDetalheMural');
  wrap.innerHTML = `<div class="visitor-lock-note">Carregando...</div>`;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  muralClubeMeuId = sessionData.session ? sessionData.session.user.id : null;
  await window.carregarSeguindoIds();
  const { data, error } = await supabaseClient
    .from('posts')
    .select('*, usuarios!autor_id(handle, avatar_url)')
    .eq('clube_id', clubeAtualId)
    .order('criado_em', { ascending: true });

  if (error) { wrap.innerHTML = `<div class="visitor-lock-note">Não consegui carregar o mural.</div>`; return; }

  postsMuralClubeAtuais = data || [];
  filtroCapituloMuralClube = 'tudo';
  spoilersRevelados = new Set();
  renderizarListaMuralClube();
}

window.publicarNoMuralClube = async function () {
  const texto = document.getElementById('clubeComposerText').value.trim();
  if (!texto) return;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;

  const { error } = await supabaseClient.from('posts').insert({
    autor_id: usuarioId,
    texto,
    tipo: 'Clube',
    privado: false,
    clube_id: clubeAtualId,
    capitulo_livro: clubeCapituloAtual.capitulo || null,
  });

  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  document.getElementById('clubeComposerText').value = '';
  renderMuralClube();
};
