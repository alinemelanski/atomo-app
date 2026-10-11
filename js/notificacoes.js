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
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (sessionData.session) {
    await supabaseClient.from('usuarios').update({ viu_guia_instalacao: true }).eq('id', sessionData.session.user.id);
  }
};

window.verificarGuiaInstalacao = async function (jaViu) {
  if (isStandalonePwa()) {
    if (!jaViu) {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      if (sessionData.session) {
        await supabaseClient.from('usuarios').update({ viu_guia_instalacao: true }).eq('id', sessionData.session.user.id);
      }
    }
    return;
  }
  if (jaViu) return;
  setTimeout(() => abrirGuiaInstalacao(), 1800);
};

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
      await fetch(`${API_BASE}/api/push/inscrever`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId: sessionData.session.user.id, subscription }),
      });
    }
  } catch (e) {
    console.log('erro ao inscrever notificação push:', e.message);
  }
};

window.verificarPermissaoNotifPush = function (jaPediu) {
  // "jaPediu" vem do banco (por CONTA), mas o pedido de notificação é por
  // NAVEGADOR/aparelho — se a pessoa já ativou no celular isso não quer dizer
  // que esse computador/navegador já tem inscrição de push. Por isso o que
  // realmente decide se mostra o banner de novo é uma marca local desse
  // aparelho (localStorage), não a flag da conta.
  try {
    if (localStorage.getItem('atomoNotifBannerDispensado') === '1') return;
  } catch (e) {}
  setTimeout(() => mostrarBannerNotificacao(), 4500);
};

// pedir notificação direto (sem toque da pessoa) é bloqueado silenciosamente pela
// maioria dos navegadores mobile — por isso mostramos um banner com botão, e só
// chamamos a permissão real a partir do clique nesse botão (gesto real do usuário)
window.mostrarBannerNotificacao = function () {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'default') return;
  if (document.querySelector('.write-popup-bg.show, .config-overlay.open, .dm-chat-overlay.open')) {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioId: sessionData.session.user.id }),
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
