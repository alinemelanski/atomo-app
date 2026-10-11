/* js/home.js — Home: semana, humor, caixinha de pandora, reorganizar blocos, checklist, feedback, convite Match, lembretes
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

function renderHomeSemana() {
  const dias = ['D','S','T','Q','Q','S','S'];
  const hoje = new Date();
  const diaSemanaHoje = hoje.getDay();
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() - diaSemanaHoje);
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicioSemana);
    d.setDate(inicioSemana.getDate() + i);
    const ehHoje = d.toDateString() === hoje.toDateString();
    html += `<div class="home-semana-dia${ehHoje ? ' hoje' : ''}"><div class="rotulo">${dias[i]}</div><div class="numero">${d.getDate()}</div></div>`;
  }
  const el = document.getElementById('homeSemanaRow');
  if (el) el.innerHTML = html;
}

// humor do dia: cada bichinho que a pessoa toca (ou cada "diario rapido" bom que ela
// guarda, tipo o Sorriso do dia) soma pontos numa emocao especifica, guardado numa linha
// por dia em humor_diario. a barra de cima e essas carinhas sao a mesma fonte de dados.
// 10 pontos por toque -- leva 10 toques pra encher uma emocao (antes eram 5).
const PONTOS_POR_TOQUE_HUMOR = 10;
const HUMOR_CORES = { feliz: 'var(--accent-a)', calma: 'var(--accent-b)', triste: 'var(--ink-faint)', ansiosa: 'var(--pink)', brava: 'var(--raiva)' };

async function buscarHumorHoje() {
  const vazio = { feliz: 0, calma: 0, triste: 0, ansiosa: 0, brava: 0 };
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData || !sessionData.session) return vazio;
    const usuarioId = sessionData.session.user.id;
    const hojeStr = new Date().toISOString().slice(0, 10);
    const { data: linha, error } = await supabaseClient
      .from('humor_diario')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('data', hojeStr)
      .maybeSingle();
    if (error) { console.log('erro ao carregar humor:', error.message); return vazio; }
    if (!linha) return vazio;
    return { feliz: linha.feliz || 0, calma: linha.calma || 0, triste: linha.triste || 0, ansiosa: linha.ansiosa || 0, brava: linha.brava || 0 };
  } catch (e) { console.log('erro ao carregar humor:', e); return vazio; }
}

async function renderHomeHumor(emocaoMudou) {
  const humorHoje = await buscarHumorHoje();
  const emocoes = ['feliz', 'calma', 'triste', 'ansiosa', 'brava'].map(nome => ({
    nome, pct: humorHoje[nome], cor: HUMOR_CORES[nome],
  }));
  const el = document.getElementById('homeEmocoesCard');
  if (!el) return;
  const jaMontado = el.dataset.montado === '1';
  if (!jaMontado) {
    el.innerHTML = emocoes.map(e => `
        <div class="home-emocao-col">
          <div class="home-emocao-pct" id="homeEmocaoPct_${e.nome}">${e.pct}%</div>
          <div class="home-emocao-barra-wrap"><div class="home-emocao-barra" id="homeEmocaoBarra_${e.nome}" style="height:${e.pct}%; background:${e.cor};"></div></div>
          <div class="home-emocao-nome">${e.nome}</div>
        </div>`).join('');
    el.dataset.montado = '1';
  } else {
    emocoes.forEach(e => {
      const barra = document.getElementById('homeEmocaoBarra_' + e.nome);
      const pctEl = document.getElementById('homeEmocaoPct_' + e.nome);
      if (barra) barra.style.height = e.pct + '%';
      if (pctEl) pctEl.textContent = e.pct + '%';
      if (barra && e.nome === emocaoMudou) {
        barra.classList.remove('pulso');
        void barra.offsetWidth;
        barra.classList.add('pulso');
      }
    });
  }
  const tag = document.getElementById('homeHumorTag');
  if (tag) tag.textContent = 'hoje';
}

const TODAS_EMOCOES = ['feliz', 'calma', 'triste', 'ansiosa', 'brava'];

// soma pontos numa emocao especifica de hoje (upsert por usuario+dia) e re-renderiza a barra.
// tambem balanceia: ninguem fica 100% em tudo ao mesmo tempo — quando uma emocao sobe,
// as outras cedem um pouco de espaco (feito uma respiração real, nunca tudo no maximo junto).
// retorna o valor de ANTES do toque, pra quem chamou saber se já era a 2a+ vez no dia.
async function somarPontoHumor(emocao, pontos) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData || !sessionData.session) return 0;
  const usuarioId = sessionData.session.user.id;
  const hojeStr = new Date().toISOString().slice(0, 10);

  const humorAtual = await buscarHumorHoje();
  const valorAntes = humorAtual[emocao] || 0;
  const novoValor = Math.min(100, valorAntes + pontos);
  const ganhoReal = novoValor - valorAntes;

  const payload = { usuario_id: usuarioId, data: hojeStr, atualizado_em: new Date().toISOString() };
  payload[emocao] = novoValor;

  if (ganhoReal > 0) {
    // "banco" compartilhado: a soma das 5 emoções não passa de 100 no dia — se uma
    // sobe, as outras cedem espaço proporcionalmente (nunca dá pra ficar tudo no talo)
    const outras = TODAS_EMOCOES.filter(e => e !== emocao);
    const totalOutras = outras.reduce((s, e) => s + (humorAtual[e] || 0), 0);
    const excedente = (novoValor + totalOutras) - 100;
    if (excedente > 0 && totalOutras > 0) {
      outras.forEach(e => {
        const valorE = humorAtual[e] || 0;
        if (valorE <= 0) return;
        const fatia = valorE / totalOutras;
        const reduz = Math.min(valorE, Math.round(excedente * fatia));
        payload[e] = Math.max(0, valorE - reduz);
      });
    }
  }

  const { error } = await supabaseClient
    .from('humor_diario')
    .upsert(payload, { onConflict: 'usuario_id,data' });

  if (error) { console.log('erro ao salvar humor:', error.message); return valorAntes; }
  renderHomeHumor(emocao);
  // log de cada toque, com hora exata - é o que alimenta o "resumo do dia"
  // (o humor_diario acima so guarda o total acumulado, sem linha do tempo)
  supabaseClient.from('humor_eventos').insert({ usuario_id: usuarioId, emocao }).then(({ error: erroEvento }) => {
    if (erroEvento) console.log('erro ao registrar evento de humor:', erroEvento.message);
  });
  return valorAntes;
}

// toque numa carinha: reage na hora (bichinho ja cede no toque, feito bola apertada) e registra o ponto de humor.
// se for a 2a+ vez do dia em brava/ansiosa, abre o popup perguntando o motivo.
// atualiza o card "Seu dia" um instante depois do último toque/post (junta vários toques seguidos numa só consulta)
let _resumoDiaTimer = null;
window.atualizarResumoDiaDepois = function () {
  clearTimeout(_resumoDiaTimer);
  _resumoDiaTimer = setTimeout(() => { try { carregarResumoDia(); } catch (e) { /* sem rede, tudo bem */ } }, 1800);
};

window.tocarHumor = async function (emocao) {
  vibrar(8); // vibração bem sutil ao tocar numa emoção
  const wrap = document.getElementById('humorFaceWrap_' + emocao);
  if (wrap) {
    wrap.classList.add('tocando');
    setTimeout(() => wrap.classList.remove('tocando'), 700);
  }
  const valorAntes = await somarPontoHumor(emocao, PONTOS_POR_TOQUE_HUMOR);
  atualizarResumoDiaDepois(); // o card "Seu dia" acompanha os toques
  if (emocao === 'brava' || emocao === 'ansiosa' || emocao === 'triste') {
    // pergunta o motivo no 2o toque do dia (perfeito do jeito que já era),
    // mas depois disso só de novo a cada 4 toques (6o, 10o, 14o...) -- senão
    // fica chato de ficar perguntando toda hora que a pessoa toca de novo
    const numToque = Math.round(valorAntes / PONTOS_POR_TOQUE_HUMOR) + 1;
    const pergunta = numToque === 2 || (numToque > 2 && (numToque - 2) % 4 === 0);
    if (pergunta) window.abrirMotivoHumor(emocao, numToque > 2);
  }
};

window.abrirMotivoHumor = function (emocao, abordagemSimples) {
  window.HUMOR_MOTIVO_EMOCAO_ATUAL = emocao;
  const titulosMotivo = { brava: 'O que te deixou brava?', ansiosa: 'O que te deixou ansiosa?', triste: 'O que te deixou triste?' };
  // a partir da 2a pergunta do dia (6o toque em diante) muda a abordagem:
  // em vez de perguntar o motivo nela de novo, só confirma se quer anotar
  document.getElementById('humorMotivoTitulo').textContent = abordagemSimples ? 'deseja anotar?' : (titulosMotivo[emocao] || 'O que te deixou assim?');
  document.getElementById('humorMotivoInput').value = '';
  document.getElementById('humorMotivoOverlay').classList.add('open');
  setTimeout(() => document.getElementById('humorMotivoInput').focus(), 250);
};

window.salvarMotivoHumor = async function () {
  const emocao = window.HUMOR_MOTIVO_EMOCAO_ATUAL;
  const motivo = document.getElementById('humorMotivoInput').value.trim();
  closeOverlay('humorMotivoOverlay');
  if (!motivo) return;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData || !sessionData.session) return;
  const meuId = sessionData.session.user.id;
  const { error } = await supabaseClient.from('humor_motivos').insert({ usuario_id: meuId, emocao, motivo });
  if (error) { console.log('erro ao salvar motivo do humor:', error.message); return; }
  mostrarToast('💜 guardado no seu perfil');
};

// ---------- caixinha de pandora: motivos de triste/ansiosa/brava guardados
// em humor_motivos, pra reler (ou apagar) quando quiser ----------
const PANDORA_EMOCAO_LABEL = { triste: 'triste', ansiosa: 'ansiosa', brava: 'brava' };

window.abrirCaixinhaPandora = async function () {
  document.getElementById('pandoraOverlay').classList.add('open');
  const lista = document.getElementById('pandoraList');
  lista.innerHTML = `<div class="visitor-lock-note">Carregando...</div>`;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData || !sessionData.session) return;
  const meuId = sessionData.session.user.id;

  const { data: motivos, error } = await supabaseClient
    .from('humor_motivos').select('*').eq('usuario_id', meuId)
    .order('criado_em', { ascending: false });

  if (error) { console.log('erro ao carregar caixinha de pandora:', error.message); lista.innerHTML = `<div class="visitor-lock-note">Não deu pra carregar agora.</div>`; return; }

  lista.innerHTML = (motivos && motivos.length)
    ? motivos.map(m => `
        <div class="friend-row" style="align-items:flex-start;">
          <div class="friend-info">
            <div class="n" style="color:${HUMOR_CORES[m.emocao] || 'var(--ink)'};">${PANDORA_EMOCAO_LABEL[m.emocao] || m.emocao}</div>
            <div class="s" style="white-space:normal; line-height:1.4;">${m.motivo}</div>
            <div class="s" style="opacity:.6; margin-top:2px;">${formatarTempoRelativo(m.criado_em)} · ${formatarDataCurta(m.criado_em)}</div>
          </div>
          <span class="post-action" onclick="apagarMotivoPandora(${m.id})" style="cursor:pointer;">${icone('lixeira',14)}</span>
        </div>`).join('')
    : `<div class="visitor-lock-note">Nada guardado aqui ainda.</div>`;
};

window.apagarMotivoPandora = async function (id) {
  const { error } = await supabaseClient.from('humor_motivos').delete().eq('id', id);
  if (error) { mostrarToast('❌ ' + error.message); return; }
  abrirCaixinhaPandora();
};

// ---------- pressionar e segurar pra reorganizar os blocos da Home (estilo tela inicial do iPhone) ----------
const ORDEM_HOME_PADRAO = ['diario', 'quick', 'humor', 'checklist'];
let organizarHomeAtivo = false;
let pressTimerHome = null;
let arrastandoBlocoHome = null;

function aplicarOrdemHomeSalva() {
  const wrap = document.getElementById('homeBlocosOrganizaveis');
  if (!wrap) return;
  let ordem = ORDEM_HOME_PADRAO;
  try {
    const salva = JSON.parse(localStorage.getItem('atomo_ordem_home') || 'null');
    if (Array.isArray(salva) && salva.length) {
      ordem = salva.filter(k => ORDEM_HOME_PADRAO.includes(k));
      ORDEM_HOME_PADRAO.forEach(k => { if (!ordem.includes(k)) ordem.push(k); });
    }
  } catch (e) {}
  ordem.forEach(chave => {
    const bloco = wrap.querySelector(`.home-organizavel[data-home-key="${chave}"]`);
    if (bloco) wrap.appendChild(bloco);
  });
}

function salvarOrdemHomeAtual() {
  const wrap = document.getElementById('homeBlocosOrganizaveis');
  if (!wrap) return;
  const ordem = Array.from(wrap.children)
    .filter(el => el.classList.contains('home-organizavel'))
    .map(el => el.dataset.homeKey);
  try { localStorage.setItem('atomo_ordem_home', JSON.stringify(ordem)); } catch (e) {}
}

function entrarModoOrganizarHome() {
  if (organizarHomeAtivo) return;
  organizarHomeAtivo = true;
  const wrap = document.getElementById('homeBlocosOrganizaveis');
  if (wrap) wrap.classList.add('modo-organizar');
  const btn = document.getElementById('homeOrganizarProntoBtn');
  if (btn) btn.style.display = 'flex';
  vibrar(12);
}

window.sairModoOrganizarHome = function () {
  organizarHomeAtivo = false;
  const wrap = document.getElementById('homeBlocosOrganizaveis');
  if (wrap) wrap.classList.remove('modo-organizar');
  const btn = document.getElementById('homeOrganizarProntoBtn');
  if (btn) btn.style.display = 'none';
  salvarOrdemHomeAtual();
};

function iniciarArrastoHome(bloco) {
  arrastandoBlocoHome = bloco;
  bloco.classList.add('arrastando');
}

function moverArrastoHome(clientY) {
  if (!arrastandoBlocoHome) return;
  const wrap = document.getElementById('homeBlocosOrganizaveis');
  if (!wrap) return;
  const blocos = Array.from(wrap.children).filter(el => el.classList.contains('home-organizavel'));
  const indiceArrasto = blocos.indexOf(arrastandoBlocoHome);
  for (let i = 0; i < blocos.length; i++) {
    const outro = blocos[i];
    if (outro === arrastandoBlocoHome) continue;
    const r = outro.getBoundingClientRect();
    const centro = r.top + r.height / 2;
    if (i < indiceArrasto && clientY < centro) { wrap.insertBefore(arrastandoBlocoHome, outro); return; }
    if (i > indiceArrasto && clientY > centro) { wrap.insertBefore(arrastandoBlocoHome, outro.nextSibling); return; }
  }
}

function finalizarArrastoHome() {
  if (!arrastandoBlocoHome) return;
  arrastandoBlocoHome.classList.remove('arrastando');
  arrastandoBlocoHome = null;
  salvarOrdemHomeAtual();
}

(function iniciarReorganizarHome() {
  const wrap = document.getElementById('homeBlocosOrganizaveis');
  if (!wrap) return;
  aplicarOrdemHomeSalva();

  wrap.addEventListener('pointerdown', (e) => {
    const bloco = e.target.closest('.home-organizavel');
    if (!bloco) return;
    const ehAlca = e.target.closest('.home-organizavel-handle');
    if (organizarHomeAtivo) {
      if (ehAlca) iniciarArrastoHome(bloco);
      return;
    }
    // fora do modo organizar: pressiona e segura por 500ms sem mexer o dedo pra entrar no modo
    const startY = e.clientY;
    let moveu = false;
    const onMove = (ev) => { if (Math.abs(ev.clientY - startY) > 10) moveu = true; };
    const cancelar = () => {
      clearTimeout(pressTimerHome);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cancelar);
      window.removeEventListener('pointercancel', cancelar);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cancelar);
    window.addEventListener('pointercancel', cancelar);
    pressTimerHome = setTimeout(() => {
      if (moveu) return;
      cancelar();
      entrarModoOrganizarHome();
      iniciarArrastoHome(bloco);
    }, 500);
  });

  window.addEventListener('pointermove', (e) => {
    if (arrastandoBlocoHome) moverArrastoHome(e.clientY);
  });
  window.addEventListener('pointerup', () => { if (arrastandoBlocoHome) finalizarArrastoHome(); });
  window.addEventListener('pointercancel', () => { if (arrastandoBlocoHome) finalizarArrastoHome(); });
})();

// ---------- checklist minimalista do Home ----------
window.CHECKLIST_ITENS = [];
window.CHECKLIST_ITEM_LEMBRETE_ATUAL = null;

function formatarHorarioMin(min) {
  const h24 = Math.floor(min / 60);
  const m = (min % 60).toString().padStart(2, '0');
  if (formatoHora12h) {
    let h12 = h24 % 12; if (h12 === 0) h12 = 12;
    return `${String(h12).padStart(2, '0')}:${m}${h24 < 12 ? 'am' : 'pm'}`;
  }
  return `${String(h24).padStart(2, '0')}:${m}`;
}

async function carregarChecklist() {
  const meuId = window.MEU_USUARIO_ID;
  if (!meuId) return;
  const { data, error } = await supabaseClient
    .from('checklist_itens').select('*').eq('usuario_id', meuId)
    .order('ordem', { ascending: true }).order('criado_em', { ascending: true });
  if (error) { console.log('erro ao carregar checklist:', error.message); return; }
  window.CHECKLIST_ITENS = data || [];
  renderChecklist();
}

function renderChecklist() {
  const wrap = document.getElementById('checklistLista');
  const contagem = document.getElementById('checklistContagem');
  if (!wrap) return;
  const itens = window.CHECKLIST_ITENS || [];
  if (contagem) {
    const feitos = itens.filter(i => i.feito).length;
    contagem.textContent = itens.length ? `${feitos}/${itens.length}` : '';
  }
  if (!itens.length) {
    wrap.innerHTML = `<div class="checklist-vazio">
        <span class="icon-svg" style="width:26px;height:26px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONE_SVG.check}</svg></span>
        <div>nada pendente — adiciona algo pra não esquecer</div>
      </div>`;
    return;
  }
  wrap.innerHTML = itens.map(item => `
      <div class="checklist-item ${item.feito ? 'feito' : ''}">
        <button class="checklist-check" onclick="toggleItemChecklist(${item.id})">${item.feito ? icone('check', 12) : ''}</button>
        <div class="checklist-texto" onclick="toggleItemChecklist(${item.id})">${formatarMencoes(item.texto)}</div>
        ${item.horario_lembrete_min != null ? `<div class="checklist-horario">${formatarHorarioMin(item.horario_lembrete_min)}</div>` : ''}
        <button class="checklist-lembrete-btn" onclick="abrirLembreteItem(${item.id})">${icone('relogio', 15)}</button>
        <button class="checklist-del-btn" onclick="removerItemChecklist(${item.id})">${icone('lixeira', 15)}</button>
      </div>
    `).join('');
}

window.adicionarItemChecklist = async function () {
  const input = document.getElementById('checklistNovoInput');
  const texto = input.value.trim();
  if (!texto) return;
  const meuId = window.MEU_USUARIO_ID;
  input.value = '';
  const { data, error } = await supabaseClient
    .from('checklist_itens').insert({ usuario_id: meuId, texto, ordem: (window.CHECKLIST_ITENS || []).length })
    .select().maybeSingle();
  if (error) { mostrarToast('❌ erro: ' + error.message); return; }
  window.CHECKLIST_ITENS.push(data);
  renderChecklist();
};

window.toggleItemChecklist = async function (id) {
  const item = (window.CHECKLIST_ITENS || []).find(i => i.id === id);
  if (!item) return;
  item.feito = !item.feito;
  renderChecklist();
  await supabaseClient.from('checklist_itens')
    .update({ feito: item.feito, concluido_em: item.feito ? new Date().toISOString() : null }).eq('id', id);
};

window.removerItemChecklist = async function (id) {
  window.CHECKLIST_ITENS = (window.CHECKLIST_ITENS || []).filter(i => i.id !== id);
  renderChecklist();
  await supabaseClient.from('checklist_itens').delete().eq('id', id);
};

window.TEMPO_PICKER_MIN = 7 * 60;

function renderTempoPicker() {
  const h24 = Math.floor(window.TEMPO_PICKER_MIN / 60);
  const m = window.TEMPO_PICKER_MIN % 60;
  const pillAmPm = document.getElementById('tempoPickerAmPm');
  if (formatoHora12h) {
    let h12 = h24 % 12; if (h12 === 0) h12 = 12;
    document.getElementById('tempoPickerHoraNum').textContent = String(h12).padStart(2, '0');
    if (pillAmPm) { pillAmPm.style.display = 'flex'; pillAmPm.textContent = h24 < 12 ? 'AM' : 'PM'; }
  } else {
    document.getElementById('tempoPickerHoraNum').textContent = String(h24).padStart(2, '0');
    if (pillAmPm) pillAmPm.style.display = 'none';
  }
  document.getElementById('tempoPickerMinNum').textContent = String(m).padStart(2, '0');
  document.getElementById('checklistLembreteInput').value = String(h24).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

window.alternarAmPm = function () {
  vibrar(6);
  window.TEMPO_PICKER_MIN = (window.TEMPO_PICKER_MIN + 720) % 1440;
  renderTempoPicker();
};

window.toggleFormatoHora = async function () {
  formatoHora12h = !formatoHora12h;
  document.getElementById('formatoHoraSwitch').classList.toggle('on', formatoHora12h);
  renderChecklist();
  renderTempoPicker();
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (sessionData.session) {
    await supabaseClient.from('usuarios').update({ formato_hora_12h: formatoHora12h }).eq('id', sessionData.session.user.id);
  }
};

// ---------- suporte e feedback (manda um e-mail pra gente pelo servidor) ----------
let feedbackTipoAtual = 'sugestao';
window.abrirFeedbackOverlay = function () {
  document.getElementById('feedbackTexto').value = '';
  feedbackTipoAtual = 'sugestao';
  document.getElementById('feedbackTipoSugestao').classList.add('on');
  document.getElementById('feedbackTipoReclamacao').classList.remove('on');
  document.getElementById('feedbackOverlay').classList.add('open');
};
window.escolherTipoFeedback = function (tipo) {
  feedbackTipoAtual = tipo;
  document.getElementById('feedbackTipoSugestao').classList.toggle('on', tipo === 'sugestao');
  document.getElementById('feedbackTipoReclamacao').classList.toggle('on', tipo === 'reclamacao');
};
window.enviarFeedback = async function () {
  const texto = document.getElementById('feedbackTexto').value.trim();
  if (!texto) { mostrarToast('escreve uma mensagem antes de mandar 📝'); return; }
  const btn = document.getElementById('feedbackEnviarBtn');
  if (btn) btn.disabled = true;
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const handleEl = document.getElementById('profHandle');
    const usuarioHandle = handleEl ? handleEl.textContent.replace('@', '') : '';
    const usuarioEmail = sessionData.session ? sessionData.session.user.email : '';
    const resp = await fetch(`${API_BASE}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem: texto, tipo: feedbackTipoAtual, usuarioHandle, usuarioEmail }),
    });
    const resultado = await resp.json().catch(() => ({}));
    if (!resp.ok || resultado.erro) { mostrarToast('❌ ' + (resultado.erro || 'não consegui enviar, tenta de novo')); return; }
    mostrarToast('💌 recebido, obrigada!');
    closeOverlay('feedbackOverlay');
  } catch (e) {
    mostrarToast('❌ erro ao enviar: ' + e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ---------- convite pro Match (aparece sozinho depois de um tempo de uso) ----------
window.verificarConviteMatch = function (matchJaAtivado, streakAtualNoConvite, jaViuConvite) {
  if (matchJaAtivado || jaViuConvite) return;
  if ((streakAtualNoConvite || 0) < 2) return; // só depois de uns dias reais de uso
  setTimeout(() => mostrarConviteMatch(), 7000);
};

window.mostrarConviteMatch = function () {
  if (document.querySelector('.write-popup-bg.show, .config-overlay.open, .dm-chat-overlay.open, .composer-glass-bg.open')) {
    setTimeout(() => mostrarConviteMatch(), 4000);
    return;
  }
  const avatarEl = document.getElementById('conviteMatchAvatar');
  if (avatarEl) avatarEl.innerHTML = avatarConteudo(null);
  document.getElementById('conviteMatchOverlay').classList.add('open');
};

window.responderConviteMatch = async function (ativar) {
  document.getElementById('conviteMatchOverlay').classList.remove('open');
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (sessionData.session) {
    await supabaseClient.from('usuarios').update({ viu_convite_match: true }).eq('id', sessionData.session.user.id);
  }
  if (ativar) {
    await toggleMatch();
    mostrarToast('💛 Match ativado! já dá pra ver quem tem interesse parecido');
    abrirMatch();
  }
};

window.ajustarTempoPicker = function (parte, dir) {
  vibrar(6);
  let h = Math.floor(window.TEMPO_PICKER_MIN / 60);
  let m = window.TEMPO_PICKER_MIN % 60;
  if (parte === 'h') { h = (h + dir + 24) % 24; }
  else { m = (Math.round(m / 5) * 5 + dir * 5 + 60) % 60; }
  window.TEMPO_PICKER_MIN = h * 60 + m;
  renderTempoPicker();
};

window.abrirLembreteItem = function (id) {
  window.MODO_LEMBRETE_ATUAL = 'checklist';
  document.getElementById('lembretePickerTitulo').textContent = 'Avisar em que horário?';
  document.getElementById('lembretePickerDesc').textContent = 'o app avisa nesse horário até você marcar como feito.';
  window.CHECKLIST_ITEM_LEMBRETE_ATUAL = id;
  const item = (window.CHECKLIST_ITENS || []).find(i => i.id === id);
  if (item && item.horario_lembrete_min != null) {
    window.TEMPO_PICKER_MIN = item.horario_lembrete_min;
  } else {
    const agora = new Date();
    window.TEMPO_PICKER_MIN = (agora.getHours() * 60 + Math.ceil(agora.getMinutes() / 5) * 5) % 1440;
  }
  renderTempoPicker();
  document.getElementById('checklistLembreteOverlay').classList.add('open');
};

window.salvarLembreteChecklist = async function () {
  const id = window.CHECKLIST_ITEM_LEMBRETE_ATUAL;
  if (!id) return;
  const min = window.TEMPO_PICKER_MIN;
  const item = (window.CHECKLIST_ITENS || []).find(i => i.id === id);
  if (item) item.horario_lembrete_min = min;
  renderChecklist();
  closeOverlay('checklistLembreteOverlay');
  await supabaseClient.from('checklist_itens').update({ horario_lembrete_min: min, ultimo_lembrete_data: null }).eq('id', id);
};

window.removerLembreteChecklist = async function () {
  const id = window.CHECKLIST_ITEM_LEMBRETE_ATUAL;
  if (!id) return;
  const item = (window.CHECKLIST_ITENS || []).find(i => i.id === id);
  if (item) item.horario_lembrete_min = null;
  renderChecklist();
  closeOverlay('checklistLembreteOverlay');
  await supabaseClient.from('checklist_itens').update({ horario_lembrete_min: null }).eq('id', id);
};

// ---------- lembrete diario de leitura (sugerido quando termina um livro) ----------
window.abrirLembreteLeitura = function () {
  window.MODO_LEMBRETE_ATUAL = 'leitura';
  document.getElementById('lembretePickerTitulo').textContent = 'Que horas você quer ler?';
  document.getElementById('lembretePickerDesc').textContent = 'todo dia nesse horário, um lembrete gentil pra você continuar lendo.';
  window.TEMPO_PICKER_MIN = horarioLembreteLeituraMin != null ? horarioLembreteLeituraMin : 1200;
  renderTempoPicker();
  document.getElementById('checklistLembreteOverlay').classList.add('open');
};

window.salvarLembreteLeitura = async function () {
  const min = window.TEMPO_PICKER_MIN;
  horarioLembreteLeituraMin = min;
  closeOverlay('checklistLembreteOverlay');
  mostrarToast('📚 lembrete de leitura configurado!');
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  await supabaseClient.from('usuarios').update({ horario_lembrete_leitura_min: min, ultimo_lembrete_leitura_data: null }).eq('id', sessionData.session.user.id);
};

window.removerLembreteLeitura = async function () {
  horarioLembreteLeituraMin = null;
  closeOverlay('checklistLembreteOverlay');
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;
  await supabaseClient.from('usuarios').update({ horario_lembrete_leitura_min: null }).eq('id', sessionData.session.user.id);
};
