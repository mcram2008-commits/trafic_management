import os

with open("simulation.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update vehicle array
old_array = "const t=['swift','swift','scorpio','suv','truck','truck','minitruck','minitruck','citybus','citybus','van','tataace','garbage','tanker','schoolvan','police','fireengine','thar','tractor','autorickshaw','autorickshaw','ambulance'];"
new_array = "const t=['swift','swift','scorpio','suv','truck','truck','van','tataace','garbage','tanker','schoolvan','police','fireengine','thar','tractor','autorickshaw','ambulance','splendor','splendor','ktm','ktm','suprobus','suprobus','bajajauto','bluerickshaw'];"
code = code.replace(old_array, new_array)

# 2. Update VSPEC
vspec_old = """  minitruck: {wid:50, len:75, maxSpd:65, acc:40, dec:100, gap:1.6},
  citybus:   {wid:70, len:120, maxSpd:55, acc:25, dec:75, gap:1.9},
  swift:     {wid:48, len:60, maxSpd:90, acc:70, dec:130, gap:1.4},
  ambulance: {wid:55, len:85, maxSpd:100, acc:80, dec:150, gap:1.5},"""
vspec_new = """  swift:     {wid:48, len:60, maxSpd:90, acc:70, dec:130, gap:1.4},
  ambulance: {wid:55, len:85, maxSpd:100, acc:80, dec:150, gap:1.5},
  splendor:  {wid:25, len:50, maxSpd:75, acc:60, dec:120, gap:1.2},
  ktm:       {wid:28, len:52, maxSpd:95, acc:90, dec:150, gap:1.2},
  suprobus:  {wid:52, len:90, maxSpd:65, acc:40, dec:90, gap:1.6},
  bajajauto: {wid:42, len:55, maxSpd:50, acc:35, dec:80, gap:1.4},
  bluerickshaw:{wid:40, len:52, maxSpd:40, acc:30, dec:70, gap:1.3},"""
code = code.replace(vspec_old, vspec_new)

# 3. Update VCOL
vcol_old = """  minitruck: ['#ffffff'],
  citybus:   ['#ffffff'],
  swift:     ['#ffffff'],
  ambulance: ['#ffffff'],"""
vcol_new = """  swift:     ['#ffffff'],
  ambulance: ['#ffffff'],
  splendor:  ['#ffffff'],
  ktm:       ['#ffffff'],
  suprobus:  ['#ffffff'],
  bajajauto: ['#ffffff'],
  bluerickshaw: ['#ffffff'],"""
code = code.replace(vcol_old, vcol_new)

# 4. Image variables
img_old = """const imgMinitruck = new Image();
if(typeof MINITRUCK_SRC !== 'undefined') imgMinitruck.src = MINITRUCK_SRC;

const imgCitybus = new Image();
if(typeof CITYBUS_SRC !== 'undefined') imgCitybus.src = CITYBUS_SRC;"""
img_new = """const imgSplendor = new Image();
if(typeof SPLENDOR_SRC !== 'undefined') imgSplendor.src = SPLENDOR_SRC;

const imgKtm = new Image();
if(typeof KTM_SRC !== 'undefined') imgKtm.src = KTM_SRC;

const imgSuprobus = new Image();
if(typeof SUPROBUS_SRC !== 'undefined') imgSuprobus.src = SUPROBUS_SRC;

const imgBajajauto = new Image();
if(typeof BAJAJAUTO_SRC !== 'undefined') imgBajajauto.src = BAJAJAUTO_SRC;

const imgBluerickshaw = new Image();
if(typeof BLUERICKSHAW_SRC !== 'undefined') imgBluerickshaw.src = BLUERICKSHAW_SRC;"""
code = code.replace(img_old, img_new)

# 5. Draw logic
draw_old = """    else if (this.type === 'minitruck') img = imgMinitruck;
    else if (this.type === 'citybus') img = imgCitybus;"""
draw_new = """    else if (this.type === 'splendor') img = imgSplendor;
    else if (this.type === 'ktm') img = imgKtm;
    else if (this.type === 'suprobus') img = imgSuprobus;
    else if (this.type === 'bajajauto') img = imgBajajauto;
    else if (this.type === 'bluerickshaw') img = imgBluerickshaw;"""
code = code.replace(draw_old, draw_new)

# 6. Ambulance spawn logic fix in triggerAmbulance()
amb_spawn_old = "AMB.pos = Math.max(0, r.stopDist - 300);"
amb_spawn_new = "AMB.pos = Math.max(0, r.stopDist - (activeRoadCount === 5 ? 200 : 300));"
code = code.replace(amb_spawn_old, amb_spawn_new)

# 7. Tighter turn logic in 5-road intersection
# Replace hw * 2.0 with hw * 1.5 in both AMB and Vehicle
code = code.replace("this.turnTotalDist = Math.max((a2 - a1) * (hw * 2.0), hw * 2.6);", "this.turnTotalDist = Math.max((a2 - a1) * (hw * 1.5), hw * 1.8);")
# Also in Vehicle.xy
code = code.replace("const R_mid = hw * 0.8;", "const R_mid = hw * 0.45; // Tighter turn for 5-road map")

# 8. Ambulance cut/wait logic
amb_update_old = """    this.spd=Math.min(100,this.spd+60*dt);
    this.pos+=this.spd*dt;
    if(this.pos>r.exitDist)this.active=false;"""

amb_update_new = """    let desiredSpd = 100;
    
    // Check for vehicles ahead
    const ahead = all.filter(v => v.id !== this.id && v.dir === this.dir && !v.completedTurn && v.pos > this.pos && (v.pos - this.pos) < 120).sort((a,b) => a.pos - b.pos)[0];
    
    if (ahead) {
      const gap = ahead.pos - this.pos;
      if (gap < 80) {
        desiredSpd = Math.min(100, ahead.spd + 10); // Match speed + slightly faster to push
        // Cut around effect (visual shift)
        this.lph = Math.min(10, this.lph + 30 * dt); 
      } else {
        this.lph = Math.max(0, this.lph - 30 * dt);
      }
    } else {
      this.lph = Math.max(0, this.lph - 30 * dt);
    }
    
    this.spd = this.spd < desiredSpd ? Math.min(desiredSpd, this.spd + 60 * dt) : Math.max(desiredSpd, this.spd - 80 * dt);
    this.pos += this.spd * dt;
    if(this.pos > r.exitDist) this.active = false;"""

code = code.replace(amb_update_old, amb_update_new)

# Wait, AMB doesn't have `this.lph` in draw logic? Let's inject lateral shift in AMB.xy if lph exists.
amb_xy_old = """    if (this.completedTurn) {
      this.currentAngle = Math.atan2(pExit.dy, pExit.dx) + Math.PI/2;
      return {x: pExit.x + pExit.dx * this.exitPos, y: pExit.y + pExit.dy * this.exitPos};
    }"""
amb_xy_new = """    if (this.completedTurn) {
      this.currentAngle = Math.atan2(pExit.dy, pExit.dx) + Math.PI/2;
      return {x: pExit.x + pExit.dx * this.exitPos - pExit.dy * this.lph, y: pExit.y + pExit.dy * this.exitPos + pExit.dx * this.lph};
    }"""
code = code.replace(amb_xy_old, amb_xy_new)

# Also apply lateral shift to straight segment
amb_xy_straight = "return {x: r.spawnX + r.dx * this.pos, y: r.spawnY + r.dy * this.pos};"
amb_xy_straight_new = "return {x: r.spawnX + r.dx * this.pos - r.dy * this.lph, y: r.spawnY + r.dy * this.pos + r.dx * this.lph};"
code = code.replace(amb_xy_straight, amb_xy_straight_new)

with open("simulation.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Updated simulation.js!")
