/* js/dicas-unicas.js — Dicas que aparecem UMA vez só
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.

   Como usar: qualquer frase que só ensina a usar o app ganha o atributo
       data-dica-unica="nome-da-dica"
   (no index.html ou dentro dos templates do JS). E pronto: este arquivo cuida do resto.

   A regra:
   1. Quando a dica aparece de verdade na tela (não basta existir no HTML — tem que estar
      visível), o nome dela é anotado no aparelho como "já vista".
   2. Durante essa mesma visita ao app ela continua aparecendo normalmente (a pessoa ainda
      está aprendendo).
   3. Da próxima vez que o app abrir, toda dica já vista some — pra sempre.

   Por que esconder com CSS e não apagar o elemento? Alguns códigos procuram esses elementos
   pelo id (ex.: mudam o texto). Escondendo, nada quebra; só não aparece. */

(function () {
  const CHAVE = 'atomo_dicas_vistas';
  let vistas = [];
  try { vistas = JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch (e) { vistas = []; }
  const jaVistas = new Set(vistas);        // o que vai ser anotado (cresce durante o uso)
  const vistasAntes = new Set(vistas);     // o que já tinha sido visto ANTES desta visita: isso some

  // 1) esconde de uma vez tudo que já foi visto em visitas anteriores.
  //    Um <style> com uma regra por dica pega até os elementos que o JS ainda vai criar.
  if (vistasAntes.size) {
    const estilo = document.createElement('style');
    estilo.id = 'dicasUnicasVistas';
    estilo.textContent = [...vistasAntes]
      .map(nome => `[data-dica-unica="${String(nome).replace(/["\\]/g, '')}"]`)
      .join(',\n') + ' { display: none !important; }';
    document.head.appendChild(estilo);
  }

  function anotar(nome) {
    if (!nome || jaVistas.has(nome)) return;
    jaVistas.add(nome);
    try { localStorage.setItem(CHAVE, JSON.stringify([...jaVistas])); } catch (e) { /* sem storage: a dica volta a aparecer, sem problema */ }
  }

  // 2) "apareceu na tela?" — o IntersectionObserver avisa quando um elemento fica visível
  if (!('IntersectionObserver' in window)) return;
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach(e => {
      if (!e.isIntersecting) return;
      anotar(e.target.dataset.dicaUnica);
      observador.unobserve(e.target); // já anotou, não precisa mais vigiar
    });
  });
  const vigiar = (el) => {
    const nome = el.dataset.dicaUnica;
    if (nome && !vistasAntes.has(nome) && !jaVistas.has(nome)) observador.observe(el);
  };

  // dicas que já estão no HTML
  const comecar = () => {
    document.querySelectorAll('[data-dica-unica]').forEach(vigiar);
    // dicas que o JS cria depois (listas, cartões, estados vazios...): o MutationObserver
    // avisa sempre que algo novo entra na página
    new MutationObserver((mudancas) => {
      mudancas.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.dataset && n.dataset.dicaUnica) vigiar(n);
        n.querySelectorAll && n.querySelectorAll('[data-dica-unica]').forEach(vigiar);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', comecar);
  else comecar();
})();
