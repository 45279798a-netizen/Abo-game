// 重複使用的特效自動換色。英雄的特效顏色固定用各自的代表色（heroes.js 的 vfxColor，22 位互不重複），這裡不改；
// 只檢查敵人：敵人技能的特效顏色跟英雄或前面的敵人用過的太像時才換。
// 規則：依英雄技能、英雄大招、敵人技能的順序檢查；顏色跟前面用過的太像（色相相差不到 20 度且明暗相近），
// 就從該角色屬性的色票挑一個沒用過的顏色。資料表裡手動指定的顏色只要不撞色就保留。
// 新增特效後若想讓它參與換色，把它的預設顏色加進 DEFAULT（tools/build_vfx.py 匯出的 preset.color）。
(function () {
    const R = window.RES;
    const DEFAULT = {'arc-ray': '#2878ff', 'arcane-matrix': '#bd9aff', 'arcane-missile': '#c99aff', 'astral-convergence': '#c1b8ff', 'astral-gate': '#c1b8ff', 'azure-sweep': '#2878ff', 'billowing-airburst': '#ff7a24', 'binding-curse': '#ae7be5', 'black-hole': '#ffab42', 'burning-ground': '#ff914a', 'charged-beam': '#f6c76c', 'continuous-beam': '#ff6555', 'darkchain-detonation': '#8300ff', 'dimensional-rend': '#729dff', 'dust-devil': '#dcbb87', 'electric-magic-arrow-strike': '#ffd36a', 'energy-burst': '#2878ff', 'energy-vortex': '#bba5ff', 'fire-explosion': '#ff5c26', 'fire-vortex': '#ff884b', 'fireball': '#ff823e', 'flame-surge': '#ff823e', 'frost-field': '#9bdfff', 'frost-lance-rain': '#a9dfff', 'frost-wheel': '#a9dfff', 'golden-chain-rain': '#ffd166', 'ground-fog': '#a6c9ca', 'healing-field': '#86e9b2', 'ice-shard': '#b3dcff', 'ice-shatter': '#b8e5ff', 'magic-barrier': '#bba3ff', 'magma-fissure': '#ff823e', 'painterly-grass': '#829544', 'plasma-bolt': '#73e3ff', 'prism-guard': '#73e3ff', 'prism-parry': '#ffe3a0', 'pulse-beam': '#71e7dc', 'quicksand-seal': '#dfba7c', 'radiant-beam': '#ffe3a0', 'revival-bloom': '#ff8fbd', 'sacred-relic-descent': '#f5cc75', 'shadow-glaive': '#a28bce', 'shockwave': '#f0cf9d', 'smoke-column': '#aeb9cb', 'smoke-puff': '#b1afc8', 'soul-siphon': '#a883e8', 'spatial-smear': '#e9f5ff', 'spatial-sweep': '#e9f5ff', 'spiral-gale': '#b4e5d5', 'steam-jet': '#d1dfe8', 'thorn-crown': '#88d49a', 'thunder-strike': '#2878ff', 'tidal-surge': '#66cddd', 'venom-pool': '#acdc6f', 'venom-stream': '#acdc6f', 'weapon-smear': '#2878ff', 'wind-vortex': '#a4dfd1'};
    const FIXED = new Set(['starblade-cataclysm', 'starblade-explosion']);   // 獨立特效不能換色
    const PALETTE = {
        fire:  ['#ff6b35', '#dc2626', '#ffb347', '#fde047', '#be123c', '#fff1d6', '#f97316', '#ff3d3d'],
        water: ['#38bdf8', '#1d4ed8', '#22d3ee', '#bae6fd', '#6366f1', '#0ea5e9', '#e0f2fe'],
        wind:  ['#86efac', '#16a34a', '#a3e635', '#2dd4bf', '#ecfccb', '#0d9488', '#4ade80'],
        light: ['#fde68a', '#f59e0b', '#fffbeb', '#fbbf24', '#fef08a', '#f5d0fe', '#fcd34d'],
        dark:  ['#a78bfa', '#5b21b6', '#c084fc', '#ff2d55', '#991b1b', '#e879f9', '#4c1d95'],
    };
    const ALL = Object.values(PALETTE).flat();
    const hsl = hex => {
        const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
        let h = 0;
        if (dd) h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
        return {h: (h * 60 + 360) % 360, s: dd ? dd / (1 - Math.abs(2 * l - 1)) : 0, l};
    };
    const close = (a, b) => {
        const x = hsl(a), y = hsl(b);
        if (x.s < 0.15 && y.s < 0.15) return Math.abs(x.l - y.l) < 0.2;   // 都接近白／灰
        const dh = Math.min(Math.abs(x.h - y.h), 360 - Math.abs(x.h - y.h));
        return dh < 20 && Math.abs(x.l - y.l) < 0.12;
    };
    const used = {};   // 特效 id → 已用過的顏色
    function fix(owner, sk) {
        if (!sk?.vfx) return;
        const steps = Array.isArray(sk.vfx) ? sk.vfx : [sk.vfx];
        const mine = {};   // 同一招裡同一個特效用同一個顏色
        for (const st of steps) {
            if (FIXED.has(st.id)) continue;
            if (mine[st.id]) { st.color = mine[st.id]; continue; }
            const list = used[st.id] = used[st.id] || [];
            let c = st.color || DEFAULT[st.id];
            if (c && list.some(u => close(u, c))) {
                const pool = [...(PALETTE[owner.element] || []), ...ALL];
                c = pool.find(p => !list.some(u => close(u, p))) || c;
                st.color = c;
            }
            if (c) list.push(c);
            mine[st.id] = st.color || c;
        }
    }
    // 英雄：只登記顏色，不換
    for (const h of Object.values(R.HEROES)) for (const sk of [h.skill, h.ult]) for (const st of [].concat(sk?.vfx || [])) {
        const c = st.color || DEFAULT[st.id];
        if (c && !FIXED.has(st.id)) (used[st.id] = used[st.id] || []).push(c);
    }
    for (const e of Object.values(R.ENEMIES)) (e.skills || []).forEach(s => fix(e, s));
})();
