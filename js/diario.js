/* js/diario.js — Diário privado, "o que te fez sorrir" e gratidão (grade de fotos)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- Meu Diário: folhas de papel ----------
// O diário é privado (só a dona vê). Cada anotação vira uma FOLHA:
//   - folha 0 = folha em branco, onde se escreve (fica no index.html);
//   - folhas 1..N = anotações salvas, da mais nova pra mais antiga (desenhadas aqui).
// Deslizar pra esquerda vira a folha (vai pra mais antiga); pra direita, volta.
const diaryTabAtiva = 'privado';
let diarioEntradasCache = [];
let folhaAtual = 0; // índice da folha que está na frente (0 = folha em branco)

// letras disponíveis: muda SÓ a fonte, o papel continua igual
const LETRAS_DIARIO = {
  // linha = altura de cada linha do caderno (o texto "senta" em cima da pauta)
  caveat:  { nome: 'Caveat',       familia: "'Caveat', cursive",       tamanho: 24, linha: 34 },
  kalam:   { nome: 'Kalam',        familia: "'Kalam', cursive",        tamanho: 19, linha: 32 },
  patrick: { nome: 'Patrick Hand', familia: "'Patrick Hand', cursive", tamanho: 21, linha: 32 },
  forma:   { nome: null,           familia: "'Nunito', sans-serif",    tamanho: 16, linha: 30 } // nome vem do t()
};
let letraDiario = 'caveat';
try { letraDiario = localStorage.getItem('atomoLetraDiario') || 'caveat'; } catch (e) { /* sem storage */ }
if (!LETRAS_DIARIO[letraDiario]) letraDiario = 'caveat';

// aplica a letra trocando duas variáveis CSS no overlay do diário;
// todas as folhas usam var(--letra-diario), então mudam juntas
function aplicarLetraDiario() {
  const overlay = document.getElementById('meuDiarioOverlay');
  if (!overlay) return;
  const letra = LETRAS_DIARIO[letraDiario];
  overlay.style.setProperty('--letra-diario', letra.familia);
  overlay.style.setProperty('--letra-tam', letra.tamanho + 'px');
  overlay.style.setProperty('--letra-linha', letra.linha + 'px');
}

window.abrirLetraDiario = function () {
  document.getElementById('letraDiarioTitulo').textContent = t('diario_letra_titulo');
  document.getElementById('letraDiarioSub').textContent = t('diario_letra_sub');
  document.getElementById('letraDiarioGrade').innerHTML = Object.keys(LETRAS_DIARIO).map(chave => {
    const l = LETRAS_DIARIO[chave];
    return `<button class="letra-diario-opcao ${chave === letraDiario ? 'on' : ''}" onclick="escolherLetraDiario('${chave}')">
        <span class="amostra" style="font-family:${l.familia.replace(/"/g, '&quot;')}">${t('diario_letra_exemplo')}</span>
        <span class="nome">${l.nome || t('diario_letra_forma')}</span>
      </button>`;
  }).join('');
  document.getElementById('letraDiarioOverlay').classList.add('open');
};

window.escolherLetraDiario = function (chave) {
  letraDiario = chave;
  try { localStorage.setItem('atomoLetraDiario', chave); } catch (e) { /* sem storage */ }
  aplicarLetraDiario();
  closeOverlay('letraDiarioOverlay');
};

// "11 de outubro de 2026" no idioma do app
function dataLongaFolha(iso) {
  return new Date(iso).toLocaleDateString(localeAtual(), { day: 'numeric', month: 'long', year: 'numeric' });
}
// assinatura = primeiro nome da pessoa
function assinaturaDiario() {
  const nome = (document.getElementById('profNome') || {}).textContent || '';
  return nome.trim().split(' ')[0] || '';
}
// "AAAA-MM-DD" no horário do aparelho (não em UTC — senão uma folha das 22h cairia no dia seguinte)
function diaLocal(data) {
  const d = new Date(data);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ---------- "neste dia": folha de 1 ano ou 1 mês atrás, no mesmo dia ----------
let lembrancaDiario = null; // { id, tipo: 'ano' | 'mes' }
function procurarLembranca(entradas) {
  const hoje = new Date();
  const umAno = new Date(hoje); umAno.setFullYear(hoje.getFullYear() - 1);
  const umMes = new Date(hoje); umMes.setMonth(hoje.getMonth() - 1);
  // 1 ano tem prioridade (é a lembrança mais especial); depois 1 mês
  for (const [tipo, alvo] of [['ano', umAno], ['mes', umMes]]) {
    const achou = entradas.find(e => diaLocal(e.criado_em) === diaLocal(alvo));
    if (achou) return { id: achou.id, tipo };
  }
  return null;
}

window.irParaLembrancaDiario = function () {
  if (!lembrancaDiario) return;
  const i = diarioEntradasCache.findIndex(e => e.id === lembrancaDiario.id);
  if (i >= 0) { folhaAtual = i + 1; posicionarFolhas(); }
};

async function renderDiary() {
const { data: sessionData } = await supabaseClient.auth.getSession();
if (!sessionData.session) return;

const { data, error } = await supabaseClient
  .from('posts')
  .select('*')
  .eq('autor_id', sessionData.session.user.id)
  .eq('privado', diaryTabAtiva === 'privado')
  .is('clube_id', null)
  .is('comunidade_estudo_id', null)
  .order('fixado', { ascending: false })
  .order('criado_em', { ascending: false });

if (error) { console.log('erro ao carregar diario:', error.message); return; }
diarioEntradasCache = data;
lembrancaDiario = procurarLembranca(data);

document.getElementById('diaryList').innerHTML = data.map(folhaSalvaHtml).join('');

// botão "neste dia" só aparece quando existe lembrança
const btnLembranca = document.getElementById('diarioNesteDiaBtn');
if (btnLembranca) {
  btnLembranca.style.display = lembrancaDiario ? '' : 'none';
  if (lembrancaDiario) document.getElementById('diarioNesteDiaTxt').textContent = t(lembrancaDiario.tipo === 'ano' ? 'diario_neste_dia_ano' : 'diario_neste_dia_mes');
}

prepararFolhaNova();
if (folhaAtual > data.length) folhaAtual = data.length; // apagou a última folha: não deixa o índice "sobrando"
posicionarFolhas();
ativarAutoplayVideoEmbeds();
}

// ---------- uma folha salva ----------
// Cabeça (título à mão + data) e corpo pautado. Nada de ícones na folha:
// as ações ficam no menu "⋯" do topo.
function folhaSalvaHtml(e) {
  const ref = e.ref_titulo ? { titulo: e.ref_titulo, autor: e.ref_autor, citacao: e.ref_citacao, tipo: e.tipo, trailer: e.ref_trailer, livroId: e.ref_livro_id, filmeId: e.ref_filme_id, capa: e.ref_capa } : null;
  // data-editavel marca o pedaço de texto que vira editável quando a pessoa toca na folha
  const corpoHtml = (typeof corpoGratidaoHtml === 'function' && e.tipo === 'Gratidão do dia' && (e.imagem_url || e.imagens_urls))
    ? corpoGratidaoHtml(e)
    : `<div class="folha-texto" data-editavel>${formatarMencoesEVideo(e.texto)}</div>${e.imagem_url ? `<img src="${e.imagem_url}" class="folha-foto" loading="lazy" />` : ''}${e.video_url ? `<video src="${e.video_url}" class="folha-foto" data-auto-video muted loop playsinline preload="metadata"></video>` : ''}`;
  const ehLembranca = lembrancaDiario && lembrancaDiario.id === e.id;
  return `
    <article class="folha${e.fixado ? ' fixado' : ''}" data-post-id="${e.id}">
      ${e.fixado ? `<span class="folha-fixada-marca">${icone('fixar', 13)}</span>` : ''}
      <header class="folha-cabeca">
        <h2 class="folha-titulo">${t('diario_titulo')}</h2>
        <span class="folha-data-topo">${dataLongaFolha(e.criado_em)}</span>
      </header>
      <div class="folha-corpo">
        ${ehLembranca ? `<span class="folha-lembranca">${t(lembrancaDiario.tipo === 'ano' ? 'diario_lembranca_ano' : 'diario_lembranca_mes')}</span>` : ''}
        ${corpoHtml}
        ${renderRefCard(ref)}
      </div>
      <footer class="folha-assinatura-rodape"><span class="folha-assinatura">${assinaturaDiario()}</span></footer>
    </article>`;
}

// textos da folha em branco (data de hoje, título, placeholder, botões)
function prepararFolhaNova() {
  const input = document.getElementById('perfilComposerText');
  if (input) input.placeholder = t('diario_placeholder');
  const data = document.getElementById('folhaNovaData');
  if (data) data.textContent = dataLongaFolha(new Date().toISOString());
  document.querySelectorAll('[data-titulo-diario]').forEach(el => { el.textContent = t('diario_titulo'); });
  // assinatura da folha em branco = primeiro nome (ex: "Aline")
  document.querySelectorAll('[data-assinatura]').forEach(el => { el.textContent = assinaturaDiario(); });
  const salvar = document.getElementById('diarioSalvarTxt');
  if (salvar) salvar.textContent = t('diario_salvar');
  const nova = document.getElementById('diarioNovaNotaTxt');
  if (nova) nova.textContent = t('diario_nova_nota');
  aplicarLetraDiario();
}

// ---------- posição de cada folha (o "bloco de notas") ----------
// d = distância da folha até a da frente:
//   d < 0 → já foi virada: sai pela esquerda e some
//   d = 0 → a da frente
//   d > 0 → empilhada atrás, um pouquinho deslocada e torta (só as 2 primeiras aparecem)
function posicionarFolhas() {
  const folhas = document.querySelectorAll('#folhasPalco .folha');
  folhas.forEach((folha, i) => {
    const d = i - folhaAtual;
    let transform = 'translate(0, 0) rotate(0deg) scale(1)';
    let opacidade = 1;
    if (d < 0) {
      transform = 'translate(-125%, 20px) rotate(-9deg)';
      opacidade = 0;
    } else if (d > 0) {
      transform = `translate(${d * 5}px, ${d * 7}px) rotate(${d % 2 ? 1.2 : -0.8}deg) scale(${1 - d * 0.025})`;
      opacidade = d > 2 ? 0 : 1;
    }
    folha.style.transform = transform;
    folha.style.opacity = opacidade;
    folha.style.zIndex = 1000 - Math.abs(d);
    // folhas fora de vista não recebem toque (e não atrapalham leitores de tela)
    folha.classList.toggle('escondida', d < 0 || d > 2);
    folha.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
  });

  const total = folhas.length;
  const indicador = document.getElementById('folhasIndicador');
  if (indicador) indicador.textContent = total > 1 ? t('diario_folha_x_de_y', { atual: folhaAtual + 1, total }) : '';
}

// =====================================================================
// MODO EDIÇÃO: tocar na folha mostra Salvar / Nova nota
// =====================================================================
// A classe .editando no overlay é quem faz os botões aparecerem (via CSS).
// Numa folha JÁ SALVA, o texto vira editável na hora (contenteditable).
let folhaEditando = null; // { el, id, original } da folha salva que está sendo editada

window.entrarEdicaoDiario = function () {
  document.getElementById('meuDiarioOverlay').classList.add('editando');
};

function sairEdicaoDiario() {
  document.getElementById('meuDiarioOverlay').classList.remove('editando');
  if (folhaEditando) {
    folhaEditando.el.removeAttribute('contenteditable');
    folhaEditando = null;
  }
  const input = document.getElementById('perfilComposerText');
  if (input) input.blur();
}

function editarFolhaSalva(folha) {
  const id = Number(folha.dataset.postId);
  const entrada = diarioEntradasCache.find(e => e.id === id);
  const alvo = folha.querySelector('[data-editavel]');
  entrarEdicaoDiario();
  if (!entrada || !alvo || (folhaEditando && folhaEditando.el === alvo)) return;
  // mostra o texto "cru" (sem os links de @menção) enquanto edita
  alvo.textContent = entrada.texto || '';
  // "plaintext-only" impede colar texto com formatação (negrito, cores...)
  try { alvo.setAttribute('contenteditable', 'plaintext-only'); } catch (e) { alvo.setAttribute('contenteditable', 'true'); }
  if (alvo.contentEditable !== 'plaintext-only') alvo.setAttribute('contenteditable', 'true');
  folhaEditando = { el: alvo, id, original: entrada.texto || '' };
  alvo.focus();
}

// Salvar: na folha em branco cria a anotação; numa folha salva, grava a edição.
// Depois de salvar some tudo e fica SÓ a folha (pedido da Aline).
window.salvarFolhaDiario = async function () {
  if (folhaAtual === 0) {
    const novo = await publicarPostPerfil();
    if (!novo) return;
    await renderDiary();
    const i = diarioEntradasCache.findIndex(e => e.id === novo.id);
    folhaAtual = i >= 0 ? i + 1 : 1; // mostra a folha que acabou de nascer
    sairEdicaoDiario();
    posicionarFolhas();
    return;
  }
  await gravarEdicaoFolha();
  sairEdicaoDiario();
};

async function gravarEdicaoFolha() {
  if (!folhaEditando) return true;
  const texto = folhaEditando.el.innerText.trim();
  if (!texto || texto === folhaEditando.original.trim()) { renderDiary(); return true; }
  const { error } = await supabaseClient.from('posts')
    .update({ texto, editado_em: new Date().toISOString() })
    .eq('id', folhaEditando.id);
  if (error) { mostrarToast('❌ erro: ' + error.message); return false; }
  mostrarToast(t('diario_guardado'));
  await renderDiary();
  return true;
}

// Nova nota: guarda o que estiver escrito e abre uma folha em branco.
window.novaNotaDiario = async function () {
  const input = document.getElementById('perfilComposerText');
  if (folhaAtual === 0) {
    if (input.value.trim()) {
      const novo = await publicarPostPerfil();
      if (!novo) return;
    }
  } else {
    const ok = await gravarEdicaoFolha();
    if (!ok) return;
    folhaEditando = null;
  }
  folhaAtual = 0;
  posicionarFolhas();
  entrarEdicaoDiario();
  setTimeout(() => input.focus(), 350);
};

// toque na folha da frente → entra no modo edição
// (ignora toques em links, vídeos, cards de livro e logo depois de deslizar)
let acabouDeDeslizar = false;
(function configurarToqueFolha() {
  const palco = document.getElementById('folhasPalco');
  if (!palco) return;
  palco.addEventListener('click', (e) => {
    if (acabouDeDeslizar) return;
    if (e.target.closest('a, button, video, .ref-card, .mencao')) return;
    const folha = e.target.closest('.folha');
    if (!folha || folha.classList.contains('escondida')) return;
    if (folha.classList.contains('folha-nova')) {
      entrarEdicaoDiario();
      const input = document.getElementById('perfilComposerText');
      if (document.activeElement !== input) input.focus();
      return;
    }
    editarFolhaSalva(folha);
  });
})();

// =====================================================================
// MENU "⋯" (popup vidro): as opções dependem da folha da frente
// =====================================================================
window.abrirMenuDiario = function () {
  const entrada = folhaAtual > 0 ? diarioEntradasCache[folhaAtual - 1] : null;
  const item = (acao, rotulo, svg, extraClasse = '') =>
    `<button class="diario-menu-item ${extraClasse}" onclick="closeOverlay('diarioMenuOverlay'); ${acao}">
      <span class="icon-svg" style="width:18px;height:18px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></span>
      <span>${rotulo}</span>
    </button>`;
  const SVG_FOTO = '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>';
  const SVG_FIXAR = '<path d="M9 4h6l-1 6 3 3H7l3-3-1-6Z"/><path d="M12 13v7"/>';
  const SVG_COMP = '<path d="M12 4v11M7.5 8.5 12 4l4.5 4.5"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>';
  const SVG_PDF = '<path d="M4.2 5.9c2.5-1.5 5.4-1.2 7.6.4.2.1.4.1.6 0 2.2-1.6 5.1-1.9 7.5-.5v11.6c-2.4-1.4-5.3-1.1-7.5.5-.2.1-.4.1-.6 0-2.2-1.6-5.1-1.9-7.6-.4Z"/><path d="M12.1 6.4v11.5"/>';
  const SVG_LIXO = '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>';

  let html = '';
  if (!entrada) {
    html += item(`abrirEscolherFoto('perfil')`, t('diario_menu_foto'), SVG_FOTO);
  } else {
    html += item(`fixarPost(${entrada.id}, ${entrada.fixado ? 'true' : 'false'})`, t(entrada.fixado ? 'diario_desafixar' : 'diario_fixar'), SVG_FIXAR);
    html += item(`abrirCompartilharDiario(${entrada.id})`, t('diario_compartilhar'), SVG_COMP);
  }
  html += item('exportarDiarioPdf()', t('diario_menu_pdf'), SVG_PDF);
  if (entrada) html += item(`apagarPost(${entrada.id})`, t('diario_apagar'), SVG_LIXO, 'perigo');
  document.getElementById('diarioMenuLista').innerHTML = html;
  document.getElementById('diarioMenuOverlay').classList.add('open');
};

// ---------- gesto de deslizar entre as folhas ----------
// Guarda onde o dedo encostou e compara com onde soltou. Só conta como "virar"
// se o movimento foi bem mais pro lado do que pra cima/baixo (senão era rolagem).
(function configurarDeslizarFolhas() {
  const palco = document.getElementById('folhasPalco');
  if (!palco) return;
  let inicioX = null, inicioY = 0;

  palco.addEventListener('touchstart', (e) => {
    inicioX = e.touches[0].clientX;
    inicioY = e.touches[0].clientY;
    // impede o "arrastar da borda pra voltar" das telas cheias de fechar o diário
    // quando a pessoa só queria voltar uma folha
    e.stopPropagation();
  }, { passive: true });

  palco.addEventListener('touchend', (e) => {
    if (inicioX === null) return;
    const dx = e.changedTouches[0].clientX - inicioX;
    const dy = e.changedTouches[0].clientY - inicioY;
    inicioX = null;
    virarFolhaPorGesto(dx, dy);
  }, { passive: true });

  // no computador: arrastar com o mouse faz a mesma coisa
  palco.addEventListener('mousedown', (e) => { inicioX = e.clientX; inicioY = e.clientY; });
  palco.addEventListener('mouseup', (e) => {
    if (inicioX === null) return;
    const dx = e.clientX - inicioX, dy = e.clientY - inicioY;
    inicioX = null;
    virarFolhaPorGesto(dx, dy);
  });

  function virarFolhaPorGesto(dx, dy) {
    // qualquer arrasto de verdade (mesmo pequeno) não conta como "toque na folha"
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      acabouDeDeslizar = true;
      setTimeout(() => { acabouDeDeslizar = false; }, 350);
    }
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (folhaEditando) return; // editando uma folha: não vira (o dedo pode estar selecionando texto)
    const total = document.querySelectorAll('#folhasPalco .folha').length;
    if (dx < 0 && folhaAtual < total - 1) folhaAtual++;
    else if (dx > 0 && folhaAtual > 0) folhaAtual--;
    else return;
    sairEdicaoDiario(); // virou a folha: esconde os botões e fecha o teclado
    posicionarFolhas();
  }
})();

// ---------- diario rapido: "o que te fez sorrir hoje" ----------
window.abrirQuickSorriso = function () {
  document.getElementById('quickSorrisoTexto').value = '';
  document.getElementById('quickSolStage').classList.remove('bursting');
  document.getElementById('quickDiarioPerguntaTxt').textContent = 'O que te fez sorrir hoje?';
  document.getElementById('quickDiarioSubTxt').textContent = 'Pode ser pequeno. Um instante, uma lembrança, alguém.';
  document.querySelector('.quick-diario-composer').style.display = '';
  document.querySelector('.quick-diario-composer').style.opacity = '1';
  const btn = document.getElementById('btnSalvarQuickSorriso');
  btn.style.display = ''; btn.style.opacity = '1'; btn.disabled = false; btn.textContent = 'Guardar';
  document.getElementById('quickSorrisoOverlay').classList.add('open');
};

window.fecharQuickSorriso = function () {
  document.getElementById('quickSorrisoOverlay').classList.remove('open');
};

window.salvarQuickSorriso = async function () {
  const texto = document.getElementById('quickSorrisoTexto').value.trim();
  if (!texto) { mostrarToast('❌ escreve algo antes de guardar'); return; }

  const btn = document.getElementById('btnSalvarQuickSorriso');
  btn.disabled = true; btn.textContent = 'Guardando...';

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;

  const { error } = await supabaseClient.from('posts').insert({
    autor_id: usuarioId,
    texto: texto,
    tipo: 'Sorriso do dia',
    privado: true,
  });

  if (error) {
    btn.disabled = false; btn.textContent = 'Guardar';
    mostrarToast('❌ erro: ' + error.message);
    return;
  }

  // animação: o sol "acende" e a página respira um agradecimento antes de fechar
  document.getElementById('quickSolStage').classList.add('bursting');
  document.getElementById('quickDiarioPerguntaTxt').textContent = 'Guardado ✓';
  document.getElementById('quickDiarioSubTxt').textContent = 'obrigada por dividir isso com você mesma.';
  const composer = document.querySelector('.quick-diario-composer');
  composer.style.opacity = '0';
  setTimeout(() => { composer.style.display = 'none'; }, 200);
  btn.style.opacity = '0';
  setTimeout(() => { btn.style.display = 'none'; }, 200);

  renderDiary();
  somarPontoHumor('feliz', PONTOS_POR_TOQUE_HUMOR);

  setTimeout(() => {
    fecharQuickSorriso();
    mostrarToast('☀️ guardado no seu diário');
  }, 1500);
};

// ---------- diario rapido: gratidão com grade de 1, 2 ou 3 fotos ----------
// PRA APRENDER: guardamos as fotos escolhidas num array com "casinhas"
// (fotosGratidao[0], [1], [2]). O layout diz quantas casinhas aparecem.
// Tocar numa casinha abre a galeria/câmera e a foto vai pra AQUELA casinha.
let layoutGratidao = 1;
let fotosGratidao = [null, null, null]; // arquivos (File) escolhidos
let casinhaGratidaoAtual = 0;           // qual casinha está esperando foto

const SVG_CAMERA_GRADE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>';

function desenharGradeGratidao() {
  const grade = document.getElementById('gratidaoGrade');
  grade.className = 'gratidao-grade layout-' + layoutGratidao;
  let html = '';
  for (let i = 0; i < layoutGratidao; i++) {
    const arq = fotosGratidao[i];
    html += arq
      ? `<button class="gratidao-casa cheia" onclick="escolherFotoCasinha(${i})" aria-label="Trocar foto ${i + 1}"><img src="${URL.createObjectURL(arq)}" alt="" /></button>`
      : `<button class="gratidao-casa" onclick="escolherFotoCasinha(${i})" aria-label="Escolher foto ${i + 1}"><span class="icon-svg" style="width:24px;height:24px;">${SVG_CAMERA_GRADE}</span></button>`;
  }
  grade.innerHTML = html;
  document.querySelectorAll('.gratidao-layout-btn').forEach(b => {
    const on = Number(b.dataset.layout) === layoutGratidao;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

window.escolherLayoutGratidao = function (n) {
  layoutGratidao = n;
  desenharGradeGratidao();
};

window.escolherFotoCasinha = function (i) {
  casinhaGratidaoAtual = i;
  document.getElementById('polaroidFotoInput').click();
};

window.abrirQuickGratidao = function () {
  document.getElementById('polaroidLegendaInput').value = '';
  fotosGratidao = [null, null, null];
  layoutGratidao = 1;
  desenharGradeGratidao();
  const gratoAdj = meuGenero === 'Mulher' ? 'grata' : meuGenero === 'Homem' ? 'grato' : 'grato(a)';
  document.getElementById('quickGratidaoPerguntaTxt').textContent = 'Guarde algo que você é ' + gratoAdj + ' hoje';
  document.getElementById('quickGratidaoSubTxt').textContent = 'Escolhe 1, 2 ou 3 fotos do momento (ou nenhuma) e escreve embaixo.';
  const card = document.getElementById('polaroidCard');
  card.style.display = ''; card.style.opacity = '1';
  const btn = document.getElementById('btnSalvarQuickGratidao');
  btn.style.display = ''; btn.style.opacity = '1'; btn.disabled = false; btn.textContent = 'Guardar';
  document.getElementById('quickGratidaoOverlay').classList.add('open');
};

window.fecharQuickGratidao = function () {
  document.getElementById('quickGratidaoOverlay').classList.remove('open');
};

// (nome antigo mantido: o <input type="file"> do index.html chama essa função)
window.previewFotoPolaroid = function (input) {
  if (!input.files || !input.files[0]) return;
  fotosGratidao[casinhaGratidaoAtual] = input.files[0];
  input.value = ''; // limpa, senão escolher a MESMA foto de novo não dispara o onchange
  desenharGradeGratidao();
};

window.salvarQuickGratidao = async function () {
  const legenda = document.getElementById('polaroidLegendaInput').value.trim();
  if (!legenda) { mostrarToast('❌ escreve sua gratidão antes de guardar'); return; }

  const btn = document.getElementById('btnSalvarQuickGratidao');
  btn.disabled = true; btn.textContent = 'Guardando...';

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;

  // sobe uma foto de cada vez (o nome do arquivo usa a hora em milissegundos;
  // em paralelo, duas fotos poderiam ganhar o MESMO nome)
  const urls = [];
  for (const arq of fotosGratidao.slice(0, layoutGratidao)) {
    if (!arq) continue;
    const url = await subirFotoParaStorage(usuarioId, arq);
    if (url) urls.push(url);
  }

  const { error } = await supabaseClient.from('posts').insert({
    autor_id: usuarioId,
    texto: legenda,
    tipo: 'Gratidão do dia',
    privado: true,
    imagem_url: urls[0] || null,              // a 1ª foto (compatível com o que já existia)
    imagens_urls: urls.length ? urls : null,  // todas, na ordem da grade
  });

  if (error) {
    btn.disabled = false; btn.textContent = 'Guardar';
    mostrarToast('❌ erro: ' + error.message);
    return;
  }

  document.getElementById('quickGratidaoPerguntaTxt').textContent = 'Guardado ✓';
  document.getElementById('quickGratidaoSubTxt').textContent = 'obrigada por reparar nisso hoje.';
  const card = document.getElementById('polaroidCard');
  card.style.opacity = '0';
  setTimeout(() => { card.style.display = 'none'; }, 200);
  btn.style.opacity = '0';
  setTimeout(() => { btn.style.display = 'none'; }, 200);

  renderDiary();
  somarPontoHumor('calma', PONTOS_POR_TOQUE_HUMOR);

  setTimeout(() => {
    fecharQuickGratidao();
    mostrarToast('📸 guardado no seu diário');
  }, 1500);
};

// Como a gratidão aparece DENTRO da folha do diário: a mesma grade, já com as fotos.
// Posts antigos (só imagem_url) viram uma grade de 1 foto.
function corpoGratidaoHtml(e) {
  const urls = (e.imagens_urls && e.imagens_urls.length ? e.imagens_urls : [e.imagem_url]).filter(Boolean).slice(0, 3);
  return `
    <div class="gratidao-grade layout-${urls.length} gratidao-grade-diario">
      ${urls.map(u => `<div class="gratidao-casa cheia"><img src="${u}" loading="lazy" alt="" /></div>`).join('')}
    </div>
    <div class="folha-texto" data-editavel>${formatarMencoes(e.texto)}</div>`;
}
