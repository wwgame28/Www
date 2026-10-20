/* RUMBAI service worker. Generated at build time from pwa/sw.template.js. */
const VERSION = '48f2070d0627';
/** URL path the app is served under, e.g. '/' or '/Www/rumbai-app/'. */
const BASE = '/Www/rumbai-app/';
const SHELL_CACHE = `rumbai-shell-${VERSION}`;
const RUNTIME_CACHE = 'rumbai-runtime';
/** Small files needed to start offline. */
const PRECACHE = ["/Www/rumbai-app/index.html","/Www/rumbai-app/offline.html","/Www/rumbai-app/manifest.webmanifest","/Www/rumbai-app/assets/index-C2BatvFF.js","/Www/rumbai-app/assets/AssistantScreen-QHLEMgV7.js","/Www/rumbai-app/assets/AutomationsScreen-BG6DD-zp.js","/Www/rumbai-app/assets/FilesScreen-xXHtwggD.js","/Www/rumbai-app/assets/KnowledgeScreen-e6DVe6cw.js","/Www/rumbai-app/assets/ModelsScreen-CsTt-qR-.js","/Www/rumbai-app/assets/NotesScreen-Di7vQr25.js","/Www/rumbai-app/assets/ScreenHeader-7t5WdJaZ.js","/Www/rumbai-app/assets/SettingsScreen-w5SsioYD.js","/Www/rumbai-app/assets/TasksScreen-DJbqMFqw.js","/Www/rumbai-app/assets/cloud-BnBvSY4J.js","/Www/rumbai-app/assets/controls-DqvCVLG-.js","/Www/rumbai-app/assets/download-nmHvvsUk.js","/Www/rumbai-app/assets/file-text-dwxwjPof.js","/Www/rumbai-app/assets/lock-CfLqDn5u.js","/Www/rumbai-app/assets/markdown-D5WEoOww.js","/Www/rumbai-app/assets/play-ko3Fb73g.js","/Www/rumbai-app/assets/plus-DR_3u6EL.js","/Www/rumbai-app/assets/shield-alert-YmFltbyl.js","/Www/rumbai-app/assets/trash-2mMOTUpu.js","/Www/rumbai-app/assets/index-B5RQalNM.css","/Www/rumbai-app/assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2","/Www/rumbai-app/assets/inter-cyrillic-wght-normal-DqGufNeO.woff2","/Www/rumbai-app/assets/inter-greek-ext-wght-normal-DlzME5K_.woff2","/Www/rumbai-app/assets/inter-greek-wght-normal-CkhJZR-_.woff2","/Www/rumbai-app/assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2","/Www/rumbai-app/assets/inter-latin-wght-normal-Dx4kXJAl.woff2","/Www/rumbai-app/assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2","/Www/rumbai-app/icons/icon.svg","/Www/rumbai-app/icons/icon-192.png","/Www/rumbai-app/icons/icon-512.png","/Www/rumbai-app/icons/apple-touch-icon.png"];
/** Every file in this build; runtime-cached files not listed here are stale and pruned. */
const ALL_ASSETS = new Set(["/Www/rumbai-app/index.html","/Www/rumbai-app/offline.html","/Www/rumbai-app/manifest.webmanifest","/Www/rumbai-app/assets/index-C2BatvFF.js","/Www/rumbai-app/assets/AssistantScreen-QHLEMgV7.js","/Www/rumbai-app/assets/AutomationsScreen-BG6DD-zp.js","/Www/rumbai-app/assets/FilesScreen-xXHtwggD.js","/Www/rumbai-app/assets/KnowledgeScreen-e6DVe6cw.js","/Www/rumbai-app/assets/ModelsScreen-CsTt-qR-.js","/Www/rumbai-app/assets/NotesScreen-Di7vQr25.js","/Www/rumbai-app/assets/ScreenHeader-7t5WdJaZ.js","/Www/rumbai-app/assets/SettingsScreen-w5SsioYD.js","/Www/rumbai-app/assets/TasksScreen-DJbqMFqw.js","/Www/rumbai-app/assets/cloud-BnBvSY4J.js","/Www/rumbai-app/assets/controls-DqvCVLG-.js","/Www/rumbai-app/assets/download-nmHvvsUk.js","/Www/rumbai-app/assets/file-text-dwxwjPof.js","/Www/rumbai-app/assets/lib-CjnceT-k.js","/Www/rumbai-app/assets/lock-CfLqDn5u.js","/Www/rumbai-app/assets/markdown-D5WEoOww.js","/Www/rumbai-app/assets/play-ko3Fb73g.js","/Www/rumbai-app/assets/plus-DR_3u6EL.js","/Www/rumbai-app/assets/shield-alert-YmFltbyl.js","/Www/rumbai-app/assets/trash-2mMOTUpu.js","/Www/rumbai-app/assets/index-B5RQalNM.css","/Www/rumbai-app/assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2","/Www/rumbai-app/assets/inter-cyrillic-wght-normal-DqGufNeO.woff2","/Www/rumbai-app/assets/inter-greek-ext-wght-normal-DlzME5K_.woff2","/Www/rumbai-app/assets/inter-greek-wght-normal-CkhJZR-_.woff2","/Www/rumbai-app/assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2","/Www/rumbai-app/assets/inter-latin-wght-normal-Dx4kXJAl.woff2","/Www/rumbai-app/assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2","/Www/rumbai-app/assets/local-worker-CFsBi9cT.js","/Www/rumbai-app/icons/icon.svg","/Www/rumbai-app/icons/icon-192.png","/Www/rumbai-app/icons/icon-512.png","/Www/rumbai-app/icons/apple-touch-icon.png"]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)));
  // Do not skip waiting: the page asks the user before switching versions.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('rumbai-shell-') && key !== SHELL_CACHE) await caches.delete(key);
      }
      const runtime = await caches.open(RUNTIME_CACHE);
      for (const req of await runtime.keys()) {
        if (!ALL_ASSETS.has(new URL(req.url).pathname)) await runtime.delete(req);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirstNavigation(request) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch {
    const shell = await caches.match(`${BASE}index.html`);
    return shell ?? (await caches.match(`${BASE}offline.html`)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const hit = await caches.match(request);
  const network = fetch(request)
    .then(async (res) => {
      if (res.ok) (await caches.open(RUNTIME_CACHE)).put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return hit ?? (await network) ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Model weights and other cross-origin downloads are managed by WebLLM's own cache.
  if (url.origin !== self.location.origin) return;
  // API calls are never cached.
  if (url.pathname.startsWith(`${BASE}api/`)) return;
  // Leave other sites on the same origin (e.g. a neighbouring app on GitHub Pages) alone.
  if (!url.pathname.startsWith(BASE)) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
  } else if (url.pathname.startsWith(`${BASE}assets/`)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
