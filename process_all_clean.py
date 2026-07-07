import os
import base64
from PIL import Image, ImageDraw

artifacts_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022"

files = {
    "police": "indian_police_car_1783229052060.png",
    "fireengine": "indian_fire_engine_1783229062050.png",
    "scooter": "delivery_scooter_1783229070527.png",
    "thar": "mahindra_thar_1783229079880.png",
    "tractor": "indian_tractor_1783229089221.png",
    "schoolvan": "indian_school_van_1783228396494.png",
    "tataace": "indian_tata_ace_1783180410139.png",
    "erickshaw": "indian_erickshaw_1783180420108.png",
    "bullet": "indian_bullet_1783180430553.png",
    "garbage": "indian_garbage_truck_1783180442363.png",
    "tanker": "indian_tanker_1783180451917.png",
    "autorickshaw": "auto_rickshaw_1783233264818.png",
    "scorpio": "scorpio_suv_1783233281473.png",
    "minitruck": "indian_mini_truck_1783233830387.png",
    "citybus": "indian_bus_sprite_1783233848681.png",
    "swift": "indian_swift_car_1783233867760.png",
    "ambulance": "indian_ambulance_1783233883651.png"
}

output_js = ""

for name, filename in files.items():
    filepath = os.path.join(artifacts_dir, filename)
    if not os.path.exists(filepath):
        print(f"Skipping {filename}")
        continue
    
    img = Image.open(filepath).convert("RGBA")
    
    # Do a flood fill from the corners to replace background with transparent
    # The backgrounds are typically white or green
    corners = [(0, 0), (img.width-1, 0), (0, img.height-1), (img.width-1, img.height-1)]
    for cx, cy in corners:
        pixel = img.getpixel((cx, cy))
        if (pixel[0] > 200 and pixel[1] > 200 and pixel[2] > 200) or (pixel[1] > 150 and pixel[0] < 150 and pixel[2] < 150):
            ImageDraw.floodfill(img, xy=(cx, cy), value=(255, 255, 255, 0), thresh=50)
    
    # Auto rotate if width > height
    if img.width > img.height:
        # Some are rotated differently based on my previous scripts
        if name in ["tataace", "erickshaw", "bullet", "garbage", "tanker"]:
            img = img.rotate(90, expand=True)
        else:
            img = img.rotate(-90, expand=True)
            
    img.thumbnail((300, 300))
    
    out_path = f"tmp_{name}.png"
    img.save(out_path, "PNG")
    
    with open(out_path, "rb") as f:
        b64_str = base64.b64encode(f.read()).decode("utf-8")
        
    output_js += f"const {name.upper()}_SRC = 'data:image/png;base64,{b64_str}';\n\n"
    print(f"Processed {name}")

# We append or rewrite images.js
with open("images.js", "r", encoding="utf-8") as f:
    js_content = f.read()

import re
for name in files.keys():
    js_content = re.sub(f"const {name.upper()}_SRC = '.*?';\\n\\n?", "", js_content, flags=re.DOTALL)
    
js_content += "\n" + output_js

with open("images.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("Done generating 16 clean vehicles with floodfill background removal!")
