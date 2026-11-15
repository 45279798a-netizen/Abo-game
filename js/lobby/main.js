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
        gold:      {icon: ICON('gold'), name: '金幣', desc: '升級、強化裝備'},
        gem:       {icon: ICON('gem'), name: '鑽石', desc: '招募、快速掛機'},
        ticket:    {icon: ICON('ticket'), name: '招募券', desc: '常駐招募 1 次'},
        ltdTicket: {icon: ICON('ltdTicket'), name: '限定招募券', desc: 'S1 限定招募 1 次'},
        exp:       {icon: ICON('exp'), name: '經驗藥水', desc: '英雄升級'},
        brk:       {icon: ICON('brk'), name: '突破石', desc: '每 20 級突破一次，提高等級上限'},
        book:      {icon: ICON('book'), name: '技能書', desc: '小技能、大招升級'},
        stone:     {icon: ICON('stone'), name: '強化石', desc: '裝備強化；套裝副本、掛機、分解裝備取得'},
        awk:       {icon: ICON('awk'), name: '覺醒石', desc: '英雄 60 級、5 星後覺醒用；困難主線、巫妖王試煉、亡靈之塔、賽季商店取得'},
        badge:     {icon: ICON('badge'), name: '賽季徽章', desc: '賽季商店的貨幣；巫妖王試煉、亡靈之塔取得'},
        dust:      {icon: ICON('dust'), name: '星塵', desc: '滿星英雄的重複碎片轉成；到星塵商店換碎片與道具'},
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
        $('.lb-season').innerHTML = `<b>S${Season.state(S).n}</b> 亡靈的甦醒`;
        renderLeader(); renderCurrency(); renderTeam(); refreshIdle(); refreshPass();
        const best = Campaign.progress(S);
        const nx = Math.min(best + 1, R.CAMPAIGN.chapters.length * Campaign.N);
        $('#battle-sub').textContent = `主線 ${Math.ceil(nx / Campaign.N)}-${(nx - 1) % Campaign.N + 1}`;
        $('#trial-sub').textContent = best >= 15 ? `套裝副本・素材試煉` : '打完第 1 章開放';
        // 第一次打完第 1 章：提示裝備與試煉開放
        S.flags = S.flags || {};
        if (best >= 15 && !S.flags.gearIntro) { S.flags.gearIntro = true; save(); setTimeout(() => toast('裝備與素材試煉開放了！到「試煉」刷素材，英雄詳情有「裝備」分頁'), 900); }
        if (best >= 30 && !S.flags.setIntro) { S.flags.setIntro = true; save(); setTimeout(() => toast('套裝副本開放了！'), 2800); }
        $('#gacha-dot').classList.toggle('on', !S.newbieDone);
        $('#gacha-sub').textContent = S.newbieDone ? 'S1 限定・烏瑟' : '新手招募可以抽了！';
    }

    // ───────── 子畫面共用 ─────────
    function openPanel(name) {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'));
        const p = $('#panel-' + name);
        ({battle: renderBattle, trial: renderTrial, quest: renderQuest, hero: renderHero, gacha: renderGacha, bag: renderBag, settings: renderSettings, rank: renderRank, mail: renderMail, admin: renderAdmin})[name]?.();
        p.classList.add('show');
    }
    function closePanels() { document.querySelectorAll('.panel').forEach(p => p.classList.remove('show')); renderMain(); }
    const head = title => `<div class="ph"><h2>${title}</h2><div class="sp"></div><button class="close" data-close>✕</button></div>`;
    function toast(t) {
        const el = $('#toast');
        el.innerHTML = t;   // 可能帶圖示
        el.classList.add('show');
        clearTimeout(toast.t);
        toast.t = setTimeout(() => el.classList.remove('show'), 1800);
    }

    // ───────── 出征：主線章節地圖 ─────────
    const CH = R.CAMPAIGN.chapters;
    const NST = Campaign.N;
    const curChapter = () => Math.min(CH.length, Math.floor(Campaign.progress(S) / NST) + 1);
    let mapCh = null, mapHard = false;
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
        const hardOk = Season.hardChapterOpen(S, 1);
        if (!hardOk) mapHard = false;
        const hard = mapHard;
        const starOf = st => hard ? Season.hardStars(S, ch, st) : (S.campaign.stars[Campaign.key(ch, st)] || 0);
        const unOf = st => hard ? Season.hardUnlocked(S, ch, st) : Campaign.unlocked(S, ch, st);
        const stars = hard ? Season.hardChapterStars(S, ch) : Campaign.chapterStars(S, ch);
        const open = hard ? Season.hardChapterOpen(S, ch) : Campaign.unlocked(S, ch, 1);
        const rule = R.MODS[R.SEASON.hard.rules[ch - 1]];
        const chestHtml = hard ? '' : R.CAMPAIGN.chests.map((x, i) => {
            const got = S.campaign.chests[`${ch}:${i}`], ready = !got && stars >= x.stars;
            return `<button class="chest ${got ? 'got' : ''} ${ready ? 'ready' : ''}" data-chest="${i}" title="${x.stars} 星寶箱">${got ? ICON('chest_open') : ICON('chest')}<b>${x.stars}</b></button>`;
        }).join('');
        const path = NODE_POS.map((q, i) => `${i ? 'L' : 'M'}${q.x} ${q.y}`).join(' ');
        const nodes = NODE_POS.map((q, i) => {
            const st = i + 1, kind = Campaign.kindOf(st), k = Campaign.key(ch, st);
            const got = starOf(st), un = unOf(st), next = un && !got;
            const inner = kind === 'boss' ? `<img src="${face(R.ENEMIES[c.boss].img)}" alt="">` : `<span>${st}</span>`;
            return `<button class="node ${kind} ${un ? '' : 'lock'} ${got ? 'done' : ''} ${next ? 'next' : ''}" style="left:${q.x}%;top:${q.y}%" data-st="${st}">
                ${inner}${got ? `<div class="nstars">${starsHtml(got)}</div>` : ''}${!un ? '<em>🔒</em>' : ''}</button>`;
        }).join('');
        const idle = Campaign.idlePending(S);
        p.innerHTML = `<div class="map ${hard ? 'hard' : ''}" style="background-image:url(assets/hd/land_${c.bgHD}.webp)">
            <div class="map-shade"></div>
            <svg class="map-path" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${path}"/></svg>
            ${nodes}
            <div class="map-top">
                <button class="chv" data-chv="-1" ${ch <= 1 ? 'disabled' : ''}>◀</button>
                <div class="ch-title"><small>第 ${ch} 章${hard ? '・困難' : ''}</small><b>${c.name}</b></div>
                <button class="chv" data-chv="1" ${ch >= CH.length || !(hard ? Season.hardChapterOpen(S, ch + 1) : Campaign.unlocked(S, ch + 1, 1)) ? 'disabled' : ''}>▶</button>
                <div class="mode-tg"><button class="${hard ? '' : 'on'}" data-hard="0">普通</button><button class="${hard ? 'on' : ''}" data-hard="1" ${hardOk ? '' : 'disabled title="打完第 1 章開放"'}>困難${hardOk ? '' : ' 🔒'}</button></div>
                ${hard ? `<span class="mod" title="這一章的規則"><b>${rule.name}</b>${rule.desc}</span>` : ''}
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
                <button class="btn" id="map-story" ${open ? '' : 'disabled'}>${ICON('m_story')} 劇情</button>
                <button class="btn idle-btn" id="map-idle">${ICON('idle')} 掛機 <small>${idle.hours.toFixed(1)}h</small></button>
            </div>
            ${open ? '' : `<div class="ch-lock">${hard ? '先打完普通模式的這一章，才能挑戰困難' : '先打倒上一章的首領才能進入'}</div>`}
        </div>`;
        p.querySelectorAll('[data-chv]').forEach(b => { b.onclick = () => { mapCh = Math.max(1, Math.min(CH.length, ch + Number(b.dataset.chv))); renderBattle(); maybeChapterStory(); }; });
        p.querySelectorAll('[data-hard]').forEach(b => { b.onclick = () => {
            mapHard = b.dataset.hard === '1';
            // 切到困難時，如果這一章還沒開放，就跳到已開放的最後一章
            if (mapHard) while (mapCh > 1 && !Season.hardChapterOpen(S, mapCh)) mapCh--;
            renderBattle();
        }; });
        p.querySelectorAll('[data-st]').forEach(b => { b.onclick = () => { const st = Number(b.dataset.st); if (!unOf(st)) { toast(hard && !open ? '先打完普通模式的這一章' : '先通過前一關'); return; } showStage(ch, st, hard); }; });
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
    // 困難關卡的推薦戰力：參考隊伍在那一關預期養成下的戰力
    function hardRecommend(ch, st) {
        const g = Season.hardGrowthSpec(Campaign.idxOf(ch, st)), gb = Gear.expectedBonus(g.i);
        const sum = Campaign.REF_TEAM.reduce((a, id) => { const star = Math.min(Growth.MAX_STAR, Save.START_STAR[R.HEROES[id].rarity] + g.star); return a + Growth.power(id, {lv: g.lv, star, sk: g.sk, ul: g.sk, awk: g.awk && star >= R.AWAKEN.star}, gb); }, 0);
        return Math.round(sum / 100) * 100;
    }
    const modHtml = list => list.filter(m => typeof m === 'string').map(m => `<span class="mod"><b>${R.MODS[m].name}</b>${R.MODS[m].desc}</span>`).join('');
    function showStage(ch, st, hard) {
        const s = hard ? Season.hardStage(ch, st) : Campaign.stage(ch, st), k = s.key;
        const got = hard ? Season.hardStars(S, ch, st) : (S.campaign.stars[k] || 0);
        const rec = hard ? hardRecommend(ch, st) : Campaign.recommend(ch, st), tp = teamPower();
        const foes = [...s.front, ...s.back];
        const uniq = [...new Set(foes)];
        const m = modal(`<div class="st-head"><span class="kind ${s.kind}">${s.difficulty}</span><h3>${ch}-${st}　${s.kind === 'boss' ? s.name : CH[ch - 1].name}</h3><div class="st-stars">${starsHtml(got)}</div></div>
            <div class="foes">${uniq.map(id => `<div class="face ${R.ENEMIES[id].boss ? 'boss' : ''}" title="${R.ENEMIES[id].name}"><img src="${face(R.ENEMIES[id].img)}" alt=""><span>${foes.filter(x => x === id).length > 1 ? '×' + foes.filter(x => x === id).length : ''}</span></div>`).join('')}</div>
            <div class="pow">推薦戰力 <b>${rec.toLocaleString()}</b>　隊伍戰力 <b class="${tp >= rec ? 'ok' : 'low'}">${tp.toLocaleString()}</b></div>
            ${hard ? `<div class="mods">${modHtml(s.mods)}</div>` : ''}
            <ul class="conds">
                <li class="${got >= 1 ? 'ok' : ''}">★ 通關</li>
                <li>★ 沒有英雄陣亡</li>
                <li>★ ${s.rounds} 回合內通關</li>
            </ul>
            <div class="rws"><span class="muted">${got ? '重打獎勵' : '首通獎勵'}</span>${rewardHtml(hard ? (got ? Season.hardRepeatReward(ch, st) : Season.hardFirstReward(ch, st)) : (got ? Campaign.repeatReward(ch, st) : Campaign.firstReward(ch, st)))}</div>
            <div class="row">
                <div class="sp"></div><button class="btn primary" id="st-go">出戰</button>
            </div>`, 'stage');
        m.querySelector('#st-go').onclick = () => { m.remove(); launchStage(ch, st, hard); };
    }

    async function launchStage(ch, st, hard) {
        const team = S.team.filter(Boolean);
        if (!team.length) { toast('隊伍裡至少要有 1 位英雄'); return; }
        if (!hard && st === 1 && !S.campaign.story[`${ch}:start`]) await playStory(ch, 'start');
        if (!hard && st === NST && !S.campaign.story[`${ch}:boss`]) await playStory(ch, 'boss');
        let auto = true;
        try { auto = (JSON.parse(localStorage.getItem('pr_hd2dBattle') || '{}').auto) !== false; } catch (e) { /* 預設自動 */ }
        localStorage.setItem('pr_hd2dBattle', JSON.stringify({team: S.team.map(x => x || null), stage: hard ? {ch, st, hard: true} : {ch, st}, auto, growth: battleGrowth(team), from: 'lobby'}));
        location.href = 'hd2d.html';
    }

    // ───────── 掛機 ─────────
    function showIdle() {
        const p = Campaign.idlePending(S), rate = Campaign.idleRate(S), q = Campaign.quickInfo(S);
        const best = Campaign.progress(S);
        const m = modal(`<h3>${ICON('idle')} 掛機收益</h3>
            <p class="muted">英雄們會在你離開時繼續討伐魔物。收益依最高通關關卡（目前 ${best ? `${Math.ceil(best / NST)}-${(best - 1) % NST + 1}` : '尚未通關'}），最多累積 ${Campaign.IDLE_MAX_H} 小時。</p>
            <div class="idle-bar"><i style="width:${p.hours / Campaign.IDLE_MAX_H * 100}%"></i><span>${p.hours.toFixed(1)} / ${Campaign.IDLE_MAX_H} 小時</span></div>
            <div class="rws"><span class="muted">可領取</span>${rewardHtml(p.reward) || '<span class="muted">還沒有累積</span>'}</div>
            <div class="rws"><span class="muted">每小時</span>${rewardHtml({gold: Math.floor(rate.gold), exp: Math.floor(rate.exp)})}<span class="rw">${CUR.brk.icon}${rate.brk.toFixed(2)}</span>${rate.stone ? `<span class="rw">${ICON('stone')}${rate.stone.toFixed(1)}</span><span class="rw">${ICON('chest')} 散件裝備 ${rate.gearPerH}</span>` : ''}</div>
            <div class="row"><button class="btn" id="idle-quick" ${q.cost == null ? 'disabled' : ''}>⚡ 快速掛機 2 小時${q.cost == null ? '（今天用完）' : q.cost ? `（${ICON('gem')}${q.cost}）` : '（今日免費）'}</button><div class="sp"></div>
            <button class="btn primary" id="idle-claim" ${p.reward.gold > 0 ? '' : 'disabled'}>領取</button></div>`, 'idle');
        m.querySelector('#idle-claim').onclick = () => { const r = Campaign.idleClaim(S); save(); renderCurrency(); m.remove(); toast('領取 ' + rewardText(r.reward) + (r.gear?.length ? `、裝備 ${r.gear.length} 件` : '')); refreshIdle(); if ($('#panel-battle').classList.contains('show')) renderBattle(); };
        m.querySelector('#idle-quick').onclick = () => { const r = Campaign.quickIdle(S); if (!r.ok) { toast(r.reason); return; } save(); renderCurrency(); m.remove(); toast('快速掛機 ' + rewardText(r.reward) + (r.gear?.length ? `、裝備 ${r.gear.length} 件` : '')); };
    }
    function refreshIdle() {
        const p = Campaign.idlePending(S);
        const el = $('#idle-chip');
        el.innerHTML = `${ICON('idle')} 掛機收益 <b>${p.hours.toFixed(1)}h</b>`;
        el.classList.toggle('ready', p.hours >= 1);
    }

    const heroPower = id => Growth.power(id, S.heroes[id], Gear.bonus(S, id));
    const teamPower = () => S.team.filter(Boolean).reduce((a, id) => a + heroPower(id), 0);
    // 出戰時傳給戰鬥引擎：養成倍率＋裝備加成
    const battleGrowth = team => Object.fromEntries(team.map(id => [id, {...Growth.multipliers(id, S.heroes[id]), gear: Gear.bonus(S, id)}]));

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
        const st = Growth.stats(id, o, o ? Gear.bonus(S, id) : null);
        const inTeam = S.team.includes(id);
        const box = $('#hero-detail');
        const tags = `<span class="tag" style="color:${rc(d.rarity)};border-color:${rc(d.rarity)}">${d.rarity}</span>
            <span class="tag" style="color:${fac.color}">${fac.emblem || ''}${fac.name}</span><span class="tag">${el.icon} ${el.name}屬性</span><span class="tag">${R.ROLES[d.role].name}</span>
            ${o ? `<span class="tag">Lv.${o.lv}</span><span class="tag" style="color:var(--gold-hi)">${'★'.repeat(o.star)}${'☆'.repeat(Growth.MAX_STAR - o.star)}</span>${o.awk ? '<span class="tag awk-tag">已覺醒</span>' : ''}<span class="tag">戰力 ${heroPower(id).toLocaleString()}</span>` : '<span class="tag" style="color:var(--muted)">未擁有：可從招募取得</span>'}`;
        if (detailTab === 'gear' && !gearOpen()) detailTab = 'info';
        const tabs = o ? `<div class="dt-tabs"><button class="${detailTab === 'info' ? 'on' : ''}" data-tab="info">資料</button><button class="${detailTab === 'grow' ? 'on' : ''}" data-tab="grow">養成</button>${gearOpen() ? `<button class="${detailTab === 'gear' ? 'on' : ''}" data-tab="gear">裝備</button>` : '<button disabled title="打完第 1 章開放">裝備 🔒</button>'}</div>` : '';
        let body = '';
        if (detailTab === 'info') {
            body = `<div class="dt-stats"><div>生命<b>${st.hp}</b></div><div>攻擊<b>${st.atk}</b></div><div>防禦<b>${st.def}</b></div><div>速度<b>${st.spd}</b></div>
                <div>暴擊率<b>${Math.round(st.crit * 100)}%</b></div><div>暴擊傷害<b>${Math.round(st.critDmg * 100)}%</b></div><div>效果命中<b>${Math.round(st.hit * 100)}%</b></div><div>效果抵抗<b>${Math.round(st.res * 100)}%</b></div></div>
                <div class="sk"><span class="k">小技能・Lv.${o?.sk || 1}・冷卻 ${d.skill.cd}</span><b>${d.skill.name}</b><br>${d.skill.desc}</div>
                ${d.ult ? `<div class="sk"><span class="k">大招・Lv.${o?.ul || 1}・能量 ${R.ENERGY.max}</span><b style="color:${fac.color}">${d.ult.name}</b><br>${d.ult.desc}</div>` : ''}
                <div class="sk"><span class="k">被動</span><b>${d.passive.name}</b><br>${d.passive.desc}</div>
                <div class="sk awk ${o?.awk ? 'on' : ''}"><span class="k">覺醒・${o?.awk ? '已開啟' : `Lv.${R.AWAKEN.lv}、${R.AWAKEN.star}★ 後可開啟`}</span><b>${d.awaken.name}</b><br>全能力 +${Math.round(R.AWAKEN.stat[d.rarity] * 100)}%；${d.awaken.desc}</div>
                ${o ? `<div class="dt-btns">
                    ${inTeam ? '<button class="btn" data-act="out">下陣</button>' : '<button class="btn primary" data-act="in">上陣</button>'}
                    ${S.leader === id ? '<button class="btn" disabled>目前隊長</button>' : '<button class="btn" data-act="lead">設為隊長</button>'}
                </div>` : ''}`;
        } else if (detailTab === 'gear') {
            body = gearTabHtml(id);
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
        if (detailTab === 'gear') bindGearTab(id, box);
        box.querySelectorAll('[data-grow]').forEach(b => { b.onclick = () => {
            const [act, arg] = b.dataset.grow.split(':');
            const before = heroPower(id);
            let r;
            if (act === 'lv') r = Growth.levelUp(S, id, +arg);
            else if (act === 'brk') r = Growth.breakThrough(S, id);
            else if (act === 'star') r = Growth.starUp(S, id);
            else if (act === 'awk') r = Growth.awaken(S, id);
            else r = Growth.skillUp(S, id, act);
            if (!r.ok) { toast(r.reason); return; }
            save();
            const after = heroPower(id);
            toast(act === 'awk' ? `覺醒成功！${d.awaken.name}　戰力 +${after - before}` : act === 'star' ? `升到 ${o.star}★！戰力 +${after - before}` : act === 'brk' ? `突破成功！等級上限 ${Growth.lvCap(o)}` : act === 'lv' ? `升到 Lv.${o.lv}　戰力 +${after - before}` : `技能升級！戰力 +${after - before}`);
            showDetail(id); renderHero(); renderCurrency();
        }; });
    }
    // 養成分頁：升級／突破、升星、技能
    function costTxt(c) { return Object.entries(c).map(([k, v]) => `<span class="${(S.currency[k] || 0) >= v ? '' : 'lack'}">${CUR[k].icon}${fmt(v)}</span>`).join(' '); }
    function awkRow(id, o) {
        const d = R.HEROES[id], A = R.AWAKEN, aw = d.awaken, pct = Math.round(A.stat[d.rarity] * 100);
        const ready = o.lv >= A.lv && o.star >= A.star;
        const right = o.awk ? '<span class="gr-max">已覺醒</span>'
            : ready ? `<span class="gr-cost">${costTxt(Growth.awakenCost(id))}</span><button class="btn primary" data-grow="awk">覺醒</button>`
            : `<span class="gr-cost"><span class="${o.lv >= A.lv ? '' : 'lack'}">Lv.${A.lv}</span>、<span class="${o.star >= A.star ? '' : 'lack'}">${A.star}★</span> 後可覺醒　${costTxt(Growth.awakenCost(id))}</span>`;
        return `<div class="gr awk ${o.awk ? 'on' : ''}"><div class="gr-h"><b>覺醒</b>${aw.name}　<small>全能力 +${pct}%；${aw.desc}</small></div><div class="gr-r">${right}</div></div>`;
    }
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
            ${awkRow(id, o)}
            <div class="fac-note" style="margin-top:6px">碎片來自重複招募，也可以用星塵在背包的「星塵商店」換。經驗藥水、突破石、技能書主要從「試煉」取得，主線首通與掛機也會給一些。覺醒石來自困難主線、巫妖王試煉、亡靈之塔與賽季商店。</div>`;
    }


    // ───────── 裝備 ─────────
    const GR = R.GEAR;
    const gearOpen = () => Campaign.progress(S) >= 15;   // 打完第 1 章開放
    const qc = q => GR.QUALITY[q].color;
    const gearName = it => `${GR.QUALITY[it.q].name}${it.set ? GR.SETS[it.set].name : ''}${GR.SLOTS[it.slot].name}`;
    const gearIcon = (it, extra = '') => `<div class="gi ${it.set ? 'setd' : ''}" style="--qc:${qc(it.q)};--sc:${it.set ? GR.SETS[it.set].color : 'transparent'}" ${extra}><span class="gs">${GR.SLOTS[it.slot].icon}</span>${it.lvl ? `<span class="glv">+${it.lvl}</span>` : ''}${it.set ? `<span class="gset">${GR.SETS[it.set].icon}</span>` : ''}${it.hero ? `<img class="gwho" src="${face(R.HEROES[it.hero].img)}" alt="">` : ''}${it.lock ? `<span class="glock">${ICON('key')}</span>` : ''}</div>`;
    function gearStatsHtml(it) {
        const main = `<div class="gmain">${GR.STATS[it.main.k].name} <b>+${Gear.fmtStat(it.main.k, Gear.mainValue(it))}</b></div>`;
        const subs = it.subs.map(x => `<div class="gsub">${GR.STATS[x.k].name} +${Gear.fmtStat(x.k, x.v)}${x.n > 1 ? `<small>（強化 ${x.n - 1} 次）</small>` : ''}</div>`).join('');
        const left = 4 - it.subs.length;
        const next = it.lvl < GR.MAX_LV ? `<div class="gnote">下一次 +${Math.ceil((it.lvl + 1) / 3) * 3}：${left > 0 ? '新增一條副屬性' : '隨機加強一條副屬性'}</div>` : '';
        const set = it.set ? `<div class="gsetd" style="color:${GR.SETS[it.set].color}">${GR.SETS[it.set].icon} ${GR.SETS[it.set].name}套裝　2 件：${GR.SETS[it.set].desc2}　4 件：${GR.SETS[it.set].desc4}</div>` : '<div class="gnote">散件：沒有套裝效果</div>';
        return main + subs + next + set;
    }
    // 一件裝備的詳細資料：強化、上鎖、卸下、分解
    function showGear(itId, after) {
        const it = Gear.byId(S, itId);
        if (!it) return;
        const c = Gear.enhanceCost(it);
        const m = modal(`<div class="g-head">${gearIcon(it)}<div><h3 style="color:${qc(it.q)}">${gearName(it)} ${it.lvl ? '+' + it.lvl : ''}</h3>
                <div class="muted">${it.hero ? `穿在 ${short(R.HEROES[it.hero].name)} 身上` : '沒有人穿'}</div></div></div>
            ${gearStatsHtml(it)}
            <div class="row">${it.lvl < GR.MAX_LV ? `<span class="gr-cost">${costTxt(c)}</span><button class="btn" data-g="up1">強化 +1</button><button class="btn primary" data-g="up3">強化到 +${Math.min(GR.MAX_LV, Math.floor(it.lvl / 3) * 3 + 3)}</button>` : '<span class="muted">已強化到最高</span>'}</div>
            <div class="row"><button class="btn" data-g="lock">${it.lock ? '解鎖' : '上鎖'}</button>
                ${it.hero ? '<button class="btn" data-g="off">卸下</button>' : `<button class="btn" data-g="salv" ${it.lock ? 'disabled' : ''}>分解（${ICON('stone')}${Gear.salvageValue(it)}）</button>`}</div>`, 'gear');
        const done = msg => { save(); renderCurrency(); m.remove(); if (msg) toast(msg); (after || (() => {}))(); };
        m.querySelectorAll('[data-g]').forEach(b => { b.onclick = () => {
            const a = b.dataset.g;
            if (a === 'up1' || a === 'up3') {
                const target = a === 'up1' ? it.lvl + 1 : Math.min(GR.MAX_LV, Math.floor(it.lvl / 3) * 3 + 3);
                let r, notes = [];
                while (it.lvl < target) { r = Gear.enhance(S, it); if (!r.ok) break; if (r.note) notes.push(r.note === 'new' ? `新增${GR.STATS[it.subs[it.subs.length - 1].k].name}` : `${GR.STATS[r.note].name}提升`); }
                save(); renderCurrency();
                if (r && !r.ok && it.lvl < target) toast(r.reason);
                else toast(`強化到 +${it.lvl}${notes.length ? '！' + notes.join('、') : ''}`);
                m.remove(); showGear(itId, after); (after || (() => {}))();
                return;
            }
            if (a === 'lock') { it.lock = !it.lock; save(); m.remove(); showGear(itId, after); return; }
            if (a === 'off') { Gear.unequip(S, it.id); done('已卸下'); return; }
            if (a === 'salv') { const r = Gear.salvage(S, [it.id]); done(`分解獲得 ${ICON('stone')}${r.stone}`); }
        }; });
    }
    // 英雄詳情的「裝備」分頁
    let gearSlotSel = 'weapon';
    function gearTabHtml(id) {
        const eq = Gear.equipped(S, id), b = Gear.bonus(S, id);
        const slots = GR.SLOT_ORDER.map(sl => `<button class="gslot ${sl === gearSlotSel ? 'on' : ''}" data-gslot="${sl}">${eq[sl] ? gearIcon(eq[sl]) : `<div class="gi empty"><span class="gs">${GR.SLOTS[sl].icon}</span></div>`}<small>${GR.SLOTS[sl].name}</small></button>`).join('');
        const sets = Object.entries(b.sets).filter(([, n]) => n >= 2).map(([k, n]) => `<span style="color:${GR.SETS[k].color}">${GR.SETS[k].icon}${GR.SETS[k].name} ${n >= 4 ? '4 件' : '2 件'}：${n >= 4 ? GR.SETS[k].desc2 + '、' + GR.SETS[k].desc4 : GR.SETS[k].desc2}</span>`).join('<br>') || '<span class="muted">沒有套裝效果（同套裝 2 件／4 件生效）</span>';
        const role = R.HEROES[id].role;
        const cand = (S.gear || []).filter(it => it.slot === gearSlotSel && it.hero !== id).sort((x, y) => (!!x.hero - !!y.hero) || Gear.score(y, role) - Gear.score(x, role)).slice(0, 24);
        const cur = eq[gearSlotSel];
        return `<div class="gslots">${slots}</div>
            <div class="gsets">${sets}</div>
            <div class="dt-btns"><button class="btn primary" data-gact="auto">一鍵穿最好</button><button class="btn" data-gact="off">全部卸下</button><button class="btn" data-gact="move">整套給…</button></div>
            ${cur ? `<div class="gcur"><div class="g-head">${gearIcon(cur, `data-gview="${cur.id}"`)}<div><b style="color:${qc(cur.q)}">${gearName(cur)} ${cur.lvl ? '+' + cur.lvl : ''}</b><div class="muted">點圖示可以強化</div></div></div>${gearStatsHtml(cur)}</div>` : ''}
            <div class="gh">可換的${GR.SLOTS[gearSlotSel].name}（${cand.length}）</div>
            <div class="glist">${cand.map(it => `<button class="gpick" data-gpick="${it.id}">${gearIcon(it)}<span>${GR.STATS[it.main.k].name} +${Gear.fmtStat(it.main.k, Gear.mainValue(it))}</span></button>`).join('') || '<span class="muted">背包裡沒有這個欄位的裝備，去「試煉」的套裝副本拿</span>'}</div>`;
    }
    function bindGearTab(id, box) {
        const re = () => { save(); showDetail(id, 'gear'); renderHero(); };
        box.querySelectorAll('[data-gslot]').forEach(b => { b.onclick = () => { gearSlotSel = b.dataset.gslot; showDetail(id, 'gear'); }; });
        box.querySelectorAll('[data-gview]').forEach(b => { b.onclick = () => showGear(b.dataset.gview, () => showDetail(id, 'gear')); });
        box.querySelectorAll('[data-gpick]').forEach(b => { b.onclick = () => {
            const it = Gear.byId(S, b.dataset.gpick);
            const cur = Gear.equipped(S, id)[it.slot];
            const m = modal(`<h3>換上這件？</h3><div class="gcmp"><div>${cur ? `<b style="color:${qc(cur.q)}">目前：${gearName(cur)} +${cur.lvl}</b>${gearStatsHtml(cur)}` : '<b>目前沒有裝備</b>'}</div>
                <div><b style="color:${qc(it.q)}">${gearName(it)} +${it.lvl}</b>${gearStatsHtml(it)}${it.hero ? `<div class="gnote" style="color:#fca5a5">會從 ${short(R.HEROES[it.hero].name)} 身上拿過來</div>` : ''}</div></div>
                <div class="row"><button class="btn" data-x2="view">強化這件</button><div class="sp"></div><button class="btn primary" data-x2="on">穿上</button></div>`, 'gear');
            m.querySelector('[data-x2="on"]').onclick = () => { Gear.equip(S, id, it.id); m.remove(); re(); toast('已穿上'); };
            m.querySelector('[data-x2="view"]').onclick = () => { m.remove(); showGear(it.id, () => showDetail(id, 'gear')); };
        }; });
        box.querySelectorAll('[data-gact]').forEach(b => { b.onclick = () => {
            const a = b.dataset.gact;
            if (a === 'auto') { const before = heroPower(id); const n = Gear.autoEquip(S, id); re(); toast(n ? `穿上 ${n} 件，戰力 ${before.toLocaleString()} → ${heroPower(id).toLocaleString()}` : '背包裡沒有可以穿的裝備'); }
            else if (a === 'off') { Gear.unequipAll(S, id); re(); toast('已全部卸下'); }
            else {
                const others = Object.keys(S.heroes).filter(h => h !== id);
                const m = modal(`<h3>把整套裝備給誰？</h3><p class="muted">對方身上原本的裝備會卸下。</p>
                    <div class="mv-list">${others.map(h => `<button class="face" data-mv="${h}" style="--rc:${rc(R.HEROES[h].rarity)}"><img src="${face(R.HEROES[h].img)}" alt="">${S.team.includes(h) ? '<span class="lead">隊伍</span>' : ''}</button>`).join('')}</div>`);
                m.querySelectorAll('[data-mv]').forEach(x => { x.onclick = () => { const n = Gear.moveAll(S, id, x.dataset.mv); m.remove(); save(); renderHero(); showDetail(x.dataset.mv, 'gear'); toast(n ? `${n} 件裝備給了 ${short(R.HEROES[x.dataset.mv].name)}` : '身上沒有裝備'); }; });
            }
        }; });
    }
    // 背包的「裝備」分頁
    let bagSlot = 'all';
    function bagGearHtml() {
        if (!gearOpen()) return '<div class="fac-note">打完第 1 章後開放裝備。</div>';
        const list = (S.gear || []).filter(it => bagSlot === 'all' || it.slot === bagSlot).sort((a, b) => b.q - a.q || b.lvl - a.lvl);
        const salvN = q => (S.gear || []).filter(it => !it.hero && !it.lock && it.q <= q && it.lvl === 0).length;
        return `<div class="filters" style="margin-bottom:8px">${[['all', '全部'], ...GR.SLOT_ORDER.map(k => [k, GR.SLOTS[k].icon + GR.SLOTS[k].name])].map(([k, n]) => `<button class="${bagSlot === k ? 'on' : ''}" data-bslot="${k}">${n}</button>`).join('')}
                <span class="sp"></span><span class="muted">共 ${(S.gear || []).length} 件　${ICON('stone')}${fmt(S.currency.stone || 0)}</span></div>
            <div class="glist big">${list.map(it => `<button class="gpick" data-bgear="${it.id}">${gearIcon(it)}</button>`).join('') || '<span class="muted">還沒有裝備</span>'}</div>
            <div class="row"><span class="muted">一鍵分解（沒穿、沒上鎖、沒強化過）：</span>
                <button class="btn" data-salv="1">白＋綠（${salvN(1)}）</button><button class="btn" data-salv="2">藍以下（${salvN(2)}）</button></div>`;
    }
    function bindBagGear(p) {
        p.querySelectorAll('[data-bslot]').forEach(b => { b.onclick = () => { bagSlot = b.dataset.bslot; renderBag(); }; });
        p.querySelectorAll('[data-bgear]').forEach(b => { b.onclick = () => showGear(b.dataset.bgear, renderBag); });
        p.querySelectorAll('[data-salv]').forEach(b => { b.onclick = () => {
            const q = +b.dataset.salv;
            const ids = (S.gear || []).filter(it => !it.hero && !it.lock && it.q <= q && it.lvl === 0).map(it => it.id);
            if (!ids.length) { toast('沒有可以分解的裝備'); return; }
            if (!confirm(`分解 ${ids.length} 件裝備？`)) return;
            const r = Gear.salvage(S, ids); save(); renderBag(); renderCurrency(); toast(`分解 ${r.n} 件，獲得 ${ICON('stone')}${r.stone}`);
        }; });
    }

    // ───────── 試煉：套裝副本與素材試煉 ─────────
    const DG = R.DUNGEONS;
    function renderTrial() {
        const p = $('#panel-trial');
        const card = (kind, d) => {
            const open = Dungeon.unlockedDungeon(S, kind, d.id), best = Dungeon.best(S, kind, d.id);
            const boss = R.ENEMIES[d.boss];
            const lockTxt = d.unlock === 15 ? '打完第 1 章開放' : d.unlock === 30 ? '打完第 2 章開放' : `打完第 ${d.unlock / 15} 章開放`;
            return `<button class="tcard ${open ? '' : 'lock'}" data-dg="${kind}:${d.id}">
                <img class="tboss" src="${sprite(boss.img)}" alt="">
                <div class="tinfo"><b>${kind === 'trial' ? d.icon + ' ' : ''}${d.name}</b><small>${kind === 'set' ? d.sets.map(k => `<span style="color:${GR.SETS[k].color}">${GR.SETS[k].icon}${GR.SETS[k].name}</span>`).join(' ') : d.desc}</small>
                <span class="tbest">${open ? `最高 ${best} / ${DG.floors} 層${kind === 'trial' ? `<br>今日次數 <em>${Dungeon.trialLeft(S, d.id)}</em> / ${DG.trialMax}` : ''}` : '🔒 ' + lockTxt}</span></div></button>`;
        };
        p.innerHTML = `<div class="trial" style="background-image:url(assets/hd/dungeon_bg.webp)"><div class="map-shade"></div>
            <div class="map-top"><div class="ch-title"><small>TRIALS</small><b>試煉</b></div><div class="sp"></div>
<button class="close" data-close>✕</button></div>
            <div class="tbody">
                ${seasonRowHtml()}
                <h4>套裝副本 <small>掉落套裝裝備與強化石</small></h4><div class="trow">${DG.sets.map(d => card('set', d)).join('')}</div>
                <h4>素材試煉 <small>金幣、經驗藥水、突破石、技能書</small></h4><div class="trow">${DG.trials.map(d => card('trial', d)).join('')}</div>
                <p class="muted" style="text-shadow:0 1px 3px #000">套裝副本不限次數。每個素材試煉每天各有 ${DG.trialPerDay} 次獎勵次數（沒用完的保留，最多存 ${DG.trialMax} 次），用完還能挑戰但不給素材。</p>
            </div></div>`;
        p.querySelectorAll('[data-season]').forEach(b => { b.onclick = () => {
            const k = b.dataset.season;
            if (k === 'shop') return showSeasonShop();
            if (!Season.unlocked(S)) { toast('打完第 3 章開放'); return; }
            (k === 'lich' ? showLich : showTower)();
        }; });
        p.querySelectorAll('[data-dg]').forEach(b => { b.onclick = () => {
            const [kind, id] = b.dataset.dg.split(':');
            if (!Dungeon.unlockedDungeon(S, kind, id)) { toast('還沒開放'); return; }
            showFloors(kind, id);
        }; });
    }
    // ───────── 賽季：巫妖王試煉、亡靈之塔、賽季商店 ─────────
    const SE = R.SEASON;
    const anyReward = r => Object.entries(r).filter(([, v]) => v).map(([k, v]) => k === 'gear' ? `<span class="rw">${ICON('chest')}${R.GEAR.QUALITY[v.q].name}裝備</span>` : `<span class="rw" title="${CUR[k].name}">${CUR[k].icon}${fmt(v)}</span>`).join('');
    function seasonRowHtml() {
        const st = Season.state(S), open = Season.unlocked(S);
        const afx = Season.affixes();
        const lich = `<button class="tcard season ${open ? '' : 'lock'}" data-season="lich"><img class="tboss" src="${sprite(R.ENEMIES.lichKing.img)}" alt="">
            <div class="tinfo"><b>${ICON('m_boss')} 巫妖王試煉</b><small>本週詞綴：${afx.map(a => R.MODS[a].name).join('、')}</small>
            <span class="tbest">${open ? `本週最高 第 ${st.lich.best || 0} / ${SE.lich.tiers} 階<br>今日次數 <em>${Season.lichLeft(S)}</em> / ${SE.lich.perDay}` : '🔒 打完第 3 章開放'}</span></div></button>`;
        const tower = `<button class="tcard season ${open ? '' : 'lock'}" data-season="tower"><img class="tboss" src="${sprite(R.ENEMIES.boneDragon.img)}" alt="">
            <div class="tinfo"><b>${ICON('m_tower')} 亡靈之塔</b><small>每層一條規則，30 層後是無盡層</small>
            <span class="tbest">${open ? `本季最高 第 ${Season.towerBest(S)} 層<br>不限次數` : '🔒 打完第 3 章開放'}</span></div></button>`;
        const shop = `<button class="tcard season shop" data-season="shop"><div class="tinfo"><b>${ICON('badge')} 賽季商店</b><small>覺醒石、烏瑟碎片、限定券、傳說裝備</small>
            <span class="tbest">賽季徽章 <em>${fmt(S.currency.badge || 0)}</em></span></div></button>`;
        return `<h4>賽季挑戰 <small>S${st.n}・第 ${Season.weekNo(S)} 週・還有 ${Season.daysLeft(S)} 天結算</small></h4><div class="trow">${lich}${tower}${shop}</div>`;
    }
    function launchSeason(extra) {
        const team = S.team.filter(Boolean);
        if (!team.length) { toast('隊伍裡至少要有 1 位英雄'); return; }
        let auto = true;
        try { auto = (JSON.parse(localStorage.getItem('pr_hd2dBattle') || '{}').auto) !== false; } catch (e) { /* 預設自動 */ }
        localStorage.setItem('pr_hd2dBattle', JSON.stringify({team: S.team.map(x => x || null), ...extra, auto, growth: battleGrowth(team), from: 'lobby'}));
        location.href = 'hd2d.html';
    }
    function showLich() {
        const st = Season.state(S).lich, tiers = Season.tierList(), left = Season.lichLeft(S), afx = Season.affixes();
        const rows = tiers.map((v, i) => {
            const t = i + 1, got = st.claimed[t];
            return `<div class="frow ${got ? 'done' : ''} ${t === (st.best || 0) + 1 ? 'next' : ''}"><b>第 ${t} 階</b><span class="muted">傷害 ${fmt(v)}</span>
                <span class="rws"><small class="muted">每次</small>${anyReward(SE.lich.attempt(t))}<small class="muted">本週首次</small>${anyReward(SE.lich.weekly(t))}</span><div class="sp"></div>${got ? '<span class="q-ok">✓</span>' : ''}</div>`;
        }).join('');
        const m = modal(`<h3>${ICON('m_boss')} 巫妖王試煉</h3>
            <p class="muted">打 ${SE.lich.rounds} 回合（或全隊倒下為止），看對巫妖王造成多少傷害，傷害越高階數越高。巫妖王每過 1 回合傷害 +${Math.round(SE.lich.ramp * 100)}%，撐得越久分數越高。每天 ${SE.lich.perDay} 次；每週一換詞綴，「本週首次」獎勵也會重置。</p>
            <div class="mods"><span class="muted">本週詞綴</span>${modHtml(afx)}</div>
            <div id="wb-box" class="wb-box"><span class="muted">讀取全服巫妖王…</span></div>
            <div class="flist">${rows}</div>
            <div class="row"><span>本週最高：第 <b>${st.best || 0}</b> 階${st.bestDmg ? `（傷害 ${fmt(st.bestDmg)}）` : ''}　今天還有 <b>${left}</b> 次</span><div class="sp"></div><button class="btn primary" id="lich-go" ${left > 0 ? '' : 'disabled'}>出戰</button></div>`, 'floors');
        m.querySelector('#lich-go').onclick = () => { m.remove(); launchSeason({lich: {}}); };
        // 全服巫妖王（有登入才有）
        const wbBox = m.querySelector('#wb-box');
        if (OL.user && OL.bossOn()) OL.boss().then(b => { wbBox.innerHTML = worldBossHtml(b); }).catch(() => { wbBox.innerHTML = '<span class="muted">全服巫妖王讀取失敗</span>'; });
        else wbBox.remove();
    }
    function showTower() {
        const best = Season.towerBest(S), next = best + 1;
        const from = Math.max(1, next - 2), rows = [];
        for (let f = from; f < from + 8; f++) {
            const e = Season.towerEncounter(f), boss = e.back.find(id => R.ENEMIES[id].boss);
            rows.push(`<div class="frow ${f > next ? 'lock' : ''} ${f === next ? 'next' : ''} ${f <= best ? 'done' : ''}"><b>第 ${f} 層</b>${boss ? `<img class="fboss" src="${face(R.ENEMIES[boss].img)}" alt="" title="${R.ENEMIES[boss].name}">` : ''}
                <span class="mods">${modHtml(e.mods)}</span><span class="rws">${anyReward(SE.tower.reward(f))}</span><div class="sp"></div>
                ${f === next ? `<button class="btn primary" data-tgo="${f}">出戰</button>` : f <= best ? '<span class="q-ok">✓</span>' : '<span class="muted">🔒</span>'}</div>`);
        }
        const m = modal(`<h3>${ICON('m_tower')} 亡靈之塔</h3>
            <p class="muted">一層一層往上打，每層有一條規則（21 層起兩條），每 5 層是守層首領，獎勵比較多。打過 ${SE.tower.floors} 層後是無盡層，每層敵人再強 ${Math.round((SE.tower.endless - 1) * 100)}%。不限次數，輸了沒有損失；每季重置。本季最高：第 ${best} 層。</p>
            <div class="flist">${rows.join('')}</div>`, 'floors');
        m.querySelectorAll('[data-tgo]').forEach(b => { b.onclick = () => { m.remove(); launchSeason({tower: {floor: +b.dataset.tgo}}); }; });
    }
    function showSeasonShop() {
        Season.state(S);
        const items = SE.shop.map(it => {
            const left = Season.shopLeft(S, it.id), can = left > 0 && (S.currency.badge || 0) >= it.price;
            const icon = it.shards ? `<img class="ico" src="${face(R.HEROES[it.shards.id].img)}" alt="" style="border-radius:50%">` : it.give.gear ? ICON('chest') : CUR[Object.keys(it.give)[0]].icon;
            return `<div class="bag-item"><span class="bi">${icon}</span><div><b>${it.name}</b><small>${ICON('badge')}${it.price}　本週剩 ${left} / ${it.limit}</small></div><button class="btn ${can ? 'primary' : ''}" data-sbuy="${it.id}" style="margin-left:auto" ${left > 0 ? '' : 'disabled'}>兌換</button></div>`;
        }).join('');
        const m = modal(`<h3>${ICON('badge')} 賽季商店</h3><p class="muted">賽季徽章從巫妖王試煉、亡靈之塔取得，每週一重置購買次數。你有 ${ICON('badge')} <b>${fmt(S.currency.badge || 0)}</b>。</p><div class="bag-grid">${items}</div>`, 'floors');
        m.querySelectorAll('[data-sbuy]').forEach(b => { b.onclick = () => {
            const r = Season.buy(S, b.dataset.sbuy);
            if (!r.ok) return toast(r.reason);
            save(); renderCurrency(); m.remove(); showSeasonShop(); if ($('#panel-trial').classList.contains('show')) renderTrial();
            toast(r.got.gear ? `獲得 ${R.GEAR.QUALITY[r.got.gear.q].name}${r.got.gear.set ? GR.SETS[r.got.gear.set].name : ''}${GR.SLOTS[r.got.gear.slot].name}` : r.got.shards ? (r.got.shards.dust ? `已滿星，轉成星塵 ${r.got.shards.dust}` : '獲得碎片') : '兌換成功');
        }; });
    }
    // ───────── 多人：帳號、排行榜、全服巫妖王、信箱、管理員 ─────────
    const OL = window.Online || {user: null, offline: true, bossOn: () => false};
    const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
    function accountRow() {
        if (!OL.user) return `<div class="set-row"><b>帳號</b><span class="sp">離線遊玩中，進度只存在這台裝置。重新整理頁面可以再試著登入。</span></div>`;
        const t = OL.lastSync ? new Date(OL.lastSync).toLocaleTimeString('zh-TW', {hour: '2-digit', minute: '2-digit'}) : '—';
        return `<div class="set-row"><b>帳號</b><span class="sp">${esc(OL.user.displayName || 'Google 帳號')}（${esc(OL.user.email || '')}）<br><small>雲端存檔：最後同步 ${t}${OL.syncState ? '・' + OL.syncState : ''}</small></span>
            <button class="btn" id="set-sync">立即同步</button><button class="btn" id="set-out">登出</button></div>
            ${OL.admin ? '<div class="set-row"><b>管理員</b><span class="sp">寄信、全服首領、掉落倍率</span><button class="btn primary" data-open="admin">後台</button></div>' : ''}`;
    }
    // 安裝到主畫面：Android 用瀏覽器的安裝提示；iPhone 只能手動加入主畫面
    function installRow() {
        const A = window.AppShell;
        if (!A) return '';
        const ver = `<div class="set-row"><b>版本</b><span class="sp">${A.VERSION}</span></div>`;
        if (A.standalone) return ver + '<div class="set-row"><b>安裝</b><span class="sp">已經從主畫面開啟（全螢幕）</span></div>';
        if (A.canInstall()) return ver + '<div class="set-row"><b>安裝到主畫面</b><span class="sp">像 App 一樣從主畫面開啟，全螢幕、固定橫向</span><button class="btn primary" id="set-install">安裝</button></div>';
        if (A.isIOS) return ver + '<div class="set-row"><b>安裝到主畫面</b><span class="sp">iPhone／iPad：用 Safari 開啟，點下方「分享」→「加入主畫面」，之後從主畫面的圖示開啟就是全螢幕</span></div>';
        return ver + `<div class="set-row"><b>安裝到主畫面</b><span class="sp">瀏覽器選單裡的「安裝應用程式」或「加到主畫面」</span>${A.touch ? '<button class="btn" id="set-full">全螢幕</button>' : ''}</div>`;
    }
    function bindAccount(p) {
        const sy = p.querySelector('#set-sync'), out = p.querySelector('#set-out');
        if (sy) sy.onclick = async () => { sy.disabled = true; await OL.syncNow(true); OL.pushStats().catch(() => {}); toast(OL.syncState || '已同步到雲端'); renderSettings(); };
        if (out) out.onclick = () => { if (confirm('要登出嗎？登出後要再登入才能玩。')) OL.signOut(); };
    }
    function worldBossHtml(b) {
        const pct = Math.max(0, b.hp / b.max * 100);
        const top = b.top.slice(0, 5).map((x, i) => `<li><b>${i + 1}</b>${esc(x.name)}<span>${fmt(x.dmg)}</span></li>`).join('') || '<li class="muted">還沒有人挑戰</li>';
        return `<div class="wb-h"><b>${ICON('m_boss')} 全服巫妖王</b><span class="muted">${b.dead ? `已被 ${esc(b.killer)} 擊倒！獎勵寄到信箱了` : `剩 ${fmt(b.hp)} / ${fmt(b.max)}`}</span></div>
            <div class="wb-bar"><i style="width:${pct}%"></i></div>
            <div class="wb-sub">巫妖王試煉造成的傷害會自動算進全服血量（不另外花次數）。打倒後，參加的人都會收到獎勵信，傷害前 3 名另外加碼。我這週累計 <b>${fmt(b.mine)}</b>。</div>
            <ol class="wb-top">${top}</ol>`;
    }
    // 排行榜
    let rankTab = 'progress';
    async function renderRank() {
        const p = $('#panel-rank');
        const tabs = `<div class="filters" style="margin-bottom:8px">${Object.entries(OL.BOARDS || {}).map(([k, b]) => `<button class="${rankTab === k ? 'on' : ''}" data-rk="${k}">${b.name}</button>`).join('')}</div>`;
        p.innerHTML = head('排行榜') + `<div class="pbody">${OL.user ? tabs + '<div id="rk-list" class="rk-list"><p class="muted">讀取中…</p></div>' : '<p class="muted">離線遊玩中，看不到排行榜。</p>'}</div>`;
        p.querySelectorAll('[data-rk]').forEach(b => { b.onclick = () => { rankTab = b.dataset.rk; renderRank(); }; });
        if (!OL.user) return;
        const tab = rankTab;
        try {
            await OL.pushStats();
            const rows = await OL.board(tab);
            if (tab !== rankTab) return;
            const B = OL.BOARDS[tab];
            const me = rows.findIndex(x => x.uid === OL.user.uid);
            $('#rk-list').innerHTML = (rows.length ? rows.map((x, i) => `<div class="rk-row ${x.uid === OL.user.uid ? 'me' : ''} ${i < 3 ? 'top' + (i + 1) : ''}"><b>${i + 1}</b><span>${esc(x.name)}</span><em>${B.fmt(x.v)}</em></div>`).join('') : '<p class="muted">還沒有資料</p>')
                + `<p class="muted" style="margin-top:6px">${me >= 0 ? `你是第 ${me + 1} 名。` : ''}前 100 名；排名在你打開排行榜或同步存檔時更新。${tab === 'lich' ? '巫妖王每週一重置。' : tab === 'tower' ? '亡靈之塔每季重置。' : ''}</p>`;
        } catch (e) { $('#rk-list').innerHTML = `<p class="muted">讀取失敗：${esc(e.message)}</p>`; }
    }
    // 信箱
    async function refreshMailDot() {
        if (!OL.user) return;
        const n = await OL.unreadMail(S);
        const d = $('#mail-dot');
        if (d) d.classList.toggle('on', n > 0);
    }
    async function renderMail() {
        const p = $('#panel-mail');
        p.innerHTML = head('信箱') + `<div class="pbody">${OL.user ? '<div id="mail-list"><p class="muted">讀取中…</p></div>' : '<p class="muted">離線遊玩中，收不到信。</p>'}</div>`;
        if (!OL.user) return;
        let list;
        try { list = await OL.mails(); } catch (e) { $('#mail-list').innerHTML = `<p class="muted">讀取失敗：${esc(e.message)}</p>`; return; }
        const got = S.mail || {};
        const rows = list.map(m => {
            const rw = OL.mailReward(m), claimed = got[m.id];
            return `<div class="mail ${claimed ? 'claimed' : ''}"><div class="m-main"><b>${m.kind === 'worldboss' ? ICON('m_boss') : ICON('m_quest')} ${esc(m.title)}</b><small class="muted">${new Date(m.createdAt).toLocaleDateString('zh-TW')}</small>
                <p>${esc(m.body)}</p><div class="rws">${anyReward(rw)}${m.kind === 'worldboss' && m.ranks?.[OL.user.uid] <= 3 ? `<span class="rw">傷害第 ${m.ranks[OL.user.uid]} 名加碼</span>` : ''}</div></div>
                ${claimed ? '<span class="q-ok">已領取</span>' : Object.keys(rw).length ? `<button class="btn primary" data-mc="${m.id}">領取</button>` : '<span class="muted">公告</span>'}</div>`;
        }).join('');
        const can = list.filter(m => !got[m.id] && Object.keys(OL.mailReward(m)).length);
        $('#mail-list').innerHTML = (list.length ? `<div class="row" style="margin:0 0 8px"><span class="muted">保留 30 天內的信</span><div class="sp"></div>${can.length ? `<button class="btn primary" data-mc="all">全部領取（${can.length}）</button>` : ''}</div>` + rows : '<p class="muted">沒有信件</p>');
        $('#mail-list').querySelectorAll('[data-mc]').forEach(b => { b.onclick = () => {
            const ids = b.dataset.mc === 'all' ? can.map(m => m.id) : [b.dataset.mc];
            const sum = {};
            for (const id of ids) { const r = OL.claimMail(S, list.find(m => m.id === id)); if (r.ok) for (const [k, v] of Object.entries(r.reward)) sum[k] = (sum[k] || 0) + v; }
            save(); OL.syncNow(true); renderCurrency(); renderMail(); refreshMailDot();
            toast('領取 ' + rewardText(sum));
        }; });
    }
    // 管理員後台
    async function renderAdmin() {
        const p = $('#panel-admin');
        if (!OL.admin) { p.innerHTML = head('管理員後台') + '<div class="pbody"><p class="muted">你不是管理員。</p></div>'; return; }
        await OL.loadCfg();
        const c = OL.cfg;
        const cur = ['gem', 'ltdTicket', 'ticket', 'gold', 'exp', 'brk', 'book', 'stone', 'awk', 'badge'];
        p.innerHTML = head('管理員後台') + `<div class="pbody adm">
            <h4>寄信給所有人</h4>
            <div class="adm-f"><input id="am-title" placeholder="標題" maxlength="30"><textarea id="am-body" placeholder="內容" maxlength="300"></textarea>
                <div class="adm-cur">${cur.map(k => `<label>${CUR[k].icon}<input type="number" min="0" data-ck="${k}" placeholder="${CUR[k].name}"></label>`).join('')}</div>
                <button class="btn primary" id="am-send">寄出</button></div>
            <h4>全服巫妖王</h4>
            <div class="adm-f row"><label class="chk"><input type="checkbox" id="ab-on" ${OL.bossOn() ? 'checked' : ''}> 開啟</label>
                <label>血量 <input type="number" id="ab-max" value="${OL.bossMax()}" step="100000" min="10000"></label>
                <button class="btn" id="ab-save">儲存</button><button class="btn" id="ab-reset">重置本週血量</button></div>
            <div id="ab-now" class="muted">讀取中…</div>
            <h4>掉落倍率</h4>
            <div class="adm-f row"><label>主線、副本、試煉的金幣與素材 × <input type="number" id="ad-mult" value="${c.dropMult || 1}" step="0.5" min="0.5" max="5"></label><button class="btn" id="ad-save">儲存</button>
                <span class="muted">鑽石、招募券不受影響；玩家下次進大廳時生效</span></div>
            <h4>已寄出的信</h4><div id="am-list" class="muted">讀取中…</div>
        </div>`;
        const reload = () => renderAdmin();
        p.querySelector('#am-send').onclick = async () => {
            const title = p.querySelector('#am-title').value.trim(), body = p.querySelector('#am-body').value.trim();
            const reward = {};
            p.querySelectorAll('[data-ck]').forEach(i => { const v = Math.floor(+i.value || 0); if (v > 0) reward[i.dataset.ck] = v; });
            if (!title) return toast('要有標題');
            if (!confirm(`要把「${title}」寄給所有玩家嗎？${Object.keys(reward).length ? '\n附件：' + Object.entries(reward).map(([k, v]) => CUR[k].name + ' ' + v).join('、') : ''}`)) return;
            try { await OL.sendMail({title, body, reward}); toast('已寄出'); reload(); refreshMailDot(); } catch (e) { toast('寄送失敗：' + e.message); }
        };
        p.querySelector('#ab-save').onclick = async () => {
            try { await OL.setCfg({bossActive: p.querySelector('#ab-on').checked, bossMax: Math.max(10000, Math.floor(+p.querySelector('#ab-max').value))}); toast('已儲存（血量從下次重置或下週起生效）'); reload(); } catch (e) { toast('儲存失敗：' + e.message); }
        };
        p.querySelector('#ab-reset').onclick = async () => {
            if (!confirm('要把本週全服巫妖王的血量回滿、清掉所有人的傷害紀錄嗎？已經寄出的獎勵信不受影響。')) return;
            try { await OL.resetBoss(Math.max(10000, Math.floor(+p.querySelector('#ab-max').value))); toast('已重置'); reload(); } catch (e) { toast('重置失敗：' + e.message); }
        };
        p.querySelector('#ad-save').onclick = async () => {
            const m = Math.min(5, Math.max(0.5, +p.querySelector('#ad-mult').value || 1));
            try { await OL.setCfg({dropMult: m}); toast(`掉落倍率 ×${m}`); } catch (e) { toast('儲存失敗：' + e.message); }
        };
        OL.boss().then(b => { const el = p.querySelector('#ab-now'); if (el) el.innerHTML = worldBossHtml(b); }).catch(e => { const el = p.querySelector('#ab-now'); if (el) el.textContent = '讀取失敗：' + e.message; });
        OL.mails().then(list => {
            const el = p.querySelector('#am-list');
            if (!el) return;
            el.innerHTML = list.map(m => `<div class="adm-mail"><b>${esc(m.title)}</b><small>${new Date(m.createdAt).toLocaleString('zh-TW')}</small><button class="btn" data-del="${m.id}">刪除</button></div>`).join('') || '沒有信';
            el.querySelectorAll('[data-del]').forEach(b => { b.onclick = async () => { if (!confirm('刪除這封信？還沒領的人就領不到了。')) return; await OL.deleteMail(b.dataset.del); reload(); }; });
        }).catch(e => { const el = p.querySelector('#am-list'); if (el) el.textContent = '讀取失敗：' + e.message; });
    }

    // 賽季結算（滿 28 天後第一次進大廳）
    function checkSeasonEnd() {
        const ro = Season.rollover(S);
        if (!ro) return;
        save();
        modal(`<h3>S${ro.season} 賽季結算</h3>
            <p>巫妖王試煉最高 <b>第 ${ro.tier} 階</b>　亡靈之塔最高 <b>第 ${ro.floor} 層</b></p>
            <div class="rws" style="margin:8px 0"><span class="muted">結算獎勵</span>${anyReward(ro.reward)}</div>
            ${ro.title ? `<p>獲得稱號：<b style="color:var(--gold-hi)">S${ro.season} ${ro.title}</b></p>` : ''}
            <p class="muted">${ro.pass ? `通行證還沒領的 ${ro.pass} 份獎勵已經自動領取。` : ''}新的賽季開始：通行證、巫妖王階數、亡靈之塔與賽季商店都重新計算；英雄、裝備、賽季徽章與主線進度都保留。</p>`, 'stage');
        renderCurrency();
    }
    function floorReward(kind, id, f) {
        const r = Dungeon.baseReward(kind, id, f);
        return rewardHtml(r) + (kind === 'set' ? `<span class="rw">${ICON('chest')} 裝備 ×${Dungeon.dropCount(f)}</span>` : '');
    }
    function showFloors(kind, id) {
        const d = Dungeon.find(kind, id);
        const best = Dungeon.best(S, kind, id), left = Dungeon.sweepLeft(S, kind, id), lim = kind === 'trial';
        const rows = Array.from({length: DG.floors}, (_, i) => i + 1).map(f => {
            const st = Dungeon.starsOf(S, kind, id, f), open = Dungeon.unlockedFloor(S, kind, id, f);
            return `<div class="frow ${open ? '' : 'lock'} ${f === best + 1 ? 'next' : ''}"><b>第 ${f} 層</b><span class="st-stars">${starsHtml(st)}</span>
                <span class="rws">${floorReward(kind, id, f)}</span><div class="sp"></div>
                ${open ? `<button class="btn primary" data-fgo="${f}">出戰</button>` : '<span class="muted">🔒</span>'}</div>`;
        }).join('');
        const m = modal(`<h3>${d.name}</h3><p class="muted">首領：${R.ENEMIES[d.boss].name}　${kind === 'set' ? '掉落 ' + d.sets.map(k => GR.SETS[k].name).join('、') + ' 套裝，層數越高品質越好' : d.desc}。星數越高獎勵越多（1★ 60%、2★ 80%、3★ 全額）。${lim ? `今天還有 ${left} 次獎勵（每天補 ${DG.trialPerDay}，最多存 ${DG.trialMax}）。` : '套裝副本不限次數。'}</p>
            <div class="rep-row"><span>連續挑戰</span>${[1, 3, 5, 10].map(n => `<button class="${repSel === n ? 'on' : ''}" data-rep="${n}">${n === 1 ? '單場' : n + ' 場'}</button>`).join('')}${lim ? `<button class="${repSel === 'all' ? 'on' : ''}" data-rep="all">打到次數用完</button>` : ''}<small class="muted">自動戰鬥、打完自動開下一場，輸了就停</small></div>
            <div class="flist">${rows}</div>`, 'floors');
        m.querySelectorAll('[data-rep]').forEach(b => { b.onclick = () => { repSel = b.dataset.rep === 'all' ? 'all' : +b.dataset.rep; m.querySelectorAll('[data-rep]').forEach(x => x.classList.toggle('on', x === b)); }; });
        m.querySelectorAll('[data-fgo]').forEach(b => { b.onclick = () => {
            const n = repSel === 'all' ? (lim ? left : 1) : (lim ? Math.min(repSel, Math.max(1, left)) : repSel);
            m.remove(); launchDungeon(kind, id, +b.dataset.fgo, n);
        }; });
    }
    let repSel = 1;   // 連續挑戰場數
    function launchDungeon(kind, id, floor, times = 1) {
        const team = S.team.filter(Boolean);
        if (!team.length) { toast('隊伍裡至少要有 1 位英雄'); return; }
        let auto = true;
        try { auto = (JSON.parse(localStorage.getItem('pr_hd2dBattle') || '{}').auto) !== false; } catch (e) { /* 預設自動 */ }
        const repeat = times > 1 ? {total: times, done: 0, wins: 0, sum: {}, gear: []} : null;
        if (repeat) auto = true;   // 連續挑戰一律自動戰鬥
        localStorage.setItem('pr_hd2dBattle', JSON.stringify({team: S.team.map(x => x || null), dungeon: {kind, id, floor}, repeat, auto, growth: battleGrowth(team), from: 'lobby'}));
        location.href = 'hd2d.html';
    }


    // ───────── 任務與通行證 ─────────
    const QD = R.QUESTS, QP = QD.pass;
    function refreshPass() {
        const q = Quests.state(S), lv = Quests.level(S);
        const into = lv >= QP.levels ? 100 : (q.medals % QP.perLevel) / QP.perLevel * 100;
        $('#pass-chip').innerHTML = `${ICON('m_pass')}<span class="pc-t">通行證 <b>Lv ${lv}</b></span><span class="pc-bar"><i style="width:${into}%"></i></span><span class="pc-q">${ICON('m_quest')}任務</span>${Quests.hasClaimable(S) ? '<i class="dot"></i>' : ''}`;
    }
    let questTab = 'daily';
    const qReward = r => Object.entries(r || {}).map(([k, v]) => k === 'hero' ? `<span class="rw">UR ${short(R.HEROES[v].name)}</span>` : k === 'gear' ? `<span class="rw">${ICON('chest')}${R.GEAR.QUALITY[v.q].name}套裝 ×1</span>` : `<span class="rw">${CUR[k].icon}${fmt(v)}</span>`).join('');
    function qRow(t, prog, claimed, kind) {
        const done = prog >= t.n;
        return `<div class="qrow ${claimed ? 'claimed' : done ? 'done' : ''}">
            <div class="q-main"><b>${t.name}</b><div class="q-bar"><i style="width:${Math.min(100, prog / t.n * 100)}%"></i><span>${Math.min(prog, t.n)} / ${t.n}</span></div></div>
            <div class="q-rw"><span class="rw">${ICON('medal')}${t.medal}</span>${kind === 'w' ? qReward(t.reward) : ''}</div>
            ${claimed ? '<span class="q-ok">已領取</span>' : `<button class="btn ${done ? 'primary' : ''}" data-qc="${kind}:${t.id}" ${done ? '' : 'disabled'}>領取</button>`}</div>`;
    }
    function renderQuest() {
        const p = $('#panel-quest');
        const q = Quests.state(S), lv = Quests.level(S), boost = Quests.boosted(S);
        const into = lv >= QP.levels ? QP.perLevel : q.medals % QP.perLevel;
        const head = `<div class="ph"><h2>${ICON('m_quest')} 任務與通行證</h2><div class="sp"></div>
            <div class="q-pass"><span>通行證 <b>Lv ${lv}</b> / ${QP.levels}</span><span class="pc-bar big"><i style="width:${into / QP.perLevel * 100}%"></i></span><span class="muted">${lv >= QP.levels ? `寶箱 ${Quests.chestsReady(S)} 個可開` : `${into} / ${QP.perLevel}`}</span></div>
            <button class="close" data-close>✕</button></div>
            <div class="filters" style="margin-bottom:8px">${[['daily', '每日'], ['weekly', '每週'], ['pass', '通行證']].map(([k, n]) => `<button class="${questTab === k ? 'on' : ''}" data-qt="${k}">${n}</button>`).join('')}
            ${boost ? `<span class="q-boost">${ICON('medal')} 追趕中：勳章 ×2</span>` : ''}</div>`;
        let body = '';
        if (questTab === 'daily') {
            const all = Quests.dailyAllDone(S);
            body = Quests.dailyList(S).map(t => qRow(t, q.daily[t.id] || 0, q.dClaim[t.id], 'd')).join('')
                + `<div class="qrow bonus ${q.dBonus ? 'claimed' : all ? 'done' : ''}"><div class="q-main"><b>每日任務全部完成</b><div class="muted">每天凌晨 4 點重置</div></div>
                    <div class="q-rw"><span class="rw">${ICON('medal')}${QD.dailyBonus.medal}</span><span class="rw">${ICON('gem')}${QD.dailyBonus.gem}</span></div>
                    ${q.dBonus ? '<span class="q-ok">已領取</span>' : `<button class="btn ${all ? 'primary' : ''}" data-qc="b:bonus" ${all ? '' : 'disabled'}>領取</button>`}</div>`;
        } else if (questTab === 'weekly') {
            body = Quests.weeklyList(S).map(t => qRow(t, q.weekly[t.id] || 0, q.wClaim[t.id], 'w')).join('') + '<p class="muted">每週一凌晨 4 點重置。</p>';
        } else {
            const cells = QP.rewards.map((r, i) => {
                const l = i + 1, got = q.pClaim[l], open = l <= lv, big = l % 5 === 0;
                return `<button class="pcell ${big ? 'big' : ''} ${got ? 'got' : open ? 'ready' : ''} ${l === 50 ? 'final' : ''}" data-pl="${l}">
                    <span class="pl">${l}</span>${l === 50 ? `<img class="pf" src="${face(R.HEROES[QP.finalHero].img)}" alt="">` : ''}<div class="prw">${qReward(r)}</div>${got ? '<span class="pg">✓</span>' : ''}</button>`;
            }).join('');
            body = `<div class="row" style="margin:0 0 8px"><span class="muted">第 50 級得到 UR 莫瑟斯；50 級之後每 ${QP.chestPer} 勳章開一個寶箱。偶爾沒上線，落後時勳章會加倍。</span><div class="sp"></div>
                ${Quests.chestsReady(S) ? `<button class="btn" data-qc="c:chest">開寶箱（${Quests.chestsReady(S)}）</button>` : ''}<button class="btn primary" data-qc="p:all">全部領取</button></div>
                <div class="pgrid">${cells}</div>`;
        }
        p.innerHTML = head + `<div class="pbody">${body}</div>`;
        p.querySelectorAll('[data-qt]').forEach(b => { b.onclick = () => { questTab = b.dataset.qt; renderQuest(); }; });
        const after = msg => { save(); renderCurrency(); refreshPass(); renderQuest(); if (msg) toast(msg); };
        p.querySelectorAll('[data-qc]').forEach(b => { b.onclick = () => {
            const [k, id] = b.dataset.qc.split(':');
            if (k === 'd') { const r = Quests.claimDaily(S, id); if (r.ok) after(`${ICON('medal')} 勳章 +${r.medal}`); }
            else if (k === 'b') { const r = Quests.claimDailyBonus(S); if (r.ok) after(`${ICON('medal')} 勳章 +${r.medal}、${ICON('gem')}${r.gem}`); }
            else if (k === 'w') { const r = Quests.claimWeekly(S, id); if (r.ok) after(`${ICON('medal')} 勳章 +${r.medal}`); }
            else if (k === 'c') { const r = Quests.openChest(S); if (r.ok) after('寶箱：' + rewardText(r.reward)); }
            else {
                const before = Object.keys(S.heroes).length;
                const r = Quests.claimAllPass(S);
                if (!r.length) { toast('目前沒有可以領的等級'); return; }
                after(`領取 ${r.length} 個等級的獎勵`);
                if (Object.keys(S.heroes).length > before) setTimeout(() => toast(`獲得 UR ${R.HEROES[QP.finalHero].name}！`), 1200);
            }
        }; });
        p.querySelectorAll('[data-pl]').forEach(b => { b.onclick = () => {
            const l = +b.dataset.pl, r = Quests.claimPass(S, l);
            if (r.ok) { after(`第 ${l} 級獎勵已領取`); if (r.reward.hero) setTimeout(() => toast(`獲得 UR ${R.HEROES[QP.finalHero].name}！`), 900); }
            else toast(l > Quests.level(S) ? `需要通行證 Lv ${l}` : '已經領過了');
        }; });
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
        const tabs = `<div class="filters" style="margin-bottom:8px"><button class="${bagTab === 'items' ? 'on' : ''}" data-bag="items">道具</button><button class="${bagTab === 'gear' ? 'on' : ''}" data-bag="gear">裝備${gearOpen() ? '' : ' 🔒'}</button><button class="${bagTab === 'shop' ? 'on' : ''}" data-bag="shop">星塵商店　${ICON('dust')}${fmt(S.currency.dust || 0)}</button></div>`;
        let body;
        if (bagTab === 'gear') {
            body = bagGearHtml();
        } else if (bagTab === 'items') {
            body = `<div class="bag-grid">
                ${Object.entries(CUR).map(([k, c]) => `<div class="bag-item"><span class="bi">${c.icon}</span><div><b>${c.name}</b><small>${c.desc}</small></div><span class="cnt">${fmt(S.currency[k] || 0)}</span></div>`).join('')}
                <div class="bag-item"><span class="bi">${ICON('shard')}</span><div><b>英雄碎片</b><small>重複招募取得，用來升星（各英雄的數量在英雄詳情看）</small></div><span class="cnt">${shardTotal}</span></div>
            </div>`;
        } else {
            const own = Object.keys(S.heroes).filter(id => S.heroes[id].star < Growth.MAX_STAR);
            if (!own.includes(shopHero)) shopHero = own[0] || null;
            const sh = shopHero && S.heroes[shopHero];
            body = `<div class="fac-note" style="margin-bottom:8px">滿星的英雄再抽到時，碎片會變成星塵。星塵可以換任何已擁有、還沒滿星的英雄碎片（1 個碎片 ${Growth.DUST_PER_SHARD} 星塵），或換道具。</div>
                <div class="shop-wrap"><div class="shop-heroes">${own.map(id => `<button class="face ${id === shopHero ? 'on' : ''}" data-shop="${id}" style="--rc:${rc(R.HEROES[id].rarity)}"><img src="${face(R.HEROES[id].img)}" alt=""></button>`).join('') || '<span style="color:var(--muted)">沒有可以升星的英雄</span>'}</div>
                ${sh ? `<div class="shop-buy"><b>${short(R.HEROES[shopHero].name)}</b>　碎片 ${sh.shards} / ${Growth.starCost(sh)}
                    ${[10, 50].map(n => `<button class="btn" data-buy="${n}">換 ${n} 碎片<small style="display:block;font-size:10.5px">${ICON('dust')}${n * Growth.DUST_PER_SHARD}</small></button>`).join('')}</div>` : ''}</div>
                <div class="bag-grid" style="margin-top:10px">${Growth.DUST_SHOP.map(it => `<div class="bag-item"><span class="bi">${CUR[it.key].icon}</span><div><b>${it.name}</b><small>${ICON('dust')}${it.price}</small></div><button class="btn" data-item="${it.key}" style="margin-left:auto">兌換</button></div>`).join('')}</div>`;
        }
        p.innerHTML = head('背包') + `<div class="pbody">${tabs}${body}</div>`;
        p.querySelectorAll('[data-bag]').forEach(b => { b.onclick = () => { bagTab = b.dataset.bag; renderBag(); }; });
        if (bagTab === 'gear') bindBagGear(p);
        p.querySelectorAll('[data-shop]').forEach(b => { b.onclick = () => { shopHero = b.dataset.shop; renderBag(); }; });
        p.querySelectorAll('[data-buy]').forEach(b => { b.onclick = () => { const r = Growth.buyShards(S, shopHero, +b.dataset.buy); if (!r.ok) return toast(r.reason); save(); toast('兌換成功'); renderBag(); renderCurrency(); }; });
        p.querySelectorAll('[data-item]').forEach(b => { b.onclick = () => { const r = Growth.buyItem(S, b.dataset.item); if (!r.ok) return toast(r.reason); save(); toast('兌換成功'); renderBag(); renderCurrency(); }; });
    }
    function renderSettings() {
        const p = $('#panel-settings');
        p.innerHTML = head('設定') + `<div class="pbody">
            ${accountRow()}
            ${installRow()}
            <div class="set-row"><b>旅團長名稱</b><span class="sp">${S.name}</span><button class="btn" id="set-name">修改</button></div>
            <div class="set-row"><b>賽季</b><span class="sp">S${Season.state(S).n}・第 ${Season.weekNo(S)} 週，還有 ${Season.daysLeft(S)} 天結算。${Season.state(S).titles.length ? '稱號：' + Season.state(S).titles.join('、') : '還沒有稱號'}</span></div>
            <div class="set-row"><b>特效圖鑑</b><span class="sp">預覽所有技能特效</span><a class="btn" href="gallery.html">開啟</a></div>
            <div class="set-row"><b>戰鬥測試頁</b><span class="sp">舊的編隊畫面，可以任選 22 位英雄測試戰鬥（不影響存檔）</span><a class="btn" href="dev.html">開啟</a></div>
            <div class="set-row"><b>重置存檔</b><span class="sp">刪除所有進度、重新開始（無法復原）</span><button class="btn" id="set-reset">重置</button></div>

        </div>`;
        p.querySelector('#set-name').onclick = () => {
            const n = prompt('旅團長名稱（最多 10 個字）', S.name);
            if (n && n.trim()) { S.name = n.trim().slice(0, 10); save(); renderSettings(); }
        };
        bindAccount(p);
        const ib = p.querySelector('#set-install');
        if (ib) ib.onclick = async () => { if (await AppShell.install()) toast('安裝好了！之後從主畫面的圖示開啟'); renderSettings(); };
        const fb = p.querySelector('#set-full');
        if (fb) fb.onclick = () => AppShell.fullscreen();
        p.querySelector('#set-reset').onclick = () => {
            if (!confirm(OL.user ? '確定要刪除所有進度、重新開始嗎？雲端存檔也會一起被覆蓋，這個動作無法復原。' : '確定要刪除所有進度、重新開始嗎？這個動作無法復原。')) return;
            S = Save.reset();
            if (OL.user) { S.owner = OL.user.uid; save(); OL.syncNow(true); }
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
    // 直向遮罩、全螢幕、安裝：js/ui/shell.js
    addEventListener('shell-install', () => { if ($('#panel-settings').classList.contains('show')) renderSettings(); });
    $('#idle-chip').onclick = showIdle;
    setInterval(refreshIdle, 30000);
    renderMain();
    setTimeout(say, 800);
    // 從戰鬥回來：#map 打開地圖；#go=章-關 直接出戰下一關（會先播該播的劇情）
    checkSeasonEnd();
    refreshMailDot();
    // 從巫妖王試煉回來：把傷害送上全服血量
    if (OL.user) OL.flushHits().then(killed => { if (killed) { toast('你打出了全服巫妖王的最後一擊！獎勵已經寄到信箱'); refreshMailDot(); } }).catch(() => {});
    const hm = location.hash.match(/^#(map|hmap|go|trial|lich|tower)(?:=(\d+)-(\d+))?/);
    if (hm) {
        history.replaceState(null, '', location.pathname);
        if (hm[2]) mapCh = Number(hm[2]);
        if (hm[1] === 'hmap') mapHard = true;
        const tr = ['trial', 'lich', 'tower'].includes(hm[1]);
        openPanel(tr ? 'trial' : 'battle');
        if (hm[1] === 'lich') showLich();
        else if (hm[1] === 'tower') showTower();
        else if (hm[1] === 'go' && hm[2]) launchStage(Number(hm[2]), Number(hm[3]));
        else if (!tr && hm[1] !== 'hmap') maybeChapterStory();
    } else if (!S.newbieDone) setTimeout(() => { if (!document.querySelector('.story')) toast('新手招募：免費 10 連抽，去「招募」看看！'); }, 1600);
    window.__lobby = {get save() { return S; }, openPanel, playStory, showStage, showIdle, reload: () => { S = Save.load(); renderMain(); }};   // 測試用
})();
