// 賽季難度校準：node tools/calibrate_season.js [tower,hard,lich]
// 亡靈之塔每層、困難主線每關：二分搜尋敵人攻擊倍率，讓參考隊伍在「那一層／關預期的養成」下勝率落在目標；
// 巫妖王試煉：固定強度，用不同養成程度的隊伍打 15 回合，量出傷害，定出 10 階的傷害門檻。
// 結果寫進 js/data/season_table.js。改了英雄、敵人、覺醒或規則後重跑。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = {console, Math, Date};
ctx.window = ctx;
ctx.localStorage = {getItem() {}, setItem() {}};
vm.createContext(ctx);
for (const f of ['js/data/elements.js', 'js/data/factions.js', 'js/data/heroes.js', 'js/data/enemies.js', 'js/data/gear.js', 'js/data/campaign.js', 'js/data/campaign_table.js',
    'js/core/save.js', 'js/core/growth.js', 'js/core/gear.js', 'js/core/season.js', 'js/core/battle.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, {filename: f});
}
const {RES, Battle, Campaign, Growth, Gear, Save, Season} = ctx;
const TEAM = Campaign.REF_TEAM;
const SEEDS = 24;
const out = path.join(root, 'js/data/season_table.js');
let table = {};
if (fs.existsSync(out)) { const c = {window: {}}; vm.runInNewContext(fs.readFileSync(out, 'utf8'), c); table = c.window.SEASON_TABLE || {}; }
const what = (process.argv[2] || 'tower,hard,lich').split(',');

// spec：{i 對應主線第幾關的裝備, lv, star（比初始多幾星）, sk, awk}
function growth(spec) {
    const g = {}, gear = Gear.expectedBonus(spec.i);
    for (const id of TEAM) {
        const star = Math.min(Growth.MAX_STAR, Save.START_STAR[RES.HEROES[id].rarity] + spec.star);
        g[id] = {...Growth.multipliers(id, {lv: spec.lv, star, sk: spec.sk, ul: spec.sk, awk: spec.awk && star >= Growth.awakenStar(id)}), gear};
    }
    return g;
}
const specAt = i => ({i, ...Campaign.expected(i), awk: i >= 120});
const MAXED = {i: 150, lv: 100, star: 3, sk: 5, awk: true};
function trial(enc, power, hpPower, g, salt) {
    let win = 0, rounds = 0;
    for (let k = 0; k < SEEDS; k++) {
        const b = Battle.simulate({team: TEAM.slice(), encounter: {...enc, power, hpPower}, seed: k * 7919 + salt * 131, auto: true, growth: g});
        if (b.result === 'win') { win++; rounds += b.round(); }
    }
    return {win: win / SEEDS, rounds: win ? rounds / win : 99};
}
function search(enc, hp, g, target, maxLen, salt) {
    let p, r;
    for (let pass = 0; pass < 3; pass++) {
        let lo = Math.log(0.3), hi = Math.log(300);
        for (let it = 0; it < 10; it++) { const mid = (lo + hi) / 2; if (trial(enc, Math.exp(mid), hp, g, salt).win >= target) lo = mid; else hi = mid; }
        p = Math.exp(lo); r = trial(enc, p, hp, g, salt);
        if (r.rounds <= maxLen) break;
        hp = +(hp * Math.max(0.5, maxLen / r.rounds)).toFixed(3);
    }
    return {p: +p.toFixed(3), hp, r};
}
const stageAt = i => Campaign.stage(Math.ceil(i / 15), (i - 1) % 15 + 1);
const hpOfKind = (i, boss) => { const T = ctx.CAMPAIGN_TABLE; const ch = Math.ceil(i / 15); return boss ? T[`${ch}-15`][2] : T[`${ch}-${Math.max(1, Math.min(14, (i - 1) % 15 + 1))}`][2]; };

if (what.includes('tower')) {
    table.tower = {};
    for (let f = 1; f <= RES.SEASON.tower.floors; f++) {
        const enc = Season.towerEncounter(f), i = Season.towerIdx(f), boss = f % 5 === 0;
        const bossId = RES.SEASON.tower.bosses[f];
        // 首領層的生命：用同一章主線首領的倍率，再依首領基礎生命換算
        let hp = hpOfKind(i, false);
        if (boss) hp = +(hpOfKind(i, true) * RES.ENEMIES[RES.CAMPAIGN.chapters[Math.ceil(i / 15) - 1].boss].stats.hp / RES.ENEMIES[bossId].stats.hp).toFixed(3);
        const s = search(enc, hp, growth(specAt(i)), boss ? 0.55 : 0.7, boss ? 20 : 12, f);
        table.tower[f] = [s.p, s.hp];
        console.log('tower', f, enc.mods.join('+'), 'atk', s.p, 'hp', s.hp, 'win', s.r.win.toFixed(2), 'rounds', s.r.rounds.toFixed(1));
    }
}
if (what.includes('hard')) {
    table.hard = {};
    const TARGET = {normal: 0.85, elite: 0.75, boss: 0.6}, LEN = {normal: 10, elite: 12, boss: 20};
    for (let ch = 1; ch <= 10; ch++) for (let st = 1; st <= 15; st++) {
        const h = (ch - 1) * 15 + st, spec = Season.hardGrowthSpec(h), enc = Season.hardStage(ch, st);
        // 生命：照「對應養成的那一關」的主線倍率，再依首領基礎生命換算
        let hp = hpOfKind(spec.i, false) * (enc.kind === 'elite' ? 1.15 : 1);
        if (enc.kind === 'boss') hp = hpOfKind(spec.i, true) * RES.ENEMIES[RES.CAMPAIGN.chapters[Math.ceil(spec.i / 15) - 1].boss].stats.hp / RES.ENEMIES[RES.CAMPAIGN.chapters[ch - 1].boss].stats.hp;
        if (h > 140) hp *= 1.2;
        const s = search(enc, +hp.toFixed(3), growth(spec), TARGET[enc.kind], LEN[enc.kind], h);
        const rounds = Math.min(28, Math.ceil(s.r.rounds) + (enc.kind === 'boss' ? 2 : 1));
        table.hard[enc.key] = [s.p, rounds, s.hp];
        console.log('hard', enc.key, enc.kind, 'atk', s.p, 'hp', s.hp, 'win', s.r.win.toFixed(2), 'rounds', s.r.rounds.toFixed(1));
    }
}
if (what.includes('lich')) {
    // 巫妖王：攻擊倍率固定，量各種養成程度打 15 回合的平均傷害（不帶詞綴）
    const POWER = Number(process.env.LICH_POWER || 16), HPP = 4;
    const dmgAt = spec => {
        let sum = 0, rs = 0; const N = 40;
        for (let k = 0; k < N; k++) {
            const enc = {...Season.lichEncounter(0, []), power: POWER, hpPower: HPP, bossHp: 1e9};
            const b = Battle.simulate({team: TEAM.slice(), encounter: enc, seed: k * 977 + 5, auto: true, growth: growth(spec)});
            sum += b.bossDamage(); rs += Math.min(b.round(), enc.maxRounds);
        }
        return {dmg: sum / N, rounds: rs / N};
    };
    const pts = [45, 60, 75, 90, 105, 120, 135, 150].map(i => ({i, ...dmgAt(specAt(i))}));
    const max = dmgAt(MAXED);
    for (const p of pts) console.log('lich 第', p.i, '關的養成：傷害', Math.round(p.dmg), '撐', p.rounds.toFixed(1), '回合');
    console.log('lich 練滿：傷害', Math.round(max.dmg), '撐', max.rounds.toFixed(1), '回合');
    // 第 1 階＝剛開放（第 45 關養成）的 6 成；第 10 階＝練滿的 8.5 成；中間等比
    const lo = pts[0].dmg * 0.6, hi = max.dmg * 0.85;
    const round = v => { const m = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / m) * m; };
    table.lich = {power: POWER, hpPower: HPP, tiers: Array.from({length: 10}, (_, k) => round(lo * Math.pow(hi / lo, k / 9)))};
    console.log('lich 門檻', table.lich.tiers.join(' / '));
}
fs.writeFileSync(out, `// 由 tools/calibrate_season.js 產生。tower：每層 [攻擊倍率, 生命防禦倍率]；hard：每關 [攻擊倍率, 3 星回合數, 生命防禦倍率]；lich：強度與 10 階傷害門檻。\nwindow.SEASON_TABLE = ${JSON.stringify(table)};\n`);
