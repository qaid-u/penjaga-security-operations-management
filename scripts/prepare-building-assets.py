"""Publish the reviewed exterior GLBs and small browser preview assets.

Run with Python + Pillow. --check verifies GLB copies without rewriting files.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
ASSETS = [
    ('DJM', 'artifacts/suk/Bangunan_SUK_Exterior.glb', 'public/models/Bangunan_SUK.glb', 'artifacts/suk/SUK_refined_preview.png', 'djm'),
    ('BDARA', 'artifacts/bdara/Bangunan_Dato_Abdul_Rahman_Andak.glb', 'public/models/library/bdara.glb', 'artifacts/bdara/BDARA_exterior_preview.png', 'bdara'),
    ('BDMSP', 'artifacts/bdmsp/Bangunan_Dato_Mohamad_Salleh_Perang.glb', 'public/models/library/bdmsp.glb', 'artifacts/bdmsp/BDMSP_exterior_preview.png', 'bdmsp'),
    ('BSI_KOTA_ISKANDAR', 'artifacts/bsi/Bangunan_Sultan_Ismail_Kota_Iskandar.glb', 'public/models/library/bsi-kota-iskandar.glb', 'artifacts/bsi/BSI_exterior_preview.png', 'bsi-kota-iskandar'),
    ('RUMAH_SS_VIP', 'artifacts/rumah_ss_vip/Rumah_SS_VIP_Shared_Exterior.glb', 'public/models/library/rumah-ss-vip.glb', 'artifacts/rumah_ss_vip/Rumah_SS_VIP_exterior_preview.png', 'rumah-ss-vip'),
    ('UTC_JOHOR', 'artifacts/utc/UTC_Johor_Exterior.glb', 'public/models/library/utc-johor.glb', 'artifacts/utc/UTC_exterior_preview.png', 'utc-johor'),
]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if '--check' in sys.argv:
    for _, source, target, _, _ in ASSETS:
        assert digest(ROOT / source) == digest(ROOT / target), target
    print('All six public GLBs match their reviewed Blender exports.')
else:
    from PIL import Image
    previews = ROOT / 'public/models/library/previews'
    previews.mkdir(parents=True, exist_ok=True)
    records = []
    for model_id, source, target, preview, slug in ASSETS:
        src, dst = ROOT / source, ROOT / target
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        with Image.open(ROOT / preview) as image:
            image = image.convert('RGB')
            image.thumbnail((960, 800), Image.Resampling.LANCZOS)
            image.save(previews / f'{slug}.webp', 'WEBP', quality=84, method=6)
        records.append({'model_id': model_id, 'source': source, 'public_file': target,
                        'bytes': dst.stat().st_size, 'sha256': digest(dst),
                        'preview': f'public/models/library/previews/{slug}.webp'})
    (ROOT / 'public/models/library/manifest.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'models': len(records), 'glb_bytes': sum(r['bytes'] for r in records),
                      'preview_bytes': sum(p.stat().st_size for p in previews.glob('*.webp'))}))
