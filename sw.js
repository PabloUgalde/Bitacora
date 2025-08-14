const CACHE_NAME = 'flight-log-cache-v1.0';
// Lista de archivos que componen el "cascarón" de la aplicación.
const APP_SHELL_FILES = [
    './index.html',
    './style.css',
    './custom-styles.css',
    './mobile.css',
    './app.js',
    './api.js',
    './ui.js',
    './ui-render.js',
    './state.js',
    './summary-renderer.js',
    './report-generator.js',
    './data-importer.js',
    './backup-manager.js',
    './logo-avion.png',
    './icon-192.png',
    './icon-512.png',
    './favicon.ico'
];

// Evento de instalación: se guarda el app shell en la caché.
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalando...');
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Guardando en caché el App Shell');
            return cache.addAll(APP_SHELL_FILES);
        })
    );
});

// Evento de activación: limpia cachés antiguas.
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

// Evento fetch: intercepta las peticiones de red.
// Estrategia: "Cache first, falling back to network" (Primero caché, si no, red).
self.addEventListener('fetch', (e) => {
    // No interceptamos las peticiones a la API de Google Sheets
    if (e.request.url.includes('google.com')) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});