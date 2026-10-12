/* js/referencias.js — Busca de filme/música/livro/podcast, prévias e trailer, itens do Descobrir
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

 window.buscarFilmeReal = async function () {
const termo = document.getElementById('buscaFilmeInput').value.trim();
if (!termo) return;

const resposta = await fetch(`${API_BASE}/api/buscar-filme?q=${encodeURIComponent(termo)}`);
const dados = await resposta.json();
const resultados = (dados.results || []).slice(0, 5);

document.getElementById('resultadosFilme').innerHTML = resultados.length
  ? resultados.map(f => {
      const ano = f.release_date ? f.release_date.slice(0, 4) : '';
      const tituloEscapado = f.title.replace(/'/g, "\\'");
      return `<div class="friend-row" style="cursor:pointer;" onclick="escolherFilme('${tituloEscapado}', '${ano}', ${f.id}, '${f.poster_path ? 'https://image.tmdb.org/t/p/w200' + f.poster_path : ''}')">
          <div class="friend-info"><div class="n">${f.title}</div><div class="s">${ano}</div></div>
        </div>`;
    }).join('')
  : `<div class="visitor-lock-note">Nenhum filme encontrado.</div>`;
}

let filmeIdEscolhido = null;

function mostrarReferenciaPreview(titulo, autor) {
document.getElementById('refTitulo').value = titulo;
document.getElementById('refAutor').value = autor || '';
document.getElementById('buscaFilmeArea').style.display = 'none';
document.getElementById('buscaMusicaArea').style.display = 'none';
document.getElementById('buscaLivroArea').style.display = 'none';
document.getElementById('buscaPodcastArea').style.display = 'none';

const preview = document.getElementById('referenciaPreview');
preview.style.display = 'block';
preview.innerHTML = `
    <div class="referencia-preview-card">
      <div class="rp-info">
        <div class="rp-t">${titulo}</div>
        ${autor ? `<div class="rp-a">${autor}</div>` : ''}
      </div>
      <div class="rp-x" onclick="removerReferenciaPreview()">✕</div>
    </div>`;
}

window.removerReferenciaPreview = function () {
document.getElementById('refTitulo').value = '';
document.getElementById('refAutor').value = '';
document.getElementById('referenciaPreview').style.display = 'none';
document.getElementById('referenciaPreview').innerHTML = '';
const tipo = tipoSelecionado;
document.getElementById('buscaFilmeArea').style.display = (tipo === 'Filme') ? 'block' : 'none';
document.getElementById('buscaMusicaArea').style.display = (tipo === 'Música') ? 'block' : 'none';
document.getElementById('buscaLivroArea').style.display = (tipo === 'Livro') ? 'block' : 'none';
document.getElementById('buscaPodcastArea').style.display = (tipo === 'Podcast') ? 'block' : 'none';
};

let capaEscolhida = null;

window.escolherFilme = function (titulo, ano, filmeId, capaUrl) {
filmeIdEscolhido = filmeId;
capaEscolhida = capaUrl || null;
document.getElementById('resultadosFilme').innerHTML = '';
document.getElementById('buscaFilmeInput').value = '';
mostrarReferenciaPreview(titulo, ano);
};

window.abrirLivroPopup = function (capaUrl) {
document.getElementById('trailerPopupTituloTexto').textContent = 'Capa do livro';
const corpo = document.getElementById('trailerCorpo');
corpo.innerHTML = `<img src="${capaUrl}" style="width:100%; border-radius:12px; margin-top:8px;" />`;
document.getElementById('trailerPopupBg').classList.add('show');
};

window.curtirItemDescobrir = async function (i) {
const item = window.ITENS_DESCOBRIR_ATUAIS[i];
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;
const botao = document.getElementById(`curtida-descobrir-${i}`);

const { data: jaCurtiu } = await supabaseClient
  .from('curtidas_descobrir').select('id')
  .eq('usuario_id', meuId).eq('item_titulo', item.title).eq('item_tipo', item.kind)
  .maybeSingle();

if (jaCurtiu) {
  await supabaseClient.from('curtidas_descobrir').delete().eq('id', jaCurtiu.id);
  botao.classList.remove('liked');
} else {
  await supabaseClient.from('curtidas_descobrir').insert({ usuario_id: meuId, item_titulo: item.title, item_tipo: item.kind });
  botao.classList.add('liked');
}
};

let discoverPendenteReal = null;
window.comentarItemDescobrir = function (i) {
discoverPendenteReal = window.ITENS_DESCOBRIR_ATUAIS[i];
abrirWritePopup('💬', 'O que você achou?', discoverPendenteReal.title + ' — seu comentário vai pro feed');
};

window.compartilharItemDescobrir = async function (i) {
const item = window.ITENS_DESCOBRIR_ATUAIS[i];
const { data: sessionData } = await supabaseClient.auth.getSession();

const textoCompleto = `↗ compartilhou de Descobrir — ${item.title}${item.desc ? `

${item.desc}` : ''}`;

await supabaseClient.from('posts').insert({
  autor_id: sessionData.session.user.id,
  texto: textoCompleto,
  tipo: 'Assunto',
  privado: false,
  imagem_url: item.imagemUrl || null,
});

mostrarToast('↗ Compartilhado no seu feed');
avisarSeguidores();
carregarPostsReais();
};

window.tocarPreviewDescobrir = async function (i) {
const item = window.ITENS_DESCOBRIR_ATUAIS[i];
if (item.previewUrl) {
  abrirTrailerPopup(item.previewUrl, 'Música');
} else if (item.filmeId) {
  const resp = await fetch(`${API_BASE}/api/filme-trailer?id=${item.filmeId}`);
  const dados = await resp.json();
  if (dados.url) abrirTrailerPopup(dados.url, 'Filme');
} else if (item.collectionId) {
  const resp = await fetch(`${API_BASE}/api/podcast-episodio?id=${item.collectionId}`);
  const dados = await resp.json();
  if (dados.url) abrirTrailerPopup(dados.url, 'Podcast');
}
};

// ---------- mesmas ações, mas pros itens curados usados pra preencher o Feed (array separado do Descobrir) ----------
window.comentarPreenchimentoFeed = function (i) {
discoverPendenteReal = itensPreenchimentoFeed[i];
abrirWritePopup('💬', 'O que você achou?', discoverPendenteReal.title + ' — seu comentário vai pro feed');
};

window.compartilharPreenchimentoFeed = async function (i) {
const item = itensPreenchimentoFeed[i];
const { data: sessionData } = await supabaseClient.auth.getSession();

const textoCompleto = `↗ compartilhou de Descobrir — ${item.title}${item.desc ? `

${item.desc}` : ''}`;

await supabaseClient.from('posts').insert({
  autor_id: sessionData.session.user.id,
  texto: textoCompleto,
  tipo: 'Assunto',
  privado: false,
  imagem_url: item.imagemUrl || null,
});

mostrarToast('↗ Compartilhado no seu feed');
avisarSeguidores();
carregarPostsReais();
};

window.tocarPreviewPreenchimentoFeed = async function (i) {
const item = itensPreenchimentoFeed[i];
if (item.previewUrl) {
  abrirTrailerPopup(item.previewUrl, 'Música');
} else if (item.filmeId) {
  const resp = await fetch(`${API_BASE}/api/filme-trailer?id=${item.filmeId}`);
  const dados = await resp.json();
  if (dados.url) abrirTrailerPopup(dados.url, 'Filme');
} else if (item.collectionId) {
  const resp = await fetch(`${API_BASE}/api/podcast-episodio?id=${item.collectionId}`);
  const dados = await resp.json();
  if (dados.url) abrirTrailerPopup(dados.url, 'Podcast');
}
};


window.buscarPreviaFilmePost = async function (filmeId, tipo) {
const resp = await fetch(`${API_BASE}/api/filme-trailer?id=${filmeId}`);
const dados = await resp.json();
if (dados.url) {
  abrirTrailerPopup(dados.url, tipo);
} else {
  mostrarToast('😕 esse filme não tem prévia disponível');
}
};

window.fecharTrailerPopup = function () {
document.getElementById('trailerPopupBg').classList.remove('show');
document.getElementById('trailerCorpo').innerHTML = ''; // tira o player da tela: para o áudio/vídeo
};

window.abrirTrailerPopup = function (url, tipo) {
if (window.pararPreviaAuto) window.pararPreviaAuto();
document.getElementById('trailerPopupTituloTexto').textContent = 'Prévia';
const corpo = document.getElementById('trailerCorpo');
if (tipo === 'Música' || tipo === 'Podcast') {
  corpo.innerHTML = `
      <audio id="atomoAudio" src="${url}" style="display:none;"></audio>
      <div class="atomo-player">
        <button class="player-play-btn" id="atomoPlayBtn" onclick="alternarPlayAtomo()">⏸</button>
        <div class="player-track" onclick="pularParaPontoAtomo(event)">
          <div class="player-track-fill" id="atomoTrackFill"></div>
        </div>
        <div class="player-time" id="atomoTime">0:00</div>
      </div>`;

  const audio = document.getElementById('atomoAudio');
  audio.play();

  audio.ontimeupdate = () => {
    const pct = (audio.currentTime / audio.duration) * 100 || 0;
    document.getElementById('atomoTrackFill').style.width = pct + '%';
    const min = Math.floor(audio.currentTime / 60);
    const seg = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
    document.getElementById('atomoTime').textContent = `${min}:${seg}`;
  };
  audio.onended = () => { document.getElementById('atomoPlayBtn').textContent = '▶'; };
} else {
  const videoId = url.split('v=')[1];
  corpo.innerHTML = `<div style="position:relative; padding-top:56%; margin-top:8px;"><iframe style="position:absolute; top:0; left:0; width:100%; height:100%; border:none; border-radius:12px;" src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1" allowfullscreen></iframe></div>`;
}
document.getElementById('trailerPopupBg').classList.add('show');
};

window.alternarPlayAtomo = function () {
const audio = document.getElementById('atomoAudio');
const btn = document.getElementById('atomoPlayBtn');
if (audio.paused) { audio.play(); btn.textContent = '⏸'; }
else { audio.pause(); btn.textContent = '▶'; }
};

window.pularParaPontoAtomo = function (e) {
const audio = document.getElementById('atomoAudio');
const track = e.currentTarget;
const pct = (e.clientX - track.getBoundingClientRect().left) / track.offsetWidth;
audio.currentTime = pct * audio.duration;
};

window.buscarMusicaReal = async function () {
const termo = document.getElementById('buscaMusicaInput').value.trim();
if (!termo) return;

const resposta = await fetch(`${API_BASE}/api/buscar-musica?q=${encodeURIComponent(termo)}`);
const dados = await resposta.json();
const resultados = (dados.data || []).slice(0, 5);

document.getElementById('resultadosMusica').innerHTML = resultados.length
  ? resultados.map(m => {
      const tituloEscapado = m.title.replace(/'/g, "\\'");
      const artistaEscapado = m.artist.name.replace(/'/g, "\\'");
      return `<div class="friend-row" style="cursor:pointer;" onclick="escolherMusica('${tituloEscapado}', '${artistaEscapado}', '${m.preview}', '${m.album?.cover_medium || ''}')">
          <div class="friend-info"><div class="n">${m.title}</div><div class="s">${m.artist.name}</div></div>
        </div>`;
    }).join('')
  : `<div class="visitor-lock-note">Nenhuma música encontrada.</div>`;
};

let musicaPreviewEscolhida = null;

window.escolherMusica = function (titulo, artista, previewUrl, capaUrl) {
musicaPreviewEscolhida = previewUrl;
capaEscolhida = capaUrl || null;
document.getElementById('resultadosMusica').innerHTML = '';
document.getElementById('buscaMusicaInput').value = '';
mostrarReferenciaPreview(titulo, artista);
};


window.buscarLivroReal = async function () {
const termo = document.getElementById('buscaLivroInput').value.trim();
if (!termo) return;

const resposta = await fetch(`${API_BASE}/api/buscar-livro?q=${encodeURIComponent(termo)}`);
const dados = await resposta.json();
const resultados = (dados.items || []).slice(0, 5);

document.getElementById('resultadosLivro').innerHTML = resultados.length
  ? resultados.map(l => {
      const info = l.volumeInfo;
      const titulo = (info.title || 'Sem título').replace(/'/g, "\\'");
      const autores = (info.authors ? info.authors.join(', ') : 'Autor desconhecido').replace(/'/g, "\\'");
      return `<div class="friend-row" style="cursor:pointer;" onclick="escolherLivro('${titulo}', '${autores}', '${(l.volumeInfo.imageLinks && (l.volumeInfo.imageLinks.large || l.volumeInfo.imageLinks.medium || l.volumeInfo.imageLinks.small || l.volumeInfo.imageLinks.thumbnail)) || ''}')">
          <div class="friend-info"><div class="n">${info.title || 'Sem título'}</div><div class="s">${info.authors ? info.authors.join(', ') : ''}</div></div>
        </div>`;
    }).join('')
  : `<div class="visitor-lock-note">Nenhum livro encontrado.</div>`;
};

let capaLivroEscolhida = null;

window.escolherLivro = function (titulo, autor, capaUrl) {
capaEscolhida = capaUrl;
document.getElementById('resultadosLivro').innerHTML = '';
document.getElementById('buscaLivroInput').value = '';
mostrarReferenciaPreview(titulo, autor);
};


window.buscarPodcastReal = async function () {
const termo = document.getElementById('buscaPodcastInput').value.trim();
if (!termo) return;

const resposta = await fetch(`${API_BASE}/api/buscar-podcast?q=${encodeURIComponent(termo)}`);
const dados = await resposta.json();
const resultados = (dados.results || []).slice(0, 5);

document.getElementById('resultadosPodcast').innerHTML = resultados.length
  ? resultados.map(p => {
      const titulo = (p.collectionName || 'Sem título').replace(/'/g, "\\'");
      const artista = (p.artistName || '').replace(/'/g, "\\'");
      return `<div class="friend-row" style="cursor:pointer;" onclick="escolherPodcast('${titulo}', '${artista}', ${p.collectionId}, '${p.artworkUrl600 || p.artworkUrl100 || ''}')">
          <div class="friend-info"><div class="n">${p.collectionName}</div><div class="s">${p.artistName || ''}</div></div>
        </div>`;
    }).join('')
  : `<div class="visitor-lock-note">Nenhum podcast encontrado.</div>`;
};

let podcastIdEscolhido = null;

window.escolherPodcast = function (titulo, artista, collectionId, capaUrl) {
podcastIdEscolhido = collectionId;
capaEscolhida = capaUrl || null;
document.getElementById('resultadosPodcast').innerHTML = '';
document.getElementById('buscaPodcastInput').value = '';
mostrarReferenciaPreview(titulo, artista);
};
