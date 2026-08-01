import os
import base64
from PIL import Image

artifacts_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022"
files = {
    "car": ("indian_car_topdown_1783178560228.png", 0),
    "auto": ("indian_auto_topdown_1783178579341.png", 0),
    "bus": ("indian_bus_topdown_1783178596995.png", 90), # Rotate 90 CCW to point UP
    "truck": ("indian_truck_topdown_1783178609304.png", 90), # Rotate 90 CCW
    "amb": ("indian_ambulance_topdown_1783178620784.png", 0),
    "bike": ("indian_bike_topdown_1783179131544.png", 0),
    "shareauto": ("indian_shareauto_topdown_1783179141663.png", 0)
}

output_js = ""

for name, (filename, rot) in files.items():
    filepath = os.path.join(artifacts_dir, filename)
    if not os.path.exists(filepath):
        print(f"Skipping {filename}")
        continue
    
    img = Image.open(filepath).convert("RGBA")
    
    if rot != 0:
        img = img.rotate(rot, expand=True)
        
    datas = img.getdata()
    
    newData = []
    for item in datas:
        # Check if green
        r, g, b, a = item
        if g > 150 and r < 150 and b < 150:
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

with open("images.js", "w") as f:
    f.write(output_js)

print("Done")
