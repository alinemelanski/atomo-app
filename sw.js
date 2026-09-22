// service worker simples do Átomo — só cuida do essencial pra virar PWA instalável.
// estratégia "network-first": sempre busca a versão nova primeiro (o app ainda muda
// toda hora); só usa o cache se o celular estiver offline. Nunca mexe em chamadas
// pra fora (Supabase, TMDB, etc.) — essas passam direto pela rede.

const CACHE_NAME = 'atomo-v1';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
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

  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'Átomo', {
      body: dados.corpo || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [80, 40, 80],
      data: { url: './index.html' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) return janela.focus();
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
