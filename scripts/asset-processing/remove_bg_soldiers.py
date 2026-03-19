"""
Remove GREEN SCREEN backgrounds, crop stages to wide strips, brighten, and copy to public/assets/.
"""
from PIL import Image, ImageEnhance
import os

BRAIN_DIR = r"C:\Users\Usuario\.gemini\antigravity\brain\5fe60c8d-bffa-43af-95a2-ae4813500ce7"
OUTPUT_DIR = r"C:\Users\Usuario\Warx\xwar\public\assets"
STAGES_DIR = os.path.join(OUTPUT_DIR, "stages")

FILES = {
    # Soldiers
    "soldier_blue_greenscreen_1773880006830.png": ("soldier_blue.png", OUTPUT_DIR, "soldier"),
    "soldier_red_greenscreen_1773880022873.png": ("soldier_red.png", OUTPUT_DIR, "soldier"),
    # Stage backgrounds
    "stage_us_1773880517680.png": ("bg_US.png", STAGES_DIR, "stage"),
    "stage_ru_1773880533108.png": ("bg_RU.png", STAGES_DIR, "stage"),
}

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(STAGES_DIR, exist_ok=True)

for src_name, (dst_name, dst_dir, kind) in FILES.items():
    src_path = os.path.join(BRAIN_DIR, src_name)
    dst_path = os.path.join(dst_dir, dst_name)
    
    if not os.path.exists(src_path):
        print(f"  SKIP: {src_name} not found")
        continue
    
    img = Image.open(src_path).convert("RGBA")
    w, h = img.size
    print(f"Processing {src_name} -> {dst_name} ({w}x{h})")
    
    if kind == "stage":
        # CROP: take a wide horizontal strip from the middle-bottom area
        # This gives us the ground/street level with landmarks in background
        # Target aspect ratio: ~4:1 (wide and short)
        strip_height = h // 3  # take bottom third
        crop_top = h - strip_height - (h // 10)  # slightly above bottom
        crop_bottom = h - (h // 10)
        img = img.crop((0, crop_top, w, crop_bottom))
        print(f"  Cropped to {img.size[0]}x{img.size[1]}")
        
        # BRIGHTEN the stage image for contrast with dark soldiers
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(1.5)  # 50% brighter
        
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.2)  # slightly more contrast
        
        enhancer = ImageEnhance.Color(img)
        img = enhancer.enhance(1.3)  # more vibrant
        
        # Resize to a nice wide strip: 800x200
        img = img.resize((800, 200), Image.LANCZOS)
        print(f"  Resized to 800x200, brightened")
    else:
        # Soldiers: chroma-key green removal
        pixels = img.load()
        removed = 0
        for yp in range(h):
            for xp in range(w):
                r, g, b, a = pixels[xp, yp]
                if g > 100 and g > r + 40 and g > b + 40:
                    pixels[xp, yp] = (0, 0, 0, 0)
                    removed += 1
                elif g > 150 and r > 150 and b > 150:
                    greenness = g - (r + b) / 2
                    if greenness > 10:
                        pixels[xp, yp] = (0, 0, 0, 0)
                        removed += 1
        print(f"  Removed {removed}/{w*h} green pixels")
        img = img.resize((256, 256), Image.LANCZOS)
    
    img.save(dst_path, "PNG")
    print(f"  Saved -> {dst_path}")

print("\nDone!")
