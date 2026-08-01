import os
import base64
from PIL import Image
import rembg
import re

artifacts_dir = r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022"

user_files = [
    "media__1783264067906.png",
    "media__1783264083785.jpg",
    "media__1783264104574.png",
    "media__1783264124407.png",
    "media__1783264138597.png"
]

vehicle_names = [
    "splendor",
    "ktm",
    "suprobus",
    "bajajauto",
    "bluerickshaw"
]

processed_data = {}

for f_name, v_name in zip(user_files, vehicle_names):
    print(f"Processing {v_name} from {f_name}...")
    img_path = os.path.join(artifacts_dir, f_name)
    
    with open(img_path, "rb") as f:
        input_data = f.read()
    
    # Remove background
    output_data = rembg.remove(input_data)
    
    # Load with PIL to crop and rotate
    temp_path = f"temp_user_{v_name}.png"
    with open(temp_path, "wb") as f:
        f.write(output_data)
        
    img = Image.open(temp_path).convert("RGBA")
    
    # Crop to bounding box
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    # Check orientation (we want height >= width so it faces North)
    # The user complained "some image reverse la ireaku... vertical aa corect aa check panne"
    w, h = img.size
    if w > h:
        # Rotate 90 degrees to make it vertical
        img = img.rotate(90, expand=True)
        # Re-crop just in case
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
    img.save(temp_path, "PNG")
    
    # Base64 encode
    with open(temp_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
        processed_data[v_name] = f"data:image/png;base64,{b64}"
        
    os.remove(temp_path)

print("Updating images.js...")
with open("images.js", "r", encoding="utf-8") as f:
    js_content = f.read()

# Replace existing custom sources in images.js
js_content = re.sub(r"const SPLENDOR_SRC = '[^']+';", f"const SPLENDOR_SRC = '{processed_data['splendor']}';", js_content)
js_content = re.sub(r"const KTM_SRC = '[^']+';", f"const KTM_SRC = '{processed_data['ktm']}';", js_content)
js_content = re.sub(r"const SUPROBUS_SRC = '[^']+';", f"const SUPROBUS_SRC = '{processed_data['suprobus']}';", js_content)
js_content = re.sub(r"const BAJAJAUTO_SRC = '[^']+';", f"const BAJAJAUTO_SRC = '{processed_data['bajajauto']}';", js_content)
js_content = re.sub(r"const BLUERICKSHAW_SRC = '[^']+';", f"const BLUERICKSHAW_SRC = '{processed_data['bluerickshaw']}';", js_content)

with open("images.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("Finished processing user images!")
