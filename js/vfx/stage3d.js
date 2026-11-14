// 3D 特效層：在 2D 戰場上疊一層透明的 WebGL 畫布，用來播放 Three.js 特效（大招演出用）。
// 新增特效：把特效檔放進 js/vfx/，在下面 EFFECTS 登記一筆，再到 js/data/factions.js 的合體技填上 vfx 名稱。
//
//   speed   特效播放倍速（原始特效通常很長，加速才適合當大招）
//   impact  特效「打中」的時間點（原速秒數）：演出會停在這裡，之後才跳傷害數字
//   cutoff  播到這個時間點（原速秒數）就開始淡出結束
//   size    特效大小
//   hideObject  把特效內建的暫代模型藏起來
import * as THREE from 'three';

const EFFECTS = {
    'sacred-relic': {
        load: () => import('./sacred-relic.js'),
        speed: 1.8, impact: 1.45, cutoff: 4.95, size: 0.62, hideObject: true,
        options: {spread: 0.7},   // 光波範圍縮小，主要罩住敵方
    },
};

let renderer = null, scene, camera, canvas, failed = false;
const factories = {};
const raycaster = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

// 把畫面上的一點（px）換算成 3D 地面上的位置
function groundPoint(px, py) {
    const host = document.getElementById('scene');
    const ndc = new THREE.Vector2(px / host.clientWidth * 2 - 1, -(py / host.clientHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const out = new THREE.Vector3();
    return raycaster.ray.intersectPlane(ground, out) || out.set(0, 0, 0);
}

async function factory(name) {
    if (!factories[name]) factories[name] = EFFECTS[name].load().then(m => m.default);
    return factories[name];
}

function make(create, def, speedMult, scale) {
    const fx = create({...(def.options || {}), speed: def.speed * speedMult, size: def.size * scale});
    if (def.hideObject && fx.setObject) {
        try {
            fx.setObject(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial({transparent: true, opacity: 0})));
        } catch (e) { /* 換不了就保留原本的模型 */ }
    }
    return fx;
}

// 預先載入並編譯 shader，避免第一次放大招時卡頓
async function preload(name) {
    if (!EFFECTS[name] || !ensure()) return false;
    try {
        const create = await factory(name);
        const fx = make(create, EFFECTS[name], 1, 1);
        scene.add(fx.group);
        renderer.compile(scene, camera);
        scene.remove(fx.group);
        fx.dispose?.();
        return true;
    } catch (e) {
        console.warn('特效載入失敗', name, e);
        return false;
    }
}

// 播放特效。回傳 {impact, done} 兩個 Promise：impact = 打中的瞬間，done = 特效完全結束。
// skip.skipped 變成 true 時會立刻淡出。
function play(name, {x, y, scale = 1, speedMult = 1, skip = {}}) {
    const def = EFFECTS[name];
    if (!def || !ensure()) return null;
    let resolveImpact, resolveDone;
    const impact = new Promise(r => { resolveImpact = r; });
    const done = new Promise(r => { resolveDone = r; });

    factory(name).then(create => {
        resize();
        const fx = make(create, def, speedMult, scale);
        fx.group.position.copy(groundPoint(x, y));
        scene.add(fx.group);
        canvas.classList.add('on');
        const rate = def.speed * speedMult;
        const impactAt = def.impact / rate, cutoffAt = def.cutoff / rate, fadeFor = 0.5 / rate;
        let t = 0, stopAt = null, last = performance.now(), hit = false;
        function frame(now) {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            t += dt;
            fx.update(dt);
            if (!hit && (t >= impactAt || skip.skipped)) { hit = true; resolveImpact(); }
            if (stopAt === null && (t >= cutoffAt || skip.skipped)) { fx.stop(); stopAt = t; }
            renderer.render(scene, camera);
            if (stopAt !== null && (t - stopAt > fadeFor || fx.finished)) {
                scene.remove(fx.group);
                fx.dispose?.();
                renderer.clear();
                canvas.classList.remove('on');
                resolveDone();
                return;
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }).catch(e => {
        console.warn('特效播放失敗', name, e);
        resolveImpact(); resolveDone();
    });
    return {impact, done};
}

window.VFX3D = {has: name => !!EFFECTS[name] && !failed, preload, play};
window.dispatchEvent(new Event('vfx3d-ready'));
