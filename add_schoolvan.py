import os
import base64
from PIL import Image

image_path = r"C:\Users\Admin\.gemini\antigravity\brain\f75b7e13-6572-4aaf-9959-4ef7c9110022\indian_school_van_1783228396494.png"
images_js_path = r"c:\Users\Admin\OneDrive\Desktop\man\images.js"

# Remove green background and make transparent
img = Image.open(image_path).convert("RGBA")
datas = img.getdata()
newData = []
for item in datas:
    if item[0] < 50 and item[1] > 200 and item[2] < 50:
        newData.append((255, 255, 255, 0))
    else:
        newData.append(item)
img.putdata(newData)

# Rotate to point up if it's horizontal
if img.width > img.height:
    img = img.rotate(-90, expand=True)

# Save temp and convert to base64
tmp_path = "temp_schoolvan.png"
img.save(tmp_path, "PNG")

with open(tmp_path, "rb") as f:
    b64_str = base64.b64encode(f.read()).decode('utf-8')

# Append to images.js
js_content = ""
with open(images_js_path, "r") as f:
    js_content = f.read()

new_js = f"const SCHOOLVAN_SRC = 'data:image/png;base64,{b64_str}';\n" + js_content

with open(images_js_path, "w") as f:
    f.write(new_js)

os.remove(tmp_path)
print("Added school van to images.js")
