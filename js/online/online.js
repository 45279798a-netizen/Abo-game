// 多人功能：Google 登入、雲端存檔、排行榜、全服巫妖王、信箱、管理員後台。
// 大廳一定要登入才能玩：這個檔案先擋住畫面（登入門檻），登入、處理完存檔後才載入 js/lobby/main.js。
// 如果這個網址不能登入（例如試玩頁的網域沒有授權、沒有網路），門檻會多一個「離線遊玩」按鈕，存檔只留在這台裝置。
//
// Firestore 資料（安全規則在 firestore.rules）：
//   s1_saves/{uid}            雲端存檔 {data: 存檔 JSON 字串, savedAt, name}
//   s1_players/{uid}          排行榜資料 {name, power, progress, tw_s<季>, ld_<週>, updatedAt}
//   s1_boss/{週}              全服巫妖王 {max, hp, dead, killer, killedAt}；s1_boss/{週}/hits/{uid} 每個人的傷害
//   s1_mail/{id}              全服信件 {kind: admin|worldboss, title, body, reward, createdAt, ranks?, bonus?}
//   s1_config/current         管理員設定 {dropMult 掉落倍率, bossActive 全服首領開關, bossMax 全服首領血量}
//   s1_admins/{uid}           管理員名單（在 Firebase 主控台手動新增，有這筆文件就是管理員）
(function () {
    const R = window.RES;
    const SAVE_KEY = 'abo_s1_save', CFG_KEY = 'abo_s1_cfg';
    const SYNC_MS = 60000;   // 雲端存檔最多每 60 秒寫一次
    // 全服巫妖王：沒設定時的血量；打倒後參加的人都有基本獎勵，傷害前 3 名再加
    const WB = {
        defaultMax: 5000000,
        base: {gem: 300, ltdTicket: 1, badge: 200},
        bonus: [{gem: 300, ltdTicket: 2}, {gem: 200, ltdTicket: 1}, {gem: 100, ltdTicket: 1}],
    };
    const $ = s => document.querySelector(s);
    const keySafe = s => String(s).replace(/[^A-Za-z0-9]/g, '_');
    const weekKey = () => window.Quests.weekKey();

    let auth = null, db = null, user = null, admin = false, offline = false, started = false;
    let lastSync = 0, syncTimer = null, syncing = false, syncState = '';
    let cfg = readCfg();

    function readCfg() { try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; } }
    function writeCfg(c) { cfg = c; try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) { /* 無法儲存 */ } }
    const readLocal = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } };
    const hasProgress = s => !!s && ((s.pulls || 0) > 0 || Object.keys(s.campaign?.stars || {}).length > 0);
    const fmtTime = t => t ? new Date(t).toLocaleString('zh-TW', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—';

    // ───────── 登入門檻 ─────────
    function gate(html) {
        const el = $('#login-gate');
        el.innerHTML = `<div class="lg-box"><div class="lg-brand">PROJECT RESONANCE</div><div class="lg-title"><b>S1</b> 亡靈的甦醒</div>${html}</div>`;
        el.classList.add('show');
        return el;
    }
    const ERR = {
        'auth/unauthorized-domain': '這個網址沒有開放登入（Firebase 主控台的「已授權網域」要加上這個網域）',
        'auth/popup-closed-by-user': '登入視窗被關掉了，再試一次',
        'auth/cancelled-popup-request': '登入視窗被關掉了，再試一次',
        'auth/network-request-failed': '連不上網路，確認連線後再試一次',
        'auth/operation-not-allowed': 'Firebase 還沒開啟 Google 登入（Authentication → 登入方式）',
    };
    // 只是關掉視窗或網路不穩：請玩家再試；其他錯誤（網域沒授權、試玩頁、沒開 Google 登入…）代表這個網址登入不了，多給一個離線遊玩的選項
    const RETRY_ONLY = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/network-request-failed'];
    function showLogin(err) {
        const code = err?.code || '';
        const msg = err ? (ERR[code] || `登入失敗：${err.message || code}`) : '';
        const el = gate(`<p class="lg-p">用 Google 帳號登入，進度會存在雲端，換手機也能接著玩。</p>
            <button class="lg-google" id="lg-go"><span class="g">G</span>用 Google 登入</button>
            ${msg ? `<p class="lg-err">${msg}</p>` : ''}
            ${installHint()}
            ${err && !RETRY_ONLY.includes(code) ? '<button class="lg-off" id="lg-off">離線遊玩（進度只存在這台裝置，不會同步）</button>' : ''}`);
        el.querySelector('#lg-go').onclick = signIn;
        const ins = el.querySelector('#lg-install');
        if (ins) ins.onclick = async () => { await window.AppShell.install(); showLogin(err); };
        const off = el.querySelector('#lg-off');
        if (off) off.onclick = () => { offline = true; hideGate(); startLobby(); };
    }
    // 還沒安裝時提示安裝到主畫面（全螢幕、固定橫向）
    function installHint() {
        const A = window.AppShell;
        if (!A || A.standalone) return '';
        if (A.canInstall()) return '<button class="lg-off" id="lg-install">把遊戲安裝到主畫面（全螢幕、固定橫向）</button>';
        if (A.isIOS) return '<p class="lg-p" style="font-size:11.5px;color:var(--muted);margin:12px 0 0">iPhone：Safari 下方「分享」→「加入主畫面」，從主畫面開啟就是全螢幕</p>';
        return '';
    }
    addEventListener('shell-install', () => { if (!user && !offline && document.querySelector('#lg-go')) showLogin(); });
    function hideGate() { $('#login-gate').classList.remove('show'); }
    function startLobby() {
        if (started) return;
        started = true;
        const s = document.createElement('script');
        s.src = 'js/lobby/main.js';
        document.body.appendChild(s);
    }

    async function signIn() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({prompt: 'select_account'});
        gate('<p class="lg-p">登入中…</p>');
        try {
            await auth.signInWithPopup(provider);
        } catch (e) {
            // 跳出視窗被擋（手機瀏覽器常見）：改成整頁跳轉登入
            if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) {
                try { await auth.signInWithRedirect(provider); return; } catch (e2) { showLogin(e2); return; }
            }
            showLogin(e);
        }
    }
    async function signOut() {
        await syncNow(true).catch(() => {});
        await auth.signOut();
        location.reload();
    }

    // ───────── 登入後：決定用哪一份存檔 ─────────
    function askWhich(local, cloud) {
        const info = (s, t) => `第 ${Math.min(10, Math.floor(window.Campaign.progress(s) / 15) + 1)} 章・通關 ${window.Campaign.progress(s)} 關・英雄 ${Object.keys(s.heroes || {}).length} 位<br><small>最後存檔 ${fmtTime(t)}</small>`;
        const cs = JSON.parse(cloud.data);
        return new Promise(res => {
            const el = gate(`<p class="lg-p">這台裝置有還沒登入時的進度，雲端也有一份。要用哪一份？另一份會被覆蓋。</p>
                <div class="lg-pick"><button data-u="cloud"><b>雲端進度</b>${info(cs, cloud.savedAt)}</button><button data-u="local"><b>這台裝置的進度</b>${info(local, local.savedAt)}</button></div>`);
            el.querySelectorAll('[data-u]').forEach(b => { b.onclick = () => res(b.dataset.u); });
        });
    }
    async function afterLogin() {
        gate('<p class="lg-p">讀取雲端存檔…</p>');
        const ref = db.collection('s1_saves').doc(user.uid);
        const snap = await ref.get();
        const cloud = snap.exists ? snap.data() : null;
        const local = readLocal();
        let use;
        if (!cloud) use = local && (!local.owner || local.owner === user.uid) ? 'local' : 'fresh';
        else if (local && local.owner === user.uid) use = (local.savedAt || 0) > (cloud.savedAt || 0) ? 'local' : 'cloud';
        else if (local && !local.owner && hasProgress(local)) use = await askWhich(local, cloud);
        else use = 'cloud';
        if (use === 'cloud') localStorage.setItem(SAVE_KEY, cloud.data);
        if (use === 'fresh') localStorage.removeItem(SAVE_KEY);
        const S = window.Save.load();
        S.owner = user.uid;
        if ((!S.name || S.name === '旅團長') && user.displayName) S.name = user.displayName.slice(0, 10);
        window.Save.save(S);
        try { admin = (await db.collection('s1_admins').doc(user.uid).get()).exists; } catch (e) { admin = false; }
        await loadCfg();
        if (use !== 'cloud' || (S.savedAt || 0) > (cloud?.savedAt || 0)) await syncNow(true);
        else lastSync = Date.now();
        hideGate();
        startLobby();
        pushStats().catch(e => console.warn('排行榜更新失敗', e));   // 全服首領的傷害由大廳送（main.js 啟動時呼叫 flushHits）
    }

    // ───────── 雲端存檔 ─────────
    // Save.save 每次存檔都會通知這裡；最多每 60 秒真的寫一次，離開頁面時立刻寫
    function onSave() {
        if (!user) return;
        clearTimeout(syncTimer);
        const wait = Math.max(0, SYNC_MS - (Date.now() - lastSync));
        syncTimer = setTimeout(() => syncNow().catch(() => {}), wait);
    }
    async function syncNow(force) {
        if (!user || (syncing && !force)) return;
        syncing = true;
        clearTimeout(syncTimer);
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return;
            const S = JSON.parse(raw);
            await db.collection('s1_saves').doc(user.uid).set({data: raw, savedAt: S.savedAt || Date.now(), name: S.name || ''});
            lastSync = Date.now();
            syncState = '';
        } catch (e) {
            syncState = '雲端存檔失敗，稍後會再試';
            console.warn('雲端存檔失敗', e);
            syncTimer = setTimeout(() => syncNow().catch(() => {}), SYNC_MS);
        } finally { syncing = false; }
    }

    // ───────── 管理員設定（掉落倍率、全服首領） ─────────
    async function loadCfg() {
        try {
            const s = await db.collection('s1_config').doc('current').get();
            writeCfg(s.exists ? s.data() : {});
        } catch (e) { /* 沒讀到就用上次的 */ }
        return cfg;
    }
    async function setCfg(patch) {
        await db.collection('s1_config').doc('current').set(patch, {merge: true});
        writeCfg({...cfg, ...patch});
    }

    // ───────── 排行榜 ─────────
    function stats(S) {
        const Gr = window.Growth, G = window.Gear, Se = window.Season;
        const power = (S.team || []).filter(Boolean).reduce((a, id) => a + Gr.power(id, S.heroes[id], G.bonus(S, id)), 0);
        const st = Se.state(S);
        return {
            name: S.name || '旅團長', power, progress: window.Campaign.progress(S),
            ['tw_s' + st.n]: st.tower.top || st.tower.best || 0,
            ['ld_' + keySafe(st.lich.week)]: st.lich.bestDmg || 0,
            updatedAt: Date.now(),
        };
    }
    async function pushStats() {
        if (!user) return;
        await db.collection('s1_players').doc(user.uid).set(stats(window.Save.load()), {merge: true});
    }
    const BOARDS = {
        progress: {name: '主線進度', field: () => 'progress', fmt: v => `${Math.min(10, Math.floor(v / 15) + (v % 15 ? 1 : 0)) || 1}-${v % 15 || 15}`},
        power: {name: '隊伍戰力', field: () => 'power', fmt: v => v.toLocaleString()},
        tower: {name: '亡靈之塔', field: () => 'tw_s' + window.Season.state(window.Save.load()).n, fmt: v => `第 ${v} 層`},
        lich: {name: '巫妖王（本週）', field: () => 'ld_' + keySafe(weekKey()), fmt: v => v.toLocaleString()},
    };
    async function board(kind) {
        const f = BOARDS[kind].field();
        const q = await db.collection('s1_players').orderBy(f, 'desc').limit(100).get();
        return q.docs.map(d => ({uid: d.id, name: d.data().name, v: d.data()[f] || 0})).filter(r => r.v > 0);
    }

    // ───────── 全服巫妖王 ─────────
    // 巫妖王試煉（在戰鬥頁結算）把傷害記在存檔 S.online.hits，回到大廳再一次送上去
    const bossRef = wk => db.collection('s1_boss').doc(keySafe(wk));
    const bossOn = () => cfg.bossActive !== false;
    const bossMax = () => cfg.bossMax || WB.defaultMax;
    async function boss() {
        const wk = weekKey(), ref = bossRef(wk);
        const [s, top, mine] = await Promise.all([ref.get(), ref.collection('hits').orderBy('dmg', 'desc').limit(10).get(), ref.collection('hits').doc(user.uid).get()]);
        const d = s.exists ? s.data() : {max: bossMax(), hp: bossMax(), dead: false};
        return {...d, week: wk, active: bossOn(), top: top.docs.map(x => x.data()), mine: mine.exists ? mine.data().dmg : 0};
    }
    async function hitBoss(wk, dmg, name) {
        const ref = bossRef(wk), hr = ref.collection('hits').doc(user.uid);
        let killed = false;
        await db.runTransaction(async t => {
            const s = await t.get(ref);
            const d = s.exists ? s.data() : {max: bossMax(), hp: bossMax(), dead: false};
            if (d.dead || dmg <= 0) return;
            const real = Math.min(dmg, d.hp), hp = d.hp - real;
            killed = hp <= 0;
            t.set(ref, {...d, hp, dead: killed, ...(killed ? {killer: name, killedAt: Date.now()} : {})});
            t.set(hr, {uid: user.uid, name, dmg: firebase.firestore.FieldValue.increment(real)}, {merge: true});
        });
        if (killed) await bossMail(wk, name);
        return killed;
    }
    // 打倒後寄全服信：依傷害排名（打倒的那個人負責寄，同一週只會有一封）
    async function bossMail(wk, killer) {
        const hits = await bossRef(wk).collection('hits').orderBy('dmg', 'desc').limit(100).get();
        const ranks = {};
        hits.docs.forEach((d, i) => { ranks[d.id] = i + 1; });
        const top = hits.docs.slice(0, 3).map(d => d.data().name).join('、');
        const ref = db.collection('s1_mail').doc('wb_' + keySafe(wk));
        await db.runTransaction(async t => {
            if ((await t.get(ref)).exists) return;
            t.set(ref, {kind: 'worldboss', title: '全服巫妖王被擊倒了！', body: `${wk} 那一週的全服巫妖王，最後一擊是 ${killer}。傷害前 3 名：${top}。參加的人都有獎勵，前 3 名另外加碼。`,
                reward: WB.base, bonus: WB.bonus, ranks, createdAt: Date.now()});
        });
    }
    let flushing = null;
    function flushHits() { if (!flushing) flushing = doFlush().finally(() => { flushing = null; }); return flushing; }
    async function doFlush() {
        if (!user) return;
        const S = window.Save.load();
        const list = S.online?.hits || [];
        if (!list.length) return false;
        let killed = false;
        if (bossOn()) for (const h of list) killed = (await hitBoss(h.week, h.dmg, S.name)) || killed;
        const S2 = window.Save.load();
        S2.online.hits = (S2.online.hits || []).slice(list.length);   // 送出這段時間又多的保留
        window.Save.save(S2);
        pushStats().catch(() => {});
        return killed;
    }

    // ───────── 信箱 ─────────
    const MAIL_DAYS = 30;
    async function mails() {
        const q = await db.collection('s1_mail').orderBy('createdAt', 'desc').limit(40).get();
        const since = Date.now() - MAIL_DAYS * 86400000;
        return q.docs.map(d => ({id: d.id, ...d.data()})).filter(m => m.createdAt >= since && (m.kind !== 'worldboss' || m.ranks?.[user.uid]));
    }
    // 這封信給我的獎勵（全服首領依排名加碼）
    function mailReward(m) {
        const out = {...(m.reward || {})};
        if (m.kind === 'worldboss') {
            const b = m.bonus?.[(m.ranks?.[user.uid] || 0) - 1];
            if (b) for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + v;
        }
        return out;
    }
    function claimMail(S, m) {
        S.mail = S.mail || {};
        if (S.mail[m.id]) return {ok: false, reason: '已經領過了'};
        const r = mailReward(m);
        for (const [k, v] of Object.entries(r)) if (v > 0) S.currency[k] = (S.currency[k] || 0) + v;
        S.mail[m.id] = Date.now();
        return {ok: true, reward: r};
    }
    async function unreadMail(S) {
        try { return (await mails()).filter(m => !(S.mail || {})[m.id]).length; } catch (e) { return 0; }
    }

    // ───────── 管理員 ─────────
    async function sendMail({title, body, reward}) {
        if (!admin) throw new Error('不是管理員');
        await db.collection('s1_mail').add({kind: 'admin', title, body, reward, createdAt: Date.now()});
    }
    async function deleteMail(id) { await db.collection('s1_mail').doc(id).delete(); }
    // 重置本週全服首領：血量回滿、清掉傷害紀錄（已經寄出的獎勵信不受影響）
    async function resetBoss(max) {
        const ref = bossRef(weekKey());
        const hits = await ref.collection('hits').get();
        for (const d of hits.docs) await d.ref.delete();
        await ref.set({max, hp: max, dead: false});
    }

    // ───────── 啟動 ─────────
    function boot() {
        if (!window.firebase || !window.FIREBASE_CONFIG) { showLogin({code: 'no-sdk', message: '沒有載入 Firebase'}); return; }
        try {
            firebase.initializeApp(window.FIREBASE_CONFIG);
            auth = firebase.auth();
            db = firebase.firestore();
        } catch (e) { showLogin({code: 'no-sdk', message: e.message}); return; }
        gate('<p class="lg-p">連線中…</p>');
        let first = true;
        auth.getRedirectResult().catch(e => showLogin(e));
        auth.onAuthStateChanged(u => {
            if (!u) { if (first) showLogin(); first = false; return; }
            first = false;
            if (user && user.uid === u.uid) return;
            user = u;
            afterLogin().catch(e => { console.error(e); user = null; showLogin({code: e.code, message: '讀取雲端存檔失敗：' + (e.message || e.code)}); });
        });
        addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncNow(true).catch(() => {}); });
        addEventListener('pagehide', () => { syncNow(true).catch(() => {}); });
    }

    window.Online = {
        boot, signIn, signOut, onSave, syncNow, pushStats, flushHits,
        board, BOARDS, boss, mails, mailReward, claimMail, unreadMail,
        sendMail, deleteMail, resetBoss, setCfg, loadCfg, WB,
        get user() { return user; }, get offline() { return offline; }, get admin() { return admin; }, get cfg() { return cfg; },
        get syncState() { return syncState; }, get lastSync() { return lastSync; },
        bossOn, bossMax,
    };
    boot();
})();
