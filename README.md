# Project Resonance（S1 重製版）

舊版遊戲保留在 `legacy` 分支。這個分支是重製版，目前進度：**第 1 步・戰鬥原型**。

## 試玩

用瀏覽器開 `index.html`。若要在本機開，建議先在資料夾裡執行 `python3 -m http.server`，再開 http://localhost:8000。

## 檔案結構

```
index.html    大廳（橫式主城）：出征（主線地圖、劇情、掛機）、英雄、招募、背包、設定
hd2d.html     橫式 HD-2D 戰鬥
dev.html      戰鬥測試頁（舊編隊畫面＋直式戰鬥，可任選英雄，不影響存檔）
gallery.html  特效圖鑑
js/data/      elements（屬性）factions（陣營被動、能量）heroes（22 位英雄）enemies（敵人、首領）vfxcolors（重複特效自動換色）
              campaign（主線 10 章、劇情、獎勵、掛機）campaign_table（各關難度，校準工具產生）
js/core/      battle.js（戰鬥引擎）save.js（本機存檔）gacha.js（招募機率與保底）growth.js（養成）
js/lobby/     main.js（大廳畫面）
js/hd2d/      main.js（橫式戰場）
js/vfx/       特效播放、特效庫、獨立特效、命中定格
js/ui/        app.js（dev.html 用）
assets/       sprites、sprites_hd、portraits、bg（直式）、hd（橫式背景與主城）
images/       原始大圖
tools/        sim.js 平衡模擬、calibrate_campaign.js／sim_campaign.js 主線難度、build_vfx.py、make_sprites.py、clean_cutout.py、footprint.html
```

## 調數值

數值都在 `js/data/` 裡。改完後執行平衡模擬，看各隊伍勝率、回合數、大招次數：

```
node tools/sim.js 300
```

## 橫式 HD-2D 戰鬥（試做）

編隊畫面的「戰鬥畫面」選「橫式 HD-2D」，開始戰鬥會進入 `hd2d.html`：
2D 全身立繪當成立牌放在 3D 戰場上（`js/hd2d/main.js`），有遠景柔焦、霧、泛光，鏡頭會在主動技與大招時移動，特效與角色在同一個 3D 場景裡。

- 背景：16:9 橫式戰場原畫 `assets/hd/land_*.webp`（原檔在 `images/land_*.jpg`），用「投影貼圖」從預設鏡頭投到 3D 地面與遠方牆面：預設視角就是原畫本身，鏡頭推近時仍有立體感。鏡頭只做推近、不大幅橫移，避免看到原畫以外的範圍
- 目前有 6 張：border 王國邊境、forest 翠林、nightcity 暗夜之城、tundra 荒原、icefort 冰冠要塞、throne 巫妖王王座。關卡在 `js/data/enemies.js` 用 `bgHD` 指定
- 新增背景：生成 16:9、下半部空曠、無人物的原畫，放進 `images/`，轉成 2048 寬的 webp 放到 `assets/hd/land_名稱.webp`
- 畫質「高」會開泛光（bloom）、用高解析立繪 `assets/sprites_hd/`（寬 960）並以手機原生解析度繪製；跑不動可切「低」（一般立繪寬 460）
- 新增或修改角色圖後，執行 `python3 tools/make_sprites.py 角色名` 重做高解析立繪（不加參數 = 全部重做）
- 戰鬥規則與直式版共用 `js/core/battle.js`；特效播放共用 `js/vfx/player.js`

## 3D 特效

特效來自 00GameDevs 的匯出檔。每個匯出檔都帶一份相同的共用程式，所以先用工具合併成一個特效庫：

```
python3 tools/build_vfx.py 匯出檔1.txt 匯出檔2.txt ...
```

會把新特效加進 `vfx-src/`，並重新產生 `js/vfx/library.js`（共用程式只留一份）。

- **用在技能**：在 `js/data/heroes.js`、`enemies.js` 的技能填 `vfx: {id: '特效 id', at: 'targets'|'foes'|'friends', color: '#...'}`
- **用在大招**：在 `js/data/heroes.js` 英雄的 `ult.vfx` 填多段特效；能量滿時放出，會暫停戰鬥播放立繪切入＋特效
- **調手感**：`js/vfx/player.js` 的 `TUNE`（播放速度、大小、命中時間），直式版與 HD-2D 版共用
- **預覽**：開 `gallery.html`（特效圖鑑），可以看全部特效與目前被哪一招使用
- 沒填特效的技能用 2D 特效；同時最多播 2 個 3D 特效，超過的改用 2D；裝置不支援 WebGL 時全部改用 2D
- 大招演出可在編隊畫面設定「完整／簡短／關閉」，戰鬥中點一下可跳過

## 授權與來源

- 3D 特效（`js/vfx/library.js`、`vfx-src/`）：00GameDevs，MIT License（授權文字保留在檔案開頭與 `vfx-src/LICENSE.txt`）
- Three.js 0.187.0（`vendor/three/`，含後製模組 `vendor/three/addons/`）：MIT License，見 `vendor/three/LICENSE`

### 獨立特效與後製

- `js/vfx/standalone/`：自帶程式的單一匯出檔，直接在 `js/vfx/player.js` 的 `STANDALONE` 登記就能用（星焰爆破、星劍焚界）。星劍焚界是 21 秒的長篇演出，播放時加速成約 3.5 秒，用在教團大招
- `js/vfx/impact-frame.js`：命中定格（大招命中瞬間畫面變黑白剪影），接在畫質「高」的後製流程裡；角色剪影用 `maskScene` 裡的替身繪製
- `vfx-src/special/`：還沒接入的匯出檔。森光治癒、織光護盾、連續雷流、冰矛飛射、冰晶護盾、地面冰封、烈焰繞流都會接管整個畫面的繪製（自帶光暈），要改寫才能和現有畫面共存

## 技能演出

技能特效寫在 `js/data/heroes.js`、`enemies.js`、`factions.js` 的 `vfx`：可以是多段特效依序播放（delay、each、sky、reverse、main），`show` 是整段演出長度（1.5～3.5 秒，大招約 4～5 秒）。普攻特效依職業（近戰揮砍）與屬性（遠程飛彈）自動決定，在 `js/hd2d/main.js` 的 `BASIC_MELEE`、`BASIC_SHOT`。

### 特效大小自動調整

地面特效（法陣、爆炸、旋風、煙霧、護盾…）播放時會依目標自動縮放：單體＝剛好蓋住那個角色（首領比較大），群體＝蓋住整群的大部分。依據是 `js/vfx/footprint.js` 裡每個特效實際覆蓋的半徑，由 `tools/footprint.html` 量測。新增特效後，開本機伺服器並用瀏覽器打開 `tools/footprint.html`，把 `window.__result` 的結果更新到 `footprint.js`。資料表裡地面特效的 `size` 改當微調倍率（1 = 剛好）。飛行和光束打群體、打首領時會自動加粗。

## 大廳、存檔、招募

- 存檔存在瀏覽器 localStorage（`abo_s1_save`），格式在 `js/core/save.js`，帶版本號。設定裡可以重置存檔
- 開局送亞瑟、艾拉、菲、毒鏢客，外加一次免費新手 10 連抽（必出 SSR）、1500 鑽石、常駐券 3、限定券 1；之後的資源主要從主線與掛機取得
- 招募機率與保底在 `js/core/gacha.js`：常駐 R55／SR35／SSR10、10 抽必 SR、50 抽必 SSR；S1 限定 UR2%（烏瑟）、80 抽保底、保底延續整季；重複轉碎片 R10／SR20／SSR40／UR80
- 大廳背景 `assets/hd/lobby_capital.webp`（原檔 `images/lobby_capital.jpg`）

## 養成

規則在 `js/core/growth.js`：
- 等級 1～100：經驗藥水＋金幣，每級全能力 +4%；每 20 級用突破石突破一次（共 4 次）
- 星級：初始 R 1★／SR 2★／SSR 3★／UR 4★，最高 6★，每升 1★ 全能力 +15%；升 2★～6★ 需要碎片 20／40／100／300／500
- 技能等級 1～5：小技能、大招分開升，用技能書＋金幣，每級效果 +8%（傷害、治療、護盾）
- 滿星後重複抽到的碎片轉成星塵；星塵商店：1 碎片 = 2 星塵（任選已擁有、未滿星的英雄），也能換技能書、突破石、經驗藥水
- 出戰時大廳把每位英雄的養成倍率（全能力、小技能、大招）傳給戰鬥引擎

## 主線與掛機

資料在 `js/data/campaign.js`：
- 10 章 × 15 關。每 5 關是菁英關，第 15 關是章節首領（骸骨騎士、亡靈督軍、毒蛛女王、瘟疫使者、巨沙蟲、冰霜巫妖領主、虛空魔、墮落魔王、骨龍、巫妖王）
- 一般關卡依章節的敵人池自動組隊，同一關每次都一樣
- 每章開頭與首領戰前各有一段劇情（立繪＋對話，可跳過，地圖上的「劇情」可以重看）
- 星級：1★ 通關、2★ 沒有英雄陣亡、3★ 在指定回合內通關。每章 15／30／45 星各有一個寶箱
- 首通給鑽石、金幣、經驗藥水、突破石，菁英與首領另給技能書，首領再給限定券；重打給少量金幣與藥水
- 沒有體力。3★ 關卡可以掃蕩，每天共 30 次
- 掛機：依最高通關關卡計算每小時收益，最多累積 12 小時；快速掛機每天第 1 次免費，之後 50、100 鑽石

難度：`js/data/campaign_table.js` 記錄每關的敵人攻擊倍率、3★ 回合數、敵人生命防禦倍率，由校準工具產生——
用一支參考隊伍在「預期養成」（第 i 關約 1+0.62i 級，每 60 關多 1★）下，二分搜尋讓勝率落在一般 90%、菁英 80%、首領 65%，
戰鬥太長時自動壓低敵人生命。前兩章再打折，讓只有初始英雄也能過。改了英雄、敵人或養成數值後重跑：

```
node tools/calibrate_campaign.js          # 全部重算（約 10 分鐘）
node tools/calibrate_campaign.js 3,4      # 只算第 3、4 章
node tools/sim_campaign.js 30             # 用兩支隊伍檢查各章代表關卡的勝率與 3 星率
```
