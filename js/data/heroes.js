// 英雄資料。戰鬥原型先放 4 個陣營 × 3 隻 = 12 隻。
//
// 技能效果（effects）是一串依序執行的效果，每個效果有 target：
//   enemy（單體，依站位規則選）、enemies（敵方全體）、enemyFront（敵方前排）、
//   enemyLowest（生命比例最低）、enemyLowest2、enemyRandom2、
//   self、allies（我方全體）、allyLowest、allyOthers、trigger（合體技觸發者）、
//   same（沿用上一個效果的目標）
// 效果類型：damage / heal / shield / push（推條）/ pull（拉條）/ status / cleanse / summon
// vfx：技能特效，可以是一個或一串（依序播放的多段特效）。每段：
//      id 特效庫 id；at 對準 targets 打到的目標（預設）／foes 對手全體中心／friends 自己隊伍中心／self 自己；
//      each:true 每個目標各放一個；hit:n 這段命中時跳第 n 下傷害（配合 effects 裡 damage 的 hits 多段比例）；ticks:[…]＋tick:毫秒 同一段之後每隔 tick 再跳這幾下（吸取、持續光束）；delay 延後毫秒；main:true 這段命中時才跳傷害（沒標就用第一段）；
//      sky:true 光束從天而降；pull:毫秒 目標被吸向特效中心；dark:毫秒 畫面周圍變暗；reverse:true 飛行／光束從目標飛回施放者；color 顏色；size 大小倍率；speed 播放速度倍率。
// ult：大招（能量滿 100 時放），格式同 skill；impactFrame 命中時畫面定格。
// show：整段技能演出的長度（毫秒，1500～3500），依特效長短決定；沒填 vfx 的技能用 2D 特效。
// faceY：立繪切入時臉往上移多少（%），有翅膀或頭頂裝飾比較高的角色才需要
window.RES = window.RES || {};

RES.RARITY = {
    R:   {name: 'R',   mult: 0.82, color: '#9ca3af'},
    SR:  {name: 'SR',  mult: 0.90, color: '#60a5fa'},
    SSR: {name: 'SSR', mult: 1.00, color: '#f59e0b'},
    UR:  {name: 'UR',  mult: 1.12, color: '#ef4444'},
};

// 職業基礎能力（SSR、原型等級）
RES.ROLES = {
    tank:     {name: '坦克', hp: 3300, atk: 170, def: 200, spd: 92},
    warrior:  {name: '戰士', hp: 2400, atk: 250, def: 140, spd: 102},
    mage:     {name: '法師', hp: 1800, atk: 280, def: 95,  spd: 104},
    archer:   {name: '射手', hp: 1850, atk: 270, def: 95,  spd: 108},
    assassin: {name: '刺客', hp: 1750, atk: 265, def: 90,  spd: 118},
    support:  {name: '輔助', hp: 2000, atk: 200, def: 115, spd: 112},
};

RES.HEROES = {
    // ───────── 獅心王國 ─────────
    arthur: {
        name: '重裝鐵衛·亞瑟', rarity: 'SR', faction: 'kingdom', element: 'water', role: 'tank', img: 'h_arthur',
        skill: {
            name: '堅盾號令', cd: 2, show: 2000, vfx: [{id: 'prism-guard', at: 'self', color: '#60a5fa', main: true}, {id: 'shockwave', at: 'self', color: '#93c5fd', delay: 250}], desc: '嘲諷敵人 2 回合，並獲得最大生命 20% 的護盾',
            effects: [
                {type: 'status', target: 'self', status: 'taunt', turns: 2, chance: 1},
                {type: 'shield', target: 'self', pctMaxHp: 0.20},
            ],
        },
        ult: {
            name: '獅王壁壘', desc: '全隊獲得最大生命 20% 的護盾，自己嘲諷 2 回合',
            show: 3600, vfx: [{id: 'astral-gate', at: 'friends', color: '#93c5fd'}, {id: 'prism-guard', at: 'friends', color: '#60a5fa', delay: 600, main: true}, {id: 'magic-barrier', at: 'self', color: '#60a5fa', delay: 900}],
            effects: [
                {type: 'shield', target: 'allies', pctMaxHp: 0.20},
                {type: 'status', target: 'self', status: 'taunt', turns: 2, chance: 1},
            ],
        },
        passive: {name: '鐵壁', desc: '防禦 +25%', type: 'statUp', stat: 'def', pct: 0.25},
    },
    reina: {
        name: '烈焰騎士·蕾娜', rarity: 'SSR', faction: 'kingdom', element: 'fire', role: 'warrior', img: 'h_reina',
        skill: {
            name: '烈焰突擊', cd: 2, show: 2200, vfx: [{id: 'flame-surge', main: true, hit: 0}, {id: 'burning-ground', delay: 350, hit: 1}], desc: '對敵方前排造成 150% 傷害（2 段），70% 機率燃燒 2 回合',
            effects: [
                {type: 'damage', target: 'enemyFront', mult: 1.5, hits: [0.6, 0.4]},
                {type: 'status', target: 'same', status: 'burn', turns: 2, chance: 0.7, dotMult: 0.3},
            ],
        },
        ult: {
            name: '焚天斬', desc: '對敵方前排造成 300% 傷害（3 段），90% 機率燃燒 2 回合',
            show: 3600, impactFrame: true, vfx: [{id: 'flame-surge', hit: 0}, {id: 'billowing-airburst', delay: 500, main: true, hit: 1}, {id: 'magma-fissure', delay: 800, hit: 2}],
            effects: [
                {type: 'damage', target: 'enemyFront', mult: 3.0, hits: [0.25, 0.45, 0.3]},
                {type: 'status', target: 'same', status: 'burn', turns: 2, chance: 0.9, dotMult: 0.35},
            ],
        },
        passive: {name: '乘勝追擊', desc: '擊倒敵人時，自己推條 30%', type: 'onKillPush', pct: 0.3},
    },
    valkyrie: {
        name: '聖殿衛士·瓦爾基里', rarity: 'SSR', faction: 'kingdom', element: 'light', role: 'tank', img: 'h_valkyrie', faceY: 14,
        skill: {
            name: '聖盾', cd: 3, show: 2600, vfx: [{id: 'radiant-beam', at: 'friends', sky: true, color: '#fde68a'}, {id: 'magic-barrier', at: 'friends', color: '#fde68a', delay: 300, main: true}], desc: '我方全體獲得自身最大生命 12% 的護盾，自己嘲諷 1 回合',
            effects: [
                {type: 'shield', target: 'allies', pctMaxHp: 0.12, ofCaster: true},
                {type: 'status', target: 'self', status: 'taunt', turns: 1, chance: 1},
            ],
        },
        ult: {
            name: '天穹聖域', desc: '全隊受到的傷害 -30%（2 回合）',
            show: 3600, vfx: [{id: 'radiant-beam', at: 'friends', sky: true, color: '#fde68a', size: 1.4}, {id: 'magic-barrier', at: 'friends', color: '#fde68a', delay: 500, main: true}, {id: 'prism-parry', at: 'friends', each: true, delay: 800, stagger: 90}],
            effects: [
                {type: 'status', target: 'allies', status: 'guard', turns: 2, chance: 1},
            ],
        },
        passive: {name: '衝鋒號角', desc: '戰鬥開始時，我方全體推條 10%', type: 'startPushAllies', pct: 0.10},
    },

    // ───────── 聖光教團 ─────────
    elara: {
        name: '祭司·艾拉', rarity: 'SR', faction: 'church', element: 'water', role: 'support', img: 'h_elara',
        skill: {
            name: '治癒之泉', cd: 2, show: 2400, vfx: [{id: 'healing-field', at: 'friends', main: true}, {id: 'revival-bloom', at: 'friends', delay: 450}], desc: '回復我方全體 200% 攻擊力的生命', healOnly: true,
            effects: [{type: 'heal', target: 'allies', mult: 2.0}],
        },
        ult: {
            name: '生命聖泉', desc: '回復我方全體 300% 攻擊力的生命，並淨化全部減益',
            show: 3800, vfx: [{id: 'sacred-relic-descent', at: 'friends', main: true}, {id: 'revival-bloom', at: 'friends', each: true, delay: 1500, stagger: 100}],
            effects: [
                {type: 'heal', target: 'allies', mult: 3.0},
                {type: 'cleanse', target: 'allies', count: 9},
            ],
        },
        passive: {name: '淨化之觸', desc: '普攻時，淨化一名隊友的 1 個減益', type: 'cleanseOnBasic'},
    },
    zeke: {
        name: '雷霆審判者·吉克', rarity: 'SSR', faction: 'church', element: 'wind', role: 'mage', img: 'h_zeke',
        skill: {
            name: '雷霆審判', cd: 2, show: 2800, vfx: [{id: 'arc-ray', at: 'foes', speed: 0.8, hit: 0}, {id: 'thunder-strike', at: 'foes', each: true, delay: 300, stagger: 160, main: true, hit: 1}], desc: '對敵方全體造成 90% 傷害（2 段），30% 機率減速 2 回合',
            effects: [
                {type: 'damage', target: 'enemies', mult: 0.9, hits: [0.35, 0.65]},
                {type: 'status', target: 'same', status: 'slow', turns: 2, chance: 0.3},
            ],
        },
        ult: {
            name: '萬雷天罰', desc: '對敵方全體造成 180% 傷害（3 段），50% 機率減速 2 回合',
            show: 3800, impactFrame: true, vfx: [{id: 'charged-beam', at: 'foes', color: '#93c5fd', hit: 0}, {id: 'thunder-strike', at: 'foes', each: true, delay: 600, stagger: 140, main: true, hit: 1}, {id: 'energy-burst', at: 'foes', delay: 1000, hit: 2}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.8, hits: [0.2, 0.5, 0.3]},
                {type: 'status', target: 'same', status: 'slow', turns: 2, chance: 0.5},
            ],
        },
        passive: {name: '驅魔', desc: '對亡靈天災傷害 +20%', type: 'dmgVsFaction', faction: 'undead', pct: 0.2},
    },
    seraph: {
        name: '大天使·熾', rarity: 'SSR', faction: 'church', element: 'light', role: 'support', img: 'h_seraph', faceY: 12,
        skill: {
            name: '聖光祝福', cd: 3, show: 2600, vfx: [{id: 'astral-gate', at: 'friends', color: '#ffd166'}, {id: 'energy-vortex', at: 'friends', color: '#ffd166', delay: 400, main: true}], desc: '我方全體推條 20%，攻擊 +20%（2 回合）',
            effects: [
                {type: 'push', target: 'allies', pct: 0.2},
                {type: 'status', target: 'allies', status: 'atkUp', turns: 2, chance: 1},
            ],
        },
        ult: {
            name: '熾天審判', desc: '對敵方全體造成 150% 傷害（2 段），我方全體攻擊 +20%（2 回合）',
            show: 4600, impactFrame: true, vfx: [{id: 'starblade-cataclysm', at: 'foes', main: true, hit: 0}, {id: 'starblade-explosion', at: 'foes', delay: 2250, hit: 1}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.5, hits: [0.6, 0.4]},
                {type: 'status', target: 'allies', status: 'atkUp', turns: 2, chance: 1},
            ],
        },
        passive: {name: '光之加護', desc: '我方全體效果抵抗 +15%', type: 'auraRes', pct: 0.15},
    },

    // ───────── 翠林盟約 ─────────
    lyra: {
        name: '吟遊詩人·萊拉', rarity: 'R', faction: 'forest', element: 'fire', role: 'support', img: 'h_lyra',
        skill: {
            name: '疾風樂章', cd: 2, show: 2600, vfx: [{id: 'painterly-grass', at: 'friends'}, {id: 'wind-vortex', at: 'friends', delay: 250, main: true}], desc: '我方全體加速（速度 +30%）2 回合',
            effects: [{type: 'status', target: 'allies', status: 'haste', turns: 2, chance: 1}],
        },
        ult: {
            name: '風之狂想曲', desc: '其他隊友推條 30%，我方全體加速 2 回合',
            show: 3400, vfx: [{id: 'dust-devil', at: 'friends', color: '#86efac'}, {id: 'wind-vortex', at: 'friends', delay: 400, main: true}, {id: 'spiral-gale', at: 'foes', delay: 900}],
            effects: [
                {type: 'push', target: 'allyOthers', pct: 0.3},
                {type: 'status', target: 'allies', status: 'haste', turns: 2, chance: 1},
            ],
        },
        passive: {name: '旅人之歌', desc: '行動後，隨機一名隊友推條 10%（優先同陣營）', type: 'pushAllyAfterTurn', pct: 0.10},
    },
    faye: {
        name: '精靈射手·菲', rarity: 'SR', faction: 'forest', element: 'wind', role: 'archer', img: 'h_faye',
        skill: {
            name: '纏藤箭', cd: 2, show: 2200, vfx: [{id: 'spiral-gale', color: '#86efac', main: true, hit: 0}, {id: 'thorn-crown', delay: 380, hit: 1}], desc: '對單體造成 170% 傷害（2 段），並拉條 30%',
            effects: [
                {type: 'damage', target: 'enemy', mult: 1.7, hits: [0.6, 0.4]},
                {type: 'pull', target: 'same', pct: 0.3},
            ],
        },
        ult: {
            name: '萬藤箭雨', desc: '對敵方全體造成 140% 傷害（3 段），並拉條 20%',
            show: 3600, vfx: [{id: 'electric-magic-arrow-strike', at: 'foes', each: true, stagger: 120, color: '#86efac', hit: 0}, {id: 'thorn-crown', at: 'foes', each: true, delay: 700, stagger: 100, main: true, hit: 1}, {id: 'binding-curse', at: 'foes', color: '#34d399', delay: 900, hit: 2}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.4, hits: [0.3, 0.45, 0.25]},
                {type: 'pull', target: 'same', pct: 0.2},
            ],
        },
        passive: {name: '鷹眼', desc: '暴擊率 +15%', type: 'statUp', stat: 'crit', flat: 0.15},
    },
    gaia: {
        name: '大地之母·蓋亞', rarity: 'SSR', faction: 'forest', element: 'water', role: 'tank', img: 'h_gaia',
        skill: {
            name: '大地之握', cd: 3, show: 2600, vfx: [{id: 'quicksand-seal', at: 'foes', main: true, hit: 0}, {id: 'shockwave', at: 'foes', delay: 450, hit: 1}], desc: '對敵方全體造成 70% 傷害（2 段），並拉條 15%',
            effects: [
                {type: 'damage', target: 'enemies', mult: 0.7, hits: [0.5, 0.5]},
                {type: 'pull', target: 'same', pct: 0.15},
            ],
        },
        ult: {
            name: '大地崩裂', desc: '對敵方全體造成 120% 傷害（2 段），拉條 20% 並減速 2 回合',
            show: 3600, vfx: [{id: 'tidal-surge', at: 'foes', main: true, hit: 0}, {id: 'magma-fissure', at: 'foes', each: true, delay: 500, stagger: 120, hit: 1}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.2, hits: [0.55, 0.45]},
                {type: 'pull', target: 'same', pct: 0.2},
                {type: 'status', target: 'same', status: 'slow', turns: 2, chance: 1},
            ],
        },
        passive: {name: '生生不息', desc: '每次行動開始時，回復最大生命 6%', type: 'regenOnTurn', pct: 0.06},
    },

    // ───────── 暗夜結社 ─────────
    dart: {
        name: '毒鏢客', rarity: 'R', faction: 'night', element: 'wind', role: 'assassin', img: 'h_dart',
        skill: {
            name: '淬毒飛鏢', cd: 2, show: 2000, vfx: [{id: 'arcane-missile', color: '#a3e635', main: true, hit: 0}, {id: 'venom-pool', delay: 300, hit: 1}], desc: '對隨機 2 個敵人造成 100% 傷害（2 段），80% 機率中毒 2 回合',
            effects: [
                {type: 'damage', target: 'enemyRandom2', mult: 1.0, hits: [0.7, 0.3]},
                {type: 'status', target: 'same', status: 'poison', turns: 2, chance: 0.8, dotMult: 0.3},
            ],
        },
        ult: {
            name: '劇毒風暴', desc: '對敵方全體造成 100% 傷害（3 段），並中毒 3 回合',
            show: 3400, vfx: [{id: 'venom-stream', at: 'foes', hit: 0}, {id: 'ground-fog', at: 'foes', color: '#a3e635', delay: 300, hit: 1}, {id: 'venom-pool', at: 'foes', each: true, delay: 600, stagger: 100, main: true, hit: 2}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.0, hits: [0.3, 0.2, 0.5]},
                {type: 'status', target: 'same', status: 'poison', turns: 3, chance: 1, dotMult: 0.3},
            ],
        },
        passive: {name: '塗毒', desc: '普攻有 30% 機率使目標中毒 2 回合', type: 'poisonOnBasic', chance: 0.3, dotMult: 0.25},
    },
    shadow: {
        name: '無形者·影', rarity: 'SSR', faction: 'night', element: 'water', role: 'assassin', img: 'h_shadow',
        skill: {
            name: '影襲', cd: 2, show: 1800, vfx: [{id: 'smoke-puff', at: 'self'}, {id: 'dimensional-rend', delay: 200, main: true, hit: 0}, {id: 'spatial-smear', delay: 150, color: '#a78bfa', hit: 1}], desc: '對生命比例最低的敵人造成 260% 傷害（2 段）',
            effects: [{type: 'damage', target: 'enemyLowest', mult: 2.6, hits: [0.6, 0.4]}],
        },
        ult: {
            name: '千刃影殺', desc: '對生命比例最低的敵人造成 400% 傷害（5 段），生命低於 25% 直接斬殺（首領除外）',
            show: 4800, impactFrame: true, vfx: [{id: 'black-hole', size: 1.7, speed: 0.55, pull: 1400, dark: 1700, hit: 0}, {id: 'spatial-smear', color: '#a78bfa', delay: 1250, hit: 1}, {id: 'dimensional-rend', delay: 1550, size: 1.3, hit: 2}, {id: 'azure-sweep', color: '#a78bfa', delay: 1850, hit: 3}, {id: 'energy-burst', color: '#c084fc', delay: 2150, size: 1.5, main: true, hit: 4}],
            effects: [
                {type: 'damage', target: 'enemyLowest', mult: 4.0, execute: 0.25, hits: [0.1, 0.15, 0.2, 0.2, 0.35]},
            ],
        },
        passive: {name: '伺機而動', desc: '攻擊滿血的目標時，暴擊率 +30%', type: 'critVsFullHp', pct: 0.3},
    },
    lilith: {
        name: '暗影牧師·莉莉絲', rarity: 'SSR', faction: 'night', element: 'dark', role: 'support', img: 'h_lilith',
        skill: {
            name: '血契', cd: 2, show: 2800, vfx: [{id: 'soul-siphon', color: '#ff2d55', main: true, hit: 0, ticks: [1, 2, 3], tick: 260}, {id: 'soul-siphon', reverse: true, color: '#ff2d55', delay: 1150, hit: 4}], desc: '吸取單體生命，造成 150% 傷害（5 段），我方全體回復該傷害的 50%',
            effects: [{type: 'damage', target: 'enemy', mult: 1.5, teamHealPct: 0.5, hits: [0.15, 0.15, 0.15, 0.15, 0.4]}],
        },
        ult: {
            name: '血月契約', desc: '對敵方全體造成 130% 傷害（6 段），我方全體回復傷害的 30%',
            show: 4400, impactFrame: true, vfx: [{id: 'soul-siphon', at: 'foes', color: '#ff2d55', hit: 0, ticks: [1, 2, 3], tick: 260}, {id: 'darkchain-detonation', at: 'foes', color: '#ff2d55', delay: 1250, main: true, hit: 4}, {id: 'energy-burst', at: 'foes', color: '#ff2d55', delay: 1700, hit: 5}, {id: 'revival-bloom', at: 'friends', color: '#ff2d55', delay: 1900}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.3, teamHealPct: 0.3, hits: [0.1, 0.1, 0.1, 0.1, 0.35, 0.25]},
            ],
        },
        passive: {name: '暗之渴望', desc: '造成傷害的 20% 轉為自身生命', type: 'lifesteal', pct: 0.2},
    },
};

// 原型預設隊伍（方便快速試玩）
RES.PRESET_TEAMS = [
    {name: '教團＋王國', team: ['arthur', 'reina', 'zeke', 'seraph', 'elara']},
    {name: '暗夜＋王國', team: ['arthur', 'valkyrie', 'shadow', 'dart', 'lilith']},
    {name: '翠林＋教團', team: ['gaia', 'elara', 'faye', 'lyra', 'zeke']},
];
