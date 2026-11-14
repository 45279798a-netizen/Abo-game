#!/usr/bin/env python3
"""整理 00GameDevs 匯出的特效檔，合併成遊戲用的特效庫 js/vfx/library.js。

每個匯出檔 = 授權文字 + 使用說明 + 共用程式（約 570KB，每個檔都一樣）+ 該特效的設定（很小）。
這支工具只保留一份共用程式，把每個特效的設定另外存起來，最後合併成一個檔案。

用法：
    python3 tools/build_vfx.py 匯出檔1.txt 匯出檔2.js ...   # 加入／更新特效，並重新產生特效庫
    python3 tools/build_vfx.py                              # 只用已存的特效重新產生特效庫
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'vfx-src'               # 保存：授權文字、共用程式、各特效設定
PRESETS = SRC / 'presets'
OUT = ROOT / 'js' / 'vfx' / 'library.js'
IMPORT_LINE = 'import * as THREE from "three";'


def split_export(text):
    lic_end = text.index('*/') + 2
    i_imp = text.index(IMPORT_LINE)
    i_pre = text.index('const preset = ')
    license_text = text[:lic_end]
    notes = text[lic_end:i_imp].strip()
    runtime = text[i_imp + len(IMPORT_LINE):i_pre]
    tail = text[i_pre:]
    preset = json.loads(re.search(r'const preset = (\{.*?\n\});', tail, re.S).group(1))
    defaults = json.loads(re.search(r'export const defaultOptions = (\{.*?\n\});', tail, re.S).group(1))
    return license_text, notes, runtime, preset, defaults


def add_exports(paths):
    SRC.mkdir(exist_ok=True)
    PRESETS.mkdir(exist_ok=True)
    for p in paths:
        text = Path(p).read_text(encoding='utf-8')
        license_text, notes, runtime, preset, defaults = split_export(text)
        if 'The MIT License' not in license_text:
            print(f'⚠ {p}：授權不是 MIT，略過，請人工確認')
            continue
        rt_file = SRC / 'runtime.js'
        rt_hash = hashlib.md5(runtime.encode()).hexdigest()
        if not rt_file.exists():
            rt_file.write_text(runtime, encoding='utf-8')
            (SRC / 'LICENSE.txt').write_text(license_text, encoding='utf-8')
        elif hashlib.md5(rt_file.read_text(encoding='utf-8').encode()).hexdigest() != rt_hash:
            # 共用程式不同（網站更新過）：改用比較新的這份，舊特效設定通常相容
            print(f'⚠ {p}：共用程式和已存的不同，改用這份較新的版本')
            rt_file.write_text(runtime, encoding='utf-8')
            (SRC / 'LICENSE.txt').write_text(license_text, encoding='utf-8')
        entry = {'preset': preset, 'defaults': defaults, 'notes': notes}
        (PRESETS / f"{preset['id']}.json").write_text(json.dumps(entry, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f"✓ {preset['id']}　{preset['name']}（{preset.get('category')}）")


def build():
    runtime = (SRC / 'runtime.js').read_text(encoding='utf-8')
    license_text = (SRC / 'LICENSE.txt').read_text(encoding='utf-8')
    entries = [json.loads(f.read_text(encoding='utf-8')) for f in sorted(PRESETS.glob('*.json'))]
    presets = {e['preset']['id']: e['preset'] for e in entries}
    defaults = {e['preset']['id']: e['defaults'] for e in entries}
    notes = '\n'.join('\n'.join('// ' + line.lstrip('/ ').rstrip() for line in e['notes'].splitlines() if line.strip()) for e in entries)
    out = f"""{license_text}
// ═══════════════════════════════════════════════════════════════
// 特效庫：由 tools/build_vfx.py 自動產生，請勿手動修改。
// 共 {len(presets)} 種特效，共用同一份程式（原本每個匯出檔都各帶一份）。
// 用法：import {{create, PRESETS}} from './library.js'; const fx = create('fireball', {{speed: 2}});
// ═══════════════════════════════════════════════════════════════
// 各特效原始使用說明：
{notes}

{IMPORT_LINE}
{runtime}
export const PRESETS = {json.dumps(presets, ensure_ascii=False, indent=1)};
export const DEFAULTS = {json.dumps(defaults, ensure_ascii=False, indent=1)};
export function create(id, options = {{}}) {{
  const preset = PRESETS[id];
  if (!preset) throw new Error('沒有這個特效：' + id);
  return createEffect(preset, {{ ...DEFAULTS[id], ...options }});
}}
"""
    OUT.write_text(out, encoding='utf-8')
    print(f'→ {OUT.relative_to(ROOT)}：{len(presets)} 種特效，{len(out.encode()) // 1024} KB')


if __name__ == '__main__':
    add_exports(sys.argv[1:])
    build()
