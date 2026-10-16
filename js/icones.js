/* js/icones.js — Paleta de ícones (traço limpo do kit) e helper icone()
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- paleta de icones: TRAÇO LIMPO (kit de botões) ----------
// PRA APRENDER: antes os ícones tinham curvinhas "feitas à mão" e ficavam
// flutuando. O kit novo pede traço LIMPO: formas geométricas (retas, círculos,
// arcos), traço de 1.5 e sem animação — mais calmo e mais nítido.
const ICONE_SVG = {
  voltar: '<path d="M15 5l-7 7 7 7"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>',
  lixeira: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
  editar: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  atualizar: '<path d="M19.5 8A8 8 0 0 0 5 9.5"/><path d="M4.5 16A8 8 0 0 0 19 14.5"/><path d="M19.5 4v4h-4M4.5 20v-4h4"/>',
  enviar: '<path d="M4 12l16-7-6 16-2.5-6.5z"/>',
  compartilhar: '<path d="M7 17L17 7"/><path d="M9 7h8v8"/>',
  convite: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4 7l8 6 8-6"/>',
  calendario: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  repostar: '<path d="M7 8h10a2 2 0 0 1 2 2v2"/><path d="M10 5L7 8l3 3"/><path d="M17 16H7a2 2 0 0 1-2-2v-2"/><path d="M14 19l3-3-3-3"/>',
  responder: '<path d="M10 8l-5 4 5 4"/><path d="M5 12h9a5 5 0 0 1 5 5v1"/>',
  salvar: '<path d="M6.5 4h11v16l-5.5-4-5.5 4z"/>',
  fixar: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
  denunciar: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>',
  cadeado: '<rect x="5" y="11" width="14" height="8.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  globo: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><path d="M12 4c2.6 2.2 2.6 13.8 0 16M12 4c-2.6 2.2-2.6 13.8 0 16"/>',
  bloquear: '<circle cx="12" cy="12" r="8"/><path d="M6.3 6.3l11.4 11.4"/>',
  check: '<path d="M5 13l4 4 10-10"/>',
  sino: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  pessoa: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  pergunta: '<circle cx="12" cy="12" r="8.3"/><path d="M9.4 9.7a2.6 2.6 0 1 1 3.7 2.4c-.9.5-1.3 1-1.3 2.1"/><circle cx="12" cy="16.7" r=".15" fill="currentColor" stroke="none"/>',
  alerta: '<path d="M12 4 21 19.5H3Z" stroke-linejoin="round"/><path d="M12 10v4.3"/><circle cx="12" cy="16.9" r=".15" fill="currentColor" stroke="none"/>',
  marco: '<path d="M6 21V4"/><path d="M6 5h12v8H6"/>',
  maisOpcoes: '<circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  relogio: '<circle cx="12" cy="12" r="8.3"/><path d="M12 7.5v5l3.3 2"/>',
  arraste: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  reordenar: '<path d="M7 4v13"/><path d="M4 7l3-3 3 3"/><path d="M17 20V7"/><path d="M14 17l3 3 3-3"/>',
  setaBaixo: '<path d="M12 4v13"/><path d="M8 13l4 4 4-4"/>',
  setaCima: '<path d="M12 20V7"/><path d="M8 11l4-4 4 4"/>',
  atualizando: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M17.2 4.2v3.3h-3.3"/><path d="M6.8 19.8v-3.3h3.3"/>',
  curtir: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  comentar: '<path d="M4 12a8 7 0 1 1 3 5.5L4 19l1-3.3A6.6 6.6 0 0 1 4 12z"/>',
  livro: '<path d="M3 5.5c3-1.5 6-1.2 9 .8 3-2 6-2.3 9-.8V19c-3-1.5-6-1.2-9 .8-3-2-6-2.3-9-.8z"/><path d="M12 6.3v13.5"/>',
  citacao: '<path d="M5 17c2-1 3-3 3-6V7H4v4h4"/><path d="M14 17c2-1 3-3 3-6V7h-4v4h4"/>',
  carrinho: '<path d="M4 5h2.2l1.3 10.4a2 2 0 0 0 2 1.7h7.3a2 2 0 0 0 2-1.6L20.3 8H7.1"/><circle cx="10.2" cy="19.6" r="1.3" fill="currentColor" stroke="none"/><circle cx="17" cy="19.6" r="1.3" fill="currentColor" stroke="none"/>',
  estante: '<path d="M3 20h18M6 20V5h3v15M10.5 20V7h3v13M16 20l-1.5-12 2.8-.4L19 20"/>',
  pessoas: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>',
  microfone: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3.5"/>',
  caixa: '<path d="M3.5 9.5h17v9a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18.5v-9Z"/><path d="M2.5 9.5l2-4.5h15l2 4.5"/><path d="M12 9.5v3"/>',
  moeda: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5v9M14.8 9.6c0-1-1-1.8-2.3-1.8-1.4 0-2.5.8-2.5 1.9 0 2.7 5 1.3 5 4 0 1.1-1.1 1.9-2.5 1.9-1.3 0-2.3-.8-2.3-1.8"/>',
  gota: '<path d="M12 3.5c3 4 6.5 8 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 11.5 9 7.5 12 3.5Z"/>',
  nota: '<path d="M9.5 17V5.3l9-1.8v10.7"/><circle cx="6.8" cy="17" r="2.7"/><circle cx="15.8" cy="15.2" r="2.7"/>',
  sticker: '<path d="M5 4h14v9l-6 7H5z"/><path d="M13 20v-5a2 2 0 0 1 2-2h4"/>',
  sol: '<circle cx="12" cy="12.2" r="4.1"/><path d="M12 3.6v2.3M12 18.3v2.3M4.8 12h2.3M16.9 12h2.3M6.9 6.9l1.6 1.6M15.5 15.5l1.6 1.6M6.9 17.3l1.6-1.6M15.5 8.7l1.6-1.6"/>',
  nublado: '<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 9a4.5 4.5 0 0 1 0 9z"/>',
  chuva: '<path d="M7 13.6a3.7 3.7 0 0 1-.4-7.3A5 5 0 0 1 16 4.5a3.8 3.8 0 0 1-.6 7.6Z"/><path d="M8.3 16.8l-1 2.3M11.8 16.8l-1 2.3M15.3 16.8l-1 2.3"/>',
  tempestade: '<path d="M7 12.6a3.7 3.7 0 0 1-.4-7.3A5 5 0 0 1 16 3.5a3.8 3.8 0 0 1-.6 7.6Z"/><path d="M12.3 12.4l-2.6 4.3h2.6L9.9 20.9"/>',
  neve: '<path d="M7 13.6a3.7 3.7 0 0 1-.4-7.3A5 5 0 0 1 16 4.5a3.8 3.8 0 0 1-.6 7.6Z"/><path d="M9 17.3v.01M12.2 18.7v.01M15.4 17.3v.01M9 20.4v.01M15.4 20.4v.01"/>',
  nevoeiro: '<path d="M4.5 9.5h15M4.5 13h10.5M4.5 16.5h15"/>',
  galeria: '<rect x="3.5" y="5" width="17" height="14" rx="2.4"/><circle cx="8.3" cy="9.6" r="1.6"/><path d="M4.5 16.6l4.5-4.3c.5-.5 1.3-.5 1.8 0l2.3 2.2 2.6-2.9c.5-.6 1.4-.6 1.9-.1l2.9 3.1"/>',
  novelo: '<circle cx="12" cy="12.5" r="7.3"/><path d="M5.5 10c3.4 2 9.6 2 13 0M4.9 14.5c4 2.3 10.2 2.3 14.2 0M7.3 18c2.6 1.3 6.8 1.3 9.4 0"/>',
  fogo: '<path d="M12 3.4c.7 3-1.9 4.6-2.7 6.9-.5 1.6-.2 2.9.6 3.8a2.9 2.9 0 0 1-1.7-2.6c-1.3 1.4-2 3.1-2 4.8 0 3.4 2.6 5.9 5.8 5.9s5.8-2.5 5.8-5.9c0-3.1-1.7-4.9-3.2-6.8-1-1.3-2-2.7-2.6-6.1Z"/>',
  estrela: '<path d="M12 3.6l2.2 5 5.5.6-4.1 3.7 1.2 5.4-4.8-2.7-4.8 2.7 1.2-5.4-4.1-3.7 5.5-.6Z"/>',
  trofeu: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8.5 20h7"/>',
  broto: '<path d="M12 20.4V12.6"/><path d="M12 12.6c0-4-3.2-6.2-7.3-6 .1 4.1 3.3 6.8 7.3 6Z"/><path d="M12 14.4c0-3.6 3-5.7 6.7-5.4-.2 3.7-3.1 6.1-6.7 5.4Z"/>',
  xicara: '<path d="M5.3 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M16.3 10.6h1.3a2.2 2.2 0 0 1 0 4.4h-1.3"/><path d="M9 5.4c-.5.8-.5 1.3 0 2.1M12.4 5.4c-.5.8-.5 1.3 0 2.1"/>',
  grafico: '<path d="M4.7 19.2V12.6"/><path d="M11.6 19.2V4.8"/><path d="M18.5 19.2v-8.6"/>',
  tema: '<path d="M12 4a8 8 0 1 0 .3 16c1 0 1.6-.6 1.6-1.4 0-.4-.2-.7-.4-1-.3-.4-.1-1 .4-1h1.5A3.4 3.4 0 0 0 19 13.2C19 8.2 16 4 12 4Z"/><circle cx="8.3" cy="10.6" r="1" fill="currentColor" stroke="none"/><circle cx="11.6" cy="7.8" r="1" fill="currentColor" stroke="none"/><circle cx="15.1" cy="9.6" r="1" fill="currentColor" stroke="none"/>',
  instalar: '<rect x="4.5" y="4.5" width="15" height="15" rx="4"/><path d="M12 9v6M9 12h6"/>',
  misturar: '<path d="M4 7h3c1.6 0 2.6.8 3.6 2.2M4 17h3c1.6 0 2.6-.8 3.6-2.2"/><path d="M12.4 9.2C13.4 7.8 14.4 7 16 7h4M12.4 14.8c1 1.4 2 2.2 3.6 2.2h4"/><path d="M17 4.3 20 7l-3 2.7M17 19.7l3-2.7-3-2.7"/>',
  comunidades: '<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5"/>',
  mao: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 12V4.5a1.5 1.5 0 0 1 3 0V12M14 12V6a1.5 1.5 0 0 1 3 0v7c0 3.3-2 6-5.5 6-2.4 0-3.6-.9-4.8-2.4L4.3 13a1.4 1.4 0 0 1 2-2l1.7 1.7"/>',
  aspas: '<path d="M7 8h.01M7 12h6M7 16h4"/><rect x="3.5" y="4" width="17" height="16" rx="3"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  entrar: '<path d="M14 4h5v16h-5"/><path d="M4 12h10M10 8l4 4-4 4"/>',
  roleta: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6L6 18" stroke-width="1"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  balao: '<path d="M4 12a8 7 0 1 1 3 5.5L4 19l1-3.3A6.6 6.6 0 0 1 4 12z"/>',
  aviao: '<path d="M21 4L3 11l6 2 2 6 3-4 4 3z"/>',
  sacola: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
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
  // "seed" ficou só por compatibilidade (era usado pra variar a flutuação)
  tamanho = tamanho || 16;
  const corCss = cor ? ('color:' + cor + ';') : '';
  const caminho = ICONE_SVG[nome] || '';
  return '<span class="icon-svg" style="width:' + tamanho + 'px;height:' + tamanho + 'px;' + corCss + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
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
