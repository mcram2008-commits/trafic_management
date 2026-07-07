import os
import base64
from PIL import Image
from rembg import remove

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
    
    with open(filepath, "rb") as f:
        input_data = f.read()
    
    # Use rembg to remove background
    output_data = remove(input_data)
    
    out_path = f"tmp_{name}.png"
    with open(out_path, "wb") as f:
        f.write(output_data)
        
    img = Image.open(out_path).convert("RGBA")
    
    # Auto rotate if width > height
    if img.width > img.height:
        img = img.rotate(90 if name in ["tataace", "erickshaw", "bullet", "garbage", "tanker"] else -90, expand=True)
        
    img.thumbnail((300, 300))
    img.save(out_path, "PNG")
    
    with open(out_path, "rb") as f:
        b64_str = base64.b64encode(f.read()).decode("utf-8")
        
    output_js += f"const {name.upper()}_SRC = 'data:image/png;base64,{b64_str}';\n\n"
    print(f"Processed {name}")

# Now we need to append this to images.js, BUT first we should remove the old definitions.
# Actually, since these are `const`, if they already exist, it will throw an error.
# The previous script appended them, so we need to CLEAN images.js first!

with open("images.js", "r") as f:
    js_content = f.read()

import re
# Remove existing definitions for these vehicles to avoid duplicates
for name in files.keys():
    js_content = re.sub(f"const {name.upper()}_SRC = '.*?';\\n\\n?", "", js_content, flags=re.DOTALL)
    
# Append new ones
js_content += "\n" + output_js

with open("images.js", "w") as f:
    f.write(js_content)

print("Done updating images.js with clean backgrounds!")
