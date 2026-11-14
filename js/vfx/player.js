// 特效播放器（3D 世界座標版）：直式版的 stage3d.js 與橫向 HD-2D 版共用。
// 給它一個 Three.js 場景，它負責建立特效、每幀更新、在命中／結束時通知。
//
// 特效用法（依特效本身的類型自動判斷）：
//   projectile 飛行：從 from 飛向 to，抵達時「命中」
//   beam       光束：from 與 to 之間拉一條光束
//   area／burst／vortex  在地面 at 展開（法陣、爆炸、旋風）
//
// 每種特效的播放手感在 TUNE 調整：
//   speed   播放倍速（原始特效通常較長，加速才適合戰鬥節奏）
//   impact  命中時間點（特效原速秒數），演出會等到這一刻才跳傷害
//   cutoff  播到這個時間點（原速秒數）開始淡出
//   size    大小
//   options 其他特效參數（例如 spread 範圍）
//   hideObject 把內建的暫代模型藏起來
import * as THREE from 'three';

export const TUNE_BY_CATEGORY = {
    projectile: {speed: 2.2, size: 1.4, flight: 0.32},
    beam:       {speed: 2.2, size: 1.3, hold: 0.35},
    area:       {speed: 2.2, size: 0.7, cutoffAfterImpact: 1.1},
    burst:      {speed: 1.8, size: 0.75, cutoffAfterImpact: 1.4},
    vortex:     {speed: 2.6, size: 0.45, impact: 1.0, cutoffAfterImpact: 0.9},
};
export const TUNE = {
    'sacred-relic-descent': {speed: 1.8, impact: 1.45, cutoff: 4.95, size: 0.62, hideObject: true, options: {spread: 0.7}},
    'healing-field':        {size: 0.55},
    'burning-ground':       {size: 0.55},
    'arc-ray':              {size: 1.0},
    'fireball':             {size: 0.85, flight: 0.42},
    'charged-beam':         {hold: 0.5},
};

let libPromise = null, presetCache = null;
export function loadLib() {
    if (!libPromise) libPromise = import('./library.js').then(m => { presetCache = m.PRESETS; return m; });
    return libPromise;
}
export const categoryOf = id => presetCache?.[id]?.category || null;
export const isGroundEffect = id => !['projectile', 'beam'].includes(categoryOf(id));

// scene：要放特效的場景；maxActive：同時最多幾個（大招 priority 不受限）；sizeScale：整體大小倍率
export function createVfxPlayer(scene, {maxActive = 2, sizeScale = 1} = {}) {
    const active = new Set();
    let pending = 0;   // 已呼叫 play、特效還在載入中的數量

    function finish(a) {
        if (!active.has(a)) return;
        active.delete(a);
        scene.remove(a.fx.group);
        a.fx.dispose?.();
        a.resolveImpact();
        a.resolveDone();
    }

    // o.from / o.to / o.at：THREE.Vector3（世界座標）
    // o.color、o.sizeMult、o.speedMult、o.skip（{skipped}）、o.priority
    // 回傳 {impact, done}；太多特效同時在播時回傳 null
    function play(id, o = {}) {
        if (!o.priority && active.size + pending >= maxActive) return null;
        pending++;
        let counted = true;
        const unpend = () => { if (counted) { counted = false; pending--; } };
        let resolveImpact, resolveDone;
        const impact = new Promise(r => { resolveImpact = r; });
        const done = new Promise(r => { resolveDone = r; });
        loadLib().then(({create, PRESETS}) => {
            unpend();
            const preset = PRESETS[id];
            if (!preset) { resolveImpact(); resolveDone(); return; }
            const cat = preset.category;
            const tune = {...TUNE_BY_CATEGORY[cat], ...TUNE[id]};
            const rate = (tune.speed || 2) * (o.speedMult || 1);
            const opts = {...(tune.options || {}), speed: rate, size: (tune.size || 1) * (o.sizeMult || 1) * sizeScale};
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
                const dir = o.to.clone().sub(o.from);
                const flight = (tune.flight || 0.32) / (o.speedMult || 1);
                fx.group.position.copy(o.from);
                fx.setDirection(dir, dir.length() / flight);
                a.tick = dt => {
                    a.t += dt;
                    fx.update(dt);
                    if (!a.hit && (a.t >= flight || skip.skipped)) { fx.hit(o.to); doImpact(); }
                    if (fx.finished || (a.hit && a.t - a.hitAt > 1.4)) finish(a);
                };
            } else if (cat === 'beam') {
                fx.setEndpoints(o.from, o.to);
                const impactAt = life.start / rate, stopAt = impactAt + (tune.hold || 0.35);
                a.tick = dt => {
                    a.t += dt;
                    fx.update(dt);
                    if (a.t >= impactAt || skip.skipped) doImpact();
                    if (a.t >= stopAt || skip.skipped) doStop();
                    if (fx.finished || (a.stopAt !== null && a.t - a.stopAt > 1.2)) finish(a);
                };
            } else {
                fx.group.position.copy(o.at);
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
        }).catch(e => {
            unpend();
            console.warn('特效播放失敗', id, e);
            resolveImpact(); resolveDone();
        });
        return {impact, done};
    }

    function update(dt) {
        for (const a of [...active]) a.tick(dt);
    }

    // 預先載入並編譯，避免第一次播放卡頓
    async function preload(renderer, camera, ids) {
        const {create, PRESETS} = await loadLib();
        for (const id of ids) {
            if (!PRESETS[id]) continue;
            const fx = create(id, {});
            scene.add(fx.group);
            renderer.compile(scene, camera);
            scene.remove(fx.group);
            fx.dispose?.();
        }
    }

    return {play, update, preload, get size() { return active.size + pending; }};
}
