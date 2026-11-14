// 套裝副本（掉套裝裝備）與素材試煉（金幣、經驗、突破石、技能書）。
// 沒有入場券：手動打不限次數；掃蕩每天共用 SWEEP_PER_DAY 次（3 星才能掃）。
// 難度：第 f 層對應主線第 15(f+1)−5 關的預期養成，用 tools/calibrate_dungeons.js 校準（沒有校準表時用主線菁英關的強度）。
window.RES = window.RES || {};

RES.DUNGEONS = {
    floors: 10,
    sweepPerDay: 20,
    rounds: 18,   // 3 星：18 回合內通關
    // 解鎖：最高通關關卡序號（15＝打完第 1 章）
    sets: [
        {id: 'wind', name: '疾風回廊', sets: ['swift', 'resonance'], bgHD: 'forest', boss: 'stormBandit', adds: ['wolf', 'spider', 'goblin'], unlock: 30,
         desc: '掉落疾風、共鳴套裝'},
        {id: 'iron', name: '鐵壁要塞', sets: ['bulwark', 'vitality'], bgHD: 'border', boss: 'ironGolem', adds: ['gargoyle', 'skeleton', 'slime'], unlock: 30,
         desc: '掉落壁壘、生命套裝'},
        {id: 'blood', name: '血月祭壇', sets: ['fury', 'seal'], bgHD: 'nightcity', boss: 'bloodWarlock', adds: ['cultist', 'imp', 'cryptBat'], unlock: 30,
         desc: '掉落狂怒、封印套裝'},
    ],
    trials: [
        {id: 'gold', name: '金幣試煉', icon: '🪙', bgHD: 'border', boss: 'goldGuardian', adds: ['goblin', 'wolf'], unlock: 15, desc: '大量金幣'},
        {id: 'exp', name: '經驗試煉', icon: '🧪', bgHD: 'icefort', boss: 'expSpirit', adds: ['frostLich', 'cryptBat'], unlock: 15, desc: '經驗藥水'},
        {id: 'brk', name: '突破試煉', icon: '💠', bgHD: 'tundra', boss: 'stoneGiant', adds: ['lavaGolem', 'imp'], unlock: 15, desc: '突破石'},
        {id: 'book', name: '技能試煉', icon: '📘', bgHD: 'throne', boss: 'bookBurner', adds: ['cultist', 'frostLich'], unlock: 45, desc: '技能書（第 4 章開放）'},
    ],
};

(function () {
    const R = window.RES;
    const D = R.DUNGEONS;
    const find = (kind, id) => (kind === 'set' ? D.sets : D.trials).find(x => x.id === id);
    const key = (kind, id, f) => `${kind}:${id}:${f}`;

    // 第 f 層的強度 ＝ 主線對應菁英關（第 f+1 章的 x-10）的強度；首領生命另外壓低（跟主線首領的算法一樣）
    function equiv(f) {
        const ch = Math.min(10, f + 1);
        const s = window.Campaign.stage(ch, 10);
        const extra = f >= 10 ? 1.12 : 1;
        return {power: s.power * extra, hpPower: s.hpPower * extra, idx: s.idx};
    }
    function encounter(kind, id, f) {
        const d = find(kind, id), e = equiv(f);
        const T = window.DUNGEON_TABLE && window.DUNGEON_TABLE[key(kind, id, f)];   // 校準表（tools/calibrate_dungeons.js）
        const boss = R.ENEMIES[d.boss];
        // 1～3 層 1 隻小兵、4～7 層 2 隻、8 層以上 3 隻
        const n = f <= 3 ? 1 : f <= 7 ? 2 : 3;
        const adds = Array.from({length: n}, (_, i) => d.adds[i % d.adds.length]);
        // 小兵：坦克、戰士站前排，其餘站後排（首領在後排）
        const fr = [], bk = [d.boss];
        for (const a of adds) (['tank', 'warrior'].includes(R.ENEMIES[a].role) && fr.length < 2 ? fr : (bk.length < 3 ? bk : fr)).push(a);
        return {
            id: key(kind, id, f), kind, did: id, floor: f, name: `${d.name} 第 ${f} 層`, difficulty: kind === 'set' ? '套裝副本' : '素材試煉',
            power: T ? T[0] : e.power, hpPower: T ? T[1] : e.hpPower * 0.62 * 8000 / boss.stats.hp, front: fr, back: bk, bgHD: d.bgHD, rounds: D.rounds,
        };
    }

    // 獎勵：星數越高越多（1★ 60%、2★ 80%、3★ 100%）；首通另給鑽石
    const STAR_K = [0, 0.6, 0.8, 1];
    function baseReward(kind, id, f) {
        if (kind === 'set') return {gold: 1000 + f * 400, stone: 10 + f * 4};
        return {
            gold: {gold: 4000 + f * 3000},
            exp: {exp: 25 + f * 14},
            brk: {brk: 1 + Math.round(f * 0.6)},
            book: {book: 1 + Math.floor(f / 3)},
        }[id];
    }
    // 套裝副本掉落：1～3 層 1 件、4～7 層 2 件、8 層以上 3 件；品質依層數
    const dropCount = f => 1 + (f >= 4) + (f >= 8);

    function grant(S, kind, id, f, stars, rand) {
        const r = {};
        for (const [k, v] of Object.entries(baseReward(kind, id, f))) r[k] = Math.round(v * STAR_K[stars]);
        for (const [k, v] of Object.entries(r)) S.currency[k] = (S.currency[k] || 0) + v;
        const gear = [];
        if (kind === 'set') {
            const d = find(kind, id);
            const n = dropCount(f) + (stars === 3 && rand() < 0.3 ? 1 : 0);
            for (let i = 0; i < n; i++) gear.push(window.Gear.make(S, rand, {q: window.Gear.rollQuality(rand, f), set: d.sets[Math.floor(rand() * 2)]}));
        }
        return {reward: r, gear};
    }

    function state(S) {
        S.dungeons = S.dungeons || {stars: {}, sweepDay: '', sweepUsed: 0};
        return S.dungeons;
    }
    const best = (S, kind, id) => { let b = 0; for (let f = 1; f <= D.floors; f++) if (state(S).stars[key(kind, id, f)]) b = f; return b; };
    const unlockedDungeon = (S, kind, id) => window.Campaign.progress(S) >= find(kind, id).unlock;
    const unlockedFloor = (S, kind, id, f) => unlockedDungeon(S, kind, id) && f <= best(S, kind, id) + 1;
    const starsOf = (S, kind, id, f) => state(S).stars[key(kind, id, f)] || 0;

    function settle(S, kind, id, f, win, info, rand = Math.random) {
        if (!win) return {stars: 0, reward: {}, gear: []};
        let stars = 1;
        if (info.noDeath) stars++;
        if (info.rounds <= D.rounds) stars++;
        const k = key(kind, id, f), prev = state(S).stars[k] || 0;
        state(S).stars[k] = Math.max(prev, stars);
        const g = grant(S, kind, id, f, stars, rand);
        if (!prev) { g.reward.gem = (g.reward.gem || 0) + 30; S.currency.gem = (S.currency.gem || 0) + 30; }
        return {stars, first: !prev, ...g};
    }
    function sweepLeft(S, now = Date.now()) {
        const st = state(S), day = new Date(now).toDateString();
        if (st.sweepDay !== day) { st.sweepDay = day; st.sweepUsed = 0; }
        return D.sweepPerDay - st.sweepUsed;
    }
    function sweep(S, kind, id, f, times, rand = Math.random) {
        if (starsOf(S, kind, id, f) < 3) return {ok: false, reason: '3 星通關後才能掃蕩'};
        times = Math.min(times, sweepLeft(S));
        if (times <= 0) return {ok: false, reason: '今天的掃蕩次數用完了'};
        state(S).sweepUsed += times;
        const total = {}, gear = [];
        for (let i = 0; i < times; i++) {
            const g = grant(S, kind, id, f, 3, rand);
            for (const [k, v] of Object.entries(g.reward)) total[k] = (total[k] || 0) + v;
            gear.push(...g.gear);
        }
        return {ok: true, times, reward: total, gear};
    }

    window.Dungeon = {find, key, encounter, baseReward, dropCount, settle, sweep, sweepLeft, best, unlockedDungeon, unlockedFloor, starsOf, state};
})();
