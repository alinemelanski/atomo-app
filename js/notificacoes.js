/* js/notificacoes.js — Notificações push, guia de instalação e avisos
   Script comum (sem módulo): divide o escopo global com os outros arquivos de js/.
   A ordem dos <script> no index.html importa. */

let notifAtivo = true;
window.toggleNotif = async function () {
  notifAtivo = !notifAtivo;
  document.getElementById('notifSwitch').classList.toggle('on', notifAtivo);

  const { data: sessionData } = await supabaseClient.auth.getSession();
  await supabaseClient.from('usuarios').update({ notif_ativado: notifAtivo }).eq('id', sessionData.session.user.id);

  if (notifAtivo) pedirPermissaoEInscreverPush();
};

// ---------- guia de instalação (adicionar à tela inicial) ----------
function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

window.DEFERRED_INSTALL_PROMPT = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.DEFERRED_INSTALL_PROMPT = e;
});

function montarPassosGuiaInstalacao() {
  if (isIOSDevice()) {
    return [
      { icone: 'compartilhar', texto: 'Toque em Compartilhar' },
      { icone: 'instalar', texto: 'Adicionar à Tela de Início' },
      { icone: 'check', texto: 'Toque em Adicionar' },
    ];
  }
  if (window.DEFERRED_INSTALL_PROMPT) return [];
  return [
    { icone: 'maisOpcoes', texto: 'Toque no menu do navegador' },
    { icone: 'instalar', texto: 'Instalar app' },
    { icone: 'check', texto: 'Confirme' },
  ];
}

window.abrirGuiaInstalacao = function () {
  if (isStandalonePwa()) return;
  const passos = montarPassosGuiaInstalacao();
  const posicaoDot = isIOSDevice() ? 'base-centro' : 'topo-direita';
  const mockupHtml = passos.length
    ? '<div class="guia-instalacao-mockup"><div class="guia-instalacao-dot ' + posicaoDot + '"></div></div>'
    : '';
  document.getElementById('guiaInstalacaoPassos').innerHTML = passos.length
    ? mockupHtml + passos.map((p) => '<div class="guia-passo"><span class="guia-passo-icone">' + icone(p.icone, 19) + '</span><div>' + p.texto + '</div></div>').join('')
    : '<div class="visitor-lock-note" style="margin-bottom:10px;">Seu navegador já pode instalar o Átomo com um toque.</div>';
  document.getElementById('guiaInstalacaoBtnInstalar').style.display = window.DEFERRED_INSTALL_PROMPT ? 'block' : 'none';
  document.getElementById('guiaInstalacaoPopupBg').classList.add('show');
};

window.instalarAgoraPwa = async function () {
  if (!window.DEFERRED_INSTALL_PROMPT) return;
  window.DEFERRED_INSTALL_PROMPT.prompt();
  await window.DEFERRED_INSTALL_PROMPT.userChoice;
  window.DEFERRED_INSTALL_PROMPT = null;
  fecharGuiaInstalacao();
};

window.fecharGuiaInstalacao = async function () {
  document.getElementById('guiaInstalacaoPopupBg').classList.remove('show');
  await marcarGuiaVisto();
  if (etapaBoasVindas === 'guia') passoNotificacaoBoasVindas(); // próxima etapa da fila
};

// ---------- FILA DE BOAS-VINDAS: perguntas → guia de instalação → notificação ----------
// Antes cada coisa tinha seu próprio relógio (setTimeout de 1,2s, 1,8s, 2,6s, 4,5s) e elas
// abriam umas por cima das outras — o banner de notificação aparecia até no meio das perguntas.
// Agora é uma fila: cada etapa só começa quando a anterior FECHA.
//   1. as perguntas (onboarding) — quem chama esta fila só chama depois delas
//   2. o guia "adicione à tela inicial" — só se ainda não viu e não está no app instalado
//   3. o pedido de notificação — só se o navegador ainda não perguntou nada
let etapaBoasVindas = null;

// espera a tela ficar livre (sem perguntas, sem outra janela aberta) antes de mostrar algo
function quandoTelaLivre(fn) {
  const ocupada = document.querySelector('#onboardOverlay:not(.hide), .write-popup-bg.show, .config-overlay.open, .dm-chat-overlay.open, .selo-pacote-overlay.show');
  if (ocupada) { setTimeout(() => quandoTelaLivre(fn), 2500); return; }
  fn();
}

async function marcarGuiaVisto() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (sessionData.session) {
    await supabaseClient.from('usuarios').update({ viu_guia_instalacao: true }).eq('id', sessionData.session.user.id);
  }
}

window.iniciarBoasVindas = function (jaViuGuia) {
  reinscreverPushSilencioso(); // quem já deu permissão: garante que o servidor tem a inscrição deste aparelho
  if (isStandalonePwa()) {
    if (!jaViuGuia) marcarGuiaVisto(); // já está usando o app instalado: não precisa do guia
    passoNotificacaoBoasVindas();
    return;
  }
  if (jaViuGuia) { passoNotificacaoBoasVindas(); return; }
  etapaBoasVindas = 'guia';
  setTimeout(() => quandoTelaLivre(() => abrirGuiaInstalacao()), 1200);
};

function passoNotificacaoBoasVindas() {
  etapaBoasVindas = null;
  // a marca é deste APARELHO (cada celular/navegador precisa da própria permissão)
  try { if (localStorage.getItem('atomoNotifBannerDispensado') === '1') return; } catch (e) {}
  setTimeout(() => mostrarBannerNotificacao(), 900);
}

// ---------- notificação push externa (manhã/noite) ----------
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const saida = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) saida[i] = rawData.charCodeAt(i);
  return saida;
}

window.pedirPermissaoEInscreverPush = async function () {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission === 'denied') return;

  if (Notification.permission === 'default') {
    const resultado = await Notification.requestPermission();
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData.session) {
      await supabaseClient.from('usuarios').update({ pediu_permissao_notif: true }).eq('id', sessionData.session.user.id);
    }
    if (resultado !== 'granted') return;
  }
  if (Notification.permission !== 'granted') return;

  try {
    const resp = await fetch(`${API_BASE}/api/push/chave-publica`);
    const { chave } = await resp.json();
    if (!chave) return;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(chave),
      });
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData.session) {
      // o servidor descobre de quem é a inscrição pelo token (não aceita mais "usuarioId" no corpo)
      await fetch(`${API_BASE}/api/push/inscrever`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionData.session.access_token },
        body: JSON.stringify({ subscription }),
      });
    }
  } catch (e) {
    console.log('erro ao inscrever notificação push:', e.message);
  }
};

// Quem JÁ deu permissão antes: renova a inscrição em silêncio a cada entrada.
// Sem isso, se a inscrição sumisse do servidor (aparelho trocou a chave, banco limpou uma
// inscrição expirada...), a pessoa nunca mais recebia notificação e nem ficava sabendo.
function reinscreverPushSilencioso() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (typeof notifAtivo !== 'undefined' && notifAtivo === false) return; // desligou em Configurações
  pedirPermissaoEInscreverPush(); // com permissão já dada, isso NÃO mostra pergunta nenhuma
}

// pedir notificação direto (sem toque da pessoa) é bloqueado silenciosamente pela
// maioria dos navegadores mobile — por isso mostramos um banner com botão, e só
// chamamos a permissão real a partir do clique nesse botão (gesto real do usuário)
window.mostrarBannerNotificacao = function () {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'default') return;
  if (document.querySelector('#onboardOverlay:not(.hide), .write-popup-bg.show, .config-overlay.open, .dm-chat-overlay.open, .selo-pacote-overlay.show')) {
    setTimeout(() => mostrarBannerNotificacao(), 3000);
    return;
  }
  const banner = document.getElementById('notifBanner');
  const icone2 = document.getElementById('notifBannerIcone');
  if (icone2 && window.icone) icone2.innerHTML = icone('sino', 18, null, '#fff');
  banner.classList.add('show');
};

window.fecharBannerNotificacao = async function (marcarPedido) {
  document.getElementById('notifBanner').classList.remove('show');
  if (marcarPedido) {
    try { localStorage.setItem('atomoNotifBannerDispensado', '1'); } catch (e) {}
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData.session) {
      await supabaseClient.from('usuarios').update({ pediu_permissao_notif: true }).eq('id', sessionData.session.user.id);
    }
  }
};

window.ativarNotifPeloBanner = function () {
  fecharBannerNotificacao(false);
  pedirPermissaoEInscreverPush();
};

// dispara pro backend mandar uma notificação de teste agora mesmo,
// sem depender de horário — pra conferir se o push tá chegando no aparelho
window.testarNotificacaoPush = async function () {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    mostrarToast('Seu navegador não suporta notificações push 😕');
    return;
  }
  if (Notification.permission !== 'granted') {
    mostrarToast('Ative as notificações primeiro (toque no sino) 🔔');
    return;
  }
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) return;

  mostrarToast('Enviando notificação de teste…');
  try {
    const resp = await fetch(`${API_BASE}/api/push/testar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionData.session.access_token },
    });
    const dados = await resp.json();
    if (dados.ok && dados.enviadas > 0) {
      mostrarToast('Enviada! Deve chegar em alguns segundos 🔔');
    } else if (dados.ok && dados.enviadas === 0) {
      mostrarToast('Nenhuma inscrição push encontrada nesse aparelho 😕');
    } else {
      mostrarToast('Erro ao testar: ' + (dados.erro || 'desconhecido'));
    }
  } catch (e) {
    mostrarToast('Erro ao testar notificação 😕');
  }
};
