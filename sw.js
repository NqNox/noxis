const CACHE_NAME = 'noxis-v1';
const ASSETS = [
    '/',
    '/pages/dashboard.html',
    '/assets/css/dashboard.css',
    '/assets/js/dashboard.js',
    '/assets/js/config.js',
    '/favicon.svg'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(response => response || fetch(e.request))
    );
});