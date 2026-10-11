/* js/icones.js — Paleta de ícones (thin-line) e helper icone()
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- paleta de icones (thin-line, com flutuacao lenta) ----------
const ICONE_SVG = {
  voltar: '<path d="M15 6l-6 6 6 6"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  camera: '<path d="M4 8.6c0-1 .8-1.8 1.8-1.8h1L7.6 5h6.8l.8 1.8h1c1 0 1.8.8 1.8 1.8v7.6c0 1-.8 1.8-1.8 1.8H5.8C4.8 18 4 17.2 4 16.2V8.6Z"/><circle cx="12" cy="12.3" r="3"/>',
  buscar: '<circle cx="10.3" cy="10.3" r="6"/><path d="M20 20l-5.2-5.2"/>',
  lixeira: '<path d="M4.5 7h15M9.5 7V4.9c0-.5.4-.9.9-.9h3.2c.5 0 .9.4.9.9V7M6.5 7l.8 12.2c0 1 .9 1.8 1.9 1.8h5.6c1 0 1.8-.8 1.9-1.8L17.5 7"/><path d="M10.3 11v6M13.7 11v6"/>',
  editar: '<path d="M4.5 19.5l.7-3.4L15.9 5.4a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L7.2 19.1l-3.4.7Z"/><path d="M14 7.5l2.9 2.9"/>',
  enviar: '<path d="M4 12.3 19.5 4.5l-4.4 15L11 13.8 4 12.3Z"/><path d="M11 13.8l4-5.3"/>',
  compartilhar: '<path d="M8 16 16 8"/><path d="M9.5 8H16v6.5"/>',
  convite: '<rect x="4" y="6" width="16" height="12" rx="2.3"/><path d="M4.6 7l7.4 5.4L19.4 7"/>',
  calendario: '<rect x="4" y="6" width="16" height="14" rx="2.4"/><path d="M4 10.5h16"/><path d="M8.3 4v4M15.7 4v4"/>',
  link: '<path d="M10.2 13.8a3.3 3.3 0 0 0 4.9.3l2-2a3.3 3.3 0 0 0-4.6-4.7l-1 1"/><path d="M13.8 10.2a3.3 3.3 0 0 0-4.9-.3l-2 2a3.3 3.3 0 0 0 4.6 4.7l1-1"/>',
  repostar: '<path d="M6.5 8H15a3 3 0 0 1 3 3v1.2"/><path d="M9.3 5 6.5 8l2.8 3"/><path d="M17.5 16H9a3 3 0 0 1-3-3v-1.2"/><path d="M14.7 19l2.8-3-2.8-3"/>',
  responder: '<path d="M10.3 8.3 5.5 12l4.8 3.8"/><path d="M5.5 12H14a4.8 4.8 0 0 1 4.8 4.8v.9"/>',
  fixar: '<path d="M9 4.5h6l-.6 6 2.1 2.1H7.5l2.1-2.1-.6-6Z"/><path d="M12 12.6v7"/>',
  denunciar: '<path d="M6 3.5v17"/><path d="M6 4.5h11l-2.3 4L17 12.5H6"/>',
  cadeado: '<rect x="5" y="11" width="14" height="8.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  globo: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c2.6 2.2 2.6 13.8 0 16M12 4c-2.6 2.2-2.6 13.8 0 16"/>',
  bloquear: '<circle cx="12" cy="12" r="8"/><path d="M6.3 6.3l11.4 11.4"/>',
  check: '<path d="M5 13l4 4 10-10"/>',
  sino: '<path d="M12 4.2a5 5 0 0 0-5 5v3.3c0 .8-.3 1.6-.9 2.2L5 16h14l-1.1-1.3a3 3 0 0 1-.9-2.2V9.2a5 5 0 0 0-5-5Z"/><path d="M10.1 19a1.9 1.9 0 0 0 3.8 0"/>',
  pessoa: '<circle cx="12" cy="8.3" r="3.3"/><path d="M5 19.8a7 7 0 0 1 14 0"/>',
  pergunta: '<circle cx="12" cy="12" r="8.3"/><path d="M9.4 9.7a2.6 2.6 0 1 1 3.7 2.4c-.9.5-1.3 1-1.3 2.1"/><circle cx="12" cy="16.7" r=".15" fill="currentColor" stroke="none"/>',
  alerta: '<path d="M12 4 21 19.5H3Z" stroke-linejoin="round"/><path d="M12 10v4.3"/><circle cx="12" cy="16.9" r=".15" fill="currentColor" stroke="none"/>',
  marco: '<path d="M6 4v16"/><path d="M6 5.5c2-1.2 4-1.2 6 0s4 1.2 6 0v7c-2 1.2-4 1.2-6 0s-4-1.2-6 0Z"/>',
  maisOpcoes: '<circle cx="12" cy="5.5" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r=".9" fill="currentColor" stroke="none"/>',
  relogio: '<circle cx="12" cy="12" r="8.3"/><path d="M12 7.5v5l3.3 2"/>',
  arraste: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  reordenar: '<path d="M7 4v13"/><path d="M4 7l3-3 3 3"/><path d="M17 20V7"/><path d="M14 17l3 3 3-3"/>',
  setaBaixo: '<path d="M12 4v13"/><path d="M8 13l4 4 4-4"/>',
  setaCima: '<path d="M12 20V7"/><path d="M8 11l4-4 4 4"/>',
  atualizando: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M17.2 4.2v3.3h-3.3"/><path d="M6.8 19.8v-3.3h3.3"/>',
  curtir: '<path d="M12 20.2s-7-4.3-9.4-8.5C1 8.5 2 5.2 5.2 4.2c1.9-.6 3.9.1 5 1.7l1.8 2.6 1.8-2.6c1.1-1.6 3.1-2.3 5-1.7 3.2 1 4.2 4.3 2.6 7.5-2.4 4.2-9.4 8.5-9.4 8.5Z"/>',
  comentar: '<path d="M4.2 6.8c0-1.4 1.1-2.5 2.5-2.5h10.6c1.4 0 2.5 1.1 2.5 2.5v6.7c0 1.4-1.1 2.5-2.5 2.5H9.5L5 19.5v-3.5H6.7c-1.4 0-2.5-1.1-2.5-2.5Z"/>',
  livro: '<path d="M4 5.7c2.6-1.6 5.6-1.3 7.8.3.2.2.5.2.7 0 2.2-1.6 5.2-1.9 7.8-.3v11.7c-2.6-1.6-5.6-1.3-7.8.3-.2.2-.5.2-.7 0-2.2-1.6-5.2-1.9-7.8-.3Z"/><path d="M12.5 6.2v11.6"/>',
  citacao: '<path d="M7 7.6c-2.1.9-3.3 2.6-3.3 4.9 0 2 1.4 3.4 3.1 3.4 1.8 0 3.1-1.3 3.1-3 0-1.6-1.1-2.8-2.6-3 .2-1 1-1.8 2.2-2.4L7 7.6Z"/><path d="M15.8 7.6c-2.1.9-3.3 2.6-3.3 4.9 0 2 1.4 3.4 3.1 3.4 1.8 0 3.1-1.3 3.1-3 0-1.6-1.1-2.8-2.6-3 .2-1 1-1.8 2.2-2.4L15.8 7.6Z"/>',
  carrinho: '<path d="M4 5h2.2l1.3 10.4a2 2 0 0 0 2 1.7h7.3a2 2 0 0 0 2-1.6L20.3 8H7.1"/><circle cx="10.2" cy="19.6" r="1.3" fill="currentColor" stroke="none"/><circle cx="17" cy="19.6" r="1.3" fill="currentColor" stroke="none"/>',
  estante: '<path d="M4 19.5h16"/><path d="M6.5 19.5V6.5a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v13"/><path d="M12.3 19.5V8.2a1 1 0 0 1 1-1h1.4a1 1 0 0 1 1 1v11.3"/><path d="M17.9 19.5V5.5a1 1 0 0 1 1-1h.6a1 1 0 0 1 1 1v14"/>',
  pessoas: '<circle cx="8.6" cy="8" r="3"/><path d="M3.4 19.4a5.3 5.3 0 0 1 10.4-.3"/><circle cx="16.3" cy="9.2" r="2.4"/><path d="M14.8 12.3a4.6 4.6 0 0 1 5.8 3.6"/>',
  microfone: '<path d="M9 4.4a3 3 0 0 1 6 .2v6.4a3 3 0 0 1-6-.1Z"/><path d="M6.2 11a5.8 5.8 0 0 0 11.6.2"/><path d="M12 16.8v3"/>',
  caixa: '<path d="M3.5 9.5h17v9a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18.5v-9Z"/><path d="M2.5 9.5l2-4.5h15l2 4.5"/><path d="M12 9.5v3"/>',
  moeda: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5v9M14.8 9.6c0-1-1-1.8-2.3-1.8-1.4 0-2.5.8-2.5 1.9 0 2.7 5 1.3 5 4 0 1.1-1.1 1.9-2.5 1.9-1.3 0-2.3-.8-2.3-1.8"/>',
  gota: '<path d="M12 3.5c3 4 6.5 8 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 11.5 9 7.5 12 3.5Z"/>',
  nota: '<path d="M9.5 17V5.3l9-1.8v10.7"/><circle cx="6.8" cy="17" r="2.7"/><circle cx="15.8" cy="15.2" r="2.7"/>',
  sticker: '<path d="M4.4 8.2c-.6-2.5 1.3-4.4 3.8-3.9 2.6-1.7 5.9-.7 6.7 2 2.7.3 4 3.3 2.2 5.5-.4 2.7-3.3 4-5.5 2.7-2.6 1.1-5.3-.9-5.1-3.7-2.4-.7-3.4-3.4-1.5-5.2Z"/><path d="M14.6 14.1c.2 1.8 1.7 2.9 3.4 2.5"/>',
  sol: '<circle cx="12" cy="12.2" r="4.1"/><path d="M12 3.6v2.3M12 18.3v2.3M4.8 12h2.3M16.9 12h2.3M6.9 6.9l1.6 1.6M15.5 15.5l1.6 1.6M6.9 17.3l1.6-1.6M15.5 8.7l1.6-1.6"/>',
  nublado: '<path d="M7.4 17.3a4 4 0 0 1-.4-8 5.3 5.3 0 0 1 10.2-1.5A4.1 4.1 0 0 1 17 17.3Z"/>',
  chuva: '<path d="M7 13.6a3.7 3.7 0 0 1-.4-7.3A5 5 0 0 1 16 4.5a3.8 3.8 0 0 1-.6 7.6Z"/><path d="M8.3 16.8l-1 2.3M11.8 16.8l-1 2.3M15.3 16.8l-1 2.3"/>',
  tempestade: '<path d="M7 12.6a3.7 3.7 0 0 1-.4-7.3A5 5 0 0 1 16 3.5a3.8 3.8 0 0 1-.6 7.6Z"/><path d="M12.3 12.4l-2.6 4.3h2.6L9.9 20.9"/>',
  neve: '<path d="M7 13.6a3.7 3.7 0 0 1-.4-7.3A5 5 0 0 1 16 4.5a3.8 3.8 0 0 1-.6 7.6Z"/><path d="M9 17.3v.01M12.2 18.7v.01M15.4 17.3v.01M9 20.4v.01M15.4 20.4v.01"/>',
  nevoeiro: '<path d="M4.5 9.5h15M4.5 13h10.5M4.5 16.5h15"/>',
  galeria: '<rect x="3.5" y="5" width="17" height="14" rx="2.4"/><circle cx="8.3" cy="9.6" r="1.6"/><path d="M4.5 16.6l4.5-4.3c.5-.5 1.3-.5 1.8 0l2.3 2.2 2.6-2.9c.5-.6 1.4-.6 1.9-.1l2.9 3.1"/>',
  novelo: '<circle cx="12" cy="12.5" r="7.3"/><path d="M5.5 10c3.4 2 9.6 2 13 0M4.9 14.5c4 2.3 10.2 2.3 14.2 0M7.3 18c2.6 1.3 6.8 1.3 9.4 0"/>',
  fogo: '<path d="M12 3.4c.7 3-1.9 4.6-2.7 6.9-.5 1.6-.2 2.9.6 3.8a2.9 2.9 0 0 1-1.7-2.6c-1.3 1.4-2 3.1-2 4.8 0 3.4 2.6 5.9 5.8 5.9s5.8-2.5 5.8-5.9c0-3.1-1.7-4.9-3.2-6.8-1-1.3-2-2.7-2.6-6.1Z"/>',
  estrela: '<path d="M12 3.6l2.2 5 5.5.6-4.1 3.7 1.2 5.4-4.8-2.7-4.8 2.7 1.2-5.4-4.1-3.7 5.5-.6Z"/>',
  trofeu: '<path d="M7 4.5h10v4.3a5 5 0 0 1-10 0Z"/><path d="M7 5.5H4.5a2 2 0 0 0 0 4c.5 1.3 1.3 2.3 2.3 3M17 5.5h2.5a2 2 0 0 1 0 4c-.5 1.3-1.3 2.3-2.3 3"/><path d="M12 13.8v3M9 19.5h6M9.7 19.5c0-1.6.5-2.2 2.3-2.2s2.3.6 2.3 2.2"/>',
  broto: '<path d="M12 20.4V12.6"/><path d="M12 12.6c0-4-3.2-6.2-7.3-6 .1 4.1 3.3 6.8 7.3 6Z"/><path d="M12 14.4c0-3.6 3-5.7 6.7-5.4-.2 3.7-3.1 6.1-6.7 5.4Z"/>',
  xicara: '<path d="M5.3 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M16.3 10.6h1.3a2.2 2.2 0 0 1 0 4.4h-1.3"/><path d="M9 5.4c-.5.8-.5 1.3 0 2.1M12.4 5.4c-.5.8-.5 1.3 0 2.1"/>',
  grafico: '<path d="M4.7 19.2V12.6"/><path d="M11.6 19.2V4.8"/><path d="M18.5 19.2v-8.6"/>',
  tema: '<path d="M12 4a8 8 0 1 0 .3 16c1 0 1.6-.6 1.6-1.4 0-.4-.2-.7-.4-1-.3-.4-.1-1 .4-1h1.5A3.4 3.4 0 0 0 19 13.2C19 8.2 16 4 12 4Z"/><circle cx="8.3" cy="10.6" r="1" fill="currentColor" stroke="none"/><circle cx="11.6" cy="7.8" r="1" fill="currentColor" stroke="none"/><circle cx="15.1" cy="9.6" r="1" fill="currentColor" stroke="none"/>',
  instalar: '<rect x="4.5" y="4.5" width="15" height="15" rx="4"/><path d="M12 9v6M9 12h6"/>',
  misturar: '<path d="M4 7h3c1.6 0 2.6.8 3.6 2.2M4 17h3c1.6 0 2.6-.8 3.6-2.2"/><path d="M12.4 9.2C13.4 7.8 14.4 7 16 7h4M12.4 14.8c1 1.4 2 2.2 3.6 2.2h4"/><path d="M17 4.3 20 7l-3 2.7M17 19.7l3-2.7-3-2.7"/>',
  comunidades: '<path d="M12 3 3 7.5 12 12l9-4.5Z"/><path d="M3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>',
  mao: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 12V4.5a1.5 1.5 0 0 1 3 0V12M14 12V6a1.5 1.5 0 0 1 3 0v7c0 3.3-2 6-5.5 6-2.4 0-3.6-.9-4.8-2.4L4.3 13a1.4 1.4 0 0 1 2-2l1.7 1.7"/>',
  aspas: '<path d="M7 8h.01M7 12h6M7 16h4"/><rect x="3.5" y="4" width="17" height="16" rx="3"/>',
  saida: '<path d="M16 17l5-5-5-5M21 12H9M13 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/>'
};
// troca uma capa de livro que falhou ao carregar pelo mesmo retângulo
// "capa vazia" (ícone desenhado à mão, não emoji) usado quando a fonte
// nem manda imagem de capa — feito via função em vez de HTML dentro do
// atributo onerror pra não ter que escapar aspas de SVG dentro de aspas
window.mostrarCapaVaziaLivro = function (img) {
  img.outerHTML = '<div class="capa-vazia">' + icone('livro', 36) + '</div>';
};

function icone(nome, tamanho, seed, cor) {
  tamanho = tamanho || 16;
  seed = seed || 0;
  let hash = seed * 7;
  for (let k = 0; k < nome.length; k++) hash += nome.charCodeAt(k);
  const delay = ((hash % 10) * 0.22).toFixed(2);
  const dur = (3.1 + (hash % 4) * 0.35).toFixed(2);
  const corCss = cor ? ('color:' + cor + ';') : '';
  const caminho = ICONE_SVG[nome] || '';
  return '<span class="icon-svg" style="width:' + tamanho + 'px;height:' + tamanho + 'px;' +
    'animation-duration:' + dur + 's;animation-delay:' + delay + 's;' + corCss + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round">' + caminho + '</svg></span>';
}

// avatar padrao do app: quando a pessoa nao tem foto, mostra a carinha de
// papel do atomo (a mesma que gira no topo) em vez de deixar so uma letra
// sozinha -- e nunca um emoji generico, pra manter a identidade da marca
const ATOMO_AVATAR_SVG = '<svg viewBox="0 0 100 100" style="width:68%;height:68%;">' +
  '<path d="M18 12 L42 6 L58 4 L74 14 L88 10 L94 26 L96 44 L90 58 L94 74 L82 84 L66 96 L48 92 L30 98 L14 88 L6 72 L4 54 L10 38 L6 22 Z" fill="#EDE4D3" stroke="#CBBFA0" stroke-width="1.4"/>' +
  '<path d="M3,52 C7,39 27,32 51,37 C73,31 98,43 94,52 C99,61 77,68 48,62 C21,69 1,58 3,52 Z" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" transform="rotate(15 50 50)"/>' +
  '<path d="M6,47 C3,37 29,34 53,36 C71,29 95,44 91,54 C97,57 73,67 47,60 C25,72 2,55 6,47 Z" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" transform="rotate(55 50 50)"/>' +
  '<path d="M4,53 C9,40 24,34 49,38 C76,33 96,42 93,49 C98,60 76,64 52,59 C22,66 0,57 4,53 Z" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" transform="rotate(95 50 50)"/>' +
  '<path d="M5,49 C2,41 28,33 50,37 C74,32 97,44 93,53 C96,58 78,67 49,61 C20,65 3,56 5,49 Z" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" transform="rotate(135 50 50)"/>' +
  '</svg>';
function avatarConteudo(avatarUrl) { return avatarUrl ? '' : ATOMO_AVATAR_SVG; }
function avatarEstiloBg(avatarUrl) { return avatarUrl ? ("background-image:url('" + avatarUrl + "'); background-size:cover; background-position:center;") : ''; }
window.icone = icone;
