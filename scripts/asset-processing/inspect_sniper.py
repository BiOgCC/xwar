import sys
from PIL import Image

img = Image.open('c:/Users/Usuario/Warx/xwar/public/assets/divisions/sniper.png').convert('RGBA')
w, h = img.size
print(f"Size: {w}x{h}")
colors = img.getcolors(maxcolors=100000)
if colors:
    colors.sort(key=lambda x: x[0], reverse=True)
    print("Top 10 colors:")
    for count, color in colors[:10]:
        print(f"  {count} pixels: {color}")
else:
    print("Too many colors")
