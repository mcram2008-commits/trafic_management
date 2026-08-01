import re

with open("simulation.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update the Vehicle types array to include the new ones
old_array = "const t=['car','car','suv','suv','truck','truck','truck','bus','bus','bus','van','tataace','garbage','tanker','schoolvan','schoolvan','police','fireengine','thar','tractor','autorickshaw','autorickshaw','scorpio','scorpio'];"
new_array = "const t=['swift','swift','scorpio','suv','truck','truck','minitruck','minitruck','citybus','citybus','van','tataace','garbage','tanker','schoolvan','police','fireengine','thar','tractor','autorickshaw','autorickshaw','ambulance'];"
if old_array in code:
    code = code.replace(old_array, new_array)
else:
    print("Warning: old_array not found!")

# 2. Add to VSPEC
vspec_addition = """  minitruck: {wid:50, len:75, maxSpd:65, acc:40, dec:100, gap:1.6},
  citybus:   {wid:70, len:120, maxSpd:55, acc:25, dec:75, gap:1.9},
  swift:     {wid:48, len:60, maxSpd:90, acc:70, dec:130, gap:1.4},
  ambulance: {wid:55, len:85, maxSpd:100, acc:80, dec:150, gap:1.5},"""
code = code.replace("  scorpio:   {wid:55, len:70, maxSpd:85, acc:60, dec:120, gap:1.5},", "  scorpio:   {wid:55, len:70, maxSpd:85, acc:60, dec:120, gap:1.5},\n" + vspec_addition)

# 3. Add to VCOL
vcol_addition = """  minitruck: ['#ffffff'],
  citybus:   ['#ffffff'],
  swift:     ['#ffffff'],
  ambulance: ['#ffffff'],"""
code = code.replace("  scorpio:   ['#ffffff'],", "  scorpio:   ['#ffffff'],\n" + vcol_addition)

# 4. Add Image objects
img_additions = """
const imgMinitruck = new Image();
if(typeof MINITRUCK_SRC !== 'undefined') imgMinitruck.src = MINITRUCK_SRC;

const imgCitybus = new Image();
if(typeof CITYBUS_SRC !== 'undefined') imgCitybus.src = CITYBUS_SRC;

const imgSwift = new Image();
if(typeof SWIFT_SRC !== 'undefined') imgSwift.src = SWIFT_SRC;

const imgAmbulanceNew = new Image();
if(typeof AMBULANCE_SRC !== 'undefined') imgAmbulanceNew.src = AMBULANCE_SRC;
"""
code = code.replace("const imgScorpio = new Image();", img_additions + "\nconst imgScorpio = new Image();")

# 5. Add to draw logic
draw_additions = """    else if (this.type === 'minitruck') img = imgMinitruck;
    else if (this.type === 'citybus') img = imgCitybus;
    else if (this.type === 'swift') img = imgSwift;
    else if (this.type === 'ambulance') img = imgAmbulanceNew;"""
code = code.replace("    else if (this.type === 'scorpio') img = imgScorpio;", "    else if (this.type === 'scorpio') img = imgScorpio;\n" + draw_additions)


with open("simulation.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Updated simulation.js with 4 new vehicles!")
