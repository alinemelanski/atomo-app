/* js/diario-pdf.js — Exportar o diário como um livrinho em PDF
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.

   COMO FUNCIONA (pra aprender):
   1. Cada página do livrinho é DESENHADA num <canvas> (uma "tela de pintura"
      do navegador): primeiro o papel casca de ovo com as pintinhas, depois o
      texto na letra que a pessoa escolheu, e no fim a data + assinatura.
      Desenhando em canvas, o PDF fica com a MESMA cara das folhas do app.
   2. A biblioteca jsPDF junta essas imagens, uma por página, num arquivo PDF.
      Ela só é baixada quando a pessoa toca no botão (carregamento "preguiçoso"),
      pra não deixar o app mais pesado pra quem nunca exporta.
   3. No celular, o arquivo vai pro menu de compartilhar (dá pra "Salvar em
      Arquivos", mandar no WhatsApp...). No computador, baixa direto.

   O livro fica na ordem de leitura: da folha mais antiga pra mais nova. */

const PDF_LARGURA = 1240;   // pixels de cada página (tamanho A5 em boa resolução)
const PDF_ALTURA = 1754;
const PDF_MARGEM = 120;

// baixa a jsPDF só uma vez, quando precisar
function carregarJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => resolve(window.jspdf);
    s.onerror = () => reject(new Error('não consegui baixar o gerador de PDF'));
    document.head.appendChild(s);
  });
}

// papel casca de ovo: fundo creme + pintinhas espalhadas (sempre no mesmo lugar,
// usando uma "semente" fixa, pra todas as páginas ficarem parecidas)
function desenharPapel(ctx) {
  ctx.fillStyle = '#F4EDE0';
  ctx.fillRect(0, 0, PDF_LARGURA, PDF_ALTURA);
  let semente = 7;
  const aleatorio = () => { semente = (semente * 9301 + 49297) % 233280; return semente / 233280; };
  ctx.fillStyle = 'rgba(120,95,60,0.08)';
  for (let i = 0; i < 900; i++) {
    ctx.beginPath();
    ctx.arc(aleatorio() * PDF_LARGURA, aleatorio() * PDF_ALTURA, 1 + aleatorio() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// quebra o texto em linhas que cabem na largura (respeitando os "enter" que a pessoa deu)
function quebrarLinhas(ctx, texto, larguraMax) {
  const linhas = [];
  String(texto || '').split('\n').forEach(paragrafo => {
    if (!paragrafo.trim()) { linhas.push(''); return; }
    let atual = '';
    paragrafo.split(' ').forEach(palavra => {
      const teste = atual ? atual + ' ' + palavra : palavra;
      if (ctx.measureText(teste).width > larguraMax && atual) { linhas.push(atual); atual = palavra; }
      else atual = teste;
    });
    linhas.push(atual);
  });
  return linhas;
}

function carregarImagem(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // sem isso o canvas fica "sujo" e não exporta
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // imagem que não carrega: o livro segue sem ela
    img.src = url;
  });
}

window.exportarDiarioPdf = async function () {
  const entradas = [...(diarioEntradasCache || [])]
    .filter(e => e.texto || e.imagem_url)
    .sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em)); // mais antiga primeiro
  if (!entradas.length) { mostrarToast(t('pdf_vazio')); return; }

  mostrarToast('📖 ' + t('pdf_montando'));
  let jspdf;
  try { jspdf = await carregarJsPdf(); } catch (e) { mostrarToast('❌ ' + e.message); return; }

  const letra = LETRAS_DIARIO[letraDiario];
  const tamanhoLetra = Math.round(letra.tamanho * 2.6); // a página é bem maior que a tela do celular
  const altLinha = Math.round(tamanhoLetra * 1.45);
  // espera as fontes estarem prontas, senão o canvas desenha com a fonte padrão
  try {
    await document.fonts.load(`${tamanhoLetra}px ${letra.familia}`);
    await document.fonts.load(`60px 'Homemade Apple'`);
  } catch (e) { /* segue com o que tiver */ }

  const canvas = document.createElement('canvas');
  canvas.width = PDF_LARGURA; canvas.height = PDF_ALTURA;
  const ctx = canvas.getContext('2d');
  const doc = new jspdf.jsPDF({ unit: 'mm', format: 'a5' });
  let primeiraPagina = true;
  const fecharPagina = () => {
    if (!primeiraPagina) doc.addPage();
    doc.addImage(canvas.toDataURL('image/jpeg', 0.86), 'JPEG', 0, 0, 148, 210);
    primeiraPagina = false;
  };
  const assinatura = assinaturaDiario();

  // ---- capa ----
  desenharPapel(ctx);
  ctx.fillStyle = '#3A2E22';
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(tamanhoLetra * 1.6)}px ${letra.familia}`;
  ctx.fillText(t('diario_titulo'), PDF_LARGURA / 2, PDF_ALTURA * 0.42);
  ctx.font = `64px 'Homemade Apple', cursive`;
  ctx.fillText(assinatura, PDF_LARGURA / 2, PDF_ALTURA * 0.42 + 150);
  ctx.fillStyle = '#8A7860';
  ctx.font = `${Math.round(tamanhoLetra * 0.7)}px ${letra.familia}`;
  const anoIni = new Date(entradas[0].criado_em).getFullYear();
  const anoFim = new Date(entradas[entradas.length - 1].criado_em).getFullYear();
  ctx.fillText(anoIni === anoFim ? String(anoIni) : `${anoIni} – ${anoFim}`, PDF_LARGURA / 2, PDF_ALTURA * 0.42 + 260);
  ctx.textAlign = 'left';
  fecharPagina();

  // ---- uma (ou mais) página por folha ----
  const larguraTexto = PDF_LARGURA - PDF_MARGEM * 2;
  const limiteY = PDF_ALTURA - PDF_MARGEM - 210; // deixa espaço pra data + assinatura
  for (const e of entradas) {
    desenharPapel(ctx);
    let y = PDF_MARGEM + tamanhoLetra;
    ctx.fillStyle = '#3A2E22';
    ctx.font = `${tamanhoLetra}px ${letra.familia}`;
    for (const linha of quebrarLinhas(ctx, e.texto, larguraTexto)) {
      if (y > limiteY) { fecharPagina(); desenharPapel(ctx); y = PDF_MARGEM + tamanhoLetra; ctx.fillStyle = '#3A2E22'; ctx.font = `${tamanhoLetra}px ${letra.familia}`; }
      ctx.fillText(linha, PDF_MARGEM, y);
      y += altLinha;
    }
    // foto "colada", levemente torta, se couber; senão vai pra próxima página
    if (e.imagem_url) {
      const img = await carregarImagem(e.imagem_url);
      if (img) {
        const largura = larguraTexto * 0.8;
        const altura = Math.min(largura * img.height / img.width, 700);
        if (y + altura > limiteY) { fecharPagina(); desenharPapel(ctx); y = PDF_MARGEM; }
        ctx.save();
        ctx.translate(PDF_LARGURA / 2, y + 30 + altura / 2);
        ctx.rotate(-0.025);
        ctx.shadowColor = 'rgba(60,40,20,0.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
        ctx.drawImage(img, -largura / 2, -altura / 2, largura, altura);
        ctx.restore();
      }
    }
    // data + assinatura no canto inferior direito
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8A7860';
    ctx.font = `${Math.round(tamanhoLetra * 0.62)}px ${letra.familia}`;
    ctx.fillText(dataLongaFolha(e.criado_em), PDF_LARGURA - PDF_MARGEM, PDF_ALTURA - PDF_MARGEM - 90);
    ctx.save();
    ctx.translate(PDF_LARGURA - PDF_MARGEM, PDF_ALTURA - PDF_MARGEM);
    ctx.rotate(-0.07);
    ctx.fillStyle = '#3A2E22';
    ctx.font = `46px 'Homemade Apple', cursive`;
    ctx.fillText(assinatura, 0, 0);
    ctx.restore();
    ctx.textAlign = 'left';
    fecharPagina();
  }

  // ---- entrega: compartilhar (celular) ou baixar (computador) ----
  const nomeArquivo = (idiomaAtual === 'en' ? 'my-diary' : 'meu-diario') + '.pdf';
  const blob = doc.output('blob');
  const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: t('diario_titulo') });
      return;
    }
  } catch (e) { if (e.name === 'AbortError') return; /* cancelou o compartilhar */ }
  doc.save(nomeArquivo);
  mostrarToast('📖 ' + t('pdf_pronto'));
};
