// Работа без сети: оболочка игры хранится в телефоне, картинки и шрифты
// запоминаются после первой загрузки. При выпуске новой версии поднять VERSION.

const VERSION = 'igra-v3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css?v=3',
  'js/main.js?v=3', 'js/rules.js', 'js/gen.js', 'js/ai.js', 'js/ui.js', 'js/combat.js', 'js/combat-view.js', 'js/theater.js', 'js/cast.js', 'js/director.js',
  'vendor/three/build/three.module.min.js', 'vendor/three/addons/loaders/GLTFLoader.js', 'vendor/three/addons/utils/SkeletonUtils.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js', 'vendor/three/addons/libs/meshopt_decoder.module.js', 'models/anims.glb',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'igra-media' && k !== 'igra-art').map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Картинки нейросети и шрифты: сначала из памяти телефона
  if (url.hostname === 'image.pollinations.ai' || url.hostname.endsWith('gstatic.com') || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(caches.open('igra-media').then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    }));
    return;
  }

  // Файлы игры: сначала сеть (чтобы приходили обновления), без сети из памяти
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: false }).then((r) => r || caches.match('index.html'))));
  }
});
