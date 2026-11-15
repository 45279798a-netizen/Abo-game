// 離線快取（讓遊戲可以安裝到主畫面，第二次開啟更快）。
// 程式與網頁：先連網路拿最新版，沒網路才用快取；圖片：先用快取，背景再更新。
// Firebase 等外部網址不經過這裡。改版不用改這個檔案；快取結構要改時再把 CACHE 的版本號加一。
const CACHE = 'resonance-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;
    const isAsset = /\.(webp|png|jpe?g|gif|mp3|ogg|wav)$/i.test(url.pathname);
    if (isAsset) {
        e.respondWith(caches.open(CACHE).then(async c => {
            const hit = await c.match(req);
            const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
            return hit || net;
        }));
    } else {
        e.respondWith(fetch(req).then(r => {
            if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
            return r;
        }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('./index.html'))));
    }
});
