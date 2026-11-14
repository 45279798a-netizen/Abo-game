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
