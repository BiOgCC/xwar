"""
Process avatar images: remove green backgrounds and copy to public/assets/avatars/
"""
from PIL import Image
import os

BRAIN_DIR = r"C:\Users\Usuario\.gemini\antigravity\brain\5fe60c8d-bffa-43af-95a2-ae4813500ce7"
OUTPUT_DIR = r"C:\Users\Usuario\Warx\xwar\public\assets\avatars"

FILES = {
    # Portrait avatars (256x256)
    "avatar_male_military_1773883343794.png": ("avatar_male.png", 256),
    "avatar_female_military_1773883359630.png": ("avatar_female.png", 256),
    # Full-body characters (keep tall, resize to 512px height)
    "fullbody_male_soldier_1773884147686.png": ("fullbody_male.png", 512),
    "fullbody_female_soldier_1773884161410.png": ("fullbody_female.png", 512),
}

os.makedirs(OUTPUT_DIR, exist_ok=True)

for src_name, (dst_name, target_size) in FILES.items():
    src_path = os.path.join(BRAIN_DIR, src_name)
    dst_path = os.path.join(OUTPUT_DIR, dst_name)
    
    if not os.path.exists(src_path):
        print(f"  SKIP: {src_name} not found")
        continue
    
    img = Image.open(src_path).convert("RGBA")
    w, h = img.size
    print(f"Processing {src_name} ({w}x{h})")
    
    # Chroma-key green removal
    pixels = img.load()
    removed = 0
    for yp in range(h):
        for xp in range(w):
            r, g, b, a = pixels[xp, yp]
            # Strong green removal
            if g > 100 and g > r + 30 and g > b + 30:
                pixels[xp, yp] = (0, 0, 0, 0)
                removed += 1
            # Light green / bright green fringe
            elif g > 180 and r < 200 and b < 200 and g > (r + b) / 2 + 15:
                pixels[xp, yp] = (0, 0, 0, 0)
                removed += 1
    
    print(f"  Removed {removed}/{w*h} green pixels ({100*removed//(w*h)}%)")
    
    # Resize: portraits to square, fullbody keep aspect ratio
    if "fullbody" in dst_name:
        ratio = target_size / h
        new_w = int(w * ratio)
        img = img.resize((new_w, target_size), Image.LANCZOS)
    else:
        img = img.resize((target_size, target_size), Image.LANCZOS)
    
    img.save(dst_path, "PNG")
    print(f"  Saved -> {dst_path} ({img.size[0]}x{img.size[1]})")

print("\nDone! All avatars saved to public/assets/avatars/")
