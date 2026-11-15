// 整季資源模擬：node tools/sim_season.js [天數=28] [人數=3]
// 模擬一個「每天玩 30 分鐘左右」的玩家從開局玩一整季，用真的遊戲規則（存檔、抽卡、養成、主線、試煉、任務、通行證、賽季）跑，
// 每天固定流程：領掛機（含免費快速掛機）→ 養成 → 抽卡 → 戰鬥（主線往前推、素材試煉、巫妖王、亡靈之塔）→ 領任務 → 再養成。
// 戰鬥每場只打一次（輸了就算一次失敗），每天的戰鬥場數有上限（BUDGET，預設 25 場 ≈ 30 分鐘自動戰鬥）。
// 裝備不模擬掉落與強化：直接用「打到第 i 關時的預期裝備」（跟難度校準的假設一樣）。困難主線、覺醒先不打。
// 環境變數：BUDGET 每天戰鬥場數、LOG=1 每天印一行、SEED 亂數種子。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

const DAYS = Number(process.argv[2] || 28), RUNS = Number(process.argv[3] || 3);
const BUDGET = Number(process.env.BUDGET || 25);
const START = new Date('2026-11-16T12:00:00+08:00').getTime();
const H = 3600000, DAY = 24 * H;

function makeWorld(seed) {
    let now = START;
    const RealDate = Date;
    class FakeDate extends RealDate {
        constructor(...a) { if (a.length) super(...a); else super(now); }
        static now() { return now; }
    }
    let a = seed >>> 0;
    const rand = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const store = {};
    const math = Object.create(Math); math.random = rand;
    const ctx = {console, Math: math, Date: FakeDate, localStorage: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }}};
    ctx.window = ctx;
    vm.createContext(ctx);
    for (const f of ['data/elements', 'data/factions', 'data/heroes', 'data/enemies', 'data/gear', 'data/campaign', 'data/campaign_table', 'data/dungeons', 'data/dungeon_table',
        'core/save', 'core/growth', 'core/gear', 'data/quests', 'core/quests', 'data/season_table', 'core/season', 'core/gacha', 'core/battle']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), ctx, {filename: f});
    }
    return {ctx, rand, setNow: t => { now = t; }, getNow: () => now};
}

function run(seed) {
    const W = makeWorld(seed);
    const {RES: R, Save, Growth, Gear, Campaign, Dungeon, Quests, Season, Gacha, Battle} = W.ctx;
    const S = Save.load();
    const earned = {};
    const cur = S.currency;
    S.currency = new Proxy(cur, {set(o, k, v) { const d = v - (o[k] || 0); if (d > 0) earned[k] = (earned[k] || 0) + d; o[k] = v; return true; }});
    const ROLE_RANK = {tank: 0, warrior: 1, assassin: 2, support: 3, archer: 4, mage: 5};
    const log = [];
    const stats = {battles: 0, campaignTries: 0, campaignWins: 0, stuckDays: 0, pulls: 0, ur: 0};
    let gearIdx = 0;   // 預期裝備對應的關卡

    const growthOf = team => Object.fromEntries(team.map(id => [id, {...Growth.multipliers(id, S.heroes[id]), gear: Gear.expectedBonus(Math.max(gearIdx, Campaign.progress(S)))}]));
    const powerOf = id => Growth.power(id, S.heroes[id], Gear.expectedBonus(Math.max(gearIdx, Campaign.progress(S))));
    // 編隊：最強的坦克、輔助各 1，其他依戰力補滿 5 人
    function pickTeam() {
        // 依「升到隊伍目前等級時的戰力」排（玩家會把新抽到的強角練起來）
        const cur = (S.team || []).filter(Boolean), lv = cur.length ? Math.max(...cur.map(id => S.heroes[id]?.lv || 1)) : 1;
        const pot = id => Growth.power(id, {...S.heroes[id], lv: Math.max(S.heroes[id].lv, lv), brk: Math.max(S.heroes[id].brk || 0, Math.floor((lv - 1) / 20))}, Gear.expectedBonus(Math.max(gearIdx, Campaign.progress(S))));
        const own = Object.keys(S.heroes).sort((a, b) => pot(b) - pot(a));
        const role = id => R.HEROES[id].role;
        const team = [];
        const tank = own.find(id => role(id) === 'tank'); if (tank) team.push(tank);
        const sup = own.find(id => role(id) === 'support'); if (sup) team.push(sup);
        for (const id of own) { if (team.length >= 5) break; if (!team.includes(id)) team.push(id); }
        team.sort((a, b) => ROLE_RANK[role(a)] - ROLE_RANK[role(b)]);
        while (team.length < 5) team.push(null);
        S.team = team;
        return team.filter(Boolean);
    }
    function fight(enc) {
        const team = pickTeam();
        stats.battles++;
        const b = Battle.simulate({team: S.team.slice(), encounter: enc, seed: Math.floor(W.rand() * 1e9), auto: true, growth: growthOf(team)});
        const noDeath = b.units.filter(u => u.side === 'ally').every(u => u.alive);
        return {win: b.result === 'win', rounds: b.round(), noDeath, b};
    }
    // 養成：隊伍成員平均升級 → 突破 → 技能 → 升星 → 覺醒
    function grow() {
        const team = pickTeam();
        for (let guard = 0; guard < 2000; guard++) {
            const id = team.filter(x => S.heroes[x].lv < Growth.lvCap(S.heroes[x])).sort((a, b) => S.heroes[a].lv - S.heroes[b].lv)[0];
            if (!id) break;
            if (!Growth.levelUp(W.ctx.Save.load ? S : S, id, 1).ok) break;
        }
        for (const id of team) while (Growth.breakThrough(S, id).ok) { while (Growth.levelUp(S, id, 1).ok); }
        for (let guard = 0; guard < 50; guard++) {
            const opts = team.flatMap(id => ['ul', 'sk'].map(k => [id, k])).sort((x, y) => (S.heroes[x[0]][x[1]] || 1) - (S.heroes[y[0]][y[1]] || 1));
            if (!opts.some(([id, k]) => Growth.skillUp(S, id, k).ok)) break;
        }
        for (const id of Object.keys(S.heroes)) while (Growth.starUp(S, id).ok);
        for (const id of team) Growth.awaken(S, id);
    }
    function gacha() {
        if (!S.newbieDone) { Gacha.pull(S, 'newbie', 10, W.rand); S.newbieDone = true; stats.pulls += 10; }
        const pull = (pool, n) => { if (!Gacha.pay(S, pool, n)) return false; const r = Gacha.pull(S, pool, n, W.rand); stats.pulls += n; stats.ur += r.filter(x => x.rarity === 'UR').length; return true; };
        while ((S.currency.ltdTicket || 0) > 0) pull('ltd', 1);
        while ((S.currency.ticket || 0) > 0) pull('std', 1);
        while ((S.currency.gem || 0) >= 1500) if (!pull('ltd', 10)) break;
    }
    function quests() {
        Quests.track(S, 'enhance');   // 每天強化一次裝備（裝備不另外模擬）
        Quests.track(S, 'gacha');     // 每日任務的招募 1 次（沒有券也會用鑽石單抽，這裡只記任務）
        const q = Quests.state(S);
        for (const t of Quests.dailyList(S)) Quests.claimDaily(S, t.id);
        Quests.claimDailyBonus(S);
        for (const t of Quests.weeklyList(S)) Quests.claimWeekly(S, t.id);
        Quests.claimAllPass(S);
        while (Quests.openChest(S).ok);
        return q;
    }
    function seasonShop() {
        for (const id of ['awk', 'uther', 'ltd', 'book', 'brk']) while (Season.shopLeft(S, id) > 0 && Season.buy(S, id).ok);
    }

    for (let d = 1; d <= DAYS; d++) {
        W.setNow(START + (d - 1) * DAY + 20 * H);   // 每天晚上 8 點上線
        let budget = BUDGET;
        if (d > 1) Campaign.idleClaim(S);
        Campaign.quickIdle(S);
        gacha(); grow();
        // 巫妖王每天 3 次先打（獎勵好、只要 3 場）
        if (Season.unlocked(S)) while (Season.lichLeft(S) > 0 && budget > 0) { const r = fight(Season.lichEncounter()); budget--; Season.lichSettle(S, r.b.bossDamage()); }
        // 主線：一直往下打，連輸 2 場就停（當天卡關）
        let losses = 0, cleared = 0;
        const campaignBudget = Math.min(budget, 12);
        for (let k = 0; k < campaignBudget && losses < 2; k++) {
            const i = Campaign.progress(S) + 1;
            if (i > 150) break;
            const ch = Math.ceil(i / 15), st = (i - 1) % 15 + 1;
            const r = fight(Campaign.stage(ch, st));
            budget--; stats.campaignTries++;
            Campaign.settle(S, ch, st, r.win, {noDeath: r.noDeath, rounds: r.rounds});
            for (const k2 of [0, 1, 2]) Campaign.openChest(S, ch, k2);
            if (r.win) { cleared++; stats.campaignWins++; losses = 0; grow(); } else losses++;
        }
        if (losses >= 2) stats.stuckDays++;
        gearIdx = Math.max(gearIdx, Campaign.progress(S));
        if (Season.unlocked(S)) for (let k = 0; k < 2 && budget > 0; k++) { const f = Season.towerBest(S) + 1; const r = fight(Season.towerEncounter(f)); budget--; Season.towerSettle(S, f, r.win); if (!r.win) break; }
        // 素材試煉：每個試煉用掉當天次數，打能贏的最高層
        for (const t of R.DUNGEONS.trials) {
            if (!Dungeon.unlockedDungeon(S, 'trial', t.id)) continue;
            while (budget > 0 && Dungeon.trialLeft(S, t.id) > 0) {
                const f = Math.max(1, Dungeon.best(S, 'trial', t.id) + (Dungeon.best(S, 'trial', t.id) < R.DUNGEONS.floors ? 1 : 0));
                let r = fight(Dungeon.encounter('trial', t.id, f)); budget--;
                let ff = f;
                if (!r.win && f > 1) { ff = f - 1; r = fight(Dungeon.encounter('trial', t.id, ff)); budget--; }
                Dungeon.settle(S, 'trial', t.id, ff, r.win, {noDeath: r.noDeath, rounds: r.rounds}, W.rand);
                if (!r.win) break;
            }
        }
        // 巫妖王 3 次、亡靈之塔用剩下的場數
        if (Season.unlocked(S)) {
            let tl = 0;
            while (budget > 0 && tl < 2) { const f = Season.towerBest(S) + 1; const r = fight(Season.towerEncounter(f)); budget--; Season.towerSettle(S, f, r.win); if (!r.win) tl++; }
        }
        quests(); seasonShop(); gacha(); grow();
        const team = S.team.filter(Boolean);
        const avgLv = team.reduce((a, id) => a + S.heroes[id].lv, 0) / team.length;
        const p = Campaign.progress(S);
        const ut = S.heroes.uther;
        log.push({d, stage: `${Math.ceil(p / 15) || 1}-${p % 15 || (p ? 15 : 0)}`, prog: p, cleared, lv: avgLv, pass: Quests.level(S), tower: Season.towerBest(S), lich: Season.state(S).lich.top || 0,
            pulls: stats.pulls, uther: ut ? `${ut.star}★` : '-', team: team.map(id => R.HEROES[id].name.split('·').pop()).join(' '),
            gold: S.currency.gold, gem: S.currency.gem, exp: S.currency.exp, brk: S.currency.brk, book: S.currency.book, awk: S.currency.awk, badge: S.currency.badge,
            awkHeroes: Object.values(S.heroes).filter(o => o.awk).length});
    }
    stats.earned = earned;
    stats.stars = Object.entries(S.heroes).map(([id, o]) => `${R.HEROES[id].rarity}${R.HEROES[id].name.split('·').pop()}${o.star}★`).join(' ');
    return {log, stats, S};
}

const runs = Array.from({length: RUNS}, (_, k) => run(Number(process.env.SEED || 7) + k * 101));
const pick = (d, f) => runs.map(r => f(r.log[d - 1]));
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`整季模擬：${RUNS} 位玩家 × ${DAYS} 天，每天 ${BUDGET} 場戰鬥（約 30 分鐘）\n`);
console.log('天  主線進度(平均)  當天過關  隊伍平均等級  通行證  塔  巫妖王階  累計抽卡  烏瑟');
for (const d of [1, 2, 3, 5, 7, 10, 14, 17, 21, 24, 28].filter(x => x <= DAYS)) {
    const L = runs.map(r => r.log[d - 1]);
    const pr = avg(L.map(l => l.prog));
    console.log(`${String(d).padStart(2)}  ${L.map(l => l.stage).join(' / ').padEnd(16)} ${avg(L.map(l => l.cleared)).toFixed(1).padStart(5)}   ${avg(L.map(l => l.lv)).toFixed(0).padStart(8)}   ${avg(L.map(l => l.pass)).toFixed(0).padStart(6)}  ${avg(L.map(l => l.tower)).toFixed(0).padStart(3)}  ${avg(L.map(l => l.lich)).toFixed(1).padStart(6)}  ${avg(L.map(l => l.pulls)).toFixed(0).padStart(8)}   ${L.map(l => l.uther).join('/')}`);
}
console.log('\n最後一天的資源（各玩家）：');
for (const r of runs) { const l = r.log[r.log.length - 1]; console.log(`  金幣 ${l.gold.toLocaleString()}　鑽石 ${l.gem}　經驗藥水 ${l.exp}　突破石 ${l.brk}　技能書 ${l.book}　覺醒石 ${l.awk}　賽季徽章 ${l.badge}　已覺醒 ${l.awkHeroes} 位　隊伍：${l.team}`); }
console.log('\n整季拿到的（各玩家）：');
for (const r of runs) { const e = r.stats.earned; console.log(`  鑽石 ${e.gem || 0}　招募券 ${e.ticket || 0}　限定券 ${e.ltdTicket || 0}　金幣 ${(e.gold || 0).toLocaleString()}　經驗藥水 ${e.exp || 0}　技能書 ${e.book || 0}　突破石 ${e.brk || 0}　覺醒石 ${e.awk || 0}　徽章 ${e.badge || 0}`); }
console.log('\n星級（第 1 位玩家）：', runs[0].stats.stars);
console.log('\n卡關：', runs.map(r => `卡關 ${r.stats.stuckDays} 天、主線勝率 ${(r.stats.campaignWins / r.stats.campaignTries * 100).toFixed(0)}%`).join('；'));
if (process.env.LOG) for (const l of runs[0].log) console.log(JSON.stringify(l));
fs.writeFileSync('/tmp/sim_season.json', JSON.stringify(runs.map(r => r.log)));
