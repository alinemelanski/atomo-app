/* js/etimologia.js — "Palavra do dia": etimologia em forma de árvore genealógica
   Script comum (sem módulo). Os dados ficam em js/etimologia-palavras.js.

   COMO FUNCIONA (pra aprender):
   - Cada dia tem uma palavra. O dia escolhe a palavra por RODÍZIO: conta quantos
     dias se passaram desde DATA_INICIO e usa o resto da divisão pelo total de
     palavras (%). Assim todo mundo vê a mesma palavra no mesmo dia, e ela só
     repete depois de passar por todas.
   - Cada página (folha) é um dia: a de hoje vem primeiro e, deslizando, aparecem
     os dias anteriores — o caderno vai crescendo com o tempo.
   - A árvore: a palavra fica no topo. Tocar nela abre os galhos (significado,
     raiz, significado profundo, família). Tocar num galho abre o que tem dentro;
     na "raiz", cada antepassado abre o próximo, do mais recente pro mais antigo,
     como subir numa árvore genealógica. Tocar na palavra de novo recolhe tudo.
   - Abrir/fechar é só trocar a classe CSS "aberto" — quem esconde e anima é o CSS. */

const DATA_INICIO_ETIMO = '2026-10-05'; // primeiro dia do caderno de palavras
let etimoFolhaAtual = 0;
let etimoDias = []; // [{ data: Date, palavra }] — índice 0 = hoje

// quantos dias inteiros entre duas datas "AAAA-MM-DD" (sem se confundir com fuso)
function diasEntre(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function montarDiasEtimologia() {
  const hoje = diaLocal(new Date()); // diaLocal está em js/diario.js
  const total = Math.max(0, diasEntre(DATA_INICIO_ETIMO, hoje));
  etimoDias = [];
  for (let n = total; n >= 0; n--) {
    const data = new Date(); data.setDate(data.getDate() - (total - n));
    etimoDias.push({ data, palavra: PALAVRAS_ETIMOLOGIA[n % PALAVRAS_ETIMOLOGIA.length] });
  }
}

const etimoTxt = (campo) => (campo && (campo[idiomaAtual] || campo.pt)) || '';
// escapa texto antes de pôr no HTML (as palavras vêm de um arquivo nosso,
// mas é um bom hábito: nada de texto virar código sem querer)
const etimoEsc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// a linhagem vira galhos ANINHADOS: cada antepassado guarda o próximo dentro dele
function galhosRaiz(raiz, i) {
  if (i >= raiz.length) return '';
  const r = raiz[i];
  return `<ul class="etimo-filhos">
      <li class="etimo-no">
        <button class="etimo-no-btn etimo-ancestral" onclick="alternarNoEtimo(this)">
          <span class="etimo-forma">${etimoEsc(r.f)}</span><span class="etimo-lingua">${etimoEsc(etimoTxt(r.l))}</span>
        </button>
        <div class="etimo-filhos etimo-texto">“${etimoEsc(etimoTxt(r.s))}”</div>
        ${galhosRaiz(raiz, i + 1)}
      </li>
    </ul>`;
}

function folhaEtimologiaHtml(dia) {
  const w = dia.palavra;
  const dataTxt = dia.data.toLocaleDateString(localeAtual(), { day: 'numeric', month: 'long' });
  return `
    <article class="folha etimo-folha">
      <div class="folha-corpo">
        <div class="etimo-dia">${t('etimo_palavra_do_dia')} · ${dataTxt}</div>
        <div class="etimo-arvore">
          <button class="etimo-palavra" onclick="alternarPalavraEtimo(this)" aria-expanded="false">
            <span class="etimo-palavra-txt">${etimoEsc(w.p)}</span>
            <span class="etimo-classe">${etimoEsc(etimoTxt(w.classe))}</span>
          </button>
          <ul class="etimo-galhos">
            <li class="etimo-no">
              <button class="etimo-no-btn" onclick="alternarNoEtimo(this)">${t('etimo_significado')}</button>
              <div class="etimo-filhos etimo-texto">${etimoEsc(etimoTxt(w.sig))}</div>
            </li>
            <li class="etimo-no">
              <button class="etimo-no-btn" onclick="alternarNoEtimo(this)">${t('etimo_raiz')}</button>
              ${galhosRaiz(w.raiz, 0)}
            </li>
            <li class="etimo-no">
              <button class="etimo-no-btn" onclick="alternarNoEtimo(this)">${t('etimo_profundo')}</button>
              <div class="etimo-filhos etimo-texto">${etimoEsc(etimoTxt(w.fundo))}</div>
            </li>
            <li class="etimo-no">
              <button class="etimo-no-btn" onclick="alternarNoEtimo(this)">${t('etimo_familia')}</button>
              <div class="etimo-filhos etimo-familia">${w.familia.map(f => `<span class="etimo-prima">${etimoEsc(f)}</span>`).join('')}</div>
            </li>
            ${w.nota ? `<li class="etimo-no">
              <button class="etimo-no-btn etimo-nota-btn" onclick="alternarNoEtimo(this)">${t('etimo_curiosidade')}</button>
              <div class="etimo-filhos etimo-texto">${etimoEsc(etimoTxt(w.nota))}</div>
            </li>` : ''}
          </ul>
        </div>
      </div>
    </article>`;
}

// tocar na palavra: abre o primeiro nível de galhos; se já estiver aberta, recolhe TUDO
window.alternarPalavraEtimo = function (btn) {
  const arvore = btn.closest('.etimo-arvore');
  const abrir = !arvore.classList.contains('aberta');
  arvore.classList.toggle('aberta', abrir);
  btn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  if (!abrir) arvore.querySelectorAll('.etimo-no.aberto').forEach(no => no.classList.remove('aberto'));
};

// tocar num galho: abre/fecha só ele (fechar também fecha os galhos de dentro)
window.alternarNoEtimo = function (btn) {
  const no = btn.parentElement;
  const abrir = !no.classList.contains('aberto');
  no.classList.toggle('aberto', abrir);
  if (!abrir) no.querySelectorAll('.etimo-no.aberto').forEach(n => n.classList.remove('aberto'));
};

window.abrirEtimologia = function () {
  montarDiasEtimologia();
  etimoFolhaAtual = 0;
  document.getElementById('etimoTitulo').textContent = t('etimo_titulo');
  document.getElementById('etimoPalco').innerHTML = etimoDias.map(folhaEtimologiaHtml).join('');
  posicionarFolhasEtimo();
  document.getElementById('etimologiaOverlay').classList.add('open');
  registrarEventoApp('palavra_do_dia'); // métrica: abriu a palavra do dia hoje
};

// mesma pilha de folhas do diário (a de trás aparece um pouquinho, a virada sai pela esquerda)
function posicionarFolhasEtimo() {
  const folhas = document.querySelectorAll('#etimoPalco .folha');
  folhas.forEach((folha, i) => {
    const d = i - etimoFolhaAtual;
    let transform = 'translate(0, 0) rotate(0deg) scale(1)', opacidade = 1;
    if (d < 0) { transform = 'translate(-125%, 20px) rotate(-9deg)'; opacidade = 0; }
    else if (d > 0) { transform = `translate(${d * 5}px, ${d * 7}px) rotate(${d % 2 ? 1.2 : -0.8}deg) scale(${1 - d * 0.025})`; opacidade = d > 2 ? 0 : 1; }
    folha.style.transform = transform;
    folha.style.opacity = opacidade;
    folha.style.zIndex = 1000 - Math.abs(d);
    folha.classList.toggle('escondida', d < 0 || d > 2);
    folha.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
  });
  const ind = document.getElementById('etimoIndicador');
  if (ind) ind.textContent = etimoFolhaAtual === 0 ? t('etimo_hoje') : t('etimo_dias_atras', { n: etimoFolhaAtual });
}

// deslizar pro lado vira a página (mesma regra do diário: tem que ser bem mais pro lado do que pra cima)
(function configurarDeslizarEtimo() {
  const palco = document.getElementById('etimoPalco');
  if (!palco) return;
  let x0 = null, y0 = 0;
  const virar = (dx, dy) => {
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const total = document.querySelectorAll('#etimoPalco .folha').length;
    if (dx < 0 && etimoFolhaAtual < total - 1) etimoFolhaAtual++;
    else if (dx > 0 && etimoFolhaAtual > 0) etimoFolhaAtual--;
    else return;
    posicionarFolhasEtimo();
  };
  palco.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; e.stopPropagation(); }, { passive: true });
  palco.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; virar(dx, dy); }, { passive: true });
  palco.addEventListener('mousedown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  palco.addEventListener('mouseup', (e) => { if (x0 === null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null; virar(dx, dy); });
})();
