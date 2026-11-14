// 主線難度模擬：node tools/sim_campaign.js [場數]
// 假設玩家在第 i 關時的養成程度（expected()），用真正的戰鬥引擎打每章幾個代表關卡，
// 看勝率、回合數與 3 星率。目標：一般關 85～100%、菁英 70～95%、首領 45～80%（玩家正常養成時）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = {console, Math, Date};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/data/elements.js', 'js/data/factions.js', 'js/data/heroes.js', 'js/data/enemies.js', 'js/data/campaign.js', 'js/data/campaign_table.js', 'js/core/battle.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, {filename: f});
}
ctx.Save = {START_STAR: {R: 1, SR: 2, SSR: 3, UR: 4}};
vm.runInContext(fs.readFileSync(path.join(root, 'js/core/growth.js'), 'utf8'), ctx, {filename: 'growth.js'});
const {RES, Battle, Campaign, Growth} = ctx;
const N = Number(process.argv[2] || 60);

// 玩家在打第 i 關（1～150）時的預期養成：等級、多出來的星、技能等級
function expectedOld(i) {
    return {lv: Math.min(100, Math.round(1 + i * 0.62)), star: Math.floor(i / 60), sk: Math.min(5, 1 + Math.floor(i / 40))};
}
function growthFor(team, i) {
    const e = Campaign.expected(i), g = {};
    for (const id of team) {
        const o = {lv: e.lv, star: ctx.Save.START_STAR[RES.HEROES[id].rarity] + e.star, sk: e.sk, ul: e.sk};
        g[id] = Growth.multipliers(id, o);
    }
    return g;
}

const teams = {
    '初始＋新手抽': ['arthur', 'faye', 'elara', 'dart', 'reina'],
    '普通養成': ['arthur', 'reina', 'zeke', 'elara', 'faye'],
};
const pct = x => (x * 100).toFixed(0).padStart(3) + '%';
const stages = [1, 5, 8, 14, 15];
const cv = RES.CAMPAIGN.curve;
if (process.argv[3]) Object.assign(cv, JSON.parse(process.argv[3]));
console.log(`曲線 ${JSON.stringify(cv)}（每關 ${N} 場）`);
for (const [tn, team] of Object.entries(teams)) {
    console.log(`\n【${tn}】`);
    for (const ch of (process.argv[4] || '1,2,3,4,5,6,7,8,9,10').split(',').map(Number)) {
        const row = [];
        for (const st of stages) {
            const s = Campaign.stage(ch, st);
            const growth = growthFor(team, s.idx);
            let win = 0, rounds = 0, three = 0;
            for (let k = 0; k < N; k++) {
                const b = Battle.simulate({team: team.slice(), encounter: s, seed: k * 7919 + s.idx, auto: true, growth});
                if (b.result === 'win') {
                    win++;
                    const r = b.round();
                    rounds += r;
                    if (r <= s.rounds && b.units.filter(u => u.side === 'ally').every(u => u.alive)) three++;
                }
            }
            row.push(`${s.key.padEnd(5)}${s.kind === 'boss' ? '👑' : s.kind === 'elite' ? '★' : ' '} 勝${pct(win / N)} 3星${pct(three / N)} ${win ? (rounds / win).toFixed(1) : ' - '}回`);
        }
        console.log(row.join(' | '));
    }
}
