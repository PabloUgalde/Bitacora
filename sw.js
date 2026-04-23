const CACHE_NAME = 'flight-log-cache-v2.26';

const APP_SHELL_FILES = [
    './index.html',
    './style.css',
    './custom-styles.css',
    './mobile.css',
    './print.css',
    './app.js',
    './api.js',
    './auth.js',
    './profile-validator.js',
    './ui.js',
    './ui-render.js',
    './state.js',
    './summary-renderer.js',
    './report-generator.js',
    './data-importer.js',
    './backup-manager.js',
    './logo-avion.png',
    './logo-avion-osc.png',
    './icon-192.png',
    './icon-512.png',
    './favicon.ico'
];

self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalando v2.0...');
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Guardando en caché el App Shell');
            return cache.addAll(APP_SHELL_FILES);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activando...');
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Eliminando caché antigua', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // No interceptar peticiones a Supabase ni CDNs externos
    if (e.request.url.includes('supabase.co') ||
        e.request.url.includes('cdn.jsdelivr.net') ||
        e.request.url.includes('google.com')) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});