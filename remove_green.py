"""
Remove green chroma key background from tab icons
and save them as transparent PNGs to public/assets/icons/
"""
from PIL import Image
import os
import glob

BRAIN_DIR = r'C:\Users\Usuario\.gemini\antigravity\brain\3b280b97-ce32-48a0-a147-9ee1dc8f459d'
OUTPUT_DIR = r'c:\Users\Usuario\Warx\xwar\public\assets\icons'

FILES = {
    # Market panel tabs
    'icon_market': 'market.png',
    'icon_gear': 'gear.png',
    'icon_divs': 'divs.png',
    'icon_orders': 'orders.png',
    'icon_history': 'history.png',
    # Profile panel tabs
    'icon_profile': 'profile.png',
    'icon_inventory': 'inventory.png',
    'icon_skills': 'skills.png',
    'icon_companies': 'companies.png',
    'icon_account': 'account.png',
}

os.makedirs(OUTPUT_DIR, exist_ok=True)

GREEN_THRESHOLD = 80

for prefix, out_name in FILES.items():
    matches = glob.glob(os.path.join(BRAIN_DIR, f'{prefix}_*.png'))
    if not matches:
        print(f'  SKIP {prefix} — not found')
        continue
    
    src = matches[0]
    img = Image.open(src).convert('RGBA')
    pixels = img.load()
    w, h = img.size
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if g > 100 and g > r + GREEN_THRESHOLD and g > b + GREEN_THRESHOLD:
                pixels[x, y] = (r, g, b, 0)
    
    out_path = os.path.join(OUTPUT_DIR, out_name)
    img.save(out_path)
    print(f'  ✓ {out_name} ({w}x{h})')

print(f'\nDone! {len(FILES)} icons saved to {OUTPUT_DIR}')
