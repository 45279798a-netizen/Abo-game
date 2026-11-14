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
//      each:true 每個目標各放一個；delay 延後毫秒；main:true 這段命中時才跳傷害（沒標就用第一段）；
//      sky:true 光束從天而降；reverse:true 飛行／光束從目標飛回施放者；color 顏色；size 大小倍率；speed 播放速度倍率。
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
            name: '堅盾號令', cd: 2, show: 2000, vfx: [{id: 'prism-guard', at: 'self', color: '#60a5fa', size: 1.3, main: true}, {id: 'shockwave', at: 'self', color: '#93c5fd', size: 0.8, delay: 250}], desc: '嘲諷敵人 2 回合，並獲得最大生命 20% 的護盾',
            effects: [
                {type: 'status', target: 'self', status: 'taunt', turns: 2, chance: 1},
                {type: 'shield', target: 'self', pctMaxHp: 0.20},
            ],
        },
        passive: {name: '鐵壁', desc: '防禦 +25%', type: 'statUp', stat: 'def', pct: 0.25},
    },
    reina: {
        name: '烈焰騎士·蕾娜', rarity: 'SSR', faction: 'kingdom', element: 'fire', role: 'warrior', img: 'h_reina',
        skill: {
            name: '烈焰突擊', cd: 2, show: 2200, vfx: [{id: 'flame-surge', size: 0.9, main: true}, {id: 'burning-ground', delay: 350}], desc: '對敵方前排造成 150% 傷害，70% 機率燃燒 2 回合',
            effects: [
                {type: 'damage', target: 'enemyFront', mult: 1.5},
                {type: 'status', target: 'same', status: 'burn', turns: 2, chance: 0.7, dotMult: 0.3},
            ],
        },
        passive: {name: '乘勝追擊', desc: '擊倒敵人時，自己推條 30%', type: 'onKillPush', pct: 0.3},
    },
    valkyrie: {
        name: '聖殿衛士·瓦爾基里', rarity: 'SSR', faction: 'kingdom', element: 'light', role: 'tank', img: 'h_valkyrie', faceY: 14,
        skill: {
            name: '聖盾', cd: 3, show: 2600, vfx: [{id: 'radiant-beam', at: 'friends', sky: true, color: '#fde68a'}, {id: 'magic-barrier', at: 'friends', color: '#fde68a', size: 1.4, delay: 300, main: true}], desc: '我方全體獲得自身最大生命 12% 的護盾，自己嘲諷 1 回合',
            effects: [
                {type: 'shield', target: 'allies', pctMaxHp: 0.12, ofCaster: true},
                {type: 'status', target: 'self', status: 'taunt', turns: 1, chance: 1},
            ],
        },
        passive: {name: '衝鋒號角', desc: '戰鬥開始時，我方全體推條 10%', type: 'startPushAllies', pct: 0.10},
    },

    // ───────── 聖光教團 ─────────
    elara: {
        name: '祭司·艾拉', rarity: 'SR', faction: 'church', element: 'water', role: 'support', img: 'h_elara',
        skill: {
            name: '治癒之泉', cd: 2, show: 2400, vfx: [{id: 'healing-field', at: 'friends', size: 1.2, main: true}, {id: 'revival-bloom', at: 'friends', delay: 450, size: 0.8}], desc: '回復我方全體 200% 攻擊力的生命', healOnly: true,
            effects: [{type: 'heal', target: 'allies', mult: 2.0}],
        },
        passive: {name: '淨化之觸', desc: '普攻時，淨化一名隊友的 1 個減益', type: 'cleanseOnBasic'},
    },
    zeke: {
        name: '雷霆審判者·吉克', rarity: 'SSR', faction: 'church', element: 'wind', role: 'mage', img: 'h_zeke',
        skill: {
            name: '雷霆審判', cd: 2, show: 2800, vfx: [{id: 'arc-ray', at: 'foes', speed: 0.8}, {id: 'thunder-strike', at: 'foes', each: true, delay: 300, stagger: 160, main: true}], desc: '對敵方全體造成 90% 傷害，30% 機率減速 2 回合',
            effects: [
                {type: 'damage', target: 'enemies', mult: 0.9},
                {type: 'status', target: 'same', status: 'slow', turns: 2, chance: 0.3},
            ],
        },
        passive: {name: '驅魔', desc: '對亡靈天災傷害 +20%', type: 'dmgVsFaction', faction: 'undead', pct: 0.2},
    },
    seraph: {
        name: '大天使·熾', rarity: 'SSR', faction: 'church', element: 'light', role: 'support', img: 'h_seraph', faceY: 12,
        skill: {
            name: '聖光祝福', cd: 3, show: 2600, vfx: [{id: 'astral-gate', at: 'friends', color: '#ffd166', size: 1.2}, {id: 'energy-vortex', at: 'friends', color: '#ffd166', delay: 400, main: true}], desc: '我方全體推條 20%，攻擊 +20%（2 回合）',
            effects: [
                {type: 'push', target: 'allies', pct: 0.2},
                {type: 'status', target: 'allies', status: 'atkUp', turns: 2, chance: 1},
            ],
        },
        passive: {name: '光之加護', desc: '我方全體效果抵抗 +15%', type: 'auraRes', pct: 0.15},
    },

    // ───────── 翠林盟約 ─────────
    lyra: {
        name: '吟遊詩人·萊拉', rarity: 'R', faction: 'forest', element: 'fire', role: 'support', img: 'h_lyra',
        skill: {
            name: '疾風樂章', cd: 2, show: 2600, vfx: [{id: 'painterly-grass', at: 'friends', size: 0.9}, {id: 'wind-vortex', at: 'friends', delay: 250, main: true}], desc: '我方全體加速（速度 +30%）2 回合',
            effects: [{type: 'status', target: 'allies', status: 'haste', turns: 2, chance: 1}],
        },
        passive: {name: '旅人之歌', desc: '行動後，隨機一名隊友推條 10%（優先同陣營）', type: 'pushAllyAfterTurn', pct: 0.10},
    },
    faye: {
        name: '精靈射手·菲', rarity: 'SR', faction: 'forest', element: 'wind', role: 'archer', img: 'h_faye',
        skill: {
            name: '纏藤箭', cd: 2, show: 2200, vfx: [{id: 'spiral-gale', color: '#86efac', main: true}, {id: 'thorn-crown', delay: 380, size: 0.9}], desc: '對單體造成 170% 傷害，並拉條 30%',
            effects: [
                {type: 'damage', target: 'enemy', mult: 1.7},
                {type: 'pull', target: 'same', pct: 0.3},
            ],
        },
        passive: {name: '鷹眼', desc: '暴擊率 +15%', type: 'statUp', stat: 'crit', flat: 0.15},
    },
    gaia: {
        name: '大地之母·蓋亞', rarity: 'SSR', faction: 'forest', element: 'water', role: 'tank', img: 'h_gaia',
        skill: {
            name: '大地之握', cd: 3, show: 2600, vfx: [{id: 'quicksand-seal', at: 'foes', size: 1.3, main: true}, {id: 'shockwave', at: 'foes', size: 1.2, delay: 450}], desc: '對敵方全體造成 70% 傷害，並拉條 15%',
            effects: [
                {type: 'damage', target: 'enemies', mult: 0.7},
                {type: 'pull', target: 'same', pct: 0.15},
            ],
        },
        passive: {name: '生生不息', desc: '每次行動開始時，回復最大生命 6%', type: 'regenOnTurn', pct: 0.06},
    },

    // ───────── 暗夜結社 ─────────
    dart: {
        name: '毒鏢客', rarity: 'R', faction: 'night', element: 'wind', role: 'assassin', img: 'h_dart',
        skill: {
            name: '淬毒飛鏢', cd: 2, show: 2000, vfx: [{id: 'arcane-missile', color: '#a3e635', main: true}, {id: 'venom-pool', delay: 300, size: 0.8}], desc: '對隨機 2 個敵人造成 100% 傷害，80% 機率中毒 2 回合',
            effects: [
                {type: 'damage', target: 'enemyRandom2', mult: 1.0},
                {type: 'status', target: 'same', status: 'poison', turns: 2, chance: 0.8, dotMult: 0.3},
            ],
        },
        passive: {name: '塗毒', desc: '普攻有 30% 機率使目標中毒 2 回合', type: 'poisonOnBasic', chance: 0.3, dotMult: 0.25},
    },
    shadow: {
        name: '無形者·影', rarity: 'SSR', faction: 'night', element: 'water', role: 'assassin', img: 'h_shadow',
        skill: {
            name: '影襲', cd: 2, show: 1800, vfx: [{id: 'smoke-puff', at: 'self', size: 0.8}, {id: 'dimensional-rend', delay: 200, main: true}, {id: 'spatial-smear', delay: 150, color: '#a78bfa'}], desc: '對生命比例最低的敵人造成 260% 傷害',
            effects: [{type: 'damage', target: 'enemyLowest', mult: 2.6}],
        },
        passive: {name: '伺機而動', desc: '攻擊滿血的目標時，暴擊率 +30%', type: 'critVsFullHp', pct: 0.3},
    },
    lilith: {
        name: '暗影牧師·莉莉絲', rarity: 'SSR', faction: 'night', element: 'dark', role: 'support', img: 'h_lilith',
        skill: {
            name: '血契', cd: 2, show: 2400, vfx: [{id: 'soul-siphon', color: '#ff2d55', main: true}, {id: 'soul-siphon', reverse: true, color: '#ff2d55', delay: 500}], desc: '對單體造成 150% 傷害，我方全體回復該傷害的 50%',
            effects: [{type: 'damage', target: 'enemy', mult: 1.5, teamHealPct: 0.5}],
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
