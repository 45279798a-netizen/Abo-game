// 裝備規則：產生、強化、分解、穿脫、一鍵穿最好、整套搬到另一位英雄、算加成。
// 資料在 js/data/gear.js。存檔：S.gear（所有裝備）、S.gearSeq（流水號）、S.currency.stone（強化石）。
(function () {
    const R = window.RES;
    const G = R.GEAR;

    const pick = (rand, list) => list[Math.floor(rand() * list.length)];
    const round = (k, v) => G.STATS[k].pct ? Math.round(v * 1000) / 1000 : Math.round(v);

    function rollSub(rand, k) {
        const [a, b] = G.STATS[k].sub;
        return round(k, a + (b - a) * rand());
    }
    function newSub(rand, it) {
        const used = new Set([it.main.k, ...it.subs.map(s => s.k)]);
        const left = Object.keys(G.STATS).filter(k => !used.has(k));
        const k = pick(rand, left);
        it.subs.push({k, v: rollSub(rand, k), n: 1});
    }

    // 產生一件裝備：slot、q（0～4）、set（可為 null）沒給就隨機
    function make(S, rand, o = {}) {
        const slot = o.slot || pick(rand, G.SLOT_ORDER);
        const q = o.q ?? 0;
        const mk = G.SLOTS[slot].main || pick(rand, G.accMain);
        S.gearSeq = (S.gearSeq || 0) + 1;
        const it = {id: 'g' + S.gearSeq, slot, q, set: o.set || null, lvl: 0, main: {k: mk}, subs: [], hero: null, lock: false};
        for (let i = 0; i < G.QUALITY[q].subs; i++) newSub(rand, it);
        S.gear = S.gear || [];
        S.gear.push(it);
        return it;
    }

    const mainValue = it => round(it.main.k, G.STATS[it.main.k].main[it.q] * (1 + G.MAIN_PER_LV * it.lvl));
    function statsOf(it) {
        const o = {[it.main.k]: mainValue(it)};
        for (const s of it.subs) o[s.k] = round(s.k, (o[s.k] || 0) + s.v);
        return o;
    }
    const fmtStat = (k, v) => G.STATS[k].pct ? `${(v * 100).toFixed(v * 100 % 1 ? 1 : 0)}%` : `${v}`;

    // ───────── 強化與分解 ─────────
    function enhanceCost(it) {
        const m = G.QUALITY[it.q].cost, l = it.lvl;
        return {stone: Math.ceil((2 + l * 1.2) * m), gold: Math.round((300 + l * 250) * m / 10) * 10};
    }
    function enhance(S, it, rand = Math.random) {
        if (it.lvl >= G.MAX_LV) return {ok: false, reason: '已經強化到最高'};
        const c = enhanceCost(it);
        if ((S.currency.stone || 0) < c.stone) return {ok: false, reason: '強化石不足'};
        if ((S.currency.gold || 0) < c.gold) return {ok: false, reason: '金幣不足'};
        S.currency.stone -= c.stone;
        S.currency.gold -= c.gold;
        it.spent = (it.spent || 0) + c.stone;
        it.lvl++;
        let note = null;
        // 每 +3：副屬性不到 4 條就多一條，滿 4 條就隨機加強一條
        if (it.lvl % 3 === 0) {
            if (it.subs.length < 4) { newSub(rand, it); note = 'new'; }
            else { const s = pick(rand, it.subs); s.v = round(s.k, s.v + rollSub(rand, s.k)); s.n++; note = s.k; }
        }
        return {ok: true, note};
    }
    const salvageValue = it => G.QUALITY[it.q].salvage + Math.floor((it.spent || 0) * 0.6);
    function salvage(S, ids) {
        let stone = 0, n = 0;
        S.gear = S.gear.filter(it => {
            if (!ids.includes(it.id) || it.lock || it.hero) return true;
            stone += salvageValue(it); n++;
            return false;
        });
        S.currency.stone = (S.currency.stone || 0) + stone;
        return {n, stone};
    }

    // ───────── 穿脫 ─────────
    const byId = (S, id) => (S.gear || []).find(it => it.id === id);
    function equipped(S, hero) {
        const o = {};
        for (const it of S.gear || []) if (it.hero === hero) o[it.slot] = it;
        return o;
    }
    function equip(S, hero, id) {
        const it = byId(S, id);
        if (!it) return false;
        const cur = equipped(S, hero)[it.slot];
        if (cur) cur.hero = null;
        it.hero = hero;   // 從別人身上拿過來也可以
        return true;
    }
    function unequip(S, id) { const it = byId(S, id); if (it) it.hero = null; }
    function unequipAll(S, hero) { for (const it of S.gear || []) if (it.hero === hero) it.hero = null; }
    // 整套搬到另一位：對方原本的裝備卸下
    function moveAll(S, from, to) {
        if (from === to) return 0;
        unequipAll(S, to);
        let n = 0;
        for (const it of S.gear || []) if (it.hero === from) { it.hero = to; n++; }
        return n;
    }

    // 自動穿裝：依職業權重算每件分數，每個欄位挑沒被別人穿的最高分；湊成 4 件套或 2+2 再加分
    function score(it, role) {
        const w = G.ROLE_WEIGHT[role] || G.ROLE_WEIGHT.warrior;
        let s = 0;
        for (const [k, v] of Object.entries(statsOf(it))) s += (G.STATS[k].pct ? v * 100 : v) * (w[k] || 0);
        return s;
    }
    function autoEquip(S, hero) {
        const role = R.HEROES[hero].role;
        const free = (S.gear || []).filter(it => !it.hero || it.hero === hero);
        const bySlot = {};
        for (const slot of G.SLOT_ORDER) bySlot[slot] = free.filter(it => it.slot === slot).sort((a, b) => score(b, role) - score(a, role)).slice(0, 6);
        // 各欄位前 6 名的組合裡找總分最高（含套裝加分），最多 6^4 種
        const setBonus = role => {
            const w = G.ROLE_WEIGHT[role] || G.ROLE_WEIGHT.warrior;
            return set => { const two = G.SETS[set].two; let s = 0; for (const [k, v] of Object.entries(two)) { const kk = k === 'spdPct' ? 'spd' : k; s += (k === 'spdPct' ? v * 100 : (G.STATS[kk]?.pct ? v * 100 : v)) * (w[kk] || 0); } return s; };
        };
        const sb = setBonus(role);
        let best = null, bestS = -1;
        const slots = G.SLOT_ORDER;
        const rec = (i, chosen, s) => {
            if (i === slots.length) {
                const cnt = {};
                for (const it of chosen) if (it?.set) cnt[it.set] = (cnt[it.set] || 0) + 1;
                let t = s;
                for (const [set, n] of Object.entries(cnt)) { if (n >= 2) t += sb(set); if (n >= 4) t += 18; }
                if (t > bestS) { bestS = t; best = chosen.slice(); }
                return;
            }
            const opts = bySlot[slots[i]].length ? bySlot[slots[i]] : [null];
            for (const it of opts) { chosen.push(it); rec(i + 1, chosen, s + (it ? score(it, role) : 0)); chosen.pop(); }
        };
        rec(0, [], 0);
        unequipAll(S, hero);
        let n = 0;
        for (const it of best || []) if (it) { it.hero = hero; n++; }
        return n;
    }

    // ───────── 加成 ─────────
    // 回傳 {atkPct, hpPct, defPct, spdPct, spd, crit, critDmg, hit, res, sets:{set:件數}, four:{4 件效果}}
    function bonusOf(items) {
        const b = {atkPct: 0, hpPct: 0, defPct: 0, spdPct: 0, spd: 0, crit: 0, critDmg: 0, hit: 0, res: 0, sets: {}, four: {}};
        for (const it of items) {
            for (const [k, v] of Object.entries(statsOf(it))) b[k] += v;
            if (it.set) b.sets[it.set] = (b.sets[it.set] || 0) + 1;
        }
        for (const [set, n] of Object.entries(b.sets)) {
            const d = G.SETS[set];
            if (n >= 2) for (const [k, v] of Object.entries(d.two)) b[k] += v;
            if (n >= 4) for (const [k, v] of Object.entries(d.four)) b.four[k] = (b.four[k] || 0) + v;
        }
        return b;
    }
    const bonus = (S, hero) => bonusOf(Object.values(equipped(S, hero)));

    // 校準用：玩家打到第 i 關時「預期」身上的裝備（第 2 章起有散件，第 3 章起有套裝）
    function expectedBonus(i) {
        if (i <= 15) return null;
        const q = Math.min(4, Math.floor(1 + (i - 15) / 35));          // 綠 → 藍 → 紫 → 橙
        const lvl = Math.min(G.MAX_LV, Math.floor((i - 15) / 8));
        const items = G.SLOT_ORDER.map(slot => {
            const it = {slot, q, lvl, set: i > 30 ? (slot === 'weapon' || slot === 'helmet' ? 'resonance' : 'vitality') : null,
                main: {k: G.SLOTS[slot].main || 'spd'}, subs: []};
            // 副屬性：條數照品質＋強化，數值取平均，一半有用（攻擊、生命各半）
            const n = Math.min(4, G.QUALITY[q].subs + Math.floor(lvl / 3));
            const extra = Math.max(0, Math.floor(lvl / 3) - (4 - G.QUALITY[q].subs));
            for (let k = 0; k < n; k++) it.subs.push({k: k % 2 ? 'hpPct' : 'atkPct', v: 0.03 * (k === 0 ? 1 + extra : 1) * 0.5, n: 1});
            return it;
        });
        return bonusOf(items);
    }

    // 掉落品質：floor 1～10 → 各品質權重
    function rollQuality(rand, floor) {
        const t = (Math.max(1, Math.min(10, floor)) - 1) / 9;
        const w = [40 * (1 - t), 45 * (1 - t) + 5, 15 + 15 * t, 0 + 50 * t * t + 5 * t, 30 * t * t * t];
        let r = rand() * w.reduce((a, b) => a + b, 0);
        for (let q = 0; q < w.length; q++) { r -= w[q]; if (r <= 0) return q; }
        return 2;
    }

    window.Gear = {make, mainValue, statsOf, fmtStat, enhanceCost, enhance, salvageValue, salvage, byId, equipped, equip, unequip, unequipAll, moveAll,
        score, autoEquip, bonusOf, bonus, expectedBonus, rollQuality};
})();
