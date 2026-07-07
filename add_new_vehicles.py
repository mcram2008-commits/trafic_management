import os
import base64
from PIL import Image, ImageDraw

artifacts_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022"

files = {
    "autorickshaw": "auto_rickshaw_1783233264818.png",
    "scorpio": "scorpio_suv_1783233281473.png"
}

output_js = ""

for name, filename in files.items():
    filepath = os.path.join(artifacts_dir, filename)
    if not os.path.exists(filepath):
        print(f"Skipping {filename}")
        continue
    
    img = Image.open(filepath).convert("RGBA")
    
    datas = img.getdata()
    newData = []
    
    for item in datas:
        r, g, b, a = item
        # If it's very bright (white-ish)
        if r > 240 and g > 240 and b > 240:
            newData.append((255, 255, 255, 0))
        # If it's very green (green screen)
        elif g > 150 and r < 150 and b < 150:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    
    if img.width > img.height:
        img = img.rotate(-90, expand=True)
            
    img.thumbnail((300, 300))
    
    out_path = f"tmp_{name}.png"
    img.save(out_path, "PNG")
    
    with open(out_path, "rb") as f:
        b64_str = base64.b64encode(f.read()).decode("utf-8")
        
    output_js += f"const {name.upper()}_SRC = 'data:image/png;base64,{b64_str}';\n\n"
    print(f"Processed {name}")

with open("images.js", "a") as f:
    f.write("\n" + output_js)

print("Done appending new vehicles to images.js!")
