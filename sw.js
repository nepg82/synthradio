// Service worker: cache the app shell so it works offline.
// Bump CACHE whenever any file changes, or installed copies keep serving the old one.
const CACHE = 'synth-radio-v1.0.17';
const ASSETS = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/app.js', './js/mediasession.js',
  './js/engine/music.js', './js/engine/instruments.js', './js/engine/audio.js',
  './js/engine/parts.js', './js/engine/song.js', './js/engine/radio.js', './js/engine/sequencer.js',
  './js/styles/index.js', './js/styles/chillwave.js',
  './app-icons/app-icon-192.png', './app-icons/app-icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (location.hostname === 'localhost') return; // always fresh while developing
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
