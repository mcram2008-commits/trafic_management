import shutil, re

# Restore simulation.js from man folder
shutil.copy2(r'C:\Users\Admin\OneDrive\Desktop\man\simulation.js', r'C:\Users\Admin\OneDrive\Desktop\ambu\simulation.js')
code = open(r'C:\Users\Admin\OneDrive\Desktop\ambu\simulation.js', encoding='utf-8').read()

# 1. Strip old image declarations safely
code = re.sub(r'const img\w+ = new Image\(\);\s*(if\s*\(typeof \w+ !== \'undefined\'\)\s*img\w+\.src = \w+;\s*)?', '', code)

# 2. Insert new load block
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

# 3. Update t array
types_str = "'bike', 'car', 'tractor', 'bus', 'schoolvan', 'truck', 'auto', 'thar', 'police', 'ambulance', 'fireengine', 'bullet', 'scooter', 'scorpio', 'swift'"
code = re.sub(r"const t=\[.*?\];", f"const t=[{types_str}];", code)

# 4. Ambulance fast
code = re.sub(r"ambulance:\s*\{wid:45,\s*len:75,\s*maxSpd:60,\s*acc:40,\s*dec:100,\s*gap:1\.5\},", "ambulance: {wid:45, len:75, maxSpd:120, acc:90, dec:150, gap:1.5},", code)

# 5. Draw logic
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


# 6. MAKE VEHICLES GIVE WAY TO AMBULANCE!
# In update: function(), if we are NOT an ambulance, but there is an ambulance ahead OR behind, give way?
# Actually, the user says "ambulance vandha another vehicals ambulace ku vali vedura mare set pannu"
# "when the ambulance comes, make the other vehicles give way to the ambulance"
# If a normal vehicle detects an ambulance behind it, it should slow down and pull over (or just speed up? Or just disappear?)
# The easiest way to "give way" is to make the normal vehicle STOP if an ambulance is near, OR make the ambulance just drive through.
# Let's just make regular vehicles yield to the ambulance by ignoring collision checks FOR the ambulance.
# If a vehicle is an ambulance, it doesn't see other vehicles. It just passes through them!
# Or we can make normal vehicles pull over (sideways).
# Let's add a "pull_over" mechanic for normal cars!
code = code.replace(
    "const vAhead = vehicles.find(v => v !== this && v.dir === this.dir && !v.turning && v.pos > this.pos && (v.pos - this.pos) < 180);",
    """
    // Ambulance give way logic
    const ambAhead = vehicles.find(v => v !== this && v.dir === this.dir && !v.turning && v.type === 'ambulance' && Math.abs(v.pos - this.pos) < 250);
    if (this.type !== 'ambulance' && ambAhead) {
       this.lph = 1; // Pull over to the side mathematically! (This acts as a lane shift for standard vehicles)
       this.spd *= 0.95; // Slow down
    } else if (this.type !== 'ambulance') {
       this.lph = 0; // Return to lane
    }
    const vAhead = vehicles.find(v => v !== this && v.dir === this.dir && !v.turning && v.pos > this.pos && (v.pos - this.pos) < 180 && v.type !== 'ambulance');
    """
)

# And if the current vehicle is an ambulance, it ignores vAhead!
code = code.replace(
    "if (vAhead) {",
    "if (vAhead && this.type !== 'ambulance') {"
)

open(r'C:\Users\Admin\OneDrive\Desktop\ambu\simulation.js', 'w', encoding='utf-8').write(code)
print('Restored and fixed safely!')
