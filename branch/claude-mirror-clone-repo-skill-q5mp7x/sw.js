// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// GENERATED — do not edit. Emitted by pwa-plugin.ts for the Contacts PWA.
// A minimal "prompt to update" precaching worker: it installs the build's
// assets, parks in `waiting` (never auto-skipWaiting — a silent swap would
// discard an in-progress edit), and applies on a SKIP_WAITING message from the
// framework's update toast. Build: b16d9d9
const CACHE = "contacts-branch-claude-mirror-clone-repo-skill-q5mp7x-precache";
const BASE = "/branch/claude-mirror-clone-repo-skill-q5mp7x/";
const INDEX = "/branch/claude-mirror-clone-repo-skill-q5mp7x/index.html";
// Sibling release channels nested under BASE that this worker must NOT claim —
// their pages are a different deploy and own their own worker. See ignorePaths.
const IGNORE = [];
const PRECACHE = ["/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/index-CZFercxn.js","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/sv-7cKpb_Mv.js","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/workbox-window.prod.es5-Bd17z0YL.js","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/index-kxnk9BMl.css","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/inter-latin-400-normal-C38fXH4l.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/inter-latin-400-normal-CyCys3Eg.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/inter-latin-700-normal-BLAVimhd.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/inter-latin-700-normal-Yt3aPRUw.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/inter-latin-ext-400-normal-77YHD8bZ.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/inter-latin-ext-400-normal-C1nco2VV.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/inter-latin-ext-700-normal-Ca8adRJv.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/inter-latin-ext-700-normal-TidjK2hL.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/jetbrains-mono-latin-400-normal-6-qcROiO.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/jetbrains-mono-latin-400-normal-V6pRDFza.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/jetbrains-mono-latin-700-normal-BYuf6tUa.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/jetbrains-mono-latin-700-normal-D3wTyLJW.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/jetbrains-mono-latin-ext-400-normal-Bc8Ftmh3.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/jetbrains-mono-latin-ext-400-normal-fXTG6kC5.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/jetbrains-mono-latin-ext-700-normal-CZipNAKV.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/jetbrains-mono-latin-ext-700-normal-CxPITLHs.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/latin-400-DLvbn1qj.css","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/latin-400-DUq417P7.css","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/latin-400-xTa6TcAz.css","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/latin-700-BcQVzDEc.css","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/latin-700-Bf9-Qe_D.css","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/latin-700-DT5sM3H_.css","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/latin-ext-400-Cj_Qm8EX.css","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/latin-ext-400-DYBGCC1q.css","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/latin-ext-700-CUwsMx3z.css","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/latin-ext-700-DwPMHUDg.css","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/opendyslexic-latin-400-normal-Cv3YY6GF.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/opendyslexic-latin-400-normal-nUhe5EwG.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/opendyslexic-latin-700-normal-Bnmt45Ln.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/opendyslexic-latin-700-normal-wYUJcbXi.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/source-serif-4-latin-400-normal-DJ5YJwmz.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/source-serif-4-latin-400-normal-Dn3IlU-Z.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/source-serif-4-latin-700-normal-3V4Pv1hj.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/source-serif-4-latin-700-normal-CGGdTIBe.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/source-serif-4-latin-ext-400-normal-CEpydyUl.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/source-serif-4-latin-ext-400-normal-Cp7z-ARB.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/source-serif-4-latin-ext-700-normal-BZsvHpal.woff","/branch/claude-mirror-clone-repo-skill-q5mp7x/assets/source-serif-4-latin-ext-700-normal-C8ywwcuQ.woff2","/branch/claude-mirror-clone-repo-skill-q5mp7x/index.html","/branch/claude-mirror-clone-repo-skill-q5mp7x/CNAME","/branch/claude-mirror-clone-repo-skill-q5mp7x/icons/apple-touch-icon-180.png","/branch/claude-mirror-clone-repo-skill-q5mp7x/icons/icon.svg","/branch/claude-mirror-clone-repo-skill-q5mp7x/icons/pwa-192.png","/branch/claude-mirror-clone-repo-skill-q5mp7x/icons/pwa-512-maskable.png","/branch/claude-mirror-clone-repo-skill-q5mp7x/icons/pwa-512.png","/branch/claude-mirror-clone-repo-skill-q5mp7x/manifest.webmanifest"];
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
