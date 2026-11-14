// 主線難度校準：node tools/calibrate_campaign.js [章節,章節...]
// 每一關用二分搜尋找出「普通養成的隊伍在預期養成下勝率剛好落在目標」的敵人強度，
// 並用該強度下的平均回合數決定 3 星回合數。結果寫進 js/data/campaign_table.js（遊戲直接讀這張表）。
// 預期養成（等級、星級、技能、裝備）與 tools/sim_campaign.js 相同；改了英雄、敵人或養成數值後重跑一次。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = {console, Math, Date};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/data/elements.js', 'js/data/factions.js', 'js/data/heroes.js', 'js/data/enemies.js', 'js/data/gear.js', 'js/data/campaign.js', 'js/core/battle.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, {filename: f});
}
ctx.Save = {START_STAR: {R: 1, SR: 2, SSR: 3, UR: 4}};
vm.runInContext(fs.readFileSync(path.join(root, 'js/core/growth.js'), 'utf8'), ctx, {filename: 'growth.js'});
vm.runInContext(fs.readFileSync(path.join(root, 'js/core/gear.js'), 'utf8'), ctx, {filename: 'gear.js'});
const {RES, Battle, Campaign, Growth, Gear} = ctx;

const SEEDS = 24;
const TARGET = {normal: 0.9, elite: 0.8, boss: 0.65};   // 預期養成下的勝率
// 敵人生命／防禦倍率 = 預期養成倍率 × HP_K（跟著玩家攻擊力走，讓戰鬥長度固定）；攻擊倍率用二分搜尋找
const HP_K = {normal: 1.0, elite: 1.2, boss: 0.75};
const MAX_LEN = {normal: 10, elite: 12, boss: 20};   // 平均回合超過就壓低敵人生命
const BOSS_HP_REF = 8000;   // 首領基礎生命越高，倍率壓越低，讓每章首領戰長度差不多
const TEAM = ['arthur', 'reina', 'zeke', 'elara', 'faye'];
// 預期養成：打第 i 關時的等級、多出的星數、技能等級
const expected = i => Campaign.expected(i);

function growthFor(i) {
    const e = expected(i), g = {};
    const gear = Gear.expectedBonus(i);   // 預期裝備（第 2 章起）
    for (const id of TEAM) g[id] = {...Growth.multipliers(id, {lv: e.lv, star: ctx.Save.START_STAR[RES.HEROES[id].rarity] + e.star, sk: e.sk, ul: e.sk}), gear};
    return g;
}
function trial(s, power, growth, hpPower) {
    let win = 0, rounds = 0;
    const enc = Object.assign({}, s, {power, hpPower});
    for (let k = 0; k < SEEDS; k++) {
        const b = Battle.simulate({team: TEAM.slice(), encounter: enc, seed: k * 7919 + s.idx * 31, auto: true, growth});
        if (b.result === 'win') { win++; rounds += b.round(); }
    }
    return {win: win / SEEDS, rounds: win ? rounds / win : 99};
}

const out = process.env.OUT || path.join(root, 'js/data/campaign_table.js');
let table = {};
if (fs.existsSync(out)) { const c = {window: {}}; vm.runInNewContext(fs.readFileSync(out, 'utf8'), c); table = c.window.CAMPAIGN_TABLE || {}; }
const ONLY = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const chapters = (process.argv[2] || '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);

for (const ch of chapters) {
    for (let st = 1; st <= Campaign.N; st++) {
        if (ONLY && !ONLY.includes(st)) continue;
        const s = Campaign.stage(ch, st);
        const growth = growthFor(s.idx);
        const target = TARGET[s.kind];
        const e = expected(s.idx);
        const gb = Gear.expectedBonus(s.idx);   // 玩家攻擊力也含裝備
        const hpBase = +((1 + 0.04 * (e.lv - 1)) * (1 + 0.15 * e.star) * (1 + (gb?.atkPct || 0)) * HP_K[s.kind] * (s.kind === 'boss' ? BOSS_HP_REF / RES.ENEMIES[RES.CAMPAIGN.chapters[ch - 1].boss].stats.hp : 1)).toFixed(3);
        // 找攻擊倍率；如果那個強度下戰鬥太長（補師、高血量組合），把生命倍率壓低再找一次
        let hpPower = hpBase, p, r;
        for (let pass = 0; pass < 3; pass++) {
            let lo = Math.log(0.3), hi = Math.log(120);
            for (let it = 0; it < 10; it++) {
                const mid = (lo + hi) / 2;
                if (trial(s, Math.exp(mid), growth, hpPower).win >= target) lo = mid; else hi = mid;
            }
            p = Math.exp(lo);
            r = trial(s, p, growth, hpPower);
            if (r.rounds <= MAX_LEN[s.kind]) break;
            hpPower = +(hpPower * Math.max(0.5, MAX_LEN[s.kind] / r.rounds)).toFixed(3);
        }
        // 3 星回合數：預期養成下的平均回合（無條件進位），首領多給 2 回合
        const rounds = Math.min(28, Math.ceil(r.rounds) + (s.kind === 'boss' ? 2 : 0));
        table[s.key] = [+p.toFixed(3), rounds, hpPower];
        console.log(s.key, s.kind, 'hp', hpPower, 'atk', p.toFixed(3), 'win', r.win.toFixed(2), 'rounds', r.rounds.toFixed(1), '→', rounds);
    }
    const keys = Object.keys(table).sort((a, b) => { const [a1, a2] = a.split('-').map(Number), [b1, b2] = b.split('-').map(Number); return a1 - b1 || a2 - b2; });
    const body = keys.map(k => `'${k}':[${table[k].join(',')}]`).join(',');
    fs.writeFileSync(out, `// 由 tools/calibrate_campaign.js 產生：每關 [敵人攻擊倍率, 3 星回合數, 敵人生命防禦倍率]。不要手改，改完數值後重跑校準。\nwindow.CAMPAIGN_TABLE = {${body}};\n`);
}
