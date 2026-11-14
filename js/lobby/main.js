// 大廳（橫式主城）：隊長立繪、貨幣、出征（主線章節地圖、劇情、掛機）、英雄、招募、背包、設定。
// 資料存在 Save（js/core/save.js），抽卡邏輯在 Gacha（js/core/gacha.js）。
(function () {
    const R = window.RES;
    const $ = s => document.querySelector(s);
    const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let S = Save.load();
    const save = () => Save.save(S);

    const sprite = img => `assets/sprites_hd/${img}.webp`;
    const face = img => `assets/portraits/${img}.webp`;
    const rc = r => R.RARITY[r]?.color || '#888';
    const fc = f => R.FACTIONS[f]?.color || '#888';
    const short = n => n.includes('·') ? n.split('·')[1] : n;
    const fmt = n => n >= 100000 ? (n / 1000).toFixed(0) + 'K' : n.toLocaleString();

    const CUR = {
        gold:      {icon: '🪙', name: '金幣', desc: '升級、強化裝備'},
        gem:       {icon: '💎', name: '鑽石', desc: '招募、快速掛機'},
        ticket:    {icon: '🎫', name: '招募券', desc: '常駐招募 1 次'},
        ltdTicket: {icon: '🌟', name: '限定招募券', desc: 'S1 限定招募 1 次'},
        exp:       {icon: '🧪', name: '經驗藥水', desc: '英雄升級'},
        brk:       {icon: '💠', name: '突破石', desc: '每 20 級突破一次，提高等級上限'},
        book:      {icon: '📘', name: '技能書', desc: '小技能、大招升級'},
        dust:      {icon: '✴️', name: '星塵', desc: '滿星英雄的重複碎片轉成；到星塵商店換碎片與道具'},
    };

    // ───────── 主畫面 ─────────
    const LINES = {
        kingdom: ['獅心王國的旗幟不會倒下。', '隊伍整備完畢，隨時可以出發。', '亡靈越過邊境了……我們得快點。'],
        church:  ['願聖光指引我們的道路。', '受傷了就回來，我會治好你。', '亡靈的氣息越來越濃了。'],
        forest:  ['森林在低語……危險正在靠近。', '我的箭從不落空。', '翠林與王國，這次站在同一邊。'],
        wild:    ['哈！終於有架可以打了！', '荒原的人不怕冷，也不怕死。', '準備好了就走吧，別讓我等。'],
        night:   ['夜色是最好的掩護。', '只要價錢對，什麼都好談。', '巫妖王的人頭，值多少？'],
    };
    function renderLeader() {
        const d = R.HEROES[S.leader];
        if (!d) return;
        $('#leader img').src = sprite(d.img);
    }
    function say() {
        const d = R.HEROES[S.leader];
        const lines = LINES[d.faction] || LINES.kingdom;
        const el = $('#leader-say');
        el.innerHTML = `<b>${short(d.name)}</b>：${lines[Math.floor(Math.random() * lines.length)]}`;
        el.classList.add('show');
        clearTimeout(say.t);
        say.t = setTimeout(() => el.classList.remove('show'), 3200);
    }
    function renderCurrency() {
        $('#currency').innerHTML = ['gold', 'gem', 'ticket', 'ltdTicket'].map(k => `<div class="cur" title="${CUR[k].name}"><span class="ci">${CUR[k].icon}</span>${fmt(S.currency[k] || 0)}</div>`).join('');
    }
    function renderTeam() {
        const strip = $('#team-strip');
        strip.innerHTML = '<span class="lbl">隊伍</span>' + S.team.map(id => {
            if (!id) return '<div class="face empty"></div>';
            const d = R.HEROES[id];
            return `<div class="face" style="--rc:${rc(d.rarity)}"><img src="${face(d.img)}" alt="">${id === S.leader ? '<span class="lead">隊長</span>' : ''}</div>`;
        }).join('');
    }
    function renderMain() {
        renderLeader(); renderCurrency(); renderTeam(); refreshIdle();
        const best = Campaign.progress(S);
        const nx = Math.min(best + 1, R.CAMPAIGN.chapters.length * Campaign.N);
        $('#battle-sub').textContent = `主線 ${Math.ceil(nx / Campaign.N)}-${(nx - 1) % Campaign.N + 1}`;
        $('#gacha-dot').classList.toggle('on', !S.newbieDone);
        $('#gacha-sub').textContent = S.newbieDone ? 'S1 限定・烏瑟' : '新手招募可以抽了！';
    }

    // ───────── 子畫面共用 ─────────
    function openPanel(name) {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'));
        const p = $('#panel-' + name);
        ({battle: renderBattle, hero: renderHero, gacha: renderGacha, bag: renderBag, settings: renderSettings})[name]?.();
        p.classList.add('show');
    }
    function closePanels() { document.querySelectorAll('.panel').forEach(p => p.classList.remove('show')); renderMain(); }
    const head = title => `<div class="ph"><h2>${title}</h2><div class="sp"></div><button class="close" data-close>✕</button></div>`;
    function toast(t) {
        const el = $('#toast');
        el.textContent = t;
        el.classList.add('show');
        clearTimeout(toast.t);
        toast.t = setTimeout(() => el.classList.remove('show'), 1800);
    }

    // ───────── 出征：主線章節地圖 ─────────
    const CH = R.CAMPAIGN.chapters;
    const NST = Campaign.N;
    const curChapter = () => Math.min(CH.length, Math.floor(Campaign.progress(S) / NST) + 1);
    let mapCh = null;
    // 15 個關卡點沿著蜿蜒的路排列（百分比座標）
    const NODE_POS = Array.from({length: NST}, (_, i) => {
        const t = i / (NST - 1);
        return {x: 7 + t * 83, y: 55 + Math.sin(t * Math.PI * 2.6 + Math.PI * 0.4) * 21};
    });
    const unitImg = id => R.HEROES[id] ? R.HEROES[id].img : R.ENEMIES[id].img;
    const unitName = id => id === 'narrator' ? '' : short((R.HEROES[id] || R.ENEMIES[id]).name);
    const starsHtml = n => [1, 2, 3].map(k => `<i class="${k <= n ? 'on' : ''}">★</i>`).join('');
    const rewardHtml = r => Object.entries(r).filter(([, v]) => v > 0).map(([k, v]) => `<span class="rw" title="${CUR[k].name}">${CUR[k].icon}${fmt(v)}</span>`).join('');

    function renderBattle() {
        const p = $('#panel-battle');
        if (mapCh == null) mapCh = curChapter();
        const ch = mapCh, c = CH[ch - 1];
        const stars = Campaign.chapterStars(S, ch);
        const open = Campaign.unlocked(S, ch, 1);
        const chestHtml = R.CAMPAIGN.chests.map((x, i) => {
            const got = S.campaign.chests[`${ch}:${i}`], ready = !got && stars >= x.stars;
            return `<button class="chest ${got ? 'got' : ''} ${ready ? 'ready' : ''}" data-chest="${i}" title="${x.stars} 星寶箱">${got ? '📭' : '🎁'}<b>${x.stars}</b></button>`;
        }).join('');
        const path = NODE_POS.map((q, i) => `${i ? 'L' : 'M'}${q.x} ${q.y}`).join(' ');
        const nodes = NODE_POS.map((q, i) => {
            const st = i + 1, kind = Campaign.kindOf(st), k = Campaign.key(ch, st);
            const got = S.campaign.stars[k] || 0, un = Campaign.unlocked(S, ch, st), next = un && !got;
            const inner = kind === 'boss' ? `<img src="${face(R.ENEMIES[c.boss].img)}" alt="">` : `<span>${st}</span>`;
            return `<button class="node ${kind} ${un ? '' : 'lock'} ${got ? 'done' : ''} ${next ? 'next' : ''}" style="left:${q.x}%;top:${q.y}%" data-st="${st}">
                ${inner}${got ? `<div class="nstars">${starsHtml(got)}</div>` : ''}${!un ? '<em>🔒</em>' : ''}</button>`;
        }).join('');
        const idle = Campaign.idlePending(S);
        p.innerHTML = `<div class="map" style="background-image:url(assets/hd/land_${c.bgHD}.webp)">
            <div class="map-shade"></div>
            <svg class="map-path" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${path}"/></svg>
            ${nodes}
            <div class="map-top">
                <button class="chv" data-chv="-1" ${ch <= 1 ? 'disabled' : ''}>◀</button>
                <div class="ch-title"><small>第 ${ch} 章</small><b>${c.name}</b></div>
                <button class="chv" data-chv="1" ${ch >= CH.length || !Campaign.unlocked(S, ch + 1, 1) ? 'disabled' : ''}>▶</button>
                <div class="sp"></div>
                <div class="ch-stars">★ ${stars}<small>/${NST * 3}</small></div>
                <div class="chests">${chestHtml}</div>
                <button class="close" data-close>✕</button>
            </div>
            <div class="map-bottom">
                <div class="team-mini">${S.team.map(id => id ? `<div class="face" style="--rc:${rc(R.HEROES[id].rarity)}"><img src="${face(R.HEROES[id].img)}" alt=""></div>` : '<div class="face empty"></div>').join('')}</div>
                <span class="tp">隊伍戰力 <b>${teamPower().toLocaleString()}</b></span>
                <button class="btn" data-open="hero">調整隊伍</button>
                <div class="sp"></div>
                <button class="btn" id="map-story" ${open ? '' : 'disabled'}>📜 劇情</button>
                <button class="btn idle-btn" id="map-idle">🏕️ 掛機 <small>${idle.hours.toFixed(1)}h</small></button>
            </div>
            ${open ? '' : '<div class="ch-lock">先打倒上一章的首領才能進入</div>'}
        </div>`;
        p.querySelectorAll('[data-chv]').forEach(b => { b.onclick = () => { mapCh = Math.max(1, Math.min(CH.length, ch + Number(b.dataset.chv))); renderBattle(); maybeChapterStory(); }; });
        p.querySelectorAll('[data-st]').forEach(b => { b.onclick = () => { const st = Number(b.dataset.st); if (!Campaign.unlocked(S, ch, st)) { toast('先通過前一關'); return; } showStage(ch, st); }; });
        p.querySelectorAll('[data-chest]').forEach(b => {
            b.onclick = () => {
                const i = Number(b.dataset.chest), x = R.CAMPAIGN.chests[i];
                const r = Campaign.openChest(S, ch, i);
                if (!r.ok) { toast(`${x.stars} 星寶箱：${rewardText(x.reward)}（${r.reason}）`); return; }
                save(); renderBattle(); renderCurrency();
                toast('獲得 ' + rewardText(r.reward));
            };
        });
        p.querySelector('#map-story').onclick = () => storyMenu(ch);
        p.querySelector('#map-idle').onclick = showIdle;
    }
    const rewardText = r => Object.entries(r).filter(([, v]) => v > 0).map(([k, v]) => `${CUR[k].icon}${fmt(v)}`).join(' ');

    // 章節開頭劇情：第一次進到這章時播
    function maybeChapterStory() {
        const ch = mapCh;
        if (!Campaign.unlocked(S, ch, 1) || S.campaign.story[`${ch}:start`]) return;
        playStory(ch, 'start');
    }
    function storyMenu(ch) {
        const m = modal(`<h3>第 ${ch} 章・${CH[ch - 1].name}</h3><p class="muted">重看這一章的劇情</p>
            <div class="row"><button class="btn" data-s="start">序章</button><button class="btn" data-s="boss" ${S.campaign.story[`${ch}:boss`] ? '' : 'disabled'}>首領戰前</button></div>`);
        m.querySelectorAll('[data-s]').forEach(b => { b.onclick = () => { m.remove(); playStory(ch, b.dataset.s); }; });
    }

    // 劇情播放：左右立繪＋對話框；點一下下一句，右上「跳過」
    function playStory(ch, part) {
        return new Promise(resolve => {
            const lines = CH[ch - 1].story[part];
            const bg = part === 'boss' && CH[ch - 1].bossBgHD ? CH[ch - 1].bossBgHD : CH[ch - 1].bgHD;
            const el = h('div', 'story');
            el.innerHTML = `<div class="sbg" style="background-image:url(assets/hd/land_${bg}.webp)"></div>
                <img class="spl" alt=""><img class="spr" alt="">
                <div class="sbox"><div class="sname"></div><div class="stext"></div><div class="snext">▼</div></div>
                <div class="stitle">第 ${ch} 章・${CH[ch - 1].name}${part === 'boss' ? '<small>首領戰</small>' : ''}</div>
                <button class="sskip">跳過 ▶▶</button>`;
            $('#lobby').appendChild(el);
            let i = -1, typing = null, left = null, right = null;
            const finish = () => { clearInterval(typing); el.classList.add('out'); setTimeout(() => el.remove(), 300); S.campaign.story[`${ch}:${part}`] = true; save(); resolve(); };
            function show() {
                i++;
                if (i >= lines.length) { finish(); return; }
                const [who, text] = lines[i];
                const box = el.querySelector('.sbox');
                box.classList.toggle('narr', who === 'narrator');
                el.querySelector('.sname').textContent = unitName(who);
                if (who !== 'narrator') {
                    // 英雄站左邊、敵人站右邊；說話的人亮、另一邊變暗
                    const isEnemy = !R.HEROES[who];
                    if (isEnemy) right = who; else left = who;
                    const L = el.querySelector('.spl'), Rr = el.querySelector('.spr');
                    if (left) { const src = sprite(unitImg(left)); if (!L.src.endsWith(src)) L.src = src; L.classList.add('on'); }
                    if (right) { const src = sprite(unitImg(right)); if (!Rr.src.endsWith(src)) Rr.src = src; Rr.classList.add('on'); }
                    L.classList.toggle('dim', isEnemy); Rr.classList.toggle('dim', !isEnemy);
                }
                const t = el.querySelector('.stext');
                let n = 0;
                clearInterval(typing);
                typing = setInterval(() => { n++; t.textContent = text.slice(0, n); if (n >= text.length) { clearInterval(typing); typing = null; } }, 28);
                el.dataset.full = text;
            }
            el.onclick = e => {
                if (e.target.closest('.sskip')) { finish(); return; }
                if (typing) { clearInterval(typing); typing = null; el.querySelector('.stext').textContent = el.dataset.full; return; }
                show();
            };
            show();
        });
    }

    function modal(html, cls = '') {
        const m = h('div', 'modal ' + cls);
        m.innerHTML = `<div class="mbox">${html}<button class="mclose">✕</button></div>`;
        m.onclick = e => { if (e.target === m || e.target.closest('.mclose')) m.remove(); };
        $('#lobby').appendChild(m);
        return m;
    }

    // 關卡資訊
    function showStage(ch, st) {
        const s = Campaign.stage(ch, st), k = s.key;
        const got = S.campaign.stars[k] || 0;
        const rec = Campaign.recommend(ch, st), tp = teamPower();
        const foes = [...s.front, ...s.back];
        const uniq = [...new Set(foes)];
        const left = Campaign.sweepLeft(S);
        const m = modal(`<div class="st-head"><span class="kind ${s.kind}">${s.difficulty}</span><h3>${ch}-${st}　${s.kind === 'boss' ? s.name : CH[ch - 1].name}</h3><div class="st-stars">${starsHtml(got)}</div></div>
            <div class="foes">${uniq.map(id => `<div class="face ${R.ENEMIES[id].boss ? 'boss' : ''}" title="${R.ENEMIES[id].name}"><img src="${face(R.ENEMIES[id].img)}" alt=""><span>${foes.filter(x => x === id).length > 1 ? '×' + foes.filter(x => x === id).length : ''}</span></div>`).join('')}</div>
            <div class="pow">推薦戰力 <b>${rec.toLocaleString()}</b>　隊伍戰力 <b class="${tp >= rec ? 'ok' : 'low'}">${tp.toLocaleString()}</b></div>
            <ul class="conds">
                <li class="${got >= 1 ? 'ok' : ''}">★ 通關</li>
                <li>★ 沒有英雄陣亡</li>
                <li>★ ${s.rounds} 回合內通關</li>
            </ul>
            <div class="rws"><span class="muted">${got ? '重打獎勵' : '首通獎勵'}</span>${rewardHtml(got ? Campaign.repeatReward(ch, st) : Campaign.firstReward(ch, st))}</div>
            <div class="row">
                ${got >= 3 ? `<button class="btn" data-sweep="1" ${left ? '' : 'disabled'}>掃蕩 ×1</button><button class="btn" data-sweep="10" ${left ? '' : 'disabled'}>掃蕩 ×${Math.min(10, left) || 10}</button><span class="muted" style="font-size:11px">今日剩 ${left}</span>` : '<span class="muted" style="font-size:11px">3 星通關後可以掃蕩</span>'}
                <div class="sp"></div><button class="btn primary" id="st-go">出戰</button>
            </div>`, 'stage');
        m.querySelectorAll('[data-sweep]').forEach(b => {
            b.onclick = () => {
                const r = Campaign.sweep(S, ch, st, Number(b.dataset.sweep));
                if (!r.ok) { toast(r.reason); return; }
                save(); renderCurrency(); m.remove(); showStage(ch, st);
                toast(`掃蕩 ${r.times} 次：${rewardText(r.reward)}`);
            };
        });
        m.querySelector('#st-go').onclick = () => { m.remove(); launchStage(ch, st); };
    }

    async function launchStage(ch, st) {
        const team = S.team.filter(Boolean);
        if (!team.length) { toast('隊伍裡至少要有 1 位英雄'); return; }
        if (st === 1 && !S.campaign.story[`${ch}:start`]) await playStory(ch, 'start');
        if (st === NST && !S.campaign.story[`${ch}:boss`]) await playStory(ch, 'boss');
        let auto = true;
        try { auto = (JSON.parse(localStorage.getItem('pr_hd2dBattle') || '{}').auto) !== false; } catch (e) { /* 預設自動 */ }
        const growth = Object.fromEntries(team.map(id => [id, Growth.multipliers(id, S.heroes[id])]));
        localStorage.setItem('pr_hd2dBattle', JSON.stringify({team: S.team.map(x => x || null), stage: {ch, st}, auto, growth, from: 'lobby'}));
        location.href = 'hd2d.html';
    }

    // ───────── 掛機 ─────────
    function showIdle() {
        const p = Campaign.idlePending(S), rate = Campaign.idleRate(S), q = Campaign.quickInfo(S);
        const best = Campaign.progress(S);
        const m = modal(`<h3>🏕️ 掛機收益</h3>
            <p class="muted">英雄們會在你離開時繼續討伐魔物。收益依最高通關關卡（目前 ${best ? `${Math.ceil(best / NST)}-${(best - 1) % NST + 1}` : '尚未通關'}），最多累積 ${Campaign.IDLE_MAX_H} 小時。</p>
            <div class="idle-bar"><i style="width:${p.hours / Campaign.IDLE_MAX_H * 100}%"></i><span>${p.hours.toFixed(1)} / ${Campaign.IDLE_MAX_H} 小時</span></div>
            <div class="rws"><span class="muted">可領取</span>${rewardHtml(p.reward) || '<span class="muted">還沒有累積</span>'}</div>
            <div class="rws"><span class="muted">每小時</span>${rewardHtml({gold: Math.floor(rate.gold), exp: Math.floor(rate.exp)})}<span class="rw">${CUR.brk.icon}${rate.brk.toFixed(2)}</span></div>
            <div class="row"><button class="btn" id="idle-quick" ${q.cost == null ? 'disabled' : ''}>⚡ 快速掛機 2 小時${q.cost == null ? '（今天用完）' : q.cost ? `（💎${q.cost}）` : '（今日免費）'}</button><div class="sp"></div>
            <button class="btn primary" id="idle-claim" ${p.reward.gold > 0 ? '' : 'disabled'}>領取</button></div>`, 'idle');
        m.querySelector('#idle-claim').onclick = () => { const r = Campaign.idleClaim(S); save(); renderCurrency(); m.remove(); toast('領取 ' + rewardText(r.reward)); refreshIdle(); if ($('#panel-battle').classList.contains('show')) renderBattle(); };
        m.querySelector('#idle-quick').onclick = () => { const r = Campaign.quickIdle(S); if (!r.ok) { toast(r.reason); return; } save(); renderCurrency(); m.remove(); toast('快速掛機 ' + rewardText(r.reward)); };
    }
    function refreshIdle() {
        const p = Campaign.idlePending(S);
        const el = $('#idle-chip');
        el.innerHTML = `🏕️ 掛機收益 <b>${p.hours.toFixed(1)}h</b>`;
        el.classList.toggle('ready', p.hours >= 1);
    }

    const teamPower = () => S.team.filter(Boolean).reduce((a, id) => a + Growth.power(id, S.heroes[id]), 0);

    // ───────── 英雄 ─────────
    let heroFilter = 'all';
    const POS = ['前排 1', '前排 2', '後排 1', '後排 2', '後排 3'];
    function factionBonusText() {
        const counts = {};
        S.team.filter(Boolean).forEach(id => { const f = R.HEROES[id].faction; counts[f] = (counts[f] || 0) + 1; });
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (!best) return '隊伍是空的。';
        const [f, n] = best;
        const fac = R.FACTIONS[f];
        const tier = Object.keys(fac.passive.tiers).map(Number).filter(t => n >= t).sort((a, b) => b - a)[0];
        if (tier) return `<b style="color:${fac.color}">${fac.short}×${n}・${fac.passive.name}</b><br>${fac.passive.tiers[tier].desc}`;
        return `同陣營 3 人可獲得陣營被動。目前最多是 <b style="color:${fac.color}">${fac.short}×${n}</b>，再 ${3 - n} 位就有「${fac.passive.name}」。`;
    }
    function renderHero() {
        const p = $('#panel-hero');
        const ids = Object.keys(R.HEROES);
        const order = {UR: 0, SSR: 1, SR: 2, R: 3};
        const list = ids.filter(id => heroFilter === 'all' || R.HEROES[id].faction === heroFilter)
            .sort((a, b) => (!!S.heroes[b] - !!S.heroes[a]) || (order[R.HEROES[a].rarity] - order[R.HEROES[b].rarity]));
        const owned = Object.keys(S.heroes).length;
        p.innerHTML = head(`英雄　<small style="font-size:12px;color:var(--muted);letter-spacing:0">${owned} / ${ids.length}</small>`) + `<div class="pbody"><div class="hero-wrap">
            <div class="hero-side">
                <div class="slots">${S.team.map((id, i) => id
                    ? `<button class="slot filled" data-slot="${i}" style="--rc:${rc(R.HEROES[id].rarity)}"><img src="${face(R.HEROES[id].img)}" alt=""><span class="pos">${id === S.leader ? '★' : ''}${POS[i]}</span></button>`
                    : `<button class="slot" data-slot="${i}">空<span class="pos">${POS[i]}</span></button>`).join('')}</div>
                <div class="fac-note">${factionBonusText()}</div>
                <div class="fac-note">點英雄看詳情、上陣或設為隊長；點上方格子可以讓英雄下陣。前排 2 格、後排 3 格。</div>
                <div class="filters">${[['all', '全部'], ...Object.entries(R.FACTIONS).filter(([, f]) => f.passive).map(([k, f]) => [k, f.short])].map(([k, n]) => `<button class="${heroFilter === k ? 'on' : ''}" data-filter="${k}">${n}</button>`).join('')}</div>
            </div>
            <div class="hero-grid">${list.map(id => {
                const d = R.HEROES[id], o = S.heroes[id];
                return `<button class="hc ${o ? '' : 'locked'}" data-hero="${id}" style="--rc:${rc(d.rarity)};--fc:${fc(d.faction)}">
                    <img src="${face(d.img)}" alt="" loading="lazy"><span class="rt">${d.rarity}</span><span class="el">${R.ELEMENTS[d.element].icon}</span>
                    ${S.team.includes(id) ? '<span class="in-team">隊伍</span>' : ''}<span class="nm">${short(d.name)}${o ? `<br><small style="font-weight:400;color:#e7dcc8">Lv.${o.lv}　<span style="color:var(--gold-hi)">${'★'.repeat(o.star)}</span></small>` : ''}</span></button>`;
            }).join('')}</div></div></div>`;
        p.querySelectorAll('[data-filter]').forEach(b => { b.onclick = () => { heroFilter = b.dataset.filter; renderHero(); }; });
        p.querySelectorAll('[data-hero]').forEach(b => { b.onclick = () => showDetail(b.dataset.hero); });
        p.querySelectorAll('[data-slot]').forEach(b => { b.onclick = () => {
            const i = +b.dataset.slot;
            if (!S.team[i]) return;
            if (S.team.filter(Boolean).length <= 1) { toast('隊伍至少要留 1 位'); return; }
            const id = S.team[i];
            S.team[i] = null;
            if (S.leader === id) S.leader = S.team.find(Boolean);
            save(); renderHero();
        }; });
    }
    let detailTab = 'info';
    function showDetail(id, tab) {
        if (tab) detailTab = tab;
        const d = R.HEROES[id], o = S.heroes[id];
        if (!o) detailTab = 'info';
        const fac = R.FACTIONS[d.faction], el = R.ELEMENTS[d.element];
        const st = Growth.stats(id, o);
        const inTeam = S.team.includes(id);
        const box = $('#hero-detail');
        const tags = `<span class="tag" style="color:${rc(d.rarity)};border-color:${rc(d.rarity)}">${d.rarity}</span>
            <span class="tag" style="color:${fac.color}">${fac.name}</span><span class="tag">${el.icon} ${el.name}屬性</span><span class="tag">${R.ROLES[d.role].name}</span>
            ${o ? `<span class="tag">Lv.${o.lv}</span><span class="tag" style="color:var(--gold-hi)">${'★'.repeat(o.star)}${'☆'.repeat(Growth.MAX_STAR - o.star)}</span><span class="tag">戰力 ${Growth.power(id, o).toLocaleString()}</span>` : '<span class="tag" style="color:var(--muted)">未擁有：可從招募取得</span>'}`;
        const tabs = o ? `<div class="dt-tabs"><button class="${detailTab === 'info' ? 'on' : ''}" data-tab="info">資料</button><button class="${detailTab === 'grow' ? 'on' : ''}" data-tab="grow">養成</button></div>` : '';
        let body = '';
        if (detailTab === 'info') {
            body = `<div class="dt-stats"><div>生命<b>${st.hp}</b></div><div>攻擊<b>${st.atk}</b></div><div>防禦<b>${st.def}</b></div><div>速度<b>${st.spd}</b></div></div>
                <div class="sk"><span class="k">小技能・Lv.${o?.sk || 1}・冷卻 ${d.skill.cd}</span><b>${d.skill.name}</b><br>${d.skill.desc}</div>
                ${d.ult ? `<div class="sk"><span class="k">大招・Lv.${o?.ul || 1}・能量 ${R.ENERGY.max}</span><b style="color:${fac.color}">${d.ult.name}</b><br>${d.ult.desc}</div>` : ''}
                <div class="sk"><span class="k">被動</span><b>${d.passive.name}</b><br>${d.passive.desc}</div>
                ${o ? `<div class="dt-btns">
                    ${inTeam ? '<button class="btn" data-act="out">下陣</button>' : '<button class="btn primary" data-act="in">上陣</button>'}
                    ${S.leader === id ? '<button class="btn" disabled>目前隊長</button>' : '<button class="btn" data-act="lead">設為隊長</button>'}
                </div>` : ''}`;
        } else {
            body = growHtml(id, o);
        }
        box.innerHTML = `<div class="dt" style="--fc:${fac.color}"><button class="dt-close" data-x>✕</button>
            <div class="dt-art"><img src="${sprite(d.img)}" alt=""></div>
            <div class="dt-info"><h3>${d.name}</h3>${tags}${tabs}${body}</div></div>`;
        box.classList.add('show');
        box.querySelector('[data-x]').onclick = () => box.classList.remove('show');
        box.onclick = e => { if (e.target === box) box.classList.remove('show'); };
        box.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => showDetail(id, b.dataset.tab); });
        box.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => {
            const act = b.dataset.act;
            if (act === 'in') {
                const i = S.team.indexOf(null);
                if (i < 0) { toast('隊伍已滿，先點上方格子讓一位下陣'); return; }
                S.team[i] = id;
            } else if (act === 'out') {
                if (S.team.filter(Boolean).length <= 1) { toast('隊伍至少要留 1 位'); return; }
                S.team[S.team.indexOf(id)] = null;
                if (S.leader === id) S.leader = S.team.find(Boolean);
            } else if (act === 'lead') {
                S.leader = id;
                if (!S.team.includes(id)) { const i = S.team.indexOf(null); if (i >= 0) S.team[i] = id; }
                toast(`${short(d.name)} 成為隊長`);
            }
            save(); showDetail(id); renderHero(); renderMain();
        }; });
        box.querySelectorAll('[data-grow]').forEach(b => { b.onclick = () => {
            const [act, arg] = b.dataset.grow.split(':');
            const before = Growth.power(id, o);
            let r;
            if (act === 'lv') r = Growth.levelUp(S, id, +arg);
            else if (act === 'brk') r = Growth.breakThrough(S, id);
            else if (act === 'star') r = Growth.starUp(S, id);
            else r = Growth.skillUp(S, id, act);
            if (!r.ok) { toast(r.reason); return; }
            save();
            const after = Growth.power(id, o);
            toast(act === 'star' ? `升到 ${o.star}★！戰力 +${after - before}` : act === 'brk' ? `突破成功！等級上限 ${Growth.lvCap(o)}` : act === 'lv' ? `升到 Lv.${o.lv}　戰力 +${after - before}` : `技能升級！戰力 +${after - before}`);
            showDetail(id); renderHero(); renderCurrency();
        }; });
    }
    // 養成分頁：升級／突破、升星、技能
    function costTxt(c) { return Object.entries(c).map(([k, v]) => `<span class="${(S.currency[k] || 0) >= v ? '' : 'lack'}">${CUR[k].icon}${fmt(v)}</span>`).join(' '); }
    function growHtml(id, o) {
        const now = Growth.stats(id, o);
        const cap = Growth.lvCap(o);
        // 升級
        let lvRow;
        if (o.lv >= Growth.MAX_LV) lvRow = '<span class="gr-max">已達最高等級</span>';
        else if (o.lv >= cap) {
            const c = Growth.breakCost(o);
            lvRow = `<span class="gr-cost">突破：${costTxt(c)}</span><button class="btn primary" data-grow="brk">突破</button>`;
        } else {
            const c = Growth.lvCost(o.lv);
            const next = Growth.stats(id, {...o, lv: o.lv + 1});
            lvRow = `<span class="gr-cost">${costTxt(c)}　<small>攻擊 ${now.atk}→${next.atk}</small></span><button class="btn" data-grow="lv:1">升 1 級</button><button class="btn primary" data-grow="lv:10">升 10 級</button>`;
        }
        // 升星
        const sc = Growth.starCost(o);
        let starRow;
        if (!sc) starRow = '<span class="gr-max">已滿星：之後重複抽到會轉成星塵</span>';
        else {
            const next = Growth.stats(id, {...o, star: o.star + 1});
            const pct = Math.min(100, o.shards / sc * 100);
            starRow = `<span class="gr-cost"><span class="gr-bar"><i style="width:${pct}%"></i></span>碎片 ${o.shards} / ${sc}　<small>攻擊 ${now.atk}→${next.atk}（+${Math.round(Growth.STAR_PCT * 100)}% 全能力）</small></span><button class="btn ${o.shards >= sc ? 'primary' : ''}" data-grow="star" ${o.shards >= sc ? '' : 'disabled'}>升到 ${o.star + 1}★</button>`;
        }
        const skRow = (key, label, name) => {
            const lv = o[key] || 1, c = Growth.skillCost(lv);
            return `<div class="gr"><div class="gr-h"><b>${label}</b>${name}　<span class="gr-lv">Lv.${lv} / ${Growth.MAX_SKILL}</span>　<small>效果 +${Math.round(Growth.SKILL_PCT * 100 * (lv - 1))}%</small></div>
                <div class="gr-r">${c ? `<span class="gr-cost">${costTxt(c)}</span><button class="btn" data-grow="${key}">升級</button>` : '<span class="gr-max">已滿級</span>'}</div></div>`;
        };
        return `<div class="gr"><div class="gr-h"><b>等級</b>Lv.${o.lv} / ${cap}　<small>（突破 ${o.brk || 0} / 4，每級全能力 +${Math.round(Growth.LV_PCT * 100)}%）</small></div><div class="gr-r">${lvRow}</div></div>
            <div class="gr"><div class="gr-h"><b>星級</b><span style="color:var(--gold-hi)">${'★'.repeat(o.star)}${'☆'.repeat(Growth.MAX_STAR - o.star)}</span></div><div class="gr-r">${starRow}</div></div>
            ${skRow('sk', '小技能', R.HEROES[id].skill.name)}
            ${R.HEROES[id].ult ? skRow('ul', '大招', R.HEROES[id].ult.name) : ''}
            <div class="fac-note" style="margin-top:6px">碎片來自重複招募，也可以用星塵在背包的「星塵商店」換。經驗藥水、突破石、技能書目前先給試玩用的量，主線與掛機做好後從關卡取得。</div>`;
    }

    // ───────── 招募 ─────────
    let poolSel = null;
    function renderGacha() {
        if (!poolSel || (poolSel === 'newbie' && S.newbieDone)) poolSel = S.newbieDone ? 'ltd' : 'newbie';
        const p = $('#panel-gacha');
        const tabs = [];
        if (!S.newbieDone) tabs.push(['newbie', '新手招募', '免費 10 連・必出 SSR', true]);
        tabs.push(['ltd', 'S1 限定', 'UR 聖光使者·烏瑟']);
        tabs.push(['std', '常駐招募', '全部常駐英雄']);
        const P = Gacha.POOLS[poolSel];
        const ratesTxt = Object.entries(P.rates).sort((a, b) => a[1] - b[1]).map(([k, v]) => `<span style="color:${rc(k)}">${k}</span> ${(v * 100).toFixed(0)}%`).join('　');
        let pityTxt = '', art = '', sub = '', bbg = '';
        if (poolSel === 'newbie') {
            sub = '新旅團長專屬：免費 10 連抽一次，保證至少 1 位 SSR。';
            art = ['zeke', 'reina'].map(id => `<img src="${sprite(R.HEROES[id].img)}" alt="">`).join('');
            bbg = 'radial-gradient(ellipse at 75% 50%, #3b2f12, #120c06 70%)';
        } else if (poolSel === 'ltd') {
            sub = '聖光使者·烏瑟登場！UR 機率 2%，80 抽必定取得烏瑟，保底次數整個賽季延續。';
            pityTxt = `距離保底還有 <b>${Gacha.POOLS.ltd.urPity - S.pity.ltd.ur}</b> 抽`;
            art = `<img src="${sprite(R.HEROES.uther.img)}" alt="">`;
            bbg = 'radial-gradient(ellipse at 75% 45%, #5a4416, #120c06 70%)';
        } else {
            sub = '所有常駐英雄（不含 UR）。每 10 抽必出 SR 以上，50 抽內必出 SSR。';
            pityTxt = `距離 SSR 保底還有 <b>${Gacha.POOLS.std.ssrPity - S.pity.std.ssr}</b> 抽`;
            art = ['seraph', 'gaia'].map(id => `<img src="${sprite(R.HEROES[id].img)}" alt="">`).join('');
            bbg = 'radial-gradient(ellipse at 75% 50%, #1e2b3b, #0a0d12 70%)';
        }
        const btn = n => {
            if (poolSel === 'newbie') return `<button class="btn primary" data-pull="10">免費招募 10 次<small>只有一次</small></button>`;
            const pr = Gacha.price(S, poolSel, n);
            const parts = [];
            for (const [k, v] of Object.entries(pr.use)) if (v) parts.push(`${CUR[k].icon}${v}`);
            return `<button class="btn ${n === 10 ? 'primary' : ''}" data-pull="${n}" ${pr.ok ? '' : 'disabled'}>招募 ${n} 次<small>${parts.join(' + ') || '—'}${pr.ok ? '' : '（不足）'}</small></button>`;
        };
        p.innerHTML = head('招募') + `<div class="pbody" style="overflow:hidden"><div class="ga-wrap">
            <div class="ga-tabs">${tabs.map(([k, n, s, isNew]) => `<button class="ga-tab ${k === poolSel ? 'on' : ''}" data-pool="${k}"><b>${n}</b><span>${s}</span>${isNew ? '<i class="new">NEW</i>' : ''}</button>`).join('')}
                <div class="fac-note" style="margin-top:auto">重複取得的英雄轉成碎片：R 10、SR 20、SSR 40、UR 80。碎片之後用來升星。</div></div>
            <div class="ga-banner" style="--bbg:${bbg}"><div class="art">${art}</div>
                <div class="info"><h3>${P.name}</h3><div class="sub">${sub}</div><div class="rates">${ratesTxt}</div>
                ${pityTxt ? `<div class="pity">${pityTxt}</div>` : ''}
                <div class="buy">${poolSel === 'newbie' ? btn(10) : btn(1) + btn(10)}</div></div></div>
        </div></div>`;
        p.querySelectorAll('[data-pool]').forEach(b => { b.onclick = () => { poolSel = b.dataset.pool; renderGacha(); }; });
        p.querySelectorAll('[data-pull]').forEach(b => { b.onclick = () => doPull(+b.dataset.pull); });
    }
    async function doPull(n) {
        if (poolSel !== 'newbie' && !Gacha.pay(S, poolSel, n)) { toast('招募券和鑽石都不夠'); return; }
        if (poolSel === 'newbie' && S.newbieDone) return;
        const res = Gacha.pull(S, poolSel, n);
        save();
        await showPulls(res);
        renderGacha(); renderMain();
    }

    // 抽卡演出：卡背依最高稀有度發光 → 逐張翻開；SSR／UR 先播立繪登場
    function showPulls(res) {
        return new Promise(done => {
            const box = $('#pull-show');
            const best = ['UR', 'SSR', 'SR', 'R'].find(r => res.some(x => x.rarity === r));
            box.innerHTML = `<div class="ps-hint">點卡片翻開・點空白處全部翻開</div>
                <div class="ps-grid ${res.length === 1 ? 'one' : ''}">${res.map((x, i) => {
                    const d = R.HEROES[x.id];
                    const hi = x.rarity === 'SSR' || x.rarity === 'UR';
                    return `<div class="card ${hi ? 'hi' : ''}" data-i="${i}" style="--rc:${rc(x.rarity)};--gl:${hi ? '14px' : '0'}"><div class="in">
                        <div class="face-b">✦</div>
                        <div class="face-f"><img src="${face(d.img)}" alt=""><span class="r">${x.rarity}</span>
                        ${x.isNew ? '<span class="badge">NEW</span>' : x.dust ? `<span class="badge sh">星塵+${x.dust}</span>` : `<span class="badge sh">碎片+${x.shards}</span>`}<span class="n">${short(d.name)}</span></div></div></div>`;
                }).join('')}</div>
                <div class="splash"><img alt=""><div class="sx"><div class="r"></div><div class="n"></div><div class="f"></div></div><div class="tap">點一下繼續</div></div>
                <div class="ps-bottom"><button class="btn primary" id="ps-ok" style="display:none">確定</button></div>`;
            box.style.setProperty('--best', rc(best));
            box.classList.add('show');
            const cards = [...box.querySelectorAll('.card')];
            const splash = box.querySelector('.splash');
            let busy = false;
            const showSplash = x => new Promise(r => {
                const d = R.HEROES[x.id];
                splash.style.setProperty('--rc', rc(x.rarity));
                splash.querySelector('img').src = sprite(d.img);
                splash.querySelector('.r').textContent = x.rarity;
                splash.querySelector('.n').textContent = d.name;
                splash.querySelector('.f').textContent = `${R.FACTIONS[d.faction].name}・${R.ELEMENTS[d.element].name}屬性・${R.ROLES[d.role].name}` + (x.isNew ? '' : `　（重複，碎片 +${x.shards}）`);
                splash.classList.remove('show'); void splash.offsetWidth; splash.classList.add('show');
                splash.onclick = e => { e.stopPropagation(); splash.classList.remove('show'); r(); };
            });
            const open = async i => {
                const c = cards[i];
                if (!c || c.classList.contains('open')) return;
                const x = res[i];
                if ((x.rarity === 'SSR' || x.rarity === 'UR') && x.isNew) { busy = true; await showSplash(x); busy = false; }
                c.classList.add('open');
                if (cards.every(k => k.classList.contains('open'))) box.querySelector('#ps-ok').style.display = '';
            };
            cards.forEach((c, i) => { c.onclick = e => { e.stopPropagation(); if (!busy) open(i); }; });
            box.onclick = async () => {
                if (busy) return;
                for (let i = 0; i < cards.length; i++) {
                    if (cards[i].classList.contains('open')) continue;
                    await open(i);
                    await sleep(90);
                }
            };
            box.querySelector('#ps-ok').onclick = e => { e.stopPropagation(); box.classList.remove('show'); box.innerHTML = ''; done(); };
        });
    }

    // ───────── 背包、設定 ─────────
    let bagTab = 'items', shopHero = null;
    function renderBag() {
        const p = $('#panel-bag');
        const shardTotal = Object.values(S.heroes).reduce((a, o) => a + o.shards, 0);
        const tabs = `<div class="filters" style="margin-bottom:8px"><button class="${bagTab === 'items' ? 'on' : ''}" data-bag="items">道具</button><button class="${bagTab === 'shop' ? 'on' : ''}" data-bag="shop">星塵商店　✴️${fmt(S.currency.dust || 0)}</button></div>`;
        let body;
        if (bagTab === 'items') {
            body = `<div class="bag-grid">
                ${Object.entries(CUR).map(([k, c]) => `<div class="bag-item"><span class="bi">${c.icon}</span><div><b>${c.name}</b><small>${c.desc}</small></div><span class="cnt">${fmt(S.currency[k] || 0)}</span></div>`).join('')}
                <div class="bag-item"><span class="bi">🧩</span><div><b>英雄碎片</b><small>重複招募取得，用來升星（各英雄的數量在英雄詳情看）</small></div><span class="cnt">${shardTotal}</span></div>
            </div>`;
        } else {
            const own = Object.keys(S.heroes).filter(id => S.heroes[id].star < Growth.MAX_STAR);
            if (!own.includes(shopHero)) shopHero = own[0] || null;
            const sh = shopHero && S.heroes[shopHero];
            body = `<div class="fac-note" style="margin-bottom:8px">滿星的英雄再抽到時，碎片會變成星塵。星塵可以換任何已擁有、還沒滿星的英雄碎片（1 個碎片 ${Growth.DUST_PER_SHARD} 星塵），或換道具。</div>
                <div class="shop-wrap"><div class="shop-heroes">${own.map(id => `<button class="face ${id === shopHero ? 'on' : ''}" data-shop="${id}" style="--rc:${rc(R.HEROES[id].rarity)}"><img src="${face(R.HEROES[id].img)}" alt=""></button>`).join('') || '<span style="color:var(--muted)">沒有可以升星的英雄</span>'}</div>
                ${sh ? `<div class="shop-buy"><b>${short(R.HEROES[shopHero].name)}</b>　碎片 ${sh.shards} / ${Growth.starCost(sh)}
                    ${[10, 50].map(n => `<button class="btn" data-buy="${n}">換 ${n} 碎片<small style="display:block;font-size:10.5px">✴️${n * Growth.DUST_PER_SHARD}</small></button>`).join('')}</div>` : ''}</div>
                <div class="bag-grid" style="margin-top:10px">${Growth.DUST_SHOP.map(it => `<div class="bag-item"><span class="bi">${CUR[it.key].icon}</span><div><b>${it.name}</b><small>✴️${it.price}</small></div><button class="btn" data-item="${it.key}" style="margin-left:auto">兌換</button></div>`).join('')}</div>`;
        }
        p.innerHTML = head('背包') + `<div class="pbody">${tabs}${body}</div>`;
        p.querySelectorAll('[data-bag]').forEach(b => { b.onclick = () => { bagTab = b.dataset.bag; renderBag(); }; });
        p.querySelectorAll('[data-shop]').forEach(b => { b.onclick = () => { shopHero = b.dataset.shop; renderBag(); }; });
        p.querySelectorAll('[data-buy]').forEach(b => { b.onclick = () => { const r = Growth.buyShards(S, shopHero, +b.dataset.buy); if (!r.ok) return toast(r.reason); save(); toast('兌換成功'); renderBag(); renderCurrency(); }; });
        p.querySelectorAll('[data-item]').forEach(b => { b.onclick = () => { const r = Growth.buyItem(S, b.dataset.item); if (!r.ok) return toast(r.reason); save(); toast('兌換成功'); renderBag(); renderCurrency(); }; });
    }
    function renderSettings() {
        const p = $('#panel-settings');
        p.innerHTML = head('設定') + `<div class="pbody">
            <div class="set-row"><b>旅團長名稱</b><span class="sp">${S.name}</span><button class="btn" id="set-name">修改</button></div>
            <div class="set-row"><b>戰鬥測試頁</b><span class="sp">舊的編隊畫面，可以任選 22 位英雄測試戰鬥（不影響存檔）</span><a class="btn" href="dev.html">開啟</a></div>
            <div class="set-row"><b>重置存檔</b><span class="sp">刪除所有進度、重新開始（無法復原）</span><button class="btn" id="set-reset">重置</button></div>
            <div class="set-row"><b>存檔</b><span class="sp">目前存在這台裝置的瀏覽器裡；雲端存檔會在多人功能的階段加入。已招募 ${S.pulls} 次。</span></div>
        </div>`;
        p.querySelector('#set-name').onclick = () => {
            const n = prompt('旅團長名稱（最多 10 個字）', S.name);
            if (n && n.trim()) { S.name = n.trim().slice(0, 10); save(); renderSettings(); }
        };
        p.querySelector('#set-reset').onclick = () => {
            if (!confirm('確定要刪除所有進度、重新開始嗎？這個動作無法復原。')) return;
            S = Save.reset();
            closePanels();
            toast('存檔已重置');
        };
    }

    // ───────── 事件 ─────────
    document.addEventListener('click', e => {
        const o = e.target.closest('[data-open]');
        if (o) { e.preventDefault(); $('#hero-detail').classList.remove('show'); document.querySelectorAll('.modal').forEach(m => m.remove()); openPanel(o.dataset.open); if (o.dataset.open === 'battle') maybeChapterStory(); return; }
        if (e.target.closest('[data-close]')) closePanels();
    });
    $('#leader').onclick = say;
    $('#team-strip').onclick = () => openPanel('hero');
    function orient() {
        const portrait = innerHeight > innerWidth;
        $('#rotate-hint').classList.toggle('show', portrait && !orient.ok);
    }
    $('#rotate-ok').onclick = () => { orient.ok = true; orient(); };
    addEventListener('resize', orient);
    orient();
    $('#idle-chip').onclick = showIdle;
    setInterval(refreshIdle, 30000);
    renderMain();
    setTimeout(say, 800);
    // 從戰鬥回來：#map 打開地圖；#go=章-關 直接出戰下一關（會先播該播的劇情）
    const hm = location.hash.match(/^#(map|go)(?:=(\d+)-(\d+))?/);
    if (hm) {
        history.replaceState(null, '', location.pathname);
        if (hm[2]) mapCh = Number(hm[2]);
        openPanel('battle');
        if (hm[1] === 'go' && hm[2]) launchStage(Number(hm[2]), Number(hm[3]));
        else maybeChapterStory();
    } else if (!S.newbieDone) setTimeout(() => { if (!document.querySelector('.story')) toast('新手招募：免費 10 連抽，去「招募」看看！'); }, 1600);
    window.__lobby = {get save() { return S; }, openPanel, playStory, showStage, showIdle, reload: () => { S = Save.load(); renderMain(); }};   // 測試用
})();
