// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// GENERATED — do not edit. Emitted by pwa-plugin.ts for the Contacts PWA.
// A minimal "prompt to update" precaching worker: it installs the build's
// assets, parks in `waiting` (never auto-skipWaiting — a silent swap would
// discard an in-progress edit), and applies on a SKIP_WAITING message from the
// framework's update toast. Build: 73277ea
const CACHE = "contacts-branch-claude-release-workflow-paths-7xbpc5-precache";
const BASE = "/branch/claude-release-workflow-paths-7xbpc5/";
const INDEX = "/branch/claude-release-workflow-paths-7xbpc5/index.html";
// Sibling release channels nested under BASE that this worker must NOT claim —
// their pages are a different deploy and own their own worker. See ignorePaths.
const IGNORE = [];
const PRECACHE = ["/branch/claude-release-workflow-paths-7xbpc5/assets/index-Cg0pKpVc.js","/branch/claude-release-workflow-paths-7xbpc5/assets/sv-7cKpb_Mv.js","/branch/claude-release-workflow-paths-7xbpc5/assets/workbox-window.prod.es5-Bd17z0YL.js","/branch/claude-release-workflow-paths-7xbpc5/assets/index-DopYZhGq.css","/branch/claude-release-workflow-paths-7xbpc5/assets/inter-latin-400-normal-C38fXH4l.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/inter-latin-400-normal-CyCys3Eg.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/inter-latin-700-normal-BLAVimhd.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/inter-latin-700-normal-Yt3aPRUw.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/inter-latin-ext-400-normal-77YHD8bZ.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/inter-latin-ext-400-normal-C1nco2VV.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/inter-latin-ext-700-normal-Ca8adRJv.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/inter-latin-ext-700-normal-TidjK2hL.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/jetbrains-mono-latin-400-normal-6-qcROiO.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/jetbrains-mono-latin-400-normal-V6pRDFza.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/jetbrains-mono-latin-700-normal-BYuf6tUa.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/jetbrains-mono-latin-700-normal-D3wTyLJW.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/jetbrains-mono-latin-ext-400-normal-Bc8Ftmh3.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/jetbrains-mono-latin-ext-400-normal-fXTG6kC5.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/jetbrains-mono-latin-ext-700-normal-CZipNAKV.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/jetbrains-mono-latin-ext-700-normal-CxPITLHs.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/latin-400-B8QMRAvy.css","/branch/claude-release-workflow-paths-7xbpc5/assets/latin-400-BkD89atH.css","/branch/claude-release-workflow-paths-7xbpc5/assets/latin-400-D2W0X9Ct.css","/branch/claude-release-workflow-paths-7xbpc5/assets/latin-700-BHT7jyZl.css","/branch/claude-release-workflow-paths-7xbpc5/assets/latin-700-BY4rHYwA.css","/branch/claude-release-workflow-paths-7xbpc5/assets/latin-700-Ca8VUTSh.css","/branch/claude-release-workflow-paths-7xbpc5/assets/latin-ext-400-BJktp2WJ.css","/branch/claude-release-workflow-paths-7xbpc5/assets/latin-ext-400-BO7y62B2.css","/branch/claude-release-workflow-paths-7xbpc5/assets/latin-ext-700-DgsNJQyo.css","/branch/claude-release-workflow-paths-7xbpc5/assets/latin-ext-700-ZSjVNH19.css","/branch/claude-release-workflow-paths-7xbpc5/assets/opendyslexic-latin-400-normal-Cv3YY6GF.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/opendyslexic-latin-400-normal-nUhe5EwG.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/opendyslexic-latin-700-normal-Bnmt45Ln.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/opendyslexic-latin-700-normal-wYUJcbXi.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/source-serif-4-latin-400-normal-DJ5YJwmz.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/source-serif-4-latin-400-normal-Dn3IlU-Z.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/source-serif-4-latin-700-normal-3V4Pv1hj.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/source-serif-4-latin-700-normal-CGGdTIBe.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/source-serif-4-latin-ext-400-normal-CEpydyUl.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/source-serif-4-latin-ext-400-normal-Cp7z-ARB.woff2","/branch/claude-release-workflow-paths-7xbpc5/assets/source-serif-4-latin-ext-700-normal-BZsvHpal.woff","/branch/claude-release-workflow-paths-7xbpc5/assets/source-serif-4-latin-ext-700-normal-C8ywwcuQ.woff2","/branch/claude-release-workflow-paths-7xbpc5/index.html","/branch/claude-release-workflow-paths-7xbpc5/CNAME","/branch/claude-release-workflow-paths-7xbpc5/icons/apple-touch-icon-180.png","/branch/claude-release-workflow-paths-7xbpc5/icons/icon.svg","/branch/claude-release-workflow-paths-7xbpc5/icons/pwa-192.png","/branch/claude-release-workflow-paths-7xbpc5/icons/pwa-512-maskable.png","/branch/claude-release-workflow-paths-7xbpc5/icons/pwa-512.png","/branch/claude-release-workflow-paths-7xbpc5/manifest.webmanifest"];
const PRECACHE_PATHS = new Set(
  PRECACHE.map((u) => new URL(u, self.location.href).pathname),
);

self.addEventListener("install", (event) => {
  // Populate the precache one entry at a time so the window-side progress
  // poller (usePwaUpdate) watches the fill advance as bytes land. No
  // skipWaiting: park in `waiting` until the user accepts the prompt.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const url of PRECACHE) {
        try {
          await cache.add(new Request(url, { cache: "reload" }));
        } catch {
          // A single asset failing to cache must not abort the whole install.
        }
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Drop precache entries from older builds that are no longer wanted.
      for (const req of await cache.keys()) {
        if (!PRECACHE_PATHS.has(new URL(req.url).pathname)) {
          await cache.delete(req);
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// The offline navigateFallback: serve the cached app shell for any in-scope
// navigation so the installed PWA opens offline, falling back to the network
// and then the shell again.
async function navigateFallback(req) {
  const cache = await caches.open(CACHE);
  return (await cache.match(INDEX)) || fetch(req).catch(() => cache.match(INDEX));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App-shell navigations: only our own routes get the shell fallback. A
  // navigation into a sibling channel (preview/branch) is disowned so its own
  // worker — not this one — serves it.
  if (req.mode === "navigate") {
    if (!url.pathname.startsWith(BASE)) return;
    if (IGNORE.some((p) => url.pathname.startsWith(p))) return;
    event.respondWith(navigateFallback(req));
    return;
  }

  // Precached assets: cache-first (they are content-hashed, so safe to pin).
  if (PRECACHE_PATHS.has(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(req)) || fetch(req);
      })(),
    );
  }
});
