// 隊伍推薦：node tools/team_search.js
// 把 22 位英雄的所有 5 人組合（坦克、戰士排前排）在相同養成下跑主線、困難、巫妖王試煉，找出各用途表現最好的隊伍。
// 先用少量場次粗篩，再把前幾名多跑幾場確認。環境變數 POOL=free 只用不含 UR 的英雄。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = {console, Math, Date};
ctx.window = ctx;
ctx.localStorage = {getItem() {}, setItem() {}};
vm.createContext(ctx);
for (const f of ['js/data/elements.js', 'js/data/factions.js', 'js/data/heroes.js', 'js/data/enemies.js', 'js/data/gear.js', 'js/data/campaign.js', 'js/data/campaign_table.js',
    'js/core/save.js', 'js/core/growth.js', 'js/core/gear.js', 'js/data/season_table.js', 'js/core/season.js', 'js/core/battle.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, {filename: f});
}
const {RES, Battle, Campaign, Growth, Gear, Save, Season} = ctx;
const H = RES.HEROES;
let ids = Object.keys(H);
if (process.env.POOL === 'free') ids = ids.filter(id => H[id].rarity !== 'UR');
if (process.env.POOL === 'low') ids = ids.filter(id => ['R', 'SR'].includes(H[id].rarity));
const AWK = !!process.env.AWK, IDX = Number(process.env.IDX || 105);
const frontRank = id => ({tank: 0, warrior: 1, assassin: 2, support: 3, archer: 4, mage: 5})[H[id].role];
const arrange = t => t.slice().sort((a, b) => frontRank(a) - frontRank(b));
function growthFor(team) {
    const e = Campaign.expected(IDX), gear = Gear.expectedBonus(IDX), g = {};
    for (const id of team) g[id] = {...Growth.multipliers(id, {lv: e.lv, star: Math.min(6, Save.START_STAR[H[id].rarity] + e.star + (AWK ? 2 : 0)), sk: e.sk, ul: e.sk, awk: AWK}), gear};
    return g;
}
const combos = [];
(function rec(start, cur) { if (cur.length === 5) { combos.push(arrange(cur)); return; } for (let i = start; i < ids.length; i++) rec(i + 1, [...cur, ids[i]]); })(0, []);
const MODES = {
    // 主線：比預期養成難一點的關卡，看勝率
    campaign: {encs: (process.env.STAGES || '8-5,8-15,9-10,9-15').split(',').map(k => { const [c, s] = k.split('-').map(Number); const st = Campaign.stage(c, s); return {...st, power: st.power * Number(process.env.EF || 1.25)}; }), score: b => b.result === 'win' ? 1 : 0},
    // 速刷：正常強度的關卡，贏得越快分數越高（拿 3 星、刷關用）
    speed: {encs: (process.env.STAGES || '8-5,8-15,9-10,9-15').split(',').map(k => { const [c, s] = k.split('-').map(Number); return Campaign.stage(c, s); }), score: b => b.result === 'win' ? 30 - b.round() : 0},
    // 巫妖王：平均傷害（不帶詞綴）
    lich: {encs: [{...Season.lichEncounter(0, []), bossHp: 1e9}], score: b => b.bossDamage()},
};
const mode = MODES[process.argv[2] || 'campaign'];
function evalTeam(team, seeds, off = 0) {
    const g = growthFor(team); let s = 0, n = 0;
    for (const enc of mode.encs) for (let k = 0; k < seeds; k++) { s += mode.score(Battle.simulate({team, encounter: enc, seed: (k + off) * 7919 + 13, auto: true, growth: g})); n++; }
    return s / n;
}
const t0 = Date.now();
let rows = combos.map(t => ({t, s: evalTeam(t, Number(process.env.SEEDS || 2))}));
rows.sort((a, b) => b.s - a.s);
rows = rows.slice(0, 250).map(r => ({t: r.t, s: evalTeam(r.t, 16, 100)}));
rows.sort((a, b) => b.s - a.s);
console.log(`${process.argv[2] || 'campaign'}　${combos.length} 隊　${((Date.now() - t0) / 1000).toFixed(0)} 秒　平均養成：主線第 ${IDX} 關${AWK ? '＋覺醒' : ''}`);
for (const r of rows.slice(0, Number(process.env.TOP || 12))) console.log((mode === MODES.lich ? Math.round(r.s).toLocaleString().padStart(9) : mode === MODES.speed ? ('平均 ' + (30 - r.s).toFixed(1) + ' 回合') : (r.s * 100).toFixed(0).padStart(4) + '%'), r.t.map(id => `${H[id].rarity}${H[id].name.split('·').pop()}(${RES.FACTIONS[H[id].faction].short})`).join(' '));
// 每位英雄出現在前 250 名的次數
const cnt = {}; for (const r of rows.slice(0, 100)) for (const id of r.t) cnt[id] = (cnt[id] || 0) + 1;
console.log('前 100 名出現次數：', Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${H[id].name.split('·').pop()} ${n}`).join('、'));
