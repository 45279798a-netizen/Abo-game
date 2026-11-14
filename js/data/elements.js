// 屬性：只負責克制關係。新增屬性只要在這裡加一筆，並寫好 beats（剋誰）。
window.RES = window.RES || {};

RES.ELEMENTS = {
    fire:  {name: '火', icon: '🔥', color: '#fb923c', beats: ['wind']},
    wind:  {name: '風', icon: '🌪️', color: '#4ade80', beats: ['water']},
    water: {name: '水', icon: '💧', color: '#38bdf8', beats: ['fire']},
    light: {name: '光', icon: '☀️', color: '#fde047', beats: ['dark']},
    dark:  {name: '暗', icon: '🌑', color: '#c084fc', beats: ['light']},
};

RES.ELEMENT_ADV = 1.3;   // 克制方傷害倍率
RES.ELEMENT_DIS = 0.85;  // 被克方傷害倍率

// 回傳 'adv'（克制）、'dis'（被克）或 null
RES.elementRelation = function (atkEl, defEl) {
    const a = RES.ELEMENTS[atkEl], d = RES.ELEMENTS[defEl];
    if (!a || !d) return null;
    if (a.beats.includes(defEl)) return 'adv';
    if (d.beats.includes(atkEl)) return 'dis';
    return null;
};
