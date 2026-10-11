/* js/cartoes.js — Cartão de citação e cartão do diário (gerados em canvas)
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- cartão de citação (gerado em canvas, no visual do Átomo) ----------
window.abrirCartaoCitacao = function (titulo, autor) {
  document.getElementById('citacaoTextoInput').value = '';
  document.getElementById('citacaoTituloInput').value = titulo || '';
  document.getElementById('citacaoAutorInput').value = autor || '';
  document.getElementById('citacaoCanvas').style.display = 'none';
  document.getElementById('citacaoAcoes').style.display = 'none';
  document.getElementById('citacaoCartaoOverlay').classList.add('open');
};

// dispara o cartão a partir do livro atual de um clube (ver clubeLivroAtualCitacao)
window.abrirCartaoCitacaoClubeAtual = function () {
  if (!clubeLivroAtualCitacao.titulo) { mostrarToast('❌ esse clube ainda não tem um livro definido'); return; }
  abrirCartaoCitacao(clubeLivroAtualCitacao.titulo, clubeLivroAtualCitacao.autor);
};

function quebrarLinhasCanvas(ctx, texto, larguraMax) {
  const palavras = texto.split(/\s+/);
  const linhas = [];
  let atual = '';
  palavras.forEach(p => {
    const teste = atual ? atual + ' ' + p : p;
    if (ctx.measureText(teste).width > larguraMax && atual) { linhas.push(atual); atual = p; }
    else { atual = teste; }
  });
  if (atual) linhas.push(atual);
  return linhas.slice(0, 11);
}

window.gerarCartaoCitacao = async function () {
  const texto = document.getElementById('citacaoTextoInput').value.trim();
  if (!texto) { mostrarToast('❌ cola ou escreve um trecho primeiro'); return; }
  const titulo = document.getElementById('citacaoTituloInput').value.trim();
  const autor = document.getElementById('citacaoAutorInput').value.trim();

  try {
    await document.fonts.load('800 40px "Baloo 2"');
    await document.fonts.load('italic 400 32px "Nunito"');
    await document.fonts.load('700 18px "Nunito"');
  } catch (e) {}

  const canvas = document.getElementById('citacaoCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const estilo = getComputedStyle(document.documentElement);
  const corBg = estilo.getPropertyValue('--bg').trim() || '#F7F1E6';
  const corInk = estilo.getPropertyValue('--ink').trim() || '#3A2E22';
  const corAccentA = estilo.getPropertyValue('--accent-a').trim() || '#D9714A';
  const corFaint = estilo.getPropertyValue('--ink-faint').trim() || '#B7A78D';

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = corBg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = corAccentA;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(36, 48); ctx.lineTo(W - 42, 38); ctx.lineTo(W - 38, H - 46); ctx.lineTo(42, H - 36); ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = corAccentA;
  ctx.textAlign = 'left';
  ctx.font = '800 100px "Baloo 2"';
  ctx.fillText('“', 62, 178);

  ctx.fillStyle = corInk;
  ctx.font = 'italic 400 37px "Nunito"';
  ctx.textAlign = 'center';
  const linhas = quebrarLinhasCanvas(ctx, texto, W - 150);
  let y = H / 2 - (linhas.length * 47) / 2;
  linhas.forEach(linha => { ctx.fillText(linha, W / 2, y); y += 47; });

  if (titulo) {
    ctx.font = '800 30px "Baloo 2"';
    ctx.fillStyle = corInk;
    ctx.fillText(titulo, W / 2, H - 132);
  }
  if (autor) {
    ctx.font = '700 19px "Nunito"';
    ctx.fillStyle = corFaint;
    ctx.fillText(autor, W / 2, H - 100);
  }

  // marca d'agua do atomo (o papel amassado de verdade) no rodape, no lugar
  // do emoji generico de novelo que tava ali antes por engano
  ctx.font = '700 18px "Nunito"';
  const textoRodape = 'Átomo · seu diário tem visitas.';
  const larguraTexto = ctx.measureText(textoRodape).width;
  const iconTam = 30;
  const gap = 9;
  const xInicio = W / 2 - (iconTam + gap + larguraTexto) / 2;

  ctx.save();
  ctx.translate(xInicio, H - 70);
  ctx.scale(iconTam / 100, iconTam / 100);
  ctx.fillStyle = corAccentA;
  ctx.fill(new Path2D('M18 12 L42 6 L58 4 L74 14 L88 10 L94 26 L96 44 L90 58 L94 74 L82 84 L66 96 L48 92 L30 98 L14 88 L6 72 L4 54 L10 38 L6 22 Z'));
  ctx.restore();

  ctx.fillStyle = corFaint;
  ctx.textAlign = 'left';
  ctx.fillText(textoRodape, xInicio + iconTam + gap, H - 50);

  canvas.style.display = 'block';
  document.getElementById('citacaoAcoes').style.display = 'flex';
};

window.baixarCartaoCitacao = function () {
  const canvas = document.getElementById('citacaoCanvas');
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'citacao-atomo.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, 'image/png');
};

// compartilha a imagem do cartão pra fora do app (WhatsApp, Instagram, Twitter, o que a pessoa escolher
// no menu nativo de compartilhamento) — usa a Web Share API com o arquivo de verdade quando o navegador suporta
window.compartilharCartaoCitacaoExterno = function () {
  const canvas = document.getElementById('citacaoCanvas');
  canvas.toBlob(async blob => {
    const arquivo = new File([blob], 'citacao-atomo.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: 'Átomo', text: 'meu diário tem visitas — Átomo' });
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; /* pessoa cancelou o compartilhamento, tudo bem */ }
    }
    // navegador sem suporte a compartilhar arquivo — baixa a imagem pra pessoa anexar onde quiser
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'citacao-atomo.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    mostrarToast('💾 imagem salva — agora é só anexar onde quiser compartilhar');
  }, 'image/png');
};

window.compartilharCartaoCitacaoFeed = function () {
  const canvas = document.getElementById('citacaoCanvas');
  canvas.toBlob(async blob => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const usuarioId = sessionData.session.user.id;
    const caminho = `${usuarioId}/citacao-${Date.now()}.png`;
    const { error: erroUpload } = await supabaseClient.storage.from('midia-posts').upload(caminho, blob, { contentType: 'image/png' });
    if (erroUpload) { mostrarToast('❌ erro no upload: ' + erroUpload.message); return; }
    const { data } = supabaseClient.storage.from('midia-posts').getPublicUrl(caminho);
    const titulo = document.getElementById('citacaoTituloInput').value.trim();
    const { error } = await supabaseClient.from('posts').insert({
      autor_id: usuarioId,
      texto: titulo ? `📖 uma citação de ${titulo}` : '📖 uma citação',
      tipo: 'Livro',
      privado: false,
      imagem_url: data.publicUrl,
    });
    if (error) { mostrarToast('❌ erro: ' + error.message); return; }
    mostrarToast('✨ postado no feed!');
    closeOverlay('citacaoCartaoOverlay');
    carregarPostsReais();
  }, 'image/png');
};

window.compartilharCartaoDiarioNoFeed = function () {
  const canvas = document.getElementById('diarioShareCanvas');
  canvas.toBlob(async blob => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const usuarioId = sessionData.session.user.id;
    const caminho = `${usuarioId}/diario-${Date.now()}.png`;
    const { error: erroUpload } = await supabaseClient.storage.from('midia-posts').upload(caminho, blob, { contentType: 'image/png' });
    if (erroUpload) { mostrarToast('❌ erro no upload: ' + erroUpload.message); return; }
    const { data } = supabaseClient.storage.from('midia-posts').getPublicUrl(caminho);
    const { error } = await supabaseClient.from('posts').insert({
      autor_id: usuarioId,
      texto: '📓 uma página do meu diário',
      tipo: 'Diário',
      privado: false,
      imagem_url: data.publicUrl,
    });
    if (error) { mostrarToast('❌ erro: ' + error.message); return; }
    mostrarToast('✨ postado no feed!');
    closeOverlay('diarioShareOverlay');
    carregarPostsReais();
  }, 'image/png');
};

// ---------- compartilhar entrada do diário (cartão gerado em canvas, só pra fora do app) ----------
window.abrirCompartilharDiario = function (id) {
  const entrada = (diarioEntradasCache || []).find(e => e.id === id);
  if (!entrada) { mostrarToast('❌ não encontrei essa anotação'); return; }
  document.getElementById('diarioShareOverlay').classList.add('open');
  gerarCartaoDiario(entrada);
};

function carregarImagemCartaoDiario(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function gerarCartaoDiario(entrada) {
  try {
    await document.fonts.load('500 26px "Nunito"');
    await document.fonts.load('italic 400 32px "Nunito"');
    await document.fonts.load('700 18px "Nunito"');
  } catch (e) {}

  const canvas = document.getElementById('diarioShareCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const estilo = getComputedStyle(document.documentElement);
  const corBg = estilo.getPropertyValue('--bg').trim() || '#F7F1E6';
  const corInk = estilo.getPropertyValue('--ink').trim() || '#3A2E22';
  const corFaint = estilo.getPropertyValue('--ink-faint').trim() || '#B7A78D';
  const corPapel = '#EDE0C4';

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = corBg;
  ctx.fillRect(0, 0, W, H);

  // a folha fica levemente girada, tipo um papel jogado sobre a mesa
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((-1.1 * Math.PI) / 180);
  ctx.translate(-W / 2, -H / 2);

  // silhueta organica da folha (cantos e bordas com uma leve ondulacao,
  // pra parecer papel/papelão de verdade em vez de um retangulo perfeito)
  const margem = 26;
  const porLado = 5;
  const pontos = [];
  function pontosDaBorda(x0, y0, x1, y1) {
    for (let i = 0; i < porLado; i++) {
      const t = i / porLado;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const j = Math.sin(i * 47.3 + x0 * 0.7 + y1 * 0.6) * 5;
      pontos.push([x1 === x0 ? x + j : x, y1 === y0 ? y + j : y]);
    }
  }
  pontosDaBorda(margem, margem, W - margem, margem);
  pontosDaBorda(W - margem, margem, W - margem, H - margem);
  pontosDaBorda(W - margem, H - margem, margem, H - margem);
  pontosDaBorda(margem, H - margem, margem, margem);

  ctx.beginPath();
  const ultimo = pontos[pontos.length - 1], primeiro = pontos[0];
  ctx.moveTo((ultimo[0] + primeiro[0]) / 2, (ultimo[1] + primeiro[1]) / 2);
  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i], prox = pontos[(i + 1) % pontos.length];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + prox[0]) / 2, (p[1] + prox[1]) / 2);
  }
  ctx.closePath();

  ctx.save();
  ctx.shadowColor = 'rgba(60,40,15,.35)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = corPapel;
  ctx.fill();
  ctx.restore();

  ctx.clip(); // todo o resto do desenho fica dentro do contorno da folha

  // manchas suaves de tonalidade (tipo fibra prensada de papelão kraft) --
  // no lugar dos vincos retos de antes, que pareciam um desenho no fundo
  ctx.save();
  ctx.filter = 'blur(28px)';
  const manchas = [
    { x: W * 0.16, y: H * 0.14, r: 95, cor: 'rgba(110,80,42,.10)' },
    { x: W * 0.85, y: H * 0.20, r: 115, cor: 'rgba(110,80,42,.08)' },
    { x: W * 0.78, y: H * 0.80, r: 135, cor: 'rgba(90,62,30,.10)' },
    { x: W * 0.20, y: H * 0.85, r: 105, cor: 'rgba(110,80,42,.07)' },
    { x: W * 0.55, y: H * 0.45, r: 170, cor: 'rgba(255,250,235,.10)' },
  ];
  manchas.forEach(m => {
    ctx.fillStyle = m.cor;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.r, m.r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // textura de fibra de papel (pontinhos claros/escuros bem sutis)
  for (let i = 0; i < 280; i++) {
    const x = margem + Math.random() * (W - margem * 2);
    const y = margem + Math.random() * (H - margem * 2);
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(60,40,15,.05)' : 'rgba(255,255,255,.06)';
    ctx.fillRect(x, y, 1.4, 1.4);
  }

  // vinheta suave nas bordas -- da profundidade de papelão de verdade
  const vinheta = ctx.createRadialGradient(W / 2, H / 2, H * 0.26, W / 2, H / 2, H * 0.64);
  vinheta.addColorStop(0, 'rgba(0,0,0,0)');
  vinheta.addColorStop(1, 'rgba(50,33,14,.20)');
  ctx.fillStyle = vinheta;
  ctx.fillRect(0, 0, W, H);

  const ehPolaroidGratidao = entrada.tipo === 'Gratidão do dia' && entrada.imagem_url;
  let y;
  if (ehPolaroidGratidao) {
    // mesma anotação que virou polaroid no Gratidão do dia — o cartão de
    // compartilhar precisa mostrar a foto, não só o texto por cima do papel
    const imgFoto = await carregarImagemCartaoDiario(entrada.imagem_url);
    const polW = 380;
    const borda = 20;
    const fotoW = polW - borda * 2;
    const fotoH = fotoW;
    const legendaAltura = 96;
    const polH = borda + fotoH + legendaAltura;
    const polX = W / 2 - polW / 2;
    const polY = H / 2 - polH / 2 - 22;

    ctx.save();
    ctx.translate(W / 2, polY + polH / 2);
    ctx.rotate((-4 * Math.PI) / 180);
    ctx.translate(-(W / 2), -(polY + polH / 2));

    ctx.save();
    ctx.shadowColor = 'rgba(60,40,15,.30)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#FBF8F1';
    ctx.fillRect(polX, polY, polW, polH);
    ctx.restore();

    const fotoX = polX + borda;
    const fotoY = polY + borda;
    if (imgFoto) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(fotoX, fotoY, fotoW, fotoH);
      ctx.clip();
      const escalaFoto = Math.max(fotoW / imgFoto.width, fotoH / imgFoto.height);
      const iw = imgFoto.width * escalaFoto, ih = imgFoto.height * escalaFoto;
      ctx.drawImage(imgFoto, fotoX + (fotoW - iw) / 2, fotoY + (fotoH - ih) / 2, iw, ih);
      ctx.restore();
    } else {
      ctx.fillStyle = '#EDE3D3';
      ctx.fillRect(fotoX, fotoY, fotoW, fotoH);
    }

    if (entrada.texto) {
      ctx.fillStyle = corInk;
      ctx.font = 'italic 400 19px "Nunito"';
      ctx.textAlign = 'center';
      const linhasLegenda = quebrarLinhasCanvas(ctx, entrada.texto, fotoW - 14);
      let yLegenda = fotoY + fotoH + 34;
      linhasLegenda.slice(0, 3).forEach(linha => { ctx.fillText(linha, W / 2, yLegenda); yLegenda += 24; });
    }

    ctx.restore();
    y = polY + polH + 40;
  } else {
    const textoComAspas = `"${entrada.texto}"`;
    ctx.fillStyle = corInk;
    ctx.font = 'italic 400 37px "Nunito"';
    ctx.textAlign = 'center';
    const linhas = quebrarLinhasCanvas(ctx, textoComAspas, W - 150);
    y = H / 2 - (linhas.length * 47) / 2;
    linhas.forEach(linha => { ctx.fillText(linha, W / 2, y); y += 47; });
  }

  // data sem italico, com peso mais fino (era Baloo 2 800 -- bem grossa) --
  // com respiro minimo em relacao ao texto, mesmo quando a anotacao é longa
  // e empurra a ultima linha pra mais perto do rodape
  const dataFormatada = new Date(entrada.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const yData = Math.max(H - 132, y + 28);
  ctx.font = '500 25px "Nunito"';
  ctx.fillStyle = corInk;
  ctx.fillText(dataFormatada, W / 2, yData);

  ctx.font = '700 17px "Nunito"';
  ctx.fillStyle = corFaint;
  ctx.fillText('do meu diário', W / 2, yData + 30);

  // marca d'agua do atomo + link no rodapé -- agora identica ao iconezinho
  // de papel que gira no pull-to-refresh (mesmo contorno, mesmo preenchimento
  // creme, mesmo rabisco interno), em vez de uma silhueta lisa colorida
  ctx.font = '700 18px "Nunito"';
  const textoRodape = 'Átomo · atomoapp.netlify.app';
  const larguraTexto = ctx.measureText(textoRodape).width;
  const iconTam = 30;
  const gap = 9;
  const xInicio = W / 2 - (iconTam + gap + larguraTexto) / 2;

  ctx.save();
  ctx.translate(xInicio, H - 70);
  ctx.scale(iconTam / 100, iconTam / 100);
  ctx.fillStyle = '#EDE4D3';
  ctx.strokeStyle = '#CBBFA0';
  ctx.lineWidth = 1.2;
  const contornoPapel = new Path2D('M18 12 L42 6 L58 4 L74 14 L88 10 L94 26 L96 44 L90 58 L94 74 L82 84 L66 96 L48 92 L30 98 L14 88 L6 72 L4 54 L10 38 L6 22 Z');
  ctx.fill(contornoPapel);
  ctx.stroke(contornoPapel);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const rabiscos = [
    { d: 'M3,52 C7,39 27,32 51,37 C73,31 98,43 94,52 C99,61 77,68 48,62 C21,69 1,58 3,52 Z', ang: 15 },
    { d: 'M6,47 C3,37 29,34 53,36 C71,29 95,44 91,54 C97,57 73,67 47,60 C25,72 2,55 6,47 Z', ang: 55 },
    { d: 'M4,53 C9,40 24,34 49,38 C76,33 96,42 93,49 C98,60 76,64 52,59 C22,66 0,57 4,53 Z', ang: 95 },
    { d: 'M5,49 C2,41 28,33 50,37 C74,32 97,44 93,53 C96,58 78,67 49,61 C20,65 3,56 5,49 Z', ang: 135 },
  ];
  rabiscos.forEach(rb => {
    ctx.save();
    ctx.translate(50, 50);
    ctx.rotate((rb.ang * Math.PI) / 180);
    ctx.translate(-50, -50);
    ctx.stroke(new Path2D(rb.d));
    ctx.restore();
  });
  ctx.restore();

  ctx.fillStyle = corFaint;
  ctx.textAlign = 'left';
  ctx.fillText(textoRodape, xInicio + iconTam + gap, H - 50);

  ctx.restore(); // fecha o clip + a rotacao da folha
}

window.baixarCartaoDiario = function () {
  const canvas = document.getElementById('diarioShareCanvas');
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'diario-atomo.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, 'image/png');
};

// compartilha a imagem do cartão do diário pra fora do app — Web Share API com arquivo de
// verdade quando o navegador suporta, pra abrir certinho como foto se a pessoa mandar num story
window.compartilharCartaoDiarioExterno = function () {
  const canvas = document.getElementById('diarioShareCanvas');
  canvas.toBlob(async blob => {
    const arquivo = new File([blob], 'diario-atomo.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: 'Átomo', text: 'uma página do meu diário — Átomo' });
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; /* pessoa cancelou, tudo bem */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'diario-atomo.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    mostrarToast('💾 imagem salva — agora é só anexar onde quiser compartilhar');
  }, 'image/png');
};
