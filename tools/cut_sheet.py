# 圖示表切圖：python3 tools/cut_sheet.py
# 把 images/ui/ 裡白底的圖示表依格子切開，去掉白底（邊緣與光暈用「白色轉透明」保留半透明），
# 裁掉多餘空白，輸出 assets/icons/<名稱>.webp（最長邊 256px）。
# 圖示表的排列與名稱寫在下方 SHEETS；生成的圖格子不太整齊也沒關係，每格會自己找物件範圍。
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'icons'

SHEETS = {
    'sheet_items.jpg': (4, 4, ['gold', 'gem', 'ticket', 'ltdTicket', 'exp', 'brk', 'book', 'stone',
                               'dust', 'shard', 'medal', 'badge', 'chest', 'chest_open', 'idle', 'key']),
    'sheet_menu.jpg': (4, 3, ['m_battle', 'm_trial', 'm_hero', 'm_gacha', 'm_bag', 'm_quest',
                              'm_pass', 'm_tower', 'm_boss', 'm_story', 'm_gallery', 'm_settings']),
    'sheet_emblems.jpg': (5, 2, ['el_fire', 'el_wind', 'el_water', 'el_light', 'el_dark',
                                 'fac_kingdom', 'fac_church', 'fac_forest', 'fac_wild', 'fac_night']),
    'sheet_gear.jpg': (4, 3, ['slot_weapon', 'slot_helmet', 'slot_armor', 'slot_acc',
                              'set_swift', 'set_resonance', 'set_bulwark', 'set_fury',
                              'set_vitality', 'set_seal', 'x_star', 'x_moon']),
}


def cut_cell(a):
    """a：一格的 RGB（float 0~255）。回傳 RGBA uint8，已去白底、裁好。"""
    mn = a.min(axis=2)
    sat = a.max(axis=2) - mn
    whiteish = (mn > 222) & (sat < 30)
    # 背景 = 跟格子邊緣相連的白色區域（物件裡面的白色，例如卷軸、太陽，會保留）
    lab, _ = ndimage.label(whiteish)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    # 背景附近一圈（光暈、反鋸齒邊）用白色轉透明，物件內部保持不透明
    near = ndimage.binary_dilation(bg, iterations=10) & ~bg
    alpha = np.ones(mn.shape)
    alpha[bg] = 0
    ca = np.clip((255 - mn) / 255 * 1.6, 0, 1)   # 越白越透明
    alpha[near] = np.minimum(1, ca[near])
    rgb = a.copy()
    m = near & (alpha > 0.02)
    # 還原顏色：c = (原色 − 白 × (1 − alpha)) / alpha
    rgb[m] = np.clip((a[m] - 255 * (1 - alpha[m])[:, None]) / alpha[m][:, None], 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    # 去掉孤立的小點（星星碎屑可以留，太小的雜點去掉）
    solid = alpha > 0.15
    lab2, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab2, range(1, n + 1))
        keep = np.isin(lab2, [i + 1 for i, s in enumerate(sizes) if s >= max(30, sizes.max() * 0.004)])
        out[..., 3] = np.where(keep | (alpha > 0.15) & False, out[..., 3], (out[..., 3] * keep).astype(np.uint8))
    ys, xs = np.where(out[..., 3] > 8)
    if not len(ys):
        return None
    pad = 6
    y0, y1 = max(0, ys.min() - pad), min(out.shape[0], ys.max() + pad)
    x0, x1 = max(0, xs.min() - pad), min(out.shape[1], xs.max() + pad)
    return out[y0:y1, x0:x1]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for fname, (cols, rows, names) in SHEETS.items():
        im = np.asarray(Image.open(ROOT / 'images' / 'ui' / fname).convert('RGB')).astype(float)
        H, W = im.shape[:2]
        for i, name in enumerate(names):
            r, c = divmod(i, cols)
            cell = im[int(r * H / rows):int((r + 1) * H / rows), int(c * W / cols):int((c + 1) * W / cols)]
            res = cut_cell(cell)
            if res is None:
                print('空的格子', fname, name)
                continue
            img = Image.fromarray(res, 'RGBA')
            # 正方形畫布、最長邊 256
            s = max(img.size)
            sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
            sq.paste(img, ((s - img.width) // 2, (s - img.height) // 2))
            sq = sq.resize((256, 256), Image.LANCZOS)
            sq.save(OUT / f'{name}.webp', 'WEBP', quality=88, method=6)
        print(fname, '→', len(names), '張')


if __name__ == '__main__':
    main()
