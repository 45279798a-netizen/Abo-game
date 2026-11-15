// 英雄強度檢查：node tools/hero_balance.js [每個關卡的場數]
// 隨機 5 人隊伍（22 位英雄）在相同養成下，打主線幾個代表關卡，統計每位英雄「在隊上時的勝率」。
// 兩種模式：實際（含稀有度能力差）＋技能（所有稀有度能力一樣，只比技能設計）。
// 環境變數：EF 敵人攻擊倍率、AWK=1 全員覺醒、PATCH 試調整用的腳本。
// 結果寫到 /tmp/hero_balance.json，給 tools/hero_balance_report 或人工看。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = {console, Math, Date};
ctx.window = ctx;
ctx.localStorage = {getItem() {}, setItem() {}};
vm.createContext(ctx);
for (const f of ['js/data/elements.js', 'js/data/factions.js', 'js/data/heroes.js', 'js/data/enemies.js', 'js/data/gear.js', 'js/data/campaign.js', 'js/data/campaign_table.js',
    'js/core/save.js', 'js/core/growth.js', 'js/core/gear.js', 'js/core/battle.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, {filename: f});
}
if (process.env.PATCH) vm.runInContext(fs.readFileSync(process.env.PATCH, 'utf8'), ctx, {filename: 'patch'});   // 試調整用
const {RES, Battle, Campaign, Growth, Gear, Save} = ctx;
const N = Number(process.argv[2] || 1500);
const STAGES = (process.argv[3] || '3-15,5-10,6-15,8-10,9-15,10-15').split(',').map(k => k.split('-').map(Number));
const ids = Object.keys(RES.HEROES);
const roleOf = id => RES.HEROES[id].role;
const TANKS = ids.filter(id => roleOf(id) === 'tank'), SUPPORTS = ids.filter(id => roleOf(id) === 'support'), DPS = ids.filter(id => !['tank', 'support'].includes(roleOf(id)));

let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function growthFor(team, i) {
    const e = Campaign.expected(i), gear = Gear.expectedBonus(i), g = {};
    for (const id of team) g[id] = {...Growth.multipliers(id, {lv: e.lv, star: Save.START_STAR[RES.HEROES[id].rarity] + e.star, sk: e.sk, ul: e.sk, awk: !!process.env.AWK}), gear};
    return g;
}

function run(label) {
    const tally = Object.fromEntries(ids.map(id => [id, {w: 0, n: 0, dmg: 0, heal: 0, taken: 0}]));
    let wins = 0, total = 0;
    for (const [ch, st] of STAGES) {
        const s = Campaign.stage(ch, st);
        // 隨機隊伍比參考隊伍弱，敵人攻擊倍率可用 EF 調整（預設 1.0），讓整體勝率落在一半左右差異最明顯
        const enc = {...s, power: s.power * Number(process.env.EF || 1.0)};
        for (let k = 0; k < N; k++) {
            // 隊伍固定 1 坦克＋1 輔助＋3 輸出，同職業的英雄互相比較才公平
            const pick = (list, n) => list.slice().sort(() => rand() - 0.5).slice(0, n);
            const team = [...pick(TANKS, 1), ...pick(SUPPORTS, 1), ...pick(DPS, 3)];
            const b = Battle.simulate({team, encounter: enc, seed: k * 31 + ch * 7 + st, auto: true, growth: growthFor(team, s.idx)});
            const win = b.result === 'win';
            wins += win; total++;
            const allies = b.units.filter(u => u.side === 'ally');
            const sum = allies.reduce((a, u) => a + u.stats.dmg, 0) || 1;
            for (const u of allies) {
                const t = tally[u.id];
                t.n++; if (win) t.w++;
                t.dmg += u.stats.dmg / sum;
                t.heal += (u.stats.heal || 0);
                t.taken += (u.stats.taken || 0);
            }
        }
    }
    const base = wins / total;
    const roleBase = {};
    for (const grp of [TANKS, SUPPORTS, DPS]) { let w = 0, n = 0; for (const id of grp) { w += tally[id].w; n += tally[id].n; } for (const id of grp) roleBase[id] = w / n; }
    const rows = ids.map(id => {
        const t = tally[id];
        return {id, name: RES.HEROES[id].name, rarity: RES.HEROES[id].rarity, role: RES.HEROES[id].role, faction: RES.HEROES[id].faction,
            win: t.w / t.n, delta: t.w / t.n - roleBase[id], grp: TANKS.includes(id) ? '坦克' : SUPPORTS.includes(id) ? '輔助' : '輸出', dmgShare: t.dmg / t.n, heal: t.heal / t.n, taken: t.taken / t.n};
    }).sort((a, b) => a.grp.localeCompare(b.grp) || b.win - a.win);
    console.log(`\n== ${label}（整體勝率 ${(base * 100).toFixed(1)}%）`);
    for (const r of rows) console.log(`${r.grp} ${r.rarity.padEnd(3)} ${r.name.padEnd(12, '　')} 勝率 ${(r.win * 100).toFixed(1).padStart(5)}%  (${(r.delta * 100 >= 0 ? '+' : '') + (r.delta * 100).toFixed(1)})  傷害占比 ${(r.dmgShare * 100).toFixed(0).padStart(3)}%`);
    return {base, rows};
}

const out = {};
out.actual = run('實際（含稀有度能力差）');
const keep = JSON.parse(JSON.stringify(RES.RARITY));
for (const k of Object.keys(RES.RARITY)) { RES.RARITY[k].mult = 1; RES.AWAKEN.stat[k] = 0.08; }
out.kit = run('只比技能（所有稀有度能力一樣）');
Object.assign(RES.RARITY, keep);
fs.writeFileSync('/tmp/hero_balance.json', JSON.stringify(out));
