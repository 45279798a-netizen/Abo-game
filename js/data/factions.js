// 陣營：故事上的勢力。隊伍裡同陣營 3 人（或 5 人）時，全隊獲得該陣營的被動加成。
// 新增陣營 = 在這裡加一筆（名稱、顏色、被動）。
// passive.tiers 的數值：
//   startShield 開場護盾（最大生命比例）  defUp 防禦提升  regen 每次輪到自己時回復（最大生命比例）
//   vsUndead 對亡靈傷害提升  spdUp 速度提升  startPush 開場推條  lowHpAtk 生命低於一半時攻擊提升
//   crit 暴擊率  critDmg 暴擊傷害
window.RES = window.RES || {};

RES.FACTIONS = {
    kingdom: {
        name: '獅心王國', short: '王國', color: '#60a5fa',
        passive: {
            name: '王國方陣',
            tiers: {
                3: {startShield: 0.10, desc: '開場全隊獲得最大生命 10% 的護盾'},
                5: {startShield: 0.15, defUp: 0.15, desc: '開場全隊獲得 15% 護盾，防禦 +15%'},
            },
        },
    },
    church: {
        name: '聖光教團', short: '教團', color: '#facc15',
        passive: {
            name: '聖光庇佑',
            tiers: {
                3: {regen: 0.03, vsUndead: 0.10, desc: '每次輪到自己時回復 3% 生命，對亡靈傷害 +10%'},
                5: {regen: 0.05, vsUndead: 0.20, desc: '每次輪到自己時回復 5% 生命，對亡靈傷害 +20%'},
            },
        },
    },
    forest: {
        name: '翠林盟約', short: '翠林', color: '#34d399',
        passive: {
            name: '林間疾行',
            tiers: {
                3: {spdUp: 0.08, startPush: 0.15, desc: '全隊速度 +8%，開場推條 15%'},
                5: {spdUp: 0.15, startPush: 0.25, desc: '全隊速度 +15%，開場推條 25%'},
            },
        },
    },
    wild: {
        name: '荒原部族', short: '荒原', color: '#f87171',
        passive: {
            name: '背水之怒',
            tiers: {
                3: {lowHpAtk: 0.15, desc: '生命低於一半時攻擊 +15%'},
                5: {lowHpAtk: 0.25, desc: '生命低於一半時攻擊 +25%'},
            },
        },
    },
    night: {
        name: '暗夜結社', short: '暗夜', color: '#a78bfa',
        passive: {
            name: '暗影獵殺',
            tiers: {
                3: {crit: 0.10, desc: '全隊暴擊率 +10%'},
                5: {crit: 0.15, critDmg: 0.20, desc: '全隊暴擊率 +15%，暴擊傷害 +20%'},
            },
        },
    },
    // 敵方陣營（S1 玩家不能使用）
    undead: {name: '亡靈天災', short: '亡靈', color: '#84cc16', passive: null},
};

// 能量與個人大招：
//   每位英雄有一條能量條，自己出手 +perAction、被打（不含持續傷害）+perHit，滿 max 就能放大招。
//   大招會插隊立刻放出，不佔回合。手動模式點頭像放，自動模式滿了就放。
RES.ENERGY = {
    start: 0,        // 開場能量
    perAction: 12,
    perHit: 3,
    max: 100,
};

// 開場行動條隨機範圍（0～此值），越大出手順序越分散
RES.START_ATB_SPREAD = 500;
