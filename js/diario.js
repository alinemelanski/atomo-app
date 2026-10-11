/* js/diario.js — Diário privado, "o que te fez sorrir" e gratidão (polaroid)
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
  caveat:  { nome: 'Caveat',       familia: "'Caveat', cursive",       tamanho: 24 },
  kalam:   { nome: 'Kalam',        familia: "'Kalam', cursive",        tamanho: 19 },
  patrick: { nome: 'Patrick Hand', familia: "'Patrick Hand', cursive", tamanho: 21 },
  forma:   { nome: null,           familia: "'Nunito', sans-serif",    tamanho: 16 } // nome vem do t()
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
const assinatura = assinaturaDiario();

document.getElementById('diaryList').innerHTML = data.map(e => {
  const ref = e.ref_titulo ? { titulo: e.ref_titulo, autor: e.ref_autor, citacao: e.ref_citacao, tipo: e.tipo, trailer: e.ref_trailer, livroId: e.ref_livro_id, filmeId: e.ref_filme_id, capa: e.ref_capa } : null;
  const ehPolaroidGratidao = e.tipo === 'Gratidão do dia' && e.imagem_url;
  const corpoHtml = ehPolaroidGratidao
    ? `<div class="polaroid-card polaroid-card-diario"><div class="polaroid-foto"><img src="${e.imagem_url}" /></div><div class="polaroid-legenda-display">${formatarMencoes(e.texto)}</div></div>`
    : `<div class="folha-texto">${formatarMencoesEVideo(e.texto)}</div>${e.imagem_url ? `<img src="${e.imagem_url}" class="folha-foto" loading="lazy" />` : ''}${e.video_url ? `<video src="${e.video_url}" class="folha-foto" data-auto-video muted loop playsinline preload="metadata"></video>` : ''}`;
  const ehLembranca = lembrancaDiario && lembrancaDiario.id === e.id;
  return `
    <article class="folha${e.fixado ? ' fixado' : ''}">
      ${e.fixado ? `<span class="folha-fixada-marca">${icone('fixar', 13)}</span>` : ''}
      <div class="folha-corpo">
        ${ehLembranca ? `<span class="folha-lembranca">${t(lembrancaDiario.tipo === 'ano' ? 'diario_lembranca_ano' : 'diario_lembranca_mes')}</span>` : ''}
        ${corpoHtml}
        ${renderRefCard(ref)}
      </div>
      <div class="folha-rodape">
        <span class="folha-acoes">
          <button class="folha-acao" onclick="fixarPost(${e.id}, ${e.fixado ? 'true' : 'false'})" aria-label="${t(e.fixado ? 'diario_desafixar' : 'diario_fixar')}">${e.fixado ? icone('fixar', 15, 0, 'var(--accent-a)') : icone('fixar', 15)}</button>
          <button class="folha-acao" onclick="abrirCompartilharDiario(${e.id})" aria-label="${t('diario_compartilhar')}">${icone('compartilhar', 15)}</button>
          <button class="folha-acao" onclick="apagarPost(${e.id})" aria-label="${t('diario_apagar')}">${icone('lixeira', 15)}</button>
        </span>
        <span class="folha-assinatura-bloco">
          <span class="folha-data">${dataLongaFolha(e.criado_em)}</span>
          <span class="folha-assinatura">${assinatura}</span>
        </span>
      </div>
    </article>`;
}).join('');

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

// textos da folha em branco (data de hoje, assinatura, placeholder)
function prepararFolhaNova() {
  const input = document.getElementById('perfilComposerText');
  if (input) input.placeholder = t('diario_placeholder');
  const data = document.getElementById('folhaNovaData');
  if (data) data.textContent = dataLongaFolha(new Date().toISOString());
  document.querySelectorAll('[data-assinatura]').forEach(el => { el.textContent = assinaturaDiario(); });
  const titulo = document.getElementById('diarioTituloTxt');
  if (titulo) titulo.textContent = t('diario_titulo');
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
  // botão principal: na folha em branco ele guarda; nas outras ele leva de volta pra folha em branco
  const txt = document.getElementById('folhasBtnTxt');
  if (txt) txt.textContent = folhaAtual === 0 ? t('diario_guardar') : t('diario_nova_folha');
}

window.acaoBotaoFolha = function () {
  if (folhaAtual === 0) { publicarPostPerfil(); return; }
  folhaAtual = 0;
  posicionarFolhas();
  setTimeout(() => document.getElementById('perfilComposerText').focus(), 350);
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
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const total = document.querySelectorAll('#folhasPalco .folha').length;
    if (dx < 0 && folhaAtual < total - 1) folhaAtual++;
    else if (dx > 0 && folhaAtual > 0) folhaAtual--;
    else return;
    document.activeElement && document.activeElement.blur && document.activeElement.blur(); // fecha o teclado ao virar
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

// ---------- diario rapido: gratidao em forma de polaroid vintage ----------
let arquivoFotoGratidao = null;

window.abrirQuickGratidao = function () {
  document.getElementById('polaroidLegendaInput').value = '';
  const img = document.getElementById('polaroidFotoImg');
  img.src = ''; img.style.display = 'none';
  document.getElementById('polaroidFotoPlaceholder').style.display = 'flex';
  document.getElementById('polaroidFotoArea').classList.remove('revelando');
  arquivoFotoGratidao = null;
  const gratoAdj = meuGenero === 'Mulher' ? 'grata' : meuGenero === 'Homem' ? 'grato' : 'grato(a)';
  document.getElementById('quickGratidaoPerguntaTxt').textContent = 'Guarde algo que você é ' + gratoAdj + ' hoje';
  document.getElementById('quickGratidaoSubTxt').textContent = 'Tira uma fotinha do momento e grave com uma frase embaixo.';
  const card = document.getElementById('polaroidCard');
  card.style.display = ''; card.style.opacity = '1';
  const btn = document.getElementById('btnSalvarQuickGratidao');
  btn.style.display = ''; btn.style.opacity = '1'; btn.disabled = false; btn.textContent = 'Guardar';
  document.getElementById('quickGratidaoOverlay').classList.add('open');
};

window.fecharQuickGratidao = function () {
  document.getElementById('quickGratidaoOverlay').classList.remove('open');
};

window.abrirCameraGratidao = function () {
  document.getElementById('polaroidFotoInput').click();
};

window.previewFotoPolaroid = function (input) {
  if (!input.files || !input.files[0]) return;
  arquivoFotoGratidao = input.files[0];
  const img = document.getElementById('polaroidFotoImg');
  const area = document.getElementById('polaroidFotoArea');
  img.src = URL.createObjectURL(arquivoFotoGratidao);
  img.style.display = 'block';
  document.getElementById('polaroidFotoPlaceholder').style.display = 'none';
  // efeito "revelando" tipo polaroid de verdade saindo da camera
  area.classList.remove('revelando');
  void area.offsetWidth;
  area.classList.add('revelando');
};

window.salvarQuickGratidao = async function () {
  const legenda = document.getElementById('polaroidLegendaInput').value.trim();
  if (!legenda) { mostrarToast('❌ escreve sua gratidão antes de guardar'); return; }

  const btn = document.getElementById('btnSalvarQuickGratidao');
  btn.disabled = true; btn.textContent = 'Guardando...';

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;
  const fotoUrl = await subirFotoParaStorage(usuarioId, arquivoFotoGratidao);

  const { error } = await supabaseClient.from('posts').insert({
    autor_id: usuarioId,
    texto: legenda,
    tipo: 'Gratidão do dia',
    privado: true,
    imagem_url: fotoUrl,
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
