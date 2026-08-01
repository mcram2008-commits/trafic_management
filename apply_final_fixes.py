import os, base64, re
from PIL import Image

# 1. Rotate bike 180 and scooter 90 (if not already done)
if os.path.exists('tmp_bike.png') and not os.path.exists('tmp_bike_rotated.png'):
    Image.open('tmp_bike.png').rotate(180, expand=True).save('tmp_bike_rotated.png')
if os.path.exists('tmp_scooter.png') and not os.path.exists('tmp_scooter_rotated.png'):
    Image.open('tmp_scooter.png').rotate(-90, expand=True).save('tmp_scooter_rotated.png')

# 2. Build images.js
files_map = {
    'bike': ('tmp_bike_rotated.png', 'VEH_SRC', 'imgBike'),
    'car': ('tmp_car.png', 'CAR_SRC', 'imgCar'),
    'tractor': ('tmp_tractor.png', 'TRACTOR_SRC', 'imgTractor'),
    'bus': ('tmp_bus.png', 'BUS_SRC', 'imgBus'),
    'schoolvan': ('tmp_schoolvan.png', 'SCHOOLVAN_SRC', 'imgSchoolVan'),
    'truck': ('tmp_truck.png', 'TRUCK_SRC', 'imgTruck'),
    'auto': ('tmp_auto.png', 'AUTO_SRC', 'imgAuto'),
    'thar': ('tmp_thar.png', 'THAR_SRC', 'imgThar'),
    'police': ('tmp_police.png', 'POLICE_SRC', 'imgPolice'),
    'ambulance': ('tmp_ambulance.png', 'AMB_SRC', 'imgAmbulance'),
    'fireengine': ('tmp_fireengine.png', 'FIREENGINE_SRC', 'imgFireEngine'),
    # 4 new
    'bullet': ('tmp_bullet.png', 'BULLET_SRC', 'imgBullet'),
    'scooter': ('tmp_scooter_rotated.png', 'SCOOTER_SRC', 'imgScooter'),
    'scorpio': ('tmp_scorpio.png', 'SCORPIO_SRC', 'imgScorpio'),
    'swift': ('tmp_swift.png', 'SWIFT_SRC', 'imgSwift')
}

images_js = ''
for type_name, (filename, varname, _) in files_map.items():
    if os.path.exists(filename):
        with open(filename, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('utf-8')
            images_js += f'const {varname} = "data:image/png;base64,{b64}";\n'

with open('images.js', 'w', encoding='utf-8') as f:
    f.write(images_js)

# 3. Update simulation.js
code = open('simulation.js', encoding='utf-8').read()

# Update t array
types_str = "'bike', 'car', 'tractor', 'bus', 'schoolvan', 'truck', 'auto', 'thar', 'police', 'ambulance', 'fireengine', 'bullet', 'scooter', 'scorpio', 'swift'"
code = re.sub(r"const t=\[.*?\];", f"const t=[{types_str}];", code)

# Ambulance fast
code = re.sub(r"ambulance: \{wid:45, len:75, maxSpd:60, acc:40, dec:100, gap:1\.5\},", "ambulance: {wid:45, len:75, maxSpd:120, acc:90, dec:150, gap:1.5},", code)

# Add load block
load_block = ''
for _, (_, varname, imgname) in files_map.items():
    load_block += f"const {imgname} = new Image();\nif(typeof {varname} !== 'undefined') {imgname}.src = {varname};\n"
code = re.sub(r"const imgCar = new Image\(\);.*?if\(typeof imgFireEngine !== 'undefined'\)?.*?FIREENGINE_SRC;\n?", load_block, code, flags=re.DOTALL)
# A safer replacement since regex might fail if I changed it earlier
code = re.sub(r"const imgCar = new Image\(\);.*?(?=let isGARunning)", load_block + "\n", code, flags=re.DOTALL)


# Add drawing logic
draw_logic = '''
    let img = null;
    if (this.type === 'car') img = imgCar;
    else if (this.type === 'bike') img = imgBike;
    else if (this.type === 'tractor') img = imgTractor;
    else if (this.type === 'bus') img = imgBus;
    else if (this.type === 'schoolvan') img = imgSchoolVan;
    else if (this.type === 'truck') img = imgTruck;
    else if (this.type === 'auto') img = imgAuto;
    else if (this.type === 'thar') img = imgThar;
    else if (this.type === 'police') img = imgPolice;
    else if (this.type === 'ambulance') img = imgAmbulance;
    else if (this.type === 'fireengine') img = imgFireEngine;
    else if (this.type === 'bullet') img = imgBullet;
    else if (this.type === 'scooter') img = imgScooter;
    else if (this.type === 'scorpio') img = imgScorpio;
    else if (this.type === 'swift') img = imgSwift;
'''
code = re.sub(r"let img = null;.*?else if \(this\.type === 'fireengine'\) img = imgFireEngine;", draw_logic.strip(), code, flags=re.DOTALL)

open('simulation.js', 'w', encoding='utf-8').write(code)
print('Done!')
