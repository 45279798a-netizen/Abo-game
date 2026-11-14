// 副本／試煉難度校準：node tools/calibrate_dungeons.js
// 第 f 層對應主線第 i＝15(f+1)−5 關的預期養成（含裝備），二分搜尋讓參考隊伍勝率約 75%；
// 戰鬥太長就壓低敵人生命。結果寫進 js/data/dungeon_table.js（每層 [攻擊倍率, 生命防禦倍率]）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = {console, Math, Date};
ctx.window = ctx;
ctx.localStorage = {getItem() {}, setItem() {}};
vm.createContext(ctx);
for (const f of ['js/data/elements.js', 'js/data/factions.js', 'js/data/heroes.js', 'js/data/enemies.js', 'js/data/gear.js', 'js/data/campaign.js', 'js/data/campaign_table.js', 'js/data/dungeons.js',
    'js/core/save.js', 'js/core/growth.js', 'js/core/gear.js', 'js/core/battle.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, {filename: f});
}
const {RES, Battle, Campaign, Growth, Gear, Dungeon, Save} = ctx;
const TEAM = Campaign.REF_TEAM;
const SEEDS = 24, TARGET = 0.75, MAX_LEN = 16;
const idxOf = f => Math.min(150, 15 * (f + 1) - 5);
function growthFor(i) {
    const e = Campaign.expected(i), gear = Gear.expectedBonus(i), g = {};
    for (const id of TEAM) g[id] = {...Growth.multipliers(id, {lv: e.lv, star: Save.START_STAR[RES.HEROES[id].rarity] + e.star, sk: e.sk, ul: e.sk}), gear};
    return g;
}
function trial(enc, power, hpPower, growth) {
    let win = 0, rounds = 0;
    for (let k = 0; k < SEEDS; k++) {
        const b = Battle.simulate({team: TEAM.slice(), encounter: {...enc, power, hpPower}, seed: k * 7919 + enc.floor * 131, auto: true, growth});
        if (b.result === 'win') { win++; rounds += b.round(); }
    }
    return {win: win / SEEDS, rounds: win ? rounds / win : 99};
}
const table = {};
for (const [kind, list] of [['set', RES.DUNGEONS.sets], ['trial', RES.DUNGEONS.trials]]) {
    for (const d of list) {
        for (let f = 1; f <= RES.DUNGEONS.floors; f++) {
            const i = idxOf(f), e = Campaign.expected(i), gb = Gear.expectedBonus(i);
            const enc = Dungeon.encounter(kind, d.id, f);
            // 首領生命：跟玩家攻擊力成比例，首領基礎生命越高壓越低
            let hp = +((1 + 0.04 * (e.lv - 1)) * (1 + 0.15 * e.star) * (1 + (gb?.atkPct || 0)) * 0.75 * 8000 / RES.ENEMIES[d.boss].stats.hp).toFixed(3);
            const growth = growthFor(i);
            let p, r;
            for (let pass = 0; pass < 3; pass++) {
                let lo = Math.log(0.3), hi = Math.log(150);
                for (let it = 0; it < 10; it++) { const mid = (lo + hi) / 2; if (trial(enc, Math.exp(mid), hp, growth).win >= TARGET) lo = mid; else hi = mid; }
                p = Math.exp(lo); r = trial(enc, p, hp, growth);
                if (r.rounds <= MAX_LEN) break;
                hp = +(hp * Math.max(0.5, MAX_LEN / r.rounds)).toFixed(3);
            }
            table[`${kind}:${d.id}:${f}`] = [+p.toFixed(3), hp];
            console.log(kind, d.id, f, 'atk', p.toFixed(2), 'hp', hp, 'win', r.win.toFixed(2), 'rounds', r.rounds.toFixed(1));
        }
    }
}
fs.writeFileSync(path.join(root, 'js/data/dungeon_table.js'), `// 由 tools/calibrate_dungeons.js 產生：每層 [敵人攻擊倍率, 敵人生命防禦倍率]。改完數值後重跑。\nwindow.DUNGEON_TABLE = ${JSON.stringify(table)};\n`);
