/* js/roda-tempo.js — RODA DE ROLAGEM pra escolher horário (igual ao despertador do celular).
   Um componente só, usado em todo lugar que escolhe hora/minuto. Se um dia quiser mudar
   cor ou tamanho, muda aqui (e no CSS .roda-tempo) e vale pro app inteiro.

   COMO FUNCIONA:
   - cada coluna é uma lista que rola com o dedo; o CSS "scroll-snap" faz ela parar
     ENCAIXADA num número (sem ficar pela metade);
   - o número do meio fica grande e forte; os de cima/baixo vão apagando (dá a sensação de roda);
   - é "infinita": a lista é repetida várias vezes e, quando a pessoa chega perto da ponta,
     a roda volta pro meio sem ela perceber (depois do 59 vem o 00 de novo);
   - cada número que passa dá uma vibraçãozinha (tic, tic) no Android. */

const ALTURA_ITEM_RODA = 40;   // altura de cada número (px) — igual ao .roda-item no CSS
const REPETICOES_RODA = 7;     // quantas vezes a lista se repete (pra parecer infinita)

function criarRodaTempo(el, { valores, aoMudar }) {
  const n = valores.length;
  const meio = Math.floor(REPETICOES_RODA / 2) * n; // primeira posição da cópia do meio
  el.classList.add('roda-tempo');
  el.innerHTML = '';
  const trilho = document.createElement('div');
  trilho.className = 'roda-trilho';
  for (let r = 0; r < REPETICOES_RODA; r++) {
    valores.forEach((v) => {
      const item = document.createElement('div');
      item.className = 'roda-item';
      item.textContent = v;
      trilho.appendChild(item);
    });
  }
  el.appendChild(trilho);

  let indiceAtual = 0;
  let ignorarScroll = false; // true enquanto NÓS mexemos na roda (não conta como escolha da pessoa)
  let timerFim = null;

  // deixa o do meio grande e os outros apagados, conforme a distância do centro
  function pintar() {
    const centro = el.scrollTop + el.clientHeight / 2;
    for (const item of trilho.children) {
      const meioItem = item.offsetTop + ALTURA_ITEM_RODA / 2;
      const dist = Math.min(Math.abs(meioItem - centro) / (ALTURA_ITEM_RODA * 2.5), 1);
      item.style.opacity = String(1 - dist * 0.78);
      item.style.transform = `scale(${1 - dist * 0.28})`;
    }
  }

  function irPara(i) {
    ignorarScroll = true;
    indiceAtual = ((i % n) + n) % n;
    el.scrollTop = (meio + indiceAtual) * ALTURA_ITEM_RODA;
    pintar();
    setTimeout(() => { ignorarScroll = false; }, 80);
  }

  el.addEventListener('scroll', () => {
    pintar();
    const pos = Math.round(el.scrollTop / ALTURA_ITEM_RODA);
    const i = ((pos % n) + n) % n;
    if (!ignorarScroll && i !== indiceAtual) {
      indiceAtual = i;
      if (typeof vibrar === 'function') vibrar(4); // tic
      aoMudar(i);
    }
    // parou de rolar: se ficou perto da ponta da lista, volta pra cópia do meio (truque do infinito)
    clearTimeout(timerFim);
    timerFim = setTimeout(() => {
      const p = Math.round(el.scrollTop / ALTURA_ITEM_RODA);
      if (p < n || p >= (REPETICOES_RODA - 1) * n) irPara(indiceAtual);
    }, 160);
  }, { passive: true });

  // tocar num número de cima/baixo também leva até ele
  trilho.addEventListener('click', (e) => {
    const item = e.target.closest('.roda-item');
    if (!item) return;
    el.scrollTo({ top: item.offsetTop - (el.clientHeight - ALTURA_ITEM_RODA) / 2, behavior: 'smooth' });
  });

  return { irPara, get indice() { return indiceAtual; } };
}
window.criarRodaTempo = criarRodaTempo;
