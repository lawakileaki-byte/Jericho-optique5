// ===== SERVICE WORKER — Jéricho Optique PWA =====
const CACHE_NAME = 'jericho-optique-v1';
const BASE_URL = '/Jericho-optique5/';

// Fichiers à mettre en cache pour le mode hors-connexion
const STATIC_ASSETS = [
  BASE_URL,
  BASE_URL + 'index.html',
  BASE_URL + 'manifest.json'
];

// URLs à ne jamais mettre en cache (Supabase, API externe)
const BYPASS_PATTERNS = [
  'supabase.co',
  'googleapis.com',
  'gstatic.com'
];

// ===== INSTALLATION =====
self.addEventListener('install', event => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Pré-cache partiel:', err);
      });
    }).then(() => {
      self.skipWaiting();
    })
  );
});

// ===== ACTIVATION =====
self.addEventListener('activate', event => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// ===== STRATEGIE FETCH : Network First =====
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Bypass total pour Supabase et APIs externes → réseau direct, pas de cache
  if (BYPASS_PATTERNS.some(pattern => url.includes(pattern))) {
    return; // Laisser le navigateur gérer normalement
  }

  // Pour les requêtes GET seulement
  if (event.request.method !== 'GET') return;

  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  try {
    // 1. Essaie le réseau en priorité
    const networkResponse = await fetch(request);

    // 2. Si succès, met à jour le cache
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // 3. Si hors-connexion, cherche dans le cache
    console.log('[SW] Hors-connexion, cache utilisé pour:', request.url);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // 4. Dernier recours : retourner la page principale en cache
    const fallback = await caches.match(BASE_URL + 'index.html');
    if (fallback) {
      return fallback;
    }

    // 5. Vraiment rien → erreur réseau standard
    return new Response('Hors connexion - Reconnectez-vous pour accéder à Jéricho Optique', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
