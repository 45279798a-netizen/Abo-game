// 任務與通行證規則。資料在 js/data/quests.js。
// 存檔 S.quests = {day, daily:{id:進度}, dClaim:{id:true}, dBonus, week, weekly:{}, wClaim:{}, medals, pClaim:{lv:true}, chests, start, boosted}
// 遊戲各處呼叫 Quests.track(S, 事件, 次數)；勳章要在任務頁按「領取」才會加進通行證。
(function () {
    const R = window.RES;
    const Q = R.QUESTS, P = Q.pass;

    // 以凌晨 4 點為一天的開始
    const shift = t => new Date(t - Q.RESET_HOUR * 3600000);
    const dayKey = (t = Date.now()) => { const d = shift(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
    function weekKey(t = Date.now()) {
        const d = shift(t);
        const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
        return `${mon.getFullYear()}-${mon.getMonth() + 1}-${mon.getDate()}`;
    }

    function state(S, now = Date.now()) {
        const q = S.quests = S.quests || {};
        q.start = q.start || now;
        q.medals = q.medals || 0;
        q.pClaim = q.pClaim || {};
        q.chests = q.chests || 0;
        const dk = dayKey(now), wk = weekKey(now);
        if (q.day !== dk) { q.day = dk; q.daily = {}; q.dClaim = {}; q.dBonus = false; }
        if (q.week !== wk) { q.week = wk; q.weekly = {}; q.wClaim = {}; }
        return q;
    }

    // 記錄進度（事件可能同時推進每日與每週任務）
    function track(S, ev, n = 1) {
        const q = state(S);
        for (const t of Q.daily) if (t.ev === ev) q.daily[t.id] = Math.min(t.n, (q.daily[t.id] || 0) + n);
        for (const t of Q.weekly) if (t.ev === ev) q.weekly[t.id] = Math.min(t.n, (q.weekly[t.id] || 0) + n);
    }

    // 追趕：已經過的天數 × 每天 280，勳章總數比這個少超過一天的量就加倍
    function expectedMedals(S, now = Date.now()) {
        const q = state(S, now);
        const days = Math.floor((now - q.start) / 86400000) + 1;
        return days * P.pacePerDay;
    }
    const boosted = (S, now = Date.now()) => state(S, now).medals < expectedMedals(S, now) - P.pacePerDay && level(S) < P.levels;
    function addMedals(S, m) {
        const q = state(S);
        const k = boosted(S) ? 2 : 1;
        q.medals += m * k;
        return m * k;
    }

    const level = S => Math.min(P.levels, Math.floor((S.quests?.medals || 0) / P.perLevel));
    // 50 級之後：可開的寶箱數
    const chestsReady = S => Math.max(0, Math.floor(((S.quests?.medals || 0) - P.levels * P.perLevel) / P.chestPer) - (S.quests?.chests || 0));

    function give(S, r, rand = Math.random) {
        const out = {};
        for (const [k, v] of Object.entries(r)) {
            if (k === 'gear') { out.gear = window.Gear.make(S, rand, {q: v.q, slot: undefined, set: Object.keys(R.GEAR.SETS)[Math.floor(rand() * 6)]}); continue; }
            if (k === 'hero') {
                if (S.heroes[v]) { window.Growth.giveShards(S, v, 80); out.shards = {id: v, n: 80}; }
                else { window.Save.addHero(S, v); out.hero = v; }
                continue;
            }
            S.currency[k] = (S.currency[k] || 0) + v;
            out[k] = v;
        }
        return out;
    }

    function claimDaily(S, id) {
        const q = state(S), t = Q.daily.find(x => x.id === id);
        if (!t || q.dClaim[id] || (q.daily[id] || 0) < t.n) return {ok: false};
        q.dClaim[id] = true;
        return {ok: true, medal: addMedals(S, t.medal)};
    }
    const dailyAllDone = S => Q.daily.every(t => state(S).dClaim[t.id]);
    function claimDailyBonus(S) {
        const q = state(S);
        if (q.dBonus || !dailyAllDone(S)) return {ok: false};
        q.dBonus = true;
        S.currency.gem = (S.currency.gem || 0) + Q.dailyBonus.gem;
        track(S, 'dailyDone');
        return {ok: true, medal: addMedals(S, Q.dailyBonus.medal), gem: Q.dailyBonus.gem};
    }
    function claimWeekly(S, id) {
        const q = state(S), t = Q.weekly.find(x => x.id === id);
        if (!t || q.wClaim[id] || (q.weekly[id] || 0) < t.n) return {ok: false};
        q.wClaim[id] = true;
        const medal = addMedals(S, t.medal);
        return {ok: true, medal, reward: give(S, t.reward)};
    }
    function claimPass(S, lv) {
        const q = state(S);
        if (lv > level(S) || q.pClaim[lv]) return {ok: false};
        q.pClaim[lv] = true;
        return {ok: true, reward: give(S, P.rewards[lv - 1])};
    }
    function claimAllPass(S) {
        const out = [];
        for (let lv = 1; lv <= level(S); lv++) { const r = claimPass(S, lv); if (r.ok) out.push({lv, ...r}); }
        return out;
    }
    function openChest(S) {
        if (chestsReady(S) <= 0) return {ok: false};
        state(S).chests++;
        return {ok: true, reward: give(S, P.chest)};
    }

    // 有東西可以領（紅點）
    function hasClaimable(S) {
        const q = state(S);
        if (Q.daily.some(t => !q.dClaim[t.id] && (q.daily[t.id] || 0) >= t.n)) return true;
        if (dailyAllDone(S) && !q.dBonus) return true;
        if (Q.weekly.some(t => !q.wClaim[t.id] && (q.weekly[t.id] || 0) >= t.n)) return true;
        for (let lv = 1; lv <= level(S); lv++) if (!q.pClaim[lv]) return true;
        return chestsReady(S) > 0;
    }

    window.Quests = {state, track, claimDaily, claimDailyBonus, claimWeekly, claimPass, claimAllPass, openChest, dailyAllDone,
        level, chestsReady, hasClaimable, boosted, expectedMedals, dayKey, weekKey};
})();
