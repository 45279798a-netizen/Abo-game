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

// 覺醒：60 級、比起始星級多 1★ 後用覺醒石開啟。全能力依稀有度加成，再加每位英雄的專屬效果（各英雄的 awaken 欄位）。
// 稀有度越高加成越多，但 R、SR 的覺醒石比較便宜；覺醒後的 R 大約追上沒覺醒的 SSR。
RES.AWAKEN = {
    lv: 60, starUp: 1, gold: 50000,   // 60 級＋比起始星級多 1★（R 2★、SR 3★、SSR 4★、UR 5★）
    cost: {R: 20, SR: 20, SSR: 30, UR: 40},
    stat: {R: 0.06, SR: 0.08, SSR: 0.10, UR: 0.12},
};

// 職業基礎能力（SSR、原型等級）。輸出職業（戰士、法師、射手、刺客）攻擊在 11/15 調高 15%，讓標準的 1 坦 1 輔 3 輸出不輸給全坦克＋補師
RES.ROLES = {
    tank:     {name: '坦克', hp: 3300, atk: 170, def: 200, spd: 92},
    warrior:  {name: '戰士', hp: 2400, atk: 288, def: 140, spd: 102},
    mage:     {name: '法師', hp: 1800, atk: 322, def: 95,  spd: 104},
    archer:   {name: '射手', hp: 1850, atk: 310, def: 95,  spd: 108},
    assassin: {name: '刺客', hp: 1750, atk: 305, def: 90,  spd: 118},
    support:  {name: '輔助', hp: 2000, atk: 200, def: 115, spd: 112},
};

RES.HEROES = {
    // ───────── 獅心王國 ─────────
    arthur: {
        name: '重裝鐵衛·亞瑟', vfxColor: ['#2f9bff', '#bfe3ff'], rarity: 'SR', faction: 'kingdom', element: 'water', role: 'tank', img: 'h_arthur',
        skill: {
            name: '堅盾號令', cd: 2, show: 2200, vfx: [{id: 'prism-parry', at: 'self', color: '#bfe3ff'}, {id: 'shockwave', at: 'self', delay: 150, main: true, color: '#2f9bff'}], desc: '嘲諷敵人 2 回合，並獲得最大生命 15% 的護盾',
            effects: [
                {type: 'status', target: 'self', status: 'taunt', turns: 2, chance: 1},
                {type: 'shield', target: 'self', pctMaxHp: 0.15},
            ],
        },
        ult: {
            name: '獅王壁壘', desc: '全隊獲得最大生命 12% 的護盾，自己嘲諷 2 回合',
            show: 3600, vfx: [{id: 'shockwave', at: 'self', color: '#bfe3ff'}, {id: 'prism-guard', at: 'friends', delay: 300, main: true, color: '#2f9bff'}, {id: 'magic-barrier', at: 'friends', each: true, delay: 800, stagger: 100, color: '#bfe3ff'}],
            effects: [
                {type: 'shield', target: 'allies', pctMaxHp: 0.12},
                {type: 'status', target: 'self', status: 'taunt', turns: 2, chance: 1},
            ],
        },
        passive: {name: '鐵壁', desc: '防禦 +10%', type: 'statUp', stat: 'def', pct: 0.10},
        awaken: {name: '不動如山', desc: '嘲諷期間受到的傷害 -25%', type: 'tauntGuard', pct: 0.25},
    },
    reina: {
        name: '烈焰騎士·蕾娜', vfxColor: ['#ff3b1f', '#ffb36b'], rarity: 'SSR', faction: 'kingdom', element: 'fire', role: 'warrior', img: 'h_reina',
        skill: {
            name: '烈焰突擊', cd: 2, show: 2200, vfx: [{id: 'flame-surge', main: true, hit: 0, color: '#ff3b1f'}, {id: 'burning-ground', delay: 350, hit: 1, color: '#ffb36b'}], desc: '對敵方前排造成 150% 傷害（2 段），70% 機率燃燒 2 回合',
            effects: [
                {type: 'damage', target: 'enemyFront', mult: 1.5, hits: [0.6, 0.4]},
                {type: 'status', target: 'same', status: 'burn', turns: 2, chance: 0.7, dotMult: 0.3},
            ],
        },
        ult: {
            name: '焚天斬', desc: '對敵方前排造成 300% 傷害（3 段），90% 機率燃燒 2 回合',
            show: 3800, impactFrame: true, vfx: [{id: 'flame-surge', hit: 0, color: '#ff3b1f'}, {id: 'billowing-airburst', delay: 500, main: true, hit: 1, color: '#ffb36b'}, {id: 'magma-fissure', delay: 800, hit: 2, color: '#ffb36b'}],
            effects: [
                {type: 'damage', target: 'enemyFront', mult: 3.0, hits: [0.25, 0.45, 0.3]},
                {type: 'status', target: 'same', status: 'burn', turns: 2, chance: 0.9, dotMult: 0.35},
            ],
        },
        passive: {name: '乘勝追擊', desc: '擊倒敵人時，自己推條 30%', type: 'onKillPush', pct: 0.3},
        awaken: {name: '餘燼追獵', desc: '對燃燒中的敵人傷害 +25%', type: 'dmgVsStatus', statuses: ['burn'], pct: 0.25},
    },
    valkyrie: {
        name: '聖殿衛士·瓦爾基里', vfxColor: ['#dfe7ff', '#a5b4fc'], rarity: 'SSR', faction: 'kingdom', element: 'light', role: 'tank', img: 'h_valkyrie', faceY: 14,
        skill: {
            name: '聖盾', cd: 3, show: 2600, vfx: [{id: 'radiant-beam', at: 'self', sky: true, color: '#a5b4fc'}, {id: 'magic-barrier', at: 'friends', delay: 300, main: true, color: '#dfe7ff'}], desc: '我方全體獲得自身最大生命 11% 的護盾，自己嘲諷 1 回合',
            effects: [
                {type: 'shield', target: 'allies', pctMaxHp: 0.11, ofCaster: true},
                {type: 'status', target: 'self', status: 'taunt', turns: 1, chance: 1},
            ],
        },
        ult: {
            name: '天穹聖域', desc: '全隊受到的傷害 -30%（2 回合），並獲得自身最大生命 8% 的護盾',
            show: 4000, vfx: [{id: 'astral-gate', at: 'friends', size: 1.3, color: '#dfe7ff'}, {id: 'radiant-beam', at: 'friends', sky: true, size: 1.4, delay: 500, color: '#a5b4fc'}, {id: 'energy-vortex', at: 'friends', delay: 900, main: true, color: '#dfe7ff'}],
            effects: [
                {type: 'status', target: 'allies', status: 'guard', turns: 2, chance: 1},
                {type: 'shield', target: 'allies', pctMaxHp: 0.08, ofCaster: true},
            ],
        },
        passive: {name: '衝鋒號角', desc: '戰鬥開始時，我方全體推條 10%', type: 'startPushAllies', pct: 0.10},
        awaken: {name: '女武神的守望', desc: '每場戰鬥 1 次：隊友受到致命傷害時保留 1 點生命，並獲得最大生命 8% 的護盾', type: 'teamCheatDeath', shield: 0.08},
    },

    // ───────── 聖光教團 ─────────
    elara: {
        name: '祭司·艾拉', vfxColor: ['#7ff0d0', '#f0fffa'], rarity: 'SR', faction: 'church', element: 'water', role: 'support', img: 'h_elara',
        skill: {
            name: '治癒之泉', cd: 2, show: 2400, vfx: [{id: 'healing-field', at: 'friends', main: true, color: '#7ff0d0'}, {id: 'revival-bloom', at: 'friends', delay: 450, color: '#f0fffa'}], desc: '回復我方全體 115% 攻擊力的生命', healOnly: true,
            effects: [{type: 'heal', target: 'allies', mult: 1.15}],
        },
        ult: {
            name: '生命聖泉', desc: '回復我方全體 220% 攻擊力的生命，並淨化全部減益',
            show: 3600, vfx: [{id: 'healing-field', at: 'friends', size: 1.5, main: true, color: '#7ff0d0'}, {id: 'energy-vortex', at: 'friends', delay: 300, color: '#f0fffa'}, {id: 'revival-bloom', at: 'friends', each: true, delay: 900, stagger: 100, color: '#f0fffa'}],
            effects: [
                {type: 'heal', target: 'allies', mult: 2.2},
                {type: 'cleanse', target: 'allies', count: 9},
            ],
        },
        passive: {name: '淨化之觸', desc: '普攻時，淨化一名隊友的 1 個減益', type: 'cleanseOnBasic'},
        awaken: {name: '滿溢之泉', desc: '補過頭的治療量 25% 轉成護盾（最多到目標最大生命 12%）', type: 'overhealShield', pct: 0.25, cap: 0.12},
    },
    zeke: {
        name: '雷霆審判者·吉克', vfxColor: ['#3d7bff', '#c7dcff'], rarity: 'SSR', faction: 'church', element: 'wind', role: 'mage', img: 'h_zeke',
        skill: {
            name: '雷霆審判', cd: 2, show: 2800, vfx: [{id: 'arc-ray', at: 'foes', speed: 0.8, hit: 0, color: '#3d7bff'}, {id: 'thunder-strike', at: 'foes', each: true, delay: 300, stagger: 160, main: true, hit: 1, color: '#c7dcff'}], desc: '對敵方全體造成 100% 傷害（2 段），30% 機率減速 2 回合',
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.0, hits: [0.35, 0.65]},
                {type: 'status', target: 'same', status: 'slow', turns: 2, chance: 0.3},
            ],
        },
        ult: {
            name: '萬雷天罰', desc: '對敵方全體造成 200% 傷害（3 段），50% 機率減速 2 回合',
            show: 4000, impactFrame: true, vfx: [{id: 'charged-beam', at: 'foes', hit: 0, color: '#c7dcff'}, {id: 'thunder-strike', at: 'foes', each: true, delay: 600, stagger: 140, main: true, hit: 1, color: '#3d7bff'}, {id: 'energy-burst', at: 'foes', delay: 1000, hit: 2, color: '#c7dcff'}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 2.0, hits: [0.2, 0.5, 0.3]},
                {type: 'status', target: 'same', status: 'slow', turns: 2, chance: 0.5},
            ],
        },
        passive: {name: '驅魔', desc: '對亡靈天災傷害 +20%', type: 'dmgVsFaction', faction: 'undead', pct: 0.2},
        awaken: {name: '雷罰', desc: '對減速中的敵人暴擊率 +30%', type: 'critVsStatus', statuses: ['slow'], pct: 0.3},
    },
    seraph: {
        name: '大天使·熾', vfxColor: ['#ff9a2e', '#fff1c2'], rarity: 'SSR', faction: 'church', element: 'light', role: 'support', img: 'h_seraph', faceY: 12,
        skill: {
            name: '聖光祝福', cd: 3, show: 2600, vfx: [{id: 'astral-gate', at: 'friends', color: '#ff9a2e'}, {id: 'energy-vortex', at: 'friends', delay: 400, main: true, color: '#fff1c2'}], desc: '我方全體推條 20%，攻擊 +20%（2 回合），並回復 80% 攻擊力的生命',
            effects: [
                {type: 'push', target: 'allies', pct: 0.2},
                {type: 'status', target: 'allies', status: 'atkUp', turns: 2, chance: 1},
                {type: 'heal', target: 'allies', mult: 0.8},
            ],
        },
        ult: {
            name: '熾天審判', desc: '對敵方全體造成 170% 傷害（2 段），我方全體攻擊 +20%（2 回合）',
            show: 4200, impactFrame: true, vfx: [{id: 'radiant-beam', at: 'foes', sky: true, size: 1.5, hit: 0, color: '#ff9a2e'}, {id: 'astral-convergence', at: 'foes', size: 1.3, delay: 600, main: true, hit: 1, color: '#fff1c2'}, {id: 'energy-burst', at: 'foes', delay: 1000, color: '#ff9a2e'}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.7, hits: [0.6, 0.4]},
                {type: 'status', target: 'allies', status: 'atkUp', turns: 2, chance: 1},
            ],
        },
        passive: {name: '光之加護', desc: '我方全體效果抵抗 +15%', type: 'auraRes', pct: 0.15},
        awaken: {name: '熾天之翼', desc: '戰鬥開始時我方全體能量 +20；自己施加的攻擊提升從 +20% 變成 +30%', type: 'aura', startEnergyAllies: 20, atkUpAmp: 0.3},
    },

    // ───────── 翠林盟約 ─────────
    lyra: {
        name: '吟遊詩人·萊拉', vfxColor: ['#ffb6e1', '#fff0f8'], rarity: 'R', faction: 'forest', element: 'fire', role: 'support', img: 'h_lyra',
        skill: {
            name: '疾風樂章', cd: 3, show: 2600, vfx: [{id: 'painterly-grass', at: 'friends', color: '#fff0f8'}, {id: 'wind-vortex', at: 'friends', delay: 250, main: true, color: '#ffb6e1'}], desc: '我方全體加速（速度 +30%）2 回合，並回復 70% 攻擊力的生命',
            effects: [{type: 'status', target: 'allies', status: 'haste', turns: 2, chance: 1}, {type: 'heal', target: 'allies', mult: 0.7}],
        },
        ult: {
            name: '風之狂想曲', desc: '其他隊友推條 30%，我方全體加速 2 回合',
            show: 3400, vfx: [{id: 'dust-devil', at: 'friends', color: '#fff0f8'}, {id: 'wind-vortex', at: 'friends', delay: 400, main: true, color: '#ffb6e1'}, {id: 'spiral-gale', at: 'foes', delay: 900, color: '#ffb6e1'}],
            effects: [
                {type: 'push', target: 'allyOthers', pct: 0.3},
                {type: 'status', target: 'allies', status: 'haste', turns: 2, chance: 1},
            ],
        },
        passive: {name: '旅人之歌', desc: '行動後，隨機一名隊友推條 10%（優先同陣營）', type: 'pushAllyAfterTurn', pct: 0.10},
        awaken: {name: '終曲', desc: '旅人之歌的推條提高到 30%，被推的隊友能量 +10', passiveMod: {pct: 0.3, energy: 10}},
    },
    faye: {
        name: '精靈射手·菲', vfxColor: ['#3fbf3f', '#c8f7a0'], rarity: 'SR', faction: 'forest', element: 'wind', role: 'archer', img: 'h_faye',
        skill: {
            name: '纏藤箭', cd: 2, show: 2200, vfx: [{id: 'spiral-gale', main: true, hit: 0, color: '#3fbf3f'}, {id: 'thorn-crown', delay: 380, hit: 1, color: '#c8f7a0'}], desc: '對單體造成 200% 傷害（2 段），並拉條 30%',
            effects: [
                {type: 'damage', target: 'enemy', mult: 2.0, hits: [0.6, 0.4]},
                {type: 'pull', target: 'same', pct: 0.3},
            ],
        },
        ult: {
            name: '萬藤箭雨', desc: '對敵方全體造成 160% 傷害（3 段），並拉條 20%',
            show: 3600, impactFrame: true, vfx: [{id: 'spiral-gale', at: 'foes', each: true, stagger: 120, hit: 0, color: '#3fbf3f'}, {id: 'thorn-crown', at: 'foes', each: true, delay: 700, stagger: 100, main: true, hit: 1, color: '#c8f7a0'}, {id: 'binding-curse', at: 'foes', delay: 900, hit: 2, color: '#3fbf3f'}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.6, hits: [0.3, 0.45, 0.25]},
                {type: 'pull', target: 'same', pct: 0.2},
            ],
        },
        passive: {name: '鷹眼', desc: '暴擊率 +15%', type: 'statUp', stat: 'crit', flat: 0.15},
        awaken: {name: '纏藤', desc: '暴擊時再拉條 10%（每次出手每個目標 1 次）', type: 'critPull', pct: 0.1},
    },
    gaia: {
        name: '大地之母·蓋亞', vfxColor: ['#10b981', '#a7f3d0'], rarity: 'SSR', faction: 'forest', element: 'water', role: 'tank', img: 'h_gaia',
        skill: {
            name: '大地之握', cd: 3, show: 2600, vfx: [{id: 'quicksand-seal', at: 'foes', main: true, hit: 0, color: '#10b981'}, {id: 'shockwave', at: 'foes', delay: 450, hit: 1, color: '#a7f3d0'}], desc: '對敵方全體造成 85% 傷害（2 段），拉條 15%，自己嘲諷 1 回合',
            effects: [
                {type: 'damage', target: 'enemies', mult: 0.85, hits: [0.5, 0.5]},
                {type: 'pull', target: 'same', pct: 0.15},
                {type: 'status', target: 'self', status: 'taunt', turns: 1, chance: 1},
            ],
        },
        ult: {
            name: '大地崩裂', desc: '對敵方全體造成 140% 傷害（2 段），拉條 20% 並減速 2 回合，我方全體獲得自身最大生命 8% 的護盾',
            show: 4000, impactFrame: true, vfx: [{id: 'tidal-surge', at: 'foes', hit: 0, color: '#10b981'}, {id: 'thorn-crown', at: 'foes', each: true, delay: 500, stagger: 100, main: true, hit: 1, color: '#a7f3d0'}, {id: 'quicksand-seal', at: 'foes', delay: 900, color: '#10b981'}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.4, hits: [0.55, 0.45]},
                {type: 'pull', target: 'same', pct: 0.2},
                {type: 'status', target: 'same', status: 'slow', turns: 2, chance: 1},
                {type: 'shield', target: 'allies', pctMaxHp: 0.08, ofCaster: true},
            ],
        },
        passive: {name: '生生不息', desc: '每次行動開始時，回復最大生命 6%', type: 'regenOnTurn', pct: 0.06},
        awaken: {name: '萬物滋長', desc: '每次行動開始時，也為生命最低的隊友回復其最大生命 6%', type: 'regenAllyOnTurn', pct: 0.06},
    },

    // ───────── 暗夜結社 ─────────
    dart: {
        name: '毒鏢客', vfxColor: ['#b4e800', '#e6ff8a'], rarity: 'R', faction: 'night', element: 'wind', role: 'assassin', img: 'h_dart',
        skill: {
            name: '淬毒飛鏢', cd: 2, show: 2000, vfx: [{id: 'ice-shard', main: true, hit: 0, color: '#b4e800'}, {id: 'venom-pool', delay: 300, hit: 1, color: '#e6ff8a'}], desc: '對隨機 2 個敵人造成 120% 傷害（2 段），80% 機率中毒 2 回合',
            effects: [
                {type: 'damage', target: 'enemyRandom2', mult: 1.2, hits: [0.7, 0.3]},
                {type: 'status', target: 'same', status: 'poison', turns: 2, chance: 0.8, dotMult: 0.3},
            ],
        },
        ult: {
            name: '劇毒風暴', desc: '對敵方全體造成 120% 傷害（3 段），並中毒 3 回合',
            show: 3400, vfx: [{id: 'venom-stream', at: 'foes', hit: 0, color: '#b4e800'}, {id: 'ground-fog', at: 'foes', delay: 300, hit: 1, color: '#e6ff8a'}, {id: 'venom-pool', at: 'foes', each: true, delay: 600, stagger: 100, main: true, hit: 2, color: '#b4e800'}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.2, hits: [0.3, 0.2, 0.5]},
                {type: 'status', target: 'same', status: 'poison', turns: 3, chance: 1, dotMult: 0.3},
            ],
        },
        passive: {name: '塗毒', desc: '普攻有 30% 機率使目標中毒 2 回合', type: 'poisonOnBasic', chance: 0.3, dotMult: 0.25},
        awaken: {name: '劇毒疊加', desc: '自己施加的中毒可以疊加，最多 3 層（每層傷害相加）', type: 'poisonStack', max: 3},
    },
    shadow: {
        name: '無形者·影', vfxColor: ['#3730a3', '#818cf8'], rarity: 'SSR', faction: 'night', element: 'water', role: 'assassin', img: 'h_shadow',
        skill: {
            name: '影襲', cd: 2, show: 1800, vfx: [{id: 'smoke-puff', at: 'self', color: '#818cf8'}, {id: 'dimensional-rend', delay: 200, main: true, hit: 0, color: '#3730a3'}, {id: 'spatial-smear', delay: 150, hit: 1, color: '#818cf8'}], desc: '對生命比例最低的敵人造成 290% 傷害（2 段）',
            effects: [{type: 'damage', target: 'enemyLowest', mult: 2.9, hits: [0.6, 0.4]}],
        },
        ult: {
            name: '千刃影殺', desc: '對生命比例最低的敵人造成 450% 傷害（5 段），生命低於 25% 直接斬殺（首領除外）',
            show: 4400, impactFrame: true, vfx: [{id: 'smoke-puff', at: 'self', size: 1.4, color: '#818cf8'}, {id: 'spatial-smear', delay: 300, hit: 0, ticks: [1], tick: 250, color: '#818cf8'}, {id: 'dimensional-rend', size: 1.3, delay: 900, hit: 2, color: '#3730a3'}, {id: 'azure-sweep', delay: 1200, hit: 3, color: '#818cf8'}, {id: 'energy-burst', size: 1.5, delay: 1550, main: true, hit: 4, color: '#818cf8'}],
            effects: [
                {type: 'damage', target: 'enemyLowest', mult: 4.5, execute: 0.25, hits: [0.1, 0.15, 0.2, 0.2, 0.35]},
            ],
        },
        passive: {name: '伺機而動', desc: '攻擊滿血的目標時，暴擊率 +30%', type: 'critVsFullHp', pct: 0.3},
        awaken: {name: '影遁', desc: '擊倒敵人時，自己推條 60%', type: 'onKillPush', pct: 0.6},
    },
    lilith: {
        name: '暗影牧師·莉莉絲', vfxColor: ['#e11d48', '#ff8fa3'], rarity: 'SSR', faction: 'night', element: 'dark', role: 'support', img: 'h_lilith',
        skill: {
            name: '血契', cd: 2, show: 2800, vfx: [{id: 'soul-siphon', main: true, hit: 0, ticks: [1, 2, 3], tick: 260, color: '#e11d48'}, {id: 'soul-siphon', reverse: true, delay: 1150, hit: 4, color: '#e11d48'}], desc: '吸取單體生命，造成 190% 傷害（5 段），我方全體回復該傷害的 100%',
            effects: [{type: 'damage', target: 'enemy', mult: 1.9, teamHealPct: 1.0, hits: [0.15, 0.15, 0.15, 0.15, 0.4]}],
        },
        ult: {
            name: '血月契約', desc: '對敵方全體造成 170% 傷害（6 段），我方全體回復傷害的 50%',
            show: 4400, impactFrame: true, vfx: [{id: 'soul-siphon', at: 'foes', hit: 0, ticks: [1, 2, 3], tick: 260, color: '#e11d48'}, {id: 'darkchain-detonation', at: 'foes', delay: 1250, main: true, hit: 4, color: '#e11d48'}, {id: 'energy-burst', at: 'foes', delay: 1700, hit: 5, color: '#ff8fa3'}, {id: 'revival-bloom', at: 'friends', delay: 1900, color: '#ff8fa3'}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.7, teamHealPct: 0.5, hits: [0.1, 0.1, 0.1, 0.1, 0.35, 0.25]},
            ],
        },
        passive: {name: '暗之渴望', desc: '造成傷害的 20% 轉為自身生命', type: 'lifesteal', pct: 0.2},
        awaken: {name: '血之恩賜', desc: '血契、血月契約對生命低於 50% 的隊友治療量 +80%', type: 'teamHealLow', pct: 0.8},
    },
    // ───────── 第 2 階段補齊的 10 位 ─────────
    militia: {
        name: '王國步兵', vfxColor: ['#b8864b', '#f1d9b0'], rarity: 'R', faction: 'kingdom', element: 'wind', role: 'warrior', img: 'h_militia',
        skill: {
            name: '盾牆突刺', cd: 2, show: 2000, desc: '對單體造成 190% 傷害（2 段），60% 機率破甲 2 回合',
            vfx: [{id: 'weapon-smear', main: true, hit: 0, color: '#b8864b'}, {id: 'shockwave', delay: 380, hit: 1, color: '#f1d9b0'}],
            effects: [
                {type: 'damage', target: 'enemy', mult: 1.9, hits: [0.45, 0.55]},
                {type: 'status', target: 'same', status: 'defDown', turns: 2, chance: 0.6},
            ],
        },
        ult: {
            name: '王國衝鋒號', desc: '對敵方前排造成 270% 傷害（3 段），我方全體推條 15%',
            show: 3400, vfx: [{id: 'azure-sweep', size: 1.3, hit: 0, color: '#b8864b'}, {id: 'weapon-smear', delay: 450, hit: 1, color: '#f1d9b0'}, {id: 'shockwave', size: 1.3, delay: 850, main: true, hit: 2, color: '#b8864b'}],
            effects: [
                {type: 'damage', target: 'enemyFront', mult: 2.7, hits: [0.3, 0.3, 0.4]},
                {type: 'push', target: 'allies', pct: 0.15},
            ],
        },
        passive: {name: '同袍', desc: '生命 +15%', type: 'statUp', stat: 'hp', pct: 0.15},
        awaken: {name: '同袍之誼', desc: '每有一位其他獅心王國隊友，攻擊與防禦 +5%', type: 'factionAllies', faction: 'kingdom', pct: 0.05},
    },
    monk: {
        name: '苦行僧', vfxColor: ['#c2410c', '#fdba74'], rarity: 'R', faction: 'church', element: 'fire', role: 'warrior', img: 'h_monk',
        skill: {
            name: '燃燭連拳', cd: 2, show: 2200, desc: '對單體造成 160% 傷害（3 段）',
            vfx: [{id: 'weapon-smear', main: true, hit: 0, ticks: [1], tick: 300, color: '#c2410c'}, {id: 'fire-explosion', size: 0.7, delay: 660, hit: 2, color: '#fdba74'}],
            effects: [{type: 'damage', target: 'enemy', mult: 1.6, hits: [0.3, 0.3, 0.4]}],
        },
        ult: {
            name: '焚身苦行', desc: '對單體造成 330% 傷害（4 段），自己攻擊提升 2 回合',
            show: 3400,
            vfx: [{id: 'fire-vortex', at: 'self', size: 0.9, color: '#fdba74'}, {id: 'weapon-smear', delay: 600, hit: 0, ticks: [1, 2], tick: 280, color: '#fdba74'}, {id: 'fire-explosion', size: 1.2, delay: 1500, main: true, hit: 3, color: '#fdba74'}],
            effects: [
                {type: 'damage', target: 'enemy', mult: 3.3, hits: [0.2, 0.2, 0.2, 0.4]},
                {type: 'status', target: 'self', status: 'atkUp', turns: 2, chance: 1},
            ],
        },
        passive: {name: '苦修', desc: '每次輪到自己時回復 5% 生命', type: 'regenOnTurn', pct: 0.05},
        awaken: {name: '不滅苦行', desc: '每場戰鬥 1 次：受到致命傷害時保留 1 點生命', type: 'cheatDeathSelf'},
    },
    uther: {
        name: '聖光使者·烏瑟', vfxColor: ['#ffd84a', '#fff7d6'], rarity: 'UR', faction: 'church', element: 'light', role: 'tank', img: 'h_uther',
        skill: {
            name: '聖光之盾', cd: 3, show: 2600, desc: '我方全體獲得烏瑟最大生命 11% 的護盾，並淨化 1 個減益',
            vfx: [{id: 'prism-guard', at: 'friends', main: true, color: '#ffd84a'}, {id: 'healing-field', at: 'friends', delay: 350, color: '#fff7d6'}],
            effects: [
                {type: 'shield', target: 'allies', pctMaxHp: 0.11, ofCaster: true},
                {type: 'cleanse', target: 'allies', count: 1},
            ],
        },
        ult: {
            name: '聖光審判', desc: '對敵方全體造成 160% 傷害（3 段，對亡靈 +30%），我方全體受到的傷害 -30%（1 回合）',
            show: 5000, impactFrame: true,
            vfx: [{id: 'starblade-cataclysm', at: 'foes', hit: 0, dark: 1800}, {id: 'golden-chain-rain', at: 'foes', delay: 900, hit: 1, color: '#ffd84a'}, {id: 'starblade-explosion', at: 'foes', delay: 2250, main: true, hit: 2}, {id: 'magic-barrier', at: 'friends', delay: 2600, color: '#fff7d6'}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.6, bonusVsFaction: {undead: 0.3}, hits: [0.25, 0.3, 0.45]},
                {type: 'status', target: 'allies', status: 'guard', turns: 1, chance: 1},
            ],
        },
        passive: {name: '聖光庇護', desc: '我方全體效果抵抗 +20%', type: 'auraRes', pct: 0.2},
        awaken: {name: '滅靈聖光', desc: '對亡靈天災傷害 +50%', type: 'dmgVsFaction', faction: 'undead', pct: 0.5},
    },
    mist: {
        name: '幻術師·迷霧', vfxColor: ['#d946ef', '#f5d0fe'], rarity: 'SSR', faction: 'forest', element: 'dark', role: 'mage', img: 'h_mist',
        skill: {
            name: '幻影迷陣', cd: 3, show: 2400, desc: '對敵方全體造成 110% 傷害（2 段），50% 機率沉默 1 回合',
            vfx: [{id: 'ground-fog', at: 'foes', hit: 0, color: '#f5d0fe'}, {id: 'arcane-matrix', at: 'foes', delay: 450, main: true, hit: 1, color: '#d946ef'}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.1, hits: [0.4, 0.6]},
                {type: 'status', target: 'same', status: 'silence', turns: 1, chance: 0.5},
            ],
        },
        ult: {
            name: '千面幻境', desc: '對敵方全體造成 200% 傷害（3 段），拉條 25%，50% 機率沉默 2 回合',
            show: 4000, impactFrame: true,
            vfx: [{id: 'astral-gate', at: 'foes', size: 1.3, hit: 0, color: '#d946ef'}, {id: 'smoke-puff', at: 'foes', each: true, delay: 600, stagger: 90, hit: 1, color: '#f5d0fe'}, {id: 'astral-convergence', at: 'foes', size: 1.3, delay: 1100, main: true, hit: 2, color: '#d946ef'}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 2.0, hits: [0.25, 0.3, 0.45]},
                {type: 'pull', target: 'same', pct: 0.25},
                {type: 'status', target: 'same', status: 'silence', turns: 2, chance: 0.5},
            ],
        },
        passive: {name: '幻術精通', desc: '攻擊 +15%', type: 'statUp', stat: 'atk', pct: 0.15},
        awaken: {name: '心靈支配', desc: '效果命中 +15%，對沉默中的敵人傷害 +30%', type: 'dmgVsStatus', statuses: ['silence'], pct: 0.3, stat: {hit: 0.15}},
    },
    // ───────── 荒原部族 ─────────
    thorin: {
        name: '矮人鐵匠·索林', vfxColor: ['#ff6a00', '#ffd29a'], rarity: 'R', faction: 'wild', element: 'fire', role: 'tank', img: 'h_thorin',
        skill: {
            name: '熔鐵挑釁', cd: 2, show: 2000, desc: '對敵方前排造成 100% 傷害並 60% 機率燃燒 2 回合，自己嘲諷 1 回合並獲得最大生命 16% 的護盾',
            vfx: [{id: 'shockwave', at: 'self', color: '#ffd29a'}, {id: 'burning-ground', delay: 250, main: true, hit: 0, color: '#ff6a00'}],
            effects: [
                {type: 'damage', target: 'enemyFront', mult: 1.0},
                {type: 'status', target: 'same', status: 'burn', turns: 2, chance: 0.6, dotMult: 0.25},
                {type: 'status', target: 'self', status: 'taunt', turns: 1, chance: 1},
                {type: 'shield', target: 'self', pctMaxHp: 0.16},
            ],
        },
        ult: {
            name: '熔爐爆裂', desc: '對敵方前排造成 200% 傷害（3 段），自己獲得最大生命 30% 的護盾',
            show: 3400,
            vfx: [{id: 'magma-fissure', hit: 0, color: '#ff6a00'}, {id: 'fire-explosion', size: 1.2, delay: 850, main: true, hit: 1, ticks: [2], tick: 250, color: '#ffd29a'}, {id: 'magic-barrier', at: 'self', delay: 1100, color: '#ff6a00'}],
            effects: [
                {type: 'damage', target: 'enemyFront', mult: 2.0, hits: [0.3, 0.25, 0.45]},
                {type: 'shield', target: 'self', pctMaxHp: 0.30},
            ],
        },
        passive: {name: '鍛鐵之軀', desc: '防禦 +30%', type: 'statUp', stat: 'def', pct: 0.3},
        awaken: {name: '震地重錘', desc: '熔爐爆裂有 80% 機率讓敵方前排暈眩 1 回合', ultAdd: [{type: 'status', target: 'enemyFront', status: 'stun', turns: 1, chance: 0.8}]},
    },
    fang: {
        name: '狼人·法恩', vfxColor: ['#7d8ba3', '#dbe2ee'], rarity: 'SR', faction: 'wild', element: 'wind', role: 'assassin', img: 'h_fang',
        skill: {
            name: '月夜撕咬', cd: 2, show: 2200, desc: '對生命比例最低的敵人造成 230% 傷害（3 段）',
            vfx: [{id: 'spatial-sweep', main: true, hit: 0, color: '#7d8ba3'}, {id: 'weapon-smear', delay: 320, hit: 1, color: '#dbe2ee'}, {id: 'azure-sweep', delay: 640, hit: 2, color: '#7d8ba3'}],
            effects: [{type: 'damage', target: 'enemyLowest', mult: 2.3, hits: [0.3, 0.3, 0.4]}],
        },
        ult: {
            name: '狼群狂襲', desc: '對生命比例最低的 2 個敵人造成 260% 傷害（4 段）',
            show: 3600, impactFrame: true,
            vfx: [{id: 'spatial-sweep', each: true, delay: 300, stagger: 80, hit: 0, color: '#dbe2ee'}, {id: 'weapon-smear', each: true, delay: 650, stagger: 80, hit: 1, ticks: [2], tick: 300, color: '#7d8ba3'}, {id: 'azure-sweep', each: true, delay: 1300, stagger: 80, main: true, hit: 3, color: '#dbe2ee'}],
            effects: [{type: 'damage', target: 'enemyLowest2', mult: 2.6, hits: [0.2, 0.2, 0.25, 0.35]}],
        },
        passive: {name: '嗜血', desc: '造成傷害的 15% 轉為自己的生命', type: 'lifesteal', pct: 0.15},
        awaken: {name: '血腥追獵', desc: '對生命低於 50% 的敵人傷害 +25%', type: 'dmgVsLowHp', below: 0.5, pct: 0.25},
    },
    noah: {
        name: '冰原薩滿·諾亞', vfxColor: ['#5ee7ff', '#e0fbff'], rarity: 'SSR', faction: 'wild', element: 'water', role: 'mage', img: 'h_noah',
        skill: {
            name: '冰霜新星', cd: 2, show: 2400, desc: '對敵方全體造成 120% 傷害（2 段），30% 機率凍結 1 回合',
            vfx: [{id: 'frost-field', at: 'foes', hit: 0, color: '#5ee7ff'}, {id: 'ice-shatter', at: 'foes', delay: 450, main: true, hit: 1, color: '#e0fbff'}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.2, hits: [0.4, 0.6]},
                {type: 'status', target: 'same', status: 'freeze', turns: 1, chance: 0.3},
            ],
        },
        ult: {
            name: '永凍暴風雪', desc: '對敵方全體造成 200% 傷害（4 段），拉條 20%，35% 機率凍結 1 回合',
            show: 4200, impactFrame: true,
            vfx: [{id: 'frost-lance-rain', at: 'foes', hit: 0, color: '#5ee7ff'}, {id: 'frost-wheel', at: 'foes', each: true, size: 0.6, delay: 450, stagger: 90, hit: 1, color: '#e0fbff'}, {id: 'ice-shatter', at: 'foes', each: true, delay: 850, stagger: 90, hit: 2, color: '#5ee7ff'}, {id: 'frost-field', at: 'foes', size: 1.3, delay: 1250, main: true, hit: 3, color: '#e0fbff'}],
            effects: [
                {type: 'damage', target: 'enemies', mult: 2.0, hits: [0.2, 0.25, 0.25, 0.3]},
                {type: 'pull', target: 'same', pct: 0.2},
                {type: 'status', target: 'same', status: 'freeze', turns: 1, chance: 0.35},
            ],
        },
        passive: {name: '寒冰洞察', desc: '攻擊滿血的目標時，暴擊率 +20%', type: 'critVsFullHp', pct: 0.2},
        awaken: {name: '極寒', desc: '對凍結或減速中的敵人傷害 +25%', type: 'dmgVsStatus', statuses: ['freeze', 'slow'], pct: 0.25},
    },
    gideon: {
        name: '狂戰士·吉迪恩', vfxColor: ['#8b1414', '#ff6b4a'], rarity: 'SSR', faction: 'wild', element: 'dark', role: 'warrior', img: 'h_gideon',
        skill: {
            name: '狂怒劈砍', cd: 2, show: 2000, desc: '對敵方前排造成 190% 傷害（2 段）',
            vfx: [{id: 'weapon-smear', main: true, hit: 0, color: '#ff6b4a'}, {id: 'shockwave', delay: 380, hit: 1, color: '#8b1414'}],
            effects: [{type: 'damage', target: 'enemyFront', mult: 1.9, hits: [0.45, 0.55]}],
        },
        ult: {
            name: '血怒狂斬', desc: '對單體造成 420% 傷害（5 段），自己攻擊提升 2 回合',
            show: 4400, impactFrame: true,
            vfx: [{id: 'smoke-column', at: 'self', size: 0.8, color: '#8b1414'}, {id: 'spatial-sweep', delay: 550, hit: 0, color: '#ff6b4a'}, {id: 'weapon-smear', delay: 850, hit: 1, color: '#8b1414'}, {id: 'azure-sweep', delay: 1150, hit: 2, color: '#ff6b4a'}, {id: 'dimensional-rend', delay: 1450, hit: 3}, {id: 'energy-burst', size: 1.3, delay: 1800, main: true, hit: 4, color: '#ff6b4a'}],
            effects: [
                {type: 'damage', target: 'enemy', mult: 4.2, hits: [0.15, 0.15, 0.15, 0.2, 0.35]},
                {type: 'status', target: 'self', status: 'atkUp', turns: 2, chance: 1},
            ],
        },
        passive: {name: '殺戮狂熱', desc: '擊倒敵人時，自己推條 50%', type: 'onKillPush', pct: 0.5},
        awaken: {name: '越戰越勇', desc: '每擊倒 1 個敵人，攻擊 +10%（最多 3 層）', type: 'killStack', pct: 0.1, max: 3},
    },
    // ───────── 暗夜結社 ─────────
    draven: {
        name: '賞金獵人·達文', vfxColor: ['#ff3d7f', '#ffc1d6'], rarity: 'SR', faction: 'night', element: 'fire', role: 'archer', img: 'h_draven',
        skill: {
            name: '爆裂箭', cd: 2, show: 2000, desc: '對單體造成 200% 傷害（2 段），60% 機率燃燒 2 回合',
            vfx: [{id: 'fireball', main: true, hit: 0, color: '#ff3d7f'}, {id: 'fire-explosion', size: 0.7, delay: 380, hit: 1, color: '#ffc1d6'}],
            effects: [
                {type: 'damage', target: 'enemy', mult: 2.0, hits: [0.5, 0.5]},
                {type: 'status', target: 'same', status: 'burn', turns: 2, chance: 0.6, dotMult: 0.3},
            ],
        },
        ult: {
            name: '賞金獵殺', desc: '對生命比例最低的敵人造成 350% 傷害（3 段），生命低於 20% 直接斬殺（首領除外）',
            show: 3600, impactFrame: true,
            vfx: [{id: 'plasma-bolt', hit: 0, color: '#ff3d7f'}, {id: 'fireball', size: 1.3, delay: 500, hit: 1, color: '#ffc1d6'}, {id: 'fire-explosion', size: 1.3, delay: 900, main: true, hit: 2, color: '#ff3d7f'}],
            effects: [{type: 'damage', target: 'enemyLowest', mult: 3.5, execute: 0.2, hits: [0.25, 0.3, 0.45]}],
        },
        passive: {name: '神射手', desc: '暴擊率 +15%', type: 'statUp', stat: 'crit', flat: 0.15},
        awaken: {name: '火上加油', desc: '對燃燒中的敵人暴擊率 +25%', type: 'critVsStatus', statuses: ['burn'], pct: 0.25},
    },
    mortheus: {
        name: '夜魘收割者·莫瑟斯', vfxColor: ['#7c3aed', '#b794ff'], rarity: 'UR', faction: 'night', element: 'dark', role: 'assassin', img: 'h_s1_lr',
        skill: {
            name: '夜魘之鐮', cd: 2, show: 2400, desc: '對敵方前排造成 210% 傷害（3 段），50% 機率破甲 2 回合',
            vfx: [{id: 'shadow-glaive', main: true, hit: 0, color: '#7c3aed'}, {id: 'spatial-sweep', delay: 350, hit: 1, color: '#b794ff'}, {id: 'energy-burst', delay: 700, hit: 2, color: '#7c3aed'}],
            effects: [
                {type: 'damage', target: 'enemyFront', mult: 2.1, hits: [0.3, 0.3, 0.4]},
                {type: 'status', target: 'same', status: 'defDown', turns: 2, chance: 0.5},
            ],
        },
        ult: {
            name: '收割之夜', desc: '對敵方全體造成 230% 傷害（5 段），生命低於 20% 直接斬殺（首領除外）',
            show: 5000, impactFrame: true,
            vfx: [{id: 'black-hole', at: 'foes', size: 1.1, dark: 1800, color: '#7c3aed'}, {id: 'shadow-glaive', at: 'foes', each: true, delay: 500, stagger: 80, hit: 0, color: '#b794ff'}, {id: 'spatial-sweep', at: 'foes', each: true, delay: 850, stagger: 80, hit: 1, color: '#7c3aed'}, {id: 'dimensional-rend', at: 'foes', each: true, delay: 1200, stagger: 80, hit: 2}, {id: 'darkchain-detonation', at: 'foes', delay: 1550, hit: 3, color: '#7c3aed'}, {id: 'energy-burst', at: 'foes', size: 1.4, delay: 1950, main: true, hit: 4, color: '#b794ff'}],
            effects: [{type: 'damage', target: 'enemies', mult: 2.3, execute: 0.2, hits: [0.15, 0.15, 0.2, 0.2, 0.3]}],
        },
        passive: {name: '靈魂收割', desc: '造成傷害的 20% 轉為自己的生命', type: 'lifesteal', pct: 0.2},
        awaken: {name: '噬魂', desc: '擊倒敵人時，自己的能量 +25', type: 'killEnergy', n: 25},
    },
};

// 原型預設隊伍（方便快速試玩）
RES.PRESET_TEAMS = [
    {name: '教團＋王國', team: ['arthur', 'reina', 'zeke', 'seraph', 'elara']},
    {name: '暗夜＋王國', team: ['arthur', 'valkyrie', 'shadow', 'dart', 'lilith']},
    {name: '翠林＋教團', team: ['gaia', 'elara', 'faye', 'lyra', 'zeke']},
    {name: '荒原＋教團', team: ['thorin', 'gideon', 'fang', 'noah', 'elara']},
    {name: '烏瑟＋暗夜', team: ['uther', 'mortheus', 'draven', 'lilith', 'seraph']},
];
