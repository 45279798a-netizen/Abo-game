// 3D 特效層：在 2D 戰場上疊一層透明的 WebGL 畫布，播放特效庫（js/vfx/library.js）裡的 Three.js 特效。
//
// 特效用法（依特效本身的類型自動判斷）：
//   projectile 飛行：從施放者胸口飛向目標，抵達時「命中」
//   beam       光束：施放者與目標之間拉一條光束
//   area／burst／vortex  在地面某一點展開（法陣、爆炸、旋風）
//
// 每種特效的播放手感在 TUNE 調整：
//   speed   播放倍速（原始特效通常較長，加速才適合戰鬥節奏）
//   impact  命中時間點（特效原速秒數），演出會等到這一刻才跳傷害
//   cutoff  播到這個時間點（原速秒數）開始淡出
//   size    大小
//   options 其他特效參數（例如 spread 範圍）
//   hideObject 把內建的暫代模型藏起來
import * as THREE from 'three';

const TUNE_BY_CATEGORY = {
    projectile: {speed: 2.2, size: 1.4, flight: 0.32},
    beam:       {speed: 2.2, size: 1.3, hold: 0.35},
    area:       {speed: 2.2, size: 0.7, cutoffAfterImpact: 1.1},
    burst:      {speed: 1.8, size: 0.75, cutoffAfterImpact: 1.4},
    vortex:     {speed: 2.6, size: 0.45, impact: 1.0, cutoffAfterImpact: 0.9},
};
const TUNE = {
    'sacred-relic-descent': {speed: 1.8, impact: 1.45, cutoff: 4.95, size: 0.62, hideObject: true, options: {spread: 0.7}},
    'healing-field':        {size: 0.55},
    'burning-ground':       {size: 0.55},
    'arc-ray':              {size: 1.0},
    'fireball':             {size: 0.85, flight: 0.42},
    'charged-beam':         {hold: 0.5},
};
const MAX_ACTIVE = 2;       // 同時最多幾個 3D 特效（大招不受限）
const CHEST_HEIGHT = 0.5;   // 胸口高度（角色身高的比例）

let renderer = null, scene, camera, canvas, failed = false, lib = null, running = false;
const active = new Set();
const raycaster = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

let presetCache = null;
function loadLib() {
    if (!lib) lib = import('./library.js').then(m => { presetCache = m.PRESETS; return m; });
    return lib;
}

function ensure() {
    if (renderer) return true;
    if (failed) return false;
    try {
        canvas = document.createElement('canvas');
        canvas.id = 'vfx3d';
        document.getElementById('scene').appendChild(canvas);
        renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'high-performance'});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setClearColor(0x000000, 0);
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
        camera.position.set(0, 11, 15);
        camera.lookAt(0, 0, 0);
        resize();
        window.addEventListener('resize', resize);
        return true;
    } catch (e) {
        console.warn('3D 特效無法啟用，改用 2D 演出', e);
        failed = true;
        return false;
    }
}

function resize() {
    if (!renderer) return;
    const host = document.getElementById('scene');
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
}

function rayAt(px, py) {
    const host = document.getElementById('scene');
    raycaster.setFromCamera(new THREE.Vector2(px / host.clientWidth * 2 - 1, -(py / host.clientHeight) * 2 + 1), camera);
    return raycaster.ray;
}

// 畫面上腳底的點 → 3D 地面位置
function groundPoint(px, py) {
    return rayAt(px, py).intersectPlane(ground, new THREE.Vector3()) || new THREE.Vector3();
}

// 畫面上的角色（腳底 x,y、身高 h 像素）→ 3D 胸口位置：在角色所在位置立一面朝向鏡頭的牆，取胸口那一點
function chestPoint(p) {
    const foot = groundPoint(p.x, p.y);
    const wall = new THREE.Plane(new THREE.Vector3(0, 0, 1), -foot.z);
    return rayAt(p.x, p.y - (p.h || 0) * CHEST_HEIGHT).intersectPlane(wall, new THREE.Vector3()) || foot;
}

function startLoop() {
    if (running) return;
    running = true;
    canvas.classList.add('on');
    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        for (const a of [...active]) a.tick(dt);
        renderer.render(scene, camera);
        if (active.size) { requestAnimationFrame(frame); return; }
        renderer.clear();
        canvas.classList.remove('on');
        running = false;
    }
    requestAnimationFrame(frame);
}

function finish(a) {
    if (!active.has(a)) return;
    active.delete(a);
    scene.remove(a.fx.group);
    a.fx.dispose?.();
    a.resolveImpact();
    a.resolveDone();
}

// 預先載入並編譯，避免第一次播放卡頓
async function preload(ids) {
    if (!ensure()) return false;
    try {
        const {create, PRESETS} = await loadLib();
        for (const id of ids) {
            if (!PRESETS[id]) continue;
            const fx = create(id, {});
            scene.add(fx.group);
            renderer.compile(scene, camera);
            scene.remove(fx.group);
            fx.dispose?.();
        }
        return true;
    } catch (e) {
        console.warn('特效載入失敗', e);
        return false;
    }
}

// 播放特效。
//   id        特效名稱（特效庫裡的 id）
//   at        範圍特效的地面落點 {x,y}（畫面像素）
//   from, to  飛行／光束的起點與終點 {x,y,h}（腳底座標＋角色身高像素）
//   color     改顏色；sizeMult、speedMult 微調大小與速度
//   skip      {skipped} 變 true 時立刻收尾；priority 為 true 時不受同時數量限制
// 回傳 {impact, done} 兩個 Promise；不能播（沒有 WebGL、太多特效同時在播）時回傳 null，請改用 2D 演出。
function play(id, o = {}) {
    if (!ensure()) return null;
    if (!o.priority && active.size >= MAX_ACTIVE) return null;
    let resolveImpact, resolveDone;
    const impact = new Promise(r => { resolveImpact = r; });
    const done = new Promise(r => { resolveDone = r; });

    loadLib().then(({create, PRESETS}) => {
        const preset = PRESETS[id];
        if (!preset) { resolveImpact(); resolveDone(); return; }
        resize();
        const cat = preset.category;
        const tune = {...TUNE_BY_CATEGORY[cat], ...TUNE[id]};
        const rate = (tune.speed || 2) * (o.speedMult || 1);
        const opts = {...(tune.options || {}), speed: rate, size: (tune.size || 1) * (o.sizeMult || 1)};
        if (o.color) opts.color = o.color;
        const fx = create(id, opts);
        if (tune.hideObject && fx.setObject) {
            try { fx.setObject(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial({transparent: true, opacity: 0}))); } catch (e) { /* 保留原模型 */ }
        }
        const a = {fx, t: 0, hit: false, stopAt: null, resolveImpact, resolveDone};
        const life = preset.lifecycle || {start: 0.4, end: 0.6};
        const skip = o.skip || {};
        const doImpact = () => { if (!a.hit) { a.hit = true; a.hitAt = a.t; resolveImpact(); } };
        const doStop = () => { if (a.stopAt === null) { a.stopAt = a.t; fx.stop(); } };

        if (cat === 'projectile') {
            const start = chestPoint(o.from), end = chestPoint(o.to);
            const dir = end.clone().sub(start);
            const flight = (tune.flight || 0.32) / (o.speedMult || 1);
            fx.group.position.copy(start);
            fx.setDirection(dir, dir.length() / flight);
            a.tick = dt => {
                a.t += dt;
                fx.update(dt);
                if (!a.hit && (a.t >= flight || skip.skipped)) { fx.hit(end); doImpact(); }
                if (fx.finished || (a.hit && a.t - a.hitAt > 1.4)) finish(a);
            };
        } else if (cat === 'beam') {
            fx.setEndpoints(chestPoint(o.from), chestPoint(o.to));
            const impactAt = life.start / rate, stopAt = impactAt + (tune.hold || 0.35);
            a.tick = dt => {
                a.t += dt;
                fx.update(dt);
                if (a.t >= impactAt || skip.skipped) doImpact();
                if (a.t >= stopAt || skip.skipped) doStop();
                if (fx.finished || (a.stopAt !== null && a.t - a.stopAt > 1.2)) finish(a);
            };
        } else {
            fx.group.position.copy(groundPoint(o.at.x, o.at.y));
            const impactAt = (tune.impact ?? life.start) / rate;
            const cutoffAt = tune.cutoff != null ? tune.cutoff / rate : impactAt + (tune.cutoffAfterImpact || 1);
            a.tick = dt => {
                a.t += dt;
                fx.update(dt);
                if (a.t >= impactAt || skip.skipped) doImpact();
                if (a.t >= cutoffAt || skip.skipped) doStop();
                if (fx.finished || (a.stopAt !== null && a.t - a.stopAt > 1.2)) finish(a);
            };
        }
        scene.add(fx.group);
        active.add(a);
        startLoop();
    }).catch(e => {
        console.warn('特效播放失敗', id, e);
        resolveImpact(); resolveDone();
    });
    return {impact, done};
}

async function list() {
    const {PRESETS} = await loadLib();
    return PRESETS;
}

window.VFX3D = {
    available: () => ensure(),
    category: id => presetCache?.[id]?.category || null,   // 特效庫載入後才有
    busy: () => active.size >= MAX_ACTIVE,
    preload, play, list,
};
window.dispatchEvent(new Event('vfx3d-ready'));
