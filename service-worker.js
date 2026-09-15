const CACHE_NAME = 'mirastep-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './hero.jpg',
  'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js'
];

// オフラインでも読み込めるように、フォントとFirebase SDKだけはキャッシュ対象にする
// (Firestoreの実際の通信先=firestore.googleapis.com はキャッシュしない、常に生きた接続が必要なため)
const CACHEABLE_CROSS_ORIGIN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isCrossOrigin = url.origin !== self.location.origin;

  if (isCrossOrigin && !CACHEABLE_CROSS_ORIGIN_HOSTS.includes(url.hostname)) {
    return; // Firestoreの実通信などには一切関与しない
  }

  const isAppShell = !isCrossOrigin && (event.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') || url.pathname.endsWith('/'));

  if (isAppShell) {
    // アプリ本体は常にネットワークを優先し、コード更新をすぐ反映する
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 画像・マニフェスト・フォント・Firebase SDKなど静的アセットはキャッシュ優先(オフライン対応・高速表示)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200 && event.request.method === 'GET') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
