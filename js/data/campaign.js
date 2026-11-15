// 主線：10 章 × 15 關。一般關卡依章節的敵人池自動組隊（同一關每次都一樣），每章第 15 關是章節首領。
// 難度：敵人能力 × power(關卡序號)，曲線在 RES.CAMPAIGN.curve 調整，平衡用 tools/sim_campaign.js 檢查。
// 劇情：每章開頭（start）與首領戰前（boss）各一段對話；who 是英雄 id、敵人 id 或 'narrator'。
window.RES = window.RES || {};

RES.CAMPAIGN = {
    stagesPerChapter: 15,
    curve: {base: 0.8, lin: 0.0248, quad: 0.0025, bossMult: 0.85, eliteMult: 1.0},   // power(i) = base × (1 + lin·(i-1)) × (1 + quad·(i-1))，大致跟著玩家養成走
    // 星級：1★ 通關、2★ 無人陣亡、3★ 在 rounds 回合內通關
    rounds: {normal: 8, elite: 10, boss: 16},
    chests: [{stars: 15, reward: {gem: 100, book: 1, ticket: 1}}, {stars: 30, reward: {gem: 150, book: 2, brk: 5}}, {stars: 45, reward: {gem: 300, book: 3, ltdTicket: 1}}],
    chapters: [
        {
            name: '邊境的異變', bgHD: 'border', pool: ['slime', 'wolf', 'goblin', 'skeleton'], elites: ['gargoyle'], boss: 'boneKnight', size: 3,
            story: {
                start: [
                    ['narrator', '獅心王國東方邊境。一夜之間，村莊的墓地被翻開，死者爬出了土。'],
                    ['arthur', '村民都撤到城牆後面了嗎？'],
                    ['elara', '還有幾戶住在河邊。亞瑟，那邊的地面……在動。'],
                    ['arthur', '亡靈？這裡離北方的冰冠要塞可遠得很。'],
                    ['elara', '不只亡靈，連森林裡的魔物都被驚動了。我們得先清出一條路。'],
                    ['arthur', '好。全員列陣，跟緊我的盾。'],
                ],
                boss: [
                    ['narrator', '墓地深處，一名身披殘甲的騎士緩緩起身。'],
                    ['boneKnight', '……守……護……王……國……'],
                    ['arthur', '那套盔甲，是三十年前戰死的王國騎士團！'],
                    ['elara', '他的靈魂被某種力量拘束住了。讓他安息吧。'],
                ],
            },
        },
        {
            name: '王國出兵', bgHD: 'border', pool: ['skeleton', 'goblin', 'cryptBat', 'corpseBomber'], elites: ['warlord'], boss: 'warlordBoss', size: 4,
            story: {
                start: [
                    ['narrator', '騎士的遺骸裡，藏著一塊刻有綠色符文的骨片。'],
                    ['zeke', '這是死靈術的印記，而且是很古老的那種。'],
                    ['arthur', '國王已經下令出兵。我們是先鋒，要把邊境的亡靈全部擋下。'],
                    ['reina', '終於輪到我上場了！燒乾淨就對了吧？'],
                    ['zeke', '小心屍爆怪，別讓它們靠近後排。'],
                ],
                boss: [
                    ['warlordBoss', '活人的軍隊……正好，給我的部隊補充新兵。'],
                    ['reina', '你說話了？亡靈也會說話？'],
                    ['zeke', '能說話代表有人在背後操縱。打倒他，就能逼出幕後的人。'],
                    ['arthur', '王國的旗幟不會倒下。全軍，衝鋒！'],
                ],
            },
        },
        {
            name: '翠林的低語', bgHD: 'forest', pool: ['spider', 'wolf', 'slime', 'cryptBat'], elites: ['gargoyle'], boss: 'spiderQueen', size: 4,
            story: {
                start: [
                    ['narrator', '綠色符文指向東方的翠林。精靈的森林，向來不歡迎人類。'],
                    ['faye', '停下。再往前一步，我的箭就不會偏了。'],
                    ['arthur', '我們追著亡靈來的，不是來找麻煩的。'],
                    ['lyra', '菲，他們身上有聖光的氣息……而且，森林最近真的生病了。'],
                    ['faye', '……好吧。蜘蛛們發狂了，連精靈都不敢靠近巢穴。你們幫忙清巢，我就帶路。'],
                ],
                boss: [
                    ['narrator', '巢穴深處，巨大的蛛后身上滲著綠色的膿液。'],
                    ['lyra', '牠被瘟疫感染了，原本只是守護森林的古老生物啊。'],
                    ['faye', '瘟疫是從北邊流過來的。先讓牠解脫吧。'],
                    ['spiderQueen', '嘶——嘶——！'],
                ],
            },
        },
        {
            name: '瘟疫之源', bgHD: 'forest', pool: ['spider', 'skeleton', 'cultist', 'corpseBomber'], elites: ['plagueBringer'], boss: 'plagueBoss', size: 5,
            story: {
                start: [
                    ['gaia', '大地在哀號。根系一路枯到北方，有人在森林裡散播瘟疫。'],
                    ['elara', '那些穿黑袍的人……是邪教徒，他們在替亡靈做事。'],
                    ['zeke', '找到散播瘟疫的源頭，把它燒掉。'],
                    ['faye', '翠林盟約會跟你們一起走。這也是我們的森林。'],
                ],
                boss: [
                    ['plagueBoss', '呵呵呵……多美的腐爛。巫妖王陛下會很滿意的。'],
                    ['elara', '巫妖王……傳說中被封在冰冠要塞的死靈之王？'],
                    ['plagueBoss', '封印？早就鬆動啦。你們很快就會成為他的士兵。'],
                    ['gaia', '先成為我的養分吧。'],
                ],
            },
        },
        {
            name: '荒原的部族', bgHD: 'tundra', pool: ['wolf', 'goblin', 'lavaGolem', 'imp'], elites: ['gargoyle'], boss: 'sandWorm', size: 5,
            story: {
                start: [
                    ['narrator', '要前往冰冠要塞，必須穿越北方荒原。這裡由各個部族割據。'],
                    ['thorin', '人類、精靈、還有聖光那群人？今天是什麼日子，全都跑來荒原了。'],
                    ['arthur', '巫妖王要甦醒了。我們需要荒原部族的力量。'],
                    ['gideon', '想要我們的力量？先證明你們配得上。'],
                    ['fang', '最近荒原的魔物多到不正常。幫我們清掉，我們就聽你說。'],
                ],
                boss: [
                    ['narrator', '大地裂開，一條巨大的沙蟲從地底竄出。'],
                    ['thorin', '就是這傢伙！吃了我們三個村子的鐵礦和人！'],
                    ['noah', '牠身上也有綠色的符文。巫妖王把手伸進荒原了。'],
                    ['gideon', '哈！終於有個夠大的對手了！'],
                ],
            },
        },
        {
            name: '冰霜的使者', bgHD: 'tundra', pool: ['skeleton', 'frostLich', 'gargoyle', 'cultist'], elites: ['warlord'], boss: 'frostLichLord', size: 5,
            story: {
                start: [
                    ['noah', '荒原的冬天提早來了。冰霜巫妖在北邊的冰原建了據點。'],
                    ['thorin', '部族決定加入你們。荒原的人不怕冷，也不怕死。'],
                    ['arthur', '謝謝。等打完這仗，我請你們喝王國最好的酒。'],
                    ['thorin', '這句話我記住了！'],
                ],
                boss: [
                    ['frostLichLord', '凡人……踏入永凍之地者，皆為冰雕。'],
                    ['noah', '你凍住的是我族人的家園。今天換你嚐嚐冰的滋味。'],
                    ['zeke', '他身上的魔力連接著要塞……打倒他，或許能找到進去的路。'],
                ],
            },
        },
        {
            name: '暗夜之城', bgHD: 'nightcity', pool: ['imp', 'cultist', 'cryptBat', 'spider'], elites: ['plagueBringer'], boss: 'voidFiend', size: 5,
            story: {
                start: [
                    ['narrator', '冰冠要塞的入口被結界封住。唯一知道解法的，是暗夜之城的地下勢力。'],
                    ['draven', '情報？當然有。價錢嘛……看你們出得起多少。'],
                    ['elara', '巫妖王甦醒的話，你們的城也會被吞掉。'],
                    ['lilith', '說得對。不過城裡最近有東西在吃人……幫我們處理掉，情報就是你們的。'],
                    ['shadow', '……那東西，從虛空裡來。'],
                ],
                boss: [
                    ['narrator', '城市的最底層，空間像布一樣被撕開。'],
                    ['voidFiend', '……更多……靈魂……'],
                    ['shadow', '就是它。刀砍不到，影子也吞不掉。'],
                    ['zeke', '那就用雷劈。虛空的東西最怕純粹的力量。'],
                ],
            },
        },
        {
            name: '墮落之王', bgHD: 'nightcity', pool: ['imp', 'cultist', 'gargoyle', 'corpseBomber', 'skeleton'], elites: ['warlord'], boss: 'fallenLord', size: 5,
            story: {
                start: [
                    ['mortheus', '你們就是到處壞巫妖王好事的那群人？'],
                    ['arthur', '你是誰？'],
                    ['mortheus', '夜魘收割者，莫瑟斯。我收割靈魂——不管是活人的，還是死人的。'],
                    ['lilith', '他是暗夜結社的人，但不聽任何人的命令。'],
                    ['mortheus', '巫妖王搶了我的獵物。這一次，我站你們這邊。前提是，你們別拖我後腿。'],
                ],
                boss: [
                    ['fallenLord', '收割者，你竟然跟活人聯手？'],
                    ['mortheus', '我只是比較討厭你而已。'],
                    ['fallenLord', '巫妖王賜予我永恆的力量。你們都會跪在我面前。'],
                    ['arthur', '王國的騎士只跪國王。動手！'],
                ],
            },
        },
        {
            name: '冰冠要塞', bgHD: 'icefort', pool: ['skeleton', 'frostLich', 'lavaGolem', 'cryptBat'], elites: ['plagueBringer', 'warlord'], boss: 'boneDragon', size: 5,
            story: {
                start: [
                    ['narrator', '靠著暗夜之城的情報，結界被打開了。冰冠要塞就在眼前。'],
                    ['uther', '終於走到這裡了。三十年前，我們沒能徹底消滅他。'],
                    ['elara', '烏瑟大人！您怎麼會在這裡？'],
                    ['uther', '聖光教團不會再讓同樣的事發生第二次。這一次，我與你們同行。'],
                    ['arthur', '有您在，我們一定能贏。'],
                ],
                boss: [
                    ['narrator', '要塞的中庭，一具巨龍的骸骨展開雙翼。'],
                    ['uther', '那是三十年前戰死的紅龍……連牠都被做成了亡靈。'],
                    ['reina', '火龍變骨龍？那我就用更猛的火燒回去！'],
                    ['boneDragon', '吼——！'],
                ],
            },
        },
        {
            name: '巫妖王', bgHD: 'icefort', bossBgHD: 'throne', pool: ['frostLich', 'corpseBomber', 'gargoyle', 'cultist', 'skeleton'], elites: ['warlord', 'plagueBringer'], boss: 'lichKing', size: 5,
            story: {
                start: [
                    ['narrator', '要塞的最深處傳來冰冷的心跳。整座冰冠，都是巫妖王的身體。'],
                    ['zeke', '王座就在上面。所有的綠色符文，都連到那裡。'],
                    ['faye', '翠林、荒原、暗夜、王國、教團……五個陣營都到齊了。'],
                    ['arthur', '這一戰結束後，我們都回家。'],
                ],
                boss: [
                    ['lichKing', '活人的光，真是刺眼。三十年了，烏瑟。你老了。'],
                    ['uther', '而你還是一樣，只會躲在死人後面。'],
                    ['lichKing', '躲？整片大陸，都會成為我的軍隊。'],
                    ['arthur', '不會的。因為我們會在這裡阻止你。'],
                    ['narrator', '最終決戰，開始。'],
                ],
            },
        },
    ],
};

(function () {
    const R = window.RES;
    const C = R.CAMPAIGN;
    const N = C.stagesPerChapter;

    const idxOf = (ch, st) => (ch - 1) * N + st;            // 1～150
    // 玩家打到第 i 關時的「預期養成」：校準難度（tools/calibrate_campaign.js）與推薦戰力都用它
    const expected = i => ({lv: Math.min(100, Math.round(1 + i * 0.62)), star: Math.floor(i / 60), sk: Math.min(5, 1 + Math.floor(i / 40))});
    const REF_TEAM = ['arthur', 'reina', 'zeke', 'elara', 'faye'];
    // 校準表是「參考隊伍剛好在預期養成」的強度；實際再打個折：整體 ×0.92，前 2 章再更簡單（開局只有初始英雄）
    const ease = i => 0.92 * (i < 30 ? 0.55 + 0.45 * (i - 1) / 29 : 1);
    const key = (ch, st) => `${ch}-${st}`;
    const power = i => C.curve.base * (1 + C.curve.lin * (i - 1)) * (1 + C.curve.quad * (i - 1));
    const kindOf = st => st === N ? 'boss' : (st % 5 === 0 ? 'elite' : 'normal');

    function rng(seed) {
        let a = seed >>> 0;
        return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }

    // 關卡內容（同一關每次都一樣）
    function stage(ch, st) {
        const c = C.chapters[ch - 1];
        const i = idxOf(ch, st), kind = kindOf(st);
        const r = rng(i * 9973 + 17);
        const pick = list => list[Math.floor(r() * list.length)];
        // 前排放坦克、戰士，後排放其他
        const frontish = id => ['tank', 'warrior'].includes(R.ENEMIES[id].role);
        let units = [];
        const size = Math.min(5, c.size + (st >= 8 && c.size < 5 ? 1 : 0));
        if (kind === 'boss') {
            units.push(c.boss);
            const adds = Math.max(1, Math.min(3, Math.floor(size / 2)));
            for (let k = 0; k < adds; k++) units.push(pick(c.pool));
        } else {
            if (kind === 'elite') units.push(pick(c.elites));
            while (units.length < size) units.push(pick(c.pool));
        }
        // 分前後排：首領佔後排中間；前排最多 2
        const front = [], back = [];
        for (const id of units) {
            const boss = R.ENEMIES[id].boss;
            if (boss) { back.push(id); continue; }
            (frontish(id) && front.length < 2 ? front : (back.length < 3 ? back : front)).push(id);
        }
        while (front.length > 2) back.push(front.pop());
        if (!front.length && back.length > 1) front.push(back.find(id => !R.ENEMIES[id].boss) && back.splice(back.findIndex(id => !R.ENEMIES[id].boss), 1)[0]);
        // 敵人強度與 3 星回合數：優先用校準表（tools/calibrate_campaign.js 產生），沒有就用公式
        const T = window.CAMPAIGN_TABLE && window.CAMPAIGN_TABLE[key(ch, st)];
        const p = T ? T[0] * ease(i) : power(i) * (kind === 'boss' ? C.curve.bossMult : kind === 'elite' ? C.curve.eliteMult : 1);
        return {
            id: 'c' + key(ch, st), key: key(ch, st), ch, st, idx: i, kind,
            name: kind === 'boss' ? `${R.ENEMIES[c.boss].name}` : `${c.name} ${st}`,
            difficulty: kind === 'boss' ? '章節首領' : kind === 'elite' ? '菁英' : '一般',
            power: p, hpPower: T ? T[2] : p, front: front.filter(Boolean), back,
            bgHD: kind === 'boss' && c.bossBgHD ? c.bossBgHD : c.bgHD,
            rounds: T ? T[1] : C.rounds[kind],
        };
    }

    // 推薦戰力：校準用的參考隊伍在預期養成下的戰力（需要 Growth，只在大廳用）
    function recommend(ch, st) {
        const e = expected(idxOf(ch, st));
        const gb = window.Gear ? window.Gear.expectedBonus(idxOf(ch, st)) : null;
        const sum = REF_TEAM.reduce((a, id) => a + window.Growth.power(id, {lv: e.lv, star: window.Save.START_STAR[R.HEROES[id].rarity] + e.star, sk: e.sk, ul: e.sk}, gb), 0);
        return Math.round(sum / 100) * 100;
    }

    function firstReward(ch, st) {
        const i = idxOf(ch, st), kind = kindOf(st);
        if (kind === 'boss') return {gem: 150, gold: 4000 + i * 80, exp: 30 + Math.round(i * 0.35), brk: 6, book: 2, ltdTicket: 1};
        if (kind === 'elite') return {gem: 50, gold: 1200 + i * 45, exp: 15 + Math.round(i * 0.25), brk: 2, book: 1};
        return {gem: 30, gold: 600 + i * 30, exp: 8 + Math.round(i * 0.18)};
    }
    // 重打／掃蕩：沒有鑽石，金幣與藥水少一點
    function repeatReward(ch, st) {
        const i = idxOf(ch, st), kind = kindOf(st);
        const k = kind === 'boss' ? 2.5 : kind === 'elite' ? 1.5 : 1;
        return {gold: Math.round((250 + i * 12) * k), exp: Math.round((3 + i * 0.12) * k)};
    }

    // 戰鬥結果寫回存檔：回傳 {stars, newStars, first, reward}
    function settle(S, ch, st, win, info) {
        S.campaign = S.campaign || {stars: {}, chests: {}, story: {}};
        const k = key(ch, st), s = stage(ch, st);
        if (!win) { window.Quests && window.Quests.track(S, 'battle'); return {stars: 0, first: false, reward: {}}; }
        let stars = 1;
        if (info.noDeath) stars++;
        if (info.rounds <= s.rounds) stars++;
        const prev = S.campaign.stars[k] || 0;
        const first = !prev;
        const reward = R.applyDrop ? R.applyDrop(first ? firstReward(ch, st) : repeatReward(ch, st)) : (first ? firstReward(ch, st) : repeatReward(ch, st));
        S.campaign.stars[k] = Math.max(prev, stars);
        window.Quests && window.Quests.track(S, 'battle'); if (first) window.Quests && window.Quests.track(S, 'firstClear');
        for (const [c, v] of Object.entries(reward)) S.currency[c] = (S.currency[c] || 0) + v;
        return {stars, newStars: Math.max(0, stars - prev), first, reward};
    }
    // 掃蕩：3 星關卡直接領重打獎勵，每天共 SWEEP_PER_DAY 次（沒有體力，用次數限制）
    const SWEEP_PER_DAY = 30;
    function sweepLeft(S, now = Date.now()) {
        S.campaign = S.campaign || {stars: {}, chests: {}, story: {}};
        const day = new Date(now).toDateString();
        if (S.campaign.sweepDay !== day) { S.campaign.sweepDay = day; S.campaign.sweepUsed = 0; }
        return SWEEP_PER_DAY - (S.campaign.sweepUsed || 0);
    }
    function sweep(S, ch, st, times = 1) {
        const k = key(ch, st);
        if ((S.campaign?.stars[k] || 0) < 3) return {ok: false, reason: '3 星通關後才能掃蕩'};
        times = Math.min(times, sweepLeft(S));
        if (times <= 0) return {ok: false, reason: '今天的掃蕩次數用完了'};
        S.campaign.sweepUsed = (S.campaign.sweepUsed || 0) + times;
        window.Quests && window.Quests.track(S, 'battle', times);
        const total = {};
        for (let n = 0; n < times; n++) for (const [c, v] of Object.entries(repeatReward(ch, st))) total[c] = (total[c] || 0) + v;
        for (const [c, v] of Object.entries(total)) S.currency[c] = (S.currency[c] || 0) + v;
        return {ok: true, reward: total, times};
    }
    // 進度：已通關的最高關卡序號（0＝還沒過任何關）
    function progress(S) {
        let best = 0;
        for (const k of Object.keys(S.campaign?.stars || {})) { const [c, s] = k.split('-').map(Number); best = Math.max(best, idxOf(c, s)); }
        return best;
    }
    const unlocked = (S, ch, st) => idxOf(ch, st) <= progress(S) + 1;
    const chapterStars = (S, ch) => { let n = 0; for (let st = 1; st <= N; st++) n += S.campaign?.stars[key(ch, st)] || 0; return n; };
    function openChest(S, ch, i) {
        const c = C.chests[i];
        S.campaign = S.campaign || {stars: {}, chests: {}, story: {}};
        const ck = `${ch}:${i}`;
        if (S.campaign.chests[ck]) return {ok: false, reason: '已經領過了'};
        if (chapterStars(S, ch) < c.stars) return {ok: false, reason: `需要 ${c.stars} 顆星`};
        S.campaign.chests[ck] = true;
        for (const [k, v] of Object.entries(c.reward)) S.currency[k] = (S.currency[k] || 0) + v;
        return {ok: true, reward: c.reward};
    }

    // ───────── 掛機 ─────────
    const IDLE_MAX_H = 12;
    // 每小時收益：依最高通關關卡
    function idleRate(S) {
        const i = progress(S);
        // 打完第 1 章（裝備解鎖）後，掛機也給強化石、偶爾掉散件裝備
        const gear = i >= 15;
        return {gold: 250 + i * 20, exp: 2 + i * 0.12, brk: 0.04 + i * 0.002, stone: gear ? 1 + i * 0.03 : 0, gearPerH: gear ? 0.25 : 0};
    }
    const idleReward = (r, h) => ({gold: Math.floor(r.gold * h), exp: Math.floor(r.exp * h), brk: Math.floor(r.brk * h), stone: Math.floor(r.stone * h)});
    // 掛機掉的散件：沒有套裝，品質依最高通關的章節
    function idleGear(S, h, rand = Math.random) {
        const r = idleRate(S), out = [];
        if (!r.gearPerH || !window.Gear) return out;
        let n = Math.floor(r.gearPerH * h + rand());
        const floor = Math.max(1, Math.floor(progress(S) / 15));
        while (n-- > 0) out.push(window.Gear.make(S, rand, {q: Math.min(3, window.Gear.rollQuality(rand, floor))}));
        return out;
    }
    function idlePending(S, now = Date.now()) {
        S.idle = S.idle || {last: now, quickDay: '', quickUsed: 0};
        const h = Math.min(IDLE_MAX_H, (now - S.idle.last) / 3600000);
        const r = idleRate(S);
        return {hours: h, reward: idleReward(r, h)};
    }
    function idleClaim(S, now = Date.now()) {
        const p = idlePending(S, now);
        for (const [k, v] of Object.entries(p.reward)) S.currency[k] = (S.currency[k] || 0) + v;
        S.idle.last = now;
        window.Quests && window.Quests.track(S, 'idle');
        p.gear = idleGear(S, p.hours);
        return p;
    }
    // 快速掛機：立即領 2 小時。每天免費 1 次，之後 50、100 鑽石各 1 次
    const QUICK_COST = [0, 50, 100];
    function quickInfo(S, now = Date.now()) {
        S.idle = S.idle || {last: now, quickDay: '', quickUsed: 0};
        const day = new Date(now).toDateString();
        if (S.idle.quickDay !== day) { S.idle.quickDay = day; S.idle.quickUsed = 0; }
        const used = S.idle.quickUsed;
        return {left: QUICK_COST.length - used, cost: used < QUICK_COST.length ? QUICK_COST[used] : null};
    }
    function quickIdle(S, now = Date.now()) {
        const q = quickInfo(S, now);
        if (q.cost == null) return {ok: false, reason: '今天的快速掛機已用完'};
        if ((S.currency.gem || 0) < q.cost) return {ok: false, reason: '鑽石不足'};
        S.currency.gem -= q.cost;
        S.idle.quickUsed++;
        window.Quests && window.Quests.track(S, 'idle');
        const r = idleRate(S);
        const reward = idleReward(r, 2);
        for (const [k, v] of Object.entries(reward)) S.currency[k] = (S.currency[k] || 0) + v;
        return {ok: true, reward, gear: idleGear(S, 2)};
    }

    window.Campaign = {stage, recommend, expected, REF_TEAM, firstReward, repeatReward, settle, sweep, progress, unlocked, chapterStars, openChest, idxOf, key, kindOf, power,
        sweepLeft, SWEEP_PER_DAY, idleRate, idlePending, idleClaim, quickInfo, quickIdle, IDLE_MAX_H, N};
})();
