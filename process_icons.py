import sys
import os

try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def process_image(filepath):
    try:
        img = Image.open(filepath).convert("RGBA")
        data = img.getdata()
        new_data = []
        
        for item in data:
            avg = (item[0] + item[1] + item[2]) / 3
            if avg > 210:
                new_data.append((255, 255, 255, 0))
            else:
                alpha = max(0, min(255, int(255 - avg * 1.2)))
                new_data.append((226, 232, 240, alpha))
                
        img.putdata(new_data)
        img.save(filepath, "PNG")
        print(f"Successfully processed {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

icons = [
    "recon.png", "assault.png", "sniper.png", "rpg.png", 
    "jeep.png", "tank.png", "jet.png", "warship.png"
]

assets_dir = r"c:\Users\Usuario\Warx\xwar\public\assets\divisions"

import shutil
warship_src = r"C:\Users\Usuario\.gemini\antigravity\brain\6b73350b-3d8d-4434-92de-713964adf25e\warship_icon_1773762153252.png"
warship_dst = os.path.join(assets_dir, "warship.png")
try:
    shutil.copyfile(warship_src, warship_dst)
    print("Copied warship icon.")
except Exception as e:
    print("Could not copy warship icon:", e)

for icon in icons:
    path = os.path.join(assets_dir, icon)
    process_image(path)
