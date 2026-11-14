// 裝備資料：欄位、品質、屬性、套裝。規則（產生、強化、分解、穿脫、加成）在 js/core/gear.js。
// 數值都是比例（0.1 = 10%），速度是點數。
window.RES = window.RES || {};

RES.GEAR = {
    MAX_LV: 15,
    // 4 個欄位：前 3 個主屬性固定，飾品從 accMain 隨機
    SLOTS: {
        weapon: {name: '武器', icon: '⚔️', main: 'atkPct'},
        helmet: {name: '頭盔', icon: '🪖', main: 'hpPct'},
        armor:  {name: '盔甲', icon: '🛡️', main: 'defPct'},
        acc:    {name: '飾品', icon: '💍', main: null},
    },
    SLOT_ORDER: ['weapon', 'helmet', 'armor', 'acc'],
    accMain: ['spd', 'crit', 'critDmg', 'hit', 'res'],
    // 品質：初始副屬性條數、強化花費倍率、分解基本強化石
    QUALITY: [
        {name: '普通', color: '#cbd5e1', subs: 0, cost: 0.5, salvage: 2},
        {name: '優良', color: '#4ade80', subs: 1, cost: 0.7, salvage: 4},
        {name: '精良', color: '#60a5fa', subs: 2, cost: 1.0, salvage: 8},
        {name: '史詩', color: '#c084fc', subs: 3, cost: 1.3, salvage: 15},
        {name: '傳說', color: '#fb923c', subs: 4, cost: 1.6, salvage: 25},
    ],
    // 屬性：名稱、是否百分比、主屬性基礎值（依品質）、副屬性每次的範圍
    STATS: {
        atkPct:  {name: '攻擊', pct: true, main: [0.04, 0.06, 0.08, 0.10, 0.12], sub: [0.02, 0.04]},
        hpPct:   {name: '生命', pct: true, main: [0.04, 0.06, 0.08, 0.10, 0.12], sub: [0.02, 0.04]},
        defPct:  {name: '防禦', pct: true, main: [0.04, 0.06, 0.08, 0.10, 0.12], sub: [0.02, 0.04]},
        spd:     {name: '速度', pct: false, main: [2, 3, 4, 5, 6], sub: [1, 3]},
        crit:    {name: '暴擊率', pct: true, main: [0.03, 0.04, 0.05, 0.06, 0.08], sub: [0.015, 0.03]},
        critDmg: {name: '暴擊傷害', pct: true, main: [0.05, 0.07, 0.09, 0.11, 0.13], sub: [0.02, 0.04]},
        hit:     {name: '效果命中', pct: true, main: [0.04, 0.06, 0.08, 0.10, 0.12], sub: [0.02, 0.04]},
        res:     {name: '效果抵抗', pct: true, main: [0.04, 0.06, 0.08, 0.10, 0.12], sub: [0.02, 0.04]},
    },
    MAIN_PER_LV: 0.12,   // 主屬性每強化 1 級 +12%（+15 時是基礎的 2.8 倍）
    // 套裝：2 件效果直接加屬性（two），4 件效果在戰鬥裡觸發（four）
    SETS: {
        swift:     {name: '疾風', icon: '🌪️', color: '#5eead4', two: {spdPct: 0.12}, four: {startPush: 0.2},
                    desc2: '速度 +12%', desc4: '戰鬥開始時推條 20%'},
        resonance: {name: '共鳴', icon: '🔮', color: '#a78bfa', two: {atkPct: 0.10}, four: {startEnergy: 40, ultDmg: 0.2},
                    desc2: '攻擊 +10%', desc4: '開場能量 +40，大招傷害 +20%'},
        bulwark:   {name: '壁壘', icon: '🧱', color: '#94a3b8', two: {defPct: 0.15}, four: {startShield: 0.15},
                    desc2: '防禦 +15%', desc4: '開場獲得最大生命 15% 的護盾'},
        fury:      {name: '狂怒', icon: '💢', color: '#f87171', two: {crit: 0.12}, four: {critDmg: 0.4},
                    desc2: '暴擊率 +12%', desc4: '暴擊傷害 +40%'},
        vitality:  {name: '生命', icon: '💚', color: '#4ade80', two: {hpPct: 0.15}, four: {regen: 0.05},
                    desc2: '生命 +15%', desc4: '每次輪到自己時回復 5% 生命'},
        seal:      {name: '封印', icon: '🔒', color: '#fbbf24', two: {hit: 0.15}, four: {sealPull: 0.15},
                    desc2: '效果命中 +15%', desc4: '凍結、減速、沉默成功時，目標再被拉條 15%'},
    },
    // 自動穿裝：各職業對每種屬性的重視程度（每 1% 或每 1 點速度的分數）
    ROLE_WEIGHT: {
        tank:     {atkPct: 0.3, hpPct: 1.0, defPct: 0.9, spd: 1.0, crit: 0.2, critDmg: 0.1, hit: 0.3, res: 0.6},
        warrior:  {atkPct: 1.0, hpPct: 0.6, defPct: 0.4, spd: 1.2, crit: 1.0, critDmg: 0.7, hit: 0.2, res: 0.3},
        mage:     {atkPct: 1.0, hpPct: 0.5, defPct: 0.3, spd: 1.3, crit: 1.0, critDmg: 0.7, hit: 0.6, res: 0.2},
        archer:   {atkPct: 1.0, hpPct: 0.5, defPct: 0.3, spd: 1.3, crit: 1.1, critDmg: 0.8, hit: 0.3, res: 0.2},
        assassin: {atkPct: 1.0, hpPct: 0.4, defPct: 0.3, spd: 1.4, crit: 1.1, critDmg: 0.9, hit: 0.2, res: 0.2},
        support:  {atkPct: 0.6, hpPct: 0.8, defPct: 0.6, spd: 1.5, crit: 0.3, critDmg: 0.2, hit: 0.7, res: 0.6},
    },
};
