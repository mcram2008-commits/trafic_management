import os
import base64
import re
from PIL import Image

def remove_green(img, threshold=40):
    pixels = img.load()
    width, height = img.size
    
    # Target green shadow color (often yellowish green or pure green)
    # We will remove pixels that are strongly green dominant and low saturation
    for x in range(width):
        for y in range(height):
            r, g, b, a = pixels[x, y]
            if a > 0:
                # If green is significantly higher than both red and blue, it's green
                if g > r + 15 and g > b + 15:
                    pixels[x, y] = (0, 0, 0, 0)
                # If it's a dark shadow, we could also remove it, but let's stick to green
                elif g > 60 and r < g and b < g:
                    # Soft green
                    pixels[x, y] = (0, 0, 0, 0)

with open("images.js", "r", encoding="utf-8") as f:
    js_content = f.read()

match = re.search(r"const TRACTOR_SRC = 'data:image/[a-zA-Z]*;base64,([^']+)';", js_content)
if match:
    b64_data = match.group(1)
    img_data = base64.b64decode(b64_data)
    
    with open("temp_tractor.png", "wb") as f:
        f.write(img_data)
        
    img = Image.open("temp_tractor.png").convert("RGBA")
    
    # aggressive background removal
    remove_green(img)
    
    img.save("temp_tractor.png", "PNG")
    
    with open("temp_tractor.png", "rb") as f:
        new_b64 = base64.b64encode(f.read()).decode('utf-8')
        
    new_src = f"data:image/png;base64,{new_b64}"
    
    js_content = js_content.replace(match.group(0), f"const TRACTOR_SRC = '{new_src}';")
    
    with open("images.js", "w", encoding="utf-8") as f:
        f.write(js_content)
        
    print("Fixed Tractor green patch!")
    os.remove("temp_tractor.png")
else:
    print("TRACTOR_SRC not found!")
