import re

with open("simulation.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update the Vehicle types array
old_array = "const t=['car','car','suv','suv','truck','truck','truck','bus','bus','bus','van','auto','auto','bike','bike','tataace','erickshaw','bullet','garbage','tanker','schoolvan','schoolvan','police','fireengine','scooter','thar','tractor'];"
new_array = "const t=['car','car','suv','suv','truck','truck','truck','bus','bus','bus','van','tataace','garbage','tanker','schoolvan','schoolvan','police','fireengine','thar','tractor','autorickshaw','autorickshaw','scorpio','scorpio'];"
code = code.replace(old_array, new_array)

# 2. Add to VSPEC
vspec_addition = """  autorickshaw: {wid:45, len:55, maxSpd:72, acc:64, dec:138, gap:1.3},
  scorpio:   {wid:55, len:70, maxSpd:85, acc:60, dec:120, gap:1.5},"""
code = code.replace("  tractor:   {wid:60, len:80, maxSpd:40, acc:15, dec:50,  gap:1.6}", "  tractor:   {wid:60, len:80, maxSpd:40, acc:15, dec:50,  gap:1.6},\n" + vspec_addition)

# 3. Add to VCOL
vcol_addition = """  autorickshaw: ['#ffd700'],
  scorpio:   ['#ffffff'],"""
code = code.replace("  tractor:   ['#dd1111']", "  tractor:   ['#dd1111'],\n" + vcol_addition)

# 4. Add Image objects
img_additions = """const imgAutorickshaw = new Image();
if(typeof AUTORICKSHAW_SRC !== 'undefined') imgAutorickshaw.src = AUTORICKSHAW_SRC;

const imgScorpio = new Image();
if(typeof SCORPIO_SRC !== 'undefined') imgScorpio.src = SCORPIO_SRC;
"""
code = code.replace("const imgCar = new Image();", img_additions + "\nconst imgCar = new Image();")

# 5. Add to draw logic
draw_additions = """    else if (this.type === 'autorickshaw') img = imgAutorickshaw;
    else if (this.type === 'scorpio') img = imgScorpio;"""
code = code.replace("    else if (this.type === 'car') img = imgCar;", "    else if (this.type === 'car') img = imgCar;\n" + draw_additions)

with open("simulation.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Updated simulation.js")
