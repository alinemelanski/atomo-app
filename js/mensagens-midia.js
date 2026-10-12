/* js/mensagens-midia.js — Figurinhas, áudio (DM e mural) e envio de mensagem
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- figurinhas coloridas do Átomo (desenhadas do zero) ----------
// antes reaproveitava o ícone de linha única (ICONE_SVG/icone()), que ficava
// genérico demais numa bolha de mensagem. Agora cada figurinha é um SVG
// colorido próprio, com contorno preto (não marrom) — mesmas 8 chaves de
// sempre (mensagem antiga continua abrindo normal) + 8 novas.
const STICKERS_ATOMO = {
coracao: 1, risada: 1, uau: 1, chorando: 1, fogo: 1, aplausos: 1, pensando: 1, livro: 1,
gato: 1, cafe: 1, estrela: 1, zzz: 1, festa: 1, joinha: 1, flor: 1, cobertorzinho: 1,
};
const INK_STICKER = '#221F1C';
const STICKERS_ATOMO_SVG = {
coracao: `
    <path d="M32 54 C10 40 4 23 16 13 C24 6 32 13 32 20 C32 13 40 6 48 13 C60 23 54 40 32 54 Z" fill="#E8607A" stroke="${INK_STICKER}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="20" cy="17" rx="4" ry="6" fill="#fff" opacity="0.3"/>
    <circle cx="24" cy="27" r="2.2" fill="${INK_STICKER}"/><circle cx="40" cy="27" r="2.2" fill="${INK_STICKER}"/>
    <ellipse cx="20" cy="33" rx="4" ry="2.3" fill="#F5A9B8" opacity="0.8"/><ellipse cx="44" cy="33" rx="4" ry="2.3" fill="#F5A9B8" opacity="0.8"/>
    <path d="M26 34 Q32 39 38 34" stroke="${INK_STICKER}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
risada: `
    <circle cx="32" cy="32" r="26" fill="#F6C445" stroke="${INK_STICKER}" stroke-width="2.5"/>
    <path d="M18 27 Q23 19 28 27" stroke="${INK_STICKER}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M36 27 Q41 19 46 27" stroke="${INK_STICKER}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M18 38 Q32 54 46 38 Q32 47 18 38 Z" fill="#8A5A2E" stroke="${INK_STICKER}" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="15" cy="38" rx="4.5" ry="2.5" fill="#F5A9B8" opacity="0.8"/><ellipse cx="49" cy="38" rx="4.5" ry="2.5" fill="#F5A9B8" opacity="0.8"/>`,
uau: `
    <circle cx="32" cy="32" r="26" fill="#A9C9E8" stroke="${INK_STICKER}" stroke-width="2.5"/>
    <path d="M18 22 Q22 18 26 21" stroke="${INK_STICKER}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M38 21 Q42 18 46 22" stroke="${INK_STICKER}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="23" cy="29" r="5" fill="#fff" stroke="${INK_STICKER}" stroke-width="1.5"/><circle cx="41" cy="29" r="5" fill="#fff" stroke="${INK_STICKER}" stroke-width="1.5"/>
    <circle cx="24.5" cy="28" r="2.2" fill="${INK_STICKER}"/><circle cx="42.5" cy="28" r="2.2" fill="${INK_STICKER}"/>
    <circle cx="32" cy="42" r="3.5" fill="${INK_STICKER}"/>`,
chorando: `
    <circle cx="32" cy="32" r="26" fill="#BFE3DE" stroke="${INK_STICKER}" stroke-width="2.5"/>
    <path d="M20 26 Q24 29 28 26" stroke="${INK_STICKER}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M36 26 Q40 29 44 26" stroke="${INK_STICKER}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M22 30 C22 38 16 40 18 48 C19.5 52 25 51 24 45 C23.5 41 22 38 22 30 Z" fill="#4FA8D8" stroke="${INK_STICKER}" stroke-width="1.2"/>
    <path d="M42 30 C42 38 48 40 46 48 C44.5 52 39 51 40 45 C40.5 41 42 38 42 30 Z" fill="#4FA8D8" stroke="${INK_STICKER}" stroke-width="1.2"/>
    <path d="M25 40 Q32 35 39 40" stroke="${INK_STICKER}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="19" cy="35" rx="3.5" ry="2" fill="#F5A9B8" opacity="0.7"/><ellipse cx="45" cy="35" rx="3.5" ry="2" fill="#F5A9B8" opacity="0.7"/>`,
fogo: `
    <path d="M32 5 C41 16 47 25 40 35 C47 31 50 40 46 48 C40 60 20 60 16 45 C13 35 19 28 23 32 C18 22 24 9 32 5 Z" fill="#F0793C" stroke="${INK_STICKER}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M32 28 C36 33 38 37 35 43 C38 41 40 45 38 50 C34 57 24 57 22 48 C20 42 24 40 26 42 C24 35 28 31 32 28 Z" fill="#FBD24C"/>
    <circle cx="27" cy="43" r="2" fill="${INK_STICKER}"/><circle cx="37" cy="43" r="2" fill="${INK_STICKER}"/>
    <path d="M27 48 Q32 51 37 48" stroke="${INK_STICKER}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <ellipse cx="24" cy="46" rx="2.5" ry="1.5" fill="#F5A9B8" opacity="0.6"/><ellipse cx="40" cy="46" rx="2.5" ry="1.5" fill="#F5A9B8" opacity="0.6"/>`,
aplausos: `
    <path d="M18 30 C10 26 8 16 14 12 C20 8 28 12 30 20 C32 28 26 34 18 30 Z" fill="#E7A97B" stroke="${INK_STICKER}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M46 30 C54 26 56 16 50 12 C44 8 36 12 34 20 C32 28 38 34 46 30 Z" fill="#E7A97B" stroke="${INK_STICKER}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M22 27 L26 23 M26 30 L30 25 M14 24 L18 19" stroke="${INK_STICKER}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M42 27 L38 23 M38 30 L34 25 M50 24 L46 19" stroke="${INK_STICKER}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M32 8 L33.5 12 L37.5 12 L34.5 14.6 L35.6 18.6 L32 16.2 L28.4 18.6 L29.5 14.6 L26.5 12 L30.5 12 Z" fill="#F0B429"/>
    <circle cx="14" cy="40" r="1.6" fill="#F0B429"/><circle cx="50" cy="40" r="1.6" fill="#F0B429"/>
    <circle cx="10" cy="34" r="1.2" fill="#F0B429"/><circle cx="54" cy="34" r="1.2" fill="#F0B429"/>`,
pensando: `
    <circle cx="30" cy="34" r="22" fill="#D9CBEA" stroke="${INK_STICKER}" stroke-width="2.3"/>
    <path d="M20 30 Q24 27 28 30" stroke="${INK_STICKER}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="38" cy="27" r="1.8" fill="${INK_STICKER}"/>
    <path d="M22 40 Q30 45 36 39" stroke="${INK_STICKER}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="19" cy="38" rx="3.5" ry="2" fill="#F5A9B8" opacity="0.7"/>
    <circle cx="46" cy="16" r="3" fill="#D9CBEA" stroke="${INK_STICKER}" stroke-width="1.5"/>
    <circle cx="52" cy="10" r="2" fill="#D9CBEA" stroke="${INK_STICKER}" stroke-width="1.3"/>
    <circle cx="56" cy="6" r="1.3" fill="#D9CBEA" stroke="${INK_STICKER}" stroke-width="1"/>`,
livro: `
    <path d="M8 14 C18 8 26 10 30 15 V50 C26 45 18 43 8 48 Z" fill="#F6EDE1" stroke="${INK_STICKER}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M56 14 C46 8 38 10 34 15 V50 C38 45 46 43 56 48 Z" fill="#F6EDE1" stroke="${INK_STICKER}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 15 V50" stroke="#C1694F" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M13 22 L24 22 M13 27 L22 27" stroke="#C9B79A" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M40 22 L51 22 M42 27 L51 27" stroke="#C9B79A" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M22 34 C22 31 26 31 26 34 C26 31 30 31 30 34 C30 38 26 41 26 41 C26 41 22 38 22 34 Z" fill="#E8607A"/>`,
gato: `
    <path d="M16 20 L22 8 L28 20 Z" fill="#FBEEDD" stroke="${INK_STICKER}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M48 20 L42 8 L36 20 Z" fill="#FBEEDD" stroke="${INK_STICKER}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M18 18 L22 12 L25 18 Z" fill="#F5A9B8"/><path d="M46 18 L42 12 L39 18 Z" fill="#F5A9B8"/>
    <circle cx="32" cy="34" r="22" fill="#FBEEDD" stroke="${INK_STICKER}" stroke-width="2.3"/>
    <path d="M22 32 Q25 28 28 32" stroke="${INK_STICKER}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M36 32 Q39 28 42 32" stroke="${INK_STICKER}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M30 38 L34 38 L32 41 Z" fill="#F5A9B8"/>
    <path d="M32 41 Q32 44 28 45 M32 41 Q32 44 36 45" stroke="${INK_STICKER}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M10 36 L20 34 M10 40 L20 39" stroke="${INK_STICKER}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M54 36 L44 34 M54 40 L44 39" stroke="${INK_STICKER}" stroke-width="1.3" stroke-linecap="round"/>
    <ellipse cx="20" cy="40" rx="3.5" ry="2" fill="#F5A9B8" opacity="0.75"/><ellipse cx="44" cy="40" rx="3.5" ry="2" fill="#F5A9B8" opacity="0.75"/>`,
cafe: `
    <path d="M14 24 H42 V44 C42 50 37 54 28 54 C19 54 14 50 14 44 Z" fill="#fff" stroke="${INK_STICKER}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M42 28 C50 28 50 42 42 42" stroke="${INK_STICKER}" stroke-width="2.3" fill="none"/>
    <path d="M20 20 Q22 15 19 11 M28 20 Q30 15 27 11 M36 20 Q38 15 35 11" stroke="#C1694F" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <circle cx="22" cy="36" r="2" fill="${INK_STICKER}"/><circle cx="34" cy="36" r="2" fill="${INK_STICKER}"/>
    <path d="M22 42 Q28 46 34 42" stroke="${INK_STICKER}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <ellipse cx="19" cy="40" rx="3" ry="1.8" fill="#F5A9B8" opacity="0.7"/><ellipse cx="37" cy="40" rx="3" ry="1.8" fill="#F5A9B8" opacity="0.7"/>
    <rect x="14" y="24" width="28" height="4" fill="#C1694F"/>`,
estrela: `
    <path d="M32 6 L38.5 24 L58 24 L42.5 35.5 L48 54 L32 43 L16 54 L21.5 35.5 L6 24 L25.5 24 Z" fill="#F0B429" stroke="${INK_STICKER}" stroke-width="2.3" stroke-linejoin="round"/>
    <circle cx="26" cy="30" r="2" fill="${INK_STICKER}"/><circle cx="38" cy="30" r="2" fill="${INK_STICKER}"/>
    <path d="M26 36 Q32 40 38 36" stroke="${INK_STICKER}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <ellipse cx="22" cy="33" rx="2.5" ry="1.6" fill="#E8607A" opacity="0.6"/><ellipse cx="42" cy="33" rx="2.5" ry="1.6" fill="#E8607A" opacity="0.6"/>`,
zzz: `
    <path d="M40 8 C28 8 18 18 18 30 C18 42 28 52 40 52 C32 52 25 44 25 30 C25 16 32 8 40 8 Z" fill="#C9B8E0" stroke="${INK_STICKER}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M27 26 Q29 23 32 25" stroke="${INK_STICKER}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M28 33 Q31 36 34 33" stroke="${INK_STICKER}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <text x="42" y="16" font-family="sans-serif" font-weight="700" font-size="9" fill="${INK_STICKER}">Z</text>
    <text x="48" y="24" font-family="sans-serif" font-weight="700" font-size="7" fill="${INK_STICKER}">z</text>
    <text x="52" y="30" font-family="sans-serif" font-weight="700" font-size="5" fill="${INK_STICKER}">z</text>`,
festa: `
    <path d="M14 50 L26 18 L42 34 Z" fill="#F0793C" stroke="${INK_STICKER}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M18 40 L34 26 M20 45 L37 31" stroke="#F6EDE1" stroke-width="1.6"/>
    <circle cx="42" cy="14" r="2" fill="#E8607A"/><circle cx="50" cy="20" r="1.6" fill="#4F8C82"/><circle cx="48" cy="10" r="1.4" fill="#F0B429"/>
    <rect x="44" y="26" width="3" height="3" fill="#4F8C82" transform="rotate(20 45.5 27.5)"/>
    <rect x="52" y="34" width="3" height="3" fill="#E8607A" transform="rotate(-15 53.5 35.5)"/>
    <circle cx="38" cy="6" r="1.4" fill="#4F8C82"/>
    <rect x="30" y="10" width="2.6" height="2.6" fill="#F0B429" transform="rotate(30 31 11)"/>`,
joinha: `
    <path d="M20 30 H16 C13 30 11 32 11 35 V48 C11 51 13 53 16 53 H20 Z" fill="#E7A97B" stroke="${INK_STICKER}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M20 30 L26 12 C27 9 31 9 31 13 C31 16 29 20 29 20 H44 C48 20 50 23 48 27 C50 28 51 31 49 34 C51 36 51 39 48 41 C50 43 49 47 45 47 H24 V30" fill="#E7A97B" stroke="${INK_STICKER}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="16" cy="40" r="1.6" fill="${INK_STICKER}" opacity="0.5"/>
    <path d="M34 6 L35.5 10 L39.5 10 L36.5 12.6 L37.6 16.6 L34 14.2 L30.4 16.6 L31.5 12.6 L28.5 10 L32.5 10 Z" fill="#F0B429"/>`,
flor: `
    <ellipse cx="32" cy="16" rx="9" ry="12" fill="#F3B4C0" stroke="${INK_STICKER}" stroke-width="1.6"/>
    <ellipse cx="32" cy="48" rx="9" ry="12" fill="#F3B4C0" stroke="${INK_STICKER}" stroke-width="1.6"/>
    <ellipse cx="16" cy="32" rx="12" ry="9" fill="#F3B4C0" stroke="${INK_STICKER}" stroke-width="1.6"/>
    <ellipse cx="48" cy="32" rx="12" ry="9" fill="#F3B4C0" stroke="${INK_STICKER}" stroke-width="1.6"/>
    <ellipse cx="20.5" cy="20.5" rx="10" ry="7" fill="#F3B4C0" stroke="${INK_STICKER}" stroke-width="1.6" transform="rotate(45 20.5 20.5)"/>
    <ellipse cx="43.5" cy="43.5" rx="10" ry="7" fill="#F3B4C0" stroke="${INK_STICKER}" stroke-width="1.6" transform="rotate(45 43.5 43.5)"/>
    <circle cx="32" cy="32" r="11" fill="#F0B429" stroke="${INK_STICKER}" stroke-width="2"/>
    <circle cx="28" cy="30" r="1.6" fill="${INK_STICKER}"/><circle cx="36" cy="30" r="1.6" fill="${INK_STICKER}"/>
    <path d="M28 35 Q32 38 36 35" stroke="${INK_STICKER}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M32 54 V60" stroke="#4F8C82" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 57 C 26 55 24 59 27 62" fill="#4F8C82"/>`,
cobertorzinho: `
    <path d="M32 14 C42 14 50 24 50 36 C50 46 48 56 32 56 C16 56 14 46 14 36 C14 24 22 14 32 14 Z" fill="#C1694F" stroke="${INK_STICKER}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M18 30 L46 30 M20 40 L44 40 M22 48 L42 48" stroke="#F6EDE1" stroke-width="1.6" opacity="0.55"/>
    <circle cx="32" cy="20" r="10" fill="#FBEEDD" stroke="${INK_STICKER}" stroke-width="2"/>
    <path d="M27 19 Q28.5 17 30 19" stroke="${INK_STICKER}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M34 19 Q35.5 17 37 19" stroke="${INK_STICKER}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M28 24 Q32 27 36 24" stroke="${INK_STICKER}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="26" cy="22" rx="2.2" ry="1.4" fill="#F5A9B8" opacity="0.75"/><ellipse cx="38" cy="22" rx="2.2" ry="1.4" fill="#F5A9B8" opacity="0.75"/>
    <rect x="26" y="42" width="12" height="10" rx="3" fill="#fff" stroke="${INK_STICKER}" stroke-width="1.8"/>
    <path d="M38 44 C43 44 43 50 38 50" stroke="${INK_STICKER}" stroke-width="1.6" fill="none"/>
    <path d="M29 40 Q30 37 28 34 M33 40 Q34 37 32 34" stroke="#C9B8E0" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
};
// devolve o HTML pronto de uma figurinha (ou um emoji de fallback se a chave
// for de uma versão futura que essa aba ainda não conhece)
function stickerHtml(chave, tamanho) {
tamanho = tamanho || 46;
const miolo = STICKERS_ATOMO_SVG[chave];
if (!miolo) return '🎨';
return '<span style="display:inline-block;width:' + tamanho + 'px;height:' + tamanho + 'px;">' +
  '<svg viewBox="0 0 64 64" width="100%" height="100%">' + miolo + '</svg></span>';
}
window.stickerHtml = stickerHtml;

window.toggleStickerPicker = async function () {
const area = document.getElementById('stickerPickerArea');
const abrindo = area.style.display === 'none';
area.style.display = abrindo ? 'block' : 'none';
if (abrindo) {
  document.getElementById('resultadosSticker').innerHTML = `<div class="visitor-lock-note">Carregando...</div>`;
  await carregarStickersEmAlta();
}
};

// clicar fora do seletor de figurinha (mas dentro do chat) fecha ele sozinho,
// sem precisar clicar de novo no botao de sticker pra fechar
document.addEventListener('click', function (e) {
const area = document.getElementById('stickerPickerArea');
if (!area || area.style.display === 'none') return;
if (area.contains(e.target)) return;
const toggleBtn = e.target.closest('[onclick="toggleStickerPicker()"]');
if (toggleBtn) return;
area.style.display = 'none';
});

// extrai a URL da imagem da resposta do Klipy — tenta os campos mais prováveis
// (webp/png/gif, tamanho médio ou pequeno) porque não achei a doc pública com
// o formato exato de figurinha; se vier vazio, é sinal de ajustar esse trecho
function urlDaFigurinha(item) {
return item.images?.fixed_width?.url || item.images?.original?.url ||
  item.images?.downsized?.url || item.images?.fixed_width_small?.url ||
  item.url || '';
}

async function carregarStickersEmAlta() {
try {
  const resposta = await fetch(`${API_BASE}/api/stickers-em-alta`);
  const dados = await resposta.json();
  const resultados = (dados.data?.data || dados.data || []).slice(0, 24);
  if (!resultados.length) console.log('resposta de stickers-em-alta sem resultado usável:', dados);
  document.getElementById('resultadosSticker').innerHTML = resultados.length
    ? resultados.map(s => {
        const url = urlDaFigurinha(s);
        return url ? `<img src="${url}" style="width:100%; border-radius:10px; cursor:pointer; background:var(--card); border:1px solid var(--card-b);" onclick="enviarStickerEscolhida('${url}')" />` : '';
      }).join('')
    : `<div class="visitor-lock-note">Não consegui carregar figurinhas agora.</div>`;
} catch (e) {
  console.log('erro ao carregar stickers em alta:', e.message);
  document.getElementById('resultadosSticker').innerHTML = `<div class="visitor-lock-note">Não consegui carregar figurinhas agora.</div>`;
}
}

window.buscarStickerReal = async function () {
const termo = document.getElementById('buscaStickerInput').value.trim();
if (!termo) { await carregarStickersEmAlta(); return; }
document.getElementById('resultadosSticker').innerHTML = `<div class="visitor-lock-note">Buscando...</div>`;
try {
  const resposta = await fetch(`${API_BASE}/api/buscar-sticker?q=${encodeURIComponent(termo)}`);
  const dados = await resposta.json();
  const resultados = (dados.data?.data || dados.data || []).slice(0, 16);
  document.getElementById('resultadosSticker').innerHTML = resultados.length
    ? resultados.map(s => {
        const url = urlDaFigurinha(s);
        return url ? `<img src="${url}" style="width:100%; border-radius:10px; cursor:pointer; background:var(--card); border:1px solid var(--card-b);" onclick="enviarStickerEscolhida('${url}')" />` : '';
      }).join('')
    : `<div class="visitor-lock-note">Nenhuma figurinha encontrada.</div>`;
} catch (e) {
  document.getElementById('resultadosSticker').innerHTML = `<div class="visitor-lock-note">Não consegui buscar agora.</div>`;
}
};

// manda a figurinha do Klipy como imagem — reaproveita o mesmo tipo_conteudo
// 'gif' que a bolha de mensagem já sabe renderizar, sem precisar de nada novo
window.enviarStickerEscolhida = async function (url) {
const { data: sessionData } = await supabaseClient.auth.getSession();
const { error } = await supabaseClient.from('mensagens').insert({
  conversa_id: conversaAbertaId,
  autor_id: sessionData.session.user.id,
  texto: url,
  tipo_conteudo: 'gif',
});
if (error) { mostrarToast('❌ erro: ' + error.message); return; }
document.getElementById('stickerPickerArea').style.display = 'none';
await renderDmMsgs();
};

window.enviarSticker = async function (chave) {
const { data: sessionData } = await supabaseClient.auth.getSession();
const { error } = await supabaseClient.from('mensagens').insert({
  conversa_id: conversaAbertaId,
  autor_id: sessionData.session.user.id,
  texto: chave,
  tipo_conteudo: 'sticker',
});
if (error) { mostrarToast('❌ erro: ' + error.message); return; }
document.getElementById('stickerPickerArea').style.display = 'none';
await renderDmMsgs();
};

// ---------- mensagem de voz (gravação e player por mensagem) ----------
let mediaRecorderAtomo = null;
let chunksAudioAtomo = [];
let gravandoAudio = false;
let inicioGravacaoTs = null;
let intervaloGravacaoUi = null;

window.alternarGravacaoAudio = async function () {
if (gravandoAudio) { pararGravacaoAudio(); return; }
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  mostrarToast('❌ esse navegador não permite gravar áudio');
  return;
}
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunksAudioAtomo = [];
  mediaRecorderAtomo = new MediaRecorder(stream);
  mediaRecorderAtomo.ondataavailable = e => { if (e.data.size > 0) chunksAudioAtomo.push(e.data); };
  mediaRecorderAtomo.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunksAudioAtomo, { type: 'audio/webm' });
    if (blob.size > 0) enviarAudioGravado(blob);
  };
  mediaRecorderAtomo.start();
  gravandoAudio = true;
  inicioGravacaoTs = Date.now();
  atualizarBotaoGravacao();
  intervaloGravacaoUi = setInterval(atualizarBotaoGravacao, 500);
} catch (e) {
  mostrarToast('❌ não consegui acessar o microfone');
}
};

function pararGravacaoAudio() {
if (mediaRecorderAtomo && gravandoAudio) mediaRecorderAtomo.stop();
gravandoAudio = false;
clearInterval(intervaloGravacaoUi);
atualizarBotaoGravacao();
}

function atualizarBotaoGravacao() {
const btn = document.getElementById('btnGravarAudio');
if (!btn) return;
if (gravandoAudio) {
  const seg = Math.floor((Date.now() - inicioGravacaoTs) / 1000);
  const m = Math.floor(seg / 60);
  const s = (seg % 60).toString().padStart(2, '0');
  btn.innerHTML = `⏺ ${m}:${s}`;
  btn.classList.add('gravando');
} else {
  btn.innerHTML = '<span class="icon-svg" style="width:14px;height:14px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3.5"/></svg></span>';
  btn.classList.remove('gravando');
}
}

async function enviarAudioGravado(blob) {
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;
const caminho = `${meuId}/audio-dm-${Date.now()}.webm`;

mostrarToast('🎙️ enviando áudio...');
const { error: erroUpload } = await supabaseClient.storage.from('midia-posts').upload(caminho, blob, { contentType: 'audio/webm' });
if (erroUpload) { mostrarToast('❌ erro no envio: ' + erroUpload.message); return; }

const { data } = supabaseClient.storage.from('midia-posts').getPublicUrl(caminho);

const { error } = await supabaseClient.from('mensagens').insert({
  conversa_id: conversaAbertaId,
  autor_id: meuId,
  texto: data.publicUrl,
  tipo_conteudo: 'audio',
});
if (error) { mostrarToast('❌ erro: ' + error.message); return; }
await renderDmMsgs();
}

function gerarBarrasOndaVoz(seed) {
let s = 0;
for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
const n = 24;
let bars = '';
for (let i = 0; i < n; i++) {
  s = (s * 1103515245 + 12345) >>> 0;
  const h = 5 + (s % 1000) / 1000 * 15; // altura entre 5 e 20 (viewBox de 24)
  const x = (i * (100 / n)).toFixed(2);
  const y = ((24 - h) / 2).toFixed(2);
  bars += `<rect x="${x}" y="${y}" width="${(100 / n * 0.62).toFixed(2)}" height="${h.toFixed(2)}" rx="1"/>`;
}
return bars;
}

function vozBubbleHtml(m) {
const id = 'voice-' + m.id;
const barras = gerarBarrasOndaVoz(String(m.id));
return `
    <div class="voice-bubble-player">
      <audio id="${id}-audio" src="${m.texto}" preload="metadata" style="display:none;"></audio>
      <button class="player-play-btn" onclick="alternarPlayVoz(this,'${id}')">▶</button>
      <div class="voice-wave-track" onclick="pularParaPontoVoz(event,'${id}')">
        <svg class="voice-wave-bg" viewBox="0 0 100 24" preserveAspectRatio="none">${barras}</svg>
        <svg class="voice-wave-fill" id="${id}-fill" viewBox="0 0 100 24" preserveAspectRatio="none">${barras}</svg>
      </div>
      <div class="player-time" id="${id}-time">0:00</div>
    </div>`;
}

window.alternarPlayVoz = function (btn, id) {
const audio = document.getElementById(id + '-audio');
if (!audio) return;
if (audio.paused) {
  document.querySelectorAll('#dmMessages audio').forEach(a => { if (a !== audio) a.pause(); });
  document.querySelectorAll('.voice-bubble-player .player-play-btn').forEach(b => { if (b !== btn) b.textContent = '▶'; });
  audio.play();
  btn.textContent = '⏸';
} else {
  audio.pause();
  btn.textContent = '▶';
}
audio.ontimeupdate = () => {
  const pct = (audio.currentTime / audio.duration) * 100 || 0;
  const fill = document.getElementById(id + '-fill');
  if (fill) fill.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  const min = Math.floor(audio.currentTime / 60);
  const seg = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
  const timeEl = document.getElementById(id + '-time');
  if (timeEl) timeEl.textContent = `${min}:${seg}`;
};
audio.onended = () => { btn.textContent = '▶'; };
};

window.pularParaPontoVoz = function (e, id) {
const audio = document.getElementById(id + '-audio');
const track = e.currentTarget;
const pct = (e.clientX - track.getBoundingClientRect().left) / track.offsetWidth;
if (audio && audio.duration) audio.currentTime = pct * audio.duration;
const fill = document.getElementById(id + '-fill');
if (fill) fill.style.clipPath = `inset(0 ${100 - pct * 100}% 0 0)`;
};

// ---------- audio no mural (clube/comunidade) -- grava e sobe como post,
// reaproveitando o mesmo player de onda sonora (vozBubbleHtml) que as
// mensagens de audio da DM ja usam ----------
let mediaRecorderMural = null;
let chunksAudioMural = [];
let gravandoAudioMural = false;
let inicioGravacaoMuralTs = null;
let intervaloGravacaoMuralUi = null;

const BTN_GRAVAR_MURAL_ID = { clube: 'btnGravarAudioMuralClube', comunidade: 'btnGravarAudioMuralComunidade' };
const ICONE_MIC_MURAL = '<span class="icon-svg" style="width:15px;height:15px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3.5"/></svg></span>';

window.alternarGravacaoAudioMural = async function (origem) {
if (gravandoAudioMural) { pararGravacaoAudioMural(origem); return; }
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  mostrarToast('❌ esse navegador não permite gravar áudio');
  return;
}
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunksAudioMural = [];
  mediaRecorderMural = new MediaRecorder(stream);
  mediaRecorderMural.ondataavailable = e => { if (e.data.size > 0) chunksAudioMural.push(e.data); };
  mediaRecorderMural.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunksAudioMural, { type: 'audio/webm' });
    if (blob.size > 0) enviarAudioGravadoMural(blob, origem);
  };
  mediaRecorderMural.start();
  gravandoAudioMural = true;
  inicioGravacaoMuralTs = Date.now();
  atualizarBotaoGravacaoMural(origem);
  intervaloGravacaoMuralUi = setInterval(() => atualizarBotaoGravacaoMural(origem), 500);
} catch (e) {
  mostrarToast('❌ não consegui acessar o microfone');
}
};

function pararGravacaoAudioMural(origem) {
if (mediaRecorderMural && gravandoAudioMural) mediaRecorderMural.stop();
gravandoAudioMural = false;
clearInterval(intervaloGravacaoMuralUi);
atualizarBotaoGravacaoMural(origem);
}

function atualizarBotaoGravacaoMural(origem) {
const btn = document.getElementById(BTN_GRAVAR_MURAL_ID[origem]);
if (!btn) return;
if (gravandoAudioMural) {
  const seg = Math.floor((Date.now() - inicioGravacaoMuralTs) / 1000);
  const m = Math.floor(seg / 60);
  const s = (seg % 60).toString().padStart(2, '0');
  btn.innerHTML = `⏺ ${m}:${s}`;
  btn.classList.add('gravando');
} else {
  btn.innerHTML = ICONE_MIC_MURAL;
  btn.classList.remove('gravando');
}
}

async function enviarAudioGravadoMural(blob, origem) {
const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;
const caminho = `${meuId}/audio-mural-${Date.now()}.webm`;

mostrarToast('🎙️ enviando áudio...');
const { error: erroUpload } = await supabaseClient.storage.from('midia-posts').upload(caminho, blob, { contentType: 'audio/webm' });
if (erroUpload) { mostrarToast('❌ erro no envio: ' + erroUpload.message); return; }

const { data } = supabaseClient.storage.from('midia-posts').getPublicUrl(caminho);

const payload = origem === 'clube'
  ? { autor_id: meuId, texto: '', tipo: 'Clube', privado: false, clube_id: clubeAtualId,
      capitulo_livro: clubeCapituloAtual.capitulo || null, tem_spoiler: false, audio_url: data.publicUrl }
  : { autor_id: meuId, texto: '', tipo: 'Comunidade', privado: false, comunidade_estudo_id: comunidadeEstudoAtualId, audio_url: data.publicUrl };

const { error } = await supabaseClient.from('posts').insert(payload);
if (error) { mostrarToast('❌ erro: ' + error.message); return; }

if (origem === 'clube') renderMuralClube(); else renderMuralComunidadeEstudo();
}

window.enviarDmMsg = async function () {
const input = document.getElementById('dmChatInput');
const val = input.value.trim();
if (!val || !conversaAbertaId) return;

const { data: sessionData } = await supabaseClient.auth.getSession();
const meuId = sessionData.session.user.id;

const { data: conversa } = await supabaseClient.from('conversas').select('usuario1_id, usuario2_id').eq('id', conversaAbertaId).maybeSingle();
const outroId = conversa.usuario1_id === meuId ? conversa.usuario2_id : conversa.usuario1_id;

const { data: bloqueioExistente } = await supabaseClient
  .from('bloqueios')
  .select('id')
  .or(`and(usuario_id.eq.${meuId},bloqueado_id.eq.${outroId}),and(usuario_id.eq.${outroId},bloqueado_id.eq.${meuId})`)
  .maybeSingle();

if (bloqueioExistente) {
  mostrarToast('❌ Não é possível enviar mensagem — bloqueio ativo entre vocês');
  return;
}

const { error } = await supabaseClient.from('mensagens').insert({
  conversa_id: conversaAbertaId,
  autor_id: meuId,
  texto: val,
});

if (error) { mostrarToast('❌ erro: ' + error.message); return; }

input.value = '';
window.salvarRascunho('dm_' + conversaAbertaId, '');
await renderDmMsgs();

// notificação in-app (funciona até nos dispositivos que ainda não pegaram
// o realtime/push novo) + push de verdade quando disponível
const { data: donoConversa } = await supabaseClient.from('usuarios').select('notif_ativado').eq('id', outroId).maybeSingle();
if (!donoConversa || donoConversa.notif_ativado !== false) {
  const { error: erroNotifDm } = await supabaseClient.from('notificacoes').insert({
    usuario_id: outroId,
    tipo: 'mensagem',
    titulo: 'Nova mensagem',
    subtitulo: `@${window.MEU_HANDLE || 'alguém'}: ${val.slice(0, 60)}`,
    ator_id: meuId,
  });
  if (erroNotifDm) console.log('erro ao criar notificação de mensagem:', erroNotifDm.message);
}
notificarPushEvento(outroId, 'mensagem', { ator_id: meuId });
notificarMencoes(val, meuId, 'numa mensagem');
};

window.abrirDmDireto = async function (id) {
const amigo = SEGUINDO.find(a => a.id === id) || SEGUIDORES.find(a => a.id === id) || SUGESTOES.find(a => a.id === id);
closeOverlay('amigosOverlay');
await abrirDm(id, amigo ? amigo.nome : 'alguém');
};

window.abrirPerfilDoAmigo = async function (id) {
closeOverlay('amigosOverlay');
await abrirPerfilAlheio(id);
};
