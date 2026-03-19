import os
import sys
from PIL import Image

def remove_bg(in_path, out_path, tolerance=25):
    try:
        img = Image.open(in_path).convert('RGBA')
        data = img.getdata()
        
        new_data = []
        for item in data:
            # Check if pixel is dark (close to black background)
            # R, G, B, A
            if item[0] < tolerance and item[1] < tolerance and item[2] < tolerance:
                new_data.append((255, 255, 255, 0)) # Transparent
            else:
                new_data.append(item)
                
        img.putdata(new_data)
        
        # Then auto-crop to content
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        # Resize to game icon standard size
        img.thumbnail((128, 128), Image.Resampling.BICUBIC)
        img.save(out_path, 'PNG')
        print(f'Successfully processed {out_path}')
    except Exception as e:
        print(f'Error processing {in_path}: {e}', file=sys.stderr)

if __name__ == '__main__':
    in_dir = sys.argv[1]
    out_dir = sys.argv[2]
    
    os.makedirs(out_dir, exist_ok=True)
    
    files = os.listdir(in_dir)
    bread_file = next((f for f in files if f.startswith('bread_icon_') and f.endswith('.png')), None)
    sushi_file = next((f for f in files if f.startswith('sushi_icon_') and f.endswith('.png')), None)
    wagyu_file = next((f for f in files if f.startswith('wagyu_icon_') and f.endswith('.png')), None)
    
    if bread_file: remove_bg(os.path.join(in_dir, bread_file), os.path.join(out_dir, 'bread.png'))
    if sushi_file: remove_bg(os.path.join(in_dir, sushi_file), os.path.join(out_dir, 'sushi.png'))
    if wagyu_file: remove_bg(os.path.join(in_dir, wagyu_file), os.path.join(out_dir, 'wagyu.png'))
