import sys
from PIL import Image

def process_target(filepath, outpath):
    img = Image.open(filepath).convert("RGBA")
    data = img.getdata()
    new_data = []
    
    # We want:
    # Target (originally whatever color the shapes are) -> White (255, 255, 255)
    # Background -> #080c12 (8, 12, 18) OR transparent
    # The user said: "the background matching the color as I gave you"
    
    # Let's assess the image first.
    # It seems to be mostly dark pixels (~20-30).
    # Those dark pixels are likely the background.
    # We will map dark pixels -> (8, 12, 18, 255) OR transparent.
    # Actually, the user asked for "background matching the color as I gave you", so (8, 12, 18).
    # And "the target white".
    
    # Let's map based on brightness. 
    # Current background is ~28. So brightness < 50 is background.
    # Everything else is the target -> make it white.
    
    for item in data:
        avg = sum(item[:3])/3
        if avg < 50:
            # Background
            new_data.append((8, 12, 18, 255))
        else:
            # Target
            new_data.append((255, 255, 255, 255))
            
    img.putdata(new_data)
    img.save(outpath, "PNG")
    print(f"Saved to {outpath}")

process_target("c:/Users/Usuario/Warx/xwar/public/assets/divisions/sniper.png", "c:/Users/Usuario/Warx/xwar/public/assets/divisions/sniper_processed.png")
