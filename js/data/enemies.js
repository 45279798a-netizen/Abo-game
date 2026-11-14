// 亡靈天災：S1 的敵方陣營。敵人可以有多個技能（依順序挑第一個冷卻好的）。
window.RES = window.RES || {};

// 全體敵人能力倍率（調整整體難度用）
RES.ENEMY_SCALE = {hp: 1.5, atk: 1.2, def: 1.0};

RES.ENEMIES = {
    skeleton: {
        name: '骷髏兵', faction: 'undead', element: 'dark', role: 'warrior', img: 'm5',
        stats: {hp: 1100, atk: 170, def: 80, spd: 116},
    },
    boneMinion: {
        name: '骸骨僕從', faction: 'undead', element: 'dark', role: 'warrior', img: 'm5', summoned: true,
        stats: {hp: 550, atk: 120, def: 60, spd: 125},
    },
    frostLich: {
        name: '冰霜巫妖', faction: 'undead', element: 'water', role: 'mage', img: 'm10',
        stats: {hp: 1050, atk: 210, def: 70, spd: 100},
        skills: [{
            name: '寒冰箭', cd: 3, desc: '單體 130% 傷害，35% 機率凍結 1 回合',
            effects: [
                {type: 'damage', target: 'enemy', mult: 1.3},
                {type: 'status', target: 'same', status: 'freeze', turns: 1, chance: 0.35},
            ],
        }],
    },
    corpseBomber: {
        name: '屍爆怪', faction: 'undead', element: 'fire', role: 'warrior', img: 'm14',
        stats: {hp: 1400, atk: 160, def: 90, spd: 90},
        passives: [{name: '屍爆', desc: '死亡時對我方全體造成 80% 傷害', type: 'deathExplode', mult: 0.8}],
    },
    cryptBat: {
        name: '墓穴蝠', faction: 'undead', element: 'wind', role: 'assassin', img: 'm4',
        stats: {hp: 900, atk: 180, def: 60, spd: 128},
        skills: [{
            name: '吸血俯衝', cd: 3, desc: '單體 120% 傷害，並拉條 25%',
            effects: [
                {type: 'damage', target: 'enemy', mult: 1.2},
                {type: 'pull', target: 'same', pct: 0.25},
            ],
        }],
    },
    warlord: {
        name: '亡靈督軍', faction: 'undead', element: 'dark', role: 'tank', img: 'h_s1_ssr1', elite: true,
        stats: {hp: 3200, atk: 190, def: 180, spd: 88, res: 0.1},
        skills: [{
            name: '死亡怒吼', cd: 3, desc: '嘲諷 2 回合，獲得最大生命 20% 護盾',
            effects: [
                {type: 'status', target: 'self', status: 'taunt', turns: 2, chance: 1},
                {type: 'shield', target: 'self', pctMaxHp: 0.2},
            ],
        }],
    },
    plagueBringer: {
        name: '瘟疫使者', faction: 'undead', element: 'fire', role: 'mage', img: 'h_s1_ssr2', elite: true,
        stats: {hp: 1800, atk: 230, def: 90, spd: 104, res: 0.1},
        skills: [{
            name: '瘟疫之雲', cd: 3, desc: '全體 60% 傷害，60% 機率中毒 2 回合',
            effects: [
                {type: 'damage', target: 'enemies', mult: 0.6},
                {type: 'status', target: 'same', status: 'poison', turns: 2, chance: 0.6, dotMult: 0.3},
            ],
        }],
    },
    lichKing: {
        name: '巫妖王', faction: 'undead', element: 'dark', role: 'mage', img: 'boss_lich', boss: true,
        stats: {hp: 12500, atk: 250, def: 150, spd: 100, res: 0.3},
        skills: [
            {
                name: '骸骨召喚', cd: 5, desc: '召喚 2 隻高速骸骨僕從插進時間軸，打斷連攜',
                effects: [{type: 'summon', unit: 'boneMinion', count: 2, atb: 0.7}],
            },
            {
                name: '死亡凍結', cd: 3, desc: '全體 80% 傷害並拉條 30%，隨機 1 人 60% 機率凍結',
                effects: [
                    {type: 'damage', target: 'enemies', mult: 0.8},
                    {type: 'pull', target: 'same', pct: 0.3},
                    {type: 'status', target: 'enemyRandom1', status: 'freeze', turns: 1, chance: 0.6},
                ],
            },
            {
                name: '瘟疫新星', cd: 5, desc: '全體中毒 3 回合',
                effects: [{type: 'status', target: 'enemies', status: 'poison', turns: 3, chance: 1, dotMult: 0.25}],
            },
        ],
        passives: [{name: '狂暴', desc: '生命低於 30% 後速度 +30%', type: 'enrage', hpBelow: 0.3, spdPct: 0.3}],
    },
};

// 原型的三場戰鬥。rows：front 最多 2 格、back 最多 3 格（首領也佔 1 格）
RES.ENCOUNTERS = [
    {
        id: 'vanguard', name: '亡靈先鋒', difficulty: '簡單', power: 1.0, bg: '1',
        desc: '混合屬性的雜兵，先熟悉行動條與連攜',
        front: ['skeleton', 'corpseBomber'], back: ['cryptBat', 'frostLich', 'skeleton'],
    },
    {
        id: 'plague', name: '瘟疫軍團', difficulty: '普通', power: 1.25, bg: '4',
        desc: '督軍會嘲諷，瘟疫使者讓全隊中毒',
        front: ['warlord', 'skeleton'], back: ['plagueBringer', 'frostLich', 'cryptBat'],
    },
    {
        id: 'lich', name: '巫妖王', difficulty: '首領', power: 1.0, bg: '6',
        desc: '會召喚骷髏打斷連攜、凍結並拉條，光屬性與群攻有利',
        front: ['lichKing'], back: ['frostLich', 'frostLich'],
    },
];
