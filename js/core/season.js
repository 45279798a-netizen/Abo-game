// 賽季（4 週一季）：巫妖王試煉、亡靈之塔、困難主線、賽季商店、賽季結算。
// 資料與規則都在這個檔案；難度數字在 js/data/season_table.js（tools/calibrate_season.js 產生）。
// 存檔 S.season = {n 第幾季, start 開始時間, lich:{week, best, top, claimed, day, used}, tower:{best}, shop:{week, bought}, titles:[]}
window.RES = window.RES || {};

// 關卡規則：巫妖王每週詞綴、塔的每層規則、困難主線每章規則共用。效果由戰鬥引擎讀（js/core/battle.js 的 mergeMods）
RES.MODS = {
    bloodlust: {name: '嗜血', desc: '敵人攻擊 +20%', enemyAtk: 1.2},
    wither:    {name: '枯萎', desc: '我方治療效果 -40%', healMult: 0.6},
    shatter:   {name: '碎盾', desc: '我方護盾效果 -50%', shieldMult: 0.5},
    chill:     {name: '寒潮', desc: '敵人速度 +15%', enemySpd: 1.15},
    plague:    {name: '瘟疫', desc: '我方受到的燃燒、中毒傷害加倍', dotTaken: 2},
    hush:      {name: '靜默', desc: '我方能量取得 -25%', energyMult: 0.75},
    bone:      {name: '堅骨', desc: '敵人防禦 +40%', enemyDef: 1.4},
    ward:      {name: '結界', desc: '敵人效果抵抗 +30%', enemyRes: 0.3},
    frenzy:    {name: '狂亂', desc: '敵人每過 1 回合傷害 +4%', roundDmg: 0.04},
    regen:     {name: '不死', desc: '敵人每次行動回復 3% 生命', enemyRegen: 0.03},
    fog:       {name: '迷霧', desc: '我方暴擊率 -10%', allyCrit: -0.1},
    horde:     {name: '屍潮', desc: '敵人生命 +30%', enemyHp: 1.3},
    barrier:   {name: '骨甲', desc: '敵人開場帶 20% 生命的護盾', enemyShield: 0.2},
};

RES.SEASON = {
    days: 28,
    unlock: 45,          // 巫妖王試煉、亡靈之塔：打完第 3 章開放
    lich: {
        perDay: 3,
        rounds: 15,      // 打 15 回合，看對巫妖王造成多少傷害
        affixes: ['bloodlust', 'wither', 'shatter', 'chill', 'plague', 'hush', 'bone', 'ward'],   // 每週抽 2 個
        ramp: 0.07,      // 巫妖王每過 1 回合傷害 +7%（越打越痛，隊伍撐越久分數越高）
        tiers: 10,
        // 每次挑戰依這次打到的階數給獎勵
        attempt: t => ({badge: 30 + 12 * t, gold: 2000 + 1500 * t}),
        // 每週第一次打到某一階的獎勵
        weekly: t => ({awk: t <= 5 ? 2 : 3, badge: 30}),
    },
    tower: {
        floors: 30,
        endless: 1.05,   // 30 層以後每層敵人 +5%
        pool: ['skeleton', 'frostLich', 'cryptBat', 'gargoyle', 'corpseBomber', 'cultist', 'plagueBringer', 'warlord'],
        bosses: {5: 'boneKnight', 10: 'plagueBoss', 15: 'frostLichLord', 20: 'fallenLord', 25: 'boneDragon', 30: 'lichKing'},
        rules: ['bloodlust', 'wither', 'chill', 'hush', 'bone', 'plague', 'shatter', 'fog', 'regen', 'horde', 'barrier', 'ward', 'frenzy'],
        reward: f => f % 5 === 0 ? (f <= 30 ? {badge: 150, awk: 6, gem: 100} : {badge: 60, awk: 2}) : (f <= 30 ? {badge: 40, gold: 3000 + f * 300} : {badge: 20, gold: 8000}),
    },
    hard: {
        // 每章一條規則
        rules: ['bloodlust', 'horde', 'chill', 'plague', 'fog', 'hush', 'bone', 'wither', 'barrier', 'frenzy'],
        awk: {normal: 1, elite: 3, boss: 8},   // 首通另外給的覺醒石
    },
    // 賽季商店（賽季徽章）：limit＝每週可買幾次
    shop: [
        {id: 'uther', name: '烏瑟碎片 ×10', price: 400, limit: 2, shards: {id: 'uther', n: 10}},
        {id: 'ltd', name: '限定招募券', price: 250, limit: 3, give: {ltdTicket: 1}},
        {id: 'ticket', name: '招募券', price: 120, limit: 5, give: {ticket: 1}},
        {id: 'gear', name: '傳說套裝（隨機）', price: 600, limit: 1, give: {gear: {q: 4}}},
        {id: 'awk', name: '覺醒石 ×5', price: 200, limit: 4, give: {awk: 5}},
        {id: 'book', name: '技能書 ×2', price: 100, limit: 5, give: {book: 2}},
        {id: 'brk', name: '突破石 ×10', price: 80, limit: 5, give: {brk: 10}},
        {id: 'stone', name: '強化石 ×50', price: 80, limit: 5, give: {stone: 50}},
        {id: 'gold', name: '金幣 ×50,000', price: 60, limit: 10, give: {gold: 50000}},
    ],
    // 賽季結算：依這一季巫妖王最高階與塔的最高層
    endReward: (tier, floor) => ({gem: 200 + tier * 80 + Math.min(30, floor) * 10, ltdTicket: 1 + Math.floor(tier / 3), ticket: Math.floor(Math.min(30, floor) / 10)}),
    endTitle: (tier, floor) => tier >= 8 ? '巫妖王征服者' : floor >= 30 ? '登塔者' : tier >= 4 ? '冰冠勇士' : null,
};

(function () {
    const R = window.RES;
    const SE = R.SEASON, L = SE.lich, TW = SE.tower, HD = SE.hard;
    const T = () => window.SEASON_TABLE || {};
    const C = () => window.Campaign;
    const DAY = 86400000;

    function rng(seed) {
        let a = seed >>> 0;
        return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
    const dayKey = t => window.Quests ? window.Quests.dayKey(t) : new Date(t).toDateString();
    const weekKey = t => window.Quests ? window.Quests.weekKey(t) : '';

    // ───────── 賽季狀態 ─────────
    function state(S, now = Date.now()) {
        const s = S.season = S.season || {};
        s.n = s.n || 1;
        s.start = s.start || now;
        s.lich = s.lich || {};
        s.tower = s.tower || {best: 0};
        s.shop = s.shop || {};
        s.titles = s.titles || [];
        const wk = weekKey(now), dk = dayKey(now);
        if (s.lich.week !== wk) Object.assign(s.lich, {week: wk, best: 0, claimed: {}});
        if (s.lich.day !== dk) Object.assign(s.lich, {day: dk, used: 0});
        s.lich.top = s.lich.top || 0;
        if (s.shop.week !== wk) s.shop = {week: wk, bought: {}};
        return s;
    }
    const unlocked = S => C().progress(S) >= SE.unlock;
    const daysLeft = (S, now = Date.now()) => Math.max(0, Math.ceil((state(S, now).start + SE.days * DAY - now) / DAY));
    const weekNo = (S, now = Date.now()) => Math.min(4, Math.floor((now - state(S, now).start) / (7 * DAY)) + 1);

    function give(S, r) {
        const out = {};
        for (const [k, v] of Object.entries(r)) {
            if (!v) continue;
            if (k === 'gear') { out.gear = window.Gear.make(S, Math.random, {q: v.q, set: Object.keys(R.GEAR.SETS)[Math.floor(Math.random() * 6)]}); continue; }
            S.currency[k] = (S.currency[k] || 0) + v;
            out[k] = v;
        }
        return out;
    }
    const addInto = (a, b) => { for (const [k, v] of Object.entries(b)) if (typeof v === 'number') a[k] = (a[k] || 0) + v; return a; };

    // ───────── 巫妖王試煉 ─────────
    // 這一週的 2 個詞綴（同一週每個人都一樣）
    function affixes(now = Date.now()) {
        const r = rng(hash('lich' + weekKey(now)));
        const list = L.affixes.slice();
        const a = list.splice(Math.floor(r() * list.length), 1)[0];
        const b = list.splice(Math.floor(r() * list.length), 1)[0];
        return [a, b];
    }
    // 傷害門檻：第 1～10 階
    const tierList = () => (T().lich?.tiers) || [20000, 40000, 70000, 110000, 160000, 230000, 320000, 440000, 600000, 800000];
    const tierOf = dmg => { const t = tierList(); let n = 0; while (n < t.length && dmg >= t[n]) n++; return n; };
    function lichEncounter(now = Date.now(), afx = affixes(now)) {
        const t = T().lich || {};
        const tiers = tierList();
        return {
            id: 'lich', kind: 'lich', name: '巫妖王試煉', difficulty: '賽季首領', power: t.power || 6, hpPower: t.hpPower || 3,
            bossHp: tiers[tiers.length - 1], maxRounds: L.rounds, rounds: L.rounds,
            mods: [...afx, {roundDmg: L.ramp}], fatigue: false, affixes: afx,   // 巫妖王有自己的越打越痛，不另外疊亡靈侵蝕
 front: [], back: ['lichKing'], bgHD: 'throne',
        };
    }
    const lichLeft = S => L.perDay - (state(S).lich.used || 0);
    // 結算一次挑戰：dmg＝對巫妖王造成的傷害
    function lichSettle(S, dmg) {
        const s = state(S).lich;
        if (lichLeft(S) <= 0) return {ok: false};
        s.used++;
        const tier = tierOf(dmg);
        const reward = L.attempt(tier);
        const newTiers = [];
        for (let t = 1; t <= tier; t++) if (!s.claimed[t]) { s.claimed[t] = true; newTiers.push(t); addInto(reward, L.weekly(t)); }
        s.best = Math.max(s.best || 0, tier);
        s.top = Math.max(s.top || 0, tier);
        s.bestDmg = Math.max(s.bestDmg || 0, dmg);
        // 全服巫妖王：傷害先記在存檔，回大廳時由 js/online/online.js 送上雲端
        S.online = S.online || {};
        (S.online.hits = S.online.hits || []).push({week: s.week, dmg});
        give(S, reward);
        const Q = window.Quests;
        if (Q) { Q.track(S, 'battle'); Q.track(S, 'lich'); }
        return {ok: true, tier, dmg, reward, newTiers, next: tierList()[tier] || null, left: lichLeft(S)};
    }

    // ───────── 亡靈之塔 ─────────
    // 第 f 層大約對應主線第幾關的養成（第 1 層＝第 3 章打完，第 30 層＝全破）
    const towerIdx = f => Math.min(150, 45 + Math.round((Math.min(f, 30) - 1) * 105 / 29));
    function towerRules(f) {
        const r = rng(f * 7717 + 3);
        const list = TW.rules;
        const a = list[(f - 1) % list.length];
        if (f <= 20) return [a];
        let b = a;
        while (b === a) b = list[Math.floor(r() * list.length)];
        return [a, b];
    }
    function towerEncounter(f) {
        const r = rng(f * 9176 + 11);
        const pick = () => TW.pool[Math.floor(r() * TW.pool.length)];
        const boss = TW.bosses[f > 30 ? (f % 5 === 0 ? [5, 10, 15, 20, 25, 30][Math.floor(r() * 6)] : 0) : f];
        const units = boss ? [boss, pick(), pick()] : [pick(), pick(), pick(), pick(), ...(f > 8 ? [pick()] : [])];
        const front = [], back = [];
        for (const id of units) {
            const d = R.ENEMIES[id];
            if (d.boss) { back.push(id); continue; }
            (['tank', 'warrior'].includes(d.role) && front.length < 2 ? front : (back.length < 3 ? back : front)).push(id);
        }
        while (front.length > 2) back.push(front.pop());
        if (!front.length && back.length > 1) { const i = back.findIndex(id => !R.ENEMIES[id].boss); if (i >= 0) front.push(back.splice(i, 1)[0]); }
        const base = T().tower?.[Math.min(f, 30)];
        const st = C().stage(Math.ceil(towerIdx(f) / 15), (towerIdx(f) - 1) % 15 + 1);
        const over = Math.pow(TW.endless, Math.max(0, f - 30));
        return {
            id: 'tower' + f, kind: 'tower', floor: f, name: `亡靈之塔 第 ${f} 層`, difficulty: boss ? '守層首領' : f > 30 ? '無盡層' : '塔',
            power: (base ? base[0] : st.power) * over, hpPower: (base ? base[1] : st.hpPower) * over,
            mods: towerRules(f), front, back, bgHD: f % 5 === 0 ? 'throne' : 'icefort', rounds: 30,
        };
    }
    const towerBest = S => state(S).tower.best || 0;
    function towerSettle(S, f, win) {
        const Q = window.Quests;
        if (Q) Q.track(S, 'battle');
        if (!win) return {win: false, reward: {}};
        const s = state(S).tower;
        if (f !== (s.best || 0) + 1) return {win: true, reward: {}, repeat: true};   // 已經打過的層不再給獎勵
        s.best = f;
        s.top = Math.max(s.top || 0, f);
        if (Q) Q.track(S, 'tower');
        return {win: true, first: true, reward: give(S, TW.reward(f))};
    }

    // ───────── 困難主線 ─────────
    // 困難第 h 關（1～150）對應的養成：大約是普通第 40＋0.75h 關，最後 10 關要練滿
    function hardGrowthSpec(h) {
        const i = Math.min(150, Math.round(40 + h * 0.75));
        const e = C().expected(i);
        const max = h > 140;
        return {i, lv: max ? 100 : e.lv, star: e.star + (max ? 1 : 0), sk: max ? 5 : e.sk, awk: i >= 120};
    }
    function hardStage(ch, st) {
        const s = C().stage(ch, st);
        const t = T().hard?.[s.key];
        const k = s.kind === 'boss' ? 2.2 : 2.6;   // 沒有校準表時的大概倍率
        return {
            ...s, id: 'h' + s.key, hard: true, difficulty: '困難・' + s.difficulty,
            power: t ? t[0] : s.power * k, hpPower: t ? t[2] : s.hpPower * k, rounds: t ? t[1] : s.rounds + 2,
            mods: [HD.rules[ch - 1]],
        };
    }
    const hardKey = (ch, st) => `${ch}-${st}`;
    const hardStars = (S, ch, st) => (S.campaign?.hstars || {})[hardKey(ch, st)] || 0;
    // 開放：普通這一章打完；章內要照順序
    const hardChapterOpen = (S, ch) => C().progress(S) >= ch * C().N;
    function hardUnlocked(S, ch, st) {
        if (!hardChapterOpen(S, ch)) return false;
        return st === 1 || hardStars(S, ch, st - 1) > 0;
    }
    function hardFirstReward(ch, st) {
        const r = {...C().firstReward(ch, st)};
        for (const k of Object.keys(r)) r[k] *= 2;
        r.awk = HD.awk[C().kindOf(st)];
        return r;
    }
    function hardRepeatReward(ch, st) {
        const r = {...C().repeatReward(ch, st)};
        for (const k of Object.keys(r)) r[k] = Math.round(r[k] * 1.5);
        return r;
    }
    function hardSettle(S, ch, st, win, info) {
        const Q = window.Quests;
        if (Q) Q.track(S, 'battle');
        if (!win) return {stars: 0, first: false, reward: {}};
        S.campaign.hstars = S.campaign.hstars || {};
        const s = hardStage(ch, st);
        let stars = 1;
        if (info.noDeath) stars++;
        if (info.rounds <= s.rounds) stars++;
        const k = hardKey(ch, st), prev = S.campaign.hstars[k] || 0;
        const reward = prev ? hardRepeatReward(ch, st) : hardFirstReward(ch, st);
        S.campaign.hstars[k] = Math.max(prev, stars);
        give(S, reward);
        return {stars, first: !prev, reward};
    }
    const hardChapterStars = (S, ch) => { let n = 0; for (let st = 1; st <= C().N; st++) n += hardStars(S, ch, st); return n; };

    // ───────── 賽季商店 ─────────
    const shopLeft = (S, id) => SE.shop.find(x => x.id === id).limit - (state(S).shop.bought[id] || 0);
    function buy(S, id) {
        const it = SE.shop.find(x => x.id === id);
        if (shopLeft(S, id) <= 0) return {ok: false, reason: '這週的購買次數用完了'};
        if ((S.currency.badge || 0) < it.price) return {ok: false, reason: '賽季徽章不足'};
        if (it.shards && !S.heroes[it.shards.id]) return {ok: false, reason: `要先擁有${R.HEROES[it.shards.id].name}`};
        S.currency.badge -= it.price;
        const s = state(S).shop;
        s.bought[id] = (s.bought[id] || 0) + 1;
        let got = {};
        if (it.shards) got.shards = window.Growth.giveShards(S, it.shards.id, it.shards.n);
        else got = give(S, it.give);
        return {ok: true, got};
    }

    // ───────── 賽季結算 ─────────
    // 賽季滿 28 天：發結算獎勵、通行證沒領的自動領、進度重置，開始下一季。回傳要顯示的內容（沒到期回傳 null）
    function rollover(S, now = Date.now()) {
        const s = state(S, now);
        if (now < s.start + SE.days * DAY) return null;
        const tier = s.lich.top || 0, floor = s.tower.top || s.tower.best || 0;
        const reward = SE.endReward(tier, floor);
        const title = SE.endTitle(tier, floor);
        give(S, reward);
        if (title && !s.titles.includes(`S${s.n} ${title}`)) s.titles.push(`S${s.n} ${title}`);
        const Q = window.Quests;
        let pass = 0;
        if (Q) {
            pass = Q.claimAllPass(S).length;
            while (Q.openChest(S).ok) pass++;
            Object.assign(S.quests, {medals: 0, pClaim: {}, chests: 0, start: now});
        }
        const ended = s.n;
        s.n++;
        s.start = now;
        s.lich = {};
        s.tower = {best: 0};
        s.shop = {};
        state(S, now);
        return {season: ended, tier, floor, reward, title, pass};
    }

    window.Season = {
        state, unlocked, daysLeft, weekNo, give,
        affixes, tierList, tierOf, lichEncounter, lichLeft, lichSettle,
        towerIdx, towerRules, towerEncounter, towerBest, towerSettle,
        hardGrowthSpec, hardStage, hardStars, hardChapterOpen, hardUnlocked, hardFirstReward, hardRepeatReward, hardSettle, hardChapterStars,
        shopLeft, buy, rollover,
    };
})();
