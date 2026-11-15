// 每日任務、每週任務、通行證。規則在 js/core/quests.js。
// 目標：每天全做約 16～17 天練滿 50 級（2.5 週內）；落後「正常進度」時勳章加倍追趕。
window.RES = window.RES || {};

RES.QUESTS = {
    RESET_HOUR: 4,          // 每天凌晨 4 點重置；每週一凌晨 4 點重置每週任務
    // ev：觸發事件（js/core/quests.js 的 track）；n：要做幾次；medal：賽季勳章
    daily: [
        {id: 'idle', name: '領取掛機收益', ev: 'idle', n: 1, medal: 25},
        {id: 'battle', name: '戰鬥 3 次（主線或試煉）', ev: 'battle', n: 3, medal: 35},
        {id: 'gacha', name: '招募 1 次', ev: 'gacha', n: 1, medal: 25},
        {id: 'enhance', name: '強化裝備 1 次', ev: 'enhance', n: 1, medal: 25},
        {id: 'trial', name: '挑戰試煉 2 次', ev: 'trial', n: 2, medal: 35},
        {id: 'levelup', name: '英雄升級 1 次', ev: 'levelup', n: 1, medal: 25},
        {id: 'lich', name: '挑戰巫妖王試煉 1 次', ev: 'lich', n: 1, medal: 20, need: 45},   // need：主線進度到這裡才出現（沒開放的任務不算在「全部完成」裡）
    ],
    dailyBonus: {medal: 70, gem: 50},   // 每日任務全部完成
    weekly: [
        {id: 'w_stage', name: '主線首次通關 15 關', ev: 'firstClear', n: 15, medal: 120, reward: {gem: 100}},
        {id: 'w_gacha', name: '招募 10 次', ev: 'gacha', n: 10, medal: 100, reward: {ticket: 1}},
        {id: 'w_trial', name: '挑戰試煉 15 次', ev: 'trial', n: 15, medal: 100, reward: {stone: 60}},
        {id: 'w_enh9', name: '把一件裝備強化到 +9', ev: 'enhance9', n: 1, medal: 80, reward: {brk: 10}},
        {id: 'w_tower', name: '亡靈之塔通關 3 層', ev: 'tower', n: 3, medal: 60, reward: {badge: 150}, need: 45},
        {id: 'w_daily', name: '完成每日任務 5 天', ev: 'dailyDone', n: 5, medal: 100, reward: {ltdTicket: 1}},
    ],
    // 通行證
    pass: {
        levels: 50,
        perLevel: 100,              // 每級 100 勳章
        pacePerDay: 280,            // 正常進度：每天 280 勳章；落後超過一天就加倍追趕
        finalHero: 'mortheus',
        chestPer: 100,              // 50 級之後，每 100 勳章開一個寶箱
        chest: {gold: 8000, exp: 30, stone: 25, dust: 20},
    },
};

// 通行證每一級的獎勵：每 5 級大獎，第 50 級莫瑟斯，其他輪流給素材
RES.QUESTS.pass.rewards = (function () {
    const out = [];
    const small = [{gold: 6000}, {exp: 40}, {stone: 40}, {brk: 5}, {book: 1}];
    const big = {
        5: {gem: 300, ticket: 2}, 10: {ltdTicket: 2, gem: 200}, 15: {gear: {q: 3}, gem: 200}, 20: {ltdTicket: 3, book: 3},
        25: {gem: 500, ticket: 3}, 30: {gear: {q: 4}, ltdTicket: 2}, 35: {gem: 500, book: 4}, 40: {ltdTicket: 5, dust: 200},
        45: {gear: {q: 4}, gem: 500}, 50: {hero: 'mortheus'},
    };
    for (let lv = 1; lv <= 50; lv++) out.push(big[lv] || small[(lv - 1) % small.length]);
    return out;
})();
