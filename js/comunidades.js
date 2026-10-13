/* js/comunidades.js — Comunidades de estudo: lista, criar, detalhe, membros, ranking, convite, mural
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- comunidades (29/09 — real agora: clube do livro continua com
// suas próprias tabelas/telas de sempre (clubes_livro/clube_membros, sem
// nenhuma mudança); comunidades de estudo usam as tabelas novas
// comunidades_estudo/comunidade_estudo_membros, e o mural reaproveita a
// tabela posts igual o clube já fazia com clube_id, só que com a coluna
// comunidade_estudo_id. A sala de call continua visual/mock por enquanto
// — fica pra quando ela decidir o provedor de áudio) ----------
const CORES_COMUNIDADE = ['var(--accent-a)', 'var(--accent-b)', 'var(--yellow)', 'var(--pink)', 'var(--ink-dim)'];
const CATEGORIAS_COMUNIDADE_ESTUDO = [
  { valor: 'vestibular', label: '🎓 vestibular' },
  { valor: 'concurso', label: '📝 concurso' },
  { valor: 'idioma', label: '🗣 idioma' },
  { valor: 'filosofia', label: '💭 filosofia' },
  { valor: 'geral', label: '📚 geral' },
];

function iniciaisNome(nome) { return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(); }

window.ITENS_COMUNIDADES_ESTUDO_ATUAIS = [];

async function renderComunidades() {
  const lista = document.getElementById('livrosList');
  lista.innerHTML = skeletonCardsHtml(3);

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session ? sessionData.session.user.id : null;

  const { data: estudos, error } = await supabaseClient
    .from('comunidades_estudo')
    .select('*, comunidade_estudo_membros(usuario_id)')
    .order('criado_em', { ascending: false });

  if (error) {
    lista.innerHTML = `<div class="visitor-lock-note">Não consegui carregar as comunidades agora${error.message.includes('comunidades_estudo') ? ' — a tabela ainda não existe no banco, falta rodar a migração' : ''}.</div>`;
    return;
  }

  window.ITENS_COMUNIDADES_ESTUDO_ATUAIS = estudos || [];
  const totalComunidades = (estudos || []).length;
  const minhas = (estudos || []).filter(c => (c.comunidade_estudo_membros || []).some(m => m.usuario_id === meuId)).length;

  lista.innerHTML = `
      <div class="clube-lista-wrap">
        <svg class="clube-watermark" viewBox="0 0 100 100">
          <path d="M12 3 3 7.5 12 12l9-4.5Z"/><path d="M3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
        </svg>
        <div class="clube-kicker">gente estudando junto</div>
        <div class="clube-titulo-grande">Comunidades</div>
        <div class="clube-sub-grande">${totalComunidades} comunidade${totalComunidades === 1 ? '' : 's'}${minhas ? ` · você participa de ${minhas}` : ''}</div>
        <button class="clube-criar-btn" onclick="abrirCriarComunidade()">criar comunidade</button>
        ${totalComunidades
        ? estudos.map((c, i) => cardComunidadeHtml(c, i, meuId)).join('')
        : estadoVazio('nenhuma comunidade ainda', 'crie a primeira — vestibular, concurso, idioma, filosofia...', 'criar comunidade', 'abrirCriarComunidade()')}
      </div>`;
}

function cardComunidadeHtml(c, i, meuId) {
  const cor = CORES_COMUNIDADE[i % CORES_COMUNIDADE.length];
  const setaOuCadeado = (privado) => privado
    ? icone('cadeado', 13)
    : `<span class="icon-svg" style="width:15px;height:15px; color:var(--ink-faint);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>`;

  const membros = c.comunidade_estudo_membros || [];
  const souMembro = membros.some(m => m.usuario_id === meuId);
  const categoria = CATEGORIAS_COMUNIDADE_ESTUDO.find(cat => cat.valor === c.categoria);
  const capaHtml = c.capa_url
    ? `<img src="${c.capa_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : icone('comunidades', 18, i, '#fff');
  const contagem = formatarContagemComunidade(c.meta_prazo);
  return `
      <div class="comunidade-card${c.capa_url ? ' com-capa' : ''}" style="animation-delay:${Math.min(i, 6) * 0.05}s;${c.capa_url ? ` --capa:url('${c.capa_url}');` : ''}" onclick="abrirComunidadeDetalhe(${i})">
        <div class="comunidade-card-top">
          <div class="comunidade-icone" style="${c.capa_url ? '' : `background:${cor}`}">${capaHtml}</div>
          <div style="flex:1; min-width:0;">
            <span class="comunidade-badge">${categoria ? categoria.label : c.categoria}</span>
            <div class="comunidade-titulo">${c.titulo}</div>
          </div>
        </div>
        <div class="comunidade-desc">${c.descricao || 'sem descrição ainda'}</div>
        <div class="comunidade-footer">
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            <span class="comunidade-membros-txt" style="margin-left:0;">${icone('pessoas', 12)} ${membros.length}${souMembro ? ' · você' : ''}</span>
            ${contagem ? `<span class="comunidade-prazo-txt">${icone('relogio', 11)} ${contagem}</span>` : ''}
          </div>
          ${setaOuCadeado(c.privada)}
        </div>
      </div>`;
}

// ---------- criar comunidade de estudo (o clube do livro tem seu próprio
// botão de criar, separado, na aba "clube do livro") ----------
let categoriaComunidadeEstudoSelecionada = CATEGORIAS_COMUNIDADE_ESTUDO[0].valor;

let arquivoCapaComunidade = null;

window.previewCapaComunidade = function (el) {
  if (!el.files || !el.files[0]) return;
  arquivoCapaComunidade = el.files[0];
  const url = URL.createObjectURL(arquivoCapaComunidade);
  const img = document.getElementById('comunidadeCapaPreview');
  img.src = url;
  img.style.display = 'block';
  document.getElementById('comunidadeCapaPickerVazio').style.display = 'none';
};

// ---------- seletor de data proprio (calendario com a cara do app, no lugar do <input type="date"> generico do navegador) ----------
let calendarioPickerEstado = { targetId: null, ano: 0, mes: 0, selecionado: null };

function fmtDataISOLocal(ano, mes, dia) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function atualizarBotaoDataPicker(targetId) {
  const input = document.getElementById(targetId);
  const txt = document.getElementById(targetId + 'Txt');
  if (!input || !txt) return;
  const nomesMesCurto = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  if (input.value) {
    const d = new Date(input.value + 'T00:00:00');
    txt.textContent = `${d.getDate()} de ${nomesMesCurto[d.getMonth()]}. de ${d.getFullYear()}`;
    txt.closest('.data-picker-btn').classList.add('preenchido');
  } else {
    txt.textContent = txt.dataset.placeholder || 'escolher data';
    txt.closest('.data-picker-btn').classList.remove('preenchido');
  }
}

window.abrirCalendarioPicker = function (targetId) {
  const input = document.getElementById(targetId);
  const valor = input ? input.value : '';
  const base = valor ? new Date(valor + 'T00:00:00') : new Date();
  calendarioPickerEstado = { targetId, ano: base.getFullYear(), mes: base.getMonth(), selecionado: valor || null };
  renderCalendarioPicker();
  document.getElementById('calendarioPopupOverlay').classList.add('show');
};

window.fecharCalendarioPicker = function () {
  document.getElementById('calendarioPopupOverlay').classList.remove('show');
};

window.calendarioMudarMes = function (delta) {
  let { ano, mes } = calendarioPickerEstado;
  mes += delta;
  if (mes < 0) { mes = 11; ano--; }
  if (mes > 11) { mes = 0; ano++; }
  calendarioPickerEstado.ano = ano;
  calendarioPickerEstado.mes = mes;
  renderCalendarioPicker();
};

function renderCalendarioPicker() {
  const { ano, mes, selecionado } = calendarioPickerEstado;
  const nomesMes = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  document.getElementById('calendarioPopupTitulo').textContent = `${nomesMes[mes]} de ${ano}`;

  const offsetInicio = new Date(ano, mes, 1).getDay();
  const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
  const totalDiasMesAnterior = new Date(ano, mes, 0).getDate();
  const hoje = new Date();
  const hojeISO = fmtDataISOLocal(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  let html = '';
  for (let i = offsetInicio - 1; i >= 0; i--) html += `<div class="calendario-dia fora">${totalDiasMesAnterior - i}</div>`;
  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const iso = fmtDataISOLocal(ano, mes, dia);
    let classes = 'calendario-dia';
    if (iso === hojeISO) classes += ' hoje';
    if (iso === selecionado) classes += ' selecionado';
    html += `<div class="${classes}" onclick="calendarioEscolherDia(${dia})">${dia}</div>`;
  }
  const restante = (7 - ((offsetInicio + totalDiasMes) % 7)) % 7;
  for (let i = 1; i <= restante; i++) html += `<div class="calendario-dia fora">${i}</div>`;

  document.getElementById('calendarioPopupGrade').innerHTML = html;
}

window.calendarioEscolherDia = function (dia) {
  const { ano, mes, targetId } = calendarioPickerEstado;
  const iso = fmtDataISOLocal(ano, mes, dia);
  const input = document.getElementById(targetId);
  input.value = iso;
  atualizarBotaoDataPicker(targetId);
  fecharCalendarioPicker();
};

window.calendarioLimpar = function () {
  const input = document.getElementById(calendarioPickerEstado.targetId);
  input.value = '';
  atualizarBotaoDataPicker(calendarioPickerEstado.targetId);
  fecharCalendarioPicker();
};

window.calendarioIrHoje = function () {
  const hoje = new Date();
  const iso = fmtDataISOLocal(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const input = document.getElementById(calendarioPickerEstado.targetId);
  input.value = iso;
  atualizarBotaoDataPicker(calendarioPickerEstado.targetId);
  fecharCalendarioPicker();
};

window.abrirCriarComunidade = function () {
  document.getElementById('criarComunidadeEstudoTitulo').value = '';
  document.getElementById('criarComunidadeEstudoDesc').value = '';
  document.getElementById('criarComunidadeEstudoPrivada').checked = false;
  document.getElementById('criarComunidadeEstudoPrazo').value = '';
  atualizarBotaoDataPicker('criarComunidadeEstudoPrazo');
  arquivoCapaComunidade = null;
  document.getElementById('comunidadeCapaInput').value = '';
  document.getElementById('comunidadeCapaPreview').style.display = 'none';
  document.getElementById('comunidadeCapaPreview').removeAttribute('src');
  document.getElementById('comunidadeCapaPickerVazio').style.display = 'flex';
  categoriaComunidadeEstudoSelecionada = CATEGORIAS_COMUNIDADE_ESTUDO[0].valor;
  document.querySelectorAll('.categoria-comunidade-chip').forEach((el, idx) => el.classList.toggle('on', idx === 0));
  document.getElementById('criarComunidadeEstudoOverlay').classList.add('open');
};

// faltam N dias / é hoje / prazo já passou -- usado no card e na tela da comunidade
function formatarContagemComunidade(prazo) {
  if (!prazo) return '';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(prazo); alvo.setHours(0, 0, 0, 0);
  const dias = Math.round((alvo - hoje) / 86400000);
  if (dias > 1) return `faltam ${dias} dias`;
  if (dias === 1) return 'falta 1 dia';
  if (dias === 0) return 'é hoje!';
  return 'prazo já passou';
}

window.escolherCategoriaComunidadeEstudo = function (valor, el) {
  categoriaComunidadeEstudoSelecionada = valor;
  document.querySelectorAll('.categoria-comunidade-chip').forEach(e => e.classList.remove('on'));
  el.classList.add('on');
};

window.salvarNovaComunidadeEstudo = async function () {
  const titulo = document.getElementById('criarComunidadeEstudoTitulo').value.trim();
  if (!titulo) { mostrarToast('❌ dá um nome pra comunidade'); return; }
  const descricao = document.getElementById('criarComunidadeEstudoDesc').value.trim();
  const privada = document.getElementById('criarComunidadeEstudoPrivada').checked;
  const prazoValor = document.getElementById('criarComunidadeEstudoPrazo').value;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;

  const capaUrl = await subirFotoParaStorage(usuarioId, arquivoCapaComunidade);

  const { data, error } = await supabaseClient.from('comunidades_estudo').insert({
    titulo, descricao: descricao || null, categoria: categoriaComunidadeEstudoSelecionada, privada, criador_id: usuarioId,
    meta_prazo: prazoValor || null, capa_url: capaUrl,
  }).select().single();

  if (error) {
    mostrarToast('❌ erro: ' + error.message + (error.message.includes('comunidades_estudo') ? ' — falta rodar a migração do banco' : ''));
    return;
  }

  await supabaseClient.from('comunidade_estudo_membros').insert({ comunidade_id: data.id, usuario_id: usuarioId, papel: 'admin' });

  mostrarToast('✨ Comunidade criada!');
  closeOverlay('criarComunidadeEstudoOverlay');
  renderComunidades();
};

// ---------- detalhe de comunidade de estudo ----------
let comunidadeEstudoAtualId = null;
let comunidadeTemaAtual = { tema: null };

window.abrirComunidadeDetalhe = async function (i) {
  const c = window.ITENS_COMUNIDADES_ESTUDO_ATUAIS[i];
  if (!c) return;
  comunidadeEstudoAtualId = c.id;
  document.getElementById('comunidadeDetalheOverlay').classList.add('open');
  await renderComunidadeEstudoDetalhe();
};

// abre uma comunidade direto pelo id (usado pelo link de convite), sem
// depender do índice da lista já carregada na tela
window.abrirComunidadePorId = async function (id) {
  comunidadeEstudoAtualId = id;
  document.getElementById('comunidadeDetalheOverlay').classList.add('open');
  await renderComunidadeEstudoDetalhe();
};

// ---------- foto do grupo (capa) ----------
// PRA APRENDER: a foto vai pro Storage do Supabase (mesma função que sobe as
// fotos dos posts) e o link dela é gravado em comunidades_estudo.capa_url.
// A policy "comunidades editar" (RLS) só deixa quem administra fazer isso.
let comunidadeSouAdminAtual = false;
window.tocarFotoComunidade = function () {
  if (!comunidadeSouAdminAtual) return; // pra quem não administra, a foto é só pra ver
  document.getElementById('comunidadeFotoGrupoInput').click();
};
window.trocarFotoComunidade = async function (input) {
  const arquivo = input.files && input.files[0];
  input.value = '';
  if (!arquivo) return;
  const avatar = document.getElementById('comunidadeDetalheAvatar');
  avatar.style.backgroundImage = `url('${URL.createObjectURL(arquivo)}')`; // mostra na hora, antes de terminar de subir
  avatar.innerHTML = ''; avatar.classList.remove('sem-foto');
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const url = await subirFotoParaStorage(sessionData.session.user.id, arquivo);
  if (!url) return; // subirFotoParaStorage já mostra o erro
  const { error } = await supabaseClient.from('comunidades_estudo').update({ capa_url: url }).eq('id', comunidadeEstudoAtualId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('📷 foto do grupo atualizada');
  if (typeof renderComunidades === 'function') renderComunidades(); // o card na lista ganha a cor da foto
};

async function renderComunidadeEstudoDetalhe() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session ? sessionData.session.user.id : null;

  const { data: c, error } = await supabaseClient
    .from('comunidades_estudo')
    .select('*, comunidade_estudo_membros(usuario_id, papel)')
    .eq('id', comunidadeEstudoAtualId)
    .single();

  if (error || !c) { mostrarToast('❌ não consegui abrir essa comunidade'); closeOverlay('comunidadeDetalheOverlay'); return; }

  const membros = c.comunidade_estudo_membros || [];
  const souMembro = membros.some(m => m.usuario_id === meuId);
  const souAdmin = c.criador_id === meuId || membros.some(m => m.usuario_id === meuId && m.papel === 'admin');
  const categoria = CATEGORIAS_COMUNIDADE_ESTUDO.find(cat => cat.valor === c.categoria);
  comunidadeTemaAtual = { tema: c.tema_atual || null, prazo: c.meta_prazo || null, temporizador: c.temporizador_ativo !== false };
  const contagemDetalhe = formatarContagemComunidade(c.meta_prazo);

  document.getElementById('comunidadeDetalheTitulo').textContent = c.titulo;
  document.getElementById('comunidadeDetalheSub').textContent = `${membros.length} membro${membros.length === 1 ? '' : 's'} · ${c.privada ? 'comunidade privada' : 'comunidade pública'}`;
  document.getElementById('comunidadeDetalheOverflowWrap').style.display = souMembro ? 'flex' : 'none';
  document.getElementById('comunidadeMenuEditarPrazo').style.display = souAdmin ? 'block' : 'none';

  // a capa agora é a FOTO REDONDA do grupo no topo (ao lado do ⋯), não mais uma faixa grande
  document.getElementById('comunidadeDetalheCapaWrap').innerHTML = '';
  comunidadeSouAdminAtual = souAdmin;
  document.getElementById('comunidadeMenuTrocarFoto').style.display = souAdmin ? 'block' : 'none';
  const indiceCor = (window.ITENS_COMUNIDADES_ESTUDO_ATUAIS || []).findIndex(x => x.id === c.id);
  const avatar = document.getElementById('comunidadeDetalheAvatar');
  avatar.style.backgroundImage = c.capa_url ? `url('${c.capa_url}')` : '';
  avatar.style.backgroundColor = c.capa_url ? '' : CORES_COMUNIDADE[Math.max(0, indiceCor) % CORES_COMUNIDADE.length];
  avatar.innerHTML = c.capa_url ? '' : icone('comunidades', 16, 0, '#fff');
  // quem administra e ainda não pôs foto vê uma camerazinha (convite pra colocar)
  avatar.classList.toggle('pode-trocar', souAdmin);
  avatar.classList.toggle('sem-foto', !c.capa_url);

  document.getElementById('comunidadeDetalheMetaChips').innerHTML = `
      <div class="comunidade-meta-chip">${categoria ? categoria.label : c.categoria}</div>
      ${c.descricao ? `<div class="comunidade-meta-chip">${c.descricao}</div>` : ''}`;

  document.getElementById('comunidadeDetalheHeaderIcones').style.display = souMembro ? 'flex' : 'none';
  document.getElementById('comunidadeDetalheHeaderIcones').innerHTML = souMembro
    ? `${(contagemDetalhe && comunidadeTemaAtual.temporizador) ? `<div class="dm-header-icon-btn dm-header-pill" title="${contagemDetalhe}">${icone('relogio',13)} ${contagemDetalhe.replace(/^(faltam?|falta)\s*/i, '')}</div>` : ''}
`
    : '';

  window.COMUNIDADE_ATUAL_PRIVADA = !!c.privada;
  document.getElementById('comunidadeDetalheAcoes').innerHTML = souMembro
    ? ''
    // kit item 7: "Entrar" é a ação principal (terracota cheia); "Ver membros" é apoio (contorno sálvia).
    // .botoes-par = os dois dividem a largura meio a meio (mesmo tamanho sempre)
    : `<div class="botoes-par">
         <button class="btn-acao btn-acao-terracota" onclick="entrarNaComunidadeEstudo()">${icone('entrar', 18)}Entrar na comunidade</button>
         <button class="btn-acao btn-acao-contorno-salvia" onclick="abrirMembrosComunidade()">${icone('pessoas', 18)}Ver membros</button>
       </div>`;

  document.getElementById('comunidadeDetalheFerramentas').innerHTML = souMembro
    ? temaComunidadeCardHtml(souAdmin) + prazoComunidadeCardHtml() + rankingComunidadeCardHtml()
    : '';

  document.getElementById('comunidadeDetalheComposerWrap').style.display = souMembro ? 'block' : 'none';

  await renderMuralComunidadeEstudo();
}

window.entrarNaComunidadeEstudo = async function () {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;
  const { error } = await supabaseClient.from('comunidade_estudo_membros').insert({ comunidade_id: comunidadeEstudoAtualId, usuario_id: usuarioId, papel: 'membro' });
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('🎉 você entrou na comunidade');
  renderComunidadeEstudoDetalhe();
};

window.toggleComunidadeOverflowMenu = function () {
  document.getElementById('comunidadeDetalheOverflowMenu').classList.toggle('show');
};

// ---------- lista de membros da comunidade (admin promove/remove) ----------
window.abrirMembrosComunidade = async function () {
  document.getElementById('comunidadeMembrosOverlay').classList.add('open');
  await renderMembrosComunidade();
};

window.toggleMembroMenu = function (btn) {
  const menu = btn.nextElementSibling;
  document.querySelectorAll('.comunidade-membro-row .clube-overflow-menu.show').forEach(m => { if (m !== menu) m.classList.remove('show'); });
  menu.classList.toggle('show');
};

async function renderMembrosComunidade() {
  const wrap = document.getElementById('comunidadeMembrosLista');
  wrap.innerHTML = `<div class="visitor-lock-note">Carregando...</div>`;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session ? sessionData.session.user.id : null;

  await window.carregarSeguindoIds();
  const { data: c } = await supabaseClient.from('comunidades_estudo').select('criador_id').eq('id', comunidadeEstudoAtualId).single();

  const { data: membros, error } = await supabaseClient
    .from('comunidade_estudo_membros')
    .select('usuario_id, papel, entrou_em, usuarios(handle, avatar_url)')
    .eq('comunidade_id', comunidadeEstudoAtualId)
    .order('entrou_em', { ascending: true });

  if (error) { wrap.innerHTML = `<div class="visitor-lock-note">Não consegui carregar os membros.</div>`; return; }

  const souAdmin = !!(c && ((c.criador_id === meuId) || (membros || []).some(m => m.usuario_id === meuId && m.papel === 'admin')));

  wrap.innerHTML = (membros && membros.length ? membros.map((m, i) => {
    const handle = m.usuarios ? m.usuarios.handle : 'alguém';
    const ehCriador = !!(c && m.usuario_id === c.criador_id);
    const ehEu = m.usuario_id === meuId;
    const cor = CORES_COMUNIDADE[i % CORES_COMUNIDADE.length];
    return `
        <div class="comunidade-membro-row">
          ${avatarSeguirHtml(m.usuario_id, m.usuarios && m.usuarios.avatar_url, handle, 36, cor)}
          <div style="flex:1; min-width:0;">
            <div class="comunidade-membro-handle">@${handle}${ehEu ? ' (você)' : ''}</div>
            <div class="comunidade-membro-papel">${ehCriador ? 'criador' : (m.papel === 'admin' ? 'admin' : 'membro')}</div>
          </div>
          ${souAdmin && !ehCriador && !ehEu ? `
          <!-- kit item 10: botões de quem administra à vista (antes ficavam escondidos no ⋯).
               Tornar/Tirar admin = contorno sálvia; Remover = contorno terracota -->
          <div class="botoes-par membro-admin-acoes">
            ${m.papel === 'admin'
            ? `<button class="btn-acao btn-acao-contorno-salvia" onclick="rebaixarAdminComunidade('${m.usuario_id}')">Tirar admin</button>`
            : `<button class="btn-acao btn-acao-contorno-salvia" onclick="promoverAdminComunidade('${m.usuario_id}')">Tornar admin</button>`}
            <button class="btn-acao btn-acao-contorno-terracota" onclick="removerMembroComunidade('${m.usuario_id}')">Remover</button>
          </div>` : ''}
        </div>`;
  }).join('') : estadoVazio('sem membros ainda', ''));
}

window.promoverAdminComunidade = async function (usuarioId) {
  const { error } = await supabaseClient.from('comunidade_estudo_membros')
    .update({ papel: 'admin' }).eq('comunidade_id', comunidadeEstudoAtualId).eq('usuario_id', usuarioId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('⭐ agora é admin');
  renderMembrosComunidade();
};

window.rebaixarAdminComunidade = async function (usuarioId) {
  const { error } = await supabaseClient.from('comunidade_estudo_membros')
    .update({ papel: 'membro' }).eq('comunidade_id', comunidadeEstudoAtualId).eq('usuario_id', usuarioId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('admin removido');
  renderMembrosComunidade();
};

window.removerMembroComunidade = async function (usuarioId) {
  const { error } = await supabaseClient.from('comunidade_estudo_membros')
    .delete().eq('comunidade_id', comunidadeEstudoAtualId).eq('usuario_id', usuarioId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('👋 removido da comunidade');
  renderMembrosComunidade();
  renderComunidadeEstudoDetalhe();
};

window.sairDaComunidadeEstudo = async function () {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;
  const { error } = await supabaseClient.from('comunidade_estudo_membros')
    .delete().eq('comunidade_id', comunidadeEstudoAtualId).eq('usuario_id', usuarioId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('👋 você saiu da comunidade');
  closeOverlay('comunidadeDetalheOverlay');
  renderComunidades();
};

// ---------- ferramentas da comunidade: card com o tema atual (só o admin muda) ----------
function temaComunidadeCardHtml(souAdmin) {
  const tema = comunidadeTemaAtual.tema;
  return `
      <div class="clube-cap-card">
        <div class="clube-cap-info">
          <div class="clube-cap-kicker">${icone('marco',10)} na mesa agora</div>
          <div class="clube-cap-valor">${tema || 'tema ainda não definido'}</div>
        </div>
        ${souAdmin ? `<button class="clube-cap-editar" onclick="abrirEditarTemaComunidade()">${icone('editar',15)}</button>` : ''}
      </div>
      <div class="clube-cap-form" id="comunidadeTemaFormWrap" style="display:none;">
        <div class="clube-cap-form-row">
          <input type="text" id="comunidadeTemaInput" class="busca-input" placeholder="ex: revisão de exatas" style="flex:1;" value="${tema || ''}" />
        </div>
        <button class="post-btn" onclick="salvarTemaComunidade()">salvar tema</button>
      </div>`;
}

window.abrirEditarTemaComunidade = function () {
  const f = document.getElementById('comunidadeTemaFormWrap');
  f.style.display = f.style.display === 'none' ? 'flex' : 'none';
};

window.salvarTemaComunidade = async function () {
  const tema = document.getElementById('comunidadeTemaInput').value.trim();
  const { error } = await supabaseClient.from('comunidades_estudo')
    .update({ tema_atual: tema || null }).eq('id', comunidadeEstudoAtualId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  comunidadeTemaAtual.tema = tema || null;
  mostrarToast('📌 tema atualizado');
  document.getElementById('comunidadeDetalheFerramentas').innerHTML = temaComunidadeCardHtml(true) + prazoComunidadeCardHtml() + rankingComunidadeCardHtml();
};

// ---------- prazo da comunidade: agora e so a popup (o card grande saiu da
// tela pra sobrar espaco -- 'editar prazo' mora no menu de tres pontinhos,
// e o proprio countdown mora no chip da linha de meta-info la em cima) ----------
function prazoComunidadeCardHtml() {
  const prazo = comunidadeTemaAtual.prazo;
  const temporizador = comunidadeTemaAtual.temporizador !== false;
  const prazoISO = prazo ? prazo.slice(0, 10) : '';
  let prazoLabel = 'escolher data';
  if (prazoISO) {
    const nomesMesCurto = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const d = new Date(prazoISO + 'T00:00:00');
    prazoLabel = `${d.getDate()} de ${nomesMesCurto[d.getMonth()]}. de ${d.getFullYear()}`;
  }
  return `
      <div class="prazo-popup-overlay" id="comunidadePrazoPopupOverlay" onclick="if (event.target === this) fecharPopupPrazoComunidade()">
        <div class="prazo-popup-card">
          <div class="prazo-popup-titulo">Editar prazo</div>
          <div class="prazo-popup-campo">
            <input type="date" id="comunidadePrazoInput" style="display:none;" value="${prazoISO}" />
            <button type="button" class="data-picker-btn ${prazoISO ? 'preenchido' : ''}" id="comunidadePrazoInputBtn" onclick="abrirCalendarioPicker('comunidadePrazoInput')">${icone('calendario',15)}<span id="comunidadePrazoInputTxt" data-placeholder="escolher data">${prazoLabel}</span></button>
          </div>
          <label class="prazo-popup-check"><input type="checkbox" id="comunidadePrazoTimerCheck" ${temporizador ? 'checked' : ''}/> ${icone('relogio',13)} ligar temporizador</label>
          <div class="prazo-popup-acoes">
            <button class="post-btn" style="flex:1; background:var(--card-b); color:var(--ink);" onclick="fecharPopupPrazoComunidade()">cancelar</button>
            <button class="post-btn" style="flex:1;" onclick="salvarPrazoComunidade()">salvar prazo</button>
          </div>
        </div>
      </div>`;
}

window.abrirEditarPrazoComunidade = function () {
  document.getElementById('comunidadePrazoPopupOverlay').classList.add('show');
};

window.fecharPopupPrazoComunidade = function () {
  document.getElementById('comunidadePrazoPopupOverlay').classList.remove('show');
};

window.salvarPrazoComunidade = async function () {
  const prazo = document.getElementById('comunidadePrazoInput').value;
  const temporizador = document.getElementById('comunidadePrazoTimerCheck').checked;
  const { error } = await supabaseClient.from('comunidades_estudo')
    .update({ meta_prazo: prazo || null, temporizador_ativo: temporizador }).eq('id', comunidadeEstudoAtualId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('⏱ prazo atualizado');
  fecharPopupPrazoComunidade();
  renderComunidadeEstudoDetalhe();
};

// ---------- ranking de leitura da comunidade (paginas lidas no periodo, por enquanto) ----------
// kit item 9: Ranking e Convidar viram dois botões de contorno sálvia, lado a lado
// (comunidade privada não tem convite, aí o Ranking ocupa a largura toda)
function rankingComunidadeCardHtml() {
  const privada = !!(window.COMUNIDADE_ATUAL_PRIVADA);
  return `
      <div class="botoes-par" style="margin-top:10px;${privada ? ' grid-template-columns:1fr;' : ''}">
        <button class="btn-acao btn-acao-contorno-salvia" onclick="abrirRankingComunidade()">${icone('trofeu', 18)}Ranking</button>
        ${privada ? '' : `<button class="btn-acao btn-acao-contorno-salvia" onclick="abrirCompartilharComunidade()">${icone('mais', 18)}Convidar</button>`}
      </div>`;
}

let comunidadeRankingPeriodoAtivo = 'semana';

window.abrirRankingComunidade = function () {
  comunidadeRankingPeriodoAtivo = 'semana';
  document.getElementById('comunidadeRankingOverlay').classList.add('open');
  renderPeriodoRankingComunidade();
  renderRankingComunidade();
};

function renderPeriodoRankingComunidade() {
  const periodos = [['semana', 'semana'], ['mes', 'mês'], ['ano', 'ano']];
  document.getElementById('comunidadeRankingPeriodoRow').innerHTML = periodos.map(([valor, label]) =>
    `<div class="feed-modo-chip${comunidadeRankingPeriodoAtivo === valor ? ' on' : ''}" onclick="trocarPeriodoRankingComunidade('${valor}')">${label}</div>`
  ).join('');
}

window.trocarPeriodoRankingComunidade = function (periodo) {
  comunidadeRankingPeriodoAtivo = periodo;
  renderPeriodoRankingComunidade();
  renderRankingComunidade();
};

async function renderRankingComunidade() {
  const wrap = document.getElementById('comunidadeRankingLista');
  wrap.innerHTML = `<div class="visitor-lock-note">Carregando...</div>`;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const meuId = sessionData.session ? sessionData.session.user.id : null;

  const { data: membros, error: erroMembros } = await supabaseClient
    .from('comunidade_estudo_membros')
    .select('usuario_id, usuarios(handle)')
    .eq('comunidade_id', comunidadeEstudoAtualId);

  if (erroMembros || !membros || !membros.length) { wrap.innerHTML = estadoVazio('sem membros ainda', ''); return; }

  const idsMembros = membros.map(m => m.usuario_id);
  const hoje = new Date();
  const desde = new Date(hoje);
  if (comunidadeRankingPeriodoAtivo === 'semana') desde.setDate(desde.getDate() - 6);
  else if (comunidadeRankingPeriodoAtivo === 'mes') desde.setDate(desde.getDate() - 29);
  else desde.setDate(desde.getDate() - 364);
  const desdeISO = fmtDataISO(desde);

  const { data: linhas, error: erroLinhas } = await supabaseClient
    .from('leitura_diaria_paginas')
    .select('usuario_id, paginas')
    .in('usuario_id', idsMembros)
    .gte('data', desdeISO);

  if (erroLinhas) { wrap.innerHTML = `<div class="visitor-lock-note">Não consegui carregar o ranking.</div>`; return; }

  const somaPorUsuario = {};
  (linhas || []).forEach(l => { somaPorUsuario[l.usuario_id] = (somaPorUsuario[l.usuario_id] || 0) + l.paginas; });

  const ranking = membros
    .map(m => ({ usuarioId: m.usuario_id, handle: m.usuarios ? m.usuarios.handle : 'alguém', paginas: somaPorUsuario[m.usuario_id] || 0 }))
    .sort((a, b) => b.paginas - a.paginas);

  const medalhas = ['🥇', '🥈', '🥉'];

  wrap.innerHTML = ranking.map((r, i) => {
    const cor = CORES_COMUNIDADE[i % CORES_COMUNIDADE.length];
    const ehEu = r.usuarioId === meuId;
    return `
        <div class="comunidade-membro-row">
          <div class="ranking-posicao">${medalhas[i] || (i + 1)}</div>
          <div class="comunidade-membro-avatar" style="background:${cor}">${ATOMO_AVATAR_SVG}</div>
          <div style="flex:1; min-width:0;">
            <div class="comunidade-membro-handle">@${r.handle}${ehEu ? ' (você)' : ''}</div>
          </div>
          <div class="ranking-paginas">${r.paginas}<small> pág.</small></div>
        </div>`;
  }).join('');
}

// ---------- convidar pra comunidade (mesmo padrão do convite de clube) ----------
let compartilharComunidadeContexto = { texto: '', link: '' };

window.abrirCompartilharComunidade = async function () {
  const { data: c } = await supabaseClient.from('comunidades_estudo').select('titulo, privada').eq('id', comunidadeEstudoAtualId).single();
  if (!c) { mostrarToast('❌ não consegui montar o convite'); return; }
  if (c.privada) { mostrarToast('🔒 comunidades privadas ainda não têm link de convite — chama a pessoa por DM'); return; }

  const link = `${window.location.origin}${window.location.pathname}?comunidade=${comunidadeEstudoAtualId}`;
  const texto = `📚 bora estudar junto? entra na comunidade "${c.titulo}" no Átomo:`;
  compartilharComunidadeContexto = { texto, link };

  if (navigator.share) {
    try { await navigator.share({ title: c.titulo, text: texto, url: link }); } catch (e) { /* cancelou, sem problema */ }
    return;
  }

  document.getElementById('compartilharComunidadeResumo').textContent = texto + ' ' + link;
  document.getElementById('compartilharComunidadeOverlay').classList.add('open');
};

window.compartilharComunidadeWhatsapp = function () {
  const { texto, link } = compartilharComunidadeContexto;
  window.open('https://wa.me/?text=' + encodeURIComponent(texto + ' ' + link), '_blank');
};

window.compartilharComunidadeTelegram = function () {
  const { texto, link } = compartilharComunidadeContexto;
  window.open('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(texto), '_blank');
};

window.compartilharComunidadeCopiar = async function () {
  const { texto, link } = compartilharComunidadeContexto;
  try {
    await navigator.clipboard.writeText(texto + ' ' + link);
    mostrarToast('✨ link copiado! cola onde quiser');
  } catch (e) {
    mostrarToast('não consegui copiar sozinho — copia esse link: ' + link);
  }
  closeOverlay('compartilharComunidadeOverlay');
};

// se a pessoa chegou aqui por um link de convite de comunidade (guardado
// no localStorage lá em cima), abre essa comunidade assim que ela estiver logada
window.verificarConviteComunidadePendente = async function () {
  const bruto = localStorage.getItem('atomoConviteComunidade');
  if (!bruto) return;
  let convite;
  try { convite = JSON.parse(bruto); } catch (e) { localStorage.removeItem('atomoConviteComunidade'); return; }
  const UM_DIA = 24 * 60 * 60 * 1000;
  if (!convite || !convite.id || Date.now() - convite.quando > UM_DIA) { localStorage.removeItem('atomoConviteComunidade'); return; }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return; // ainda não logou — deixa guardado pra tentar de novo depois
  // cadastro/perguntas de boas-vindas ainda na tela: espera terminar, depois leva pro grupo
  // (quem chama de novo é o fim do onboarding ou a entrada de quem já tinha tudo configurado)
  const onboardEl = document.getElementById('onboardOverlay');
  if (onboardEl && !onboardEl.classList.contains('hide')) return;

  localStorage.removeItem('atomoConviteComunidade');
  showScreen2('livros');
  trocarModoLivros('comunidades');
  await abrirComunidadePorId(convite.id);
};

async function renderMuralComunidadeEstudo() {
  const wrap = document.getElementById('comunidadeDetalheMural');
  wrap.innerHTML = `<div class="visitor-lock-note">Carregando...</div>`;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  // reaproveita a mesma variável global que postClubeHtml() já lê pra
  // decidir se a bolha é "minha" ou "de outra pessoa" (o mural da
  // comunidade de estudo usa o mesmo componente de bolha do clube)
  muralClubeMeuId = sessionData.session ? sessionData.session.user.id : null;
  await window.carregarSeguindoIds();

  const { data, error } = await supabaseClient
    .from('posts')
    .select('*, usuarios!autor_id(handle, avatar_url)')
    .eq('comunidade_estudo_id', comunidadeEstudoAtualId)
    .order('criado_em', { ascending: true });

  if (error) { wrap.innerHTML = `<div class="visitor-lock-note">Não consegui carregar o mural.</div>`; return; }

  const posts = data || [];
  // reaproveita o mesmo componente de bolha de mensagem que o mural do
  // clube do livro já usa (postClubeHtml) — os campos que ele não usa
  // aqui (capitulo_livro/tem_spoiler) simplesmente vêm undefined/false
  wrap.innerHTML = posts.length
    ? posts.map(p => postClubeHtml(p)).join('')
    : estadoVazio('mural vazio ainda', 'seja a primeira pessoa a postar algo por aqui');
  wrap.scrollTop = wrap.scrollHeight;
}

window.publicarNoMuralComunidadeEstudo = async function () {
  const texto = document.getElementById('comunidadeComposerText').value.trim();
  if (!texto) return;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;

  const { error } = await supabaseClient.from('posts').insert({
    autor_id: usuarioId, texto, tipo: 'Comunidade', privado: false, comunidade_estudo_id: comunidadeEstudoAtualId,
  });

  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  document.getElementById('comunidadeComposerText').value = '';
  renderMuralComunidadeEstudo();
};

