import os
import base64
from PIL import Image, ImageDraw
import re

artifacts_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022"

files = {
    "splendor": [f for f in os.listdir(artifacts_dir) if f.startswith("splendor_bike") and f.endswith(".png")][0],
    "ktm": [f for f in os.listdir(artifacts_dir) if f.startswith("ktm_bike") and f.endswith(".png")][0],
    "suprobus": [f for f in os.listdir(artifacts_dir) if f.startswith("supro_bus") and f.endswith(".png")][0],
    "bajajauto": [f for f in os.listdir(artifacts_dir) if f.startswith("bajaj_auto") and f.endswith(".png")][0],
    "bluerickshaw": [f for f in os.listdir(artifacts_dir) if f.startswith("blue_erickshaw") and f.endswith(".png")][0]
}

def flood_fill_transparency(img, start_pos, threshold=40):
    width, height = img.size
    pixels = img.load()
    
    start_color = pixels[start_pos]
    if start_color[3] == 0:
        return
    
    visited = set()
    stack = [start_pos]
    
    def color_distance(c1, c2):
        return sum(abs(a - b) for a, b in zip(c1[:3], c2[:3]))
    
    while stack:
        x, y = stack.pop()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        
        current_color = pixels[x, y]
        if current_color[3] == 0:
            continue
            
        if color_distance(current_color, start_color) <= threshold:
            pixels[x, y] = (0, 0, 0, 0)
            
            for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    if (nx, ny) not in visited:
                        stack.append((nx, ny))

def crop_transparent(img):
    bbox = img.getbbox()
    if bbox:
        return img.crop(bbox)
    return img

processed_data = {}

for name, filename in files.items():
    print(f"Processing {name}...")
    filepath = os.path.join(artifacts_dir, filename)
    img = Image.open(filepath).convert("RGBA")
    
    w, h = img.size
    corners = [(0, 0), (w-1, 0), (0, h-1), (w-1, h-1)]
    for corner in corners:
        flood_fill_transparency(img, corner, threshold=60)
        
    img = crop_transparent(img)
    
    # Save back to a temporary file
    temp_path = f"temp_{name}.png"
    img.save(temp_path, "PNG")
    
    with open(temp_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
        processed_data[name] = f"data:image/png;base64,{b64}"
    os.remove(temp_path)

print("Updating images.js...")
with open("images.js", "r", encoding="utf-8") as f:
    js_content = f.read()

# Add new vehicle sources
additions = f"""
const SPLENDOR_SRC = '{processed_data['splendor']}';
const KTM_SRC = '{processed_data['ktm']}';
const SUPROBUS_SRC = '{processed_data['suprobus']}';
const BAJAJAUTO_SRC = '{processed_data['bajajauto']}';
const BLUERICKSHAW_SRC = '{processed_data['bluerickshaw']}';
"""

# Insert additions at the beginning (after the first line or just before AMB_SRC)
js_content = js_content.replace("const AMB_SRC", additions + "\nconst AMB_SRC")

with open("images.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("Done processing custom vehicles!")
