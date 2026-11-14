// size：戰場上的大小倍率（原圖比例特殊的小型魔物用，預設 1）
// 敵人：亡靈天災（S1 的敵方陣營）與主線前幾章的野獸、魔物。敵人可以有多個技能（依順序挑第一個冷卻好的）。
window.RES = window.RES || {};

// 全體敵人能力倍率（調整整體難度用）
RES.ENEMY_SCALE = {hp: 1.8, atk: 1.35, def: 1.0};

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
            name: '寒冰箭', cd: 3, show: 1800, vfx: [{id: 'frost-wheel', main: true, hit: 0}, {id: 'ice-shatter', delay: 250, hit: 1}], desc: '單體 130% 傷害（2 段），35% 機率凍結 1 回合',
            effects: [
                {type: 'damage', target: 'enemy', mult: 1.3, hits: [0.7, 0.3]},
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
            name: '吸血俯衝', cd: 3, show: 1600, vfx: [{id: 'shadow-glaive', color: '#ef4444', main: true}], desc: '單體 120% 傷害，並拉條 25%',
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
            name: '死亡怒吼', cd: 3, show: 1800, vfx: [{id: 'smoke-column', at: 'self', color: '#6b21a8', main: true}, {id: 'shockwave', at: 'self', color: '#a855f7', delay: 200}], desc: '嘲諷 2 回合，獲得最大生命 20% 護盾',
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
            name: '瘟疫之雲', cd: 3, show: 2200, vfx: [{id: 'venom-stream', at: 'foes', main: true, hit: 0}, {id: 'ground-fog', at: 'foes', color: '#86efac', delay: 300, hit: 1}], desc: '全體 60% 傷害（2 段），60% 機率中毒 2 回合',
            effects: [
                {type: 'damage', target: 'enemies', mult: 0.6, hits: [0.6, 0.4]},
                {type: 'status', target: 'same', status: 'poison', turns: 2, chance: 0.6, dotMult: 0.3},
            ],
        }],
    },
    lichKing: {
        name: '巫妖王', faction: 'undead', element: 'dark', role: 'mage', img: 'boss_lich', boss: true,
        stats: {hp: 10500, atk: 250, def: 150, spd: 100, res: 0.3},
        skills: [
            {
                name: '骸骨召喚', cd: 5, show: 2400, vfx: [{id: 'arcane-matrix', at: 'self', color: '#84cc16', size: 1.3, main: true}, {id: 'ground-fog', at: 'self', color: '#4d7c0f', delay: 200, size: 1.4}, {id: 'steam-jet', at: 'self', color: '#a3e635', delay: 350}], summonVfx: {id: 'smoke-column', color: '#84cc16'}, desc: '召喚 2 隻高速骸骨僕從插進時間軸',
                effects: [{type: 'summon', unit: 'boneMinion', count: 2, atb: 0.7}],
            },
            {
                name: '死亡凍結', cd: 3, show: 2800, vfx: [{id: 'frost-field', at: 'foes', hit: 0}, {id: 'frost-lance-rain', at: 'foes', delay: 350, main: true, hit: 1}], desc: '全體 80% 傷害（2 段）並拉條 30%，隨機 1 人 60% 機率凍結',
                effects: [
                    {type: 'damage', target: 'enemies', mult: 0.8, hits: [0.4, 0.6]},
                    {type: 'pull', target: 'same', pct: 0.3},
                    {type: 'status', target: 'enemyRandom1', status: 'freeze', turns: 1, chance: 0.6},
                ],
            },
            {
                name: '瘟疫新星', cd: 5, show: 2600, vfx: [{id: 'darkchain-detonation', at: 'foes', main: true}, {id: 'venom-pool', at: 'foes', each: true, delay: 400}], desc: '全體中毒 3 回合',
                effects: [{type: 'status', target: 'enemies', status: 'poison', turns: 3, chance: 1, dotMult: 0.25}],
            },
        ],
        passives: [{name: '狂暴', desc: '生命低於 30% 後速度 +30%', type: 'enrage', hpBelow: 0.3, spdPct: 0.3}],
    },
    // ───────── 主線新增：一般敵人（前幾章不全是亡靈） ─────────
    slime: {
        name: '水晶史萊姆', faction: 'beast', element: 'water', role: 'tank', img: 'm1', size: 0.55,
        stats: {hp: 1300, atk: 120, def: 110, spd: 92},
        passives: [{name: '再生黏液', desc: '每次輪到自己時回復 6% 生命', type: 'regenOnTurn', pct: 0.06}],
    },
    wolf: {
        name: '荒原狼', faction: 'beast', element: 'wind', role: 'assassin', img: 'm2', size: 0.8,
        stats: {hp: 850, atk: 175, def: 55, spd: 132},
    },
    goblin: {
        name: '哥布林', faction: 'beast', element: 'fire', role: 'warrior', img: 'm3', size: 0.78,
        stats: {hp: 950, atk: 165, def: 70, spd: 112},
        skills: [{
            name: '投擲火罐', cd: 3, show: 1600, vfx: [{id: 'fireball', main: true, hit: 0}, {id: 'burning-ground', delay: 300, hit: 1}], desc: '單體 120% 傷害（2 段），50% 機率燃燒 2 回合',
            effects: [
                {type: 'damage', target: 'enemy', mult: 1.2, hits: [0.6, 0.4]},
                {type: 'status', target: 'same', status: 'burn', turns: 2, chance: 0.5, dotMult: 0.25},
            ],
        }],
    },
    gargoyle: {
        name: '石像鬼', faction: 'undead', element: 'dark', role: 'tank', img: 'm6',
        stats: {hp: 1500, atk: 150, def: 160, spd: 86},
        skills: [{
            name: '石化凝視', cd: 4, show: 1800, vfx: [{id: 'quicksand-seal', main: true, hit: 0}], desc: '單體 90% 傷害，40% 機率凍結 1 回合，自己嘲諷 1 回合',
            effects: [
                {type: 'damage', target: 'enemy', mult: 0.9},
                {type: 'status', target: 'same', status: 'freeze', turns: 1, chance: 0.4},
                {type: 'status', target: 'self', status: 'taunt', turns: 1, chance: 1},
            ],
        }],
    },
    imp: {
        name: '小惡魔', faction: 'undead', element: 'fire', role: 'mage', img: 'm7', size: 0.8,
        stats: {hp: 900, atk: 200, def: 60, spd: 108},
        skills: [{
            name: '地獄火雨', cd: 3, show: 2000, vfx: [{id: 'flame-surge', at: 'foes', main: true, hit: 0}, {id: 'fire-explosion', at: 'foes', delay: 350, hit: 1}], desc: '全體 60% 傷害（2 段）',
            effects: [{type: 'damage', target: 'enemies', mult: 0.6, hits: [0.5, 0.5]}],
        }],
    },
    cultist: {
        name: '邪教徒', faction: 'undead', element: 'dark', role: 'support', img: 'm8',
        stats: {hp: 1000, atk: 150, def: 75, spd: 104},
        skills: [{
            name: '黑暗獻祭', cd: 3, show: 1800, vfx: [{id: 'healing-field', at: 'friends', main: true}], desc: '回復友方全體 150% 攻擊力的生命', healOnly: true,
            effects: [{type: 'heal', target: 'allies', mult: 1.5}],
        }],
    },
    spider: {
        name: '劇毒蛛', faction: 'beast', element: 'wind', role: 'assassin', img: 'm11', size: 0.85,
        stats: {hp: 900, atk: 170, def: 60, spd: 124},
        passives: [{name: '毒牙', desc: '普攻 50% 機率中毒 2 回合', type: 'poisonOnBasic', chance: 0.5, dotMult: 0.25}],
    },
    lavaGolem: {
        name: '熔岩元素', faction: 'beast', element: 'fire', role: 'tank', img: 'm12',
        stats: {hp: 1700, atk: 160, def: 130, spd: 84},
        passives: [{name: '熔岩爆裂', desc: '死亡時對敵方全體造成 60% 傷害', type: 'deathExplode', mult: 0.6}],
    },
    smallSpider: {
        name: '小蛛', faction: 'beast', element: 'wind', role: 'assassin', img: 'm11', size: 0.55, summoned: true,
        stats: {hp: 450, atk: 120, def: 40, spd: 128},
    },

    // ───────── 主線章節首領 ─────────
    boneKnight: {
        name: '骸骨騎士', faction: 'undead', element: 'dark', role: 'tank', img: 'm9', boss: true,
        stats: {hp: 7000, atk: 190, def: 170, spd: 92, res: 0.2},
        skills: [{
            name: '碎骨盾擊', cd: 2, show: 2200, vfx: [{id: 'shockwave', main: true, hit: 0}, {id: 'weapon-smear', delay: 350, hit: 1}], desc: '敵方前排 140% 傷害（2 段），50% 機率破甲 2 回合',
            effects: [
                {type: 'damage', target: 'enemyFront', mult: 1.4, hits: [0.5, 0.5]},
                {type: 'status', target: 'same', status: 'defDown', turns: 2, chance: 0.5},
            ],
        }],
        passives: [{name: '不死意志', desc: '每次輪到自己時回復 4% 生命', type: 'regenOnTurn', pct: 0.04}],
    },
    warlordBoss: {
        name: '亡靈督軍', faction: 'undead', element: 'dark', role: 'tank', img: 'h_s1_ssr1', boss: true,
        stats: {hp: 8000, atk: 210, def: 190, spd: 90, res: 0.2},
        skills: [
            {
                name: '號令衝鋒', cd: 3, show: 2400, vfx: [{id: 'smoke-column', at: 'self', main: true}, {id: 'azure-sweep', at: 'foes', delay: 400, hit: 0}, {id: 'shockwave', at: 'foes', delay: 700, hit: 1}], desc: '敵方全體 90% 傷害（2 段）',
                effects: [{type: 'damage', target: 'enemies', mult: 0.9, hits: [0.5, 0.5]}],
            },
            {
                name: '死亡怒吼', cd: 4, show: 1800, vfx: [{id: 'smoke-column', at: 'self', main: true}, {id: 'shockwave', at: 'self', delay: 200}], desc: '嘲諷 2 回合，獲得最大生命 20% 護盾',
                effects: [
                    {type: 'status', target: 'self', status: 'taunt', turns: 2, chance: 1},
                    {type: 'shield', target: 'self', pctMaxHp: 0.2},
                ],
            },
        ],
    },
    spiderQueen: {
        name: '毒蛛女王', faction: 'beast', element: 'wind', role: 'assassin', img: 'm11', boss: true,
        stats: {hp: 8500, atk: 220, def: 120, spd: 112, res: 0.2},
        skills: [
            {
                name: '產卵', cd: 5, show: 2000, vfx: [{id: 'venom-pool', at: 'self', main: true}], desc: '召喚 2 隻小蛛',
                effects: [{type: 'summon', unit: 'smallSpider', count: 2, atb: 0.5}],
            },
            {
                name: '劇毒蛛網', cd: 3, show: 2400, vfx: [{id: 'binding-curse', at: 'foes', hit: 0}, {id: 'venom-pool', at: 'foes', each: true, delay: 400, hit: 1}], desc: '敵方全體 70% 傷害（2 段），中毒 2 回合，50% 機率減速',
                effects: [
                    {type: 'damage', target: 'enemies', mult: 0.7, hits: [0.4, 0.6]},
                    {type: 'status', target: 'same', status: 'poison', turns: 2, chance: 1, dotMult: 0.25},
                    {type: 'status', target: 'same', status: 'slow', turns: 2, chance: 0.5},
                ],
            },
        ],
    },
    plagueBoss: {
        name: '瘟疫使者', faction: 'undead', element: 'fire', role: 'mage', img: 'h_s1_ssr2', boss: true,
        stats: {hp: 8500, atk: 240, def: 110, spd: 104, res: 0.2},
        skills: [
            {
                name: '瘟疫爆發', cd: 4, show: 2600, vfx: [{id: 'venom-stream', at: 'foes', hit: 0}, {id: 'darkchain-detonation', at: 'foes', delay: 450, hit: 1}, {id: 'ground-fog', at: 'foes', delay: 800, hit: 2}], desc: '敵方全體 110% 傷害（3 段）',
                effects: [{type: 'damage', target: 'enemies', mult: 1.1, hits: [0.3, 0.4, 0.3]}],
            },
            {
                name: '瘟疫之雲', cd: 2, show: 2200, vfx: [{id: 'venom-stream', at: 'foes', main: true, hit: 0}, {id: 'ground-fog', at: 'foes', delay: 300, hit: 1}], desc: '全體 60% 傷害（2 段），60% 機率中毒 2 回合',
                effects: [
                    {type: 'damage', target: 'enemies', mult: 0.6, hits: [0.6, 0.4]},
                    {type: 'status', target: 'same', status: 'poison', turns: 2, chance: 0.6, dotMult: 0.3},
                ],
            },
        ],
    },
    sandWorm: {
        name: '巨沙蟲', faction: 'beast', element: 'wind', role: 'warrior', img: 'm15', boss: true,
        stats: {hp: 10000, atk: 230, def: 140, spd: 96, res: 0.2},
        skills: [
            {
                name: '吞噬', cd: 3, show: 2400, vfx: [{id: 'quicksand-seal', hit: 0}, {id: 'dimensional-rend', delay: 400, hit: 1}, {id: 'shockwave', delay: 750, hit: 2}], desc: '單體 260% 傷害（3 段）',
                effects: [{type: 'damage', target: 'enemy', mult: 2.6, hits: [0.3, 0.3, 0.4]}],
            },
            {
                name: '沙暴', cd: 4, show: 2400, vfx: [{id: 'dust-devil', at: 'foes', hit: 0}, {id: 'shockwave', at: 'foes', delay: 450, hit: 1}], desc: '敵方全體 80% 傷害（2 段），拉條 20%',
                effects: [
                    {type: 'damage', target: 'enemies', mult: 0.8, hits: [0.5, 0.5]},
                    {type: 'pull', target: 'same', pct: 0.2},
                ],
            },
        ],
    },
    frostLichLord: {
        name: '冰霜巫妖領主', faction: 'undead', element: 'water', role: 'mage', img: 'm10', boss: true,
        stats: {hp: 10500, atk: 245, def: 130, spd: 100, res: 0.25},
        skills: [
            {
                name: '永凍暴風雪', cd: 4, show: 2800, vfx: [{id: 'frost-lance-rain', at: 'foes', hit: 0}, {id: 'ice-shatter', at: 'foes', each: true, delay: 450, hit: 1}, {id: 'frost-field', at: 'foes', delay: 850, hit: 2}], desc: '敵方全體 100% 傷害（3 段），25% 機率凍結 1 回合',
                effects: [
                    {type: 'damage', target: 'enemies', mult: 1.0, hits: [0.3, 0.3, 0.4]},
                    {type: 'status', target: 'same', status: 'freeze', turns: 1, chance: 0.25},
                ],
            },
            {
                name: '寒冰箭', cd: 2, show: 1800, vfx: [{id: 'frost-wheel', main: true, hit: 0}, {id: 'ice-shatter', delay: 250, hit: 1}], desc: '單體 150% 傷害（2 段），35% 機率凍結 1 回合',
                effects: [
                    {type: 'damage', target: 'enemy', mult: 1.5, hits: [0.6, 0.4]},
                    {type: 'status', target: 'same', status: 'freeze', turns: 1, chance: 0.35},
                ],
            },
        ],
        passives: [{name: '寒冰護甲', desc: '效果抵抗 +20%', type: 'statUp', stat: 'res', flat: 0.2}],
    },
    voidFiend: {
        name: '虛空魔', faction: 'undead', element: 'dark', role: 'mage', img: 'm_void', boss: true,
        stats: {hp: 11000, atk: 260, def: 130, spd: 106, res: 0.25},
        skills: [
            {
                name: '虛空黑洞', cd: 4, show: 3000, vfx: [{id: 'black-hole', at: 'foes', pull: 1200, dark: 1500, hit: 0}, {id: 'darkchain-detonation', at: 'foes', delay: 1300, hit: 1}, {id: 'energy-burst', at: 'foes', delay: 1650, hit: 2}], desc: '敵方全體 110% 傷害（3 段），拉條 25%',
                effects: [
                    {type: 'damage', target: 'enemies', mult: 1.1, hits: [0.2, 0.4, 0.4]},
                    {type: 'pull', target: 'same', pct: 0.25},
                ],
            },
            {
                name: '虛空吞噬', cd: 2, show: 2000, vfx: [{id: 'soul-siphon', main: true, hit: 0, ticks: [1], tick: 300}], desc: '生命比例最低的敵人 200% 傷害（2 段），50% 機率沉默',
                effects: [
                    {type: 'damage', target: 'enemyLowest', mult: 2.0, hits: [0.5, 0.5]},
                    {type: 'status', target: 'same', status: 'silence', turns: 1, chance: 0.5},
                ],
            },
        ],
    },
    fallenLord: {
        name: '墮落魔王', faction: 'undead', element: 'dark', role: 'warrior', img: 'boss_lucifer', boss: true,
        stats: {hp: 12000, atk: 270, def: 150, spd: 104, res: 0.25},
        skills: [
            {
                name: '魔王降臨', cd: 5, show: 3000, vfx: [{id: 'smoke-column', at: 'self'}, {id: 'astral-convergence', at: 'foes', delay: 500, hit: 0}, {id: 'spatial-sweep', at: 'foes', each: true, delay: 900, hit: 1}, {id: 'energy-burst', at: 'foes', delay: 1300, main: true, hit: 2}], desc: '自己攻擊提升 2 回合，敵方全體 120% 傷害（3 段）',
                effects: [
                    {type: 'status', target: 'self', status: 'atkUp', turns: 2, chance: 1},
                    {type: 'damage', target: 'enemies', mult: 1.2, hits: [0.3, 0.3, 0.4]},
                ],
            },
            {
                name: '墮落斬', cd: 2, show: 2200, vfx: [{id: 'weapon-smear', hit: 0}, {id: 'dimensional-rend', delay: 350, hit: 1}, {id: 'azure-sweep', delay: 700, hit: 2}], desc: '敵方前排 180% 傷害（3 段）',
                effects: [{type: 'damage', target: 'enemyFront', mult: 1.8, hits: [0.3, 0.3, 0.4]}],
            },
        ],
        passives: [{name: '狂暴', desc: '生命低於 30% 後速度 +30%', type: 'enrage', hpBelow: 0.3, spdPct: 0.3}],
    },
    boneDragon: {
        name: '骨龍', faction: 'undead', element: 'fire', role: 'mage', img: 'boss_dragon', boss: true,
        stats: {hp: 13000, atk: 275, def: 160, spd: 98, res: 0.3},
        skills: [
            {
                name: '冥炎龍息', cd: 3, show: 2800, vfx: [{id: 'charged-beam', at: 'foes', hit: 0}, {id: 'flame-surge', at: 'foes', delay: 450, hit: 1}, {id: 'fire-explosion', at: 'foes', delay: 850, main: true, hit: 2}], desc: '敵方全體 130% 傷害（3 段），50% 機率燃燒 2 回合',
                effects: [
                    {type: 'damage', target: 'enemies', mult: 1.3, hits: [0.3, 0.3, 0.4]},
                    {type: 'status', target: 'same', status: 'burn', turns: 2, chance: 0.5, dotMult: 0.3},
                ],
            },
            {
                name: '骨翼颶風', cd: 4, show: 2200, vfx: [{id: 'fire-vortex', at: 'foes', main: true, hit: 0}], desc: '敵方全體 90% 傷害，拉條 25%',
                effects: [
                    {type: 'damage', target: 'enemies', mult: 0.9},
                    {type: 'pull', target: 'same', pct: 0.25},
                ],
            },
        ],
        passives: [{name: '狂暴', desc: '生命低於 30% 後速度 +30%', type: 'enrage', hpBelow: 0.3, spdPct: 0.3}],
    },
};

// 原型的三場戰鬥。rows：front 最多 2 格、back 最多 3 格（首領也佔 1 格）
// bg：直式版背景（assets/bg/）；bgHD：橫式版戰場原畫（assets/hd/land_*.webp）
// 其他橫式戰場（留給主線）：nightcity 暗夜之城、tundra 荒原、icefort 冰冠要塞
RES.ENCOUNTERS = [
    {
        id: 'vanguard', name: '亡靈先鋒', difficulty: '簡單', power: 1.0, bg: '1', bgHD: 'border',
        desc: '混合屬性的雜兵，先熟悉行動條、技能與大招',
        front: ['skeleton', 'corpseBomber'], back: ['cryptBat', 'frostLich', 'skeleton'],
    },
    {
        id: 'plague', name: '瘟疫軍團', difficulty: '普通', power: 1.1, bg: '4', bgHD: 'forest',
        desc: '督軍會嘲諷，瘟疫使者讓全隊中毒',
        front: ['warlord', 'skeleton'], back: ['plagueBringer', 'frostLich', 'cryptBat'],
    },
    {
        id: 'lich', name: '巫妖王', difficulty: '首領', power: 1.15, bg: '6', bgHD: 'throne',
        desc: '會召喚骸骨僕從、凍結並拉條，光屬性與群攻有利',
        front: ['lichKing'], back: ['frostLich', 'frostLich'],
    },
];
