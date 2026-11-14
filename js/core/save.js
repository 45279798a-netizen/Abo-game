// 本機存檔：玩家擁有的英雄、貨幣、隊伍、抽卡保底。存在瀏覽器 localStorage（之後第 5 階段再加雲端同步）。
// 存檔帶版本號 v，之後改格式時在 migrate() 補轉換。
(function () {
    const R = window.RES;
    const KEY = 'abo_s1_save';
    const VERSION = 1;

    // 開局：送 4 位英雄＋起始資源（新手 10 連抽另外給，見 gacha.js）
    const START = {
        heroes: ['arthur', 'elara', 'faye', 'dart'],
        team: ['arthur', 'faye', 'elara', 'dart', null],
        leader: 'arthur',
        // 經驗藥水、突破石、技能書先給一些試玩用的量；主線與掛機做好後改成從關卡取得
        currency: {gold: 60000, gem: 3000, ticket: 5, ltdTicket: 5, exp: 600, brk: 10, book: 10, dust: 0},
    };
    // 初始星級：R 1★、SR 2★、SSR 3★、UR 4★
    const START_STAR = {R: 1, SR: 2, SSR: 3, UR: 4};

    function fresh() {
        const s = {
            v: VERSION, created: Date.now(), name: '旅團長',
            heroes: {}, team: START.team.slice(), leader: START.leader,
            currency: {...START.currency},
            pity: {std: {sr: 0, ssr: 0}, ltd: {sr: 0, ur: 0}},
            newbieDone: false, pulls: 0,
        };
        START.heroes.forEach(id => addHero(s, id));
        return s;
    }

    function addHero(s, id) {
        if (s.heroes[id]) return false;
        s.heroes[id] = {lv: 1, brk: 0, star: START_STAR[R.HEROES[id].rarity] || 1, shards: 0, sk: 1, ul: 1, got: Date.now()};
        return true;
    }

    function migrate(s) {
        // 目前只有第 1 版；之後改格式在這裡把舊存檔轉成新格式
        s.v = VERSION;
        s.pity = s.pity || {std: {sr: 0, ssr: 0}, ltd: {sr: 0, ur: 0}};
        // 養成欄位（養成功能加入前的存檔沒有）
        for (const [k, v] of Object.entries(START.currency)) if (s.currency[k] == null) s.currency[k] = v;
        for (const o of Object.values(s.heroes)) { o.brk = o.brk || 0; o.sk = o.sk || 1; o.ul = o.ul || 1; }
        // 資料表刪掉的英雄從存檔移除
        for (const id of Object.keys(s.heroes)) if (!R.HEROES[id]) delete s.heroes[id];
        s.team = (s.team || []).map(id => (id && s.heroes[id]) ? id : null);
        while (s.team.length < 5) s.team.push(null);
        if (!s.heroes[s.leader]) s.leader = Object.keys(s.heroes)[0];
        return s;
    }

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) return migrate(JSON.parse(raw));
        } catch (e) { console.warn('存檔讀取失敗，建立新存檔', e); }
        const s = fresh();
        save(s);
        return s;
    }

    function save(s) {
        try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.warn('存檔寫入失敗', e); }
    }

    function reset() {
        try { localStorage.removeItem(KEY); } catch (e) { /* 無法存取 */ }
        return load();
    }

    window.Save = {load, save, reset, addHero, fresh, START_STAR, KEY};
})();
