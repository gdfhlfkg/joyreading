const urlsToCache = [
  '.',
  'index.html',
  'css/style.css',
  'js/utils.js',
  'js/db.js',
  'js/bookmarks.js',
  'js/imports.js',
  'js/library.js',
  'js/reader.js',
  'js/sync.js',
  'js/app.js',
  'manifest.json',
  'assets/vendor/fontawesome/css/all.min.css',
  'assets/vendor/fontawesome/webfonts/fa-solid-900.woff2',
  'assets/vendor/fontawesome/webfonts/fa-regular-400.woff2',
  'assets/vendor/fontawesome/webfonts/fa-brands-400.woff2',
  'assets/vendor/fonts/index.css',
  'assets/vendor/fonts/files/noto-serif-sc-chinese-simplified-400.woff2',
  'assets/vendor/fonts/files/noto-serif-sc-chinese-simplified-600.woff2',
  'assets/vendor/fonts/files/noto-serif-sc-chinese-simplified-700.woff2',
  'assets/vendor/libs/dexie.min.js',
  'assets/vendor/libs/jszip.min.js',
  'assets/vendor/libs/pdfjs/pdf.min.js',
  'assets/vendor/libs/pdfjs/pdf.worker.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('yuedu-v1').then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});