import os
import base64
from PIL import Image

artifacts_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022"
files = {
    "bus": "indian_bus_purple_1783180124614.png",
    "truck": "indian_truck_orange_1783180136615.png"
}

output_js = ""

for name, filename in files.items():
    filepath = os.path.join(artifacts_dir, filename)
    if not os.path.exists(filepath):
        print(f"Skipping {filename}")
        continue
    
    img = Image.open(filepath).convert("RGBA")
    
    # Auto rotate if width > height
    if img.width > img.height:
        img = img.rotate(90, expand=True)
        
    datas = img.getdata()
    
    newData = []
    for item in datas:
        # Check if green
        r, g, b, a = item
        if g > 130 and r < 150 and b < 150:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    
    out_path = f"tmp_{name}.png"
    img.save(out_path, "PNG")
    
    with open(out_path, "rb") as f:
        b64_str = base64.b64encode(f.read()).decode("utf-8")
        
    output_js += f"const {name.upper()}_SRC = 'data:image/png;base64,{b64_str}';\n\n"
    print(f"Processed {name}")

# Now we need to replace the BUS_SRC and TRUCK_SRC in images.js
with open("images.js", "r") as f:
    content = f.read()

import re
# Replace BUS_SRC
content = re.sub(r"const BUS_SRC = '.*?';", "", content, flags=re.DOTALL)
# Replace TRUCK_SRC
content = re.sub(r"const TRUCK_SRC = '.*?';", "", content, flags=re.DOTALL)

with open("images.js", "w") as f:
    f.write(content + "\n" + output_js)

print("Done updating images.js")
