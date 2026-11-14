#!/usr/bin/env python3
"""清除去背不乾淨的白色殘留（原圖白底沒被去掉的部分）。

找出「接近白色、且跟透明外圍相連」的區塊，把它們變透明，邊緣做柔化。
角色身上的白色（例如不跟外圍相連的白衣服）不會被動到。

用法：
    python3 tools/clean_cutout.py 檢查                 # 掃描所有角色圖，列出白邊比例高的
    python3 tools/clean_cutout.py 修正 m14 [其他...]   # 修正並重新輸出 assets/sprites 與 assets/portraits
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent


def white_mask(a, lo=200, sat=34):
    rgb = a[..., :3].astype(int)
    mn, mx = rgb.min(-1), rgb.max(-1)
    return (a[..., 3] > 0) & (mn > lo) & (mx - mn < sat)


def leftover(a):
    """跟透明外圍相連的白色區塊"""
    clear = a[..., 3] < 8
    w = white_mask(a)
    lab, _ = ndimage.label(w | clear)
    touching = np.unique(lab[clear])
    touching = touching[touching > 0]
    return np.isin(lab, touching) & w


def clean(a):
    a = a.copy()
    region = leftover(a)
    # 稍微擴張，連同白色區塊外緣的灰白過渡一起處理
    grow = ndimage.binary_dilation(region, iterations=2)
    rgb = a[..., :3].astype(float)
    light = rgb.min(-1)
    # 擴張帶內：越白越透明（避免留下白色光暈）
    edge = grow & ~region
    fade = np.clip((light - 150) / 80, 0, 1)
    alpha = a[..., 3].astype(float)
    alpha[region] = 0
    alpha[edge] = alpha[edge] * (1 - fade[edge])
    # 整體邊緣再柔化一點
    soft = ndimage.gaussian_filter(alpha, 0.6)
    alpha = np.where(alpha > 0, np.minimum(alpha, soft * 1.15), 0)
    a[..., 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return a


def export(name, im):
    im.save(ROOT / 'images' / f'{name}.png')
    bbox = im.getbbox()
    sp = im.crop(bbox)
    w = 460
    sp.resize((w, round(sp.height * w / sp.width)), Image.LANCZOS).save(ROOT / 'assets' / 'sprites' / f'{name}.webp', 'WEBP', quality=82, method=6)
    w = 320
    im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(ROOT / 'assets' / 'portraits' / f'{name}.webp', 'WEBP', quality=80, method=6)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else '檢查'
    if cmd == '檢查':
        for f in sorted((ROOT / 'assets' / 'sprites').glob('*.webp')):
            name = f.stem
            a = np.array(Image.open(ROOT / 'images' / f'{name}.png').convert('RGBA'))
            opaque = (a[..., 3] > 0).sum()
            ratio = leftover(a).sum() / max(1, opaque)
            print(f'{name:14s} 白色殘留 {ratio * 100:5.1f}%' + ('  ← 需要修正' if ratio > 0.03 else ''))
    else:
        for name in sys.argv[2:]:
            src = ROOT / 'images' / f'{name}.png'
            a = np.array(Image.open(src).convert('RGBA'))
            before = leftover(a).sum()
            out = clean(a)
            export(name, Image.fromarray(out))
            print(f'✓ {name}：清掉 {before} 個白色殘留像素')
