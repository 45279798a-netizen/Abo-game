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

## 3D 特效

特效來自 00GameDevs 的匯出檔。每個匯出檔都帶一份相同的共用程式，所以先用工具合併成一個特效庫：

```
python3 tools/build_vfx.py 匯出檔1.txt 匯出檔2.txt ...
```

會把新特效加進 `vfx-src/`，並重新產生 `js/vfx/library.js`（共用程式只留一份）。

- **用在技能**：在 `js/data/heroes.js`、`enemies.js` 的技能填 `vfx: {id: '特效 id', at: 'targets'|'foes'|'friends', color: '#...'}`
- **用在合體技（大招）**：在 `js/data/factions.js` 的合體技填 `vfx: {id: '特效 id'}`；觸發時會暫停戰鬥，播放立繪切入＋特效
- **調手感**：`js/vfx/stage3d.js` 的 `TUNE`（播放速度、大小、命中時間）
- **預覽**：開 `gallery.html`（特效圖鑑），可以看全部特效與目前被哪一招使用
- 沒填特效的技能用 2D 特效；同時最多播 2 個 3D 特效，超過的改用 2D；裝置不支援 WebGL 時全部改用 2D
- 大招演出可在編隊畫面設定「完整／簡短／關閉」，戰鬥中點一下可跳過

## 授權與來源

- 3D 特效（`js/vfx/library.js`、`vfx-src/`）：00GameDevs，MIT License（授權文字保留在檔案開頭與 `vfx-src/LICENSE.txt`）
- Three.js 0.187.0（`vendor/three/`）：MIT License，見 `vendor/three/LICENSE`
