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
    "tanker": "indian_tanker_1783180451917.png"
}

output_js = ""

for name, filename in files.items():
    filepath = os.path.join(artifacts_dir, filename)
    if not os.path.exists(filepath):
        print(f"Skipping {filename}")
        continue
    
    img = Image.open(filepath).convert("RGBA")
    
    # We remove white background by iterating over pixels directly
    # Some generated images have slightly off-white backgrounds
    datas = img.getdata()
    newData = []
    
    # Simple green-screen / white-screen removal
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
    
    # Auto rotate if width > height
    if img.width > img.height:
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

with open("images.js", "r") as f:
    js_content = f.read()

import re
for name in files.keys():
    js_content = re.sub(f"const {name.upper()}_SRC = '.*?';\\n\\n?", "", js_content, flags=re.DOTALL)
    
js_content += "\n" + output_js

with open("images.js", "w") as f:
    f.write(js_content)

print("Done updating images.js with transparent backgrounds!")
