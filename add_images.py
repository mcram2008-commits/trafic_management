import base64

js = '\n'
for name in ['garbage', 'tanker']:
    with open(f'tmp_{name}.png', 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
    js += f'const {name.upper()}_SRC = "data:image/png;base64,{b64}";\n'

with open('images.js', 'a') as f:
    f.write(js)
