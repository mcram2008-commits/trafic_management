import re
import base64
from PIL import Image, ImageDraw
import io

# Read images.js
with open("images.js", "r", encoding="utf-8") as f:
    js_content = f.read()

# Regex to find all base64 images
pattern = re.compile(r"const\s+([A-Z_]+)_SRC\s*=\s*'data:image/png;base64,([^']+)';")
matches = pattern.findall(js_content)

print(f"Found {len(matches)} images in images.js")

new_js_content = js_content

for name, b64_str in matches:
    print(f"Processing {name}...")
    try:
        img_data = base64.b64decode(b64_str)
        img = Image.open(io.BytesIO(img_data)).convert("RGBA")
        
        # We need to remove the solid background. 
        # Since some backgrounds might be slightly noisy, we use floodfill from corners
        # with a generous threshold.
        # Background is usually white or green.
        
        # Get colors at corners
        corners = [(0, 0), (img.width-1, 0), (0, img.height-1), (img.width-1, img.height-1)]
        for cx, cy in corners:
            pixel = img.getpixel((cx, cy))
            # If the corner is mostly white or mostly green
            # (r>200, g>200, b>200) or (g>150, r<100, b<100)
            if (pixel[0] > 200 and pixel[1] > 200 and pixel[2] > 200) or (pixel[1] > 150 and pixel[0] < 150 and pixel[2] < 150):
                ImageDraw.floodfill(img, xy=(cx, cy), value=(255, 255, 255, 0), thresh=50)

        # Save back
        out_buffer = io.BytesIO()
        img.save(out_buffer, format="PNG")
        new_b64_str = base64.b64encode(out_buffer.getvalue()).decode("utf-8")
        
        # Replace in js_content
        old_str = f"const {name}_SRC = 'data:image/png;base64,{b64_str}';"
        new_str = f"const {name}_SRC = 'data:image/png;base64,{new_b64_str}';"
        new_js_content = new_js_content.replace(old_str, new_str)
        
    except Exception as e:
        print(f"Error processing {name}: {e}")

with open("images.js", "w", encoding="utf-8") as f:
    f.write(new_js_content)

print("Finished processing all images in images.js!")
