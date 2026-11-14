// 畫面：編隊 → 戰鬥 → 結算。戰鬥邏輯全部在 js/core/battle.js，這裡只負責顯示與操作。
(function () {
    const R = window.RES;
    const $ = s => document.querySelector(s);
    const imgSrc = img => `assets/portraits/${img}.webp`;
    const SPEEDS = [1, 2, 3];
    const BASE_DELAY = 750;

    const state = {
        team: RES.PRESET_TEAMS[0].team.slice(),
        encounter: 'vanguard',
        auto: true,
        speed: 1,
        paused: false,
        ultMode: loadPref('ultMode', 'full'),   // 大招演出：full 完整／short 簡短／off 關閉
        ultSkip: null,
        battle: null,
        runId: 0,
    };

    function loadPref(key, def) {
        try { return localStorage.getItem('pr_' + key) || def; } catch (e) { return def; }
    }
    function savePref(key, v) {
        try { localStorage.setItem('pr_' + key, v); } catch (e) { /* 無法儲存就算了 */ }
    }

    function h(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const wait = ms => sleep(ms / state.speed);
    const facColor = f => R.FACTIONS[f]?.color || '#888';
    const elIcon = e => R.ELEMENTS[e]?.icon || '';

    // ═════════ 編隊畫面 ═════════
    function renderSetup() {
        renderEncounters();
        renderSlots();
        renderGrid();
        renderHint();
        $('#btn-start').disabled = state.team.length === 0;
    }

    function renderEncounters() {
        const box = $('#encounter-list');
        box.innerHTML = '';
        for (const enc of R.ENCOUNTERS) {
            const els = [...new Set([...enc.front, ...enc.back].map(id => R.ENEMIES[id].element))];
            const b = h('button', 'enc' + (state.encounter === enc.id ? ' sel' : ''), `
                <span class="enc-name">${enc.name}</span>
                <span class="enc-diff d-${enc.difficulty}">${enc.difficulty}</span>
                <span class="enc-desc">${enc.desc}</span>
                <span class="enc-els">敵方 ${els.map(elIcon).join('')}</span>`);
            b.onclick = () => { state.encounter = enc.id; renderEncounters(); };
            box.appendChild(b);
        }
    }

    function renderSlots() {
        const box = $('#team-slots');
        box.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const id = state.team[i];
            const label = i < 2 ? `前排${i + 1}` : `後排${i - 1}`;
            const b = h('button', 'slot' + (id ? ' filled' : ''));
            if (id) {
                const d = R.HEROES[id];
                b.style.borderColor = facColor(d.faction);
                b.innerHTML = `<span class="slot-label">${label}</span><img src="${imgSrc(d.img)}" alt=""><span class="slot-name">${elIcon(d.element)} ${shortName(d.name)}</span>`;
                b.onclick = () => toggleHero(id);
            } else {
                b.innerHTML = `<span class="slot-label">${label}</span><span class="slot-empty">＋</span>`;
            }
            box.appendChild(b);
        }
        const p = $('#presets');
        p.innerHTML = '';
        for (const preset of R.PRESET_TEAMS) {
            const b = h('button', '', preset.name);
            b.onclick = () => { state.team = preset.team.slice(); renderSetup(); };
            p.appendChild(b);
        }
        const clear = h('button', '', '清空');
        clear.onclick = () => { state.team = []; renderSetup(); };
        p.appendChild(clear);
    }

    function shortName(n) { return n.includes('·') ? n.split('·')[1] : n; }

    function renderGrid() {
        const box = $('#hero-grid');
        box.innerHTML = '';
        const order = Object.keys(R.FACTIONS);
        const rarOrder = ['UR', 'SSR', 'SR', 'R'];
        const ids = Object.keys(R.HEROES).sort((a, b) => {
            const A = R.HEROES[a], B = R.HEROES[b];
            return order.indexOf(A.faction) - order.indexOf(B.faction) || rarOrder.indexOf(A.rarity) - rarOrder.indexOf(B.rarity);
        });
        for (const id of ids) {
            const d = R.HEROES[id];
            const idx = state.team.indexOf(id);
            const card = h('button', 'hcard' + (idx >= 0 ? ' sel' : ''), `
                <img src="${imgSrc(d.img)}" alt="" loading="lazy">
                <span class="h-rar" style="color:${R.RARITY[d.rarity].color}">${d.rarity}</span>
                <span class="h-el">${elIcon(d.element)}</span>
                <span class="h-i">i</span>
                <span class="h-fac" style="background:${facColor(d.faction)}"></span>
                <span class="h-order">${idx + 1}</span>
                <div class="h-info">
                    <div class="h-name">${shortName(d.name)}</div>
                    <div class="h-meta"><span style="color:${facColor(d.faction)}">${R.FACTIONS[d.faction].short}</span>${R.ROLES[d.role].name}</div>
                </div>`);
            card.onclick = e => {
                if (e.target.closest('.h-i')) showHeroInfo(id);
                else toggleHero(id);
            };
            box.appendChild(card);
        }
    }

    function toggleHero(id) {
        const i = state.team.indexOf(id);
        if (i >= 0) state.team.splice(i, 1);
        else if (state.team.length < 5) state.team.push(id);
        renderSetup();
    }

    function renderHint() {
        const counts = {};
        state.team.forEach(id => { const f = R.HEROES[id].faction; counts[f] = (counts[f] || 0) + 1; });
        const lines = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([f, n]) => {
            const fac = R.FACTIONS[f];
            const name = `<b style="color:${fac.color}">${fac.name}</b>`;
            if (n >= R.CHAIN_COMBO_AT) return `${name} ×${n}：可觸發合體技「${fac.combo.name}」`;
            return `${name} ×${n}：只能連鎖加傷害，還差 ${R.CHAIN_COMBO_AT - n} 位才能觸發合體技`;
        });
        $('#team-hint').innerHTML = lines.join('<br>') || '選 5 位英雄。同陣營 3 位以上才能觸發合體技。';
    }

    function showHeroInfo(id) {
        const d = R.HEROES[id];
        const role = R.ROLES[d.role];
        const m = R.RARITY[d.rarity].mult;
        const fac = R.FACTIONS[d.faction];
        const el = R.ELEMENTS[d.element];
        const beats = el.beats.map(b => R.ELEMENTS[b].icon + R.ELEMENTS[b].name).join('、');
        openModal(`
            <div class="info-head">
                <img src="${imgSrc(d.img)}" alt="">
                <div>
                    <h3>${d.name}</h3>
                    <span class="tag" style="color:${R.RARITY[d.rarity].color}">${d.rarity}</span>
                    <span class="tag" style="color:${fac.color}">${fac.name}</span>
                    <span class="tag">${el.icon} ${el.name}屬性</span>
                    <span class="tag">${role.name}</span>
                    <p style="margin:6px 0 0;font-size:12px">生命 ${Math.round(role.hp * m)}・攻擊 ${Math.round(role.atk * m)}<br>防禦 ${Math.round(role.def * m)}・速度 ${role.spd}<br>克制：${beats}</p>
                </div>
            </div>
            <div class="skill-box"><span class="k">主動・冷卻 ${d.skill.cd}</span><b>${d.skill.name}</b><br>${d.skill.desc}</div>
            <div class="skill-box"><span class="k">被動</span><b>${d.passive.name}</b><br>${d.passive.desc}</div>
            <div class="skill-box"><span class="k">陣營合體技</span><b style="color:${fac.color}">${fac.combo.name}</b><br>${fac.combo.desc}</div>
            <div class="row-btns"><button class="btn-secondary" data-close>關閉</button></div>`);
    }

    function showHelp() {
        openModal(`
            <h3>怎麼玩</h3>
            <ul>
                <li><b>行動條</b>：每個角色依速度累積行動條，滿了就出手。上方「行動順序」顯示接下來誰動。</li>
                <li><b>連鎖</b>：同陣營英雄<b>接連</b>出手會形成連鎖，第 2 人傷害 +15%、第 3 人 +30%。中間只要插進一個敵人（或其他陣營）就斷掉。</li>
                <li><b>合體技</b>：連鎖到第 3 人時觸發該陣營的合體技。同一陣營觸發後要冷卻 ${R.COMBO_COOLDOWN_ROUNDS} 回合。</li>
                <li><b>連攜點與「連攜！」</b>：開場有 ${R.CHAIN_POINTS_START} 點，之後每 ${R.CHAIN_POINT_EVERY_ROUNDS} 回合 +1（最多 ${R.CHAIN_POINTS_MAX}）。連鎖進行中按「連攜！」花 1 點，把下一位同陣營隊友拉到現在出手。自動模式下，電腦只在能湊滿合體技時才用。</li>
                <li><b>屬性克制</b>：🔥火 → 🌪️風 → 💧水 → 🔥火，☀️光 ↔ 🌑暗。克制方傷害 ×1.3，被剋 ×0.85。合體技不吃屬性。</li>
                <li><b>站位</b>：一般攻擊先打前排；射手打生命比例最低的、刺客打生命最少的。</li>
                <li><b>推條／拉條</b>：讓目標行動條增加／減少，用來排出手順序。首領被拉條效果減半。</li>
                <li>${Battle.MAX_ROUNDS} 回合內沒打完算輸。</li>
            </ul>
            <div class="row-btns"><button class="btn-secondary" data-close>知道了</button></div>`);
    }

    function openModal(html) {
        const m = $('#modal');
        m.innerHTML = `<div class="sheet">${html}</div>`;
        m.classList.add('show');
    }
    $('#modal').addEventListener('click', e => {
        if (e.target.id === 'modal' || e.target.closest('[data-close]')) $('#modal').classList.remove('show');
    });

    // ═════════ 戰鬥畫面（場景式）═════════
    // 角色以「腳底」為定位點站在戰場上；位置用畫面寬高的比例表示。
    // 敵方在上（遠、較小），我方在下（近、較大），後排比前排更遠／更近形成縱深。
    const LAYOUT = {
        enemy: {
            back:  {y: 0.35, s: 14.5, xs: [0.2, 0.5, 0.8]},
            front: {y: 0.47, s: 16.5, xs: [0.31, 0.69]},
            // 有首領時：首領站中間偏左，其他人往兩側讓開，避免被首領擋住
            bossFront: {xs: [0.44, 0.86]},
            bossBack: {xs: [0.13, 0.87, 0.7]},
            boss: {s: 27},
        },
        ally: {
            front: {yFromHud: 0.15, s: 19, xs: [0.3, 0.7]},
            back:  {yFromHud: 0.0,  s: 21, xs: [0.16, 0.5, 0.84]},
        },
    };
    const MELEE = ['warrior', 'tank', 'assassin'];
    const sprites = new Map();   // uid → {sprite, plate, x, y, s}
    const slotsUsed = new Map(); // `${side}-${row}` → Map(slot → uid)
    const spriteSrc = img => `assets/sprites/${img}.webp`;

    function sceneMetrics() {
        const sc = $('#screen-battle');
        const W = sc.clientWidth, H = sc.clientHeight;
        const u = Math.min(H, W * 1.85) / 100;
        const hudTop = $('#hud').offsetTop || (H - 80);
        return {W, H, u, hudTop};
    }

    function startBattle() {
        state.runId++;
        state.paused = false;
        const b = Battle.create({team: state.team.slice(), encounterId: state.encounter, auto: state.auto});
        state.battle = b;
        sprites.clear();
        slotsUsed.clear();
        $('#stage-sprites').innerHTML = '';
        $('#stage-ui').innerHTML = '';
        $('#result').classList.remove('show');
        $('#turn-pill').classList.remove('show');
        $('#b-enc').textContent = `${b.encounter.name}・${b.encounter.difficulty}`;
        $('#scene-bg').style.backgroundImage = `url(assets/bg/${b.encounter.bg || '1'}.webp)`;
        showScreen('battle');
        syncControls();
        for (const u of b.units) addSprite(u);
        refreshAll();
        preloadUltimates();
        runLoop(state.runId);
    }

    function pickSlot(u) {
        const key = `${u.side}-${u.row}`;
        if (!slotsUsed.has(key)) slotsUsed.set(key, new Map());
        const used = slotsUsed.get(key);
        const b = state.battle;
        const cap = Battle.ROW_CAP[u.row];
        for (let i = 0; i < cap; i++) {
            const occ = used.get(i);
            if (!occ || !b.get(occ)?.alive) { used.set(i, u.uid); return i; }
        }
        return 0;
    }

    function spritePos(u, slot) {
        const {W, H, u: unit, hudTop} = sceneMetrics();
        let x, y, s;
        if (u.side === 'enemy') {
            const L = LAYOUT.enemy;
            const hasBoss = state.battle.units.some(e => e.side === 'enemy' && e.boss);
            const row = L[u.row];
            const xs = hasBoss ? (u.row === 'front' ? L.bossFront.xs : L.bossBack.xs) : row.xs;
            x = xs[slot] ?? 0.5; y = row.y * H; s = u.boss ? L.boss.s : row.s;
            if (u.boss) y += H * 0.03;
        } else {
            const row = LAYOUT.ally[u.row];
            const backY = hudTop - 34;
            y = backY - row.yFromHud * H;
            x = row.xs[slot] ?? 0.5; s = row.s;
        }
        return {x: x * W, y, s, unit};
    }

    function addSprite(u, spawn) {
        const slot = pickSlot(u);
        const p = spritePos(u, slot);
        const sp = h('div', `sprite ${u.side}${u.boss ? ' boss' : ''}${spawn ? ' spawn' : ''}`, `
            <div class="shadow"></div><div class="ring"></div>
            <div class="body"><img src="${spriteSrc(u.img)}" alt="${u.name}" draggable="false"></div>`);
        const pl = h('div', `plate ${u.side}${u.boss ? ' boss' : ''}`, `
            ${u.boss ? `<div class="p-name">👑 ${u.name}</div>` : ''}
            <div class="p-row"><span class="p-el">${elIcon(u.element)}</span><div class="p-bars">
                <div class="bar hp"><i></i><b></b></div><div class="bar atb"><i></i></div></div></div>
            <div class="p-st"></div><span class="p-ready">技</span><div class="fx"></div>`);
        const style = `--s:${p.s};--u:${p.unit}px;` + (u.side === 'ally' ? `--fc:${facColor(u.faction)};` : '');
        sp.style.cssText = style + `left:${p.x}px;top:${p.y}px;z-index:${Math.round(p.y)};`;
        pl.style.cssText = style + `left:${p.x}px;top:${p.y + 4}px;`;
        sp.querySelector('img').onclick = () => showUnitInfo(u);
        $('#stage-sprites').appendChild(sp);
        $('#stage-ui').appendChild(pl);
        sprites.set(u.uid, {sprite: sp, plate: pl, x: p.x, y: p.y, s: p.s, unit: p.unit});
        updateSprite(u);
    }

    function relayout() {
        const b = state.battle;
        if (!b) return;
        for (const u of b.units) {
            const rec = sprites.get(u.uid);
            if (!rec) continue;
            const key = `${u.side}-${u.row}`;
            const slot = [...(slotsUsed.get(key) || new Map()).entries()].find(([, id]) => id === u.uid)?.[0] ?? 0;
            const p = spritePos(u, slot);
            Object.assign(rec, {x: p.x, y: p.y, unit: p.unit});
            for (const el of [rec.sprite, rec.plate]) { el.style.setProperty('--u', p.unit + 'px'); el.style.left = p.x + 'px'; }
            rec.sprite.style.top = p.y + 'px';
            rec.plate.style.top = (p.y + 4) + 'px';
        }
    }
    window.addEventListener('resize', relayout);

    function updateSprite(u) {
        const rec = sprites.get(u.uid);
        if (!rec) return;
        const pl = rec.plate;
        const hpPct = Math.max(0, u.hp / u.maxHp * 100);
        const hp = pl.querySelector('.bar.hp');
        hp.querySelector('i').style.width = hpPct + '%';
        hp.querySelector('b').style.width = Math.min(100, u.shield / u.maxHp * 100) + '%';
        hp.classList.toggle('mid', hpPct < 50 && hpPct >= 25);
        hp.classList.toggle('low', hpPct < 25);
        const atbPct = Math.min(100, u.atb / Battle.ATB_MAX * 100);
        pl.querySelector('.bar.atb i').style.width = atbPct + '%';
        pl.querySelector('.bar.atb').classList.toggle('full', atbPct >= 99);
        pl.querySelector('.p-st').innerHTML = u.statuses.map(st => `<span title="${Battle.STATUS[st.key].name}">${Battle.STATUS[st.key].icon}</span>`).join('');
        pl.classList.toggle('ready', u.alive && u.skills.length > 0 && u.cds.some(cd => cd === 0));
        pl.classList.toggle('dead', !u.alive);
        rec.sprite.classList.toggle('dead', !u.alive);
    }

    function refreshAll() {
        const b = state.battle;
        for (const u of b.units) updateSprite(u);
        renderTimeline();
        renderHud();
        $('#b-round').textContent = `第 ${Math.min(b.round(), Battle.MAX_ROUNDS)} / ${Battle.MAX_ROUNDS} 回合`;
    }

    function renderTimeline() {
        const b = state.battle;
        const list = b.over ? [] : b.preview(8);
        const box = $('#timeline');
        box.innerHTML = '';
        box.style.visibility = list.length ? 'visible' : 'hidden';
        // 從目前的連鎖接續推算：時間軸上同陣營隊友會接成第幾節
        let runFaction = b.chain.faction, runCount = b.chain.count;
        list.forEach((u, i) => {
            const t = h('div', 'tl' + (i === 0 ? ' first' : '') + (u.side === 'enemy' ? ' enemy' : ''),
                `<div class="tl-face"><img src="${spriteSrc(u.img)}" alt=""></div>`);
            if (u.side === 'ally') {
                t.style.borderColor = facColor(u.faction);
                if (u.faction === runFaction && runCount > 0) { runCount++; t.appendChild(h('span', 'tl-link', '⛓')); }
                else { runFaction = u.faction; runCount = 1; }
                if (runCount >= R.CHAIN_COMBO_AT && b.comboReady(u.faction)) t.appendChild(h('span', 'tl-combo', '✨'));
            } else {
                runFaction = null; runCount = 0;
            }
            box.appendChild(t);
        });
    }

    function renderHud() {
        const b = state.battle;
        const ch = b.chain;
        const label = $('#chain-label');
        if (ch.count > 0) {
            const f = R.FACTIONS[ch.faction];
            label.innerHTML = `<span style="color:${f.color}">${f.name}</span> 連鎖 ${ch.count}${ch.count >= 2 ? `（傷害 +${Math.round((R.CHAIN_MULT[Math.min(ch.count, 3)] - 1) * 100)}%）` : ''}`;
        } else {
            label.textContent = '連鎖：無';
        }
        $('#chain-pips').innerHTML = Array.from({length: R.CHAIN_COMBO_AT}, (_, i) => `<i class="${i < ch.count ? 'on' : ''}"></i>`).join('');
        $('#points-pips').innerHTML = Array.from({length: R.CHAIN_POINTS_MAX}, (_, i) => `<i class="${i < b.chainPoints ? 'on' : ''}"></i>`).join('');
        const facs = [...new Set(b.units.filter(u => u.side === 'ally').map(u => u.faction))]
            .filter(f => b.units.filter(u => u.side === 'ally' && u.faction === f).length >= R.CHAIN_COMBO_AT);
        $('#combo-cd').textContent = facs.length
            ? facs.map(f => `${R.FACTIONS[f].combo.name}：${b.comboReady(f) ? '可觸發' : `冷卻 ${b.comboCooldownLeft(f)} 回合`}`).join('　')
            : '沒有同陣營 3 人，無法觸發合體技';
        // 連鎖中的同陣營隊友腳下發光
        for (const u of b.units) sprites.get(u.uid)?.sprite.classList.toggle('chainlit', u.side === 'ally' && ch.count > 0 && ch.members.includes(u.uid));

        const {ok, target} = b.canChainCommand();
        $('#btn-chain').disabled = !ok || b.over;
        $('#btn-chain-sub').textContent = ok ? `讓${shortName(target.name)}出手` : (b.chainPoints < 1 ? '連攜點不足' : '連鎖中才能用');
    }

    function showUnitInfo(u) {
        if (!state.paused) togglePause();
        const st = u.statuses.map(s => `${Battle.STATUS[s.key].icon}${Battle.STATUS[s.key].name}（${s.turns}）`).join('、') || '無';
        const skills = u.skills.map((s, i) => `<div class="skill-box"><span class="k">${u.cds[i] === 0 ? '可施放' : `冷卻 ${u.cds[i]}`}</span><b>${s.name}</b><br>${s.desc}</div>`).join('');
        const passives = u.passives.filter(p => p.desc).map(p => `<div class="skill-box"><span class="k">被動</span><b>${p.name}</b><br>${p.desc}</div>`).join('');
        const b = state.battle;
        openModal(`
            <div class="info-head">
                <img src="${imgSrc(u.img)}" alt="">
                <div>
                    <h3>${u.name}</h3>
                    <span class="tag" style="color:${facColor(u.faction)}">${R.FACTIONS[u.faction].name}</span>
                    <span class="tag">${elIcon(u.element)} ${R.ELEMENTS[u.element].name}</span>
                    <p style="margin:6px 0 0;font-size:12px">生命 ${Math.round(u.hp)} / ${u.maxHp}${u.shield ? `（護盾 ${u.shield}）` : ''}<br>
                    攻擊 ${Math.round(b.atkOf(u))}・防禦 ${Math.round(b.defOf(u))}・速度 ${Math.round(b.spdOf(u))}<br>狀態：${st}</p>
                </div>
            </div>${skills}${passives}
            <div class="row-btns"><button class="btn-secondary" data-close>關閉（戰鬥已暫停）</button></div>`);
    }

    // ───────── 演出 ─────────
    function chest(uid) {
        const r = sprites.get(uid);
        return r ? {x: r.x, y: r.y - r.s * r.unit * 0.5} : null;
    }

    function animate(el, frames, ms, easing = 'ease-out') {
        if (!el?.animate) return Promise.resolve();
        return el.animate(frames, {duration: ms / state.speed, easing}).finished.catch(() => {});
    }

    function vfx(cls, x, y, color, extra = {}) {
        const v = h('div', 'vfx ' + cls);
        v.style.left = x + 'px'; v.style.top = y + 'px';
        if (color) v.style.setProperty('--c', color);
        Object.assign(v.style, extra);
        $('#stage-ui').appendChild(v);
        return v;
    }

    async function playSlash(target, color) {
        const p = chest(target);
        if (!p) return;
        const v = vfx('slash', p.x, p.y, color);
        await animate(v, [{opacity: 0, scale: .4, rotate: '-20deg'}, {opacity: 1, scale: 1.1, rotate: '0deg', offset: .35}, {opacity: 0, scale: 1.3}], 380);
        v.remove();
    }

    async function playRing(target, color) {
        const p = chest(target);
        if (!p) return;
        const v = vfx('ring', p.x, p.y, color);
        await animate(v, [{opacity: 1, scale: .3}, {opacity: 0, scale: 4.5}], 450);
        v.remove();
    }

    async function playBolt(from, to, color) {
        const a = chest(from), b = chest(to);
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        const v = vfx('bolt', a.x, a.y, color, {width: len + 'px', transform: `translate(0,-50%) rotate(${Math.atan2(dy, dx)}rad)`});
        await animate(v, [{opacity: 0, clipPath: 'inset(0 100% 0 0)'}, {opacity: 1, clipPath: 'inset(0 0 0 0)', offset: .6}, {opacity: 0, clipPath: 'inset(0 0 0 100%)'}], 300);
        v.remove();
    }

    function hitFlash(uid, big) {
        const img = sprites.get(uid)?.sprite.querySelector('img');
        if (!img) return;
        animate(img, [{filter: 'brightness(3) drop-shadow(0 0 8px #fff)'}, {filter: 'brightness(1)'}], 260);
        const k = big ? 7 : 4;
        animate(img, [{translate: '0 0'}, {translate: `${-k}px 0`}, {translate: `${k}px 0`}, {translate: '0 0'}], 240);
    }

    function shakeScreen(power = 6) {
        animate($('#scene'), [
            {translate: '0 0'}, {translate: `${power}px ${-power / 2}px`}, {translate: `${-power}px ${power / 2}px`},
            {translate: `${power / 2}px 0`}, {translate: '0 0'}], 320);
    }

    // 出手動作：近戰衝向目標，遠程原地施法並飛出光束
    async function performAction(actor, events, isSkill) {
        const firstHit = events.find(e => e.type === 'damage' && e.srcUid === actor.uid && e.kind === 'hit');
        const rec = sprites.get(actor.uid);
        if (!rec) return;
        const el = rec.sprite;
        const color = R.ELEMENTS[actor.element]?.color;
        if (!firstHit) {
            // 輔助類技能：原地發光一下
            await animate(el, [{translate: '0 0'}, {translate: '0 -14px'}, {translate: '0 0'}], 320);
            return;
        }
        const tgt = chest(firstHit.uid), me = sprites.get(actor.uid);
        const targets = [...new Set(events.filter(e => e.type === 'damage' && e.srcUid === actor.uid && e.kind === 'hit').map(e => e.uid))];
        if (MELEE.includes(actor.role) && tgt && targets.length === 1) {
            const dx = (tgt.x - me.x) * 0.72, dy = (tgt.y + me.s * me.unit * 0.45 - me.y) * 0.72;
            const go = animate(el, [{translate: '0 0'}, {translate: `${dx}px ${dy}px`, offset: .45}, {translate: `${dx}px ${dy}px`, offset: .6}, {translate: '0 0'}], 520, 'ease-in-out');
            await wait(230);
            playSlash(firstHit.uid, isSkill ? color : '#fde68a');
            await go;
        } else {
            animate(el, [{translate: '0 0'}, {translate: '0 -16px', offset: .4}, {translate: '0 0'}], 420);
            await wait(140);
            if (targets.length > 1) targets.forEach(t => playRing(t, color));
            else { await playBolt(actor.uid, firstHit.uid, color); playRing(firstHit.uid, color); }
            await wait(80);
        }
    }

    // ───────── 大招（合體技）演出：時間停止 → 立繪切入 → 3D 特效 → 傷害爆發 ─────────
    function teamComboVfx() {
        const b = state.battle;
        const counts = {};
        b.units.filter(u => u.side === 'ally').forEach(u => { counts[u.faction] = (counts[u.faction] || 0) + 1; });
        return Object.keys(counts).filter(f => counts[f] >= R.CHAIN_COMBO_AT).map(f => R.FACTIONS[f].combo?.vfx).filter(Boolean);
    }

    function preloadUltimates() {
        const names = teamComboVfx();
        if (!names.length) return;
        const go = () => names.forEach(n => window.VFX3D.preload(n));
        if (window.VFX3D) go();
        else window.addEventListener('vfx3d-ready', go, {once: true});
    }

    function makeSkip() {
        const skip = {skipped: false, waiters: []};
        skip.fire = () => { skip.skipped = true; skip.waiters.splice(0).forEach(r => r()); };
        return skip;
    }
    function waitOrSkip(ms, skip) {
        if (skip.skipped) return Promise.resolve();
        return new Promise(r => { skip.waiters.push(r); setTimeout(r, ms); });
    }

    // 特效中心：對準還活著的敵人（或我方）腳下的平均位置
    function comboAnchor(combo) {
        const b = state.battle;
        const first = combo.effects[0]?.target || '';
        const group = first.startsWith('enem') ? b.enemies() : b.allies();
        const pts = group.map(u => sprites.get(u.uid)).filter(Boolean);
        if (!pts.length) { const {W, H} = sceneMetrics(); return {x: W / 2, y: H * 0.45}; }
        return {
            x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
            y: pts.reduce((s, p) => s + p.y, 0) / pts.length + 6,
        };
    }

    async function playUltimate(e) {
        const f = R.FACTIONS[e.faction];
        e.members.forEach(m => sprites.get(m)?.sprite.classList.add('acting'));
        let mode = state.ultMode;
        if (mode === 'full' && state.speed >= 2) mode = 'short';
        if (mode === 'off') {
            animate($('#flash'), [{opacity: 0}, {opacity: .5}, {opacity: 0}], 380);
            shakeScreen(8);
            await showBanner(f.color, 'CHAIN RESONANCE', f.combo.name, f.combo.desc, f.name);
            return;
        }
        const short = mode === 'short';
        const skip = makeSkip();
        state.ultSkip = skip;
        const ult = $('#ult');
        ult.style.setProperty('--fc', f.color);
        const b = state.battle;
        $('#ult-cast').innerHTML = e.members.map((uid, i) => {
            const u = b.get(uid);
            return `<div class="cut" style="left:${-4 + i * 29}%;animation-delay:${i * (short ? 0.06 : 0.13)}s"><img src="${spriteSrc(u.img)}" alt=""></div>`;
        }).join('');
        $('#ult-name').textContent = f.combo.name;
        $('#ult-fac').textContent = f.name;
        ult.classList.remove('leaving', 'fxphase');
        ult.classList.add('show');
        $('#scene').classList.add('ult-dim');

        // 1. 立繪切入
        await waitOrSkip(short ? 700 : 1400, skip);
        ult.classList.add('leaving');
        await sleep(200);
        ult.classList.add('fxphase');

        // 2. 特效：有 3D 特效就播 3D，沒有就用 2D 備用演出
        const at = comboAnchor(f.combo);
        const run = (f.combo.vfx && window.VFX3D?.has(f.combo.vfx))
            ? window.VFX3D.play(f.combo.vfx, {x: at.x, y: at.y, speedMult: short ? 1.8 : 1, skip})
            : null;
        if (run) {
            await Promise.race([run.impact, waitOrSkip(4000, skip)]);
        } else {
            const targets = f.combo.effects[0]?.target?.startsWith('enem') ? state.battle.enemies() : state.battle.allies();
            targets.forEach(t => playRing(t.uid, f.color));
            await waitOrSkip(short ? 250 : 450, skip);
        }

        // 3. 打中：閃光、震動，接著跳傷害數字（特效本身會在背景播完）
        animate($('#flash'), [{opacity: 0}, {opacity: .5}, {opacity: 0}], 380);
        shakeScreen(10);
        ult.classList.remove('show', 'leaving', 'fxphase');
        $('#scene').classList.remove('ult-dim');
        state.ultSkip = null;
    }

    // ───────── 主迴圈 ─────────
    async function runLoop(id) {
        const b = state.battle;
        await wait(600);
        while (id === state.runId && !b.over) {
            if (state.paused) { await sleep(120); continue; }
            const events = b.step();
            await playEvents(events, id);
            if (id !== state.runId) return;
            refreshAll();
            await wait(BASE_DELAY);
        }
    }

    function setPill(html, enemy) {
        const p = $('#turn-pill');
        p.innerHTML = html;
        p.classList.toggle('enemy', !!enemy);
        p.classList.add('show');
    }

    async function playEvents(events, id) {
        const b = state.battle;
        document.querySelectorAll('.sprite.acting, .sprite.commanded').forEach(c => c.classList.remove('acting', 'commanded'));
        let actor = null;
        for (let i = 0; i < events.length; i++) {
            const e = events[i];
            if (id !== state.runId) return;
            const rec = e.uid ? sprites.get(e.uid) : null;
            const fx = rec?.plate.querySelector('.fx');
            const u = e.uid ? b.get(e.uid) : null;
            switch (e.type) {
                case 'turn':
                    actor = u;
                    rec?.sprite.classList.add('acting');
                    setPill(`${u.name} 行動`, u.side === 'enemy');
                    $('#b-round').textContent = `第 ${Math.min(e.round, Battle.MAX_ROUNDS)} / ${Battle.MAX_ROUNDS} 回合`;
                    break;
                case 'command':
                    rec?.sprite.classList.add('commanded');
                    float(fx, '連攜！', 'callout chain');
                    await wait(300);
                    break;
                case 'skill':
                    setPill(`${u.name}・<span class="sk">${e.name}</span>`, u.side === 'enemy');
                    if (u.boss) shakeScreen(5);
                    await performAction(u, events.slice(i), true);
                    break;
                case 'basic':
                    await performAction(u, events.slice(i), false);
                    break;
                case 'chain':
                    if (e.count >= 2) {
                        float(sprites.get(actor.uid)?.plate.querySelector('.fx'), `連鎖 ×${e.count}`, 'callout chain');
                        $('#hud').classList.remove('pulse'); void $('#hud').offsetWidth; $('#hud').classList.add('pulse');
                    }
                    renderHud();
                    break;
                case 'chainBreak':
                    $('#hud').classList.add('broken');
                    setTimeout(() => $('#hud').classList.remove('broken'), 400);
                    renderHud();
                    break;
                case 'damage': {
                    let cls = e.kind === 'dot' ? 'dot' : e.kind === 'combo' ? 'combo' : (e.crit ? 'crit' : 'dmg');
                    if (e.rel) cls += ' ' + e.rel;
                    if (e.chained) cls += ' chained';
                    float(fx, (e.crit ? '暴擊 ' : '') + e.amount, cls);
                    if (e.kind !== 'dot') hitFlash(e.uid, e.crit);
                    if (e.crit) shakeScreen(4);
                    updateSprite(u);
                    await wait(60);
                    break;
                }
                case 'heal':
                    float(fx, '+' + e.amount, 'heal');
                    updateSprite(u);
                    break;
                case 'shield': float(fx, '🛡 ' + e.amount, 'shield'); updateSprite(u); break;
                case 'atb': float(fx, e.delta > 0 ? `▲推條 ${e.delta}%` : `▼拉條 ${-e.delta}%`, 'info'); updateSprite(u); break;
                case 'status': float(fx, Battle.STATUS[e.key].icon + Battle.STATUS[e.key].name, 'info'); updateSprite(u); break;
                case 'resist': float(fx, '抵抗', 'info'); break;
                case 'cleanse': float(fx, '✨淨化', 'info'); updateSprite(u); break;
                case 'skip':
                    float(fx, '❄️ 凍結中', 'info');
                    setPill(`${u.name} 被凍結，跳過行動`, u.side === 'enemy');
                    await wait(300);
                    break;
                case 'execute': float(fx, '斬殺！', 'callout'); shakeScreen(6); break;
                case 'explode': float(fx, '💥屍爆', 'callout'); shakeScreen(7); break;
                case 'enrage': await showBanner('#a3e635', 'ENRAGE', `${u.name}狂暴`, '速度大幅提升'); break;
                case 'death':
                    updateSprite(u);
                    if (rec) animate(rec.sprite.querySelector('img'), [{translate: '0 0', opacity: 1}, {translate: '0 16px', opacity: 0.3}], 600);
                    break;
                case 'summon':
                    addSprite(u, true);
                    float(sprites.get(u.uid)?.plate.querySelector('.fx'), '召喚', 'info');
                    break;
                case 'points': renderHud(); break;
                case 'combo':
                    await playUltimate(e);
                    break;
                case 'end':
                    $('#turn-pill').classList.remove('show');
                    refreshAll();
                    await wait(700);
                    showResult(e);
                    break;
            }
        }
    }

    function float(fx, text, cls) {
        if (!fx) return;
        const f = h('span', 'float ' + cls, text);
        f.style.top = (-fx.children.length * 18) + 'px';
        fx.appendChild(f);
        setTimeout(() => f.remove(), 1150);
    }

    async function showBanner(color, tag, name, desc, fac) {
        const bn = $('#banner');
        bn.innerHTML = `<div class="bn-tag">${tag}</div><div class="bn-name" style="color:${color}">${name}</div>${fac ? `<div class="bn-fac" style="color:${color}">${fac}</div>` : ''}<div class="bn-desc">${desc}</div>`;
        bn.classList.add('show');
        await wait(1250);
        bn.classList.remove('show');
        await wait(180);
    }

    function showResult(e) {
        const b = state.battle;
        const win = e.result === 'win';
        const reason = win ? `${e.round} 回合內擊敗所有敵人` : (e.reason === 'timeout' ? `${Battle.MAX_ROUNDS} 回合內沒有打完` : '全隊倒下');
        const allies = b.units.filter(u => u.side === 'ally');
        const rows = allies.map(u => ({name: shortName(u.name), v: u.stats.dmg, color: facColor(u.faction)}));
        if (b.comboDamage > 0) rows.push({name: '合體技', v: b.comboDamage, color: '#f0abfc'});
        rows.sort((a, c) => c.v - a.v);
        const max = Math.max(1, ...rows.map(r => r.v));
        const heal = allies.reduce((s, u) => s + u.stats.heal, 0);
        const r = $('#result');
        r.innerHTML = `<div class="sheet">
            <div class="res-title ${win ? 'win' : 'lose'}">${win ? '勝利' : '敗北'}</div>
            <div class="res-sub">${reason}</div>
            <div class="res-stats">
                <div><b>${Math.min(e.round, Battle.MAX_ROUNDS)}</b><span>回合</span></div>
                <div><b>${b.combos}</b><span>合體技</span></div>
                <div><b>${Math.round(heal)}</b><span>治療量</span></div>
            </div>
            ${rows.map(x => `<div class="dmg-row"><span>${x.name}</span><span class="dmg-bar"><i style="width:${x.v / max * 100}%;background:${x.color}"></i></span><span class="dmg-n">${Math.round(x.v)}</span></div>`).join('')}
            <div class="row-btns">
                <button class="btn-secondary" id="res-team">換隊伍</button>
                <button class="btn-primary" id="res-again">再打一次</button>
            </div></div>`;
        r.classList.add('show');
        $('#res-again').onclick = startBattle;
        $('#res-team').onclick = () => { r.classList.remove('show'); quitBattle(); };
    }

    function quitBattle() {
        state.runId++;
        showScreen('setup');
        renderSetup();
    }

    function togglePause() {
        state.paused = !state.paused;
        $('#btn-pause').textContent = state.paused ? '▶' : '❚❚';
    }

    function syncControls() {
        $('#btn-auto').classList.toggle('on', state.auto);
        $('#btn-auto').textContent = state.auto ? '自動' : '手動';
        $('#btn-speed').textContent = 'x' + state.speed;
        $('#btn-pause').textContent = state.paused ? '▶' : '❚❚';
        $('#chk-auto').checked = state.auto;
    }

    function showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        $('#screen-' + name).classList.add('active');
        window.scrollTo(0, 0);
    }

    // ───────── 綁定 ─────────
    $('#btn-start').onclick = startBattle;
    $('#btn-help').onclick = showHelp;
    $('#chk-auto').onchange = e => { state.auto = e.target.checked; };
    $('#sel-ult').value = state.ultMode;
    $('#sel-ult').onchange = e => { state.ultMode = e.target.value; savePref('ultMode', state.ultMode); };
    $('#ult').addEventListener('click', () => state.ultSkip?.fire());
    $('#btn-quit').onclick = quitBattle;
    $('#btn-pause').onclick = togglePause;
    $('#btn-speed').onclick = () => {
        state.speed = SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length];
        syncControls();
    };
    $('#btn-auto').onclick = () => {
        state.auto = !state.auto;
        if (state.battle) state.battle.auto = state.auto;
        syncControls();
    };
    $('#btn-chain').onclick = () => {
        const b = state.battle;
        if (!b || !b.useChainCommand()) return;
        const target = b.get(b.forced);
        const rec = sprites.get(target.uid);
        rec?.sprite.classList.add('commanded');
        float(rec?.plate.querySelector('.fx'), '連攜！', 'callout chain');
        setPill(`⛓ 連攜指令：${target.name} 立刻出手`);
        renderHud();
        renderTimeline();
    };

    renderSetup();
})();
