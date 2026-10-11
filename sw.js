// service worker simples do Átomo — só cuida do essencial pra virar PWA instalável.
// estratégia "network-first": sempre busca a versão nova primeiro (o app ainda muda
// toda hora); só usa o cache se o celular estiver offline. Nunca mexe em chamadas
// pra fora (Supabase, TMDB, etc.) — essas passam direto pela rede.

const CACHE_NAME = 'atomo-v10';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/layout.css',
  './css/feed.css',
  './css/perfil.css',
  './css/descobrir.css',
  './css/mensagens.css',
  './css/toque.css',
  './css/leitor.css',
  './css/config-popups.css',
  './css/icones.css',
  './css/clubes.css',
  './css/estante-autoral.css',
  './css/comunidades.css',
  './css/sala-estudo.css',
  './css/clube-detalhe.css',
  './css/explorar.css',
  './css/estante.css',
  './css/busca.css',
  './css/diario.css',
  './css/radio-humor.css',
  './css/home-widgets.css',
  './js/config.js',
  './js/registro-erros.js',
  './js/i18n.js',
  './js/feedback-sensorial.js',
  './js/icones.js',
  './js/feed.js',
  './js/posts-editar-salvar.js',
  './js/comentarios.js',
  './js/diario.js',
  './js/mencoes-previas.js',
  './js/conexoes.js',
  './js/sequencia-selos.js',
  './js/home.js',
  './js/radio.js',
  './js/perfil.js',
  './js/referencias.js',
  './js/conta-match.js',
  './js/descobrir.js',
  './js/comunidades.js',
  './js/sala-estudo.js',
  './js/clubes.js',
  './js/livros-gratis.js',
  './js/estante.js',
  './js/estante-autoral.js',
  './js/cartoes.js',
  './js/leitor.js',
  './js/descobrir-itens.js',
  './js/mensagens.js',
  './js/mensagens-midia.js',
  './js/navegacao.js',
  './js/configuracoes.js',
  './js/seu-dia.js',
  './js/clima-tema.js',
  './js/notificacoes.js',
  './js/utilidades.js',
  './js/auth-onboarding.js',
  './js/escrita-notificacoes.js',
  './js/init.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// ---------- notificação push externa (manhã/noite) ----------
self.addEventListener('push', (event) => {
  let dados = { titulo: 'Átomo', corpo: 'Você tem uma novidade no seu diário.' };
  try {
    if (event.data) dados = event.data.json();
  } catch (e) {
    if (event.data) dados.corpo = event.data.text();
  }

  // monta a URL de destino a partir do tipo/post_id/ator_id que o servidor
  // mandou junto — sem isso, clicar em QUALQUER notificação push só abria o
  // app na tela padrão, nunca levava pro post/perfil/conversa de verdade
  const d = dados.dados || null;
  let url = './index.html';
  if (d && d.tipo) {
    const params = new URLSearchParams();
    params.set('notif_tipo', d.tipo);
    if (d.post_id) params.set('notif_post', d.post_id);
    if (d.ator_id) params.set('notif_ator', d.ator_id);
    url = './index.html?' + params.toString();
  }

  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'Átomo', {
      body: dados.corpo || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [80, 40, 80],
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // se o app já tá aberto numa aba, só focar não adianta — ela já carregou,
      // não vai reler a URL sozinha. Manda a rota por postMessage pro código
      // do index.html decidir pra onde ir (é o mesmo abrirNotificacao de sempre).
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.postMessage({ tipo: 'atomo-notif-click', url });
          return janela.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // deixa Supabase/APIs externas passarem direto

  event.respondWith(
    fetch(event.request)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return resposta;
      })
      .catch(() => caches.match(event.request))
  );
});
