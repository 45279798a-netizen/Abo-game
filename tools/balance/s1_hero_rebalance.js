// 英雄技能平衡調整（試算版，尚未套用到 js/data/heroes.js）。檢查：EF=0.93 PATCH=tools/balance/s1_hero_rebalance.js node tools/hero_balance.js 4000
const H = RES.HEROES;
const E = (id, which, i) => (which === 'u' ? H[id].ult : H[id].skill).effects[i];
E('arthur','u',0).pctMaxHp = 0.12;
E('valkyrie','s',0).pctMaxHp = 0.08; E('valkyrie','u',0).turns = 1; H.valkyrie.ult.effects.push({type:'shield',target:'allies',pctMaxHp:0.08,ofCaster:true});
E('elara','s',0).mult = 1.6; E('elara','u',0).mult = 2.5;
E('uther','s',0).pctMaxHp = 0.11;
E('thorin','u',1).pctMaxHp = 0.2;
E('mist','s',0).mult = 1.0; E('mist','s',1).chance = 0.5; E('mist','u',0).mult = 1.6;
E('militia','s',0).mult = 1.7; E('militia','s',1).chance = 0.6; E('militia','u',0).mult = 2.4;
E('fang','s',0).mult = 2.3; E('fang','u',0).mult = 2.6;
E('faye','s',0).mult = 2.0; E('faye','u',0).mult = 1.6;
E('monk','s',0).mult = 1.6; E('monk','u',0).mult = 3.3;
E('draven','s',0).mult = 1.9; E('draven','u',0).mult = 3.5;
E('dart','s',0).mult = 1.2; E('dart','u',0).mult = 1.2;
E('noah','s',0).mult = 1.0; E('noah','u',0).mult = 1.7;
E('shadow','s',0).mult = 2.9; E('shadow','u',0).mult = 4.5;
E('lilith','s',0).mult = 1.7; E('lilith','u',0).mult = 1.5;
E('seraph','u',0).mult = 1.7;
E('zeke','s',0).mult = 1.0; E('zeke','u',0).mult = 2.0;
E('gideon','s',0).mult = 1.9; E('gideon','u',0).mult = 4.2;
E('gaia','s',0).mult = 0.85; E('gaia','u',0).mult = 1.4;
E('mortheus','s',0).mult = 2.1; E('mortheus','u',0).mult = 2.3;
// 第 2 輪
E('arthur','s',1).pctMaxHp = 0.15; H.arthur.passive.pct = 0.15;
H.gaia.skill.effects.push({type:'status',target:'self',status:'taunt',turns:1,chance:1});
H.gaia.ult.effects.push({type:'shield',target:'allies',pctMaxHp:0.08,ofCaster:true});
H.thorin.passive.pct = 0.3; E('thorin','u',1).pctMaxHp = 0.3; H.thorin.skill.effects.push({type:'shield',target:'self',pctMaxHp:0.12});
E('elara','s',0).mult = 1.3; E('elara','u',0).mult = 2.2;
H.seraph.skill.effects.push({type:'heal',target:'allies',mult:0.8}); E('seraph','u',0).mult = 2.0;
E('lilith','s',0).teamHealPct = 0.8; E('lilith','u',0).teamHealPct = 0.5;
H.lyra.skill.effects.push({type:'heal',target:'allies',mult:0.7});
E('noah','s',0).mult = 1.1; E('noah','u',0).mult = 1.9;
E('mist','s',0).mult = 1.1; E('mist','u',0).mult = 1.8;
E('draven','s',0).mult = 2.0;
// 第 3 輪
E('arthur','s',1).pctMaxHp = 0.12;
E('gaia','u',3).pctMaxHp = 0.12; H.gaia.passive.pct = 0.08;
E('elara','s',0).mult = 1.15;
E('lilith','s',0).mult = 1.9; E('lilith','u',0).mult = 1.7;
E('noah','s',0).mult = 1.2; E('noah','u',0).mult = 2.0;
E('mist','u',0).mult = 1.9;
// 第 4 輪
E('lyra','s',1).mult = 0.45;
E('valkyrie','u',0).turns = 2;
E('militia','s',0).mult = 1.9; E('militia','u',0).mult = 2.7;
E('lilith','s',0).teamHealPct = 1.0;
E('arthur','s',1).pctMaxHp = 0.15;
// 第 5 輪
E('valkyrie','s',0).pctMaxHp = 0.11;
H.arthur.passive.pct = 0.10;
E('thorin','s',3).pctMaxHp = 0.16;
E('mist','u',0).mult = 2.0;
