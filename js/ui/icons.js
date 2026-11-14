// 圖示：把資料表裡的 emoji 換成 assets/icons/ 的圖（由 tools/cut_sheet.py 從圖示表切出）。
// 在資料表之後載入；ICON(名稱) 回傳 <img> 字串，可以直接放進 innerHTML。
(function () {
    const R = window.RES;
    const ICON = (k, cls = '') => `<img class="ico ${cls}" src="assets/icons/${k}.webp" alt="" draggable="false">`;
    window.ICON = ICON;
    for (const k of Object.keys(R.ELEMENTS)) R.ELEMENTS[k].icon = ICON('el_' + k);
    for (const k of Object.keys(R.FACTIONS)) if (k !== 'undead' && k !== 'beast') R.FACTIONS[k].emblem = ICON('fac_' + k);
    if (R.GEAR) {
        for (const k of Object.keys(R.GEAR.SLOTS)) R.GEAR.SLOTS[k].icon = ICON('slot_' + k);
        for (const k of Object.keys(R.GEAR.SETS)) R.GEAR.SETS[k].icon = ICON('set_' + k);
    }
    if (R.DUNGEONS) for (const t of R.DUNGEONS.trials) t.icon = ICON(t.id);
})();
