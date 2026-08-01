import os
import base64
from PIL import Image

artifacts_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022"
files = {
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
    
    # Auto rotate if width > height
    if img.width > img.height:
        img = img.rotate(90, expand=True)
        
    datas = img.getdata()
    
    newData = []
    for item in datas:
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

with open("images.js", "a") as f:
    f.write(output_js)

print("Done appending 5 new vehicles to images.js")
