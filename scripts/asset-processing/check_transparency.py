import sys
from PIL import Image

img = Image.open('c:/Users/Usuario/Warx/xwar/public/assets/divisions/sniper.png').convert('RGBA')
colors = img.getcolors(maxcolors=1000000)
transparent_count = 0
for count, color in colors:
    if color[3] == 0:
        transparent_count += count

print(f"Transparent pixels: {transparent_count} out of {img.width * img.height}")
