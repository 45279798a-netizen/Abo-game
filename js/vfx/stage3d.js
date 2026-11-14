// 直式版的 3D 特效層：在 2D 戰場上疊一層透明的 WebGL 畫布播放特效。
// 播放邏輯與手感設定在 player.js（與橫向 HD-2D 版共用），這裡只負責：
//   畫布與鏡頭、把畫面上的像素位置換算成 3D 世界座標。
import * as THREE from 'three';
import {createVfxPlayer, loadLib, categoryOf} from './player.js';

const MAX_ACTIVE = 2;       // 同時最多幾個 3D 特效（大招不受限）
const CHEST_HEIGHT = 0.5;   // 胸口高度（角色身高的比例）

let renderer = null, scene, camera, canvas, failed = false, running = false, player = null;
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
        player = createVfxPlayer(scene, {maxActive: MAX_ACTIVE});
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
        player.update(dt);
        renderer.render(scene, camera);
        if (player.size) { requestAnimationFrame(frame); return; }
        renderer.clear();
        canvas.classList.remove('on');
        running = false;
    }
    requestAnimationFrame(frame);
}

async function preload(ids) {
    if (!ensure()) return false;
    try { await player.preload(renderer, camera, ids); return true; } catch (e) { console.warn('特效載入失敗', e); return false; }
}

// 播放特效（畫面像素座標）。
//   at        法陣／爆炸／旋風的地面落點 {x,y}
//   from, to  飛行／光束的起點與終點 {x,y,h}（腳底座標＋角色身高像素）
// 其餘參數見 player.js。不能播時回傳 null，請改用 2D 演出。
function play(id, o = {}) {
    if (!ensure()) return null;
    const world = {...o};
    if (o.at) world.at = groundPoint(o.at.x, o.at.y);
    if (o.from) world.from = chestPoint(o.from);
    if (o.to) world.to = chestPoint(o.to);
    resize();
    const run = player.play(id, world);
    if (run) startLoop();
    return run;
}

async function list() {
    const {PRESETS} = await loadLib();
    return PRESETS;
}

window.VFX3D = {
    available: () => ensure(),
    category: categoryOf,      // 特效庫載入後才有
    busy: () => player ? player.size >= MAX_ACTIVE : false,
    preload, play, list,
};
window.dispatchEvent(new Event('vfx3d-ready'));
