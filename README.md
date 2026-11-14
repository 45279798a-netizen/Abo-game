# Project Resonance（S1 重製版）

舊版遊戲保留在 `legacy` 分支。這個分支是重製版，目前進度：**第 1 步・戰鬥原型**。

## 試玩

用瀏覽器開 `index.html`。若要在本機開，建議先在資料夾裡執行 `python3 -m http.server`，再開 http://localhost:8000。

## 檔案結構

```
index.html
css/style.css
js/data/      elements.js（屬性）  factions.js（陣營、合體技、連攜規則）
              heroes.js（英雄）    enemies.js（敵人、戰鬥關卡、整體難度）
js/core/      battle.js（戰鬥引擎，不碰畫面，可無畫面執行）
js/ui/        app.js（編隊、戰鬥、結算畫面）
assets/portraits/   壓縮過的角色圖（webp，每張約 50KB）
images/       原始大圖
tools/sim.js  平衡模擬
```

## 調數值

數值都在 `js/data/` 裡。改完後執行平衡模擬，看各隊伍勝率、回合數、合體技次數：

```
node tools/sim.js 300
```

## 大招特效（3D）

合體技觸發時會暫停戰鬥，播放立繪切入與 3D 特效。

- 特效檔放在 `js/vfx/`，在 `js/vfx/stage3d.js` 的 `EFFECTS` 登記（播放速度、打中時間、大小）
- 在 `js/data/factions.js` 的合體技填上 `vfx: '名稱'` 就會使用；沒填的陣營用 2D 備用演出
- 演出可在編隊畫面設定「完整／簡短／關閉」，戰鬥中點一下可跳過，x2 以上速度自動改簡短

## 授權與來源

- 3D 特效「聖遺物・治癒降臨」（`js/vfx/sacred-relic.js`）：00GameDevs，MIT License（授權文字保留在檔案開頭）
- Three.js 0.187.0（`vendor/three/`）：MIT License，見 `vendor/three/LICENSE`
