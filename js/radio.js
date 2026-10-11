/* js/radio.js — Rádio Átomo (vinil compacto no cabeçalho)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- radio atomo: vinil compacto que estica no cabecalho e toca em loop ----------
let radioTocando = false;
let radioFaixas = [];
let radioIndiceAtual = 0;

function radioEstiloSalvo() {
  try {
    const bruto = localStorage.getItem('atomoRadioEscolhido');
    return bruto ? JSON.parse(bruto) : null;
  } catch (e) { return null; }
}

function atualizarMarquee(texto) {
  const span = document.getElementById('radioMarqueeTexto');
  if (!span) return;
  span.textContent = texto;
  // reinicia a animacao do "andando" pra nao ficar cortada no meio quando troca de musica
  span.style.animation = 'none';
  void span.offsetWidth;
  span.style.animation = '';
}

async function carregarFaixasRadio() {
  const estilo = radioEstiloSalvo();
  atualizarMarquee('sintonizando...');

  // estacao de radio ao vivo (stream continuo de verdade) - so um "item" que nunca acaba
  if (estilo && estilo.tipo === 'estacao') {
    radioFaixas = [{ preview: estilo.url, title: estilo.titulo, artist: null, _aoVivo: true }];
    radioIndiceAtual = 0;
    return;
  }

  try {
    const url = (estilo && estilo.tipo === 'deezer')
      ? `${API_BASE}/api/radio-faixas?id=${encodeURIComponent(estilo.id)}`
      : `${API_BASE}/api/musicas-em-alta`;
    const resp = await fetch(url);
    const dados = await resp.json();
    radioFaixas = (dados.data || []).filter(f => f.preview);
  } catch (e) { radioFaixas = []; }
  radioIndiceAtual = 0;
}

window.alternarRadioAtomo = async function () {
  const audio = document.getElementById('radioAudio');
  const widget = document.getElementById('headerRadioWidget');

  if (radioTocando) {
    audio.pause();
    radioTocando = false;
    widget.classList.remove('aberto');
    return;
  }

  widget.classList.add('aberto');

  if (!radioFaixas.length) {
    await carregarFaixasRadio();
    if (!radioFaixas.length) {
      mostrarToast('😕 não consegui ligar o rádio agora');
      widget.classList.remove('aberto');
      atualizarMarquee('rádio Átomo');
      return;
    }
    tocarFaixaRadioAtual();
  } else {
    audio.play();
  }

  radioTocando = true;
};

function tocarFaixaRadioAtual() {
  const audio = document.getElementById('radioAudio');
  const faixa = radioFaixas[radioIndiceAtual];
  if (!faixa) return;
  audio.src = faixa.preview;
  audio.play();
  if (faixa._aoVivo) {
    atualizarMarquee('🔴 ao vivo — ' + faixa.title);
    return;
  }
  const artista = faixa.artist ? faixa.artist.name : '';
  atualizarMarquee(artista ? `${faixa.title} — ${artista}` : faixa.title);
}

window.onFaixaRadioTerminou = function () {
  if (!radioFaixas.length) return;
  radioIndiceAtual = (radioIndiceAtual + 1) % radioFaixas.length;
  tocarFaixaRadioAtual();
};

window.abrirEscolherEstiloRadio = function () {
  document.getElementById('resultadosEstiloRadio').innerHTML = '';
  document.getElementById('buscaEstiloRadioInput').value = '';
  const atual = radioEstiloSalvo();
  document.getElementById('estiloRadioAtualTexto').textContent = atual ? atual.titulo : 'variado (top do momento)';
  document.getElementById('radioEstiloOverlay').classList.add('open');
};

window.buscarEstiloRadioReal = async function () {
  const termo = document.getElementById('buscaEstiloRadioInput').value.trim();
  if (!termo) return;
  const resposta = await fetch(`${API_BASE}/api/buscar-radio?q=${encodeURIComponent(termo)}`);
  const dados = await resposta.json();
  const resultados = (dados.data || []).slice(0, 8);
  document.getElementById('resultadosEstiloRadio').innerHTML = resultados.length
    ? resultados.map(r => {
        const tituloEscapado = String(r.title).replace(/'/g, "\\'");
        return `<div class="friend-row" style="cursor:pointer;" onclick="escolherEstiloRadio(${r.id}, '${tituloEscapado}')">
            <div class="friend-info"><div class="n">${r.title}</div></div>
          </div>`;
      }).join('')
    : `<div class="visitor-lock-note">Nenhum estilo encontrado pra "${termo}".</div>`;
};

window.escolherEstiloRadio = async function (id, titulo) {
  try { localStorage.setItem('atomoRadioEscolhido', JSON.stringify({ tipo: 'deezer', id, titulo })); } catch (e) {}
  closeOverlay('radioEstiloOverlay');
  mostrarToast('📻 rádio ajustado pra ' + titulo);
  radioFaixas = [];
  if (radioTocando) {
    await carregarFaixasRadio();
    if (radioFaixas.length) tocarFaixaRadioAtual();
  }
};

window.escolherEstacaoAoVivo = async function (url, titulo) {
  try { localStorage.setItem('atomoRadioEscolhido', JSON.stringify({ tipo: 'estacao', url, titulo })); } catch (e) {}
  closeOverlay('radioEstiloOverlay');
  mostrarToast('📻 sintonizado na ' + titulo);
  radioFaixas = [];
  if (radioTocando) {
    await carregarFaixasRadio();
    if (radioFaixas.length) tocarFaixaRadioAtual();
  }
};

window.limparEstiloRadio = async function () {
  try { localStorage.removeItem('atomoRadioEscolhido'); } catch (e) {}
  closeOverlay('radioEstiloOverlay');
  mostrarToast('📻 rádio voltou a tocar o top do momento');
  radioFaixas = [];
  if (radioTocando) {
    await carregarFaixasRadio();
    if (radioFaixas.length) tocarFaixaRadioAtual();
  }
};
