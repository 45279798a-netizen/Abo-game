// 英雄養成：等級、突破、星級、技能等級，以及滿星後的星塵。
// 純規則，不碰畫面；大廳用它算花費與數值，戰鬥用 multipliers() 把養成套到角色身上。
(function () {
    const R = window.RES;

    const MAX_LV = 100;
    const MAX_STAR = 6;
    const MAX_SKILL = 5;
    const LV_PCT = 0.04;      // 每級全能力 +4%
    // 每升 1★ 全能力加成（以初始星級為基準），稀有度越高每星越多：滿星時 UR > SSR > SR > R，4★ 的 R 大約等於剛抽到的 SSR
    const STAR_PCT = {R: 0.08, SR: 0.10, SSR: 0.13, UR: 0.15};
    const starPct = id => STAR_PCT[R.HEROES[id].rarity];
    const SKILL_PCT = 0.08;   // 小技能／大招每級效果 +8%

    // 升到第 n★ 需要的碎片（n＝2～6）
    const STAR_COST = {2: 20, 3: 40, 4: 100, 5: 300, 6: 500};
    // 每 20 級要突破一次：突破後等級上限 +20。第 k 次突破（k＝1～4）的花費
    const BREAK_COST = {1: {brk: 5, gold: 5000}, 2: {brk: 10, gold: 15000}, 3: {brk: 20, gold: 40000}, 4: {brk: 40, gold: 80000}};
    // 技能升到第 n 級的花費（n＝2～5）
    const SKILL_COST = {2: {book: 1, gold: 2000}, 3: {book: 2, gold: 6000}, 4: {book: 4, gold: 15000}, 5: {book: 8, gold: 30000}};
    // 星塵商店：1 個碎片的價格（星塵）與道具
    const DUST_PER_SHARD = 2;
    const DUST_SHOP = [
        {key: 'book', name: '技能書', price: 30},
        {key: 'brk', name: '突破石', price: 20},
        {key: 'exp', name: '經驗藥水 ×10', price: 15, count: 10},
    ];

    const startStar = id => window.Save.START_STAR[R.HEROES[id].rarity] || 1;
    const lvCap = o => Math.min(MAX_LV, 20 * ((o.brk || 0) + 1));
    // 升一級：經驗藥水與金幣（等級越高越貴）
    const lvCost = lv => ({exp: 2 + Math.floor(lv * 0.6), gold: 100 + lv * 60});

    function mult(id, o) {
        if (!o) return 1;
        return (1 + LV_PCT * (o.lv - 1)) * (1 + starPct(id) * (o.star - startStar(id))) * (o.awk ? 1 + R.AWAKEN.stat[R.HEROES[id].rarity] : 1);
    }
    // 戰鬥用：全能力倍率、技能倍率、大招倍率
    function multipliers(id, o) {
        return {
            stat: mult(id, o),
            skill: 1 + SKILL_PCT * (((o && o.sk) || 1) - 1),
            ult: 1 + SKILL_PCT * (((o && o.ul) || 1) - 1),
            awk: !!(o && o.awk),
        };
    }
    // e：裝備加成（Gear.bonus），可省略
    function stats(id, o, e) {
        const d = R.HEROES[id], role = R.ROLES[d.role], m = R.RARITY[d.rarity].mult * mult(id, o);
        e = e || {};
        let hp = role.hp * m * (1 + (e.hpPct || 0)), atk = role.atk * m * (1 + (e.atkPct || 0)), def = role.def * m * (1 + (e.defPct || 0));
        const p = d.passive;
        if (p?.type === 'statUp' && p.pct) { if (p.stat === 'hp') hp *= 1 + p.pct; if (p.stat === 'atk') atk *= 1 + p.pct; if (p.stat === 'def') def *= 1 + p.pct; }
        return {hp: Math.round(hp), atk: Math.round(atk), def: Math.round(def), spd: Math.round((role.spd + (d.spdBonus || 0) + (e.spd || 0)) * (1 + (e.spdPct || 0))),
            crit: 0.15 + (e.crit || 0), critDmg: 0.5 + (e.critDmg || 0), hit: e.hit || 0, res: e.res || 0};
    }
    // 戰力：給玩家比較用的單一數字（暴擊換算成期望傷害）
    const power = (id, o, e) => {
        const s = stats(id, o, e), m = multipliers(id, o);
        const atk = s.atk * (1 + Math.min(1, s.crit) * s.critDmg) / (1 + 0.15 * 0.5);
        return Math.round((s.hp * 0.2 + atk * 2.2 + s.def * 1.5 + s.spd * 3 + (s.hit + s.res) * 300) * (1 + (m.skill - 1) * 0.3 + (m.ult - 1) * 0.3) * (m.awk ? 1.05 : 1));
    };

    const has = (S, cost) => Object.entries(cost).every(([k, v]) => (S.currency[k] || 0) >= v);
    const pay = (S, cost) => { for (const [k, v] of Object.entries(cost)) S.currency[k] -= v; };

    // 各種升級：回傳 {ok, reason?}；成功時直接改存檔
    function levelUp(S, id, times = 1) {
        const o = S.heroes[id];
        let n = 0;
        while (n < times && o.lv < lvCap(o)) {
            const c = lvCost(o.lv);
            if (!has(S, c)) break;
            pay(S, c); o.lv++; n++;
        }
        if (n) { window.Quests && window.Quests.track(S, 'levelup', n); return {ok: true, n}; }
        if (o.lv >= MAX_LV) return {ok: false, reason: '已經是最高等級'};
        if (o.lv >= lvCap(o)) return {ok: false, reason: '需要先突破'};
        return {ok: false, reason: '經驗藥水或金幣不足'};
    }
    function breakCost(o) { return BREAK_COST[(o.brk || 0) + 1] || null; }
    function breakThrough(S, id) {
        const o = S.heroes[id], c = breakCost(o);
        if (!c) return {ok: false, reason: '已經突破到頂'};
        if (o.lv < lvCap(o)) return {ok: false, reason: `要先升到 Lv.${lvCap(o)}`};
        if (!has(S, c)) return {ok: false, reason: '突破石或金幣不足'};
        pay(S, c); o.brk = (o.brk || 0) + 1;
        return {ok: true};
    }
    function starCost(o) { return o.star >= MAX_STAR ? null : STAR_COST[o.star + 1]; }
    function starUp(S, id) {
        const o = S.heroes[id], c = starCost(o);
        if (!c) return {ok: false, reason: '已經滿星'};
        if (o.shards < c) return {ok: false, reason: `碎片不足（${o.shards} / ${c}）`};
        o.shards -= c; o.star++;
        // 升到滿星後，剩下的碎片轉成星塵
        if (o.star >= MAX_STAR && o.shards > 0) { S.currency.dust = (S.currency.dust || 0) + o.shards; o.shards = 0; }
        return {ok: true};
    }
    function skillCost(lv) { return lv >= MAX_SKILL ? null : SKILL_COST[lv + 1]; }
    function skillUp(S, id, which) {   // which：'sk' 小技能、'ul' 大招
        const o = S.heroes[id];
        const lv = o[which] || 1, c = skillCost(lv);
        if (!c) return {ok: false, reason: '已經是最高級'};
        if (!has(S, c)) return {ok: false, reason: '技能書或金幣不足'};
        pay(S, c); o[which] = lv + 1;
        return {ok: true};
    }
    // 覺醒：60 級、比起始星級多 1★，花覺醒石（依稀有度）與金幣
    // 覺醒要的星級：起始星級 +1（R 2★、SR 3★、SSR 4★、UR 5★）
    const awakenStar = id => startStar(id) + R.AWAKEN.starUp;
    function awakenCost(id) { return {awk: R.AWAKEN.cost[R.HEROES[id].rarity], gold: R.AWAKEN.gold}; }
    function awaken(S, id) {
        const o = S.heroes[id], A = R.AWAKEN;
        if (o.awk) return {ok: false, reason: '已經覺醒'};
        if (o.lv < A.lv || o.star < awakenStar(id)) return {ok: false, reason: `需要 Lv.${A.lv}、${awakenStar(id)}★`};
        const c = awakenCost(id);
        if (!has(S, c)) return {ok: false, reason: '覺醒石或金幣不足'};
        pay(S, c); o.awk = true;
        return {ok: true};
    }
    // 抽到重複英雄時呼叫：滿星的英雄碎片直接轉星塵。回傳實際給的 {shards, dust}
    function giveShards(S, id, n) {
        const o = S.heroes[id];
        if (o.star >= MAX_STAR) { S.currency.dust = (S.currency.dust || 0) + n; return {shards: 0, dust: n}; }
        o.shards += n;
        return {shards: n, dust: 0};
    }
    function buyShards(S, id, n) {
        const o = S.heroes[id];
        if (!o) return {ok: false, reason: '還沒擁有這位英雄'};
        if (o.star >= MAX_STAR) return {ok: false, reason: '已經滿星'};
        const price = n * DUST_PER_SHARD;
        if ((S.currency.dust || 0) < price) return {ok: false, reason: '星塵不足'};
        S.currency.dust -= price; o.shards += n;
        return {ok: true};
    }
    function buyItem(S, key) {
        const it = DUST_SHOP.find(x => x.key === key);
        if ((S.currency.dust || 0) < it.price) return {ok: false, reason: '星塵不足'};
        S.currency.dust -= it.price;
        S.currency[key] = (S.currency[key] || 0) + (it.count || 1);
        return {ok: true};
    }

    window.Growth = {
        MAX_LV, MAX_STAR, MAX_SKILL, LV_PCT, STAR_PCT, starPct, awakenStar, SKILL_PCT, STAR_COST, BREAK_COST, SKILL_COST, DUST_PER_SHARD, DUST_SHOP,
        lvCap, lvCost, breakCost, starCost, skillCost, startStar, mult, multipliers, stats, power,
        levelUp, breakThrough, starUp, skillUp, giveShards, buyShards, buyItem, awaken, awakenCost,
    };
})();
