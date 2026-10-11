/* js/navegacao.js — Navegação entre telas, rolagem infinita, puxar para atualizar
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- navegação ----------
window.showScreen2 = function (id) {
  const jaEstavaNessaAba = document.getElementById('screen-' + id).classList.contains('active');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === id));

  if (id === 'mensagens') {
    abrirTelaMensagens();
  }
  // voltou pra Home: o card "Seu dia" se atualiza (e vira de dia sozinho à meia-noite)
  if (id === 'perfil' && !jaEstavaNessaAba) atualizarResumoDiaDepois();

  // tocar de novo na aba Feed enquanto já tá nela = atualiza, igual outros apps
  if (id === 'descobrir' && jaEstavaNessaAba) {
    const tela = document.getElementById('screen-descobrir');
    if (tela) tela.scrollTo({ top: 0, behavior: 'smooth' });
    carregarPostsReais();
  }
};

// ---------- puxar para atualizar ----------
// rolagem infinita: perto do fim da lista, carrega mais itens sozinho
(function initRolagemInfinita() {
  const telaDescobrir = document.getElementById('screen-descobrir');
  const telaLivros = document.getElementById('screen-livros');
  if (telaDescobrir) {
    telaDescobrir.addEventListener('scroll', function () {
      if (this.scrollTop + this.clientHeight > this.scrollHeight - 400) {
        carregarMaisDescobrir();
      }
    });
  }
  if (telaLivros) {
    telaLivros.addEventListener('scroll', function () {
      if (this.scrollTop + this.clientHeight > this.scrollHeight - 400) {
        carregarMaisLivros();
      }
    });
  }
})();

// atualiza o Descobrir sozinho de tempos em tempos, enquanto a pessoa
// estiver olhando essa tela, pra não ficar sempre com os mesmos posts
setInterval(() => {
  const tela = document.querySelector('.screen.active');
  if (tela && tela.id === 'screen-descobrir') {
    renderDiscover();
  }
}, 3 * 60 * 1000);

(function initPuxarAtualizar() {
  const indicador = document.getElementById('pullRefreshIndicator');
  if (!indicador) return;

  const ATUALIZAR_POR_TELA = {
    feed: () => carregarPostsReais(),
    descobrir: () => renderDiscover(),
    livros: () => renderLivrosAtual(),
    mensagens: () => renderDmList(),
  };

  const LIMIAR = 70;
  const PUXAR_MAX = 110;
  let startY = 0;
  let puxando = false;
  let ultimaDist = 0;
  let telaAtual = null;
  let atualizando = false;
  let cruzouLimiar = false; // pra vibrar/tocar só uma vez por puxada

  function overlayAberto() {
    return !!document.querySelector('.open, .show:not(#toast2)');
  }

  function resetIndicador() {
    indicador.classList.remove('spinning');
    indicador.style.opacity = '0';
    indicador.style.transform = 'translateX(-50%) translateY(-60px) scale(0.8)';
  }

  document.addEventListener('touchstart', (e) => {
    if (atualizando || overlayAberto()) { puxando = false; return; }
    const tela = document.querySelector('.screen.active');
    if (!tela || tela.scrollTop > 0) { puxando = false; return; }
    const id = tela.id.replace('screen-', '');
    if (!ATUALIZAR_POR_TELA[id]) { puxando = false; return; }
    startY = e.touches[0].clientY;
    telaAtual = tela;
    puxando = true;
    ultimaDist = 0;
    cruzouLimiar = false;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!puxando || atualizando) return;
    if (overlayAberto() || (telaAtual && telaAtual.scrollTop > 0)) { puxando = false; resetIndicador(); return; }
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { ultimaDist = 0; resetIndicador(); return; }
    const dist = Math.min(dy * 0.5, PUXAR_MAX);
    ultimaDist = dist;
    const progresso = Math.min(dist / LIMIAR, 1);
    if (!cruzouLimiar && dist >= LIMIAR) { cruzouLimiar = true; vibrar(8); tocarSom('puxar'); }
    else if (cruzouLimiar && dist < LIMIAR) cruzouLimiar = false; // voltou atrás: pode soar de novo
    indicador.style.opacity = String(progresso);
    indicador.style.transform = `translateX(-50%) translateY(${dist - 60}px) scale(${0.8 + progresso * 0.3}) rotate(${dist * 3}deg)`;
  }, { passive: true });

  document.addEventListener('touchend', async () => {
    if (!puxando || atualizando) { puxando = false; return; }
    puxando = false;
    const disparou = ultimaDist >= LIMIAR;
    if (!disparou) { resetIndicador(); return; }

    atualizando = true;
    indicador.classList.add('spinning');
    indicador.style.opacity = '1';
    indicador.style.transform = 'translateX(-50%) translateY(4px) scale(1)';

    const id = telaAtual ? telaAtual.id.replace('screen-', '') : null;
    const fnAtualizar = id ? ATUALIZAR_POR_TELA[id] : null;
    try {
      if (fnAtualizar) await fnAtualizar();
    } catch (e) {
      console.log('erro ao atualizar:', e);
    }
    tocarSom('atualizou');
    setTimeout(() => {
      atualizando = false;
      indicador.classList.remove('spinning');
      resetIndicador();
    }, 350);
  });
})();
