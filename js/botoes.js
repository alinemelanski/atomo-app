/* js/botoes.js — microinterações do kit de botões (ripple e explosão da curtida)

   PRA APRENDER: em vez de colocar um "onclick" em cada botão do app, usamos
   DELEGAÇÃO DE EVENTO: um único ouvinte no document escuta todos os toques e
   pergunta "o toque foi num .btn-acao ou .btn-icone?" (closest). Assim, botões
   criados depois pelo JS (cards, folhas...) também ganham o efeito sozinhos. */

document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.btn-acao, .btn-icone, .post-btn, .onboard-btn, .livro-link-externo, .clube-criar-btn');
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
// A explosão vai pro <body> com position:fixed no lugar do botão — assim ela
// continua aparecendo mesmo se o feed for redesenhado logo depois da curtida.
window.explodirCurtida = function (el) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const caixa = document.createElement('span');
  caixa.className = 'curtida-explosao';
  caixa.style.position = 'fixed';
  caixa.style.left = (r.left + Math.min(r.width, 38) / 2) + 'px'; // centro do círculo do ícone (o número fica à direita)
  caixa.style.top = (r.top + r.height / 2) + 'px';
  caixa.style.zIndex = '999';
  // 8 bolinhas, uma a cada 45 graus
  caixa.innerHTML = [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<i style="--ang:${a}deg"></i>`).join('');
  document.body.appendChild(caixa);
  setTimeout(() => caixa.remove(), 600);
};
