import os
import base64
from PIL import Image

images = [
    ("POLICE", r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022\indian_police_car_1783229052060.png"),
    ("FIREENGINE", r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022\indian_fire_engine_1783229062050.png"),
    ("SCOOTER", r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022\delivery_scooter_1783229070527.png"),
    ("THAR", r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022\mahindra_thar_1783229079880.png"),
    ("TRACTOR", r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022\indian_tractor_1783229089221.png")
]

images_js_path = r"c:\Users\Admin\OneDrive\Desktop\man\images.js"

output_js = ""

for name, path in images:
    if not os.path.exists(path):
        print(f"Skipping {name}, not found.")
        continue
    
    img = Image.open(path).convert("RGBA")
    datas = img.getdata()
    newData = []
    # Replace #00FF00 green background with transparent
    for item in datas:
        if item[0] < 50 and item[1] > 200 and item[2] < 50:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
    img.putdata(newData)
    
    # Ensure vertical orientation
    if img.width > img.height:
        img = img.rotate(-90, expand=True)
    
    # Resize to standardize
    img.thumbnail((300, 300))
        
    tmp_path = f"temp_{name}.png"
    img.save(tmp_path, "PNG")
    
    with open(tmp_path, "rb") as f:
        b64_str = base64.b64encode(f.read()).decode('utf-8')
        
    output_js += f"const {name}_SRC = 'data:image/png;base64,{b64_str}';\n\n"
    os.remove(tmp_path)
    print(f"Processed {name}")

# Append to images.js
js_content = ""
with open(images_js_path, "r") as f:
    js_content = f.read()

new_js = output_js + js_content

with open(images_js_path, "w") as f:
    f.write(new_js)

print("Added 5 new vehicles to images.js")
