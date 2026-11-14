"""產生橫式戰場用的高解析立繪：assets/sprites_hd/*.webp

用法：python3 tools/make_sprites.py            全部重做
      python3 tools/make_sprites.py h_arthur   只做指定角色

來源是 images/*.png（去背原圖）。只處理 assets/sprites/ 裡已有的角色。
做法：裁掉透明邊 → 縮到寬 SIZE → 透明區塗上最近的角色顏色（避免縮圖、貼圖過濾時邊緣出現白邊或黑邊）。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SIZE = 960
OUT = ROOT / 'assets' / 'sprites_hd'


def bleed(a):
    """把透明像素的 RGB 換成最近的不透明像素顏色（alpha 不變）。"""
    solid = a[..., 3] > 8
    if solid.all() or not solid.any():
        return a
    _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    out = a.copy()
    out[..., :3] = a[iy, ix, :3]
    return out


def make(name):
    im = Image.open(ROOT / 'images' / f'{name}.png').convert('RGBA')
    im = im.crop(im.getbbox())
    a = bleed(np.array(im))
    im = Image.fromarray(a)
    w = min(SIZE, im.width)
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    a = bleed(np.array(im))
    OUT.mkdir(exist_ok=True)
    dst = OUT / f'{name}.webp'
    Image.fromarray(a).save(dst, 'WEBP', quality=88, method=6, exact=True)
    return dst


if __name__ == '__main__':
    names = sys.argv[1:] or [f.stem for f in sorted((ROOT / 'assets' / 'sprites').glob('*.webp'))]
    total = 0
    for n in names:
        d = make(n)
        kb = d.stat().st_size // 1024
        total += kb
        print(f'{n:14s} {Image.open(d).size}  {kb} KB')
    print(f'合計 {total} KB')
