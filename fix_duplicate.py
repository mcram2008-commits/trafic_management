import re

code = open(r'C:\Users\Admin\OneDrive\Desktop\ambu\simulation.js', encoding='utf-8').read()

# Remove all lines matching const imgXXX = new Image(); and if(typeof XXX_SRC !== 'undefined') imgXXX.src = XXX_SRC;
code = re.sub(r'const img\w+ = new Image\(\);\s*(if\s*\(typeof \w+ !== \'undefined\'\)\s*img\w+\.src = \w+;\s*)?', '', code)

# Insert the clean block
load_block = '''
const imgBike = new Image(); if(typeof VEH_SRC !== 'undefined') imgBike.src = VEH_SRC;
const imgCar = new Image(); if(typeof CAR_SRC !== 'undefined') imgCar.src = CAR_SRC;
const imgTractor = new Image(); if(typeof TRACTOR_SRC !== 'undefined') imgTractor.src = TRACTOR_SRC;
const imgBus = new Image(); if(typeof BUS_SRC !== 'undefined') imgBus.src = BUS_SRC;
const imgSchoolVan = new Image(); if(typeof SCHOOLVAN_SRC !== 'undefined') imgSchoolVan.src = SCHOOLVAN_SRC;
const imgTruck = new Image(); if(typeof TRUCK_SRC !== 'undefined') imgTruck.src = TRUCK_SRC;
const imgAuto = new Image(); if(typeof AUTO_SRC !== 'undefined') imgAuto.src = AUTO_SRC;
const imgThar = new Image(); if(typeof THAR_SRC !== 'undefined') imgThar.src = THAR_SRC;
const imgPolice = new Image(); if(typeof POLICE_SRC !== 'undefined') imgPolice.src = POLICE_SRC;
const imgAmbulance = new Image(); if(typeof AMB_SRC !== 'undefined') imgAmbulance.src = AMB_SRC;
const imgFireEngine = new Image(); if(typeof FIREENGINE_SRC !== 'undefined') imgFireEngine.src = FIREENGINE_SRC;
const imgBullet = new Image(); if(typeof BULLET_SRC !== 'undefined') imgBullet.src = BULLET_SRC;
const imgScooter = new Image(); if(typeof SCOOTER_SRC !== 'undefined') imgScooter.src = SCOOTER_SRC;
const imgScorpio = new Image(); if(typeof SCORPIO_SRC !== 'undefined') imgScorpio.src = SCORPIO_SRC;
const imgSwift = new Image(); if(typeof SWIFT_SRC !== 'undefined') imgSwift.src = SWIFT_SRC;
'''

code = code.replace("resize();window.addEventListener('resize',resize);", "resize();window.addEventListener('resize',resize);\n" + load_block)

open(r'C:\Users\Admin\OneDrive\Desktop\ambu\simulation.js', 'w', encoding='utf-8').write(code)
print('Fixed duplicate declarations')
