/* js/estante.js — Minha estante, sequência de leitura, estatísticas, upload de epub, Kindle
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

// ---------- minha estante (upload de epub, leitura privada) ----------
window.ITENS_ESTANTE_ATUAIS = [];

// ---------- sequência de leitura (streak), inspirado no calendário do Fable ----------
function fmtDataISO(d) { return d.toISOString().slice(0, 10); }

async function registrarLeituraHoje() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  await supabaseClient.from('logs_leitura').upsert(
    { usuario_id: sessionData.session.user.id, data: fmtDataISO(new Date()) },
    { onConflict: 'usuario_id,data', ignoreDuplicates: true }
  );
}

async function streakLeituraHtml(usuarioId) {
  const hoje = new Date();
  const hojeChave = fmtDataISO(hoje);
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  const primeiroDiaMes = new Date(anoAtual, mesAtual, 1);
  const ultimoDiaMes = new Date(anoAtual, mesAtual + 1, 0);
  const totalDiasMes = ultimoDiaMes.getDate();
  const offsetInicio = primeiroDiaMes.getDay(); // 0 = domingo

  const { data } = await supabaseClient
    .from('logs_leitura')
    .select('data')
    .eq('usuario_id', usuarioId)
    .gte('data', fmtDataISO(primeiroDiaMes))
    .lte('data', fmtDataISO(ultimoDiaMes));
  const datasLidas = new Set((data || []).map(d => d.data));

  // a sequência (streak) olha pra trás no tempo independente do mês exibido no calendário
  const inicioStreak = new Date(hoje);
  inicioStreak.setDate(inicioStreak.getDate() - 120);
  const { data: dataStreak } = await supabaseClient
    .from('logs_leitura')
    .select('data')
    .eq('usuario_id', usuarioId)
    .gte('data', fmtDataISO(inicioStreak));
  const datasParaStreak = new Set((dataStreak || []).map(d => d.data));
  let streak = 0;
  let cursor = new Date(hoje);
  if (!datasParaStreak.has(fmtDataISO(cursor))) cursor.setDate(cursor.getDate() - 1);
  // mesma chance de recuperação da ofensiva de escrita: 1 dia em branco é perdoado
  // (não conta como lido), e a chance só volta depois de 7 dias lidos
  let desdeChanceLeitura = 7;
  while (true) {
    if (datasParaStreak.has(fmtDataISO(cursor))) {
      streak++; desdeChanceLeitura++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      const antes = new Date(cursor);
      antes.setDate(antes.getDate() - 1);
      if (desdeChanceLeitura >= 7 && datasParaStreak.has(fmtDataISO(antes))) { desdeChanceLeitura = 0; cursor = antes; }
      else break;
    }
  }

  const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  let cabecalho = diasSemana.map(d => `<div style="text-align:center; font-size:10px; font-weight:700; color:var(--ink-faint); letter-spacing:0.5px;">${d}</div>`).join('');

  let celulas = '';
  for (let i = 0; i < offsetInicio; i++) celulas += `<div></div>`;
  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const d = new Date(anoAtual, mesAtual, dia);
    const chave = fmtDataISO(d);
    const lido = datasLidas.has(chave);
    const ehHoje = chave === hojeChave;
    const delay = (Math.min(dia, 20) * 0.012).toFixed(3);

    let classe = 'leitura-dia-cell';
    if (ehHoje) classe += lido ? ' hoje-lido' : ' hoje-nao-lido';

    if (lido) {
      celulas += `<div title="${chave}" class="${classe}" style="animation-delay:${delay}s;">
          <svg class="estante-dia-lido-atomo" viewBox="0 0 100 100" fill="currentColor"><path d="M18 12 L42 6 L58 4 L74 14 L88 10 L94 26 L96 44 L90 58 L94 74 L82 84 L66 96 L48 92 L30 98 L14 88 L6 72 L4 54 L10 38 L6 22 Z"/></svg>
          <span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:10.5px; font-weight:700; font-family:'DM Sans', sans-serif; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.5);">${dia}</span>
        </div>`;
    } else {
      celulas += `<div title="${chave}" class="${classe}" style="animation-delay:${delay}s;">${dia}</div>`;
    }
  }

  const nomesMes = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  return `
      <div class="bio-box" style="margin-bottom:14px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
          <div class="discover-title" style="margin:0; text-transform:capitalize;">${nomesMes[mesAtual]}</div>
          <div style="font-family:'Baloo 2'; font-size:15px; color:var(--accent-a); font-weight:800;">${streak} dia${streak === 1 ? '' : 's'} seguidos</div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; margin:8px 0 4px;">${cabecalho}</div>
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px;">${celulas}</div>
      </div>`;
}

// ---------- estatísticas de leitura: páginas lidas e horas, acumulado vitalício ----------
async function estatisticasLeituraHtml(usuarioId) {
  const { data } = await supabaseClient.from('estatisticas_leitura').select('*').eq('usuario_id', usuarioId).maybeSingle();
  const paginas = data ? data.paginas_lidas : 0;
  const minutos = data ? data.minutos_leitura : 0;
  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  const horasTexto = horas > 0 ? `${horas}h${minutosRestantes ? ' ' + minutosRestantes + 'min' : ''}` : `${minutosRestantes}min`;

  return `
      <div style="display:flex; gap:8px; margin-bottom:14px;">
        <div class="bio-box" style="flex:1; margin-bottom:0; text-align:center;">
          <div style="font-family:'Baloo 2'; font-size:20px; color:var(--accent-a); font-weight:800;">${paginas.toLocaleString('pt-BR')}</div>
          <div style="font-size:10.5px; color:var(--ink-faint); font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;">${icone('livro',12)} páginas lidas</div>
        </div>
        <div class="bio-box" style="flex:1; margin-bottom:0; text-align:center;">
          <div style="font-family:'Baloo 2'; font-size:20px; color:var(--accent-b); font-weight:800;">${horasTexto}</div>
          <div style="font-size:10.5px; color:var(--ink-faint); font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;">${icone('relogio',12)} tempo de leitura</div>
        </div>
      </div>`;
}

async function renderEstante() {
  const lista = document.getElementById('livrosList');
  lista.innerHTML = skeletonCardsHtml(3);

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    lista.innerHTML = `<div class="visitor-lock-note">Entra na sua conta pra ver sua estante.</div>`;
    return;
  }
  const usuarioId = sessionData.session.user.id;

  const [streakHtml, estatisticasHtml, { data, error }] = await Promise.all([
    streakLeituraHtml(usuarioId),
    estatisticasLeituraHtml(usuarioId),
    supabaseClient.from('estante_pessoal').select('*').eq('usuario_id', usuarioId).order('adicionado_em', { ascending: false }),
  ]);

  if (error) {
    lista.innerHTML = estatisticasHtml + streakHtml + `<div class="visitor-lock-note">Não consegui carregar sua estante agora${error.message.includes('estante_pessoal') ? ' — a tabela ainda não existe no banco, falta rodar a migração' : ''}.</div>`;
    return;
  }

  window.ITENS_ESTANTE_ATUAIS = data || [];
  lista.innerHTML = estatisticasHtml + streakHtml + `<div class="estante-btns-row">
        <button class="btn-enviar-epub" onclick="abrirUploadEpub()">${icone('instalar',15,0,'#fff')} enviar um epub</button>
        <button class="btn-importar-kindle" onclick="abrirImportarKindle()">${icone('livro',15)} destaques do Kindle</button>
      </div>` +
    (data && data.length
      ? `<div class="estante-madeira">${data.map((d, i) => cardEstanteHtml(d, i)).join('')}</div>`
      : estadoVazio('sua estante tá vazia', 'envia um epub pra começar a ler por aqui, sincronizado em qualquer aparelho'));
}

const CORES_LOMBADA_ESTANTE = ['var(--accent-a)', 'var(--accent-b)', 'var(--pink)', 'var(--yellow)', '#8FA06E', '#6FA3C9'];
function cardEstanteHtml(d, i) {
  const pct = Math.round(d.progresso_percentual || 0);
  const cor = CORES_LOMBADA_ESTANTE[i % CORES_LOMBADA_ESTANTE.length];
  return `
      <div class="livro-lombada" style="animation-delay:${Math.min(i, 10) * 0.06}s;" onclick="abrirLeitorEpub(${i})" title="${d.titulo}">
        ${d.capa_url
        ? `<img src="${d.capa_url}" alt="" loading="lazy" width="72" height="104">`
        : `<div class="livro-lombada-vazia" style="background:${cor};">${icone('livro',20,i,'#fff')}</div>`}
        <div class="livro-lombada-progresso" style="width:${pct}%;"></div>
        <div class="livro-lombada-legenda">${d.titulo}</div>
        <div class="livro-lombada-del" onclick="event.stopPropagation(); excluirDoEstante(${i})">${icone('lixeira',10)}</div>
      </div>`;
}

window.abrirUploadEpub = function () {
  const input = document.getElementById('uploadEpubInput');
  input.value = '';
  input.click();
};

window.escolherArquivoEpub = async function () {
  const input = document.getElementById('uploadEpubInput');
  if (!input.files || !input.files[0]) return;
  const arquivo = input.files[0];
  const titulo = arquivo.name.replace(/\.epub$/i, '');

  mostrarToast('enviando epub...');

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const usuarioId = sessionData.session.user.id;
  const caminho = `${usuarioId}/${Date.now()}-${arquivo.name}`;

  const { error: erroUpload } = await supabaseClient.storage.from('estante-epubs').upload(caminho, arquivo);
  if (erroUpload) { mostrarToast('❌ erro no upload: ' + erroUpload.message); return; }

  const { error } = await supabaseClient.from('estante_pessoal').insert({
    usuario_id: usuarioId,
    titulo,
    autor: null,
    arquivo_path: caminho,
    formato: 'epub',
  });

  if (error) { mostrarToast('❌ erro: ' + error.message); return; }

  mostrarToast('📘 livro enviado pra sua estante');
  renderEstante();
};

// ---------- importar destaques do Kindle (My Clippings.txt, sem precisar de senha/API) ----------
window.abrirImportarKindle = function () {
  const input = document.getElementById('importarKindleInput');
  input.value = '';
  input.click();
};

// o My Clippings.txt separa cada destaque por uma linha "==========", no formato:
// Título (Autor)
// - Seu destaque na página X | local Y-Z | Adicionado em ...
// (linha em branco)
// texto do destaque
function parseKindleClippings(textoArquivo) {
  const blocos = textoArquivo.split(/\r?\n==========\r?\n?/).map(b => b.trim()).filter(Boolean);
  const destaques = [];
  for (const bloco of blocos) {
    const linhas = bloco.split(/\r?\n/).map(l => l.trim()).filter((l, idx) => !(idx > 0 && l === '' ));
    if (linhas.length < 2) continue;
    const linhaTitulo = linhas[0];
    const linhaMeta = linhas[1] || '';
    if (!/highlight|destaque/i.test(linhaMeta)) continue; // pula anotações e marcadores, só importa destaques
    const corpo = linhas.slice(2).join(' ').trim();
    if (!corpo) continue;
    const m = linhaTitulo.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    destaques.push({
      titulo: m ? m[1].trim() : linhaTitulo,
      autor: m ? m[2].trim() : null,
      texto: corpo,
    });
  }
  return destaques;
}

window.escolherArquivoKindle = async function () {
  const input = document.getElementById('importarKindleInput');
  if (!input.files || !input.files[0]) return;
  const arquivo = input.files[0];

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  const usuarioId = sessionData.session.user.id;

  const textoArquivo = await arquivo.text();
  const destaques = parseKindleClippings(textoArquivo);
  if (!destaques.length) { mostrarToast('não achei destaques nesse arquivo — confere se é o My Clippings.txt do seu Kindle'); return; }

  mostrarToast(`importando ${destaques.length} destaque${destaques.length === 1 ? '' : 's'}...`);
  const linhas = destaques.map(d => ({
    usuario_id: usuarioId,
    estante_id: null,
    livro_titulo: d.titulo,
    livro_autor: d.autor,
    texto: d.texto,
  }));
  const { error } = await supabaseClient.from('grifos_livro').insert(linhas);
  if (error) { mostrarToast('❌ erro ao importar: ' + error.message); return; }
  mostrarToast(`📚 ${destaques.length} destaque${destaques.length === 1 ? '' : 's'} do Kindle importado${destaques.length === 1 ? '' : 's'}!`);
};

window.excluirDoEstante = async function (i) {
  const item = window.ITENS_ESTANTE_ATUAIS[i];
  if (!item) return;
  await supabaseClient.storage.from('estante-epubs').remove([item.arquivo_path]);
  await supabaseClient.from('estante_pessoal').delete().eq('id', item.id);
  mostrarToast('removido da estante');
  renderEstante();
};
