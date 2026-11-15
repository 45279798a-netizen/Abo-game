// 橫向 HD-2D 戰鬥畫面（試做）
// 把 2D 全身立繪當成「立牌」放進 3D 場景；戰場原畫用投影貼圖鋪在地面與遠方，鏡頭可以移動，有泛光。
// 戰鬥規則完全沿用 js/core/battle.js，這裡只負責畫面與演出。
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {createVfxPlayer, loadLib, isGroundEffect, categoryOf} from '../vfx/player.js';
import createImpactFramePass from '../vfx/impact-frame.js';

const R = window.RES;
const Battle = window.Battle;
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const spriteSrc = img => `assets/sprites/${img}.webp`;
// 3D 立牌與演出立繪：畫質高用高解析版（寬 960），低用一般版（寬 460）
const spriteHD = img => state.quality === 'high' ? `assets/sprites_hd/${img}.webp` : spriteSrc(img);
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
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); console.warn('WebGL 內容遺失（顯示卡記憶體不足）'); }, false);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
const vfx = createVfxPlayer(scene, {maxActive: 4, sizeScale: 0.85});
const texLoader = new THREE.TextureLoader();
const loadTex = url => new Promise((res, rej) => texLoader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); res(t); }, undefined, rej));

let composer = null, bloom = null, impact = null;
// 命中定格（大招命中瞬間的黑白剪影畫面）用的遮罩場景：每個角色一個只畫剪影的替身，跟著立牌移動
const maskScene = new THREE.Scene();
const impactState = {contact: null};
function setupPost() {
    composer = null;
    impact?.dispose?.();
    impact = null;
    if (state.quality !== 'high') return;
    const rt = new THREE.WebGLRenderTarget(1, 1, {samples: 4, type: THREE.HalfFloatType});
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    // 清掉特效偶爾算出的無效值（NaN／無限大）並限制過亮的像素：不清的話泛光會把一個壞點放大成整片閃爍的方塊
    composer.addPass(new ShaderPass({
        uniforms: {tDiffuse: {value: null}},
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
            void main(){ vec4 c = texture2D(tDiffuse, vUv);
              if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
              gl_FragColor = clamp(c, 0.0, 4.0); }`,
    }));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.5, 0.94);   // 門檻高：只讓特效與高光發光，雪地不會過曝
    composer.addPass(bloom);
    try {
        impact = createImpactFramePass();
        composer.addPass(impact);
    } catch (e) { console.warn('命中定格無法使用', e); impact = null; }
    composer.addPass(new OutputPass());
    resize();
}

function syncMaskProxies() {
    scene.updateMatrixWorld();
    for (const r of units.values()) { r.proxy.matrix.copy(r.mesh.matrixWorld); r.proxy.matrixWorld.copy(r.mesh.matrixWorld); }
}
// 命中定格：以 contact（世界座標）為爆心，subjects 是要變成剪影的角色
function triggerImpact(contact, subjectUids) {
    if (!impact || impact.active) return false;
    syncMaskProxies();
    const subs = subjectUids.map(id => units.get(id)?.proxy).filter(Boolean);
    if (!subs.length) return false;
    try {
        impact.setSubjects(maskScene, camera, subs);
        const n = contact.clone().project(camera);
        if (Math.abs(n.x) > 1 || Math.abs(n.y) > 1) return false;
        impactState.contact = contact.clone();
        return impact.trigger({x: n.x * 0.5 + 0.5, y: n.y * 0.5 + 0.5});
    } catch (e) { console.warn('命中定格失敗', e); return false; }
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
    updateProjector();
}
window.addEventListener('resize', resize);

// 環境（投影貼圖）：
//   把一整張 16:9 橫式戰場原畫，從「預設鏡頭」的位置投影到 3D 地面與遠方牆面上。
//   預設視角看到的就是原畫本身（不變形）；鏡頭移動時地面仍貼著地，有立體感。
const PROJ_VS = `uniform mat4 projMatrix; varying vec4 vProj;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vProj = projMatrix * wp; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const PROJ_FS = `uniform sampler2D map; varying vec4 vProj;
void main(){
  vec2 uv = vProj.w > 0.0 ? vProj.xy / vProj.w * 0.5 + 0.5 : vec2(0.5, 0.0);
  gl_FragColor = vec4(texture2D(map, clamp(uv, 0.002, 0.998)).rgb, 1.0);
  #include <colorspace_fragment>
}`;
const projector = new THREE.PerspectiveCamera();
let projMat = null, bgAspect = 16 / 9;

function updateProjector() {
    if (!projMat) return;
    const d = defaultPose();
    projector.position.copy(d.pos);
    projector.lookAt(d.look);
    // 讓原畫「填滿」畫面：螢幕比原畫寬就對齊左右，比原畫窄就對齊上下
    const screenAspect = window.innerWidth / window.innerHeight;
    const vHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const hHalf = vHalf * screenAspect;
    const projVHalf = screenAspect >= bgAspect ? hHalf / bgAspect : vHalf;
    projector.fov = THREE.MathUtils.radToDeg(Math.atan(projVHalf) * 2);
    projector.aspect = bgAspect;
    projector.updateProjectionMatrix();
    projector.updateMatrixWorld();
    projMat.uniforms.projMatrix.value.multiplyMatrices(projector.projectionMatrix, projector.matrixWorldInverse);
}

async function buildEnvironment(bgKey) {
    const tex = await loadTex(`assets/hd/land_${bgKey}.webp`);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    bgAspect = tex.image.width / tex.image.height;
    scene.background = new THREE.Color(sampleColor(tex.image, 0.5, 0.02));
    projMat = new THREE.ShaderMaterial({uniforms: {map: {value: tex}, projMatrix: {value: new THREE.Matrix4()}}, vertexShader: PROJ_VS, fragmentShader: PROJ_FS});
    // 地面
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), projMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    // 遠方牆面（接住原畫的上半部：遠景、天空）
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(240, 120), projMat);
    wall.position.set(0, 60, -13);
    scene.add(wall);
    updateProjector();

    // 浮塵粒子，讓空氣有層次
    const n = 160, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 7; pos[i * 3 + 2] = (Math.random() - 0.5) * 16; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(g, new THREE.PointsMaterial({color: 0xfff3c4, size: 0.06, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending}));
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
  if (c.a < 0.03) discard;
  vec3 col = c.rgb;
  col = mix(col, vec3(dot(col, vec3(.299, .587, .114))), uGray);
  col *= uBright;
  col = mix(col, vec3(1.0), uFlash);
  gl_FragColor = vec4(col, smoothstep(0.15, 0.6, c.a) * uOpacity);   // 搭配 alphaToCoverage：邊緣平滑不鋸齒
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
// 後排 3 人排成一條斜線站在後方；前排 2 人明顯靠近中間、不比後排遠，看得出是「前排」。
// 每個人在畫面上的左右位置都錯開，腳下的血條不會壓到別人（用投影模擬找的，也避開左下 HUD）
const SLOTS = {
    ally:  {front: [[-2.8, 0.8], [-1.6, -1.2]], back: [[-6.9, 0.4], [-6.2, -1.4], [-5.3, -2.9]]},
    enemy: {front: [[2.8, 0.8], [1.6, -1.2]], back: [[6.9, 0.4], [6.2, -1.4], [5.3, -2.9]]},
    // 有首領時：首領站最右後方，小兵在首領左邊、畫面上的左右位置各自錯開
    bossFront: [[1.4, 1.0], [2.75, -1.0]],
    bossBack: [[7.0, -1.6], [3.5, 1.8], [4.9, -3.4]],
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
    const tex = await loadTex(spriteHD(u.img)).catch(() => loadTex(spriteSrc(u.img)));
    const aspect = tex.image.width / tex.image.height;
    let h = (u.boss ? 4.8 : u.side === 'ally' ? 2.75 : (u.elite ? 2.9 : 2.4)) * (u.side === 'enemy' ? (R.ENEMIES[u.id]?.size || 1) : 1);
    if (aspect > 1.1) h *= 1.1 / aspect;   // 橫向的寬圖（史萊姆之類）縮小，不要比別人寬一大截
    const w = h * aspect;
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    const mat = new THREE.ShaderMaterial({
        uniforms: {map: {value: tex}, uFlash: {value: 0}, uBright: {value: 1}, uGray: {value: 0}, uOpacity: {value: 1}},
        vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS, side: THREE.DoubleSide, alphaToCoverage: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const group = new THREE.Group();
    group.add(mesh);
    const proxy = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: tex, alphaTest: 0.4, side: THREE.DoubleSide}));
    proxy.matrixAutoUpdate = false;
    maskScene.add(proxy);

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
    rec.proxy = proxy;
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
    if (u.side === 'ally') updateCard(u);
    if (u.boss) updateBossBar();
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

// 血條放腳下；只有會被左下 HUD 蓋到時改放頭頂（站位已經錯開，不用再避讓彼此）
function placePlate(r) {
    if (!r.u.alive || r.u.side === 'ally' || r.u.boss) return;   // 我方在底部英雄卡、首領在上方血條
    const gx = r.group.position.x, gz = r.group.position.z;
    const f = toScreen(gx, 0, gz);
    let x = f.x, y = f.y + 4;
    const hud = $('#hud');
    if (hud && hud.offsetParent) {
        const b = hud.getBoundingClientRect(), pw = r.plate.offsetWidth || 84, ph = r.plate.offsetHeight || 22;
        if (x - pw / 2 < b.right && x + pw / 2 > b.left && y + ph > b.top + 4) y = toScreen(gx, r.h * 0.84, gz).y - ph;
    }
    const k = Math.round(x) + ',' + Math.round(y);
    if (r.plateKey !== k) { r.plateKey = k; r.plate.style.left = x + 'px'; r.plate.style.top = y + 'px'; }
}

function syncOverlays() {
    for (const r of units.values()) {
        // 立牌永遠面向鏡頭（只轉水平方向）
        r.mesh.rotation.y = Math.atan2(camera.position.x - r.group.position.x, camera.position.z - r.group.position.z);
        placePlate(r);
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
// 從預設鏡頭位置往 target 推近 ratio（0～1）的距離
function dollyTo(target, ratio) {
    const d = defaultPose();
    return d.pos.clone().lerp(target, ratio).add(new THREE.Vector3(0, 0.4, 0));
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
    // 主線關卡（cfg.stage）用 Campaign 產生關卡；growth：從大廳帶來的養成倍率
    const stageEnc = cfg.stage ? Campaign.stage(cfg.stage.ch, cfg.stage.st)
        : cfg.dungeon ? Dungeon.encounter(cfg.dungeon.kind, cfg.dungeon.id, cfg.dungeon.floor) : null;
    const b = Battle.create({team: cfg.team, encounterId: cfg.encounter, encounter: stageEnc, auto: state.auto, growth: cfg.growth});
    state.battle = b;
    $('#b-enc').textContent = cfg.dungeon ? `${stageEnc.name}・${stageEnc.difficulty}` : stageEnc ? `${stageEnc.key}　${stageEnc.kind === 'boss' ? stageEnc.name : R.CAMPAIGN.chapters[stageEnc.ch - 1].name}・${stageEnc.difficulty}` : `${b.encounter.name}・${b.encounter.difficulty}`;
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
    b.units.forEach(u => { u.skills.forEach(s => stepsOf(s.vfx).forEach(st => ids.add(st.id))); stepsOf(u.ult?.vfx).forEach(st => ids.add(st.id)); basicSteps(u).forEach(st => ids.add(st.id)); });
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

// 左上：陣營被動小標籤（點一下展開說明）
function renderFacChip() {
    const fb = state.battle.factionBonus, el = $('#fac-chip');
    if (fb) {
        const f = R.FACTIONS[fb.faction];
        el.innerHTML = `${f.emblem || ''}<b style="color:${f.color}">${f.short} ${fb.tier}</b><span class="fc-desc">${f.passive.name}：${fb.desc}</span>`;
    } else el.innerHTML = '<b>陣營被動</b><span class="fc-desc">同陣營 3 人以上，全隊獲得陣營被動</span>';
}
$('#fac-chip').onclick = () => $('#fac-chip').classList.toggle('open');

// 底部：我方英雄卡（頭像、生命、能量）；能量滿了點卡片放大招
function renderHud() {
    const b = state.battle;
    renderFacChip();
    updateBossBar();
    const bar = $('#ult-bar');
    const allies = b.units.filter(u => u.side === 'ally');
    if (bar.children.length !== allies.length || [...bar.children].some((el, i) => el.dataset.uid !== allies[i].uid)) {
        bar.innerHTML = allies.map(u => `<button class="hcd" data-uid="${u.uid}" style="--fc:${facColor(u.faction)}">
            <div class="hc-face"><img src="${spriteSrc(u.img)}" alt=""><span class="hc-el">${elIcon(u.element)}</span><span class="hc-st"></span></div>
            <div class="hc-info"><div class="hc-top"><span class="hc-name">${shortName(u.name)}</span><span class="hc-en"></span></div>
            <div class="hc-bar hp"><i></i><b></b></div>
            <div class="hc-bar en"><i></i></div></div></button>`).join('');
        bar.querySelectorAll('.hcd').forEach(el => { el.onclick = () => tapUlt(el.dataset.uid); });
    }
    for (const el of bar.children) updateCard(b.get(el.dataset.uid), el);
}
function updateCard(u, el) {
    el = el || document.querySelector(`#ult-bar .hcd[data-uid="${u.uid}"]`);
    if (!el || !u) return;
    const b = state.battle;
    const hpPct = Math.max(0, u.hp / u.maxHp * 100);
    const hp = el.querySelector('.hc-bar.hp');
    hp.querySelector('i').style.width = hpPct + '%';
    hp.querySelector('b').style.width = Math.min(100, u.shield / u.maxHp * 100) + '%';
    hp.classList.toggle('mid', hpPct < 50 && hpPct >= 25);
    hp.classList.toggle('low', hpPct < 25);
    const v = u.alive ? u.energy : 0, ready = b.ultReady(u.uid);
    el.querySelector('.hc-bar.en i').style.width = v + '%';
    el.querySelector('.hc-en').textContent = !u.alive ? '倒下' : ready ? (b.pendingUlt === u.uid ? '發動！' : '大招 ▶') : Math.floor(v) + '%';
    el.querySelector('.hc-st').innerHTML = u.statuses.map(s => `<span>${Battle.STATUS[s.key].icon}</span>`).join('');
    el.classList.toggle('ready', ready);
    el.classList.toggle('pending', b.pendingUlt === u.uid);
    el.classList.toggle('dead', !u.alive);
    el.classList.toggle('acting', !!units.get(u.uid)?.acting);
    el.title = u.ult ? `${u.ult.name}：${u.ult.desc}` : '';
}
// 上方中央：首領血條
function updateBossBar() {
    const boss = state.battle?.units.find(u => u.side === 'enemy' && u.boss);
    const el = $('#boss-bar');
    if (!boss) { el.classList.remove('show'); return; }
    if (el.dataset.uid !== boss.uid) {
        el.dataset.uid = boss.uid;
        el.innerHTML = `<div class="bb-name">${elIcon(boss.element)}<span>${boss.name}</span><span class="bb-st"></span><span class="bb-pct"></span></div><div class="bb-bar"><i class="bb-lag"></i><i class="bb-hp"></i><b></b></div>`;
    }
    const pct = Math.max(0, boss.hp / boss.maxHp * 100);
    el.querySelector('.bb-hp').style.width = pct + '%';
    el.querySelector('.bb-lag').style.width = pct + '%';
    el.querySelector('b').style.width = Math.min(100, boss.shield / boss.maxHp * 100) + '%';
    el.querySelector('.bb-pct').textContent = Math.ceil(pct) + '%';
    el.querySelector('.bb-st').innerHTML = boss.statuses.map(s => Battle.STATUS[s.key].icon).join('');
    el.classList.add('show');
    el.classList.toggle('dead', !boss.alive);
}
function tapUlt(uid) {
    const b = state.battle;
    if (!b || b.over) return;
    if (!b.useUltimate(uid)) {
        const u = b.get(uid);
        if (u?.ult) setPill(`${shortName(u.name)}・<span class="sk">${u.ult.name}</span>　能量 ${Math.round(u.energy)}%`);
        return;
    }
    renderHud();
}

function setPill(html, enemy) {
    const p = $('#turn-pill');
    p.innerHTML = html;
    p.classList.toggle('enemy', !!enemy);
    p.classList.add('show');
}

function float(rec, text, cls, dx = 0) {
    if (!rec) return;
    const f = document.createElement('span');
    f.className = 'float ' + cls;
    f.textContent = text;
    f.style.top = (-rec.fx.children.length * 18) + 'px';
    if (dx) f.style.marginLeft = dx + 'px';
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
    if (r.u.side === 'ally') updateCard(r.u);
}

function hitFlash(uid, big) {
    const r = units.get(uid);
    if (!r) return;
    tween(220, t => { r.mat.uniforms.uFlash.value = (big ? 0.5 : 0.35) * (1 - t); }, x => x);
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

// 普攻特效：近戰依職業揮砍，遠程依屬性飛彈
const BASIC_MELEE = {warrior: 'weapon-smear', tank: 'azure-sweep', assassin: 'spatial-sweep'};
const BASIC_SHOT = {fire: 'fireball', water: 'ice-shard', wind: 'spiral-gale', light: 'plasma-bolt', dark: 'arcane-missile'};
function basicSteps(u) {
    const color = R.ELEMENTS[u.element]?.color;
    if (MELEE.includes(u.role)) return [{id: BASIC_MELEE[u.role], color, size: u.boss ? 1.1 : 0.75, speed: 1.3, main: true}];
    return [{id: BASIC_SHOT[u.element] || 'plasma-bolt', color: u.element === 'fire' ? undefined : color, size: 0.6, speed: 1.2, main: true}];
}
// 黑洞類：目標被吸向中心（往中心偏移、被拉扁、發抖），時間到彈回原位
function pullIn(uids, at, ms) {
    uids.forEach(id => {
        const r = units.get(id);
        if (!r || r.u.boss) return;
        const dx = (at.x - r.group.position.x) * 0.35, dz = (at.z - r.group.position.z) * 0.35;
        tween(ms, t => {
            const k = Math.sin(Math.min(1, t * 1.15) * Math.PI / 2);
            const back = t > 0.9 ? 1 - (t - 0.9) / 0.1 : 1;
            r.mesh.position.x = (dx * k + Math.sin(t * 60) * 0.04 * k) * back;
            r.mesh.position.z = dz * k * back;
            r.mesh.scale.set(1 - 0.22 * k * back, 1 + 0.08 * k * back, 1);
            r.mesh.rotation.z = Math.sin(t * 40) * 0.05 * k * back;
        }, x => x).then(() => { r.mesh.position.x = 0; r.mesh.position.z = 0; r.mesh.scale.set(1, 1, 1); r.mesh.rotation.z = 0; });
    });
}
// 畫面四周壓暗（黑洞、蓄力）
function darken(ms) {
    const el = $('#vignette');
    if (!el) return;
    el.getAnimations().forEach(a => a.cancel());
    el.animate([{opacity: 0}, {opacity: 1, offset: 0.25}, {opacity: 1, offset: 0.8}, {opacity: 0}], {duration: ms, easing: 'ease-in-out'});
}

// 一群目標要蓋住的半徑：單體看角色身形，群體＝最遠的人到中心的距離＋半個身形
function fitRadius(uids) {
    const rs = uids.map(id => units.get(id)).filter(Boolean);
    if (!rs.length) return 1;
    const body = r => r.w * 0.55;
    if (rs.length === 1) return Math.max(1.2, body(rs[0]) * 1.2);
    const c = centerOf(uids);
    // 群體不用整片蓋滿（會擋住角色的臉），蓋住大部分就好
    return Math.min(3.2, 0.75 * Math.max(...rs.map(r => Math.hypot(r.group.position.x - c.x, r.group.position.z - c.z) + body(r))));
}
const stepsOf = v => !v ? [] : Array.isArray(v) ? v : [{...v, main: true}];

// 依序播放多段特效（技能、普攻、大招共用）。回傳「主要那段命中」的 Promise；all 等全部播完（最多 maxMs）。
// ctx：{actor, events, hits（大招指定的目標）, priority, sizeMult, speedMult, skip}
function playSteps(steps, ctx) {
    const b = state.battle;
    const actor = ctx.actor;
    const me = actor ? units.get(actor.uid) : null;
    const hitsFrom = ctx.hits || [...new Set((ctx.events || []).filter(e => e.type === 'damage' && actor && e.srcUid === actor.uid && e.kind === 'hit').map(e => e.uid))];
    const side = actor?.side || 'ally';
    const foes = b.units.filter(u => u.side !== side && (u.alive || hitsFrom.includes(u.uid))).map(u => u.uid);
    const mine = b.units.filter(u => u.side === side && u.alive).map(u => u.uid);
    const pick = at => at === 'self' ? (actor ? [actor.uid] : mine) : at === 'friends' ? mine : at === 'foes' ? foes : (hitsFrom.length ? hitsFrom : foes);
    const mainIdx = Math.max(0, steps.findIndex(st => st.main));
    const hitAt = new Map();   // 「目標 uid:第幾下」→ 那一下特效的命中時間點，傷害數字跟著它跳
    let resolveMain, resolveFirst;
    const main = new Promise(r => { resolveMain = r; });
    const first = new Promise(r => { resolveFirst = r; });   // 第一下傷害命中
    main.then(() => resolveFirst());
    const anyHit = steps.some(st => st.hit != null);
    // 先替每一段、每個目標建好「命中」的等待點：傷害事件可能比該段特效開始播放還早被處理（該段有 delay），
    // 若等到特效開始才登記，那一下的數字就會提早跳出來
    const hitIdxOf = (st, i) => st.hit != null ? st.hit : (!anyHit && i === mainIdx ? 0 : null);
    const hitDefer = new Map();
    const defer = key => { if (!hitDefer.has(key)) { let r; const p = new Promise(res => { r = res; }); hitDefer.set(key, {p, r}); hitAt.set(key, p); } return hitDefer.get(key); };
    const all = [], stops = [];
    let resolveStops;
    const stopsReady = new Promise(r => { resolveStops = r; });
    let pendingSteps = steps.length;
    const speed = (ctx.speedMult || 1) * state.speed;
    const stepKeys = steps.map((st, i) => {
        const h = hitIdxOf(st, i);
        if (h == null) return [];
        const idxs = [h, ...(st.ticks || [])];
        return pick(st.at || 'targets').flatMap(d => idxs.map(n => { defer(d + ':' + n); return d + ':' + n; }));
    });
    const release = keys => keys.forEach(k => hitDefer.get(k)?.r());
    steps.forEach((st, i) => {
        const p = (async () => {
            if (st.delay) await waitOrSkip(st.delay / state.speed, ctx.skip || {waiters: []});
            await loadLib();
            const dests = pick(st.at || 'targets').filter(id => units.get(id));
            if (!dests.length) { release(stepKeys[i]); return; }
            const base = {color: st.color, sizeMult: (st.size || 1) * (ctx.sizeMult || 1), speedMult: (st.speed || 1) * speed, skip: ctx.skip, priority: ctx.priority};
            // 地面特效依目標自動決定大小：單體＝蓋住那個角色，群體＝蓋住整群；st.size 改當微調倍率
            const fitOf = g => ({fit: fitRadius(g), fitScale: (st.size || 1) * (ctx.sizeMult || 1)});
            // 飛行／光束：打群體、打首領時加粗
            const origin = me ? chestWorld(me) : centerOf(mine, true);
            const runs = [];
            const cat = categoryOf(st.id);
            // 這段對應第幾下傷害：有寫 hit 就用；沒有任何一段寫 hit 時，主要那段算第 0 下
            const hitIdx = hitIdxOf(st, i);
            // ticks：同一段特效命中後，每隔 tick 毫秒再算下一下（吸取、持續光束）
            const hook = (d, impact) => {
                if (hitIdx == null) return;
                impact.then(defer(d + ':' + hitIdx).r);
                (st.ticks || []).forEach((n, k) => impact.then(() => sleep((k + 1) * (st.tick || 250) / state.speed)).then(defer(d + ':' + n).r));
            };
            const groups = st.each ? dests.map(d => [d]) : [dests];
            if (!isGroundEffect(st.id)) base.sizeMult *= (dests.length > 2 && !st.each ? 1.35 : 1) * (dests.some(d => b.get(d)?.boss) ? 1.3 : 1);
            for (let gi = 0; gi < groups.length; gi++) {
                const g = groups[gi];
                if (gi && st.stagger) await sleep(st.stagger / state.speed);
                let run;
                if (cat === 'cinematic') run = vfx.play(st.id, {...base, from: centerOf(mine), to: centerOf(g)});
                else if (isGroundEffect(st.id)) {
                    const at = centerOf(g);
                    run = vfx.play(st.id, {...base, ...fitOf(g), at});
                    if (run && st.pull) pullIn(g, at, st.pull);
                }
                else if (st.sky) { const at = centerOf(g); run = vfx.play(st.id, {...base, from: at.clone().setY(9), to: at}); }
                else if (g.length <= 2 && !st.each) g.forEach(d => {
                    const t = chestWorld(units.get(d));
                    const one = st.reverse ? vfx.play(st.id, {...base, from: t, to: origin}) : vfx.play(st.id, {...base, from: origin, to: t});
                    if (one) { runs.push(one); hook(d, one.impact); } else if (hitIdx != null) [hitIdx, ...(st.ticks || [])].forEach(n => defer(d + ':' + n).r());
                });
                else { const t = centerOf(g, true); run = st.reverse ? vfx.play(st.id, {...base, from: t, to: origin}) : vfx.play(st.id, {...base, from: origin, to: t}); }
                if (run) {
                    runs.push(run);
                    g.forEach(d => hook(d, run.impact));
                } else if (hitIdx != null && !(g.length <= 2 && !st.each && !isGroundEffect(st.id) && cat !== 'cinematic' && !st.sky)) g.forEach(d => [hitIdx, ...(st.ticks || [])].forEach(n => defer(d + ':' + n).r()));
                // 第一個命中就先放行（之後每個目標、每一段的傷害數字等自己那一下）
                if (hitIdx != null && gi === 0) Promise.race([...runs.map(r => r.impact), sleep(3500)]).then(resolveFirst);
                if (i === mainIdx && gi === 0) Promise.race([...runs.map(r => r.impact), sleep(3500)]).then(resolveMain);
            }
            const ok = runs.filter(Boolean);
            if (!ok.length) release(stepKeys[i]);
            if (ok.length && st.dark) darken(st.dark / state.speed);
            stops.push(...ok.map(r => r.stopped));
            if (--pendingSteps === 0) resolveStops();
            await Promise.all(ok.map(r => r.done));
        })().catch(e => { console.warn('特效失敗', st.id, e); release(stepKeys[i]); if (--pendingSteps === 0) resolveStops(); });
        all.push(p);
        if (i === mainIdx) p.then(() => resolveMain());   // 主要那段放不出來時也不要卡住
    });
    // 全部特效「主要演出」播完（不含最後淡出）
    const stopped = stopsReady.then(() => Promise.all(stops));
    return {main, first, all: Promise.all(all), stopped, hitAt};
}

async function playSkillVfx(actor, skill, events) {
    const steps = skill ? stepsOf(skill.vfx) : basicSteps(actor);
    if (!steps.length) return false;
    const run = playSteps(steps, {actor, events, priority: !!skill, speedMult: skill ? 0.8 : 1});
    state.hitWait = run.hitAt;
    if (skill) state.fxStopped = run.stopped;
    await Promise.race([run.first, sleep(skill ? 3500 : 1200)]);
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
    const steps = skill ? stepsOf(skill.vfx) : basicSteps(actor);
    const first = steps.find(st => st.main) || steps[0];
    const melee = MELEE.includes(actor.role) && target && (hits.length === 1 || (first && isGroundEffect(first.id) && (first.at || 'targets') === 'targets'));
    const color = R.ELEMENTS[actor.element]?.color || '#fde68a';

    if (melee) {
        // 衝到目標面前
        const from = new THREE.Vector3(me.base.x, 0, me.base.z);
        const dir = new THREE.Vector3(target.group.position.x - from.x, 0, target.group.position.z - from.z);
        const stop = dir.clone().setLength(Math.max(0, dir.length() - 1.3));
        await tween(230, t => me.group.position.copy(from).addScaledVector(stop, t));
        if (!(await playSkillVfx(actor, skill, events))) slash2D(target.u.uid, skill ? color : '#fde68a');
        await wait(90);
        tween(260, t => me.group.position.copy(from).addScaledVector(stop, 1 - t));
        return;
    }
    // 施法：原地一跳
    tween(420, t => { me.mesh.position.y = Math.sin(t * Math.PI) * 0.35; });
    await wait(140);
    if (await playSkillVfx(actor, skill, events)) return;
    if (target) slash2D(target.u.uid, color);
    else await wait(160);
}

// 主動技演出：鏡頭推近施放者＋立繪切入（暫停），然後看向目標放特效
async function skillCutIn(u, name) {
    const r = units.get(u.uid);
    if (state.skillMode === 'off') return;
    if (state.skillMode === 'pause' && r) {
        const c = chestWorld(r);
        moveCam(dollyTo(c, 0.5), c, 450);
    }
    const el = $('#skill-cut');
    el.querySelector('img').src = spriteHD(u.img);
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
    cutToken++;
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
let cutToken = 0;
function endSkillCutIn() {
    const el = $('#skill-cut');
    const token = cutToken;
    // 只收掉「這一次」的切入；下一位很快又放技能時，不能把新的切入一起收掉（會一閃就不見）
    if (el.classList.contains('hold')) setTimeout(() => { if (token === cutToken) el.classList.remove('hold', 'out'); }, 220);
    state.skip = null;
}

// 大招（長篇演出）：時間停止 → 三人立繪切入 → 鏡頭先看我方蓄力、再推向敵陣 → 多段 3D 特效 → 命中定格＋閃光震動 → 傷害一次爆出
async function playUltimate(e, events) {
    const b = state.battle;
    const hero = b.get(e.uid);
    const ult = hero.ult;
    const fc = facColor(hero.faction);
    setActing(hero.uid, true);
    let mode = state.ultMode;
    if (mode === 'full' && state.speed >= 2) mode = 'short';
    const short = mode === 'short';
    const skip = makeSkip();
    state.skip = skip;
    const t0 = performance.now();
    if (mode !== 'off') {
        const el = $('#ult');
        el.style.setProperty('--fc', fc);
        $('#ult-cast').innerHTML = `<div class="cut solo" style="--fy:${-(hero.faceY || 0)}%"><img src="${spriteHD(hero.img)}" alt=""></div>`;
        $('#ult-name').textContent = ult.name;
        $('#ult-fac').textContent = hero.name;
        el.classList.remove('leaving', 'fxphase');
        el.classList.add('show');
        $('#hd').classList.add('cine');
        // 鏡頭先推近施放者
        const me = units.get(hero.uid);
        if (me) { const c = chestWorld(me); moveCam(dollyTo(c, 0.5), c, 500); }
        await waitOrSkip(short ? 650 : 1250, skip);
        el.classList.add('leaving');
        await sleep(200);
        el.classList.add('fxphase');
    }
    const hits = [...new Set(events.filter(x => x.type === 'damage' && x.kind === 'ult' && x.srcUid === hero.uid).map(x => x.uid))];
    const onFoes = (ult.effects[0]?.target || '').startsWith('enem');
    const dests = hits.length ? hits : (onFoes ? b.enemies() : b.allies()).map(u => u.uid);
    const at = centerOf(dests);
    const steps = stepsOf(ult.vfx);
    const show = (ult.show || 3500) * (short ? 0.55 : 1);
    // 鏡頭：切入時已推近施放者，接著沿預設視線推向目標（只推近、不橫移，畫面才不會超出戰場原畫）
    const run = steps.length ? playSteps(steps, {actor: hero, events, hits: dests, priority: true, sizeMult: 1.1, speedMult: short ? 1.6 : 0.85, skip}) : null;
    const lookB = at.clone().setY(1.2);
    setTimeout(() => {
        if (onFoes) moveCam(dollyTo(lookB, 0.45), lookB, short ? 450 : 900);
        else { const d = defaultPose(); moveCam(d.pos.clone().lerp(lookB, 0.12), d.look.clone().lerp(lookB, 0.3), short ? 450 : 900); }   // 對我方：只稍微靠近，不轉向，畫面才不會看到戰場原畫外面
    }, mode === 'off' ? 0 : (short ? 150 : 350));
    // 主要那一下（最重的一擊）命中時：命中定格＋閃光震動。不擋住流程，其他段的傷害數字照各自命中時間跳
    const finisher = () => {
        if (skip.skipped && mode === 'full') return;
        const framed = ult.impactFrame && mode === 'full' && triggerImpact(at.clone().setY(1.3), onFoes ? dests : [hero.uid]);
        $('#flash').animate([{opacity: 0}, {opacity: framed ? .25 : onFoes ? .45 : .2}, {opacity: 0}], {duration: 380});
        if (onFoes) shake(0.3, 520);
        if (framed) { $('#hd').classList.add('impact'); setTimeout(() => $('#hd').classList.remove('impact'), 570); }
    };
    if (run) {
        state.hitWait = run.hitAt;
        state.fxStopped = run.stopped;
        run.main.then(finisher);
        await Promise.race([run.first, waitOrSkip(5000, skip)]);
    } else { await waitOrSkip(500, skip); finisher(); }
    $('#ult').classList.remove('show', 'leaving', 'fxphase');
    state.ultCine = true;   // 介面等整段大招特效播完才回來（在 playEvents 最後收）
    // 讓後段特效播完（傷害數字照常跳），整段長度依大招設定
    state.holdUntil = Math.max(state.holdUntil || 0, t0 + show / state.speed);
    state.skip = null;
    setActing(hero.uid, false);
}

async function playEvents(events, id) {
    const b = state.battle;
    for (const r of units.values()) if (r.acting) setActing(r.u.uid, false);
    state.hitWait = null;
    state.fxStopped = null;
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
                const sk = u.skills.find(s => s.name === e.name);
                if (sk?.show && state.skillMode !== 'off') state.holdUntil = performance.now() + sk.show / state.speed;
                await performAction(u, events.slice(i), sk);
                endSkillCutIn();
                break;
            }
            case 'basic':
                await performAction(u, events.slice(i), null);
                break;
            case 'energy':
                renderHud();
                break;
            case 'damage': {
                // 多段／多目標的招式：等打到這個目標的那一下特效命中才跳數字
                const hw = (e.kind === 'hit' || e.kind === 'ult') && state.hitWait?.get(e.uid + ':' + (e.hit || 0));
                if (hw) await Promise.race([hw, sleep(2500)]);
                // 同一個目標的下一段至少隔一小段時間，數字才不會疊在一起像同時跳
                if (e.hit > 0 && rec) {
                    const gap = 280 / state.speed - (performance.now() - (rec.lastHitAt || 0));
                    if (gap > 0) await sleep(gap);
                }
                if (rec) rec.lastHitAt = performance.now();
                // 多段：累計傷害，最後一下後顯示總計
                if (e.hits > 1 && rec) {
                    if (!e.hit) rec.hitSum = 0;
                    rec.hitSum = (rec.hitSum || 0) + e.amount;
                }
                let cls = e.kind === 'dot' ? 'dot' : e.kind === 'ult' ? 'combo' : (e.crit ? 'crit' : 'dmg');
                if (e.rel) cls += ' ' + e.rel;
                float(rec, String(e.amount), cls, e.hits > 1 ? (e.hit % 2 ? 16 : -16) : 0);
                if (e.hits > 1 && e.hit === e.hits - 1 && rec) { const sum = rec.hitSum; setTimeout(() => float(rec, `總計 ${sum}`, 'total'), 260 / state.speed); }
                if (e.kind !== 'dot') hitFlash(e.uid, e.crit);
                if (e.crit) shake(0.08, 220);
                updateUnit(u);
                await wait(55);
                break;
            }
            case 'heal': float(rec, '+' + e.amount, 'heal'); updateUnit(u); break;
            case 'shield': float(rec, '護盾 +' + e.amount, 'shield'); updateUnit(u); break;
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
            case 'summon': {
                await addUnit(u, true);
                // 召喚出來的位置冒出煙柱（特效寫在召喚者技能的 summonVfx）
                const by = b.get(e.by);
                const sv = by?.skills.find(sk => sk.summonVfx)?.summonVfx;
                const r = units.get(u.uid);
                if (sv && r) vfx.play(sv.id, {color: sv.color, at: footWorld(r), fit: fitRadius([u.uid]), speedMult: state.speed, priority: true});
                float(r, '召喚', 'info');
                break;
            }
            case 'ult':
                setPill(`✨ ${shortName(u.name)}・<span class="sk">${e.name}</span>`);
                await playUltimate(e, events.slice(i));
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
    // 技能／大招演出還沒播完：停在這裡，等所有特效播完（加上設定的最短長度）才換下一位
    if (state.fxStopped && id === state.runId) await Promise.race([state.fxStopped, sleep(state.ultCine ? 6000 : 4000)]);
    const left = (state.holdUntil || 0) - performance.now();
    if (left > 0 && id === state.runId) await sleep(Math.min(left, 4000));
    state.holdUntil = 0;
    state.fxStopped = null;
    state.hitWait = null;
    if (state.ultCine) { state.ultCine = false; $('#hd').classList.remove('cine'); }
    if (usedSkill && !b.over) camHome(500);
}

// 主線結算：寫進存檔（星數、首通／重打獎勵），回傳要顯示的內容
function settleStage(win, round) {
    if (!cfg.stage) return null;
    const b = state.battle;
    const S = Save.load();
    const noDeath = b.units.filter(u => u.side === 'ally').every(u => u.alive);
    const res = Campaign.settle(S, cfg.stage.ch, cfg.stage.st, win, {noDeath, rounds: round});
    Save.save(S);
    res.noDeath = noDeath;
    res.S = S;
    return res;
}
const CUR_ICON = new Proxy({}, {get: (o, k) => window.ICON ? window.ICON(k) : ''});   // 貨幣圖示（js/ui/icons.js）
// 副本結算
function settleDungeon(win, round) {
    const b = state.battle, dg = cfg.dungeon;
    const S = Save.load();
    const noDeath = b.units.filter(u => u.side === 'ally').every(u => u.alive);
    const res = Dungeon.settle(S, dg.kind, dg.id, dg.floor, win, {noDeath, rounds: round});
    Save.save(S);
    res.noDeath = noDeath;
    return res;
}
const GQ = () => R.GEAR.QUALITY;
const gearChip = it => `<span class="res-gear" style="--qc:${GQ()[it.q].color}">${R.GEAR.SLOTS[it.slot].icon}${it.set ? R.GEAR.SETS[it.set].icon : ''}<small>${GQ()[it.q].name}${it.set ? R.GEAR.SETS[it.set].name : ''}${R.GEAR.SLOTS[it.slot].name}</small></span>`;

function showResult(e) {
    const b = state.battle;
    const win = e.result === 'win';
    const round = Math.min(e.round, Battle.MAX_ROUNDS);
    const reason = win ? `${e.round} 回合內擊敗所有敵人` : (e.reason === 'timeout' ? `${Battle.MAX_ROUNDS} 回合內沒有打完` : '全隊倒下');
    const allies = b.units.filter(u => u.side === 'ally');
    const rows = allies.map(u => ({name: shortName(u.name), v: u.stats.dmg, color: facColor(u.faction)}));
    rows.sort((a, c) => c.v - a.v);
    const max = Math.max(1, ...rows.map(r => r.v));
    const st = settleStage(win, round);
    let stageHtml = '', btns = `<a class="btn-secondary" href="index.html" style="display:grid;place-items:center;text-decoration:none;color:inherit">回大廳</a><button class="btn-primary" id="res-again">再打一次</button>`;
    if (cfg.dungeon) {
        const dg = cfg.dungeon, s = Dungeon.encounter(dg.kind, dg.id, dg.floor);
        const st2 = settleDungeon(win, round);
        const conds = [['通關', win], ['沒有英雄陣亡', win && st2.noDeath], [`${s.rounds} 回合內通關`, win && round <= s.rounds]];
        stageHtml = `<div class="res-stars">${conds.map(([t, ok], i) => `<div class="${ok ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.25}s"><i>★</i><span>${t}</span></div>`).join('')}</div>`;
        if (win) stageHtml += `<div class="res-rw"><span>${st2.first ? '首通獎勵' : '獎勵'}</span>${Object.entries(st2.reward).filter(([, v]) => v > 0).map(([k, v]) => `<b>${CUR_ICON[k] || ''}${v.toLocaleString()}</b>`).join('')}</div>`
            + (st2.gear.length ? `<div class="res-rw">${st2.gear.map(gearChip).join('')}</div>` : '');
        else stageHtml += `<div class="res-tip">提示：回大廳養成英雄、強化裝備，或先打低一層</div>`;
        if (win && st2.noCount) stageHtml += `<div class="res-tip">今天的素材試煉次數用完了，這場只記錄星數（每天凌晨 4 點補 ${R.DUNGEONS.trialPerDay} 次）</div>`;
        else if (dg.kind === 'trial') stageHtml += `<div class="res-rw"><span>素材試煉次數剩 ${Dungeon.trialLeft(Save.load())} 次</span></div>`;
        const nx = win && dg.floor < R.DUNGEONS.floors;
        btns = `<a class="btn-secondary" href="index.html#trial" style="display:grid;place-items:center;text-decoration:none;color:inherit">回試煉</a><button class="btn-secondary" id="res-again">再打一次</button>${nx ? '<button class="btn-primary" id="res-next">下一層 ▶</button>' : ''}`;
        if (nx) setTimeout(() => { $('#res-next').onclick = () => { cfg.dungeon = {...dg, floor: dg.floor + 1}; try { localStorage.setItem('pr_hd2dBattle', JSON.stringify(cfg)); } catch (err) { /* 無法儲存 */ } location.reload(); }; });
    } else if (cfg.stage) {
        const s = Campaign.stage(cfg.stage.ch, cfg.stage.st);
        const conds = [['通關', win], ['沒有英雄陣亡', win && st.noDeath], [`${s.rounds} 回合內通關`, win && round <= s.rounds]];
        stageHtml = `<div class="res-stars">${conds.map(([t, ok], i) => `<div class="${ok ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.25}s"><i>★</i><span>${t}</span></div>`).join('')}</div>`;
        if (win) stageHtml += `<div class="res-rw"><span>${st.first ? '首通獎勵' : '獎勵'}</span>${Object.entries(st.reward).filter(([, v]) => v > 0).map(([k, v]) => `<b>${CUR_ICON[k] || ''}${v.toLocaleString()}</b>`).join('')}</div>`;
        else stageHtml += `<div class="res-tip">提示：回大廳幫英雄升級、突破，或調整隊伍再挑戰</div>`;
        const idx = Campaign.idxOf(cfg.stage.ch, cfg.stage.st);
        const last = R.CAMPAIGN.chapters.length * Campaign.N;
        const nx = win && idx < last ? {ch: Math.ceil((idx + 1) / Campaign.N), st: idx % Campaign.N + 1} : null;
        btns = `<a class="btn-secondary" href="index.html#map=${cfg.stage.ch}-1" style="display:grid;place-items:center;text-decoration:none;color:inherit">回地圖</a><button class="btn-secondary" id="res-again">再打一次</button>${nx ? '<button class="btn-primary" id="res-next">下一關 ▶</button>' : ''}`;
        if (nx) setTimeout(() => {
            $('#res-next').onclick = () => {
                // 下一關有劇情（新章節開頭或首領戰）就回大廳播劇情再出戰；沒有就直接重新載入戰場
                const needStory = (nx.st === 1 && !st.S.campaign.story[`${nx.ch}:start`]) || (nx.st === Campaign.N && !st.S.campaign.story[`${nx.ch}:boss`]);
                if (needStory || nx.ch !== cfg.stage.ch) { location.href = `index.html#go=${nx.ch}-${nx.st}`; return; }
                cfg.stage = nx;
                try { localStorage.setItem('pr_hd2dBattle', JSON.stringify(cfg)); } catch (err) { /* 無法儲存 */ }
                location.reload();
            };
        });
    }
    const r = $('#result');
    // 左：結果、星級、獎勵、按鈕；右：回合與輸出統計（橫向螢幕並排，直向上下排）
    r.innerHTML = `<div class="sheet res-sheet">
        <div class="res-l">
            <div class="res-title ${win ? 'win' : 'lose'}">${win ? '勝利' : '敗北'}</div>
            <div class="res-sub">${reason}</div>
            ${stageHtml}
            <div class="row-btns">${btns}</div>
        </div>
        <div class="res-r">
            <div class="res-stats"><div><b>${round}</b><span>回合</span></div><div><b>${b.ults}</b><span>大招</span></div></div>
            ${rows.map(x => `<div class="dmg-row"><span>${x.name}</span><span class="dmg-bar"><i style="width:${x.v / max * 100}%;background:${x.color}"></i></span><span class="dmg-n">${Math.round(x.v)}</span></div>`).join('')}
        </div></div>`;
    r.classList.add('show');
    $('#res-again').onclick = startBattle;
}

function syncControls() {
    $('#btn-auto').classList.toggle('on', state.auto);
    $('#btn-auto').textContent = state.auto ? '自動' : '手動';
    $('#btn-speed').textContent = 'x' + state.speed;
    $('#btn-pause').textContent = state.paused ? '▶' : '❚❚';
}

$('#btn-auto').onclick = () => { state.auto = !state.auto; if (state.battle) state.battle.auto = state.auto; syncControls(); };
$('#btn-speed').onclick = () => { state.speed = SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length]; syncControls(); };
// 暫停選單：繼續、畫質、演出設定、離開
const MODES = {
    quality: {label: '畫質', opts: [['high', '高'], ['low', '低（手機比較順）']]},
    skillMode: {label: '小技能演出', opts: [['pause', '暫停演出'], ['flash', '不停頓'], ['off', '關閉']]},
    ultMode: {label: '大招演出', opts: [['full', '完整'], ['short', '簡短'], ['off', '關閉']]},
};
function openPause() {
    state.paused = true; syncControls();
    const m = $('#pause-menu');
    m.innerHTML = `<div class="pm-box"><div class="pm-title">暫停</div>
        ${Object.entries(MODES).map(([k, d]) => `<div class="pm-row"><span>${d.label}</span><div class="pm-opts">${d.opts.map(([v, t]) => `<button class="${state[k] === v ? 'on' : ''}" data-k="${k}" data-v="${v}">${t}</button>`).join('')}</div></div>`).join('')}
        <div class="pm-btns"><a class="btn-secondary" href="index.html">離開戰鬥</a><button class="btn-primary" id="pm-go">繼續</button></div></div>`;
    m.classList.add('show');
    m.querySelectorAll('[data-k]').forEach(btn => { btn.onclick = () => {
        const k = btn.dataset.k;
        state[k] = btn.dataset.v;
        savePref(k === 'quality' ? 'hdQuality' : k, state[k]);
        if (k === 'quality') { setupPost(); resize(); }
        openPause();
    }; });
    m.querySelector('#pm-go').onclick = () => { m.classList.remove('show'); state.paused = false; syncControls(); };
}
$('#btn-pause').onclick = () => { if ($('#pause-menu').classList.contains('show')) { $('#pm-go').click(); } else openPause(); };
$('#ult').addEventListener('click', () => state.skip?.fire());
$('#hd').addEventListener('click', e => {
    if (state.skip && $('#skill-cut').classList.contains('hold') && !e.target.closest('button')) { state.skip.fire(); e.stopPropagation(); }
}, true);
$('#rotate-ok').onclick = () => { state.rotateOk = true; $('#rotate-hint').classList.remove('show'); };

// ───────── 每幀繪製 ─────────
let last = performance.now(), frameCount = 0;
function frame(now) {
    const dt = window.__fixedDt || Math.min(0.05, (now - last) / 1000);   // __fixedDt：測試環境太慢時用固定步長
    last = now;
    frameCount++;
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
    if (impact) {
        if (impact.active) syncMaskProxies();
        impact.update(dt);
        if (impact.active && impactState.contact) {
            const n = impactState.contact.clone().project(camera);
            impact.setCenter({x: n.x * 0.5 + 0.5, y: n.y * 0.5 + 0.5});
        }
    }
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    requestAnimationFrame(frame);
}

// ───────── 開始 ─────────
(async function init() {
    const enc = cfg.stage ? Campaign.stage(cfg.stage.ch, cfg.stage.st) : cfg.dungeon ? Dungeon.encounter(cfg.dungeon.kind, cfg.dungeon.id, cfg.dungeon.floor) : (R.ENCOUNTERS.find(e => e.id === cfg.encounter) || R.ENCOUNTERS[0]);
    if (!cfg.stage && !cfg.dungeon) cfg.encounter = enc.id;
    resize();
    setupPost();
    const d = defaultPose();
    cam.pos.copy(d.pos); cam.look.copy(d.look);
    await buildEnvironment(cfg.bg || enc.bgHD || 'border');
    requestAnimationFrame(frame);
    await startBattle();
    $('#loading').classList.add('done');
    window.__hd = {state, camera, cam, units,   // 測試用：__hd.ult('church')、__hd.skill(uid) 直接播演出（不影響戰鬥結果）
        impactActive: () => !!impact?.active, renderHud, vfx, scene, frames: () => frameCount,
        ult: (uid, tgt) => { const u = state.battle.get(uid); return playUltimate({uid, name: u.ult.name}, tgt ? [{type: 'damage', kind: 'ult', srcUid: uid, uid: tgt}] : []); },
        skill: async uid => { const u = state.battle.get(uid); const sk = u.skills[0]; if (sk.show) state.holdUntil = performance.now() + sk.show; if (u.side === 'ally') await skillCutIn(u, sk.name); await performAction(u, [], sk); endSkillCutIn(); },
    };
})().catch(e => {
    console.error(e);
    $('#loading').textContent = '這台裝置無法顯示 3D 戰場：' + e.message;
});
