/* js/botoes.js — microinterações do kit de botões (ripple e explosão da curtida)

   PRA APRENDER: em vez de colocar um "onclick" em cada botão do app, usamos
   DELEGAÇÃO DE EVENTO: um único ouvinte no document escuta todos os toques e
   pergunta "o toque foi num .btn-acao ou .btn-icone?" (closest). Assim, botões
   criados depois pelo JS (cards, folhas...) também ganham o efeito sozinhos. */

document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.btn-acao, .btn-icone');
  if (!btn || btn.disabled) return;
  const caixa = btn.getBoundingClientRect();
  const onda = document.createElement('span');
  onda.className = 'ripple';
  // posição do dedo DENTRO do botão
  onda.style.left = (e.clientX - caixa.left) + 'px';
  onda.style.top = (e.clientY - caixa.top) + 'px';
  btn.appendChild(onda);
  onda.addEventListener('animationend', () => onda.remove());
}, { passive: true });

// Explosão de bolinhas ao curtir. Uso: explodirCurtida(botaoDoCoracao)
window.explodirCurtida = function (el) {
  if (!el) return;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const caixa = document.createElement('span');
  caixa.className = 'curtida-explosao';
  // 6 bolinhas, uma a cada 60 graus
  caixa.innerHTML = [0, 60, 120, 180, 240, 300].map(a => `<i style="--ang:${a}deg"></i>`).join('');
  el.appendChild(caixa);
  setTimeout(() => caixa.remove(), 600);
};
