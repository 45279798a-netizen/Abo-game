// 戰鬥引擎：行動條、個人大招（能量）、陣營被動、屬性克制、狀態效果。
// 完全不碰畫面，可以在瀏覽器或 node 裡無畫面執行（掛機、掃蕩、平衡模擬都用這個）。
// 用法：const b = Battle.create({team, encounterId, seed, auto}); 然後重複呼叫 b.step()，
// 每次會回傳這一手發生的事件陣列，直到 b.over 為 true。
(function () {
    const R = window.RES;

    const STATUS = {
        burn:    {name: '燃燒', icon: '🔥', debuff: true},
        poison:  {name: '中毒', icon: '☠️', debuff: true},
        freeze:  {name: '凍結', icon: '❄️', debuff: true},
        slow:    {name: '減速', icon: '🐌', debuff: true},
        defDown: {name: '破甲', icon: '💔', debuff: true},
        silence: {name: '沉默', icon: '🤐', debuff: true},
        haste:   {name: '加速', icon: '💨', debuff: false},
        atkUp:   {name: '攻擊提升', icon: '⚔️', debuff: false},
        taunt:   {name: '嘲諷', icon: '🛡️', debuff: false},
        guard:   {name: '聖域', icon: '✨', debuff: false},   // 受到的傷害 -30%
    };

    const ATB_MAX = 1000;
    const TIME_PER_ROUND = 10;   // 速度 100 的角色每 10 個時間單位行動一次 = 1 回合
    const MAX_ROUNDS = 30;
    const ROW_CAP = {front: 2, back: 3};
    const DEF_K = 600;           // 傷害 = 攻擊 × 倍率 × 600 / (600 + 防禦)

    function makeRng(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function buildUnit(o) {
        const u = Object.assign(o, {
            shield: 0, atb: 0, statuses: [], alive: true, enraged: false,
            cds: o.skills.map(s => Math.max(0, s.cd - 1)),
            energy: 0, fac: {},
            stats: {dmg: 0, heal: 0, taken: 0, kills: 0},
        });
        for (const p of u.passives) {
            if (p.type !== 'statUp') continue;
            if (p.pct) u.base[p.stat] = Math.round(u.base[p.stat] * (1 + p.pct));
            if (p.flat) u.base[p.stat] += p.flat;
        }
        u.maxHp = u.base.hp;
        u.hp = u.maxHp;
        return u;
    }

    // g：養成倍率 {stat, skill, ult}（由大廳依等級、星級、技能等級算好傳進來；沒有就是 1）
    function makeHero(id, uid, g) {
        const d = R.HEROES[id];
        const role = R.ROLES[d.role];
        const m = R.RARITY[d.rarity].mult * (g?.stat || 1);
        return buildUnit({
            uid, id, side: 'ally', name: d.name, faction: d.faction, element: d.element, role: d.role,
            img: d.img, faceY: d.faceY || 0, rarity: d.rarity, boss: false,
            base: {
                hp: Math.round(role.hp * m), atk: Math.round(role.atk * m), def: Math.round(role.def * m),
                spd: role.spd + (d.spdBonus || 0), crit: 0.15, critDmg: 0.5, hit: 0, res: 0,
            },
            skills: d.skill ? [d.skill] : [], passives: d.passive ? [d.passive] : [], ult: d.ult || null,
            mul: {skill: g?.skill || 1, ult: g?.ult || 1},
        });
    }

    // power：攻擊倍率；hpPower：生命與防禦倍率（主線關卡分開調，讓難度高時戰鬥不會拖太長；沒給就跟 power 一樣）
    function makeEnemy(id, uid, power, hpPower = power) {
        const d = R.ENEMIES[id];
        const s = d.stats;
        return buildUnit({
            uid, id, side: 'enemy', name: d.name, faction: d.faction, element: d.element, role: d.role,
            img: d.img, boss: !!d.boss, elite: !!d.elite,
            base: {
                hp: Math.round(s.hp * hpPower * R.ENEMY_SCALE.hp), atk: Math.round(s.atk * power * R.ENEMY_SCALE.atk),
                def: Math.round(s.def * hpPower * R.ENEMY_SCALE.def),
                spd: s.spd, crit: s.crit ?? 0.1, critDmg: 0.5, hit: 0, res: s.res || 0,
            },
            skills: d.skills || [], passives: d.passives || [],
        });
    }

    class BattleState {
        constructor({team, encounterId, encounter, seed, auto, growth}) {
            this.encounter = encounter || R.ENCOUNTERS.find(e => e.id === encounterId);   // encounter：主線關卡直接傳整個關卡物件
            this.rand = makeRng(seed ?? (Date.now() & 0xffffffff));
            this.auto = auto !== false;
            this.units = [];
            this.time = 0;
            this.actionId = 0;
            this.pendingUlt = null;     // 玩家按下大招、等下一手放出的英雄 uid
            this.factionBonus = null;   // 生效中的陣營被動 {faction, tier, ...效果}
            this.over = false;
            this.result = null;
            this.ults = 0;
            this.ultDamage = 0;
            this.seq = 0;
            this.events = [];

            team.forEach((id, i) => {
                if (!id) return;
                const u = makeHero(id, 'a' + i, growth?.[id]);
                u.row = i < 2 ? 'front' : 'back';
                this.units.push(u);
            });
            const enc = this.encounter;
            enc.front.forEach(id => this.addEnemy(id, 'front'));
            enc.back.forEach(id => this.addEnemy(id, 'back'));

            // 陣營被動：同陣營 3 人／5 人時全隊獲得加成（取人數最多、達到門檻的陣營）
            const counts = {};
            this.allies().forEach(u => { counts[u.faction] = (counts[u.faction] || 0) + 1; });
            for (const [f, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
                const tiers = R.FACTIONS[f]?.passive?.tiers;
                if (!tiers) continue;
                const tier = Object.keys(tiers).map(Number).filter(t => n >= t).sort((a, b) => b - a)[0];
                if (tier) { this.factionBonus = {faction: f, tier, ...tiers[tier]}; break; }
            }
            const fb = this.factionBonus || {};
            for (const u of this.allies()) {
                u.fac = fb;
                if (fb.defUp) u.base.def = Math.round(u.base.def * (1 + fb.defUp));
                if (fb.spdUp) u.base.spd = Math.round(u.base.spd * (1 + fb.spdUp));
                if (fb.crit) u.base.crit += fb.crit;
                if (fb.critDmg) u.base.critDmg += fb.critDmg;
                if (fb.startShield) u.shield = Math.round(u.maxHp * fb.startShield);
                u.energy = R.ENERGY.start;
            }

            // 光環類被動
            for (const u of this.allies()) {
                for (const p of u.passives) {
                    if (p.type === 'auraRes') this.allies().forEach(a => { a.base.res += p.pct; });
                }
            }
            // 開場行動條隨機分散，避免整隊擠在一起連續出手
            for (const u of this.units) u.atb = Math.floor(this.rand() * R.START_ATB_SPREAD);
            if (fb.startPush) for (const u of this.allies()) u.atb = Math.min(ATB_MAX, u.atb + fb.startPush * ATB_MAX);
            for (const u of this.allies()) {
                for (const p of u.passives) {
                    if (p.type === 'startPushAllies') this.allies().forEach(a => { a.atb = Math.min(ATB_MAX, a.atb + p.pct * ATB_MAX); });
                }
            }
        }

        // ───────── 查詢 ─────────
        addEnemy(id, row, atb) {
            const u = makeEnemy(id, 'e' + (this.seq++), this.encounter.power, this.encounter.hpPower);
            u.row = row;
            if (atb != null) u.atb = atb;
            this.units.push(u);
            return u;
        }
        get(uid) { return this.units.find(u => u.uid === uid); }
        allies() { return this.units.filter(u => u.side === 'ally' && u.alive); }
        enemies() { return this.units.filter(u => u.side === 'enemy' && u.alive); }
        friendsOf(u) { return this.units.filter(x => x.side === u.side && x.alive); }
        foesOf(u) { return this.units.filter(x => x.side !== u.side && x.alive); }
        has(u, key) { return u.statuses.some(s => s.key === key); }
        round() { return Math.floor(this.time / TIME_PER_ROUND) + 1; }

        spdOf(u) {
            let s = u.base.spd;
            if (this.has(u, 'haste')) s *= 1.3;
            if (this.has(u, 'slow')) s *= 0.7;
            if (u.enraged) s *= 1 + (u.passives.find(p => p.type === 'enrage')?.spdPct || 0);
            return s;
        }
        atkOf(u) {
            let a = u.base.atk * (this.has(u, 'atkUp') ? 1.2 : 1);
            if (u.fac?.lowHpAtk && u.hp < u.maxHp * 0.5) a *= 1 + u.fac.lowHpAtk;
            return a;
        }
        defOf(u) { return u.base.def * (this.has(u, 'defDown') ? 0.7 : 1); }

        // 預測接下來 n 個行動者（不考慮之後的推拉條變化）
        preview(n) {
            const sim = this.units.filter(u => u.alive).map(u => ({u, atb: u.atb, spd: this.spdOf(u)}));
            const out = [];
            while (out.length < n && sim.length) {
                let best = null, bestT = Infinity;
                for (const s of sim) {
                    const t = Math.max(0, (ATB_MAX - s.atb) / s.spd);
                    if (t < bestT - 1e-9 || (Math.abs(t - bestT) < 1e-9 && this.tieBreak(s, best))) { best = s; bestT = t; }
                }
                for (const s of sim) s.atb += s.spd * bestT;
                out.push(best.u);
                best.atb = 0;
            }
            return out;
        }
        tieBreak(a, b) {
            if (!b) return true;
            if (a.spd !== b.spd) return a.spd > b.spd;
            return a.u.side === 'ally' && b.u.side !== 'ally';
        }

        // ───────── 能量與個人大招 ─────────
        ultReady(uid) {
            const u = this.get(uid);
            return !this.over && !!u && u.alive && u.side === 'ally' && !!u.ult && u.energy >= R.ENERGY.max && !this.has(u, 'freeze');
        }
        // 玩家點頭像放大招：下一手立刻插隊放出
        useUltimate(uid) {
            if (!this.ultReady(uid) || this.pendingUlt) return false;
            this.pendingUlt = uid;
            return true;
        }
        gainEnergy(u, amt) {
            if (u.side !== 'ally' || !u.ult || !u.alive) return;
            const before = u.energy;
            u.energy = Math.min(R.ENERGY.max, before + amt);
            if (u.energy !== before) this.emit({type: 'energy', uid: u.uid, value: u.energy, ready: u.energy >= R.ENERGY.max});
        }
        ultimate(uid) {
            const u = this.get(uid);
            this.ults++;
            u.energy = 0;
            this.emit({type: 'ult', uid, name: u.ult.name});
            this.emit({type: 'energy', uid, value: 0, ready: false});
            this.runEffects(u, u.ult.effects, {ult: true, power: u.mul?.ult || 1});
        }

        emit(e) { this.events.push(e); }

        // ───────── 推進一手 ─────────
        nextActor() {
            let best = null, bestT = Infinity;
            const alive = this.units.filter(u => u.alive);
            for (const u of alive) {
                const spd = this.spdOf(u);
                const t = Math.max(0, (ATB_MAX - u.atb) / spd);
                if (t < bestT - 1e-9 || (Math.abs(t - bestT) < 1e-9 && this.tieBreak({u, spd}, best && {u: best, spd: this.spdOf(best)}))) {
                    best = u; bestT = t;
                }
            }
            for (const u of alive) u.atb += this.spdOf(u) * bestT;
            this.time += bestT;
            return best;
        }

        step() {
            this.events = [];
            if (this.over) return this.events;

            // 大招插隊：玩家點的，或自動模式下能量滿的
            if (!this.pendingUlt && this.auto) {
                const ready = this.allies().find(u => this.ultReady(u.uid));
                if (ready) this.pendingUlt = ready.uid;
            }
            if (this.pendingUlt) {
                const uid = this.pendingUlt;
                this.pendingUlt = null;
                if (this.ultReady(uid)) { this.ultimate(uid); return this.endStep(); }
            }

            const u = this.nextActor();
            if (this.round() > MAX_ROUNDS) { this.finish('lose', 'timeout'); return this.events; }
            this.actionId++;
            u.atb = 0;
            this.emit({type: 'turn', uid: u.uid, round: this.round()});

            // 回合開始：再生、持續傷害、冷卻
            for (const p of u.passives) if (p.type === 'regenOnTurn') this.heal(u, u, u.maxHp * p.pct);
            if (u.fac?.regen) this.heal(u, u, u.maxHp * u.fac.regen);
            for (const s of u.statuses.filter(s => s.key === 'burn' || s.key === 'poison')) {
                this.applyDamage(u, Math.round(s.value), {kind: 'dot', status: s.key, srcUid: s.src});
                if (!u.alive) break;
            }
            u.cds = u.cds.map(c => Math.max(0, c - 1));

            if (!u.alive) return this.endStep();
            if (this.has(u, 'freeze')) {
                u.statuses = u.statuses.filter(s => s.key !== 'freeze');
                this.emit({type: 'skip', uid: u.uid, reason: '凍結'});
                this.endTurn(u);
                return this.endStep();
            }

            // 我方英雄出手：能量增加
            this.gainEnergy(u, R.ENERGY.perAction);

            // 行動
            const idx = this.pickSkill(u);
            if (idx >= 0) {
                const sk = u.skills[idx];
                this.emit({type: 'skill', uid: u.uid, name: sk.name});
                this.runEffects(u, sk.effects, {power: u.mul?.skill || 1});
                u.cds[idx] = sk.cd;
            } else {
                this.emit({type: 'basic', uid: u.uid});
                const t = this.pickTargets(u, 'enemy')[0];
                if (t) {
                    this.dealDamage(u, t, 1.0, {});
                    for (const p of u.passives) {
                        if (p.type === 'poisonOnBasic' && t.alive) this.addStatus(u, t, {status: 'poison', turns: 2, chance: p.chance, dotMult: p.dotMult});
                        if (p.type === 'cleanseOnBasic') {
                            const target = this.friendsOf(u).find(a => a.statuses.some(s => STATUS[s.key].debuff));
                            if (target) this.cleanse(target, 1);
                        }
                    }
                }
            }
            for (const p of u.passives) {
                if (p.type === 'pushAllyAfterTurn' && u.alive) {
                    const others = this.friendsOf(u).filter(a => a !== u);
                    const same = others.filter(a => a.faction === u.faction);
                    const pool = same.length ? same : others;
                    if (pool.length) this.push(pool[Math.floor(this.rand() * pool.length)], p.pct);
                }
            }

            this.endTurn(u);
            return this.endStep();
        }

        endTurn(u) {
            // 本手才掛上的狀態不扣回合，其他狀態扣 1
            for (const s of u.statuses) if (s.appliedAt !== this.actionId) s.turns--;
            u.statuses = u.statuses.filter(s => s.turns > 0);
        }

        endStep() {
            if (!this.over) {
                if (!this.enemies().length) this.finish('win');
                else if (!this.allies().length) this.finish('lose', 'wiped');
            }
            return this.events;
        }

        finish(result, reason) {
            this.over = true;
            this.result = result;
            this.emit({type: 'end', result, reason, round: Math.min(this.round(), MAX_ROUNDS)});
        }

        pickSkill(u) {
            if (this.has(u, 'silence')) return -1;
            for (let i = 0; i < u.skills.length; i++) {
                if (u.cds[i] > 0) continue;
                const sk = u.skills[i];
                if (sk.healOnly && this.friendsOf(u).every(a => a.hp / a.maxHp > 0.85)) continue;
                if (sk.effects.some(e => e.type === 'summon') && !this.hasRoom(u.side)) continue;
                return i;
            }
            return -1;
        }

        hasRoom(side) {
            const alive = this.units.filter(x => x.side === side && x.alive);
            return alive.filter(x => x.row === 'front').length < ROW_CAP.front
                || alive.filter(x => x.row === 'back').length < ROW_CAP.back;
        }

        // ───────── 目標 ─────────
        pickTargets(u, target, ctx = {}, prev = []) {
            const foes = this.foesOf(u);
            const friends = this.friendsOf(u);
            const shuffled = arr => arr.map(x => [this.rand(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
            const byRatio = arr => arr.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
            switch (target) {
                case 'enemy': return this.singleTarget(u);
                case 'enemies': return foes;
                case 'enemyFront': {
                    const f = foes.filter(x => x.row === 'front');
                    return f.length ? f : foes;
                }
                case 'enemyLowest': return byRatio(foes).slice(0, 1);
                case 'enemyLowest2': return byRatio(foes).slice(0, 2);
                case 'enemyRandom1': return shuffled(foes).slice(0, 1);
                case 'enemyRandom2': return shuffled(foes).slice(0, 2);
                case 'self': return [u];
                case 'allies': return friends;
                case 'allyLowest': return byRatio(friends).slice(0, 1);
                case 'allyOthers': return friends.filter(x => x !== u);
                case 'trigger': return ctx.trigger ? [ctx.trigger] : [];
                case 'same': return prev.filter(x => x.alive);
                default: return [];
            }
        }

        singleTarget(u) {
            const foes = this.foesOf(u);
            if (!foes.length) return [];
            const taunters = foes.filter(x => this.has(x, 'taunt'));
            if (taunters.length) return [taunters[Math.floor(this.rand() * taunters.length)]];
            if (u.role === 'assassin') return [foes.slice().sort((a, b) => a.hp - b.hp)[0]];
            if (u.role === 'archer') return [foes.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]];
            const front = foes.filter(x => x.row === 'front');
            const pool = front.length ? front : foes;
            return [pool[Math.floor(this.rand() * pool.length)]];
        }

        // ───────── 效果 ─────────
        runEffects(src, effects, ctx) {
            let prev = [];
            for (const e of effects) {
                if (this.over && e.type !== 'heal' && e.type !== 'shield') break;
                const targets = this.pickTargets(src, e.target, ctx, prev).filter(t => t.alive);
                prev = targets;
                switch (e.type) {
                    case 'damage': {
                        // hits：多段傷害，總倍率依比例拆成幾下（例如 [0.3, 0.7]），每一下各自判定暴擊；斬殺只在最後一下判定
                        const hits = e.hits || [1];
                        hits.forEach((w, hi) => {
                            for (const t of targets) {
                                if (!t.alive) continue;
                                this.dealDamage(src, t, e.mult * w * (ctx.power || 1), {
                                    ult: ctx.ult, execute: hi === hits.length - 1 ? e.execute : 0, hit: hi, hitCount: hits.length,
                                    bonus: e.bonusVsFaction?.[t.faction] || 0, teamHealPct: e.teamHealPct,
                                });
                            }
                        });
                        break;
                    }
                    case 'heal':
                        for (const t of targets) this.heal(src, t, e.mult * (ctx.power || 1) * this.atkOf(src));
                        break;
                    case 'shield':
                        for (const t of targets) {
                            const amt = e.pctMaxHp * (ctx.power || 1) * (e.ofCaster ? src.maxHp : t.maxHp);
                            t.shield = Math.round(Math.min(t.shield + amt, t.maxHp * 0.5));
                            this.emit({type: 'shield', uid: t.uid, amount: Math.round(amt)});
                        }
                        break;
                    case 'push':
                        for (const t of targets) this.push(t, e.pct);
                        break;
                    case 'pull':
                        for (const t of targets) this.pull(t, e.pct);
                        break;
                    case 'status':
                        for (const t of targets) this.addStatus(src, t, e);
                        break;
                    case 'cleanse':
                        for (const t of targets) this.cleanse(t, e.count);
                        break;
                    case 'summon':
                        for (let i = 0; i < e.count; i++) {
                            if (!this.hasRoom(src.side)) break;
                            const alive = this.units.filter(x => x.side === src.side && x.alive);
                            const row = alive.filter(x => x.row === 'front').length < ROW_CAP.front ? 'front' : 'back';
                            const nu = this.addEnemy(e.unit, row, e.atb * ATB_MAX);
                            this.emit({type: 'summon', uid: nu.uid, by: src.uid});
                        }
                        break;
                }
            }
        }

        dealDamage(src, tgt, mult, o = {}) {
            const atk = this.atkOf(src);
            let dmg = atk * mult * DEF_K / (DEF_K + this.defOf(tgt));
            const rel = R.elementRelation(src.element, tgt.element);
            if (rel === 'adv') dmg *= R.ELEMENT_ADV;
            if (rel === 'dis') dmg *= R.ELEMENT_DIS;
            dmg *= 1 + (o.bonus || 0);
            if (src.fac?.vsUndead && tgt.faction === 'undead') dmg *= 1 + src.fac.vsUndead;
            for (const p of src.passives) if (p.type === 'dmgVsFaction' && tgt.faction === p.faction) dmg *= 1 + p.pct;
            if (this.has(tgt, 'guard')) dmg *= 0.7;
            let crit = false;
            if (!o.noCrit) {
                let rate = src.base.crit;
                for (const p of src.passives) if (p.type === 'critVsFullHp' && tgt.hp >= tgt.maxHp) rate += p.pct;
                if (this.rand() < rate) { crit = true; dmg *= 1 + src.base.critDmg; }
            }
            dmg *= 0.95 + this.rand() * 0.1;
            dmg = Math.max(1, Math.round(dmg));

            const dealt = this.applyDamage(tgt, dmg, {kind: o.ult ? 'ult' : 'hit', crit, rel, srcUid: src.uid, hit: o.hit || 0, hits: o.hitCount || 1});
            src.stats.dmg += dealt;
            if (o.ult) this.ultDamage += dealt;
            for (const p of src.passives) if (p.type === 'lifesteal' && src.alive) this.heal(src, src, dealt * p.pct);
            if (o.teamHealPct) this.friendsOf(src).forEach(a => this.heal(src, a, dealt * o.teamHealPct));
            if (o.execute && tgt.alive && !tgt.boss && tgt.hp / tgt.maxHp < o.execute) {
                this.emit({type: 'execute', uid: tgt.uid});
                tgt.hp = 0;
                this.onDeath(tgt, src);
            }
            if (!tgt.alive) {
                src.stats.kills++;
                for (const p of src.passives) if (p.type === 'onKillPush' && src.alive) this.push(src, p.pct);
            }
            return dealt;
        }

        applyDamage(tgt, dmg, info) {
            if (!tgt.alive) return 0;
            let rest = dmg;
            let absorbed = 0;
            if (tgt.shield > 0) {
                absorbed = Math.min(tgt.shield, rest);
                tgt.shield -= absorbed;
                rest -= absorbed;
            }
            tgt.hp = Math.max(0, tgt.hp - rest);
            tgt.stats.taken += dmg;
            this.emit(Object.assign({type: 'damage', uid: tgt.uid, amount: dmg, absorbed}, info));
            if (info.kind !== 'dot') this.gainEnergy(tgt, R.ENERGY.perHit);
            if (tgt.hp <= 0) this.onDeath(tgt, info.srcUid ? this.get(info.srcUid) : null);
            else {
                for (const p of tgt.passives) {
                    if (p.type === 'enrage' && !tgt.enraged && tgt.hp / tgt.maxHp < p.hpBelow) {
                        tgt.enraged = true;
                        this.emit({type: 'enrage', uid: tgt.uid});
                    }
                }
            }
            return dmg;
        }

        onDeath(u, killer) {
            if (!u.alive) return;
            u.alive = false;
            u.hp = 0;
            u.shield = 0;
            u.statuses = [];
            this.emit({type: 'death', uid: u.uid});
            for (const p of u.passives) {
                if (p.type === 'deathExplode') {
                    this.emit({type: 'explode', uid: u.uid});
                    for (const t of this.foesOf(u)) this.dealDamage(u, t, p.mult, {noCrit: true});
                }
            }
        }

        heal(src, tgt, amount) {
            if (!tgt.alive) return;
            const amt = Math.round(Math.min(amount, tgt.maxHp - tgt.hp));
            if (amt <= 0) return;
            tgt.hp += amt;
            src.stats.heal += amt;
            this.emit({type: 'heal', uid: tgt.uid, amount: amt});
        }

        push(t, pct) {
            if (!t.alive) return;
            t.atb = Math.min(ATB_MAX, t.atb + pct * ATB_MAX);
            this.emit({type: 'atb', uid: t.uid, delta: Math.round(pct * 100)});
        }

        pull(t, pct) {
            if (!t.alive) return;
            const p = t.boss ? pct / 2 : pct;
            t.atb = Math.max(0, t.atb - p * ATB_MAX);
            this.emit({type: 'atb', uid: t.uid, delta: -Math.round(p * 100)});
        }

        addStatus(src, t, e) {
            if (!t.alive) return;
            const def = STATUS[e.status];
            let chance = e.chance ?? 1;
            if (def.debuff && src.side !== t.side) chance += src.base.hit - t.base.res;
            if (this.rand() >= chance) {
                if (def.debuff && src.side !== t.side) this.emit({type: 'resist', uid: t.uid});
                return;
            }
            const value = e.dotMult ? e.dotMult * this.atkOf(src) : 0;
            const ex = t.statuses.find(s => s.key === e.status);
            if (ex) {
                ex.turns = Math.max(ex.turns, e.turns);
                ex.value = Math.max(ex.value, value);
                ex.appliedAt = this.actionId;
            } else {
                t.statuses.push({key: e.status, turns: e.turns, value, src: src.uid, appliedAt: this.actionId});
            }
            this.emit({type: 'status', uid: t.uid, key: e.status});
        }

        cleanse(t, count) {
            let n = 0;
            for (let i = t.statuses.length - 1; i >= 0 && n < count; i--) {
                if (STATUS[t.statuses[i].key].debuff) { t.statuses.splice(i, 1); n++; }
            }
            if (n) this.emit({type: 'cleanse', uid: t.uid});
        }

    }

    function simulate(opts) {
        const b = new BattleState(opts);
        let guard = 0;
        while (!b.over && guard++ < 3000) b.step();
        return b;
    }

    window.Battle = {
        create: opts => new BattleState(opts),
        simulate, STATUS, MAX_ROUNDS, ATB_MAX, ROW_CAP,
    };
})();
