/* js/diario.js — Diário privado, "o que te fez sorrir" e gratidão (polaroid)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- perfil: diário (privado, só a pessoa dona vê) ----------
const diaryTabAtiva = 'privado';
let diarioEntradasCache = [];

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

  document.getElementById('diaryList').innerHTML = data.map(e => {
  const ref = e.ref_titulo ? { titulo: e.ref_titulo, autor: e.ref_autor, citacao: e.ref_citacao, tipo: e.tipo, trailer: e.ref_trailer, livroId: e.ref_livro_id, filmeId: e.ref_filme_id, capa: e.ref_capa } : null;
  const ehPolaroidGratidao = e.tipo === 'Gratidão do dia' && e.imagem_url;
  const corpoHtml = ehPolaroidGratidao
    ? `<div class="polaroid-card polaroid-card-diario"><div class="polaroid-foto"><img src="${e.imagem_url}" /></div><div class="polaroid-legenda-display">${formatarMencoes(e.texto)}</div></div>`
    : `<div class="body">${formatarMencoesEVideo(e.texto)}</div>${e.imagem_url ? `<img src="${e.imagem_url}" class="post-foto-fixa" loading="lazy" style="filter: sepia(.28) saturate(1.2) contrast(1.05) brightness(1.03);" />` : ''}${e.video_url ? `<video src="${e.video_url}" data-auto-video muted loop playsinline preload="metadata" style="width:100%; border-radius:12px; margin-top:8px; display:block;"></video>` : ''}`;
  return `
    <div class="diary-entry${e.fixado ? ' fixado' : ''}">
      <div class="tag">${e.fixado ? icone('fixar',10) + ' ' : ''}${diaryTabAtiva === 'privado' ? icone('cadeado',10) + ' Só eu · ' : ''}${e.tipo}</div>
      ${corpoHtml}
      ${renderRefCard(ref)}
      <div class="foot">
        <span>${formatarTempoRelativo(e.criado_em)} · ${formatarDataCurta(e.criado_em)}</span>
        <span class="foot-actions">
          <span class="post-action" onclick="fixarPost(${e.id}, ${e.fixado ? 'true' : 'false'})" style="cursor:pointer;" title="${e.fixado ? 'Desafixar' : 'Fixar no topo do Diário'}">${e.fixado ? icone('fixar',14,0,'var(--accent-a)') : icone('fixar',14)}</span>
          <span class="post-action" onclick="abrirCompartilharDiario(${e.id})" style="cursor:pointer;" title="Compartilhar">${icone('compartilhar',14)}</span>
          <span class="post-action" onclick="apagarPost(${e.id})" style="cursor:pointer;">${icone('lixeira',14)}</span>
        </span>
      </div>
    </div>`;
}).join('') || estadoVazio(
  diaryTabAtiva === 'privado' ? 'Seu cantinho particular' : 'Sua primeira anotação te espera',
  diaryTabAtiva === 'privado' ? 'O que ficar aqui só você vai ver.' : 'Escreva algo ali em cima — pode ser qualquer coisa.',
  null, null
);
ativarAutoplayVideoEmbeds();
}

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
