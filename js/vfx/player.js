// 特效播放器（3D 世界座標版）：直式版的 stage3d.js 與橫向 HD-2D 版共用。
// 給它一個 Three.js 場景，它負責建立特效、每幀更新、在命中／結束時通知。
//
// 特效用法（依特效本身的類型自動判斷）：
//   projectile 飛行：從 from 飛向 to，抵達時「命中」
//   beam       光束：from 與 to 之間拉一條光束
//   area／burst／vortex／smoke／shield  在 at 位置展開（法陣、爆炸、旋風、煙霧、護盾）
//
// 每種特效的播放手感在 TUNE 調整：
//   speed   播放倍速（原始特效通常較長，加速才適合戰鬥節奏）
//   impact  命中時間點（特效原速秒數），演出會等到這一刻才跳傷害
//   cutoff  播到這個時間點（原速秒數）開始淡出
//   size    大小
//   options 其他特效參數（例如 spread 範圍）
//   hideObject 把內建的暫代模型藏起來
import * as THREE from 'three';
import {FOOTPRINT} from './footprint.js';

export const TUNE_BY_CATEGORY = {
    projectile: {speed: 2.2, size: 1.4, flight: 0.32},
    beam:       {speed: 2.2, size: 1.3, hold: 0.35},
    area:       {speed: 2.2, size: 0.7, cutoffAfterImpact: 1.1},
    burst:      {speed: 1.8, size: 0.75, cutoffAfterImpact: 1.4},
    vortex:     {speed: 2.6, size: 0.45, impact: 1.0, cutoffAfterImpact: 0.9},
    smoke:      {speed: 2.0, size: 0.6, cutoffAfterImpact: 1.0},
    shield:     {speed: 2.0, size: 0.6, cutoffAfterImpact: 1.2},
    portal:     {speed: 2.0, size: 0.6, cutoffAfterImpact: 1.2},
    environment:{speed: 1.5, size: 0.6, cutoffAfterImpact: 1.5},
    cinematic:  {speed: 6, size: 0.45},
};
export const TUNE = {
    'sacred-relic-descent': {speed: 1.8, impact: 1.45, cutoff: 4.95, size: 0.62, hideObject: true, options: {spread: 0.7}},
    'healing-field':        {size: 0.55},
    'burning-ground':       {size: 0.55},
    'arc-ray':              {size: 1.0},
    'fireball':             {size: 0.85, flight: 0.42},
    'charged-beam':         {hold: 0.5},
    'soul-siphon':          {hold: 1.1},   // 吸取：光束維持久一點，配合多段傷害
    'prism-parry':          {speed: 1.0},   // 原本只有 0.55 秒，放慢才看得到
    'magma-fissure':        {speed: 1.2},
    'azure-sweep':          {speed: 1.0},   // 原本不到 1 秒
    'spatial-sweep':        {speed: 1.0},
    'darkchain-detonation': {size: 0.35},   // 原尺寸會蓋滿整個戰場
    'billowing-airburst':   {size: 0.4},
    'golden-chain-rain':    {size: 0.5},
    'starblade-explosion':  {size: 0.45},
};

// 獨立特效：自帶程式的單一匯出檔（不在 library.js 裡），放在 js/vfx/standalone/
// cinematic：長篇演出，從 from 往 to 掃過去（星劍焚界），time 是原速秒數
export const STANDALONE = {
    'starblade-explosion': {file: './standalone/starblade-explosion.js', name: '星焰爆破', english: 'Starfire Explosion', category: 'burst', color: '#ffd35a',
        description: '白熱火光瞬間炸開，拋出碎石與火星，留下裂紋和翻滾濃煙。', lifecycle: {start: 0.05, end: 1.93}},
    'starblade-cataclysm': {file: './standalone/starblade-cataclysm.js', name: '星劍焚界', english: 'Starblade Cataclysm', category: 'cinematic', color: '#ffd35a',
        description: '劍化成金色星光，升空聚成四瓣核心，再射出光束燒開熔岩裂谷。', lifecycle: {start: 13.1, end: 17.7}, length: 21},
};

let libPromise = null, presetCache = null;
export function loadLib() {
    if (!libPromise) {
        const ids = Object.keys(STANDALONE);
        libPromise = Promise.all([import('./library.js'), ...ids.map(id => import(STANDALONE[id].file))]).then(([lib, ...mods]) => {
            const PRESETS = {...lib.PRESETS};
            const mod = {};
            ids.forEach((id, i) => { mod[id] = mods[i]; PRESETS[id] = {id, ...STANDALONE[id], standalone: true}; });
            const create = (id, o = {}) => {
                if (!mod[id]) return lib.create(id, o);
                // 獨立特效的 speed 上限只有 2，改用時間倍率播放
                const rate = o.speed || 1;
                const fx = mod[id].default({size: Math.min(2, Math.max(0.25, o.size || 1)), ...(o.color ? {color: o.color} : {})});
                const update = fx.update.bind(fx);
                fx.update = dt => update(dt * rate);
                return fx;
            };
            presetCache = PRESETS;
            return {create, PRESETS};
        });
    }
    return libPromise;
}
export const categoryOf = id => presetCache?.[id]?.category || null;
export const isGroundEffect = id => !['projectile', 'beam', 'cinematic'].includes(categoryOf(id));

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
        let resolveImpact, resolveDone, resolveStopped;
        const impact = new Promise(r => { resolveImpact = r; });
        const done = new Promise(r => { resolveDone = r; });
        const stopped = new Promise(r => { resolveStopped = r; });   // 主要演出播完（開始淡出）
        done.then(() => resolveStopped());
        loadLib().then(({create, PRESETS}) => {
            unpend();
            const preset = PRESETS[id];
            if (!preset) { resolveImpact(); resolveDone(); return; }
            const cat = preset.category;
            const tune = {...TUNE_BY_CATEGORY[cat], ...TUNE[id]};
            const rate = (tune.speed || 2) * (o.speedMult || 1);
            // o.fit：希望特效蓋住的半徑（世界單位）。有量測資料的地面特效依此自動縮放
            let mult = o.sizeMult || 1, extra = 1;
            if (o.fit && FOOTPRINT[id] && !['projectile', 'beam', 'cinematic'].includes(cat)) {
                mult = THREE.MathUtils.clamp(o.fit / (FOOTPRINT[id] * sizeScale), 0.45, 2.4) * (o.fitScale || 1);
            }
            let size = (tune.size || 1) * mult * sizeScale;
            if (size > 2) { extra = size / 2; size = 2; }        // 特效本身的大小上限是 2，超過的部分用整體放大
            if (size < 0.25) { extra = size / 0.25; size = 0.25; }
            const opts = {...(tune.options || {}), speed: rate, size};
            if (o.color) opts.color = o.color;
            const fx = create(id, opts);
            if (tune.hideObject && fx.setObject) {
                try { fx.setObject(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial({transparent: true, opacity: 0}))); } catch (e) { /* 保留原模型 */ }
            }
            const a = {fx, t: 0, hit: false, stopAt: null, resolveImpact, resolveDone};
            const life = preset.lifecycle || {start: 0.4, end: 0.6};
            const skip = o.skip || {};
            const doImpact = () => { if (!a.hit) { a.hit = true; a.hitAt = a.t; resolveImpact(); } };
            const doStop = () => { if (a.stopAt === null) { a.stopAt = a.t; fx.stop(); resolveStopped(); } };

            if (cat === 'projectile') {
                const dir = o.to.clone().sub(o.from);
                const flight = (tune.flight || 0.32) / (o.speedMult || 1);
                fx.group.position.copy(o.from);
                fx.setDirection(dir, dir.length() / flight);
                a.tick = dt => {
                    a.t += dt;
                    fx.update(dt);
                    if (!a.hit && (a.t >= flight || skip.skipped)) { fx.hit(o.to); doImpact(); }
                    if (a.hit && a.t - a.hitAt > 0.35) resolveStopped();
                    if (fx.finished || (a.hit && a.t - a.hitAt > 1.4)) finish(a);
                };
            } else if (cat === 'cinematic') {
                // 從施放者腳下往目標掃過去：+X 朝向目標
                const start = o.from.clone().setY(0), end = o.to.clone().setY(0);
                const dir = end.clone().sub(start);
                fx.group.position.copy(start);
                fx.group.rotation.y = Math.atan2(-dir.z, dir.x);
                const k = Math.min(2, Math.max(0.25, opts.size));
                fx.setSweepPath?.(new THREE.Vector3(1.2 / k, 0, 0), new THREE.Vector3(Math.max(1.5, dir.length() + 2) / k, 0, 0));
                const impactAt = life.start / rate, stopAt = life.end / rate;
                a.tick = dt => {
                    a.t += dt;
                    fx.update(dt);
                    if (a.t >= impactAt || skip.skipped) doImpact();
                    if (skip.skipped) doStop();
                    if (fx.finished || a.t >= stopAt + 0.9 || (a.stopAt !== null && a.t - a.stopAt > 0.3)) finish(a);
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
                if (extra !== 1) fx.group.scale.multiplyScalar(extra);
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
        return {impact, done, stopped};
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
