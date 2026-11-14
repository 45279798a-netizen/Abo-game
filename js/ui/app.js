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
        battle: null,
        runId: 0,
        log: [],
    };

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

    // ═════════ 戰鬥畫面 ═════════
    const cards = new Map();

    function startBattle() {
        state.runId++;
        state.paused = false;
        state.log = [];
        const b = Battle.create({team: state.team.slice(), encounterId: state.encounter, auto: state.auto});
        state.battle = b;
        cards.clear();
        document.querySelectorAll('#screen-battle .row').forEach(r => { r.innerHTML = ''; });
        $('#result').classList.remove('show');
        $('#log').innerHTML = '';
        $('#b-enc').textContent = `${b.encounter.name}（${b.encounter.difficulty}）`;
        for (const u of b.units) addCard(u);
        showScreen('battle');
        syncControls();
        refreshAll();
        runLoop(state.runId);
    }

    function addCard(u, spawn) {
        const c = h('div', 'unit' + (u.boss ? ' boss' : '') + (spawn ? ' spawn' : ''), `
            <div class="portrait"><img src="${imgSrc(u.img)}" alt=""><span class="u-el">${elIcon(u.element)}</span><span class="u-ready">技</span></div>
            <div class="bar hp"><i></i><b></b></div>
            <div class="bar atb"><i></i></div>
            <div class="u-name">${u.boss ? '👑 ' : ''}${shortName(u.name)}</div>
            <div class="u-st"></div>
            <div class="fx"></div>`);
        c.style.borderColor = u.side === 'ally' ? facColor(u.faction) : (u.boss ? '#a3e635' : '#5b2a2a');
        const row = document.querySelector(`#field-${u.side === 'ally' ? 'ally' : 'enemy'} .row.${u.row}`);
        row.appendChild(c);
        cards.set(u.uid, c);
        c.onclick = () => showUnitInfo(u);
        updateCard(u);
    }

    function updateCard(u) {
        const c = cards.get(u.uid);
        if (!c) return;
        const hpPct = Math.max(0, u.hp / u.maxHp * 100);
        c.querySelector('.bar.hp i').style.width = hpPct + '%';
        c.querySelector('.bar.hp b').style.width = Math.min(100, u.shield / u.maxHp * 100) + '%';
        c.querySelector('.bar.hp').classList.toggle('low', hpPct < 30);
        c.querySelector('.bar.atb i').style.width = Math.min(100, u.atb / Battle.ATB_MAX * 100) + '%';
        c.querySelector('.u-st').innerHTML = u.statuses.map(s => `<span title="${Battle.STATUS[s.key].name}">${Battle.STATUS[s.key].icon}</span>`).join('');
        c.classList.toggle('ready', u.alive && u.cds.some(cd => cd === 0) && u.skills.length > 0);
        c.classList.toggle('dead', !u.alive);
    }

    function refreshAll() {
        const b = state.battle;
        for (const u of b.units) updateCard(u);
        renderTimeline();
        renderHud();
        $('#b-round').textContent = `第 ${Math.min(b.round(), Battle.MAX_ROUNDS)} / ${Battle.MAX_ROUNDS} 回合`;
    }

    function renderTimeline() {
        const b = state.battle;
        const list = b.over ? [] : b.preview(8);
        const box = $('#timeline');
        box.innerHTML = '';
        // 從目前的連鎖接續計算：時間軸上的同陣營隊友會形成第幾節
        let runFaction = b.chain.faction, runCount = b.chain.count;
        list.forEach((u, i) => {
            const t = h('div', 'tl' + (i === 0 ? ' first' : '') + (u.side === 'enemy' ? ' enemy' : ''));
            t.innerHTML = `<img src="${imgSrc(u.img)}" alt="">`;
            if (u.side === 'ally') {
                t.style.borderColor = facColor(u.faction);
                if (u.faction === runFaction && runCount > 0) {
                    runCount++;
                    t.appendChild(h('span', 'tl-link', '⛓'));
                } else {
                    runFaction = u.faction; runCount = 1;
                }
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
            label.innerHTML = `<span style="color:${f.color}">${f.name}</span> 連鎖 ${ch.count}`;
        } else {
            label.textContent = '連鎖：無';
        }
        $('#chain-pips').innerHTML = Array.from({length: R.CHAIN_COMBO_AT}, (_, i) => `<i class="${i < ch.count ? 'on' : ''}"></i>`).join('');
        $('#points-pips').innerHTML = Array.from({length: R.CHAIN_POINTS_MAX}, (_, i) => `<i class="${i < b.chainPoints ? 'on' : ''}"></i>`).join('');

        // 合體技冷卻
        const facs = [...new Set(b.units.filter(u => u.side === 'ally').map(u => u.faction))]
            .filter(f => b.units.filter(u => u.side === 'ally' && u.faction === f).length >= R.CHAIN_COMBO_AT);
        $('#combo-cd').textContent = facs.length
            ? facs.map(f => `${R.FACTIONS[f].combo.name}：${b.comboReady(f) ? '可觸發' : `冷卻 ${b.comboCooldownLeft(f)} 回合`}`).join('　')
            : '隊伍裡沒有同陣營 3 人，無法觸發合體技';

        const {ok, target} = b.canChainCommand();
        const btn = $('#btn-chain');
        btn.disabled = !ok || b.over;
        $('#btn-chain-sub').textContent = ok ? `讓 ${shortName(target.name)} 出手` : (b.chainPoints < 1 ? '連攜點不足' : '等待連鎖');
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

    // ───────── 主迴圈 ─────────
    async function runLoop(id) {
        const b = state.battle;
        await wait(500);
        while (id === state.runId && !b.over) {
            if (state.paused) { await sleep(120); continue; }
            const events = b.step();
            await playEvents(events, id);
            if (id !== state.runId) return;
            refreshAll();
            await wait(BASE_DELAY);
        }
    }

    async function playEvents(events, id) {
        const b = state.battle;
        document.querySelectorAll('.unit.acting, .unit.commanded').forEach(c => c.classList.remove('acting', 'commanded'));
        let actor = null;
        for (const e of events) {
            if (id !== state.runId) return;
            const c = e.uid ? cards.get(e.uid) : null;
            const u = e.uid ? b.get(e.uid) : null;
            switch (e.type) {
                case 'turn':
                    actor = u;
                    c?.classList.add('acting');
                    $('#b-round').textContent = `第 ${Math.min(e.round, Battle.MAX_ROUNDS)} / ${Battle.MAX_ROUNDS} 回合`;
                    break;
                case 'command':
                    c?.classList.add('commanded');
                    float(c, '連攜！', 'callout chain');
                    log(`⛓ 連攜指令：${u.name} 立刻出手`);
                    await wait(350);
                    break;
                case 'skill':
                    float(c, e.name, 'callout');
                    log(`${u.side === 'ally' ? '' : '◆ '}${u.name} 施放「${e.name}」`);
                    await wait(250);
                    break;
                case 'chain':
                    if (e.count >= 2) {
                        float(cards.get(actor.uid), `連鎖 ×${e.count}`, 'callout chain');
                        $('#hud').classList.remove('pulse'); void $('#hud').offsetWidth; $('#hud').classList.add('pulse');
                    }
                    renderHud();
                    break;
                case 'chainBreak':
                    $('#hud').classList.add('broken');
                    setTimeout(() => $('#hud').classList.remove('broken'), 400);
                    break;
                case 'damage': {
                    let cls = e.kind === 'dot' ? 'dot' : e.kind === 'combo' ? 'combo' : (e.crit ? 'crit' : 'dmg');
                    if (e.rel) cls += ' ' + e.rel;
                    if (e.chained) cls += ' chained';
                    float(c, (e.crit ? '暴擊 ' : '') + e.amount, cls);
                    if (c) { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
                    updateCard(u);
                    await wait(70);
                    break;
                }
                case 'heal': float(c, '+' + e.amount, 'heal'); updateCard(u); break;
                case 'shield': float(c, '🛡 ' + e.amount, 'shield'); updateCard(u); break;
                case 'atb': float(c, e.delta > 0 ? `▲推條 ${e.delta}%` : `▼拉條 ${-e.delta}%`, 'info'); updateCard(u); break;
                case 'status': float(c, Battle.STATUS[e.key].icon + Battle.STATUS[e.key].name, 'info'); updateCard(u); break;
                case 'resist': float(c, '抵抗', 'info'); break;
                case 'cleanse': float(c, '✨淨化', 'info'); updateCard(u); break;
                case 'skip': float(c, '❄️ 凍結中', 'info'); log(`${u.name} 被凍結，跳過行動`); await wait(250); break;
                case 'execute': float(c, '斬殺！', 'callout'); break;
                case 'explode': float(c, '💥屍爆', 'callout'); log(`${u.name} 屍爆！`); break;
                case 'enrage': await showBanner('#a3e635', '首領', `${u.name}狂暴了`, '速度大幅提升'); break;
                case 'death':
                    updateCard(u);
                    log(`✝ ${u.name} 倒下`);
                    if (u.side === 'enemy') setTimeout(() => c?.classList.add('gone'), 700);
                    break;
                case 'summon':
                    addCard(u, true);
                    log(`◆ 召喚了 ${u.name}`);
                    break;
                case 'points': renderHud(); break;
                case 'combo': {
                    const f = R.FACTIONS[e.faction];
                    log(`✨ ${f.name}合體技「${e.name}」！`);
                    e.members.forEach(m => cards.get(m)?.classList.add('acting'));
                    await showBanner(f.color, f.name, e.name, f.combo.desc);
                    break;
                }
                case 'end':
                    refreshAll();
                    await wait(600);
                    showResult(e);
                    break;
            }
        }
    }

    function float(card, text, cls) {
        if (!card) return;
        const f = h('span', 'float ' + cls, text);
        const fx = card.querySelector('.fx');
        const n = fx.children.length;
        f.style.marginTop = (n * 14) + 'px';
        fx.appendChild(f);
        setTimeout(() => f.remove(), 1100);
    }

    async function showBanner(color, top, name, desc) {
        const bn = $('#banner');
        bn.innerHTML = `<div class="bn-fac" style="color:${color}">${top}</div><div class="bn-name" style="color:${color}">${name}</div><div class="bn-desc">${desc}</div>`;
        bn.classList.add('show');
        await wait(1100);
        bn.classList.remove('show');
        await wait(150);
    }

    function log(text) {
        state.log.push(text);
        if (state.log.length > 3) state.log.shift();
        $('#log').innerHTML = state.log.map(t => `<div>${t}</div>`).join('');
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
        const c = cards.get(target.uid);
        c?.classList.add('commanded');
        float(c, '連攜！', 'callout chain');
        log(`⛓ 連攜指令：${target.name} 立刻出手`);
        renderHud();
        renderTimeline();
    };

    renderSetup();
})();
