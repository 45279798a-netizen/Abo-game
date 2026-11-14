// 平衡模擬：node tools/sim.js [場數]
// 用跟遊戲完全相同的資料與戰鬥引擎，無畫面跑大量戰鬥，統計勝率、回合數、大招次數。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = {console, Math, Date};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/data/elements.js', 'js/data/factions.js', 'js/data/heroes.js', 'js/data/enemies.js', 'js/core/battle.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, {filename: f});
}
const {RES, Battle} = ctx;
const N = Number(process.argv[2] || 300);

function run(team, encounterId, auto = true) {
    let win = 0, rounds = 0, ults = 0, ultDmg = 0, totalDmg = 0;
    for (let i = 0; i < N; i++) {
        const b = Battle.simulate({team, encounterId, seed: i * 7919 + 13, auto});
        if (b.result === 'win') win++;
        rounds += Math.min(b.round(), Battle.MAX_ROUNDS);
        ults += b.ults;
        ultDmg += b.ultDamage;
        totalDmg += b.units.filter(u => u.side === 'ally').reduce((s, u) => s + u.stats.dmg, 0);
    }
    return {win: win / N, rounds: rounds / N, ults: ults / N, ultShare: ultDmg / totalDmg};
}

const pct = x => (x * 100).toFixed(0).padStart(3) + '%';
const fmt = r => `勝率 ${pct(r.win)}  回合 ${r.rounds.toFixed(1).padStart(4)}  大招 ${r.ults.toFixed(1).padStart(4)} 次（每回合 ${(r.ults / r.rounds).toFixed(2)}）  大招傷害占比 ${pct(r.ultShare)}`;

const teams = {
    '教團＋王國（預設）': ['arthur', 'reina', 'zeke', 'seraph', 'elara'],
    '暗夜＋翠林（預設）': ['gaia', 'shadow', 'dart', 'lilith', 'lyra'],
    '翠林＋王國（預設）': ['valkyrie', 'gaia', 'faye', 'lyra', 'reina'],
    '教團 3＋暗夜 2': ['arthur', 'shadow', 'zeke', 'seraph', 'elara'].map((x, i) => i === 0 ? 'gaia' : x),
    '暗夜 3＋王國 2': ['arthur', 'valkyrie', 'shadow', 'dart', 'lilith'],
    '王國 3＋翠林 2': ['arthur', 'valkyrie', 'reina', 'faye', 'lyra'],
    '翠林 3＋教團 2': ['gaia', 'valkyrie', 'faye', 'lyra', 'zeke'].map((x, i) => i === 1 ? 'elara' : x),
    '四陣營混搭（沒有陣營被動）': ['arthur', 'gaia', 'zeke', 'shadow', 'faye'],
};

for (const enc of RES.ENCOUNTERS) {
    console.log(`\n== ${enc.name}（${enc.difficulty}）`);
    for (const [name, team] of Object.entries(teams)) {
        console.log(name.padEnd(14, '　'), fmt(run(team, enc.id)));
    }
}

// 每隻英雄出現在隨機隊伍時的勝率（對「瘟疫軍團」）
console.log('\n== 個別英雄：隨機隊伍打瘟疫軍團的勝率');
const ids = Object.keys(RES.HEROES);
const tally = Object.fromEntries(ids.map(id => [id, {w: 0, n: 0}]));
let seed = 1;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (let i = 0; i < N * 6; i++) {
    const team = ids.slice().sort(() => rand() - 0.5).slice(0, 5);
    const b = Battle.simulate({team, encounterId: 'plague', seed: i + 1});
    for (const id of team) { tally[id].n++; if (b.result === 'win') tally[id].w++; }
}
for (const id of ids.sort((a, b) => tally[b].w / tally[b].n - tally[a].w / tally[a].n)) {
    console.log(RES.HEROES[id].name.padEnd(10, '　'), pct(tally[id].w / tally[id].n));
}
