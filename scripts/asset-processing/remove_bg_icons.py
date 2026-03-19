"""
Remove backgrounds from tab icons and save them to the game's public/assets/ directory.
"""
from PIL import Image
import os
from collections import Counter

BRAIN_DIR = r"C:\Users\Usuario\.gemini\antigravity\brain\a6ebbc1a-b143-4af1-92e7-cd2f4b979ed9"
OUTPUT_DIR = r"C:\Users\Usuario\Warx\xwar\public\assets"

ICONS = {
    "tab_profile_1773877758415.png": "tab_profile.png",
    "tab_inventory_1773877771607.png": "tab_inventory.png",
    "tab_skills_1773877783579.png": "tab_skills.png",
    "tab_companies_1773877796451.png": "tab_companies.png",
    "tab_account_1773877810102.png": "tab_account.png",
}

os.makedirs(OUTPUT_DIR, exist_ok=True)

for src_name, dst_name in ICONS.items():
    src_path = os.path.join(BRAIN_DIR, src_name)
    dst_path = os.path.join(OUTPUT_DIR, dst_name)
    
    img = Image.open(src_path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    
    corner_samples = []
    for x, y in [(0,0), (1,0), (0,1), (w-1,0), (w-1,h-1), (0,h-1), (w-2,0), (0,h-2)]:
        corner_samples.append(pixels[x, y][:3])
    
    bg_color = Counter(corner_samples).most_common(1)[0][0]
    bg_r, bg_g, bg_b = bg_color
    
    print(f"Processing {src_name} -> {dst_name}")
    print(f"  BG color: RGB({bg_r}, {bg_g}, {bg_b}), Size: {w}x{h}")
    
    tolerance = 60
    removed = 0
    for yp in range(h):
        for xp in range(w):
            r, g, b, a = pixels[xp, yp]
            dist = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
            if dist < tolerance:
                pixels[xp, yp] = (0, 0, 0, 0)
                removed += 1
    
    print(f"  Removed {removed}/{w*h} bg pixels")
    
    img = img.resize((64, 64), Image.LANCZOS)
    img.save(dst_path, "PNG")
    print(f"  Saved -> {dst_path}")

print("\nDone!")
