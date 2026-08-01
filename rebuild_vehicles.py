import os
import base64
import re

files_map = {
    'bike': ('tmp_bike.png', 'VEH_SRC', 'imgBike'),
    'car': ('tmp_car.png', 'CAR_SRC', 'imgCar'),
    'tractor': ('tmp_tractor.png', 'TRACTOR_SRC', 'imgTractor'),
    'bus': ('tmp_bus.png', 'BUS_SRC', 'imgBus'),
    'schoolvan': ('tmp_schoolvan.png', 'SCHOOLVAN_SRC', 'imgSchoolVan'),
    'truck': ('tmp_truck.png', 'TRUCK_SRC', 'imgTruck'),
    'auto': ('tmp_auto.png', 'AUTO_SRC', 'imgAuto'), # Or maybe tmp_autorickshaw.png if auto fails
    'thar': ('tmp_thar.png', 'THAR_SRC', 'imgThar'),
    'police': ('tmp_police.png', 'POLICE_SRC', 'imgPolice'),
    'ambulance': ('tmp_ambulance.png', 'AMB_SRC', 'imgAmbulance'),
    'fireengine': ('tmp_fireengine.png', 'FIREENGINE_SRC', 'imgFireEngine')
}

# If tmp_auto doesn't exist but autorickshaw does
if not os.path.exists('tmp_auto.png') and os.path.exists('tmp_autorickshaw.png'):
    files_map['auto'] = ('tmp_autorickshaw.png', 'AUTO_SRC', 'imgAuto')

images_js = ""
for type_name, (filename, varname, _) in files_map.items():
    if os.path.exists(filename):
        with open(filename, "rb") as f:
            b64 = base64.b64encode(f.read()).decode('utf-8')
            images_js += f"const {varname} = 'data:image/png;base64,{b64}';\n"
    else:
        print(f"Warning: {filename} not found!")

# Fallback for others to avoid undefined errors
images_js += """
const SUPROBUS_SRC = '';
const SPLENDOR_SRC = '';
const KTM_SRC = '';
const BAJAJAUTO_SRC = '';
const BLUERICKSHAW_SRC = '';
"""

with open('images.js', 'w', encoding='utf-8') as f:
    f.write(images_js)

# Update simulation.js
with open('simulation.js', 'r', encoding='utf-8') as f:
    sim_js = f.read()

# 1. Update const t to only have the requested 11 vehicles
sim_js = re.sub(
    r"const t=\[.*?\];",
    "const t=['bike', 'car', 'tractor', 'bus', 'schoolvan', 'truck', 'auto', 'thar', 'police', 'ambulance', 'fireengine'];",
    sim_js
)

# 2. Update drawVehicle
# Instead of replacing, just add an early return or make sure the mapping is correct.
# Actually, the mapping already exists:
# else if (this.type === 'schoolvan') img = imgSchoolVan;
# else if (this.type === 'auto') img = imgAuto;
# etc.
# But let's make sure the images are loaded correctly.
# In simulation.js, they are loaded like:
# const imgCar = new Image(); if(typeof CAR_SRC !== 'undefined') imgCar.src = CAR_SRC;
# Let's just make sure all of them are loaded.
load_block = ""
for _, (_, varname, imgname) in files_map.items():
    load_block += f"const {imgname} = new Image();\nif(typeof {varname} !== 'undefined') {imgname}.src = {varname};\n"

sim_js = re.sub(
    r"const imgCar = new Image\(\);.*?const imgBluerickshaw = new Image\(\);(\r?\nif\(typeof BLUERICKSHAW_SRC !== 'undefined'\) imgBluerickshaw.src = BLUERICKSHAW_SRC;)?",
    load_block,
    sim_js,
    flags=re.DOTALL
)

with open('simulation.js', 'w', encoding='utf-8') as f:
    f.write(sim_js)

print("Rebuilt vehicles successfully.")
