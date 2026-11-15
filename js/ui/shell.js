// App 外殼（大廳與戰鬥頁共用）：版本號、安裝到主畫面、全螢幕、強制橫向。
// - 直向時蓋一層「請把手機橫過來」，不能關（手機、平板才會；電腦的視窗不管）
// - 觸控裝置第一次點畫面時進入全螢幕並鎖定橫向（Android Chrome 有效；iPhone 不支援，要加入主畫面）
// - 攔下瀏覽器的安裝提示，大廳的設定頁有「安裝到主畫面」按鈕
(function () {
    const VERSION = '1.0.0';
    const touch = matchMedia('(pointer: coarse)').matches;
    const standalone = matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // 離線快取（安裝需要）
    if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});

    // 直向遮罩
    const css = document.createElement('style');
    css.textContent = `#rotate-lock{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#050403;color:#f3e7c9;font-family:inherit;text-align:center}
#rotate-lock b{font-size:20px;letter-spacing:2px}#rotate-lock small{font-size:13px;color:#a8977a}
#rotate-lock .rl-phone{width:46px;height:78px;border:4px solid #e8c873;border-radius:10px;margin-bottom:14px;animation:rlTurn 2.2s ease-in-out infinite}
@keyframes rlTurn{0%,20%{transform:rotate(0)}50%,80%{transform:rotate(-90deg)}100%{transform:rotate(0)}}
@media (orientation: portrait) and (pointer: coarse){#rotate-lock{display:flex}}`;
    document.head.appendChild(css);
    const lock = document.createElement('div');
    lock.id = 'rotate-lock';
    lock.innerHTML = `<div class="rl-phone"></div><b>請把手機橫過來</b><small>這個遊戲只能橫向遊玩</small>${isIOS && !standalone ? '<small>想要全螢幕：分享 → 加入主畫面，從主畫面開啟</small>' : ''}`;
    const addLock = () => document.body.appendChild(lock);
    if (document.body) addLock(); else addEventListener('DOMContentLoaded', addLock);

    // 全螢幕＋鎖橫向（要使用者點過畫面才允許）
    async function fullscreen() {
        const el = document.documentElement;
        try { if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({navigationUI: 'hide'}); } catch (e) { /* 不支援 */ }
        try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) { /* 不支援或不在全螢幕 */ }
    }
    if (touch && !isIOS) {
        const once = () => { removeEventListener('pointerup', once, true); fullscreen(); };
        addEventListener('pointerup', once, true);
    }

    // 安裝到主畫面
    let deferred = null;
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; dispatchEvent(new Event('shell-install')); });
    addEventListener('appinstalled', () => { deferred = null; dispatchEvent(new Event('shell-install')); });
    async function install() {
        if (!deferred) return false;
        deferred.prompt();
        const r = await deferred.userChoice.catch(() => ({outcome: 'dismissed'}));
        deferred = null;
        dispatchEvent(new Event('shell-install'));
        return r.outcome === 'accepted';
    }

    window.AppShell = {VERSION, touch, standalone, isIOS, fullscreen, install, canInstall: () => !!deferred};
})();
