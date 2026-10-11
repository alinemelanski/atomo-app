/* js/feed.js — Avatar, composer, publicar post, feed, curtir, bloquear/denunciar
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- avatar (foto de perfil ou iniciais) ----------
window.avatarHtml = function (avatarUrl, iniciais, opts) {
  opts = opts || {};
  const classe = opts.classe || 'post-avatar';
  const onclickAttr = opts.onclick ? ' onclick="' + opts.onclick + '"' : '';
  let estilo = opts.onclick ? 'cursor:pointer;' : '';
  if (avatarUrl) {
    estilo += "background-image:url('" + avatarUrl + "');background-size:cover;background-position:center;color:transparent;";
    return '<div class="' + classe + '"' + onclickAttr + ' style="' + estilo + '"></div>';
  }
  return '<div class="' + classe + '"' + onclickAttr + (estilo ? ' style="' + estilo + '"' : '') + '>' + (iniciais || '?').toUpperCase() + '</div>';
};

const TIPOS = ['História', 'Arte', 'Poema', 'Música', 'Conto', 'Livro', 'Filme', 'Série', 'Jogo', 'Podcast', 'Assunto', 'Finanças', 'Reflexão', 'Sonho', 'Gratidão', 'Memória', 'Desabafo', 'Relato', 'Humor'];
let tipoSelecionado = null;
let composerPrivado = false;
function formatarTempoRelativo(isoString) {
const diffMin = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
if (diffMin < 1) return 'agora';
if (diffMin < 60) return `há ${diffMin} min`;
const h = Math.floor(diffMin / 60);
if (h < 24) return `há ${h} h`;
return `há ${Math.floor(h / 24)} dia(s)`;
}
function formatarDataCurta(isoString) {
const d = new Date(isoString);
return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}
function estadoVazio(titulo, sub, botaoTexto, botaoAcao) {
return `<div class="estado-vazio">
    <svg viewBox="0 0 100 100"><path d="M18 12 L42 6 L58 4 L74 14 L88 10 L94 26 L96 44 L90 58 L94 74 L82 84 L66 96 L48 92 L30 98 L14 88 L6 72 L4 54 L10 38 L6 22 Z" fill="none" stroke="var(--ink-faint)" stroke-width="1.5"/></svg>
    <div class="titulo">${titulo}</div>
    <div class="sub">${sub}</div>
    ${botaoTexto ? `<button class="post-btn" onclick="${botaoAcao}">${botaoTexto}</button>` : ''}
  </div>`;
}
function skeletonPosts(qtd) {
let html = '';
for (let i = 0; i < qtd; i++) {
  html += `
      <div class="skeleton-post">
        <div style="display:flex; align-items:center; gap:9px; margin-bottom:8px;">
          <div class="skeleton-avatar"></div>
          <div style="flex:1;"><div class="skeleton-linha" style="width:40%;"></div></div>
        </div>
        <div class="skeleton-linha" style="width:90%;"></div>
        <div class="skeleton-linha" style="width:60%;"></div>
      </div>`;
}
return html;
}

async function carregarPostsReais() {
document.getElementById('feedList').innerHTML = skeletonPosts(4);
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session ? sessionData.session.user.id : null;

let idsBloqueados = [];
if (meuId) {
  const { data: bloqueios } = await supabaseClient.from('bloqueios').select('bloqueado_id').eq('usuario_id', meuId);
  idsBloqueados = (bloqueios || []).map(b => b.bloqueado_id);
}

const { data, error } = await supabaseClient
  .from('posts')
  .select('*, usuarios(handle, avatar_url)')
  .eq('privado', false)
  .is('clube_id', null)
  .is('comunidade_estudo_id', null)
  .order('criado_em', { ascending: false });

if (error) { console.log('erro ao carregar posts:', error.message); return; }

const idsDosPosts = data.map(row => row.id);
const { data: curtidas } = await supabaseClient
  .from('curtidas')
  .select('post_id, usuario_id')
  .in('post_id', idsDosPosts.length ? idsDosPosts : [0]);
const { data: comentariosContagem } = await supabaseClient
  .from('comentarios')
  .select('post_id')
  .in('post_id', idsDosPosts.length ? idsDosPosts : [0]);
// posts que EU salvei (se a tabela posts_salvos ainda não existir no banco, só vem vazio)
idsSalvos = new Set();
if (meuId) {
  const { data: salvos } = await supabaseClient.from('posts_salvos').select('post_id').eq('usuario_id', meuId);
  (salvos || []).forEach(s => idsSalvos.add(s.post_id));
}

feedPosts = data.filter(row => !idsBloqueados.includes(row.autor_id)).map(row => {
  const handle = row.usuarios ? row.usuarios.handle : 'alguem';
  const avatarUrl = row.usuarios ? row.usuarios.avatar_url : null;
  const curtidasDessePost = (curtidas || []).filter(c => c.post_id === row.id);
    return {
    id: row.id,
    autor_id: row.autor_id,
    imagem_url: row.imagem_url,
    video_url: row.video_url,
    autor: handle,
    avatarUrl: avatarUrl,
    iniciais: handle[0].toUpperCase(),
    tipo: row.tipo,
    texto: row.texto,
    tempo: formatarTempoRelativo(row.criado_em),
    likes: curtidasDessePost.length,
    curtiu: curtidasDessePost.some(c => c.usuario_id === meuId),
    comentarios: (comentariosContagem || []).filter(c => c.post_id === row.id),
    editado: !!row.editado_em,
    salvo: idsSalvos.has(row.id),
    ref: row.ref_titulo ? { titulo: row.ref_titulo, autor: row.ref_autor, citacao: row.ref_citacao, tipo: row.tipo, trailer: row.ref_trailer, livroId: row.ref_livro_id, filmeId: row.ref_filme_id, capa: row.ref_capa } : null,
  };
});

renderFeed();

// intercala conteúdo curado do Descobrir a cada 2 posts do feed, sempre --
// antes só entrava quando o feed tinha poucos posts de amigo, agora entra
// sempre pra ele nunca ficar com cara de vazio (busca só 1x)
if (!itensPreenchimentoFeed.length) {
  try {
    const itens = await buscarPaginaDescobrir(1);
    itensPreenchimentoFeed = ordenarItensDescobrir(itens);
    if (itensPreenchimentoFeed.length) renderFeed();
  } catch (e) { console.log('erro ao preencher feed com descobrir:', e.message); }
}
}
// feed posts // 

 let feedPosts = [];
 let idsSalvos = new Set(); // ids dos posts que eu salvei (favoritos)
 let itensPreenchimentoFeed = [];

let diaryEntries = {
  publico: [
    { tipo: 'Poema', texto: 'o silêncio antes de uma ideia\né sempre maior do que parece', tempo: 'há 3 h' },
    { tipo: 'Assunto', texto: 'estou tentando entender por que certas músicas voltam sozinhas na cabeça depois de anos', tempo: 'ontem' },
  ],
  privado: [
    { tipo: 'Conto', texto: '[rascunho] a personagem ainda não tem nome, mas já sei como a história termina', tempo: 'há 1 dia' },
  ],
};

// amigos // visitantes //

const DISCOVER = [
  { kind: '📰 Notícia', title: 'Autora brasileira anuncia novo livro de contos', desc: 'Lançamento previsto pra o fim do ano, com pré-venda já aberta pros primeiros capítulos.', regiao: 'br' },
  { kind: '🎧 Podcast', title: 'Novo episódio: como nasce um poema', desc: 'Conversa sobre processo criativo com três poetas convidados.', regiao: 'br' },
  { kind: '🍿 Filme', title: 'Prévia nova saiu hoje', desc: 'A adaptação mais esperada do ano ganhou sua primeira prévia completa.', regiao: 'br' },
  { kind: '📖 Livro', title: 'Prévia dos 3 primeiros capítulos liberada', desc: 'A editora liberou uma prévia exclusiva antes do lançamento oficial.', regiao: 'br' },
  { kind: '🎵 Música', title: 'Álbum novo chega na sexta', desc: 'Faixa-bônus já vazou e está tocando nas rodas de resenha.', regiao: 'br' },
  { kind: '🌍 Livro', title: '"The Vegetarian" ganha nova tradução', desc: 'Han Kang, Coreia do Sul — a edição revisada chega com posfácio inédito.', regiao: 'mundo' },
  { kind: '🌍 Filme', title: 'Vencedor de Cannes ganha data no Brasil', desc: 'Produção francesa premiada estreia em circuito nacional mês que vem.', regiao: 'mundo' },
  { kind: '🌍 Música', title: 'Artista islandesa lança EP surpresa', desc: 'Björk-adjacente, gravado inteiro em estúdio caseiro em Reykjavík.', regiao: 'mundo' },
];


let dmAberto = null;

// ---------- render: chips de tipo no composer ----------
function renderTypeChips() {
  document.getElementById('typeChipRow').innerHTML = ordemTipos.filter(t => !tiposOcultos.includes(t)).map(t =>
    `<div class="type-chip ${tipoSelecionado === t ? 'on' : ''}" onclick="selecionarTipo('${t}')">${t}</div>`
  ).join('');
}

// ---------- render: chips de tipo no composer do Meu Diario (estado proprio, mesma lista/ordem/ocultos) ----------
let tipoSelecionadoDiario = null;
function renderTypeChipsDiario() {
  const el = document.getElementById('typeChipRowDiario');
  if (!el) return;
  el.innerHTML = ordemTipos.filter(t => !tiposOcultos.includes(t)).map(t =>
    `<div class="type-chip ${tipoSelecionadoDiario === t ? 'on' : ''}" onclick="selecionarTipoDiario('${t}')">${t}</div>`
  ).join('');
}
window.selecionarTipoDiario = function (t) {
  tipoSelecionadoDiario = tipoSelecionadoDiario === t ? null : t;
  renderTypeChipsDiario();
};
const INTERESSES_CADASTRO = ['Leitura', 'Cinema/Séries', 'Música', 'Games', 'Arte e Design', 'Fotografia', 'Culinária', 'Viagens', 'Esportes', 'Natureza e ar livre', 'Moda', 'Tecnologia', 'Bem-estar e espiritualidade', 'Ciência', 'Animais', 'Dança', 'Escrita e poesia', 'Anime e mangá', 'Astrologia', 'Política e sociedade'];
const TIPOS_COM_REF = { 'Livro': { icon: '📖', label: '📎 anexar referência do livro' }, 'Música': { icon: '🎵', label: '📎 anexar referência da música' }, 'Filme': { icon: '🎬', label: '📎 anexar referência do filme/prévia' }, 'Podcast': { icon: '🎧', label: '📎 anexar referência do podcast' } };

window.selecionarTipo = function (t) {
  tipoSelecionado = tipoSelecionado === t ? null : t;
  renderTypeChips();
  const refForm = document.getElementById('refForm');
  if (tipoSelecionado && TIPOS_COM_REF[tipoSelecionado]) {
    refForm.classList.add('show');
      document.getElementById('buscaFilmeArea').style.display = (tipoSelecionado === 'Filme') ? 'block' : 'none';
      document.getElementById('buscaMusicaArea').style.display = (tipoSelecionado === 'Música') ? 'block' : 'none';
      document.getElementById('buscaLivroArea').style.display = (tipoSelecionado === 'Livro') ? 'block' : 'none';
      document.getElementById('buscaPodcastArea').style.display = (tipoSelecionado === 'Podcast') ? 'block' : 'none';
      document.getElementById('refFormLabel').textContent = TIPOS_COM_REF[tipoSelecionado].label;
  } else {
    refForm.classList.remove('show');
  }
};

window.toggleComposerPrivado = function () {
  composerPrivado = !composerPrivado;
  document.getElementById('composerPrivIcon').innerHTML = composerPrivado ? icone('cadeado',16) : icone('globo',16);
  document.getElementById('composerPrivLabel').textContent = composerPrivado ? 'Só eu' : 'Compartilhável';
};
async function subirFotoParaStorage(usuarioId, arquivo) {
if (!arquivo) return null;

const extensao = arquivo.name.split('.').pop();
const caminho = `${usuarioId}/${Date.now()}.${extensao}`;

const { error } = await supabaseClient.storage.from('midia-posts').upload(caminho, arquivo);
if (error) {
  console.log('ERRO COMPLETO DO UPLOAD:', error);
  mostrarToast('❌ erro no upload: ' + error.message);
  return null;
}

const { data } = supabaseClient.storage.from('midia-posts').getPublicUrl(caminho);
return data.publicUrl;
}

// ---------- escolher foto: câmera ou galeria ----------
// no Android moderno, um <input type=file accept="image/*"> simples abre direto
// o seletor de fotos do sistema (photo picker) SEM opção de câmera — diferente do
// iOS, que já mostra "Tirar foto" e "Biblioteca de fotos" nativamente. Por isso
// cada ponto do app que tem o ícone de câmera oferece essa escolha explícita, com
// dois inputs escondidos (um normal, um com capture="environment").
const MAPA_FOTO_INPUTS = {
composer: { galeria: 'composerFotoInput', camera: 'composerFotoInputCamera' },
perfil: { galeria: 'perfilComposerFotoInput', camera: 'perfilComposerFotoInputCamera' },
avatar: { galeria: 'editAvatarInput', camera: 'editAvatarInputCamera' },
dm: { galeria: 'dmFotoInput', camera: 'dmFotoInputCamera' },
clube: { galeria: 'clubeFotoInput', camera: 'clubeFotoInputCamera' },
comunidade: { galeria: 'comunidadeFotoInput', camera: 'comunidadeFotoInputCamera' },
explorar: { galeria: 'explorarComposerFotoInput', camera: 'explorarComposerFotoInputCamera' },
};
let fotoOrigemAtual = null;

window.abrirEscolherFoto = function (origem) {
fotoOrigemAtual = origem;
// a dica de GIF só faz sentido na foto de perfil
const dicaGif = document.getElementById('escolherFotoDicaGif');
if (dicaGif) dicaGif.style.display = origem === 'avatar' ? 'block' : 'none';
document.getElementById('escolherFotoPopupBg').classList.add('show');
};
window.fecharEscolherFoto = function () {
document.getElementById('escolherFotoPopupBg').classList.remove('show');
};
window.dispararFotoGlobal = function (tipo) {
fecharEscolherFoto();
const mapa = MAPA_FOTO_INPUTS[fotoOrigemAtual];
if (!mapa) return;
const input = document.getElementById(tipo === 'camera' ? mapa.camera : mapa.galeria);
if (input) { input.value = ''; input.click(); }
};

// mostra a previa certa (foto ou video) pro arquivo escolhido, escondendo a outra
function exibirPreviewMidia(arquivo, idImg, idVideo) {
const ehVideo = !!(arquivo && arquivo.type && arquivo.type.startsWith('video/'));
const previewImg = document.getElementById(idImg);
const previewVideo = document.getElementById(idVideo);
const url = URL.createObjectURL(arquivo);
if (ehVideo) {
  previewVideo.src = url;
  previewVideo.style.display = 'block';
  previewImg.style.display = 'none';
  previewImg.removeAttribute('src');
} else {
  previewImg.src = url;
  previewImg.style.display = 'block';
  previewVideo.style.display = 'none';
  previewVideo.removeAttribute('src');
}
}

let arquivoFotoComposer = null;

window.previewFotoComposer = function (el) {
const input = el || document.getElementById('composerFotoInput');
if (!input.files || !input.files[0]) return;
arquivoFotoComposer = input.files[0];
exibirPreviewMidia(arquivoFotoComposer, 'composerFotoPreview', 'composerFotoPreviewVideo');
};

async function subirFotoPost(usuarioId) {
return subirFotoParaStorage(usuarioId, arquivoFotoComposer);
}

let arquivoFotoComposerPerfil = null;

window.previewFotoComposerPerfil = function (el) {
const input = el || document.getElementById('perfilComposerFotoInput');
if (!input.files || !input.files[0]) return;
arquivoFotoComposerPerfil = input.files[0];
exibirPreviewMidia(arquivoFotoComposerPerfil, 'perfilComposerFotoPreview', 'perfilComposerFotoPreviewVideo');
};

window.publicarPostPerfil = async function () {
const texto = document.getElementById('perfilComposerText').value.trim();
if (!texto) return;

const btnPostar = document.getElementById('btnPostarPerfil');
if (btnPostar) { btnPostar.disabled = true; btnPostar.classList.add('disparando'); setTimeout(() => btnPostar.classList.remove('disparando'), 1200); }

const { data: sessionData } = await supabaseClient.auth.getSession();
const usuarioId = sessionData.session.user.id;
const ehVideoPerfil = !!(arquivoFotoComposerPerfil && arquivoFotoComposerPerfil.type && arquivoFotoComposerPerfil.type.startsWith('video/'));
const fotoUrl = await subirFotoParaStorage(usuarioId, arquivoFotoComposerPerfil);

const { error } = await supabaseClient.from('posts').insert({
  autor_id: usuarioId,
  texto: texto,
  tipo: tipoSelecionadoDiario || 'Assunto',
  privado: true,
  imagem_url: ehVideoPerfil ? null : fotoUrl,
  video_url: ehVideoPerfil ? fotoUrl : null,
});

if (error) {
  if (btnPostar) { btnPostar.disabled = false; }
  mostrarToast('❌ erro: ' + error.message); return;
}

if (btnPostar) { btnPostar.disabled = false; }
document.getElementById('perfilComposerText').value = '';
document.getElementById('perfilComposerFotoPreview').style.display = 'none';
document.getElementById('perfilComposerFotoPreviewVideo').style.display = 'none';
document.getElementById('perfilComposerFotoPreviewVideo').removeAttribute('src');
document.getElementById('perfilComposerFotoInput').value = '';
arquivoFotoComposerPerfil = null;
tipoSelecionadoDiario = null;
renderTypeChipsDiario();
mostrarToast('🔒 Guardado só pra você');
renderDiary();
carregarPostsReais();
atualizarResumoDiaDepois();
};

let arquivoFotoComposerExplorar = null;

window.previewFotoComposerExplorar = function (el) {
const input = el || document.getElementById('explorarComposerFotoInput');
if (!input.files || !input.files[0]) return;
arquivoFotoComposerExplorar = input.files[0];
exibirPreviewMidia(arquivoFotoComposerExplorar, 'composerExplorarFotoPreview', 'composerExplorarFotoPreviewVideo');
};

window.abrirComposerExplorar = function () {
document.getElementById('composerExplorarOverlay').classList.add('open');
setTimeout(() => document.getElementById('composerExplorarText').focus(), 250);
};

window.publicarPostExplorar = async function () {
const texto = document.getElementById('composerExplorarText').value.trim();
if (!texto) return;

const btnPostar = document.getElementById('btnPostarExplorar');
if (btnPostar) btnPostar.disabled = true;

const { data: sessionData } = await supabaseClient.auth.getSession();
const usuarioId = sessionData.session.user.id;
const ehVideoExplorar = !!(arquivoFotoComposerExplorar && arquivoFotoComposerExplorar.type && arquivoFotoComposerExplorar.type.startsWith('video/'));
const fotoUrl = await subirFotoParaStorage(usuarioId, arquivoFotoComposerExplorar);

const { error } = await supabaseClient.from('posts').insert({
  autor_id: usuarioId,
  texto: texto,
  tipo: 'Assunto',
  privado: false,
  imagem_url: ehVideoExplorar ? null : fotoUrl,
  video_url: ehVideoExplorar ? fotoUrl : null,
});

if (btnPostar) btnPostar.disabled = false;
if (error) { mostrarToast('❌ erro: ' + error.message); return; }

document.getElementById('composerExplorarText').value = '';
document.getElementById('composerExplorarFotoPreview').style.display = 'none';
document.getElementById('composerExplorarFotoPreviewVideo').style.display = 'none';
document.getElementById('composerExplorarFotoPreviewVideo').removeAttribute('src');
document.getElementById('explorarComposerFotoInput').value = '';
arquivoFotoComposerExplorar = null;
closeOverlay('composerExplorarOverlay');
mostrarToast('✨ Compartilhado no explorar');
if (typeof renderDiscover === 'function') renderDiscover();
carregarPostsReais();
};

window.publicarPost = async function () {

vibrar([10, 30, 10]);
const texto = document.getElementById('composerText').value.trim();
if (!texto) return;
const tipo = tipoSelecionado || 'Assunto';

const btnPostarFeed = document.getElementById('btnPostarFeed');
if (btnPostarFeed) { btnPostarFeed.disabled = true; btnPostarFeed.classList.add('disparando'); setTimeout(() => btnPostarFeed.classList.remove('disparando'), 1200); }

  let refTitulo = null, refAutor = null, refCitacao = null, refTrailer = null, refLivroId = null;
if (TIPOS_COM_REF[tipo]) {
  refTitulo = document.getElementById('refTitulo').value.trim() || null;
  refAutor = document.getElementById('refAutor').value.trim() || null;
  refCitacao = document.getElementById('refCitacao').value.trim() || null;

  if (tipo === 'Filme' && filmeIdEscolhido) {
    const respTrailer = await fetch(`${API_BASE}/api/filme-trailer?id=${filmeIdEscolhido}`);
    const dadosTrailer = await respTrailer.json();
    refTrailer = dadosTrailer.url;
  }
} 
if (tipo === 'Música' && musicaPreviewEscolhida) {
    refTrailer = musicaPreviewEscolhida;
}

if (tipo === 'Livro' && capaLivroEscolhida) {
     refLivroId = capaLivroEscolhida;
}
if (tipo === 'Podcast' && podcastIdEscolhido) {
    const respEpisodio = await fetch(`${API_BASE}/api/podcast-episodio?id=${podcastIdEscolhido}`);
    const dadosEpisodio = await respEpisodio.json();
    refTrailer = dadosEpisodio.url;
 }

const { data: sessionData } = await supabaseClient.auth.getSession();
const usuarioId = sessionData.session.user.id;

const ehVideoFeed = !!(arquivoFotoComposer && arquivoFotoComposer.type && arquivoFotoComposer.type.startsWith('video/'));
const fotoUrl = await subirFotoPost(usuarioId);

const { error } = await supabaseClient.from('posts').insert({
  autor_id: usuarioId,
  texto: texto,
  tipo: tipo,
  privado: composerPrivado,
  ref_titulo: refTitulo,
  ref_autor: refAutor,
  ref_citacao: refCitacao,
  ref_trailer: refTrailer,
  ref_livro_id: refLivroId,
  ref_filme_id: (tipo === 'Filme' ? filmeIdEscolhido : null),
  ref_capa: capaEscolhida,
  imagem_url: ehVideoFeed ? null : fotoUrl,
  video_url: ehVideoFeed ? fotoUrl : null,
});

if (error) {
  if (btnPostarFeed) { btnPostarFeed.disabled = false; }
  mostrarToast('❌ erro ao postar: ' + error.message);
  return;
}

if (btnPostarFeed) { btnPostarFeed.disabled = false; }
document.getElementById('composerText').value = '';
document.getElementById('refTitulo').value = '';
document.getElementById('refAutor').value = '';
document.getElementById('refCitacao').value = '';
document.getElementById('refForm').classList.remove('show');
document.getElementById('composerFotoPreview').style.display = 'none';
document.getElementById('composerFotoPreviewVideo').style.display = 'none';
document.getElementById('composerFotoPreviewVideo').removeAttribute('src');
document.getElementById('composerFotoInput').value = '';
arquivoFotoComposer = null;
tipoSelecionado = null;
renderTypeChips();

mostrarToast(composerPrivado ? '🔒 Guardado só pra você' : '✨ Compartilhado no feed');
if (!composerPrivado) notificarMencoes(texto, usuarioId, 'no feed');
carregarPostsReais();
};

function renderRefCard(ref) {
  if (!ref) return '';
  const icon = TIPOS_COM_REF[ref.tipo] ? TIPOS_COM_REF[ref.tipo].icon : '📎';
  // nunca mostra o ▶ se ele não for realmente clicável — antes aparecia um
  // botão "morto" (sem onclick) quando o post não tinha prévia salva, e
  // parecia bug. Filme sem prévia salva ainda tenta buscar na hora do clique
  // (usando o id do TMDB); os outros casos sem prévia simplesmente não mostram o botão.
  let playBadge = '';
  if (ref.trailer) {
    playBadge = `<span class="play-badge" style="cursor:pointer;" onclick="abrirTrailerPopup('${ref.trailer}', '${ref.tipo}')">▶</span>`;
  } else if (ref.tipo === 'Filme' && ref.filmeId) {
    playBadge = `<span class="play-badge" style="cursor:pointer;" onclick="buscarPreviaFilmePost(${ref.filmeId}, '${ref.tipo}')">▶</span>`;
  } else if (ref.tipo === 'Livro' && ref.livroId) {
    playBadge = `<span class="play-badge" style="cursor:pointer;" onclick="abrirLivroPopup('${ref.livroId}')">📖</span>`;
  }
  return `
      <div class="ref-card">
        <div class="ref-thumb" ${ref.capa ? `style="background-image:url('${ref.capa}'); background-size:cover; background-position:center;"` : ''}>${ref.capa ? '' : icon}${playBadge}</div>
        <div class="ref-info">
          <div class="rt">${ref.titulo}</div>
          ${ref.autor ? `<div class="ra">${ref.autor}</div>` : ''}
          ${ref.citacao ? `<div class="rc">"${ref.citacao}"</div>` : ''}
        </div>
      </div>
      ${(ref.trailer || (ref.tipo === 'Filme' && ref.filmeId)) && ['Filme', 'Música', 'Podcast'].includes(ref.tipo)
      ? `<div class="auto-previa" data-auto-previa data-tipo="${ref.tipo}" ${ref.trailer ? `data-url="${ref.trailer}"` : ''} ${ref.filmeId ? `data-filme="${ref.filmeId}"` : ''} onclick="cliquePreviaAuto(this)"></div>`
      : ''}`;
}

let modoFeedAtivo = 'interesse';
window.trocarModoFeed = function (modo) {
  modoFeedAtivo = modo;
  document.querySelectorAll('.feed-modo-chip').forEach(c => c.classList.toggle('on', c.dataset.modo === modo));
  renderFeed();
};

// algoritmo simples: pontua cada post pelos sinais que o app já coleta —
// assunto favorito escolhido no cadastro, tipos que a própria pessoa costuma
// postar (interesse demonstrado), e engajamento (curtidas) — sem esconder
// nada, só reordena o que já apareceria de qualquer forma
function calcularScoreRelevancia(post, indice, total) {
  let score = 0;
  if (assuntosFavoritos.includes(post.tipo)) score += 50;
  const tiposQuePostei = feedPosts.filter(p => p.autor === 'ana_art').map(p => p.tipo);
  if (tiposQuePostei.includes(post.tipo)) score += 20;
  score += Math.min(post.likes, 10);
  score += (total - indice) * 1.5; // recência ainda pesa um pouco, só não domina
  return score;
}

function renderFeed() {
  let lista = feedPosts.map((p, i) => ({ post: p, i, relevante: assuntosFavoritos.includes(p.tipo) }));
  if (modoFeedAtivo === 'interesse') {
    lista = lista
      .map(item => ({ ...item, score: calcularScoreRelevancia(item.post, item.i, feedPosts.length) }))
      .sort((a, b) => b.score - a.score);
  }

  const postsHtml = lista.map(({ post: p, i, relevante }) => {
    const ehMeu = p.autor_id === window.MEU_USUARIO_ID;
    const conteudoPost = `
      <div class="post">
        <div class="post-head">
          ${avatarHtml(p.avatarUrl, p.iniciais, { onclick: "abrirPerfilAlheio('" + p.autor_id + "')" })}
          <div class="post-who" style="cursor:pointer;" onclick="abrirPerfilAlheio('${p.autor_id}')"><div class="n">@${p.autor}</div><div class="t">${p.tempo}${p.editado ? ' · ' + t('post_editado') : ''}</div></div>
          <span class="post-tag">${p.tipo}</span>
        </div>
        ${modoFeedAtivo === 'interesse' && relevante ? '<div class="post-relevante-tag">✨ do seu interesse</div><br>' : ''}
        <div class="post-body">${formatarMencoesEVideo(p.texto)}</div>
        ${p.imagem_url ? `<img src="${p.imagem_url}" class="post-foto-fixa" loading="lazy" />` : ''}
        ${p.video_url ? `<video src="${p.video_url}" data-auto-video muted loop playsinline preload="metadata" style="width:100%; border-radius:12px; margin-top:8px; display:block; background:#000;"></video>` : ''}
        ${renderRefCard(p.ref)}
        <div class="post-actions">
          <div class="post-action ${p.curtiu ? 'liked' : ''}" onclick="curtirPost(${i}, event)">${icone('curtir',14,i)} ${p.likes}</div>
          <div class="post-action" onclick="abrirComentarios(${i})">${icone('comentar',14,i)} ${p.comentarios.length}</div>
          <div class="post-action" onclick="abrirCompartilhar(${i})">${icone('compartilhar',14,i)}</div>
          <div class="post-action" onclick="alternarSalvarPost(${p.id})" aria-label="${t(p.salvo ? 'post_remover_salvo' : 'post_salvar')}">${p.salvo ? icone('salvar',14,i,'var(--accent-a)') : icone('salvar',14,i)}</div>
          ${ehMeu
          ? `<div class="post-action" onclick="abrirEditarPost(${p.id})" aria-label="${t('post_editar')}">${icone('editar',14)}</div><div class="post-action" onclick="apagarPost(${p.id})">${icone('lixeira',14)}</div>`
          : `<div class="post-action" onclick="abrirDenuncia(${p.id}, '${p.autor_id}')">${icone('denunciar',14)}</div>`}
        </div>
      </div>`;

    return ehMeu
      ? `<div class="post-swipe-wrap" ontouchstart="swipeIniciar(event)" ontouchmove="swipeMover(event, ${p.id})" ontouchend="swipeFinalizar(event, ${p.id})">
            <div class="post-swipe-fundo">${icone('lixeira',14)} Apagar</div>
            ${conteudoPost}
          </div>`
      : conteudoPost;
  });

  const deveCompletar = itensPreenchimentoFeed.length > 0;
  const listaFinal = deveCompletar
    ? intercalarPreenchimentoFeed(postsHtml, itensPreenchimentoFeed.map((d, i) => cardPreenchimentoFeedHtml(d, i)))
    : postsHtml;

  document.getElementById('feedList').innerHTML = listaFinal.join('');
  ativarAutoplayVideoEmbeds();
}

// intercala conteúdo curado do Descobrir entre os posts de amigos, pra o feed nunca ficar vazio
function intercalarPreenchimentoFeed(postsHtml, curadosHtml) {
  if (!curadosHtml.length) return postsHtml;
  if (!postsHtml.length) return curadosHtml;
  const resultado = [];
  const A_CADA = 2; // 1 item curado a cada 2 posts de amigo
  let cIdx = 0;
  postsHtml.forEach((html, i) => {
    resultado.push(html);
    if ((i + 1) % A_CADA === 0 && cIdx < curadosHtml.length) { resultado.push(curadosHtml[cIdx]); cIdx++; }
  });
  while (cIdx < curadosHtml.length) { resultado.push(curadosHtml[cIdx]); cIdx++; }
  return resultado;
}

function cardPreenchimentoFeedHtml(d, i) {
  return `
      <div class="discover-card ${d.destaque ? 'discover-card-destaque' : ''}">
        <span class="discover-kind">${d.kind}</span>
        ${d.imagemUrl ? `<img src="${d.imagemUrl}" alt="" loading="lazy" style="width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:12px; margin:8px 0; display:block;">` : ''}
        <div class="discover-title">${d.title}</div>
        <div class="discover-desc">${d.desc}</div>
        ${d.filmeId || d.previewUrl || d.collectionId
        ? `<div class="auto-previa" data-auto-previa data-tipo="${d.filmeId ? 'Filme' : d.previewUrl ? 'Música' : 'Podcast'}" ${d.previewUrl ? `data-url="${d.previewUrl}"` : ''} ${d.filmeId ? `data-filme="${d.filmeId}"` : ''} ${d.collectionId && !d.filmeId && !d.previewUrl ? `data-podcast="${d.collectionId}"` : ''} onclick="cliquePreviaAuto(this)"></div>`
        : ''}
        <div class="post-actions" style="margin-top:10px;">
          <div class="post-action" onclick="comentarPreenchimentoFeed(${i})">${icone('comentar',14,i)}</div>
          <div class="post-action" onclick="compartilharPreenchimentoFeed(${i})">${icone('compartilhar',14,i)}</div>
        </div>
      </div>`;
}

let denunciaPendente = null;
window.abrirBloqueados = async function () {
closeConfig();
document.getElementById('bloqueadosOverlay').classList.add('open');
document.getElementById('bloqueadosList').innerHTML = `<div class="visitor-lock-note">Carregando...</div>`;

const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const { data: bloqueios } = await supabaseClient
  .from('bloqueios')
  .select('id, bloqueado_id, usuarios!bloqueios_bloqueado_id_fkey(handle)')
  .eq('usuario_id', meuId);

document.getElementById('bloqueadosList').innerHTML = (bloqueios && bloqueios.length)
  ? bloqueios.map(b => `
        <div class="friend-row">
          <div class="friend-info"><div class="n">@${b.usuarios ? b.usuarios.handle : 'alguém'}</div></div>
          <button class="seguir-btn" onclick="desbloquearDaLista(${b.id})">Desbloquear</button>
        </div>`).join('')
  : `<div class="visitor-lock-note">Ninguém bloqueado.</div>`;
};

window.desbloquearDaLista = async function (bloqueioId) {
await supabaseClient.from('bloqueios').delete().eq('id', bloqueioId);
mostrarToast('Desbloqueado');
abrirBloqueados();
};

window.bloquearUsuarioAtual = async function () {
const alvoId = window.PERFIL_ALHEIO_ATUAL_ID;
if (!alvoId) return;
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;
const btn = document.getElementById('perfilAlheioBloquearBtn');
const labelChat = document.getElementById('dmInfoBloquearLabel');

const { data: jaBloqueado } = await supabaseClient.from('bloqueios').select('id').eq('usuario_id', meuId).eq('bloqueado_id', alvoId).maybeSingle();

if (jaBloqueado) {
  await supabaseClient.from('bloqueios').delete().eq('id', jaBloqueado.id);
  if (btn) btn.innerHTML = icone('bloquear',13) + ' Bloquear';
  if (labelChat) labelChat.textContent = 'Bloquear';
  mostrarToast('Desbloqueado');
} else {
  abrirConfirmGenerico('Bloquear essa pessoa?', 'Ela some do seu feed e não pode mais te mandar mensagem.', async () => {
    await supabaseClient.from('bloqueios').insert({ usuario_id: meuId, bloqueado_id: alvoId });
    if (btn) btn.innerHTML = icone('check',13) + ' Desbloquear';
    if (labelChat) labelChat.textContent = 'Desbloquear';
    mostrarToast('🚫 Bloqueado');
    closeOverlay('perfilAlheioOverlay');
    closeOverlay('dmInfoOverlay');
    closeOverlay('dmChatOverlay');
    carregarPostsReais();
    if (typeof renderDmList === 'function') renderDmList();
  });
}
};

window.abrirDenuncia = function (postId, autorId) {
denunciaPendente = { postId, autorId };
document.getElementById('denunciarPopupBg').classList.add('show');
};

window.enviarDenuncia = async function (motivo) {
const { data: sessionData } = await supabaseClient.auth.getSession();

const { error } = await supabaseClient.from('denuncias').insert({
  denunciante_id: sessionData.session.user.id,
  post_id: denunciaPendente.postId,
  usuario_denunciado_id: denunciaPendente.autorId,
  motivo: motivo,
});

document.getElementById('denunciarPopupBg').classList.remove('show');
if (error) { mostrarToast('❌ erro: ' + error.message); return; }
mostrarToast('🚩 Denúncia enviada. Obrigada por ajudar a manter o Átomo seguro');
};

let swipeX0 = 0;

window.swipeIniciar = function (e) {
swipeX0 = e.touches[0].clientX;
};

window.swipeMover = function (e, postId) {
const deltaX = e.touches[0].clientX - swipeX0;
if (deltaX >= 0) return; // só arrasta pra esquerda
const wrap = e.currentTarget;
const post = wrap.querySelector('.post');
const fundo = wrap.querySelector('.post-swipe-fundo');
const distancia = Math.max(deltaX, -100);
post.style.transform = `translateX(${distancia}px)`;
fundo.style.opacity = Math.min(Math.abs(distancia) / 80, 1);
};

window.swipeFinalizar = function (e, postId) {
const wrap = e.currentTarget;
const post = wrap.querySelector('.post');
const fundo = wrap.querySelector('.post-swipe-fundo');
const transformAtual = post.style.transform;
const distancia = transformAtual ? parseFloat(transformAtual.match(/-?\d+/)[0]) : 0;

if (distancia <= -70) {
  apagarPost(postId);
} else {
  post.style.transform = 'translateX(0)';
  fundo.style.opacity = 0;
}
};

window.apagarPost = async function (postId) {
abrirConfirmGenerico('Apagar esse post?', 'Não tem como desfazer.', async () => {
  const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }

  mostrarToast('🗑️ Post apagado');
  carregarPostsReais();
  renderDiary();
});
};

window.fixarPost = async function (postId, jaFixado) {
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

if (jaFixado) {
  const { error } = await supabaseClient.from('posts').update({ fixado: false }).eq('id', postId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('📍 Post desafixado');
} else {
  await supabaseClient.from('posts').update({ fixado: false }).eq('autor_id', meuId).eq('fixado', true);
  const { error } = await supabaseClient.from('posts').update({ fixado: true }).eq('id', postId);
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  mostrarToast('📌 Post fixado no topo do Diário');
}

renderDiary();
};

// dispara push pro evento (curtida/comentário/seguidor/mensagem) chamando o
// servidor — silencioso se falhar (nunca pode travar a ação principal do usuário)
function notificarPushEvento(destinatarioId, tipo, dados) {
  if (!destinatarioId || destinatarioId === window.MEU_USUARIO_ID) return;
  fetch(`${API_BASE}/api/push/notificar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioId: destinatarioId, tipo, dados: Object.assign({ de: window.MEU_HANDLE || 'alguém' }, dados || {}) }),
  }).catch(() => {});
}

window.curtirPost = async function (i, evt) {

  vibrar(15); 
const post = feedPosts[i];
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

if (!post.curtiu && evt) {
  const btn = evt.currentTarget;
  btn.classList.add('curtir-pulsando');
  setTimeout(() => btn.classList.remove('curtir-pulsando'), 400);

  const rect = btn.getBoundingClientRect();
  for (let p = 0; p < 4; p++) {
    const particula = document.createElement('div');
    particula.className = 'particula-coracao';
    particula.textContent = '💛';
    particula.style.left = (rect.left + rect.width / 2 + (Math.random() * 30 - 15)) + 'px';
    particula.style.top = rect.top + 'px';
    document.body.appendChild(particula);
    setTimeout(() => particula.remove(), 700);
  }
}

// atualiza local (otimista) e re-renderiza só a partir da lista já
// carregada em memória — evita recarregar o feed inteiro do zero
// (o que fazia a tela piscar/sumir e voltar a cada curtida)
const jaCurtia = post.curtiu;
post.curtiu = !jaCurtia;
post.likes = (post.likes || 0) + (jaCurtia ? -1 : 1);
renderFeed();

let erro;
if (jaCurtia) {
  ({ error: erro } = await supabaseClient.from('curtidas').delete().eq('post_id', post.id).eq('usuario_id', meuId));
} else {
  ({ error: erro } = await supabaseClient.from('curtidas').insert({ post_id: post.id, usuario_id: meuId }));
}

if (erro) {
  // deu erro salvando no banco: desfaz a atualização otimista
  post.curtiu = jaCurtia;
  post.likes = (post.likes || 0) + (jaCurtia ? 1 : -1);
  renderFeed();
  mostrarToast('❌ erro ao curtir: ' + erro.message);
} else if (!jaCurtia && post.autor_id !== meuId) {
  // notificação in-app (funciona mesmo sem push configurado/permitido) +
  // push de verdade (quando disponível)
  const { data: donoDoPost } = await supabaseClient.from('usuarios').select('notif_ativado').eq('id', post.autor_id).maybeSingle();
  if (!donoDoPost || donoDoPost.notif_ativado !== false) {
    const { error: erroNotif } = await supabaseClient.from('notificacoes').insert({
      usuario_id: post.autor_id,
      tipo: 'curtida',
      titulo: 'Nova curtida',
      subtitulo: `@${window.MEU_HANDLE || 'alguém'} curtiu seu post`,
      post_id: post.id,
      ator_id: meuId,
    });
    if (erroNotif) console.log('erro ao criar notificação de curtida:', erroNotif.message);
  }
  notificarPushEvento(post.autor_id, 'curtida', { post_id: post.id, ator_id: meuId });
}
};
