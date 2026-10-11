/* js/utilidades.js — Toast e pequenos atalhos de interface
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

function mostrarToast(msg) {
  const t = document.getElementById('toast2');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}
// exposta no window pra poder ser chamada direto de onclick="" no HTML
// (esses atributos rodam no escopo global, fora da IIFE onde essa funcao mora)
window.mostrarToast = mostrarToast;

window.abrirPerfilInfo = function () {
  document.getElementById('perfilInfoOverlay').classList.add('open');
};

window.abrirPaginaDiario = function () {
  document.getElementById('meuDiarioOverlay').classList.add('open');
  // o diário sempre abre na folha em branco, pronta pra escrever
  folhaAtual = 0;
  prepararFolhaNova();
  posicionarFolhas();
};
