// 招募（抽卡）。機率與保底照設計文件：
//   常駐池：R 55%、SR 35%、SSR 10%；每 10 抽必出 SR 以上；50 抽內必出 SSR
//   S1 限定池：R 50%、SR 35%、SSR 13%、UR 2%（UR＝烏瑟）；每 10 抽必出 SR 以上；80 抽必出烏瑟，保底整個賽季延續
//   新手招募：免費 10 連抽一次，必出至少 1 隻 SSR（常駐池的英雄）
// 重複抽到的英雄轉成碎片：R 10、SR 20、SSR 40、UR 80（滿星的英雄改給同數量的星塵）
(function () {
    const R = window.RES;

    const POOLS = {
        newbie: {name: '新手招募', rates: {R: 0.55, SR: 0.35, SSR: 0.10}, cost: null, once: true},
        std:    {name: '常駐招募', rates: {R: 0.55, SR: 0.35, SSR: 0.10}, cost: {ticket: 1, gem: 150}, ssrPity: 50},
        ltd:    {name: 'S1 限定招募・聖光使者', rates: {R: 0.50, SR: 0.35, SSR: 0.13, UR: 0.02}, cost: {ltdTicket: 1, gem: 150}, urPity: 80, featured: 'uther'},
    };
    const SHARDS = {R: 10, SR: 20, SSR: 40, UR: 80};
    // 不在一般卡池的英雄：限定 UR 與通行證 UR
    const EXCLUDE = new Set(['uther', 'mortheus']);
    const ORDER = ['R', 'SR', 'SSR', 'UR'];

    function heroesOf(rarity, pool) {
        if (rarity === 'UR') return [POOLS[pool].featured || 'uther'];
        return Object.keys(R.HEROES).filter(id => R.HEROES[id].rarity === rarity && !EXCLUDE.has(id));
    }

    function rollRarity(pool, pity, rand) {
        const rates = POOLS[pool].rates;
        let x = rand(), acc = 0, r = 'R';
        for (const k of ['UR', 'SSR', 'SR', 'R']) {
            if (!rates[k]) continue;
            acc += rates[k];
            if (x < acc) { r = k; break; }
        }
        if (pool === 'ltd') {
            if (pity.ur >= POOLS.ltd.urPity - 1) r = 'UR';
        } else if (pool === 'std' && pity.ssr >= POOLS.std.ssrPity - 1 && ORDER.indexOf(r) < 2) r = 'SSR';
        if (pity.sr >= 9 && r === 'R') r = 'SR';
        return r;
    }

    // 抽 n 次：回傳 [{id, rarity, isNew, shards}]，並直接改動存檔 s（扣費由 pay() 先處理）
    function pull(s, pool, n, rand = Math.random) {
        const key = pool === 'ltd' ? 'ltd' : 'std';
        const pity = s.pity[key];
        const out = [];
        for (let i = 0; i < n; i++) {
            let rarity = rollRarity(pool, pity, rand);
            // 新手招募：最後一抽還沒出 SSR 就保證 SSR
            if (pool === 'newbie' && i === n - 1 && !out.some(o => o.rarity === 'SSR')) rarity = 'SSR';
            const list = heroesOf(rarity, pool);
            const id = list[Math.floor(rand() * list.length)];
            // 保底計數
            pity.sr = ORDER.indexOf(rarity) >= 1 ? 0 : pity.sr + 1;
            if (key === 'std') pity.ssr = rarity === 'SSR' ? 0 : pity.ssr + 1;
            else pity.ur = rarity === 'UR' ? 0 : pity.ur + 1;
            const isNew = window.Save.addHero(s, id);
            let shards = 0, dust = 0;
            if (!isNew) {
                // 滿星的英雄：碎片直接轉成星塵（見 growth.js）
                const g = window.Growth ? window.Growth.giveShards(s, id, SHARDS[rarity]) : (s.heroes[id].shards += SHARDS[rarity], {shards: SHARDS[rarity], dust: 0});
                shards = g.shards; dust = g.dust;
            }
            out.push({id, rarity, isNew, shards, dust});
        }
        s.pulls += n;
        if (pool === 'newbie') s.newbieDone = true;
        return out;
    }

    // 扣費：先用券，券不夠再用鑽石。回傳 {ok, use: {ticket, gem}}
    function price(s, pool, n) {
        const c = POOLS[pool].cost;
        if (!c) return {ok: !(POOLS[pool].once && s.newbieDone), use: {}};
        const tKey = Object.keys(c).find(k => k !== 'gem');
        const tickets = Math.min(s.currency[tKey] || 0, n);
        const gem = (n - tickets) * c.gem;
        return {ok: (s.currency.gem || 0) >= gem, use: {[tKey]: tickets, gem}};
    }
    function pay(s, pool, n) {
        const p = price(s, pool, n);
        if (!p.ok) return false;
        for (const [k, v] of Object.entries(p.use)) s.currency[k] -= v;
        return true;
    }

    window.Gacha = {POOLS, SHARDS, pull, price, pay, heroesOf};
})();
