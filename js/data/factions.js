// 陣營：只負責大招。隊伍裡同陣營 3 人以上就有共鳴條，集滿可放大招（合體技）。
// combo.vfx：大招的多段特效（格式同 heroes.js 的技能 vfx）；show：演出長度（毫秒）；impactFrame：命中時畫面定格。
// 新增陣營 = 在這裡加一筆（名稱、顏色、合體技）。
window.RES = window.RES || {};

RES.FACTIONS = {
    kingdom: {
        name: '獅心王國', short: '王國', color: '#60a5fa',
        combo: {
            show: 4200, vfx: [{id: 'astral-gate', at: 'friends', color: '#fde68a', size: 1.4}, {id: 'radiant-beam', at: 'friends', sky: true, color: '#93c5fd', delay: 700}, {id: 'magic-barrier', at: 'friends', color: '#93c5fd', size: 1.8, delay: 1000, main: true}, {id: 'prism-guard', at: 'friends', size: 1.5, delay: 1300}],
            name: '王國號令', desc: '全隊獲得最大生命 15% 的護盾，攻擊 +20%（2 回合）',
            effects: [
                {type: 'shield', target: 'allies', pctMaxHp: 0.15},
                {type: 'status', target: 'allies', status: 'atkUp', turns: 2, chance: 1},
            ],
        },
    },
    church: {
        name: '聖光教團', short: '教團', color: '#facc15',
        combo: {
            show: 4800, impactFrame: true, vfx: [{id: 'starblade-cataclysm', at: 'foes', main: true}, {id: 'starblade-explosion', at: 'foes', size: 1.2, delay: 2250}, {id: 'healing-field', at: 'friends', color: '#fde68a', delay: 2700}],
            name: '神聖審判', desc: '對全體敵人造成 160% 傷害（對亡靈天災 +30%），並淨化我方全體 1 個減益',
            effects: [
                {type: 'damage', target: 'enemies', mult: 1.6, bonusVsFaction: {undead: 0.3}},
                {type: 'cleanse', target: 'allies', count: 1},
            ],
        },
    },
    forest: {
        name: '翠林盟約', short: '翠林', color: '#34d399',
        combo: {
            show: 4200, impactFrame: true, vfx: [{id: 'painterly-grass', at: 'foes', size: 1.2}, {id: 'wind-vortex', at: 'foes', size: 1.8, delay: 300}, {id: 'thorn-crown', at: 'foes', each: true, delay: 900, stagger: 120, main: true}, {id: 'binding-curse', at: 'foes', color: '#34d399', size: 1.4, delay: 1100}],
            name: '森林纏繞', desc: '對全體敵人造成 90% 傷害，拉條 35%，並減速 2 回合',
            effects: [
                {type: 'damage', target: 'enemies', mult: 0.9},
                {type: 'pull', target: 'same', pct: 0.35},
                {type: 'status', target: 'same', status: 'slow', turns: 2, chance: 1},
            ],
        },
    },
    wild: {
        name: '荒原部族', short: '荒原', color: '#f87171',
        combo: {
            show: 3800, vfx: [{id: 'fire-vortex', at: 'friends', size: 1.6, main: true}, {id: 'flame-surge', at: 'friends', size: 1.2, delay: 500}, {id: 'magma-fissure', at: 'friends', delay: 900}],
            name: '戰嚎', desc: '全隊攻擊 +30%（2 回合），觸發者立即再行動一次',
            effects: [
                {type: 'status', target: 'allies', status: 'atkUp', turns: 2, chance: 1},
                {type: 'push', target: 'trigger', pct: 1.0},
            ],
        },
    },
    night: {
        name: '暗夜結社', short: '暗夜', color: '#a78bfa',
        combo: {
            show: 4200, impactFrame: true, vfx: [{id: 'black-hole', at: 'targets', each: true, size: 0.6}, {id: 'shadow-glaive', color: '#a78bfa', delay: 900}, {id: 'darkchain-detonation', at: 'targets', each: true, delay: 1200, main: true}],
            name: '月蝕處決', desc: '對生命比例最低的 2 個敵人造成 260% 傷害，生命低於 20% 直接斬殺（首領除外）',
            effects: [
                {type: 'damage', target: 'enemyLowest2', mult: 2.6, execute: 0.2},
            ],
        },
    },
    // 敵方陣營（S1 玩家不能使用）
    undead: {name: '亡靈天災', short: '亡靈', color: '#84cc16', combo: null},
};

// 共鳴（合體技）規則：
//   隊伍裡同陣營 3 人以上，該陣營就有一條共鳴條。
//   該陣營的英雄每出手一次，共鳴 +10%；集滿 100% 就能放合體技（大招），放完歸零。
//   大招會插隊立刻放出，不佔用任何人的回合。手動模式按按鈕放，自動模式滿了就放。
RES.RESONANCE = {
    minMembers: 3,      // 同陣營幾人以上才有共鳴條
    gainPerAction: 10,  // 每次出手增加多少
    max: 100,
};

// 開場行動條隨機範圍（0～此值），越大出手順序越分散
RES.START_ATB_SPREAD = 500;
