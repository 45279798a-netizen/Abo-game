// 橫向 HD-2D 戰鬥畫面（試做）
// 把 2D 全身立繪當成「立牌」放進真正的 3D 場景：遠景（柔焦）、地面、霧、泛光，鏡頭可以移動。
// 戰鬥規則完全沿用 js/core/battle.js，這裡只負責畫面與演出。
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createVfxPlayer, loadLib, isGroundEffect} from '../vfx/player.js';

const R = window.RES;
const Battle = window.Battle;
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const spriteSrc = img => `assets/sprites/${img}.webp`;
const facColor = f => R.FACTIONS[f]?.color || '#888';
const elIcon = e => R.ELEMENTS[e]?.icon || '';
const shortName = n => n.includes('·') ? n.split('·')[1] : n;
const SPEEDS = [1, 2, 3];
const BASE_DELAY = 650;
const MELEE = ['warrior', 'tank', 'assassin'];

// ───────── 設定（從編隊畫面帶過來） ─────────
function pref(key, def) { try { return localStorage.getItem('pr_' + key) || def; } catch (e) { return def; } }
function savePref(key, v) { try { localStorage.setItem('pr_' + key, v); } catch (e) { /* 無法儲存 */ } }
let cfg = null;
try { cfg = JSON.parse(localStorage.getItem('pr_hd2dBattle') || 'null'); } catch (e) { /* 用預設 */ }
cfg = cfg || {team: R.PRESET_TEAMS[0].team, encounter: 'vanguard', auto: true};

const state = {
    speed: 1, auto: cfg.auto !== false, paused: false, runId: 0, battle: null, skip: null,
    ultMode: pref('ultMode', 'full'), skillMode: pref('skillMode', 'pause'), quality: pref('hdQuality', 'high'),
};
const wait = ms => sleep(ms / state.speed);

// ═════════ 3D 場景 ═════════
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
const vfx = createVfxPlayer(scene, {maxActive: 3, sizeScale: 0.85});
const texLoader = new THREE.TextureLoader();
const loadTex = url => new Promise((res, rej) => texLoader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, rej));

let composer = null, bloom = null;
function setupPost() {
    composer = null;
    if (state.quality !== 'high') return;
    const rt = new THREE.WebGLRenderTarget(1, 1, {samples: 4, type: THREE.HalfFloatType});
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.5, 0.94);   // 門檻高：只讓特效與高光發光，雪地不會過曝
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    resize();
}

function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.quality === 'high' ? 2 : 1.25));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer?.setSize(w, h);
    composer?.setPixelRatio(renderer.getPixelRatio());
    $('#rotate-hint').classList.toggle('show', h > w && !state.rotateOk);
}
window.addEventListener('resize', resize);

// 環境：
//   地面：原圖下半部，鋪在戰場範圍（高解析度，近看也清楚），外圍用同色大平面延伸
//   遠景：原圖上半部（已預先柔焦，模擬景深），立在地面盡頭
//   霧：讓遠處自然融進遠景
const FIELD = {w: 60, near: 10, far: -14};   // 地面範圍（x 寬度、z 從近到遠）；寬度超過原圖比例的部分用鏡像延伸
async function buildEnvironment(bgKey) {
    const [far, ground] = await Promise.all([loadTex(`assets/hd/bg${bgKey}_far.webp`), loadTex(`assets/hd/bg${bgKey}_ground.webp`)]);
    const groundColor = new THREE.Color(sampleColor(ground.image, 0.5, 0.15));
    const skyColor = new THREE.Color(sampleColor(far.image, 0.5, 0.05));
    scene.background = skyColor;
    scene.fog = new THREE.Fog(groundColor.clone().lerp(skyColor, 0.3), 26, 60);

    const depth = FIELD.near - FIELD.far;
    ground.wrapS = THREE.MirroredRepeatWrapping;
    ground.repeat.set(FIELD.w / (depth * ground.image.width / ground.image.height), 1);
    ground.offset.x = (1 - ground.repeat.x) / 2;
    const gMesh = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.w, depth), new THREE.MeshBasicMaterial({map: ground}));
    gMesh.rotation.x = -Math.PI / 2;
    gMesh.position.set(0, 0, (FIELD.near + FIELD.far) / 2);
    scene.add(gMesh);
    // 外圍延伸，邊緣不會露出空白
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({color: groundColor}));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    scene.add(outer);

    const farW = 70, farH = farW * far.image.height / far.image.width;
    const farMesh = new THREE.Mesh(new THREE.PlaneGeometry(farW, farH), new THREE.MeshBasicMaterial({map: far, fog: false}));
    farMesh.position.set(0, farH / 2 - 1.2, FIELD.far - 0.5);
    scene.add(farMesh);

    // 浮塵粒子，讓空氣有層次
    const n = 160, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 7; pos[i * 3 + 2] = (Math.random() - 0.5) * 16; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(g, new THREE.PointsMaterial({color: 0xfff3c4, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending}));
    scene.add(motes);
}
let motes = null;

function sampleColor(img, u, v) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d');
    x.drawImage(img, Math.floor(img.width * u), Math.floor(img.height * v), 1, 1, 0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return `rgb(${d[0]},${d[1]},${d[2]})`;
}

// ───────── 角色立牌 ─────────
const SPRITE_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SPRITE_FS = `
uniform sampler2D map; uniform float uFlash, uBright, uGray, uOpacity; varying vec2 vUv;
void main(){
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.4) discard;
  vec3 col = c.rgb;
  col = mix(col, vec3(dot(col, vec3(.299, .587, .114))), uGray);
  col *= uBright;
  col = mix(col, vec3(1.0), uFlash);
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}`;
const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
})();

// 站位（世界座標 x 左右、z 前後；我方在左、敵方在右）
const SLOTS = {
    ally:  {front: [[-2.8, -1.7], [-2.8, 1.6]], back: [[-5.7, -3.2], [-5.9, -0.1], [-5.7, 3.0]]},
    enemy: {front: [[2.8, -1.7], [2.8, 1.6]], back: [[5.7, -3.2], [5.9, -0.1], [5.7, 3.0]]},
    bossFront: [[3.7, -0.8], [2.3, 2.4]],
    bossBack: [[5.3, -3.6], [5.7, 2.9], [6.3, 0.6]],
};
const units = new Map();   // uid → {u, group, mesh, mat, shadow, ring, base:{x,z}, h, plate, fx}
const slotsUsed = new Map();

function pickSlot(u) {
    const key = `${u.side}-${u.row}`;
    if (!slotsUsed.has(key)) slotsUsed.set(key, new Map());
    const used = slotsUsed.get(key);
    for (let i = 0; i < Battle.ROW_CAP[u.row]; i++) {
        const occ = used.get(i);
        if (!occ || !state.battle.get(occ)?.alive) { used.set(i, u.uid); return i; }
    }
    return 0;
}

function slotPos(u, slot) {
    const hasBoss = state.battle.units.some(e => e.side === 'enemy' && e.boss);
    let list;
    if (u.side === 'enemy' && hasBoss) list = u.row === 'front' ? SLOTS.bossFront : SLOTS.bossBack;
    else list = SLOTS[u.side][u.row];
    const [x, z] = list[slot] || list[0];
    return {x, z};
}

async function addUnit(u, spawn) {
    const tex = await loadTex(spriteSrc(u.img));
    const h = u.boss ? 4.8 : u.side === 'ally' ? 2.75 : (u.elite ? 2.9 : 2.4);
    const w = h * tex.image.width / tex.image.height;
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    const mat = new THREE.ShaderMaterial({
        uniforms: {map: {value: tex}, uFlash: {value: 0}, uBright: {value: 1}, uGray: {value: 0}, uOpacity: {value: 1}},
        vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS, side: THREE.DoubleSide, alphaToCoverage: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const group = new THREE.Group();
    group.add(mesh);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false}));
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(w * 0.75, w * 0.32, 1);
    shadow.position.y = 0.02;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48), new THREE.MeshBasicMaterial({
        color: u.side === 'ally' ? facColor(u.faction) : '#dc2626', transparent: true, opacity: u.side === 'ally' ? 0.55 : 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.scale.set(w * 0.9, w * 0.42, 1);
    group.add(shadow, ring);

    const slot = pickSlot(u);
    const p = slotPos(u, slot);
    group.position.set(p.x, 0, p.z);
    scene.add(group);

    const plate = document.createElement('div');
    plate.className = `hplate ${u.side}${u.boss ? ' boss' : ''}`;
    plate.innerHTML = `${u.boss ? `<div class="p-name">👑 ${u.name}</div>` : ''}
        <div class="p-row"><span class="p-el">${elIcon(u.element)}</span><div class="p-bars">
        <div class="bar hp"><i></i><b></b></div><div class="bar atb"><i></i></div></div></div><div class="p-st"></div>`;
    const fx = document.createElement('div');
    fx.className = 'hfx';
    $('#plates').append(plate, fx);

    const rec = {u, group, mesh, mat, shadow, ring, base: p, h, w, plate, fx};
    units.set(u.uid, rec);
    if (spawn) {
        mat.uniforms.uOpacity.value = 0;
        tween(450, t => { mat.uniforms.uOpacity.value = t; mesh.position.y = (1 - t) * -0.8; });
    }
    updateUnit(u);
    return rec;
}

function updateUnit(u) {
    const r = units.get(u.uid);
    if (!r) return;
    const pl = r.plate;
    const hpPct = Math.max(0, u.hp / u.maxHp * 100);
    const hp = pl.querySelector('.bar.hp');
    hp.querySelector('i').style.width = hpPct + '%';
    hp.querySelector('b').style.width = Math.min(100, u.shield / u.maxHp * 100) + '%';
    hp.classList.toggle('mid', hpPct < 50 && hpPct >= 25);
    hp.classList.toggle('low', hpPct < 25);
    pl.querySelector('.bar.atb i').style.width = Math.min(100, u.atb / Battle.ATB_MAX * 100) + '%';
    pl.querySelector('.p-st').innerHTML = u.statuses.map(s => `<span>${Battle.STATUS[s.key].icon}</span>`).join('');
    pl.classList.toggle('dead', !u.alive);
    if (!u.alive && !r.dying) {
        r.dying = true;
        if (u.side === 'enemy') tween(700, t => { r.mat.uniforms.uOpacity.value = 1 - t; r.mesh.position.y = -t * 0.6; r.ring.material.opacity = 0.3 * (1 - t); r.shadow.material.opacity = 1 - t; });
        else tween(600, t => { r.mat.uniforms.uGray.value = t; r.mat.uniforms.uBright.value = 1 - t * 0.55; r.ring.material.opacity = 0.55 * (1 - t); });
    }
}

const projV = new THREE.Vector3();
function toScreen(x, y, z) {
    projV.set(x, y, z).project(camera);
    return {x: (projV.x + 1) / 2 * window.innerWidth, y: (1 - projV.y) / 2 * window.innerHeight, visible: projV.z < 1};
}
const chestWorld = r => new THREE.Vector3(r.group.position.x + r.mesh.position.x, r.h * 0.55, r.group.position.z + r.mesh.position.z);
const footWorld = r => new THREE.Vector3(r.group.position.x, 0.05, r.group.position.z);

function syncOverlays() {
    for (const r of units.values()) {
        // 立牌永遠面向鏡頭（只轉水平方向）
        r.mesh.rotation.y = Math.atan2(camera.position.x - r.group.position.x, camera.position.z - r.group.position.z);
        const f = toScreen(r.group.position.x, 0, r.group.position.z);
        r.plate.style.left = f.x + 'px';
        r.plate.style.top = (f.y + 6) + 'px';
        const c = toScreen(r.group.position.x + r.mesh.position.x, r.h * 0.62, r.group.position.z);
        r.fx.style.left = c.x + 'px';
        r.fx.style.top = c.y + 'px';
    }
}

// ───────── 補間動畫 ─────────
const tweens = new Set();
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function tween(ms, fn, easing = ease) {
    return new Promise(res => tweens.add({t: 0, dur: ms / state.speed / 1000, fn, easing, res}));
}
function stepTweens(dt) {
    for (const tw of [...tweens]) {
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur);
        tw.fn(tw.easing(k));
        if (k >= 1) { tweens.delete(tw); tw.res(); }
    }
}

// ───────── 鏡頭 ─────────
const cam = {pos: new THREE.Vector3(), look: new THREE.Vector3()};
function defaultPose() {
    const aspect = window.innerWidth / window.innerHeight;
    const k = Math.max(1, 1.75 / aspect);   // 直式螢幕時拉遠，讓兩邊都看得到
    return {pos: new THREE.Vector3(0, 5.4 * k, 12.8 * k), look: new THREE.Vector3(0, 1.1, -0.6)};
}
function moveCam(pos, look, ms = 600) {
    const p0 = cam.pos.clone(), l0 = cam.look.clone();
    return tween(ms, t => { cam.pos.lerpVectors(p0, pos, t); cam.look.lerpVectors(l0, look, t); });
}
function camHome(ms = 600) { const d = defaultPose(); return moveCam(d.pos, d.look, ms); }
let shakeState = null;
function shake(power = 0.12, ms = 320) {
    const s = {p: power};
    shakeState = s;
    tween(ms, t => { s.p = power * (1 - t); }, x => x).then(() => { if (shakeState === s) shakeState = null; });
}

// ═════════ 戰鬥流程 ═════════
async function startBattle() {
    state.runId++;
    const id = state.runId;
    for (const r of units.values()) { scene.remove(r.group); r.plate.remove(); r.fx.remove(); }
    units.clear();
    slotsUsed.clear();
    $('#result').classList.remove('show');
    const b = Battle.create({team: cfg.team, encounterId: cfg.encounter, auto: state.auto});
    state.battle = b;
    $('#b-enc').textContent = `${b.encounter.name}・${b.encounter.difficulty}`;
    await Promise.all(b.units.map(u => addUnit(u)));
    const d = defaultPose();
    cam.pos.copy(d.pos).add(new THREE.Vector3(0, 1.5, 6));
    cam.look.copy(d.look);
    camHome(1400);
    syncControls();
    refreshAll();
    preloadVfx(b);
    runLoop(id);
}

function preloadVfx(b) {
    const ids = new Set();
    Object.keys(b.resonance).forEach(f => { const v = R.FACTIONS[f].combo?.vfx; if (v) ids.add(v.id); });
    b.units.forEach(u => u.skills.forEach(s => { if (s.vfx) ids.add(s.vfx.id); }));
    vfx.preload(renderer, camera, [...ids]).catch(() => {});
}

async function runLoop(id) {
    const b = state.battle;
    await wait(1200);
    while (id === state.runId && !b.over) {
        if (state.paused) { await sleep(120); continue; }
        const events = b.step();
        await playEvents(events, id);
        if (id !== state.runId) return;
        refreshAll();
        await wait(BASE_DELAY);
    }
}

function refreshAll() {
    const b = state.battle;
    for (const u of b.units) updateUnit(u);
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
    list.forEach((u, i) => {
        const t = document.createElement('div');
        t.className = 'tl' + (i === 0 ? ' first' : '') + (u.side === 'enemy' ? ' enemy' : '');
        t.innerHTML = `<div class="tl-face"><img src="${spriteSrc(u.img)}" alt=""></div>`;
        if (u.side === 'ally') t.style.borderColor = facColor(u.faction);
        box.appendChild(t);
    });
}

function renderHud() {
    const b = state.battle;
    const f = Object.keys(b.resonance)[0];
    const btn = $('#btn-ult');
    if (!f) {
        $('#res-label').textContent = '沒有大招';
        $('#res-fill').style.width = '0%';
        $('#res-hint').textContent = '隊伍裡同陣營 3 人以上才能放大招';
        btn.disabled = true;
        $('#btn-ult-name').textContent = '大招';
        $('#btn-ult-sub').textContent = '';
        return;
    }
    const fac = R.FACTIONS[f];
    const v = b.resonance[f];
    const ready = b.ultReady(f);
    const members = b.units.filter(u => u.side === 'ally' && u.faction === f).map(u => shortName(u.name)).join('、');
    $('#res-label').innerHTML = `<span style="color:${fac.color}">${fac.name}</span>・共鳴 ${Math.round(v)}%`;
    $('#res-fill').style.width = v + '%';
    $('#res-fill').style.background = fac.color;
    $('#res-hint').textContent = ready ? '集滿了！按右邊的按鈕放大招' : `${members} 每出手一次 +${R.RESONANCE.gainPerAction}%`;
    btn.style.setProperty('--fc', fac.color);
    btn.disabled = !ready || !!b.pendingUlt;
    btn.classList.toggle('ready', ready);
    $('#btn-ult-name').textContent = fac.combo.name;
    $('#btn-ult-sub').textContent = b.pendingUlt ? '發動中…' : ready ? '點我放大招' : `${Math.round(v)}%`;
}

function setPill(html, enemy) {
    const p = $('#turn-pill');
    p.innerHTML = html;
    p.classList.toggle('enemy', !!enemy);
    p.classList.add('show');
}

function float(rec, text, cls) {
    if (!rec) return;
    const f = document.createElement('span');
    f.className = 'float ' + cls;
    f.textContent = text;
    f.style.top = (-rec.fx.children.length * 18) + 'px';
    rec.fx.appendChild(f);
    setTimeout(() => f.remove(), 1150);
}

function setActing(uid, on) {
    const r = units.get(uid);
    if (!r) return;
    r.acting = on;
    r.ring.material.color.set(on ? '#fde68a' : (r.u.side === 'ally' ? facColor(r.u.faction) : '#dc2626'));
    r.ring.material.opacity = on ? 1 : (r.u.side === 'ally' ? 0.55 : 0.3);
    if (!on) r.ring.scale.set(r.w * 0.9, r.w * 0.42, 1);
}

function hitFlash(uid, big) {
    const r = units.get(uid);
    if (!r) return;
    tween(260, t => { r.mat.uniforms.uFlash.value = 0.85 * (1 - t); }, x => x);
    const k = big ? 0.14 : 0.08;
    tween(240, t => { r.mesh.position.x = Math.sin(t * Math.PI * 4) * k * (1 - t); }, x => x);
}

// 跳過演出
function makeSkip() {
    const skip = {skipped: false, waiters: []};
    skip.fire = () => { skip.skipped = true; skip.waiters.splice(0).forEach(r => r()); };
    return skip;
}
function waitOrSkip(ms, skip) {
    if (skip.skipped) return Promise.resolve();
    return new Promise(r => { skip.waiters.push(r); setTimeout(r, ms); });
}

// ───────── 出手動作 ─────────
function destsFor(actor, v, events) {
    const b = state.battle;
    const hits = [...new Set(events.filter(e => e.type === 'damage' && e.srcUid === actor.uid && e.kind === 'hit').map(e => e.uid))];
    const other = b.units.filter(u => u.side !== actor.side && (u.alive || hits.includes(u.uid))).map(u => u.uid);
    const mine = b.units.filter(u => u.side === actor.side && u.alive).map(u => u.uid);
    const at = v?.at || 'targets';
    return at === 'self' ? [actor.uid] : at === 'friends' ? mine : at === 'foes' ? other : (hits.length ? hits : other);
}
function centerOf(uids, chest) {
    const rs = uids.map(id => units.get(id)).filter(Boolean);
    const c = new THREE.Vector3();
    rs.forEach(r => c.add(chest ? chestWorld(r) : footWorld(r)));
    return c.multiplyScalar(1 / Math.max(1, rs.length));
}

async function playSkillVfx(actor, skill, events) {
    const v = skill?.vfx;
    if (!v) return false;
    await loadLib();
    const dests = destsFor(actor, v, events);
    if (!dests.length) return false;
    const me = units.get(actor.uid);
    const common = {color: v.color, sizeMult: v.size || 1, speedMult: state.speed};
    const runs = [];
    if (isGroundEffect(v.id)) runs.push(vfx.play(v.id, {...common, at: centerOf(dests)}));
    else if ((v.at || 'targets') === 'targets' && dests.length <= 2) dests.forEach(d => runs.push(vfx.play(v.id, {...common, from: chestWorld(me), to: chestWorld(units.get(d))})));
    else runs.push(vfx.play(v.id, {...common, from: chestWorld(me), to: centerOf(dests, true)}));
    const ok = runs.filter(Boolean);
    if (!ok.length) return false;
    await Promise.race([Promise.all(ok.map(r => r.impact)), sleep(1600)]);
    return true;
}

function slash2D(uid, color) {
    const r = units.get(uid);
    if (!r) return;
    const c = toScreen(r.group.position.x, r.h * 0.55, r.group.position.z);
    const v = document.createElement('div');
    v.className = 'vfx slash';
    v.style.left = c.x + 'px'; v.style.top = c.y + 'px';
    v.style.setProperty('--c', color);
    $('#plates').appendChild(v);
    v.animate([{opacity: 0, scale: .4, rotate: '-20deg'}, {opacity: 1, scale: 1.1, rotate: '0deg', offset: .35}, {opacity: 0, scale: 1.3}], {duration: 380 / state.speed}).finished.then(() => v.remove());
}

async function performAction(actor, events, skill) {
    const me = units.get(actor.uid);
    if (!me) return;
    const hits = [...new Set(events.filter(e => e.type === 'damage' && e.srcUid === actor.uid && e.kind === 'hit').map(e => e.uid))];
    const target = hits.length ? units.get(hits[0]) : null;
    const hasVfx = !!skill?.vfx;
    const melee = MELEE.includes(actor.role) && target && (hits.length === 1 || (hasVfx && isGroundEffect(skill.vfx.id)));
    const color = R.ELEMENTS[actor.element]?.color || '#fde68a';

    if (melee) {
        // 衝到目標面前
        const from = new THREE.Vector3(me.base.x, 0, me.base.z);
        const dir = new THREE.Vector3(target.group.position.x - from.x, 0, target.group.position.z - from.z);
        const stop = dir.clone().setLength(Math.max(0, dir.length() - 1.3));
        await tween(230, t => me.group.position.copy(from).addScaledVector(stop, t));
        if (!(hasVfx && await playSkillVfx(actor, skill, events))) slash2D(target.u.uid, skill ? color : '#fde68a');
        await wait(90);
        await tween(260, t => me.group.position.copy(from).addScaledVector(stop, 1 - t));
        return;
    }
    // 施法：原地一跳
    tween(420, t => { me.mesh.position.y = Math.sin(t * Math.PI) * 0.35; });
    await wait(140);
    if (hasVfx && await playSkillVfx(actor, skill, events)) return;
    if (!target) { await wait(160); return; }
    // 沒有特效的遠程普攻：用小型飛行特效（忙不過來就用 2D）
    const run = vfx.play('plasma-bolt', {color, sizeMult: 0.6, speedMult: state.speed, from: chestWorld(me), to: chestWorld(target)});
    if (run) await Promise.race([run.impact, sleep(700)]);
    else slash2D(target.u.uid, color);
}

// 主動技演出：鏡頭推近施放者＋立繪切入（暫停），然後看向目標放特效
async function skillCutIn(u, name) {
    const r = units.get(u.uid);
    if (state.skillMode === 'off') return;
    if (state.skillMode === 'pause' && r) {
        const c = chestWorld(r);
        moveCam(new THREE.Vector3(c.x + (u.side === 'ally' ? 2.2 : -2.2), c.y + 0.6, c.z + 6.5), c, 450);
    }
    const el = $('#skill-cut');
    el.querySelector('img').src = spriteSrc(u.img);
    el.querySelector('.sc-name').textContent = name;
    el.querySelector('.sc-hero').textContent = u.name;
    el.style.setProperty('--fc', facColor(u.faction));
    el.style.setProperty('--fy', -(u.faceY || 0) + '%');
    if (state.skillMode === 'flash') {
        el.classList.remove('show', 'hold', 'out'); void el.offsetWidth; el.classList.add('show');
        el.style.animationDuration = (0.9 / state.speed) + 's';
        return;
    }
    el.style.animationDuration = '';
    el.classList.remove('show', 'out'); void el.offsetWidth;
    el.classList.add('hold');
    const skip = makeSkip();
    state.skip = skip;
    await waitOrSkip(state.speed >= 2 ? 380 : 700, skip);
    el.classList.add('out');
    // 鏡頭轉向全場中央，準備看特效
    const d = defaultPose();
    moveCam(d.pos.clone().multiplyScalar(0.82).setY(d.pos.y), d.look, 380);
}
function endSkillCutIn() {
    const el = $('#skill-cut');
    if (el.classList.contains('hold')) setTimeout(() => el.classList.remove('hold', 'out'), 220);
    state.skip = null;
}

// 大招：時間停止 → 立繪切入 → 鏡頭從我方身後看向敵陣 → 3D 特效 → 傷害爆發
async function playUltimate(e) {
    const f = R.FACTIONS[e.faction];
    const b = state.battle;
    e.members.forEach(m => setActing(m, true));
    let mode = state.ultMode;
    if (mode === 'full' && state.speed >= 2) mode = 'short';
    const short = mode === 'short';
    const skip = makeSkip();
    state.skip = skip;
    if (mode !== 'off') {
        const ult = $('#ult');
        ult.style.setProperty('--fc', f.color);
        $('#ult-cast').innerHTML = e.members.slice(0, 3).map((uid, i) => {
            const u = b.get(uid);
            return `<div class="cut" style="left:${4 + i * 24}%;animation-delay:${i * (short ? 0.06 : 0.13)}s"><img src="${spriteSrc(u.img)}" alt=""></div>`;
        }).join('');
        $('#ult-name').textContent = f.combo.name;
        $('#ult-fac').textContent = f.name;
        ult.classList.remove('leaving', 'fxphase');
        ult.classList.add('show');
        $('#hd').classList.add('cine');
        await waitOrSkip(short ? 700 : 1400, skip);
        ult.classList.add('leaving');
        await sleep(200);
        ult.classList.add('fxphase');
    }
    const onFoes = (f.combo.effects[0]?.target || '').startsWith('enem');
    const dests = (onFoes ? b.enemies() : b.allies()).map(u => u.uid);
    const at = centerOf(dests);
    // 鏡頭：從斜上方拉近目標，讓法陣、地面與遠景都入鏡
    const look = at.clone().setY(1.2);
    const side = onFoes ? -1 : 1;
    moveCam(new THREE.Vector3(at.x + side * 5.5, 4.2, at.z + 8.5), look, mode === 'off' ? 300 : 650);
    const v = f.combo.vfx;
    const run = v ? vfx.play(v.id, {at, color: v.color, sizeMult: (v.size || 1) * 1.15, speedMult: short ? 1.8 : 1, skip, priority: true}) : null;
    if (run) await Promise.race([run.impact, waitOrSkip(4000, skip)]);
    else await waitOrSkip(500, skip);
    $('#flash').animate([{opacity: 0}, {opacity: .5}, {opacity: 0}], {duration: 380});
    shake(0.25, 420);
    $('#ult').classList.remove('show', 'leaving', 'fxphase');
    setTimeout(() => $('#hd').classList.remove('cine'), 500 / state.speed);
    state.skip = null;
    e.members.forEach(m => setActing(m, false));
}

async function playEvents(events, id) {
    const b = state.battle;
    for (const r of units.values()) if (r.acting) setActing(r.u.uid, false);
    let actor = null;
    let usedSkill = false;
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (id !== state.runId) return;
        const rec = e.uid ? units.get(e.uid) : null;
        const u = e.uid ? b.get(e.uid) : null;
        switch (e.type) {
            case 'turn':
                actor = u;
                setActing(u.uid, true);
                setPill(`${u.name} 行動`, u.side === 'enemy');
                $('#b-round').textContent = `第 ${Math.min(e.round, Battle.MAX_ROUNDS)} / ${Battle.MAX_ROUNDS} 回合`;
                break;
            case 'skill': {
                setPill(`${u.name}・<span class="sk">${e.name}</span>`, u.side === 'enemy');
                if (u.boss) shake(0.15, 300);
                if (u.side === 'ally') await skillCutIn(u, e.name);
                usedSkill = true;
                await performAction(u, events.slice(i), u.skills.find(s => s.name === e.name));
                endSkillCutIn();
                break;
            }
            case 'basic':
                await performAction(u, events.slice(i), null);
                break;
            case 'resonance':
                renderHud();
                if (e.ready) { $('#hud').classList.remove('pulse'); void $('#hud').offsetWidth; $('#hud').classList.add('pulse'); }
                break;
            case 'damage': {
                let cls = e.kind === 'dot' ? 'dot' : e.kind === 'combo' ? 'combo' : (e.crit ? 'crit' : 'dmg');
                if (e.rel) cls += ' ' + e.rel;
                float(rec, (e.crit ? '暴擊 ' : '') + e.amount, cls);
                if (e.kind !== 'dot') hitFlash(e.uid, e.crit);
                if (e.crit) shake(0.08, 220);
                updateUnit(u);
                await wait(55);
                break;
            }
            case 'heal': float(rec, '+' + e.amount, 'heal'); updateUnit(u); break;
            case 'shield': float(rec, '🛡 ' + e.amount, 'shield'); updateUnit(u); break;
            case 'atb': float(rec, e.delta > 0 ? `▲推條 ${e.delta}%` : `▼拉條 ${-e.delta}%`, 'info'); updateUnit(u); break;
            case 'status': float(rec, Battle.STATUS[e.key].icon + Battle.STATUS[e.key].name, 'info'); updateUnit(u); break;
            case 'resist': float(rec, '抵抗', 'info'); break;
            case 'cleanse': float(rec, '✨淨化', 'info'); updateUnit(u); break;
            case 'skip':
                float(rec, '❄️ 凍結中', 'info');
                setPill(`${u.name} 被凍結，跳過行動`, u.side === 'enemy');
                await wait(300);
                break;
            case 'execute': float(rec, '斬殺！', 'callout'); shake(0.15); break;
            case 'explode': float(rec, '💥屍爆', 'callout'); shake(0.18); break;
            case 'enrage': float(rec, '狂暴！', 'callout'); shake(0.2, 500); await wait(500); break;
            case 'death': updateUnit(u); break;
            case 'summon': await addUnit(u, true); float(units.get(u.uid), '召喚', 'info'); break;
            case 'combo':
                setPill(`✨ ${R.FACTIONS[e.faction].name}大招・<span class="sk">${e.name}</span>`);
                await playUltimate(e);
                usedSkill = true;
                break;
            case 'end':
                $('#turn-pill').classList.remove('show');
                refreshAll();
                await wait(700);
                showResult(e);
                break;
        }
    }
    if (usedSkill && !b.over) camHome(500);
}

function showResult(e) {
    const b = state.battle;
    const win = e.result === 'win';
    const reason = win ? `${e.round} 回合內擊敗所有敵人` : (e.reason === 'timeout' ? `${Battle.MAX_ROUNDS} 回合內沒有打完` : '全隊倒下');
    const allies = b.units.filter(u => u.side === 'ally');
    const rows = allies.map(u => ({name: shortName(u.name), v: u.stats.dmg, color: facColor(u.faction)}));
    if (b.comboDamage > 0) rows.push({name: '大招', v: b.comboDamage, color: '#f0abfc'});
    rows.sort((a, c) => c.v - a.v);
    const max = Math.max(1, ...rows.map(r => r.v));
    const r = $('#result');
    r.innerHTML = `<div class="sheet">
        <div class="res-title ${win ? 'win' : 'lose'}">${win ? '勝利' : '敗北'}</div>
        <div class="res-sub">${reason}</div>
        <div class="res-stats"><div><b>${Math.min(e.round, Battle.MAX_ROUNDS)}</b><span>回合</span></div><div><b>${b.combos}</b><span>大招</span></div></div>
        ${rows.map(x => `<div class="dmg-row"><span>${x.name}</span><span class="dmg-bar"><i style="width:${x.v / max * 100}%;background:${x.color}"></i></span><span class="dmg-n">${Math.round(x.v)}</span></div>`).join('')}
        <div class="row-btns"><a class="btn-secondary" href="index.html" style="display:grid;place-items:center;text-decoration:none">換隊伍</a><button class="btn-primary" id="res-again">再打一次</button></div></div>`;
    r.classList.add('show');
    $('#res-again').onclick = startBattle;
}

function syncControls() {
    $('#btn-auto').classList.toggle('on', state.auto);
    $('#btn-auto').textContent = state.auto ? '自動' : '手動';
    $('#btn-speed').textContent = 'x' + state.speed;
    $('#btn-pause').textContent = state.paused ? '▶' : '❚❚';
    $('#btn-quality').textContent = `畫質：${state.quality === 'high' ? '高' : '低'}`;
}

$('#btn-auto').onclick = () => { state.auto = !state.auto; if (state.battle) state.battle.auto = state.auto; syncControls(); };
$('#btn-speed').onclick = () => { state.speed = SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length]; syncControls(); };
$('#btn-pause').onclick = () => { state.paused = !state.paused; syncControls(); };
$('#btn-quality').onclick = () => { state.quality = state.quality === 'high' ? 'low' : 'high'; savePref('hdQuality', state.quality); setupPost(); resize(); syncControls(); };
$('#btn-ult').onclick = () => {
    const b = state.battle;
    const f = b && Object.keys(b.resonance)[0];
    if (!f || !b.useUltimate(f)) return;
    renderHud();
};
$('#ult').addEventListener('click', () => state.skip?.fire());
$('#hd').addEventListener('click', e => {
    if (state.skip && $('#skill-cut').classList.contains('hold') && !e.target.closest('button')) { state.skip.fire(); e.stopPropagation(); }
}, true);
$('#rotate-ok').onclick = () => { state.rotateOk = true; $('#rotate-hint').classList.remove('show'); };

// ───────── 每幀繪製 ─────────
let last = performance.now();
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepTweens(dt);
    vfx.update(dt);
    if (motes) motes.rotation.y += dt * 0.02;
    for (const r of units.values()) {
        if (r.acting) { const k = 1 + Math.sin(now / 160) * 0.06; r.ring.scale.set(r.w * 0.9 * k, r.w * 0.42 * k, 1); }
    }
    camera.position.copy(cam.pos);
    if (shakeState?.p) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shakeState.p, (Math.random() - 0.5) * shakeState.p, 0));
    camera.lookAt(cam.look);
    syncOverlays();
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    requestAnimationFrame(frame);
}

// ───────── 開始 ─────────
(async function init() {
    const enc = R.ENCOUNTERS.find(e => e.id === cfg.encounter) || R.ENCOUNTERS[0];
    cfg.encounter = enc.id;
    resize();
    setupPost();
    const d = defaultPose();
    cam.pos.copy(d.pos); cam.look.copy(d.look);
    await buildEnvironment(enc.bg || '1');
    requestAnimationFrame(frame);
    await startBattle();
    $('#loading').classList.add('done');
    window.__hd = {state, camera, cam, units};   // 測試用
})().catch(e => {
    console.error(e);
    $('#loading').textContent = '這台裝置無法顯示 3D 戰場：' + e.message;
});
