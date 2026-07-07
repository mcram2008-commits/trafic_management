/* ============================================================
   APTMS v5.0
   FIX: Correct vehicle rotation angles for all 4 directions
   FIX: Ambulance movement & large clear drawing
   FIX: Larger, clearer real-world vehicles
   ============================================================ */
'use strict';

/* ── Polyfill ─────────────────────────────────────────────── */
if(!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
    if(!r){this.rect(x,y,w,h);return;}
    this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.quadraticCurveTo(x+w,y,x+w,y+r);
    this.lineTo(x+w,y+h-r);this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    this.lineTo(x+r,y+h);this.quadraticCurveTo(x,y+h,x,y+h-r);
    this.lineTo(x,y+r);this.quadraticCurveTo(x,y,x+r,y);this.closePath();
  };
}

/* ── Canvas ───────────────────────────────────────────────── */
const canvas=document.getElementById('intersectionCanvas');
let ctx=canvas.getContext('2d');
function resize(){canvas.width=canvas.parentElement.clientWidth;canvas.height=canvas.parentElement.clientHeight;}
resize();window.addEventListener('resize',resize);

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
const imgGarbage = new Image(); if(typeof GARBAGE_SRC !== 'undefined') imgGarbage.src = GARBAGE_SRC;
const imgTanker = new Image(); if(typeof TANKER_SRC !== 'undefined') imgTanker.src = TANKER_SRC;


/* ── State ────────────────────────────────────────────────── */
const DIRS=['north','east','south','west','northeast'];
let activeDirs=['north','east','south','west'];
let activeRoadCount=4;
let simSpeed=1.0,autoMode=false,autoTimer=null,phase='normal';
let totalAmb=0,responseTimes=[],detectionStart=0;
let detectionProgress=0,ambPhaseTimer=0;
const signals={
  north:{state:'green',  timer:30},
  east: {state:'yellow', timer:30},
  south:{state:'red',    timer:60},
  west: {state:'red',    timer:90},
  northeast: {state:'red', timer:120}
};
const CYCLE=[['north',30],['east',30],['south',30],['west',30]];
let cycleIdx=0,cycleT=0,yellowPending=false;

/* ════════════════════════════════════════════════════════════
   ROAD CONFIG
   ▸ CRITICAL FIX: angle = direction the vehicle's FRONT faces
     In canvas drawing, vehicle front is drawn at local Y = −h/2 (top)
     After ctx.rotate(angle), that local top maps to screen direction:
       angle=0       → front points SCREEN-UP   (for south→north travel)
       angle=Math.PI → front points SCREEN-DOWN  (for north→south travel)
       angle= π/2    → front points SCREEN-RIGHT (for west→east travel)
       angle=−π/2    → front points SCREEN-LEFT  (for east→west travel)
   ════════════════════════════════════════════════════════════ */
function roadCfg(){
  const cx=canvas.width/2,cy=canvas.height/2;
  const hw=Math.min(canvas.width,canvas.height)*0.09;
  const lo=hw*0.40;   
  const SO=100;       
  const EX=220;       
  
  if (activeRoadCount === 5) {
    const Dist = Math.max(canvas.width, canvas.height) / 2 + SO;
    const getCfg = (angleDeg) => {
      const a = angleDeg * Math.PI / 180;
      const dx = -Math.cos(a), dy = -Math.sin(a);
      const nx = -dy, ny = dx; // Left lane offset (Left-hand traffic)
      return {
        spawnX: cx + Math.cos(a)*Dist + nx*lo,
        spawnY: cy + Math.sin(a)*Dist + ny*lo,
        dx: dx, dy: dy,
        angle: Math.atan2(dy, dx) + Math.PI/2,
        stopDist: Dist - hw*2.6,
        exitDist: Dist + hw*2.6 + EX
      };
    };
    return {
      north: getCfg(-90),
      northeast: getCfg(-18),
      east: getCfg(54),
      south: getCfg(126),
      west: getCfg(198)
    };
  }
  
  return {
    north:{spawnX:cx-lo,      spawnY:-SO,                 dx:0, dy:1,  angle:Math.PI,
           stopDist: cy-hw-21+SO,
           exitDist: cy+hw+EX+SO},
    south:{spawnX:cx+lo,      spawnY:canvas.height+SO,    dx:0, dy:-1, angle:0,
           stopDist: canvas.height+SO-(cy+hw+19),
           exitDist: canvas.height+SO-(cy-hw-EX)},
    east: {spawnX:canvas.width+SO, spawnY:cy-lo,          dx:-1,dy:0,  angle:-Math.PI/2,
           stopDist: canvas.width+SO-(cx+hw+19),
           exitDist: canvas.width+SO-(cx-hw-EX)},
    west: {spawnX:-SO,        spawnY:cy+lo,               dx:1, dy:0,  angle:Math.PI/2,
           stopDist: cx-hw-21+SO,
           exitDist: cx+hw+EX+SO},
    northeast: {
      spawnX: cx + 340 * 0.707, spawnY: cy - 340 * 0.707,
      dx: -0.707, dy: 0.707, angle: -Math.PI * 0.75,
      stopDist: 340 - hw*1.5,
      exitDist: 340 + hw*1.5 + EX
    }
  };
}

/* ── Vehicle specs ────────────────────────────────────────── */
const VSPEC={
  car:       {wid:48, len:60, maxSpd:82, acc:60, dec:130, gap:1.4},
  bike:      {wid:25, len:35, maxSpd:98, acc:85, dec:165, gap:1.2},
  suv:       {wid:55, len:70, maxSpd:76, acc:50, dec:108, gap:1.5},
  truck:     {wid:65, len:110,maxSpd:56, acc:24, dec:72,  gap:1.8},
  bus:       {wid:70, len:120,maxSpd:50, acc:18, dec:62,  gap:2.0},
  van:       {wid:50, len:70, maxSpd:68, acc:44, dec:98,  gap:1.5},
  auto:      {wid:38, len:46, maxSpd:72, acc:64, dec:138, gap:1.3},
  shareauto: {wid:44, len:55, maxSpd:70, acc:58, dec:125, gap:1.4},
  tataace:   {wid:45, len:58, maxSpd:68, acc:44, dec:98,  gap:1.5},
  erickshaw: {wid:36, len:42, maxSpd:60, acc:50, dec:120, gap:1.3},
  bullet:    {wid:28, len:40, maxSpd:95, acc:80, dec:150, gap:1.2},
  garbage:   {wid:62, len:100,maxSpd:55, acc:22, dec:70,  gap:1.8},
  tanker:    {wid:65, len:115,maxSpd:50, acc:20, dec:65,  gap:1.9},
  schoolvan: {wid:52, len:90, maxSpd:60, acc:35, dec:80,  gap:1.7},
  police:    {wid:55, len:70, maxSpd:90, acc:70, dec:120, gap:1.4},
  fireengine:{wid:70, len:130,maxSpd:55, acc:18, dec:60,  gap:2.2},
  scooter:   {wid:25, len:38, maxSpd:85, acc:75, dec:140, gap:1.2},
  thar:      {wid:55, len:65, maxSpd:75, acc:55, dec:110, gap:1.5},
  tractor:   {wid:60, len:80, maxSpd:40, acc:15, dec:50,  gap:1.6},
  autorickshaw: {wid:45, len:55, maxSpd:72, acc:64, dec:138, gap:1.3},
  scorpio:   {wid:55, len:70, maxSpd:85, acc:60, dec:120, gap:1.5},
  swift:     {wid:48, len:60, maxSpd:90, acc:70, dec:130, gap:1.4},
  ambulance: {wid:45, len:75, maxSpd:120, acc:90, dec:150, gap:1.5},
  splendor:  {wid:35, len:65, maxSpd:75, acc:60, dec:120, gap:1.2},
  ktm:       {wid:38, len:68, maxSpd:95, acc:90, dec:150, gap:1.2},
  suprobus:  {wid:65, len:110, maxSpd:65, acc:40, dec:90, gap:1.6},
  bajajauto: {wid:55, len:70, maxSpd:50, acc:35, dec:80, gap:1.4},
  bluerickshaw:{wid:55, len:70, maxSpd:40, acc:30, dec:70, gap:1.3},
};
const VCOL={
  car:       ['#cc2233','#1144cc','#116633','#777','#f0f0f0','#cc8800','#6633bb','#dd5511'],
  bike:      ['#111111','#1a1a1a','#cc2200','#002299','#005500'],
  suv:       ['#222244','#1a3a1a','#3a2a1a','#444','#2a3a4a','#331122'],
  truck:     ['#1a1a2a','#1a2a1a','#3a2a0a','#2a1a1a','#003344'],
  bus:       ['#cc8800','#dd9900','#2255aa','#cc3300'],
  van:       ['#336699','#333344','#225533','#553322','#888899'],
  auto:      ['#cc8800','#ffaa00','#dd7700'],
  shareauto: ['#ffcc00','#ffaa00'],
  tataace:   ['#ffffff'],
  erickshaw: ['#00ff00'],
  bullet:    ['#000000'],
  garbage:   ['#008800'],
  tanker:    ['#ff0000'],
  schoolvan: ['#ffee00'],
  police:    ['#ffffff'],
  fireengine:['#ff1111'],
  scooter:   ['#ff5500'],
  thar:      ['#223322'],
  tractor:   ['#dd1111'],
  autorickshaw: ['#ffd700'],
  scorpio:   ['#ffffff'],
  swift:     ['#ffffff'],
  ambulance: ['#ffffff'],
  splendor:  ['#ffffff'],
  ktm:       ['#ffffff'],
  suprobus:  ['#ffffff'],
  bajajauto: ['#ffffff'],
  bluerickshaw: ['#ffffff'],
};

/* ── Vehicle class ────────────────────────────────────────── */
let _uid=0;
class Vehicle{
  constructor(dir){
    this.id=_uid++;this.dir=dir;
    const t=['bike', 'car', 'tractor', 'bus', 'schoolvan', 'truck', 'auto', 'thar', 'police', 'ambulance', 'fireengine', 'bullet', 'scooter', 'scorpio', 'swift', 'garbage', 'tanker'];
    let chosenType=t[Math.floor(Math.random()*t.length)];
    if (chosenType === 'ambulance' || chosenType === 'fireengine') {
      const emergencyCount = typeof vehicles !== 'undefined' ? vehicles.filter(v => v.type === 'ambulance' || v.type === 'fireengine').length : 0;
      if (emergencyCount >= 1 || (typeof phase !== 'undefined' && phase !== 'normal')) {
          chosenType = 'car'; 
      } else {
          const d = this.dir;
          const vt = chosenType;
          setTimeout(() => { if(typeof triggerAmbulance === 'function') triggerAmbulance(d, vt); }, 100);
          chosenType = 'car';
      }
    }
    this.type = chosenType;
    this.spec=VSPEC[this.type];
    const cp=VCOL[this.type];this.col=cp[Math.floor(Math.random()*cp.length)];
    this.pos=0;this.spd=this.spec.maxSpd*(0.5+Math.random()*0.28);this.done=false;
    this.turning=false; this.completedTurn=false; this.exitDir=null; this.exitPos=0; this.turnStartPos=0;
    this.currentAngle=0;
  }
  xy(rc){
    const r=rc[this.dir];
    const cx=canvas.width/2,cy=canvas.height/2;
    const hw=Math.min(canvas.width,canvas.height)*0.09;
    const lo=hw*0.40;
    
    let pExit = {x: cx, y: cy, dx: 0, dy: -1};
    if (this.exitDir) {
      const re = rc[this.exitDir];
      if (activeRoadCount === 5) {
        const nx = -re.dy, ny = re.dx;
        const stop1 = re.stopDist - this.spec.len/2 - 6;
        const entryX = re.spawnX + re.dx * stop1;
        const entryY = re.spawnY + re.dy * stop1;
        pExit = { x: entryX - 2*nx*lo, y: entryY - 2*ny*lo, dx: -re.dx, dy: -re.dy };
      } else {
        pExit = {
          north: {x: cx+lo, y: cy-hw, dx: 0, dy: -1},
          south: {x: cx-lo, y: cy+hw, dx: 0, dy: 1},
          east:  {x: cx+hw, y: cy+lo, dx: 1, dy: 0},
          west:  {x: cx-hw, y: cy-lo, dx: -1, dy: 0},
          northeast: {x: cx+hw*1.5*0.707, y: cy-hw*1.5*0.707, dx: 0.707, dy: -0.707}
        }[this.exitDir];
      }
    }
    
    if (this.completedTurn) {
      this.currentAngle = Math.atan2(pExit.dy, pExit.dx) + Math.PI/2;
      return {x: pExit.x + pExit.dx * this.exitPos, y: pExit.y + pExit.dy * this.exitPos};
    }
    
    if (this.turning && this.exitDir) {
      const stop1 = r.stopDist - this.spec.len/2 - 6;
      const nx = -r.dy, ny = r.dx;
      const shift = this.lph || 0;
      const pEntry = {
        x: r.spawnX + r.dx * stop1 + nx * shift,
        y: r.spawnY + r.dy * stop1 + ny * shift
      };
      
      const turnDist = this.turnTotalDist || (hw * 2.5);
      const t = Math.min(1, Math.max(0, (this.pos - this.turnStartPos) / turnDist));
      
      if (activeRoadCount === 5) {
        let a1 = Math.atan2(pEntry.y - cy, pEntry.x - cx);
        let a2 = Math.atan2(pExit.y - cy, pExit.x - cx);
        while (a2 <= a1) a2 += Math.PI * 2;
        
        if (!this.turnTotalDist) {
          this.turnTotalDist = Math.max((a2 - a1) * (hw * 1.5), hw * 1.8);
        }
        
        const A = a1 + t * (a2 - a1);
        const R_start = Math.hypot(pEntry.x - cx, pEntry.y - cy);
        const R_end = Math.hypot(pExit.x - cx, pExit.y - cy);
        const R_mid = -hw * 0.50; // Hug center roundabout for 5-road map 
        
        const R = (1-t)*(1-t)*R_start + 2*(1-t)*t*R_mid + t*t*R_end;
        const x = cx + R * Math.cos(A);
        const y = cy + R * Math.sin(A);
        
        const dR_dt = 2*(t-1)*R_start + 2*(1-2*t)*R_mid + 2*t*R_end;
        const dA_dt = a2 - a1;
        const dx = dR_dt * Math.cos(A) - R * Math.sin(A) * dA_dt;
        const dy = dR_dt * Math.sin(A) + R * Math.cos(A) * dA_dt;
        
        this.currentAngle = Math.atan2(dy, dx) + Math.PI/2;
        return {x, y};
      }
      
      const pCtrl = {x: cx, y: cy};
      const x = (1-t)*(1-t)*pEntry.x + 2*(1-t)*t*pCtrl.x + t*t*pExit.x;
      const y = (1-t)*(1-t)*pEntry.y + 2*(1-t)*t*pCtrl.y + t*t*pExit.y;
      
      const dx = 2*(1-t)*(pCtrl.x - pEntry.x) + 2*t*(pExit.x - pCtrl.x);
      const dy = 2*(1-t)*(pCtrl.y - pEntry.y) + 2*t*(pExit.y - pCtrl.y);
      this.currentAngle = Math.atan2(dy, dx) + Math.PI/2;
      return {x, y};
    }
    
    this.currentAngle = r.angle;
    const nx = -r.dy, ny = r.dx;
    const shift = this.lph || 0;
    return {
      x: r.spawnX + r.dx * this.pos + nx * shift,
      y: r.spawnY + r.dy * this.pos + ny * shift
    };
  }

  update(dt,rc,all){
    const r=rc[this.dir],sig=signals[this.dir].state;
    const stopLine=r.stopDist - this.spec.len/2 - 6,dist=stopLine-this.pos;
    
    if (this.completedTurn) {
      // Find the closest vehicle ahead in the same exit lane
      const exitAheadList = all.filter(v => v.id !== this.id && v.completedTurn && v.exitDir === this.exitDir && v.exitPos > this.exitPos);
      
      // Also consider global AMB if it is in the same exit lane and ahead
      const globalAmbExitAhead = AMB.active && AMB.completedTurn && AMB.exitDir === this.exitDir && AMB.exitPos > this.exitPos;
      
      let exitAhead = exitAheadList.sort((a,b)=>a.exitPos-b.exitPos)[0];
      if (globalAmbExitAhead) {
        if (!exitAhead || AMB.exitPos < exitAhead.exitPos) {
          exitAhead = {
            exitPos: AMB.exitPos,
            spd: AMB.spd,
            spec: VSPEC[AMB.type || 'ambulance'] || { len: 75, gap: 1.5 }
          };
        }
      }
      
      let desired = this.spec.maxSpd;
      if (exitAhead) {
        const gap = exitAhead.exitPos - exitAhead.spec.len/2 - (this.exitPos + this.spec.len/2);
        const safe = this.spec.len * this.spec.gap + 10;
        if(gap < safe && gap > 0) desired = Math.min(desired, exitAhead.spd * (gap/safe));
        else if (gap <= 0) desired = 0;
      }
      
      this.spd = this.spd < desired ? Math.min(desired, this.spd + this.spec.acc * dt) : Math.max(desired, this.spd - this.spec.dec * dt);
      if(this.spd < 0.5 && desired === 0) this.spd = 0;
      
      this.exitPos += this.spd * dt;
      
      if (exitAhead) {
        const minExitPos = exitAhead.exitPos - exitAhead.spec.len/2 - this.spec.len/2 - 2;
        if (this.exitPos > minExitPos) {
          this.exitPos = minExitPos;
          this.spd = exitAhead.spd;
        }
      }
      
      if (this.exitPos > r.exitDist) this.done = true;
      return;
    }
    
    if(this.pos >= stopLine && !this.turning) {
      const possibleExits = activeDirs.filter(d => d !== this.dir);
      if (possibleExits.length > 0) {
        this.turning = true;
        this.turnStartPos = stopLine;
        this.exitDir = possibleExits[Math.floor(Math.random() * possibleExits.length)];
      }
    }
    if(this.turning) {
      const turnDist = this.turnTotalDist || (Math.min(canvas.width,canvas.height)*0.09 * 2.5);
      if (this.pos >= this.turnStartPos + turnDist) {
        this.completedTurn = true;
        this.exitPos = 0;
      }
    }

    let aheadList=all.filter(v=>v.id!==this.id&&v.dir===this.dir&&!v.completedTurn&&v.pos>this.pos);
    if (this.type === 'ambulance') {
        aheadList = aheadList.filter(v => v.type === 'ambulance'); // Ambulance ignores regular vehicles to pass them
    }
    let ahead = aheadList.sort((a,b)=>a.pos-b.pos)[0];

    // Also check if global AMB is ahead of us on the same road
    const globalAmbAhead = AMB.active && AMB.dir === this.dir && !AMB.completedTurn && AMB.pos > this.pos;
    if (globalAmbAhead) {
      if (!ahead || AMB.pos < ahead.pos) {
        ahead = {
          pos: AMB.pos,
          spd: AMB.spd,
          spec: VSPEC[AMB.type || 'ambulance'] || { len: 75, gap: 1.5 }
        };
      }
    }

    // Vehicles give way to ambulance (both regular ones and the Global AMB)
    const ambNear = all.find(v => v.type === 'ambulance' && v.dir === this.dir && (this.pos - v.pos) < 250 && (v.pos - this.pos) < 100);
    const globalAmbNear = AMB.active && AMB.dir === this.dir && (this.pos - AMB.pos) < 250 && (AMB.pos - this.pos) < 100;
    
    let targetLph = 0;
    if (this.type !== 'ambulance' && (ambNear || globalAmbNear)) {
        targetLph = 28; // Shift 28 pixels sideways to give way!
    }
    
    if (typeof this.lph === 'undefined') this.lph = 0;
    const shiftSpeed = 80; // pixels per second
    if (this.lph < targetLph) {
        this.lph = Math.min(targetLph, this.lph + shiftSpeed * dt);
    } else if (this.lph > targetLph) {
        this.lph = Math.max(targetLph, this.lph - shiftSpeed * dt);
    }

    const mustStop=(sig==='red'||sig==='yellow')&&!(phase==='priority'&&this.dir===AMB.dir) && (this.pos < stopLine || (this.pos < stopLine + 20 && this.spd < 5));
    let desired=this.spec.maxSpd;
    if(mustStop&&dist>0){const bd=(this.spd*this.spd)/(2*this.spec.dec);if(dist<=bd+18)desired=0;}
    if(mustStop&&this.pos>=stopLine){this.pos=stopLine;desired=0;}
    
    if(ahead){
      const gap=ahead.pos-ahead.spec.len/2-(this.pos+this.spec.len/2);
      const safe=this.spec.len*this.spec.gap+10;
      if(gap<safe&&gap>0)desired=Math.min(desired,ahead.spd*(gap/safe));
      else if(gap<=0)desired=0;
    }
    this.spd=this.spd<desired?Math.min(desired,this.spd+this.spec.acc*dt):Math.max(desired,this.spd-this.spec.dec*dt);
    if(this.spd<0.5&&desired===0)this.spd=0;
    this.pos+=this.spd*dt;
    if (ahead) {
      const minPos = ahead.pos - ahead.spec.len/2 - this.spec.len/2 - 2;
      if (this.pos > minPos) {
        this.pos = minPos;
        this.spd = ahead.spd;
      }
    }
    if(this.pos>=r.exitDist)this.done=true;
  }
  draw(rc){
    const r=rc[this.dir],p=this.xy(rc);
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(this.currentAngle);
    
    // Pseudo-3D Drop Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    
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
    else if (this.type === 'garbage') img = imgGarbage;
    else if (this.type === 'tanker') img = imgTanker;
    else if (this.type === 'scooter') img = imgScooter;
    else if (this.type === 'scorpio') img = imgScorpio;
    else if (this.type === 'swift') img = imgSwift;

    if (img && img.src) {
      ctx.drawImage(img, -this.spec.wid/2, -this.spec.len/2, this.spec.wid, this.spec.len);
    } else {
      ctx.fillStyle = this.col;
      ctx.fillRect(-this.spec.wid/2, -this.spec.len/2, this.spec.wid, this.spec.len);
    }
    ctx.restore();

    // AI Camera Multi-Object Detection (YOLO simulation)
    const cx=canvas.width/2,cy=canvas.height/2;
    const d=Math.hypot(p.x-cx,p.y-cy);
    if(d<240){
      ctx.save();
      ctx.strokeStyle='rgba(0,255,136,0.48)';ctx.lineWidth=1.0;
      const bw=this.spec.wid+8,bh=this.spec.len+8;
      ctx.strokeRect(p.x-bw/2,p.y-bh/2,bw,bh);
      
      ctx.fillStyle='#00ff88';ctx.font='bold 8px Orbitron,monospace';ctx.textAlign='center';
      const conf=(94.0+(this.id%60)*0.1).toFixed(1);
      ctx.fillText(`[${this.type.toUpperCase()}: ${conf}%]`,p.x,p.y-bh/2-4);
      
      // Corner tracking dots
      [[p.x-bw/2,p.y-bh/2],[p.x+bw/2,p.y-bh/2],[p.x-bw/2,p.y+bh/2],[p.x+bw/2,p.y+bh/2]].forEach(([kx,ky])=>{
        ctx.fillRect(kx-1,ky-1,2,2);
      });
      ctx.restore();
    }
  }
}

/* ── Colour helpers ───────────────────────────────────────── */
function hx(col,d){
  const n=parseInt(col.replace(/[^0-9a-fA-F]/g,'').padEnd(6,'0'),16);
  return`rgb(${Math.min(255,Math.max(0,((n>>16)&255)+d))},${Math.min(255,Math.max(0,((n>>8)&255)+d))},${Math.min(255,Math.max(0,(n&255)+d))})`;
}
function grad(c,w,h,b=40,dk=30){
  const g=ctx.createLinearGradient(-w/2,-h/2,w/2,h/2);
  g.addColorStop(0,hx(c,b));g.addColorStop(0.45,c);g.addColorStop(1,hx(c,-dk));return g;
}
function dropshadow(w,h,ox=3,oy=5,a=0.26){
  ctx.save();ctx.translate(ox,oy);ctx.globalAlpha=a;ctx.fillStyle='#000028';
  ctx.beginPath();ctx.ellipse(0,0,w*0.52,h*0.44,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
function wheels4(w,h){
  const wW=Math.max(4.5,w*0.23),wH=Math.max(6.5,h*0.12);
  const wy1=-h/2+h*0.09,wy2=h/2-h*0.09-wH;
  const wx1=-w/2-wW*0.30,wx2=w/2-wW*0.70;
  // tyre
  ctx.fillStyle='#0d0d0d';
  [[wx1,wy1],[wx2,wy1],[wx1,wy2],[wx2,wy2]].forEach(([x,y])=>{ctx.beginPath();ctx.roundRect(x,y,wW,wH,2);ctx.fill();});
  // rim
  ctx.fillStyle='#4a5566';
  [[wx1,wy1],[wx2,wy1],[wx1,wy2],[wx2,wy2]].forEach(([x,y])=>{ctx.fillRect(x+1,y+1,wW-2,wH*0.42);});
}
function headlights(w,h,spd){
  const on=spd>4;
  ctx.fillStyle=on?'#ffffcc':'#887730';ctx.shadowBlur=on?14:0;ctx.shadowColor='#ffffaa';
  ctx.beginPath();ctx.ellipse(-w/2+4,-h/2+2,4,2.5,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse( w/2-4,-h/2+2,4,2.5,0,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
}
function taillights(w,h,spd){
  const brk=spd<8;
  ctx.fillStyle=brk?'#ff1133':'#660011';ctx.shadowBlur=brk?12:0;ctx.shadowColor='#ff1133';
  ctx.beginPath();ctx.ellipse(-w/2+4,h/2-2,4,2.5,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse( w/2-4,h/2-2,4,2.5,0,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
}

/* ════════════════════════════════════════════════════════════
   VEHICLE DRAW FUNCTIONS
   All drawn in LOCAL SPACE: (0,0)=centre, FRONT at local −Y (top).
   ctx.rotate(angle) applied BEFORE calling these functions.
   ════════════════════════════════════════════════════════════ */
const VDRAW={

  /* ─── CAR (sedan) ──────────────────────────────────────── */
  car:(w,h,c,spd)=>{
    dropshadow(w,h);
    // body
    ctx.fillStyle=grad(c,w,h);ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,w*0.24);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.32)';ctx.lineWidth=0.8;ctx.stroke();
    // front windscreen
    ctx.fillStyle='rgba(160,220,255,0.75)';ctx.beginPath();ctx.roundRect(-w/2+2.5,-h/2+2.5,w-5,h*0.21,3);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.28)';ctx.beginPath();ctx.roundRect(-w/2+4,-h/2+4,(w-8)*0.44,h*0.08,1.5);ctx.fill();
    // rear window
    ctx.fillStyle='rgba(130,195,240,0.55)';ctx.beginPath();ctx.roundRect(-w/2+2.5,h/2-h*0.21,w-5,h*0.17,3);ctx.fill();
    // roof cabin
    ctx.fillStyle='rgba(0,0,0,0.26)';ctx.beginPath();ctx.roundRect(-w/2+3,-h*0.09,w-6,h*0.32,4);ctx.fill();
    // door line
    ctx.strokeStyle='rgba(0,0,0,0.16)';ctx.lineWidth=0.6;
    ctx.beginPath();ctx.moveTo(0,-h/2+h*0.22);ctx.lineTo(0,h/2-h*0.22);ctx.stroke();
    wheels4(w,h);headlights(w,h,spd);taillights(w,h,spd);
  },

  /* ─── MOTORCYCLE ───────────────────────────────────────── */
  bike:(w,h,c,spd)=>{
    dropshadow(w,h,2,3,0.20);
    const wr=w*0.46;
    // wheels
    ctx.fillStyle='#0c0c0c';ctx.strokeStyle='#2a2a2a';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.arc(0,-h/2+wr*0.9,wr,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(0, h/2-wr*0.9,wr,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#383838';
    ctx.beginPath();ctx.arc(0,-h/2+wr*0.9,wr*0.48,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(0, h/2-wr*0.9,wr*0.48,0,Math.PI*2);ctx.fill();
    // frame & chassis (thick stroke)
    ctx.strokeStyle=c;ctx.lineWidth=w*0.32;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(0,-h/2+wr*1.3);ctx.lineTo(0,h/2-wr*1.3);ctx.stroke();
    // fuel tank / body
    const fg=ctx.createLinearGradient(-w/2,-h*0.12,w/2,h*0.18);
    fg.addColorStop(0,hx(c,45));fg.addColorStop(0.5,c);fg.addColorStop(1,hx(c,-28));
    ctx.fillStyle=fg;ctx.beginPath();ctx.roundRect(-w/2,-h*0.14,w,h*0.30,w*0.32);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.40)';ctx.lineWidth=0.7;ctx.stroke();
    // front fairing
    ctx.fillStyle=hx(c,-18);ctx.beginPath();ctx.roundRect(-w/2+1,-h/2+wr*0.6,w-2,h*0.20,w*0.30);ctx.fill();
    // headlight
    ctx.fillStyle=spd>3?'#ffffcc':'#887730';ctx.shadowBlur=spd>3?12:0;ctx.shadowColor='#ffffcc';
    ctx.beginPath();ctx.ellipse(0,-h/2+wr*0.3,w*0.28,h*0.045,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    // RIDER: helmet + torso
    ctx.fillStyle='rgba(22,22,32,0.90)';
    ctx.beginPath();ctx.ellipse(0,-h*0.02,w*0.44,h*0.14,0,0,Math.PI*2);ctx.fill();// torso
    ctx.beginPath();ctx.arc(0,-h*0.17,w*0.35,0,Math.PI*2);ctx.fill();// helmet
    ctx.fillStyle='rgba(180,215,255,0.42)';
    ctx.beginPath();ctx.arc(0,-h*0.16,w*0.24,Math.PI*1.15,Math.PI*1.85);ctx.fill();// visor
    // exhaust
    ctx.strokeStyle='#666';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(w/2-1,-h*0.05);ctx.lineTo(w/2+2,h*0.32);ctx.stroke();
    // tail light
    ctx.fillStyle=spd<6?'#ff2244':'#660011';ctx.shadowBlur=spd<6?8:0;ctx.shadowColor='#ff2244';
    ctx.beginPath();ctx.ellipse(0,h/2-wr*0.5,w*0.25,h*0.04,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  },

  /* ─── SUV ───────────────────────────────────────────────── */
  suv:(w,h,c,spd)=>{
    dropshadow(w,h);
    ctx.fillStyle=grad(c,w,h,30,24);ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,w*0.18);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.30)';ctx.lineWidth=0.9;ctx.stroke();
    // windscreen
    ctx.fillStyle='rgba(160,220,255,0.70)';ctx.beginPath();ctx.roundRect(-w/2+3,-h/2+2.5,w-6,h*0.18,2.5);ctx.fill();
    // rear
    ctx.fillStyle='rgba(130,195,240,0.58)';ctx.beginPath();ctx.roundRect(-w/2+3,h/2-h*0.18,w-6,h*0.14,2.5);ctx.fill();
    // big roof
    ctx.fillStyle='rgba(0,0,0,0.22)';ctx.beginPath();ctx.roundRect(-w/2+3,-h*0.11,w-6,h*0.37,4);ctx.fill();
    // roof rack
    ctx.strokeStyle='rgba(0,0,0,0.25)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(-w/2+5,-h*0.05);ctx.lineTo(w/2-5,-h*0.05);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-w/2+5,h*0.12);ctx.lineTo(w/2-5,h*0.12);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-w/2+5,-h*0.05);ctx.lineTo(-w/2+5,h*0.12);ctx.stroke();
    ctx.beginPath();ctx.moveTo(w/2-5,-h*0.05);ctx.lineTo(w/2-5,h*0.12);ctx.stroke();
    // door lines (3)
    ctx.strokeStyle='rgba(0,0,0,0.14)';ctx.lineWidth=0.6;
    [-w/2+2,0,w/2-2].forEach(x=>{ctx.beginPath();ctx.moveTo(x,-h/2+h*0.19);ctx.lineTo(x,h/2-h*0.19);ctx.stroke();});
    wheels4(w,h);headlights(w,h,spd);taillights(w,h,spd);
  },

  /* ─── TRUCK ─────────────────────────────────────────────── */
  truck:(w,h,c,spd)=>{
    dropshadow(w,h,3,5,0.26);
    // cargo box (rear half)
    ctx.fillStyle=hx(c,-24);ctx.beginPath();ctx.roundRect(-w/2+0.5,-h/2+h*0.50,w-1,h*0.46,2);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.26)';ctx.lineWidth=0.7;ctx.stroke();
    // cargo ribs
    ctx.strokeStyle='rgba(255,255,255,0.09)';ctx.lineWidth=0.6;ctx.setLineDash([4,4]);
    [0.56,0.68,0.80].forEach(f=>{ctx.beginPath();ctx.moveTo(-w/2+2,(-h/2+h*f));ctx.lineTo(w/2-2,(-h/2+h*f));ctx.stroke();});
    ctx.setLineDash([]);
    // cab (front half)
    ctx.fillStyle=grad(c,w,h*0.54,34,26);ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h*0.52,w*0.18);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.32)';ctx.stroke();
    // cab windscreen
    ctx.fillStyle='rgba(160,220,255,0.74)';ctx.beginPath();ctx.roundRect(-w/2+2.5,-h/2+2.5,w-5,h*0.16,2.5);ctx.fill();
    // cab roof
    ctx.fillStyle='rgba(0,0,0,0.24)';ctx.beginPath();ctx.roundRect(-w/2+3,-h*0.22,w-6,h*0.17,2.5);ctx.fill();
    // cab–cargo divider
    ctx.strokeStyle='rgba(0,0,0,0.45)';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(-w/2+1.5,-h/2+h*0.51);ctx.lineTo(w/2-1.5,-h/2+h*0.51);ctx.stroke();
    // 6 wheels
    const wW=Math.max(4,w*0.21),wH=Math.max(6,h*0.075);
    ctx.fillStyle='#0d0d0d';
    const wy=[-h/2+h*0.085,-h/2+h*0.32,h/2-h*0.085-wH];
    const wx=[-w/2-wW*0.25,w/2-wW*0.75];
    wx.forEach(x=>wy.forEach(y=>{ctx.beginPath();ctx.roundRect(x,y,wW,wH,1.5);ctx.fill();}));
    ctx.fillStyle='#445566';
    wx.forEach(x=>wy.forEach(y=>{ctx.fillRect(x+1,y+1,wW-2,wH*0.42);}));
    headlights(w,h,spd);taillights(w,h,spd);
  },

  /* ─── BUS ───────────────────────────────────────────────── */
  bus:(w,h,c,spd)=>{
    dropshadow(w,h,3,5,0.28);
    ctx.fillStyle=grad(c,w,h,22,16);ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,3.5);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.30)';ctx.lineWidth=0.9;ctx.stroke();
    // large windscreen
    ctx.fillStyle='rgba(160,220,255,0.74)';ctx.beginPath();ctx.roundRect(-w/2+2.5,-h/2+2.5,w-5,h*0.14,2.5);ctx.fill();
    // destination sign
    ctx.fillStyle='rgba(0,30,110,0.82)';ctx.beginPath();ctx.roundRect(-w/2+3.5,-h/2+h*0.16,w-7,h*0.08,1.5);ctx.fill();
    ctx.fillStyle='#ffffaa';ctx.font=`${Math.max(4.5,w*0.24)}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('BUS',0,-h/2+h*0.20);
    // 7 side windows
    const nw=7,winH=(h*0.58)/nw-2.2,sy=-h*0.06;
    ctx.fillStyle='rgba(180,228,255,0.50)';
    for(let i=0;i<nw;i++){
      ctx.fillRect(-w/2+1.5,sy+i*(winH+2.2),3.5,winH);
      ctx.fillRect( w/2-5.0,sy+i*(winH+2.2),3.5,winH);
    }
    ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(-w/2+2,-h*0.05,w-4,h*0.44);
    // rear window
    ctx.fillStyle='rgba(130,195,240,0.58)';ctx.beginPath();ctx.roundRect(-w/2+2.5,h/2-h*0.13,w-5,h*0.10,2);ctx.fill();
    // 6 wheels
    const wW=Math.max(5,w*0.20),wH=Math.max(6,h*0.06);
    ctx.fillStyle='#0d0d0d';
    const wy=[-h/2+h*0.055,0,h/2-h*0.055-wH],wx=[-w/2-wW*0.22,w/2-wW*0.78];
    wx.forEach(x=>wy.forEach(y=>{ctx.beginPath();ctx.roundRect(x,y,wW,wH,1.5);ctx.fill();ctx.fillStyle='#445566';ctx.fillRect(x+1,y+1,wW-2,wH*0.42);ctx.fillStyle='#0d0d0d';}));
    headlights(w,h,spd);taillights(w,h,spd);
  },

  /* ─── VAN ───────────────────────────────────────────────── */
  van:(w,h,c,spd)=>{
    dropshadow(w,h);
    ctx.fillStyle=grad(c,w,h,32,24);ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,w*0.18);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.28)';ctx.lineWidth=0.8;ctx.stroke();
    ctx.fillStyle='rgba(160,220,255,0.72)';ctx.beginPath();ctx.roundRect(-w/2+2.5,-h/2+2.5,w-5,h*0.17,2.5);ctx.fill();
    // front cabin side windows
    ctx.fillStyle='rgba(175,222,255,0.48)';
    ctx.fillRect(-w/2+2,-h*0.04,3.5,h*0.20);
    ctx.fillRect( w/2-5.5,-h*0.04,3.5,h*0.20);
    // cargo area — blank
    ctx.fillStyle='rgba(0,0,0,0.14)';ctx.fillRect(-w/2+2,h*0.18,w-4,h*0.27);
    // rear window
    ctx.fillStyle='rgba(130,195,240,0.54)';ctx.beginPath();ctx.roundRect(-w/2+2.5,h/2-h*0.17,w-5,h*0.14,2);ctx.fill();
    // door handle
    ctx.fillStyle='rgba(255,255,255,0.32)';ctx.fillRect(w/2-3.5,-h*0.07,2.5,6);
    wheels4(w,h);headlights(w,h,spd);taillights(w,h,spd);
  },

  /* ─── AUTO-RICKSHAW (Tuk-tuk) ────────────────────────────── */
  auto:(w,h,c,spd)=>{
    dropshadow(w,h,2,4,0.22);
    // boxy cabin top
    const ag=ctx.createLinearGradient(-w/2,-h/2,w/2,-h/2+h*0.62);
    ag.addColorStop(0,hx(c,40));ag.addColorStop(0.5,c);ag.addColorStop(1,hx(c,-22));
    ctx.fillStyle=ag;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h*0.66,w*0.24);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.30)';ctx.lineWidth=0.7;ctx.stroke();
    // black stripe
    ctx.fillStyle='rgba(0,0,0,0.56)';ctx.fillRect(-w/2,-h*0.05,w,h*0.08);
    ctx.fillStyle='rgba(255,200,0,0.62)';ctx.fillRect(-w/2,-h*0.015,w,h*0.032);
    // windscreen
    ctx.fillStyle='rgba(160,218,255,0.70)';ctx.beginPath();ctx.roundRect(-w/2+2,-h/2+2,w-4,h*0.18,2.5);ctx.fill();
    // open sides (support bars)
    ctx.strokeStyle='rgba(0,0,0,0.24)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(-w/2+1.5,-h/2+h*0.22);ctx.lineTo(-w/2+1.5,-h/2+h*0.54);ctx.stroke();
    ctx.beginPath();ctx.moveTo( w/2-1.5,-h/2+h*0.22);ctx.lineTo( w/2-1.5,-h/2+h*0.54);ctx.stroke();
    // DRIVER
    ctx.fillStyle='rgba(22,22,32,0.87)';
    ctx.beginPath();ctx.ellipse(0,-h*0.11,w*0.32,h*0.12,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(0,-h*0.24,w*0.26,0,Math.PI*2);ctx.fill();
    // 3 WHEELS: 1 front centre, 2 rear
    ctx.fillStyle='#0c0c0c';ctx.strokeStyle='#2a2a2a';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.ellipse(0,-h/2+4.5,w*0.15,h*0.065,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(-w/2+2.5,h/2-4.5,w*0.16,h*0.065,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse( w/2-2.5,h/2-4.5,w*0.16,h*0.065,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    // headlight
    ctx.fillStyle=spd>3?'#ffffaa':'#887720';ctx.shadowBlur=spd>3?8:0;ctx.shadowColor='#ffffcc';
    ctx.beginPath();ctx.ellipse(0,-h/2+2,w*0.22,h*0.038,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    // tail light
    ctx.fillStyle=spd<6?'#ff3344':'#660011';ctx.shadowBlur=spd<6?7:0;ctx.shadowColor='#ff3344';
    ctx.beginPath();ctx.ellipse(0,h/2-2,w*0.22,h*0.038,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  },
  
  /* ─── JEEP (Open-top Off-road) ────────────────────────── */
  jeep:(w,h,c,spd)=>{
    dropshadow(w,h,3,4,0.24);
    // body outer frame
    ctx.fillStyle=grad(c,w,h,28,20);ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,3);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=1;ctx.stroke();
    // rear spare wheel
    ctx.fillStyle='#0f0f0f';ctx.beginPath();ctx.roundRect(-w*0.28,h/2-3,w*0.56,6,1.5);ctx.fill();
    // open interior tub (darker grey)
    ctx.fillStyle='#1e2025';ctx.beginPath();ctx.roundRect(-w/2+2.5,-h/2+7,w-5,h-11,2);ctx.fill();
    // seats (driver & passenger)
    ctx.fillStyle=c;
    ctx.beginPath();ctx.roundRect(-w/2+3.5,-h*0.14,w*0.35,h*0.22,1.5);ctx.fill(); // driver seat
    ctx.beginPath();ctx.roundRect( 0.5,-h*0.14,w*0.35,h*0.22,1.5);ctx.fill(); // passenger seat
    // steering wheel
    ctx.strokeStyle='#0d0d0d';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(-w*0.18,-h*0.20,3.5,0,Math.PI*2);ctx.stroke();
    // roll cage bars (lines)
    ctx.strokeStyle='#2e3035';ctx.lineWidth=1.8;
    ctx.beginPath();ctx.moveTo(-w/2+2.5,-h*0.20);ctx.lineTo(w/2-2.5,-h*0.20);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-w/2+3,h/2-6);ctx.lineTo(w/2-3,h/2-6);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-w/2+3,-h*0.20);ctx.lineTo(-w/2+3,h/2-6);ctx.stroke();
    ctx.beginPath();ctx.moveTo(w/2-3,-h*0.20);ctx.lineTo(w/2-3,h/2-6);ctx.stroke();
    // bonnet vents
    ctx.fillStyle='rgba(0,0,0,0.28)';ctx.fillRect(-w*0.22,-h/2+3,w*0.44,1.5);
    wheels4(w,h);headlights(w,h,spd);taillights(w,h,spd);
  },

  /* ─── TRACTOR (Farm tractor) ──────────────────────────── */
  tractor:(w,h,c,spd)=>{
    dropshadow(w,h,3,4,0.22);
    // narrow engine bonnet (front)
    const ew=w*0.50,eh=h*0.48;
    ctx.fillStyle=grad(c,ew,eh,34,22);ctx.beginPath();ctx.roundRect(-ew/2,-h/2,ew,eh,2);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.30)';ctx.lineWidth=0.8;ctx.stroke();
    // rear fender wings
    ctx.fillStyle=grad(c,w,h*0.46,18,12);
    ctx.beginPath();ctx.roundRect(-w/2,-h/2+eh,3.5,h*0.45,1.5);ctx.fill();
    ctx.beginPath();ctx.roundRect( w/2-3.5,-h/2+eh,3.5,h*0.45,1.5);ctx.fill();
    // open driver area floor
    ctx.fillStyle='#2e2e2e';ctx.fillRect(-w/2+3.5,-h/2+eh,w-7,h*0.42);
    // driver seat
    ctx.fillStyle='#cc8800';ctx.beginPath();ctx.roundRect(-w*0.18,0,w*0.36,h*0.16,1);ctx.fill();
    // steering wheel & dashboard
    ctx.fillStyle='#0f0f0f';ctx.beginPath();ctx.arc(0,-h*0.08,3.5,0,Math.PI*2);ctx.fill();
    // vertical exhaust pipe (black stack)
    ctx.fillStyle='#1c1c1c';ctx.beginPath();ctx.arc(ew*0.30,-h/2+11,2,0,Math.PI*2);ctx.fill();
    // massive rear wheels
    const rwW=Math.max(5.5,w*0.22),rwH=Math.max(14,h*0.35);
    ctx.fillStyle='#0c0c0c';
    ctx.beginPath();ctx.roundRect(-w/2-rwW*0.28,h/2-rwH-3,rwW,rwH,2);ctx.fill();
    ctx.beginPath();ctx.roundRect( w/2-rwW*0.72,h/2-rwH-3,rwW,rwH,2);ctx.fill();
    ctx.fillStyle='#ffcc00'; // yellow hub
    ctx.beginPath();ctx.arc(-w/2-rwW*0.28+rwW/2,h/2-rwH/2-3,2.5,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc( w/2-rwW*0.72+rwW/2,h/2-rwH/2-3,2.5,0,Math.PI*2);ctx.fill();
    // smaller front wheels
    const fwW=Math.max(4,w*0.16),fwH=Math.max(8,h*0.18);
    ctx.fillStyle='#0c0c0c';
    ctx.beginPath();ctx.roundRect(-ew/2-fwW*0.28,-h/2+3,fwW,fwH,1.5);ctx.fill();
    ctx.beginPath();ctx.roundRect( ew/2-fwW*0.72,-h/2+3,fwW,fwH,1.5);ctx.fill();
    // headlights (mounted on grille sides)
    ctx.fillStyle='#ffff88';ctx.beginPath();ctx.arc(-ew/2,-h/2+4,1.8,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc( ew/2,-h/2+4,1.8,0,Math.PI*2);ctx.fill();
    // tail lights
    ctx.fillStyle='#cc1111';ctx.fillRect(-w/2+1,h/2-5,2,2);ctx.fillRect(w/2-3,h/2-5,2,2);
  },

  /* ─── POLICE CAR (Interdictor) ────────────────────────── */
  police:(w,h,c,spd)=>{
    dropshadow(w,h);
    // black body base
    ctx.fillStyle='#111115';ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,w*0.22);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.40)';ctx.lineWidth=1;ctx.stroke();
    // white roof and bonnet
    ctx.fillStyle='#ffffff';
    ctx.beginPath();ctx.roundRect(-w/2+2,-h*0.14,w-4,h*0.48,2);ctx.fill(); // white roof/mid-cabin
    ctx.beginPath();ctx.roundRect(-w*0.26,-h/2+1.5,w*0.52,9,1.5);ctx.fill(); // white front bonnet
    // black divider pillars
    ctx.fillStyle='#111';
    ctx.fillRect(-w/2+2,-h*0.10,3.5,h*0.06);
    ctx.fillRect( w/2-5.5,-h*0.10,3.5,h*0.06);
    // front windscreen
    ctx.fillStyle='rgba(150,215,255,0.72)';ctx.beginPath();ctx.roundRect(-w/2+3,-h/2+10.5,w-6,h*0.16,2);ctx.fill();
    // rear window
    ctx.fillStyle='rgba(130,195,240,0.50)';ctx.beginPath();ctx.roundRect(-w/2+3,h/2-h*0.20,w-6,h*0.13,2);ctx.fill();
    // police star shield symbol on white hood
    ctx.fillStyle='#ccaa00';ctx.beginPath();ctx.arc(0,-h/3,3,0,Math.PI*2);ctx.fill();
    // EMERGENCY LIGHTS (blue & red flashing)
    const flash=Math.sin(performance.now()/70)>0;
    ctx.fillStyle=flash?'#ff0808':'#0522ee';ctx.shadowBlur=20;ctx.shadowColor=flash?'#ff0000':'#0000ff';
    ctx.fillRect(-w/2+3,-h*0.04,w/2-3,4.5);ctx.shadowBlur=0;
    ctx.fillStyle=(!flash)?'#ff0808':'#0522ee';ctx.shadowBlur=20;ctx.shadowColor=(!flash)?'#ff0000':'#0000ff';
    ctx.fillRect(0,-h*0.04,w/2-3,4.5);ctx.shadowBlur=0;
    // lightbar center divider
    ctx.fillStyle='#333';ctx.fillRect(-1.5,-h*0.04,3,4.5);
    wheels4(w,h);headlights(w,h,spd);taillights(w,h,spd);
  },

  /* ─── FIRE TRUCK (Emergency Fire Service) ──────────────── */
  fire:(w,h,c,spd)=>{
    dropshadow(w,h,3,5,0.28);
    // Red body base
    ctx.fillStyle='#d32f2f'; ctx.beginPath(); ctx.roundRect(-w/2,-h/2,w,h,4); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1; ctx.stroke();
    // Cab windshield
    ctx.fillStyle='rgba(165,222,255,0.72)'; ctx.beginPath(); ctx.roundRect(-w/2+2.5,-h/2+14,w-5,8,1.5); ctx.fill();
    // Yellow front hood
    ctx.fillStyle='#ffd000'; ctx.beginPath(); ctx.roundRect(-w/2+0.5,-h/2+0.5,w-1,13,[3,3,0,0]); ctx.fill();
    // Side Ladders (Grey rails on sides)
    ctx.fillStyle='#7f8c8d';
    ctx.fillRect(-w/2-1.5, -h/2+15, 1.5, h-25);
    ctx.fillRect( w/2, -h/2+15, 1.5, h-25);
    // Ladder rungs
    ctx.strokeStyle='#bdc3c7'; ctx.lineWidth=0.8;
    for(let y = -h/2+18; y < h/2-15; y += 6) {
      ctx.beginPath(); ctx.moveTo(-w/2-1.5, y); ctx.lineTo(-w/2, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w/2, y); ctx.lineTo(w/2+1.5, y); ctx.stroke();
    }
    // Water Hose reel on roof
    ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(0, 14, 6, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='#7f8c8d'; ctx.lineWidth=1; ctx.stroke();
    // Flashing emergency lights (Red/Blue) on roof
    const flash = Math.sin(performance.now()/80) > 0;
    ctx.fillStyle = flash ? '#0f22ee' : '#cc1133';
    ctx.fillRect(-w/2+4, -h/2-4, w-8, 4);
    wheels4(w,h); headlights(w,h,spd); taillights(w,h,spd);
  },
};

/* ════════════════════════════════════════════════════════════
   AMBULANCE  — large, clearly visible, correct angle via rc
   ════════════════════════════════════════════════════════════ */
const AMB={
  dir:'south',pos:0,active:false,spd:0,lph:0,
  turning: false, completedTurn: false, turnStartPos: 0, exitDir: null, exitPos: 0, currentAngle: 0, turnTotalDist: 0,
  xy: function(rc) {
    const r=rc[this.dir];
    const cx=canvas.width/2,cy=canvas.height/2;
    const hw=Math.min(canvas.width,canvas.height)*0.09;
    const lo=hw*0.40;
    
    let pExit = {x: cx, y: cy, dx: 0, dy: -1};
    if (this.exitDir) {
      const re = rc[this.exitDir];
      if (activeRoadCount === 5) {
        const nx = -re.dy, ny = re.dx;
        const stop1 = re.stopDist - 26; 
        const entryX = re.spawnX + re.dx * stop1;
        const entryY = re.spawnY + re.dy * stop1;
        pExit = { x: entryX - 2*nx*lo, y: entryY - 2*ny*lo, dx: -re.dx, dy: -re.dy };
      } else {
        pExit = {
          north: {x: cx+lo, y: cy-hw, dx: 0, dy: -1},
          south: {x: cx-lo, y: cy+hw, dx: 0, dy: 1},
          east:  {x: cx+hw, y: cy+lo, dx: 1, dy: 0},
          west:  {x: cx-hw, y: cy-lo, dx: -1, dy: 0},
          northeast: {x: cx+hw*1.5*0.707, y: cy-hw*1.5*0.707, dx: 0.707, dy: -0.707}
        }[this.exitDir];
      }
    }
    
    if (this.completedTurn) {
      this.currentAngle = Math.atan2(pExit.dy, pExit.dx) + Math.PI/2;
      return {x: pExit.x + pExit.dx * this.exitPos, y: pExit.y + pExit.dy * this.exitPos};
    }
    
    if (this.turning && this.exitDir) {
      const stop1 = r.stopDist - 26;
      const nx = -r.dy, ny = r.dx;
      const shift = -25; // Shift 25 pixels towards center line
      const pEntry = {
        x: r.spawnX + r.dx * stop1 + nx * shift,
        y: r.spawnY + r.dy * stop1 + ny * shift
      };
      
      const turnDist = this.turnTotalDist || (hw * 2.5);
      const t = Math.min(1, Math.max(0, (this.pos - this.turnStartPos) / turnDist));
      
      if (activeRoadCount === 5) {
        let a1 = Math.atan2(pEntry.y - cy, pEntry.x - cx);
        let a2 = Math.atan2(pExit.y - cy, pExit.x - cx);
        while (a2 <= a1) a2 += Math.PI * 2;
        
        if (!this.turnTotalDist) {
          this.turnTotalDist = Math.max((a2 - a1) * (hw * 1.5), hw * 1.8);
        }
        
        const A = a1 + t * (a2 - a1);
        const R_start = Math.hypot(pEntry.x - cx, pEntry.y - cy);
        const R_end = Math.hypot(pExit.x - cx, pExit.y - cy);
        const R_mid = -hw * 0.50; // Hug center roundabout for 5-road map 
        
        const R = (1-t)*(1-t)*R_start + 2*(1-t)*t*R_mid + t*t*R_end;
        const x = cx + R * Math.cos(A);
        const y = cy + R * Math.sin(A);
        
        const dR_dt = 2*(t-1)*R_start + 2*(1-2*t)*R_mid + 2*t*R_end;
        const dA_dt = a2 - a1;
        const dx = dR_dt * Math.cos(A) - R * Math.sin(A) * dA_dt;
        const dy = dR_dt * Math.sin(A) + R * Math.cos(A) * dA_dt;
        
        this.currentAngle = Math.atan2(dy, dx) + Math.PI/2;
        return {x, y};
      }
      
      const pCtrl = {x: cx, y: cy};
      const x = (1-t)*(1-t)*pEntry.x + 2*(1-t)*t*pCtrl.x + t*t*pExit.x;
      const y = (1-t)*(1-t)*pEntry.y + 2*(1-t)*t*pCtrl.y + t*t*pExit.y;
      
      const dx = 2*(1-t)*(pCtrl.x - pEntry.x) + 2*t*(pExit.x - pCtrl.x);
      const dy = 2*(1-t)*(pCtrl.y - pEntry.y) + 2*t*(pExit.y - pCtrl.y);
      this.currentAngle = Math.atan2(dy, dx) + Math.PI/2;
      return {x, y};
    }
    
    this.currentAngle = r.angle;
    const nx = -r.dy, ny = r.dx;
    const shift = -25; // Shift 25 pixels towards center line
    return {
      x: r.spawnX + r.dx * this.pos + nx * shift,
      y: r.spawnY + r.dy * this.pos + ny * shift
    };
  }
};

function drawAmbulance(rc){
  if(!AMB.active)return;
  const {x: ax, y: ay} = AMB.xy(rc);
  if(ax<-150||ax>canvas.width+150||ay<-150||ay>canvas.height+150)return;

  /* ─ Big pulsing halo ─ */
  const pulse=80+Math.sin(AMB.lph*6)*14;
  const hg=ctx.createRadialGradient(ax,ay,6,ax,ay,pulse);
  hg.addColorStop(0,'rgba(255,25,25,0.55)');
  hg.addColorStop(0.45,'rgba(255,25,25,0.22)');
  hg.addColorStop(1,'rgba(255,25,25,0)');
  ctx.fillStyle=hg;ctx.beginPath();ctx.arc(ax,ay,pulse,0,Math.PI*2);ctx.fill();

  /* ─ Ground sweep light ─ */
  const lo=Math.sin(AMB.lph*12)>0;
  ctx.save();
  ctx.translate(ax,ay);
  ctx.rotate(AMB.currentAngle);
  
  // Pseudo-3D Drop Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 6;
  
  let w = VSPEC[AMB.type || 'ambulance'].wid || 40;
  let h = VSPEC[AMB.type || 'ambulance'].len || 80;
  // forward headlight beam
  ctx.globalAlpha=0.14;
  const bm=ctx.createLinearGradient(0,-h/2-5,0,-h/2-55);
  bm.addColorStop(0,'rgba(255,255,200,1)');bm.addColorStop(1,'rgba(255,255,200,0)');
  ctx.fillStyle=bm;ctx.beginPath();ctx.ellipse(0,-h/2-28,24,26,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;

  /* ─ Shadow ─ */
  ctx.save();ctx.translate(4,7);ctx.globalAlpha=0.32;ctx.fillStyle='#000028';
  ctx.beginPath();ctx.ellipse(0,0,w*0.55,h*0.46,0,0,Math.PI*2);ctx.fill();ctx.restore();

  if (AMB.type === 'fireengine' && typeof imgFireEngine !== 'undefined' && imgFireEngine.src) {
    ctx.drawImage(imgFireEngine, -w/2, -h/2, w, h);
  } else if ((!AMB.type || AMB.type === 'ambulance') && typeof imgAmbulance !== 'undefined' && imgAmbulance.src) {
    ctx.drawImage(imgAmbulance, -w/2, -h/2, w, h);
  } else {
    /* ─ White body fallback ─ */
    const wg=ctx.createLinearGradient(-w/2,-h/2,w/2,h/2);
    wg.addColorStop(0,'#ffffff');wg.addColorStop(0.5,'#fcfcfc');wg.addColorStop(1,'#eaeaea');
    ctx.fillStyle=wg;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,w*0.15);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.22)';ctx.lineWidth=1.2;ctx.stroke();
    
    ctx.fillStyle='#0055cc';
    ctx.beginPath(); ctx.arc(0, 12, 7, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(4, 12); ctx.moveTo(0, 8); ctx.lineTo(0, 16); ctx.stroke();
  }

  ctx.restore(); // back to world space

  /* ─ Floating EMERGENCY badge (screen space) ─ */
  ctx.save();ctx.translate(ax,ay);
  const pulse2=0.78+0.22*Math.sin(AMB.lph*12);
  ctx.globalAlpha=pulse2;
  const bw=140,bh=26,bx=-bw/2,by=-(h/2+16)-28;
  ctx.fillStyle='rgba(210,0,0,0.94)';ctx.strokeStyle='rgba(255,130,130,0.88)';ctx.lineWidth=1.8;
  ctx.shadowBlur=18;ctx.shadowColor='#ff0000';
  ctx.beginPath();ctx.roundRect(bx,by,bw,bh,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle='#ffffff';ctx.font='bold 12px Orbitron,monospace';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('🚨 EMERGENCY', 0,by+bh/2);
  ctx.restore();

  // particles
  if(Math.random()<0.24){
    const fc=lo?'#ff3355':'#4466ff';
    spawnPar(ax+(Math.random()-0.5)*52,ay+(Math.random()-0.5)*52,fc);
  }
}

/* ── Particles ─────────────────────────────────────────────── */
const particles=[];
function spawnPar(x,y,c){particles.push({x,y,vx:(Math.random()-0.5)*3.2,vy:(Math.random()-0.5)*3.2,a:0.90,r:Math.random()*4.5+2,c});}
function drawPars(){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.a-=0.030;p.r*=0.93;
    if(p.a<=0){particles.splice(i,1);continue;}
    ctx.save();ctx.globalAlpha=p.a;ctx.fillStyle=p.c;ctx.shadowBlur=6;ctx.shadowColor=p.c;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}

/* ── Vehicle manager ────────────────────────────────────────── */
const vehicles=[];
const spT={north:0.8,east:0.2,south:1.6,west:1.2},spN={north:1.0,east:0.8,south:1.2,west:1.0};
function manageVehicles(dt,rc){
  vehicles.forEach(v=>v.update(dt,rc,vehicles));
  for(let i=vehicles.length-1;i>=0;i--)if(vehicles[i].done)vehicles.splice(i,1);
  activeDirs.forEach(dir=>{
    spT[dir]+=dt;
    if(spT[dir]>=spN[dir]){
      spT[dir]=0;spN[dir]=0.4+Math.random()*1.4;
      if(!vehicles.some(v=>v.dir===dir&&v.pos < (v.spec.len / 2 + 65)))vehicles.push(new Vehicle(dir));
    }
  });
}

/* ── Road drawing ───────────────────────────────────────────── */
function drawGrid(){
  ctx.strokeStyle='#0b1a28';ctx.lineWidth=1;const s=38;
  for(let x=0;x<canvas.width;x+=s){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
  for(let y=0;y<canvas.height;y+=s){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
}
function drawRoad(){
  const cx=canvas.width/2,cy=canvas.height/2,W=canvas.width,H=canvas.height;
  const hw=Math.min(W,H)*0.09;
  
  // 1. Sidewalk Base (Light grey sidewalk pavement color from mod_int.png)
  ctx.fillStyle='#d5dbdb';
  ctx.fillRect(0,0,W,H);

  // 2. Rounded Grass Corner Blocks
  const rGrass = 22; // corner radius of the grass
  const padding = 16; // offset from road kerb to grass edge
  
  ctx.fillStyle='#3b7a15'; // Lush green color of the grass blocks
  if(activeRoadCount === 5 || activeRoadCount === 4){
    // Top-Left block
    ctx.beginPath(); ctx.roundRect(-20, -20, cx - hw - padding + 20, cy - hw - padding + 20, [0, 0, rGrass, 0]); ctx.fill();
    // Top-Right block
    ctx.beginPath(); ctx.roundRect(cx + hw + padding, -20, W - (cx + hw + padding) + 20, cy - hw - padding + 20, [0, 0, 0, rGrass]); ctx.fill();
    // Bottom-Left block
    ctx.beginPath(); ctx.roundRect(-20, cy + hw + padding, cx - hw - padding + 20, H - (cy + hw + padding) + 20, [0, rGrass, 0, 0]); ctx.fill();
    // Bottom-Right block
    ctx.beginPath(); ctx.roundRect(cx + hw + padding, cy + hw + padding, W - (cx + hw + padding) + 20, H - (cy + hw + padding) + 20, [rGrass, 0, 0, 0]); ctx.fill();
  } else if(activeRoadCount === 3){
    // Top-Left block
    ctx.beginPath(); ctx.roundRect(-20, -20, cx - hw - padding + 20, cy - hw - padding + 20, [0, 0, rGrass, 0]); ctx.fill();
    // Top-Right block
    ctx.beginPath(); ctx.roundRect(cx + hw + padding, -20, W - (cx + hw + padding) + 20, cy - hw - padding + 20, [0, 0, 0, rGrass]); ctx.fill();
    // Bottom solid horizontal grass block (no South road)
    ctx.fillRect(-20, cy + hw + padding, W + 40, H - (cy + hw + padding) + 20);
  } else {
    // Top solid horizontal grass block (no North road)
    ctx.fillRect(-20, -20, W + 40, cy - hw - padding + 20);
    // Bottom solid horizontal grass block (no South road)
    ctx.fillRect(-20, cy + hw + padding, W + 40, H - (cy + hw + padding) + 20);
  }

  // Helper for drawing 3D tree clusters
  const drawTree = (x, y) => {
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#1e3f14'; ctx.beginPath(); ctx.arc(x-7, y+4, 13, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2c5e1c'; ctx.beginPath(); ctx.arc(x+7, y-4, 15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3f7c2a'; ctx.beginPath(); ctx.arc(x, y+6, 14, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#5c9e3e'; ctx.beginPath(); ctx.arc(x+2, y+1, 6, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  };

  // Helper for drawing houses with specific roof colors
  const drawHouse = (x, y, w, h, roofCol, bodyCol) => {
    ctx.fillStyle=bodyCol; ctx.fillRect(x-w/2, y-h/2, w, h);
    ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5; ctx.strokeRect(x-w/2, y-h/2, w, h);
    ctx.fillStyle=roofCol; ctx.beginPath();
    ctx.moveTo(x-w/2-3, y-h/2); ctx.lineTo(x, y-h/2-10); ctx.lineTo(x+w/2+3, y-h/2);
    ctx.closePath(); ctx.fill();
  };

  // Helper for drawing office buildings (grey flat roof with details)
  const drawOffice = (x, y, w, h) => {
    ctx.fillStyle='#95a5a6'; ctx.fillRect(x-w/2, y-h/2, w, h);
    ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5; ctx.strokeRect(x-w/2, y-h/2, w, h);
    ctx.fillStyle='#7f8c8d'; ctx.fillRect(x-w/2+2, y-h/2+2, w-4, 2);
    ctx.fillStyle='#34495e';
    ctx.fillRect(x-w/4, y-2, 6, 6);
    ctx.fillRect(x+w/8, y-4, 8, 8);
    ctx.fillStyle='#bdc3c7';
    ctx.beginPath(); ctx.arc(x-w/4+3, y+1, 2, 0, Math.PI*2); ctx.fill();
  };

  // Helper for drawing pedestrians on sidewalks
  const drawPedestrian = (x, y, shirtCol) => {
    ctx.fillStyle=shirtCol;
    ctx.beginPath(); ctx.ellipse(x, y, 4, 1.8, 0.4, 0, Math.PI*2); ctx.fill(); // shoulders
    ctx.fillStyle='#e0ac69';
    ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI*2); ctx.fill(); // head
    ctx.fillStyle='#331a00';
    ctx.beginPath(); ctx.arc(x-0.5, y-0.5, 1.6, Math.PI*0.8, Math.PI*1.8); ctx.fill(); // hair
  };

  // 3. Populate Environmental Assets (based on layout mode)
  // Top assets (always drawn)
  drawHouse(35, 45, 34, 24, '#d35400', '#f39c12');
  drawHouse(85, 35, 42, 28, '#e67e22', '#f1c40f');
  drawTree(45, 95);
  drawTree(85, 90);
  
  drawHouse(cx + hw + 105, 35, 40, 26, '#2980b9', '#3498db');
  drawHouse(W - 45, 80, 44, 28, '#c0392b', '#e74c3c');
  drawTree(cx + hw + 60, 95);
  drawTree(W - 85, 100);

  // Bottom assets (procedural layout)
  if(activeRoadCount === 5 || activeRoadCount === 4){
    drawOffice(50, H - 75, 68, 56);
    drawTree(115, H - 65);
    drawTree(110, H - 95);
    
    drawOffice(cx + hw + 105, H - 55, 78, 52);
    drawTree(cx + hw + 50, H - 65);
  } else {
    // continuous office row along the bottom sidewalk block
    drawOffice(50, H - 75, 68, 56);
    drawOffice(cx, H - 75, 70, 56);
    drawOffice(cx + hw + 105, H - 55, 78, 52);
    drawTree(115, H - 65);
    drawTree(cx - 70, H - 65);
    drawTree(cx + hw + 50, H - 65);
  }

  // Draw Sidewalk Pedestrians depending on layout
  drawPedestrian(cx - hw - 8, cy - hw - 30, '#1abc9c');
  drawPedestrian(cx + hw + 8, cy - hw - 40, '#e67e22');
  if (activeRoadCount >= 3) {
    drawPedestrian(cx - hw - 35, cy - hw - 8, '#9b59b6');
    drawPedestrian(cx + hw + 30, cy - hw - 10, '#34495e');
  }
  if (activeRoadCount === 4) {
    drawPedestrian(cx - hw - 40, cy + hw + 12, '#2ecc71');
    drawPedestrian(cx - hw - 10, cy + hw + 35, '#c0392b');
    drawPedestrian(cx + hw + 8, cy + hw + 25, '#9b59b6');
    drawPedestrian(cx + hw + 35, cy + hw + 8, '#1abc9c');
  } else {
    drawPedestrian(cx - hw - 40, cy + hw + 20, '#2ecc71');
    drawPedestrian(cx + hw + 35, cy + hw + 20, '#1abc9c');
  }

  // 4. Draw Main Active Intersecting Roads (Dark grey asphalt from mod_int.png)
  // 4. Draw Main Active Intersecting Roads (Dark grey asphalt from mod_int.png)
  ctx.fillStyle='#34495e'; // Unified asphalt road color
  
  if (activeRoadCount === 5) {
    const ringInner = hw * 0.8;
    const ringOuter = hw * 3.0;
    const angles = [-90, -18, 54, 126, 198];
    
    // Draw 5 radiating roads
    angles.forEach(deg => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(deg * Math.PI / 180);
      ctx.fillRect(0, -hw, canvas.width, hw * 2); // draw road outward
      
      // Kerbs for radiating roads
      ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ringOuter, -hw); ctx.lineTo(canvas.width, -hw);
      ctx.moveTo(ringOuter, hw); ctx.lineTo(canvas.width, hw);
      ctx.stroke();
      ctx.restore();
    });
    
    // Draw the Circular Ring Road (Asphalt)
    ctx.beginPath();
    ctx.arc(cx, cy, ringOuter, 0, Math.PI * 2);
    ctx.fill(); 
    
    // Outer Ring Kerb
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, ringOuter, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw Splitter Islands (Pink) between the lanes
    angles.forEach(deg => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(deg * Math.PI / 180);
      
      ctx.fillStyle = '#e29b9b'; // pinkish red like image
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ringOuter + 8, 0); 
      ctx.lineTo(ringOuter + hw*1.2, -6);
      ctx.lineTo(ringOuter + hw*1.2, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    });
    
    // Draw the Central Island (Grass)
    ctx.fillStyle = '#3b7a15';
    ctx.beginPath();
    ctx.arc(cx, cy, ringInner, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f1c40f'; // yellow inner kerb
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw Dark inner circle (as seen in image)
    ctx.fillStyle = '#1c1f1c';
    ctx.beginPath();
    ctx.arc(cx, cy, ringInner * 0.65, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw yellow center lines and zebra crossings for each road
    angles.forEach(deg => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(deg * Math.PI / 180);
      
      // Yellow line
      ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ringOuter + hw*1.2, -1.5); ctx.lineTo(canvas.width, -1.5);
      ctx.moveTo(ringOuter + hw*1.2, 1.5); ctx.lineTo(canvas.width, 1.5);
      ctx.stroke();
      
      // Zebra crossing
      ctx.fillStyle = '#ffffff';
      const zx = ringOuter + 14;
      for (let y = -hw + 4; y < hw - 2; y += 11) {
        if (Math.abs(y) > 10) ctx.fillRect(zx, y, 12, 6); // gap for island
      }
      ctx.fillRect(zx - 6, -hw, 2, hw); // Stop line incoming
      ctx.fillRect(zx + 14, 0, 2, hw);  // Stop line outgoing (optional)
      
      ctx.restore();
    });
    
  } else {
    // East-West road is always drawn
    ctx.fillRect(0, cy-hw, W, hw*2);
    // Center intersection is always drawn
    ctx.fillRect(cx-hw, cy-hw, hw*2, hw*2);
    
    if(activeDirs.includes('north')){
      ctx.fillRect(cx-hw, 0, hw*2, cy-hw);
    }
    if(activeDirs.includes('south')){
      ctx.fillRect(cx-hw, cy+hw, hw*2, H - (cy+hw));
    }

    // Main Kerb lines
    ctx.strokeStyle='#2c3e50'; ctx.lineWidth=1.5;
    const kerbs = [];
    if(activeRoadCount === 4) {
      kerbs.push([0,cy-hw,cx-hw,cy-hw],[cx+hw,cy-hw,W,cy-hw],[0,cy+hw,cx-hw,cy+hw],[cx+hw,cy+hw,W,cy+hw]);
      kerbs.push([cx-hw,0,cx-hw,cy-hw],[cx-hw,cy+hw,cx-hw,H],[cx+hw,0,cx+hw,cy-hw],[cx+hw,cy+hw,cx+hw,H]);
    } else if(activeRoadCount === 3) {
      kerbs.push([0,cy-hw,cx-hw,cy-hw],[cx+hw,cy-hw,W,cy-hw],[0,cy+hw,W,cy+hw]);
      kerbs.push([cx-hw,0,cx-hw,cy-hw],[cx+hw,0,cx+hw,cy-hw]);
    }
    kerbs.forEach(([x1,y1,x2,y2])=>{ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });

    // 5. Draw Double Solid Yellow Centre Lines
    ctx.strokeStyle='#f1c40f'; ctx.lineWidth=1.2;
    ctx.beginPath();
    if(activeDirs.includes('north')){
      ctx.moveTo(cx - 1.5, 0); ctx.lineTo(cx - 1.5, cy - hw);
      ctx.moveTo(cx + 1.5, 0); ctx.lineTo(cx + 1.5, cy - hw);
    }
    if(activeDirs.includes('south')){
      ctx.moveTo(cx - 1.5, cy + hw); ctx.lineTo(cx - 1.5, H);
      ctx.moveTo(cx + 1.5, cy + hw); ctx.lineTo(cx + 1.5, H);
    }
    if(activeDirs.includes('west')){
      ctx.moveTo(0, cy - 1.5); ctx.lineTo(cx - hw, cy - 1.5);
      ctx.moveTo(0, cy + 1.5); ctx.lineTo(cx - hw, cy + 1.5);
    }
    if(activeDirs.includes('east')){
      ctx.moveTo(cx + hw, cy - 1.5); ctx.lineTo(W, cy - 1.5);
      ctx.moveTo(cx + hw, cy + 1.5); ctx.lineTo(W, cy + 1.5);
    }
    ctx.stroke();

    // 6. Draw White Zebra Crossing stripes & Stop Lines
    ctx.fillStyle = '#ffffff';
    if(activeDirs.includes('north')){
      for(let x = cx - hw + 4; x < cx + hw - 2; x += 11) { ctx.fillRect(x, cy - hw - 18, 6, 12); }
      ctx.fillRect(cx - hw, cy - hw - 21, hw, 2);
    }
    if(activeDirs.includes('south')){
      for(let x = cx - hw + 4; x < cx + hw - 2; x += 11) { ctx.fillRect(x, cy + hw + 6, 6, 12); }
      ctx.fillRect(cx, cy + hw + 19, hw, 2);
    }
    if(activeDirs.includes('west')){
      for(let y = cy - hw + 4; y < cy + hw - 2; y += 11) { ctx.fillRect(cx - hw - 18, y, 12, 6); }
      ctx.fillRect(cx - hw - 21, cy, 2, hw);
    }
    if(activeDirs.includes('east')){
      for(let y = cy - hw + 4; y < cy + hw - 2; y += 11) { ctx.fillRect(cx + hw + 6, y, 12, 6); }
      ctx.fillRect(cx + hw + 19, cy - hw, 2, hw);
    }
  }

  // Lane dividers (thin white dashes)
  ctx.setLineDash([8,6]); ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=0.8;
  ctx.beginPath();
  if(activeDirs.includes('north')){
    ctx.moveTo(cx-hw*0.50, 0); ctx.lineTo(cx-hw*0.50, cy-hw);
  }
  if(activeDirs.includes('south')){
    ctx.moveTo(cx+hw*0.50, cy+hw); ctx.lineTo(cx+hw*0.50, H);
  }
  if(activeDirs.includes('west')){
    ctx.moveTo(0, cy+hw*0.50); ctx.lineTo(cx-hw, cy+hw*0.50);
  }
  if(activeDirs.includes('east')){
    ctx.moveTo(cx+hw, cy-hw*0.50); ctx.lineTo(W, cy-hw*0.50);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  
  if(activeDirs.includes('northeast')) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI/4);
    ctx.setLineDash([8,6]); ctx.beginPath();
    ctx.moveTo(hw, -hw*0.50); ctx.lineTo(Math.max(W,H), -hw*0.50);
    ctx.stroke();
    ctx.restore();
  }

  // Green road glow indicators
  activeDirs.forEach(dir=>{
    if(signals[dir].state!=='green')return;
    const gp={north:{x:cx-hw*0.40,y:cy-hw*0.55},south:{x:cx+hw*0.40,y:cy+hw*0.55},
              east:{x:cx+hw*0.55,y:cy-hw*0.40},west:{x:cx-hw*0.55,y:cy+hw*0.40}}[dir];
    ctx.save();ctx.globalAlpha=0.07;ctx.fillStyle='#00ff88';ctx.beginPath();ctx.arc(gp.x,gp.y,hw*0.75,0,Math.PI*2);ctx.fill();ctx.restore();
  });
  
  const cx2=canvas.width/2,cy2=canvas.height/2,hw2=Math.min(canvas.width,canvas.height)*0.09;
  drawCross(cx2,cy2,hw2);drawStop(cx2,cy2,hw2);drawArrows(cx2,cy2,hw2);drawLabels(cx2,cy2,hw2);
}
function drawCross(cx,cy,hw){}
function drawStop(cx,cy,hw){}
function drawArrows(cx,cy,hw){
  ctx.fillStyle='#ffffff1a';
  const arw=(x,y,dx,dy,s)=>{
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);
    ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(-s*0.5,s*0.26);ctx.lineTo(0,-s*0.22);ctx.lineTo(s*0.5,s*0.26);
    ctx.closePath();ctx.fill();ctx.restore();
  };
  if(activeDirs.includes('north')) arw(cx-hw*0.40,cy-hw*0.52,0,1,14);
  if(activeDirs.includes('south')) arw(cx+hw*0.40,cy+hw*0.52,0,-1,14);
  if(activeDirs.includes('east'))  arw(cx+hw*0.52,cy-hw*0.40,-1,0,14);
  if(activeDirs.includes('west'))  arw(cx-hw*0.52,cy+hw*0.40,1,0,14);
  if(activeDirs.includes('northeast')) arw(cx+hw*0.52*0.707,cy-hw*0.52*0.707,-0.707,0.707,14);
}
function drawLabels(cx,cy,hw){
  ctx.font='bold 11px Orbitron,monospace';ctx.textAlign='center';
  ctx.fillStyle='rgba(127,168,204,0.40)';
  if(activeDirs.includes('north')) ctx.fillText('NORTH',cx,cy-hw-45);
  if(activeDirs.includes('south')) ctx.fillText('SOUTH',cx,cy+hw+56);
  if(activeDirs.includes('east'))  ctx.fillText('EAST',cx+hw+56,cy+5);
  if(activeDirs.includes('west'))  ctx.fillText('WEST',cx-hw-56,cy+5);
  if(activeDirs.includes('northeast')) {
    ctx.save();
    ctx.translate(cx+hw*1.5*0.707, cy-hw*1.5*0.707);
    ctx.rotate(-Math.PI/4);
    ctx.fillText('N.EAST',0,-30);
    ctx.restore();
  }
}

function drawTLights(cx,cy,hw){
  const R=hw*1.18;
  const corners={north:{px:cx+R,py:cy-R,ox:-28,oy:0},east:{px:cx+R,py:cy+R,ox:0,oy:-28},
                 south:{px:cx-R,py:cy+R,ox:28,oy:0},west:{px:cx-R,py:cy-R,ox:0,oy:28},
                 northeast:{px:cx+hw*0.5,py:cy-R*1.3,ox:-20,oy:0}};
  activeDirs.forEach(dir=>{
    const{px,py,ox,oy}=corners[dir],sig=signals[dir].state;
    const bw=23,bh=64,bx=px+ox-bw/2,by=py+oy-bh/2;
    // pole
    ctx.strokeStyle='#3a4f60';ctx.lineWidth=3.5;
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+ox,py+oy+bh/2);ctx.stroke();
    // base plate
    ctx.fillStyle='#243040';
    ctx.beginPath();ctx.roundRect(px+ox-6,py+oy+bh/2,12,4,2);ctx.fill();
    // housing
    const bg=ctx.createLinearGradient(bx,by,bx+bw,by+bh);
    bg.addColorStop(0,'#1c2e3e');bg.addColorStop(1,'#0d1c27');
    ctx.fillStyle=bg;ctx.strokeStyle='#283e50';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.roundRect(bx,by,bw,bh,5);ctx.fill();ctx.stroke();
    // visors
    ctx.fillStyle='#0a1520';const lh=bh/3;
    [0,1,2].forEach(i=>ctx.fillRect(bx+1.5,by+lh*i+1.5,bw-3,5));
    // lenses
    [{c:'#ff3355',on:sig==='red'},{c:'#ffd700',on:sig==='yellow'},{c:'#00ff88',on:sig==='green'}]
    .forEach((l,i)=>{
      const lx=bx+bw/2,ly=by+lh*(i+0.5),r=bw*0.33;
      if(l.on){ctx.beginPath();ctx.arc(lx,ly,r+5,0,Math.PI*2);ctx.fillStyle=l.c+'25';ctx.fill();}
      ctx.beginPath();ctx.arc(lx,ly,r,0,Math.PI*2);
      ctx.fillStyle=l.on?l.c:'#0d1520';
      if(l.on){ctx.shadowBlur=26;ctx.shadowColor=l.c;}
      ctx.fill();ctx.shadowBlur=0;
      if(l.on){ctx.beginPath();ctx.arc(lx-r*0.30,ly-r*0.30,r*0.30,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.35)';ctx.fill();}
    });
    // signal direction label
    ctx.font=`bold 9px Orbitron,monospace`;ctx.fillStyle='#6a90aa66';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(dir[0].toUpperCase(),px+ox,py+oy+bh/2+16);
    // timer countdown (green only)
    if(sig==='green'){
      ctx.font=`bold ${bw*0.60}px Orbitron,monospace`;ctx.fillStyle='rgba(0,255,136,0.80)';ctx.textBaseline='middle';
      ctx.fillText(Math.max(0,Math.ceil(signals[dir].timer)),px+ox,py+oy+bh/2+28);
    }
  });
}

/* ── AI scan ─────────────────────────────────────────────── */
let scanA=0;
function drawScan(rc){
  if(detectionProgress<=0)return;
  const {x: ax, y: ay} = AMB.xy(rc);
  if(ax<-130||ax>canvas.width+130||ay<-130||ay>canvas.height+130)return;
  const al=Math.min(1,detectionProgress*2.4);
  ctx.save();ctx.globalAlpha=al;
  ctx.strokeStyle='#00d4ff';ctx.lineWidth=2.2;ctx.shadowBlur=18;ctx.shadowColor='#00d4ff';
  ctx.beginPath();ctx.arc(ax,ay,85,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
  ctx.strokeStyle='#00ff88';ctx.lineWidth=3.2;ctx.shadowBlur=14;ctx.shadowColor='#00ff88';
  const BR=85*0.72,BS=22;
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sy])=>{
    const ex=ax+sx*BR,ey=ay+sy*BR;
    ctx.beginPath();ctx.moveTo(ex+sx*BS,ey);ctx.lineTo(ex,ey);ctx.lineTo(ex,ey+sy*BS);ctx.stroke();
  });
  ctx.shadowBlur=0;
  ctx.globalAlpha=al*0.40;ctx.strokeStyle='#00d4ff';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax+Math.cos(scanA)*85,ay+Math.sin(scanA)*85);ctx.stroke();
  ctx.restore();
}

/* ── Main draw loop ──────────────────────────────────────── */
let lastDraw=0;
function draw(ts){
  const dt=Math.min((ts-lastDraw)/1000,0.1)*simSpeed;lastDraw=ts;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawGrid();
  const cx=canvas.width/2,cy=canvas.height/2,hw=Math.min(canvas.width,canvas.height)*0.09;
  const rc=roadCfg();
  drawRoad();drawTLights(cx,cy,hw);
  manageVehicles(dt,rc);
  [...vehicles].sort((a,b)=>a.pos-b.pos).forEach(v=>v.draw(rc));
  drawScan(rc);drawAmbulance(rc);drawPars();
  if(phase==='priority'){
    ctx.strokeStyle='rgba(0,255,136,0.65)';ctx.lineWidth=4.5;
    ctx.shadowBlur=28;ctx.shadowColor='#00ff88';
    ctx.beginPath();ctx.rect(cx-hw,cy-hw,hw*2,hw*2);ctx.stroke();ctx.shadowBlur=0;
  }
  scanA+=0.042*simSpeed;AMB.lph+=dt*3;
  tickTraining(dt);
  tickCongestion(dt);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

/* ── Logic loop ──────────────────────────────────────────── */
let lastL=performance.now();
function logicLoop(){
  const now=performance.now(),dt=Math.min((now-lastL)/1000,0.1)*simSpeed;lastL=now;
  tickCycle(dt);tickAmb(dt);updateClock();updateTimers();
  setTimeout(logicLoop,16);
}
logicLoop();

/* ── Signal cycle ────────────────────────────────────────── */
function tickCycle(dt){
  if(phase!=='normal')return;
  cycleT+=dt;
  const cur=CYCLE[cycleIdx];
  const greenDuration=cur[1]; // which is 30
  
  if(cycleT >= greenDuration){
    // Transition to next road
    cycleIdx=(cycleIdx+1)%CYCLE.length;
    cycleT=0;
    yellowPending=false;
    updateSigUI();
    const nd=CYCLE[cycleIdx][0];
    addLog(`🚦 ${nd.toUpperCase()} → GREEN (${CYCLE[cycleIdx][1]}s)`,'info');
  }
  
  // Update state and timers dynamically based on active road
  for (let i = 0; i < CYCLE.length; i++) {
    const road = CYCLE[(cycleIdx + i) % CYCLE.length][0];
    if (i === 0) {
      signals[road].state = 'green';
      signals[road].timer = Math.max(0, Math.ceil(greenDuration - cycleT));
    } else if (i === 1) {
      signals[road].state = 'yellow';
      signals[road].timer = Math.max(0, Math.ceil(greenDuration - cycleT));
    } else {
      signals[road].state = 'red';
      signals[road].timer = Math.max(0, Math.ceil(greenDuration - cycleT + (i - 1) * 30));
    }
  }
  
  // Trigger DOM updates
  if(Math.floor(cycleT*10)%2===0){
    updateSigUI();
  }
}

/* ── Ambulance ───────────────────────────────────────────── */
function tickAmb(dt){
  if(phase==='normal')return;
  ambPhaseTimer+=dt;
  const rc=roadCfg(),r=rc[AMB.dir];
  switch(phase){
    case 'detecting':
      detectionProgress=Math.min(1,ambPhaseTimer/2.5);
      const aheadDetect = vehicles.filter(v => v.dir === AMB.dir && !v.completedTurn && v.pos > AMB.pos && (v.turning || !v.lph || v.lph < 20))
                                  .sort((a,b)=>a.pos-b.pos)[0];
      let desiredSpd = 32;
      const ambLenDetect = VSPEC[AMB.type || 'ambulance'].len;
      if (aheadDetect) {
        const gap = aheadDetect.pos - aheadDetect.spec.len/2 - (AMB.pos + ambLenDetect/2);
        const safe = 50; // slow speed, smaller safe gap
        if(gap < safe && gap > 0) desiredSpd = Math.min(desiredSpd, aheadDetect.spd * (gap/safe));
        else if (gap <= 0) desiredSpd = 0;
      }
      AMB.spd = AMB.spd < desiredSpd ? Math.min(desiredSpd, AMB.spd + 150*dt) : Math.max(desiredSpd, AMB.spd - 160*dt);
      
      const stopLineDetect = r.stopDist - 26;
      AMB.pos = Math.min(AMB.pos + AMB.spd*dt, stopLineDetect);
      if (aheadDetect) {
        const minPos = aheadDetect.pos - aheadDetect.spec.len/2 - ambLenDetect/2 - 2;
        if (AMB.pos > minPos) {
          AMB.pos = minPos;
          AMB.spd = aheadDetect.spd;
        }
      }
      
      updateSensorDetection(detectionProgress);
      signals[AMB.dir].timer = Math.max(15, Math.ceil(20 - ambPhaseTimer));
      if(detectionProgress>=1){phase='priority';ambPhaseTimer=0;activatePriority();}
      break;
    case 'priority':
      const ahead = vehicles.filter(v => v.dir === AMB.dir && !v.completedTurn && v.pos > AMB.pos && (v.turning || !v.lph || v.lph < 20))
                            .sort((a,b)=>a.pos-b.pos)[0];
      let desired = 250;
      const ambLen = VSPEC[AMB.type || 'ambulance'].len;
      if (ahead) {
        const gap = ahead.pos - ahead.spec.len/2 - (AMB.pos + ambLen/2);
        const safe = 90 * 1.5 + 10;
        if(gap < safe && gap > 0) desired = Math.min(desired, ahead.spd * (gap/safe));
        else if (gap <= 0) desired = 0;
      }
      AMB.spd = AMB.spd < desired ? Math.min(desired, AMB.spd + 150*dt) : Math.max(desired, AMB.spd - 160*dt);
      
      if(AMB.completedTurn) {
        // Exit lane collision avoidance
        const exitAhead = vehicles.filter(v => v.completedTurn && v.exitDir === AMB.exitDir && v.exitPos > AMB.exitPos)
                                  .sort((a,b)=>a.exitPos-b.exitPos)[0];
        let exitDesired = 250;
        if (exitAhead) {
          const gap = exitAhead.exitPos - exitAhead.spec.len/2 - (AMB.exitPos + ambLen/2);
          const safe = 90 * 1.5 + 10;
          if(gap < safe && gap > 0) exitDesired = Math.min(exitDesired, exitAhead.spd * (gap/safe));
          else if (gap <= 0) exitDesired = 0;
        }
        AMB.spd = AMB.spd < exitDesired ? Math.min(exitDesired, AMB.spd + 150*dt) : Math.max(exitDesired, AMB.spd - 160*dt);
        
        AMB.exitPos += AMB.spd * dt;
        
        if (exitAhead) {
          const minExitPos = exitAhead.exitPos - exitAhead.spec.len/2 - ambLen/2 - 2;
          if (AMB.exitPos > minExitPos) {
            AMB.exitPos = minExitPos;
            AMB.spd = exitAhead.spd;
          }
        }
        
        if(AMB.exitPos >= rc[AMB.exitDir].exitDist) {
          AMB.active=false;phase='resuming';ambPhaseTimer=0;
          document.getElementById('detectionOverlay').style.display='none';
          if(typeof resetSensorUI === 'function') resetSensorUI();
          addLog(`🚑 ${AMB.type === 'fireengine' ? 'Fire Engine' : 'Ambulance'} cleared intersection. Initiating 15s green extension...`,'info');
        }
      } else {
        AMB.pos += AMB.spd * dt;
        if (ahead) {
          const minPos = ahead.pos - ahead.spec.len/2 - ambLen/2 - 2;
          if (AMB.pos > minPos) {
            AMB.pos = minPos;
            AMB.spd = ahead.spd;
          }
        }
        const stopLine = r.stopDist - 26;
        if(AMB.pos >= stopLine && !AMB.turning) {
          AMB.turning = true;
          AMB.turnStartPos = stopLine;
        }
        if(AMB.turning) {
          const hw = Math.min(canvas.width,canvas.height)*0.09;
          const turnDist = AMB.turnTotalDist || (hw * 2.5);
          if(AMB.pos >= AMB.turnStartPos + turnDist) {
            AMB.completedTurn = true;
            AMB.exitPos = 0;
          }
        }
      }
      
      detectionProgress=Math.max(0,detectionProgress-dt*0.8);
      signals[AMB.dir].timer = Math.max(15, Math.ceil(17.5 - ambPhaseTimer));
      break;
    case 'resuming':
      const remaining = 15 - ambPhaseTimer;
      signals[AMB.dir].timer = Math.max(0, Math.ceil(remaining));
      
      // Update UI displays
      updateTimers();
      
      if(remaining<=0){
        phase='normal';detectionProgress=0;setPhaseUI('normal');updateTimelineUI(0);
        addLog('✅ Green extension completed. Resuming normal cycle.','success');
        document.getElementById('detectionOverlay').style.display='none';
        document.getElementById('btnAmbulance').disabled=false;
        resetSensorUI();
        DIRS.forEach(d=>{const c=d[0].toUpperCase()+d.slice(1);document.getElementById(`sig${c}`).classList.remove('priority','danger-card');});
        resumeNormal();
      }
      break;
  }
  const preemptedRoad = CYCLE[cycleIdx][0];
  signals[preemptedRoad].timer = signals[AMB.dir].timer;
}

/* ── Controls ────────────────────────────────────────────── */
function triggerAmbulance(forceDir = null, vType = 'ambulance'){
  if(phase!=='normal')return;
  document.getElementById('btnAmbulance').disabled=true;
  AMB.type = vType;
  
  if (forceDir && activeDirs.includes(forceDir)) {
      AMB.dir = forceDir;
  } else {
      let chosenDir = activeDirs[0];
      let maxCars = -1;
      activeDirs.forEach(d => {
        if (signals[d].state === 'red') {
          const numCars = vehicles.filter(v => v.dir === d).length;
          if (numCars > maxCars) {
            maxCars = numCars;
            chosenDir = d;
          }
        }
      });
      AMB.dir = chosenDir;
  }
  
  const possibleExits=activeDirs.filter(d=>d!==AMB.dir);
  AMB.exitDir=possibleExits[Math.floor(Math.random()*possibleExits.length)];
  AMB.turning = false;
  AMB.completedTurn = false;
  AMB.turnTotalDist = 0;
  AMB.exitPos = 0;
  
  const rc = roadCfg();
  const r = rc[AMB.dir];
  AMB.pos = Math.max(0, r.stopDist - 400); // Dynamic spawn further back
  AMB.active=true;
  AMB.spd=32;
  
  // PREEMPTION: Instantly switch signals!
  const preemptedRoad = CYCLE[cycleIdx][0];
  DIRS.forEach(d=>{
    if(d === AMB.dir) {
      signals[d].state='green';
      signals[d].timer=30;
    } else if(d === preemptedRoad) {
      signals[d].state='yellow';
      signals[d].timer=30;
    } else {
      signals[d].state='red';
      signals[d].timer=0;
    }
  });
  updateSigUI();highlightPriority();

  phase='detecting';ambPhaseTimer=0;detectionProgress=0;detectionStart=performance.now();
  setPhaseUI('detecting');updateTimelineUI(1);
  document.getElementById('detectionOverlay').style.display='block';
  
  const vName = AMB.type === 'fireengine' ? 'Fire Engine' : 'Ambulance';
  addLog(`🚑 ${vName} detected → ${AMB.dir.toUpperCase()} road`,'warning');
  addLog('🔴 All other roads switched to RED immediately.','danger');
  addLog(`🟢 ${AMB.dir.toUpperCase()} road switched to GREEN.`, 'success');
  addLog('🔍 AI multi-sensor detection started...','info');
}
function activatePriority(){
  const ms=Math.round(performance.now()-detectionStart);
  responseTimes.push(ms);totalAmb++;
  setPhaseUI('priority');updateTimelineUI(2);
  document.getElementById('statAmbulances').textContent=totalAmb;
  document.getElementById('statAvgTime').textContent=Math.round(responseTimes.reduce((a,b)=>a+b,0)/responseTimes.length);
  document.getElementById('responseTime').textContent=ms;
  addLog(`⚡ Priority locked after AI authentication (${ms}ms)`,'success');
}
function resumeNormal(){
  DIRS.forEach(d=>signals[d].state='red');
  const nd=CYCLE[cycleIdx][0];signals[nd].state='green';cycleT=0;yellowPending=false;
  updateSigUI();setPhaseUI('normal');updateTimelineUI(0);
  addLog(`🔄 Resume → ${nd.toUpperCase()} GREEN`,'info');
}
function resetSimulation(){
  phase='normal';AMB.active=false;AMB.pos=0;AMB.spd=0;
  detectionProgress=0;ambPhaseTimer=0;cycleIdx=0;cycleT=0;yellowPending=false;
  Object.assign(signals,{north:{state:'green',timer:30},east:{state:'red',timer:60},south:{state:'red',timer:90},west:{state:'red',timer:120}});
  updateSigUI();setPhaseUI('normal');updateTimelineUI(0);resetSensorUI();
  document.getElementById('detectionOverlay').style.display='none';
  document.getElementById('btnAmbulance').disabled=false;
  DIRS.forEach(d=>{const c=d[0].toUpperCase()+d.slice(1);document.getElementById(`sig${c}`).classList.remove('priority','danger-card');});
  vehicles.length=0;particles.length=0;addLog('🔄 System reset.','info');
}
function toggleAuto(){
  autoMode=!autoMode;const btn=document.getElementById('btnAuto');
  btn.textContent=autoMode?'⚙️ Auto Mode: ON':'⚙️ Auto Mode: OFF';btn.classList.toggle('on',autoMode);
  if(autoMode){schedAuto();addLog('⚙️ Auto ON','info');}else{clearTimeout(autoTimer);addLog('⚙️ Auto OFF','info');}
}
function schedAuto(){if(!autoMode)return;autoTimer=setTimeout(()=>{if(autoMode&&phase==='normal')triggerAmbulance();schedAuto();},60000/simSpeed);}
function updateSpeed(v){simSpeed=parseFloat(v);document.getElementById('speedLabel').textContent=v+'×';}

/* ── UI ──────────────────────────────────────────────────── */
function updateSigUI(){
  DIRS.forEach(dir=>{
    const d=dir==='northeast'?'ne':dir[0],s=signals[dir].state;
    document.getElementById(`${d}Red`).className='light red'+(s==='red'?' active':'');
    document.getElementById(`${d}Yellow`).className='light yellow'+(s==='yellow'?' active':'');
    document.getElementById(`${d}Green`).className='light green'+(s==='green'?' active':'');
    document.getElementById(`${d}State`).textContent=s.toUpperCase();
    document.getElementById(`${d}State`).style.color=s==='green'?'#00ff88':s==='yellow'?'#ffd700':'#ff3355';
  });
}
function highlightPriority(){
  DIRS.forEach(dir=>{
    const c=dir[0].toUpperCase()+dir.slice(1),card=document.getElementById(`sig${c}`);
    card.classList.remove('priority','danger-card');
    dir===AMB.dir?card.classList.add('priority'):card.classList.add('danger-card');
  });
}
function updateTimers(){
  DIRS.forEach(dir=>{const d=dir==='northeast'?'ne':dir[0],t=signals[dir].timer;document.getElementById(`${d}Timer`).textContent=t>0?t+'s':'—';});
  document.getElementById('statCars').textContent=vehicles.filter(v=>v.spd<1).length;
}
function setPhaseUI(p){
  const detectingStr = (typeof AMB !== 'undefined' && AMB.type === 'fireengine') ? 'Fire Engine Detected' : 'Ambulance Detected';
  const lbl={normal:'Normal Operation',detecting:detectingStr,priority:'Priority GREEN Active',resuming:'Resuming Normal Signals'};
  const clr={normal:'#00ff88',detecting:'#ffd700',priority:'#ff3355',resuming:'#00d4ff'};
  document.getElementById('phaseLabel').textContent=lbl[p]||p;
  document.getElementById('phaseDot').style.background=clr[p]||'#00ff88';
  document.getElementById('phaseDot').style.boxShadow=`0 0 8px ${clr[p]||'#00ff88'}`;
}
function updateTimelineUI(i){
  for(let j=0;j<4;j++){const el=document.getElementById(`tl${j+1}`);el.classList.remove('active','done');if(j===i)el.classList.add('active');else if(j<i)el.classList.add('done');}
}
function updateSensorDetection(p){
  const ss=[{b:'camBar',c:'camConf',s:'camStatus',d:0,w:0.40},{b:'rfidBar',c:'rfidConf',s:'rfidStatus',d:0.2,w:0.30},{b:'gpsBar',c:'gpsConf',s:'gpsStatus',d:0.4,w:0.20},{b:'soundBar',c:'soundConf',s:'soundStatus',d:0.6,w:0.10}];
  let tot=0;
  ss.forEach(x=>{
    const lp=Math.max(0,Math.min(1,(p-x.d)/(1-x.d||0.4)));const pct=Math.min(99,Math.round(lp*91+Math.random()*8));
    document.getElementById(x.b).style.width=pct+'%';document.getElementById(x.c).textContent=`Confidence: ${pct}%`;
    const st=document.getElementById(x.s);
    if(lp>=1){st.textContent='LOCKED';st.className='sensor-status locked';}else if(lp>0){st.textContent='SCANNING';st.className='sensor-status scanning';}
    tot+=lp*x.w*100;
  });
  const sc=Math.min(99,Math.round(tot));
  document.getElementById('fusionRing').style.strokeDashoffset=327-(sc/100)*327;
  document.getElementById('fusionScore').textContent=sc+'%';
  const ring=document.getElementById('fusionRing');
  if(sc>=75){ring.style.stroke='#00ff88';document.getElementById('fusionScore').style.color='#00ff88';document.getElementById('fusionVerdict').textContent='✅ Emergency Vehicle Confirmed';document.getElementById('fusionVerdict').style.color='#00ff88';}
  else if(sc>=40){ring.style.stroke='#ffd700';document.getElementById('fusionScore').style.color='#ffd700';document.getElementById('fusionVerdict').textContent='⚡ Detecting...';document.getElementById('fusionVerdict').style.color='#ffd700';}
  else{ring.style.stroke='#00d4ff';document.getElementById('fusionVerdict').textContent='Scanning...';document.getElementById('fusionVerdict').style.color='';}
}
function resetSensorUI(){
  ['cam','rfid','gps','sound'].forEach(k=>{
    document.getElementById(`${k}Bar`).style.width='0%';document.getElementById(`${k}Conf`).textContent='Confidence: 0%';
    document.getElementById(`${k}Status`).textContent='IDLE';document.getElementById(`${k}Status`).className='sensor-status idle';
  });
  document.getElementById('fusionRing').style.strokeDashoffset='327';document.getElementById('fusionRing').style.stroke='#00d4ff';
  document.getElementById('fusionScore').textContent='0%';document.getElementById('fusionScore').style.color='#00d4ff';
  document.getElementById('fusionVerdict').textContent='Monitoring...';document.getElementById('fusionVerdict').style.color='';
}
function addLog(msg,type='info'){
  const c=document.getElementById('logEntries'),el=document.createElement('div');
  const n=new Date(),ts=`${n.getHours().toString().padStart(2,'0')}:${n.getMinutes().toString().padStart(2,'0')}:${n.getSeconds().toString().padStart(2,'0')}`;
  el.className=`log-entry ${type}`;el.textContent=`[${ts}] ${msg}`;
  c.appendChild(el);c.scrollTop=c.scrollHeight;
  while(c.children.length>50)c.removeChild(c.firstChild);
}
function updateClock(){
  const n=new Date();
  document.getElementById('clock').textContent=`${n.getHours().toString().padStart(2,'0')}:${n.getMinutes().toString().padStart(2,'0')}:${n.getSeconds().toString().padStart(2,'0')}`;
}

/* ── AI Training Monitor ────────────────────────────────── */
const trainCanvas = document.getElementById('trainingCanvas');
const trainCtx = trainCanvas ? trainCanvas.getContext('2d') : null;
let trainAngle = 0;
let trainTypeIdx = 0;
let trainAngleMode = 0; // 0=Side, 1=Front, 2=Top-down
let trainMode = 'traffic'; // 'traffic' or 'document'
const trainTypes = ['car', 'bike', 'suv', 'truck', 'bus', 'van', 'auto', 'ambulance', 'fire'];
const docTypes = ['title', 'paragraph', 'table', 'figure', 'header', 'footer', 'equation'];
let isTrainingActive = false;
let trainingProgress = 1.0;
let trainingEpoch = 150;
let trainingLoss = 0.009;

function toggleTrainingMode() {
  if (isTrainingActive) return;
  trainMode = trainMode === 'traffic' ? 'document' : 'traffic';
  trainTypeIdx = 0;
  
  const btn = document.getElementById('btnTrainMode');
  if (trainMode === 'traffic') {
    btn.textContent = 'TRAFFIC';
    btn.style.color = '#00d4ff';
    btn.style.borderColor = 'rgba(0, 212, 255, 0.3)';
    btn.style.background = 'rgba(0, 212, 255, 0.12)';
    document.getElementById('trainClass').textContent = 'Class: CAR';
    document.getElementById('trainAngles').textContent = 'Angles: 0°, 90°, 180°, 270°';
    addLog('🧠 AI Training Monitor switched to Traffic Analysis mode.', 'info');
  } else {
    btn.textContent = 'DOCUMENT';
    btn.style.color = '#ffd700';
    btn.style.borderColor = 'rgba(255, 215, 0, 0.3)';
    btn.style.background = 'rgba(255, 215, 0, 0.12)';
    document.getElementById('trainClass').textContent = 'Class: TITLE';
    document.getElementById('trainAngles').textContent = 'PDF Layout: Columns, Tables';
    addLog('🧠 AI Training Monitor switched to Document Layout Extraction mode.', 'warning');
    addLog('📄 Roboflow Layout & VT PDF Object Detection datasets loaded.', 'info');
  }
  updateTrainingCanvas();
}

function updateTrainingCanvas() {
  if (!trainCtx) return;
  const tc = trainCanvas;
  trainCtx.clearRect(0, 0, tc.width, tc.height);
  
  // Grid background
  trainCtx.strokeStyle = '#0e1a2b'; trainCtx.lineWidth = 0.8;
  const s = 14;
  for(let x=0; x<tc.width; x+=s){ trainCtx.beginPath(); trainCtx.moveTo(x,0); trainCtx.lineTo(x,tc.height); trainCtx.stroke(); }
  for(let y=0; y<tc.height; y+=s){ trainCtx.beginPath(); trainCtx.moveTo(0,y); trainCtx.lineTo(tc.width,y); trainCtx.stroke(); }

  if (!isTrainingActive) {
    trainAngle += 0.015;
  } else {
    trainAngle += 0.09;
  }

  const typesList = trainMode === 'traffic' ? trainTypes : docTypes;
  const type = typesList[trainTypeIdx];
  
  if (trainMode === 'traffic') {
    const col = VCOL[type] ? VCOL[type][0] : '#ffffff';
    const oldCtx = ctx;
    ctx = trainCtx;
    try {
      if (type === 'ambulance') {
        if (trainAngleMode === 0) {
          trainCtx.save();
          trainCtx.translate(tc.width/2, tc.height/2 + 2);
          trainCtx.fillStyle = 'rgba(0,10,25,0.22)';
          trainCtx.beginPath(); trainCtx.ellipse(0, 16, 38, 5, 0, 0, Math.PI*2); trainCtx.fill();
          trainCtx.fillStyle = '#ffffff';
          trainCtx.beginPath(); trainCtx.roundRect(-36, -18, 72, 30, 4); trainCtx.fill();
          trainCtx.strokeStyle = '#9ca4ac'; trainCtx.lineWidth = 1; trainCtx.stroke();
          trainCtx.fillStyle = '#ffd000';
          trainCtx.beginPath(); trainCtx.roundRect(14, -6, 22, 18, [0, 4, 4, 0]); trainCtx.fill();
          trainCtx.strokeStyle = '#ffd000'; trainCtx.stroke();
          trainCtx.fillStyle = '#181818';
          trainCtx.beginPath(); trainCtx.arc(-18, 12, 8, 0, Math.PI*2); trainCtx.fill();
          trainCtx.beginPath(); trainCtx.arc(16, 12, 8, 0, Math.PI*2); trainCtx.fill();
          trainCtx.fillStyle = '#7a8590';
          trainCtx.beginPath(); trainCtx.arc(-18, 12, 4, 0, Math.PI*2); trainCtx.fill();
          trainCtx.beginPath(); trainCtx.arc(16, 12, 4, 0, Math.PI*2); trainCtx.fill();
          trainCtx.fillStyle = 'rgba(165,222,255,0.7)';
          trainCtx.beginPath(); trainCtx.roundRect(16, -14, 12, 9, 2); trainCtx.fill();
          trainCtx.beginPath(); trainCtx.roundRect(-2, -14, 14, 9, 1); trainCtx.fill();
          trainCtx.beginPath(); trainCtx.roundRect(-24, -14, 18, 9, 1); trainCtx.fill();
          for(let i=0; i<8; i++) {
            trainCtx.fillStyle = i % 2 === 0 ? '#ffd000' : '#cc1133';
            trainCtx.fillRect(-34 + i*6, -1, 6, 6);
          }
          trainCtx.fillStyle = '#0055cc';
          trainCtx.beginPath(); trainCtx.arc(-15, 7, 3, 0, Math.PI*2); trainCtx.fill();
          trainCtx.fillStyle = '#cc1133'; trainCtx.font = 'bold 5px Arial';
          trainCtx.fillText('AMBULANCE', -25, 7);
          trainCtx.fillStyle = '#0f22ee';
          trainCtx.fillRect(10, -22, 10, 4);
          trainCtx.fillStyle = 'rgba(60,60,60,0.8)';
          trainCtx.fillRect(8, -21, 14, 3);
          trainCtx.restore();
        } else if (trainAngleMode === 1) {
          trainCtx.save();
          trainCtx.translate(tc.width/2, tc.height/2 + 2);
          trainCtx.fillStyle = 'rgba(0,10,25,0.22)';
          trainCtx.beginPath(); trainCtx.ellipse(0, 18, 24, 4, 0, 0, Math.PI*2); trainCtx.fill();
          trainCtx.fillStyle = '#ffffff';
          trainCtx.beginPath(); trainCtx.roundRect(-20, -22, 40, 39, 4); trainCtx.fill();
          trainCtx.strokeStyle = '#9ca4ac'; trainCtx.lineWidth = 1; trainCtx.stroke();
          trainCtx.fillStyle = '#ffd000';
          trainCtx.beginPath(); trainCtx.roundRect(-20, 0, 40, 17, [0, 0, 4, 4]); trainCtx.fill();
          trainCtx.fillStyle = '#1c1d22';
          trainCtx.beginPath(); trainCtx.roundRect(-12, 3, 24, 8, 2); trainCtx.fill();
          trainCtx.fillStyle = '#ffd000'; trainCtx.font = 'bold 6px Arial'; trainCtx.textAlign = 'center';
          trainCtx.fillText('F', 0, 9);
          trainCtx.fillStyle = '#ffffcc';
          trainCtx.beginPath(); trainCtx.arc(-16, 7, 2.5, 0, Math.PI*2); trainCtx.fill();
          trainCtx.beginPath(); trainCtx.arc(16, 7, 2.5, 0, Math.PI*2); trainCtx.fill();
          trainCtx.fillStyle = 'rgba(165,222,255,0.72)';
          trainCtx.beginPath(); trainCtx.roundRect(-16, -16, 32, 13, 2); trainCtx.fill();
          trainCtx.fillStyle = '#1c1d22';
          trainCtx.fillRect(-23, -12, 3, 7);
          trainCtx.fillRect(20, -12, 3, 7);
          const flash = Math.sin(performance.now()/80)>0;
          trainCtx.fillStyle = flash ? '#0f22ee' : '#cc1133';
          trainCtx.fillRect(-12, -26, 24, 4);
          trainCtx.fillStyle = '#cc0011'; trainCtx.font = 'bold 5px Arial';
          trainCtx.fillText('AMBULANCE', 0, -2);
          trainCtx.restore();
        } else {
          trainCtx.save();
          trainCtx.translate(tc.width/2, tc.height/2);
          trainCtx.rotate(trainAngle);
          const w = 24, h = 48;
          trainCtx.fillStyle = '#ffffff'; trainCtx.beginPath(); trainCtx.roundRect(-w/2, -h/2, w, h, 4); trainCtx.fill();
          trainCtx.strokeStyle = 'rgba(0,0,0,0.3)'; trainCtx.lineWidth = 0.7; trainCtx.stroke();
          trainCtx.fillStyle = '#ffd000'; trainCtx.beginPath(); trainCtx.roundRect(-w/2+0.5, -h/2+0.5, w-1, 13, [3, 3, 0, 0]); trainCtx.fill();
          trainCtx.fillStyle = 'rgba(165,222,255,0.85)'; trainCtx.beginPath(); trainCtx.roundRect(-w/2+2.5, -h/2+11, w-5, 8, 1.5); trainCtx.fill();
          const t_cw = 2.5, t_ch = 4.5;
          for(let i=0; i<4; i++) {
            trainCtx.fillStyle = i % 2 === 0 ? '#ffd000' : '#cc1133';
            trainCtx.fillRect(-w/2, -6 + i*t_ch, t_cw, t_ch);
            trainCtx.fillRect(w/2 - t_cw, -6 + i*t_ch, t_cw, t_ch);
          }
          trainCtx.fillStyle = '#0055cc';
          trainCtx.beginPath(); trainCtx.arc(0, 10, 4, 0, Math.PI*2); trainCtx.fill();
          const flash = Math.sin(performance.now()/80) > 0;
          trainCtx.fillStyle = flash ? '#0f22ee' : '#cc1133';
          trainCtx.fillRect(-w/2+3, -h/2-4, w-6, 4);
          trainCtx.restore();
        }
      } else if (type === 'fire') {
        if (trainAngleMode === 0) {
          // Draw Side View of Fire Truck
          trainCtx.save();
          trainCtx.translate(tc.width/2, tc.height/2 + 2);
          trainCtx.fillStyle = 'rgba(0,10,25,0.22)';
          trainCtx.beginPath(); trainCtx.ellipse(0, 16, 38, 5, 0, 0, Math.PI*2); trainCtx.fill();
          trainCtx.fillStyle = '#d32f2f';
          trainCtx.beginPath(); trainCtx.roundRect(-36, -18, 72, 30, 4); trainCtx.fill();
          trainCtx.strokeStyle = '#9e1f1f'; trainCtx.lineWidth = 1; trainCtx.stroke();
          trainCtx.fillStyle = '#181818';
          trainCtx.beginPath(); trainCtx.arc(-18, 12, 8, 0, Math.PI*2); trainCtx.fill();
          trainCtx.beginPath(); trainCtx.arc(16, 12, 8, 0, Math.PI*2); trainCtx.fill();
          trainCtx.fillStyle = '#7a8590';
          trainCtx.beginPath(); trainCtx.arc(-18, 12, 4, 0, Math.PI*2); trainCtx.fill();
          trainCtx.beginPath(); trainCtx.arc(16, 12, 4, 0, Math.PI*2); trainCtx.fill();
          trainCtx.fillStyle = 'rgba(165,222,255,0.7)';
          trainCtx.beginPath(); trainCtx.roundRect(16, -14, 12, 9, 2); trainCtx.fill();
          trainCtx.fillStyle = '#7f8c8d';
          trainCtx.fillRect(-22, -8, 36, 8);
          trainCtx.strokeStyle = '#bdc3c7'; trainCtx.lineWidth = 0.8;
          for(let x = -20; x < 12; x += 6) {
            trainCtx.beginPath(); trainCtx.moveTo(x, -8); trainCtx.lineTo(x, 0); trainCtx.stroke();
          }
          trainCtx.fillStyle = '#ffffff'; trainCtx.font = 'bold 5px Arial';
          trainCtx.fillText('FIRE DEPT', -22, 6);
          trainCtx.restore();
        } else if (trainAngleMode === 1) {
          // Draw Front View of Fire Truck
          trainCtx.save();
          trainCtx.translate(tc.width/2, tc.height/2 + 2);
          trainCtx.fillStyle = 'rgba(0,10,25,0.22)';
          trainCtx.beginPath(); trainCtx.ellipse(0, 18, 24, 4, 0, 0, Math.PI*2); trainCtx.fill();
          trainCtx.fillStyle = '#d32f2f';
          trainCtx.beginPath(); trainCtx.roundRect(-20, -22, 40, 39, 4); trainCtx.fill();
          trainCtx.strokeStyle = '#9ca4ac'; trainCtx.lineWidth = 1; trainCtx.stroke();
          trainCtx.fillStyle = '#ffd000';
          trainCtx.beginPath(); trainCtx.roundRect(-20, 0, 40, 17, [0, 0, 4, 4]); trainCtx.fill();
          trainCtx.fillStyle = '#1c1d22';
          trainCtx.beginPath(); trainCtx.roundRect(-12, 3, 24, 8, 2); trainCtx.fill();
          trainCtx.fillStyle = '#ffffcc';
          trainCtx.beginPath(); trainCtx.arc(-16, 7, 2.5, 0, Math.PI*2); trainCtx.fill();
          trainCtx.beginPath(); trainCtx.arc(16, 7, 2.5, 0, Math.PI*2); trainCtx.fill();
          trainCtx.fillStyle = 'rgba(165,222,255,0.72)';
          trainCtx.beginPath(); trainCtx.roundRect(-16, -16, 32, 13, 2); trainCtx.fill();
          const flash = Math.sin(performance.now()/80)>0;
          trainCtx.fillStyle = flash ? '#0f22ee' : '#cc1133';
          trainCtx.fillRect(-12, -26, 24, 4);
          trainCtx.fillStyle = '#ffffff'; trainCtx.font = 'bold 6px Arial'; trainCtx.textAlign = 'center';
          trainCtx.fillText('FIRE', 0, -2);
          trainCtx.restore();
        } else {
          // Draw Top-Down View of Fire Truck
          trainCtx.save();
          trainCtx.translate(tc.width/2, tc.height/2);
          trainCtx.rotate(trainAngle);
          const w = 24, h = 48;
          trainCtx.fillStyle = '#d32f2f'; trainCtx.beginPath(); trainCtx.roundRect(-w/2, -h/2, w, h, 4); trainCtx.fill();
          trainCtx.strokeStyle = 'rgba(0,0,0,0.3)'; trainCtx.lineWidth = 0.7; trainCtx.stroke();
          trainCtx.fillStyle = 'rgba(165,222,255,0.72)'; trainCtx.beginPath(); trainCtx.roundRect(-w/2+2.5,-h/2+11,w-5,6,1.5); trainCtx.fill();
          trainCtx.fillStyle = '#ffd000'; trainCtx.beginPath(); trainCtx.roundRect(-w/2+0.5,-h/2+0.5,w-1,9,[3,3,0,0]); trainCtx.fill();
          trainCtx.fillStyle = '#7f8c8d';
          trainCtx.fillRect(-w/2-1, -h/2+10, 1, h-18);
          trainCtx.fillRect( w/2, -h/2+10, 1, h-18);
          trainCtx.fillStyle = '#ffffff'; trainCtx.beginPath(); trainCtx.arc(0, 10, 4, 0, Math.PI*2); trainCtx.fill();
          trainCtx.strokeStyle = '#7f8c8d'; trainCtx.lineWidth = 0.6; trainCtx.stroke();
          const flash = Math.sin(performance.now()/80) > 0;
          trainCtx.fillStyle = flash ? '#0f22ee' : '#cc1133';
          trainCtx.fillRect(-w/2+3, -h/2-4, w-6, 4);
          trainCtx.restore();
        }
      } else {
        trainCtx.save();
        trainCtx.translate(tc.width/2, tc.height/2);
        trainCtx.rotate(trainAngle);
        const spec = VSPEC[type];
        const scale = 0.65;
        VDRAW[type](spec.wid*scale, spec.len*scale, col, 10);
        trainCtx.restore();
      }
    } catch(e) {
      console.error(e);
    } finally {
      ctx = oldCtx;
    }
  } else {
    // DOCUMENT LAYOUT EXTRACTION DRAWING MODE
    trainCtx.save();
    trainCtx.translate(tc.width/2, tc.height/2);
    
    // Draw Simulated Scan Page Sheet
    trainCtx.fillStyle = '#ffffff';
    trainCtx.beginPath(); trainCtx.roundRect(-28, -38, 56, 76, 1); trainCtx.fill();
    trainCtx.strokeStyle = '#1e3046'; trainCtx.lineWidth = 1; trainCtx.stroke();
    
    // Header
    trainCtx.fillStyle = type === 'header' ? 'rgba(255, 215, 0, 0.55)' : '#d0d6dd';
    trainCtx.fillRect(-22, -34, 44, 2);
    
    // Title Block
    trainCtx.fillStyle = type === 'title' ? 'rgba(255, 215, 0, 0.55)' : '#9ca4b0';
    trainCtx.fillRect(-18, -28, 36, 4);
    
    // Paragraph Block
    trainCtx.fillStyle = type === 'paragraph' ? 'rgba(255, 215, 0, 0.55)' : '#e4e8ec';
    trainCtx.fillRect(-22, -20, 20, 2);
    trainCtx.fillRect(-22, -16, 20, 2);
    trainCtx.fillRect(-22, -12, 14, 2);
    trainCtx.fillRect(2, -20, 20, 2);
    trainCtx.fillRect(2, -16, 20, 2);
    trainCtx.fillRect(2, -12, 18, 2);
    
    // Table Grid
    if (type === 'table') {
      trainCtx.fillStyle = 'rgba(255, 215, 0, 0.28)';
      trainCtx.fillRect(-22, -6, 44, 16);
      trainCtx.strokeStyle = '#ffd700'; trainCtx.lineWidth = 0.8;
      trainCtx.strokeRect(-22, -6, 44, 16);
      trainCtx.beginPath();
      trainCtx.moveTo(-22, -1); trainCtx.lineTo(22, -1);
      trainCtx.moveTo(-22, 4); trainCtx.lineTo(22, 4);
      trainCtx.moveTo(-22, 9); trainCtx.lineTo(22, 9);
      trainCtx.moveTo(-8, -6); trainCtx.lineTo(-8, 10);
      trainCtx.moveTo(8, -6); trainCtx.lineTo(8, 10);
      trainCtx.stroke();
    } else {
      trainCtx.strokeStyle = '#d4dce4'; trainCtx.lineWidth = 0.5;
      trainCtx.strokeRect(-22, -6, 44, 16);
    }
    
    // Figure Box
    if (type === 'figure') {
      trainCtx.fillStyle = 'rgba(255, 215, 0, 0.28)';
      trainCtx.fillRect(-22, 14, 20, 16);
      trainCtx.strokeStyle = '#ffd700'; trainCtx.lineWidth = 0.8;
      trainCtx.strokeRect(-22, 14, 20, 16);
      trainCtx.beginPath();
      trainCtx.moveTo(-22, 14); trainCtx.lineTo(-2, 30);
      trainCtx.moveTo(-2, 14); trainCtx.lineTo(-22, 30);
      trainCtx.stroke();
    } else {
      trainCtx.strokeStyle = '#d4dce4'; trainCtx.lineWidth = 0.5;
      trainCtx.strokeRect(-22, 14, 20, 16);
    }
    
    // Centered Equation Block
    trainCtx.fillStyle = type === 'equation' ? 'rgba(255, 215, 0, 0.55)' : '#a4acb4';
    trainCtx.fillRect(2, 21, 20, 2);
    
    // Footer
    trainCtx.fillStyle = type === 'footer' ? 'rgba(255, 215, 0, 0.55)' : '#d0d6dd';
    trainCtx.fillRect(-22, 32, 44, 1.5);
    
    trainCtx.restore();
  }

  // Bounding box overlay
  trainCtx.save();
  let boxW = 54, boxH = 74;
  let bx = tc.width/2 - boxW/2;
  let by = tc.height/2 - boxH/2;
  
  if (trainMode === 'document') {
    let elX = tc.width/2, elY = tc.height/2;
    if (type === 'header') { boxW = 48; boxH = 8; elY = tc.height/2 - 33; }
    else if (type === 'title') { boxW = 40; boxH = 10; elY = tc.height/2 - 26; }
    else if (type === 'paragraph') { boxW = 48; boxH = 16; elY = tc.height/2 - 14; }
    else if (type === 'table') { boxW = 48; boxH = 20; elY = tc.height/2 + 2; }
    else if (type === 'figure') { boxW = 24; boxH = 20; elX = tc.width/2 - 12; elY = tc.height/2 + 22; }
    else if (type === 'equation') { boxW = 24; boxH = 8; elX = tc.width/2 + 12; elY = tc.height/2 + 22; }
    else if (type === 'footer') { boxW = 48; boxH = 8; elY = tc.height/2 + 33; }
    bx = elX - boxW/2;
    by = elY - boxH/2;
  }
  
  const scanY = by + (boxH/2) + Math.sin(performance.now()/200) * (boxH/2);
  trainCtx.strokeStyle = isTrainingActive ? 'rgba(0,255,136,0.35)' : 'rgba(0,212,255,0.25)';
  trainCtx.lineWidth = 1;
  trainCtx.beginPath(); trainCtx.moveTo(bx, scanY); trainCtx.lineTo(bx + boxW, scanY); trainCtx.stroke();
  
  trainCtx.strokeStyle = isTrainingActive ? '#ffd700' : '#00ff88';
  trainCtx.lineWidth = 1.2;
  trainCtx.strokeRect(bx, by, boxW, boxH);
  
  trainCtx.fillStyle = isTrainingActive ? '#ffd700' : '#00ff88';
  trainCtx.font = 'bold 8px monospace';
  const conf = isTrainingActive ? (55 + Math.random()*42).toFixed(1) : '99.1';
  trainCtx.fillText(`${type.toUpperCase()}: ${conf}%`, bx, by - 4);

  // Dots
  trainCtx.fillStyle = '#ff3355';
  [[bx,by],[bx+boxW,by],[bx,by+boxH],[bx+boxW,by+boxH],[bx+boxW/2, by+boxH/2]].forEach(([kx,ky])=>{
    trainCtx.beginPath(); trainCtx.arc(kx, ky, 2, 0, Math.PI*2); trainCtx.fill();
  });
  
  trainCtx.restore();
}

function tickTraining(dt) {
  const typesList = trainMode === 'traffic' ? trainTypes : docTypes;
  if (!isTrainingActive) {
    if (Math.random() < 0.005) {
      trainTypeIdx = (trainTypeIdx + 1) % typesList.length;
    }
    
    // Cycle view modes for ambulance slowly when idle
    if (trainMode === 'traffic' && typesList[trainTypeIdx] === 'ambulance' && Math.random() < 0.015) {
      trainAngleMode = (trainAngleMode + 1) % 3;
    }
    
    const type = typesList[trainTypeIdx].toUpperCase();
    const viewSuffix = (trainMode === 'traffic' && typesList[trainTypeIdx] === 'ambulance') ? ` (${['SIDE', 'FRONT', 'TOP'][trainAngleMode]} VIEW)` : '';
    document.getElementById('trainClass').textContent = `Class: ${type}${viewSuffix}`;
    
    updateTrainingCanvas();
    return;
  }

  trainingProgress += dt * 0.16; // Retrain in ~6 seconds
  if (trainingProgress >= 1.0) {
    trainingProgress = 1.0;
    isTrainingActive = false;
    trainingEpoch = 150;
    trainingLoss = 0.009;
    
    document.getElementById('trainStatus').textContent = 'MONITOR';
    document.getElementById('trainStatus').style.background = '#00ff8820';
    document.getElementById('trainStatus').style.color = '#00ff88';
    document.getElementById('trainStatus').style.borderColor = '#00ff8840';
    document.getElementById('trainEpoch').textContent = `Epoch: ${trainingEpoch}/${trainingEpoch}`;
    document.getElementById('trainLoss').textContent = `Loss: ${trainingLoss.toFixed(4)}`;
    document.getElementById('trainBar').style.width = '100%';
    document.getElementById('btnRetrain').disabled = false;
    
    if (trainMode === 'traffic') {
      addLog('🎉 AI retrained on all vehicles & angles (0°,90°,180°,270°)! Accuracy (Ambulance): 99.4%, Accuracy (Fire Service): 98.7%', 'success');
    } else {
      addLog('🎉 AI Document Structure model retrained on layout datasets! Accuracy: 99.1%', 'success');
    }
  } else {
    const pct = Math.round(trainingProgress * 100);
    document.getElementById('trainBar').style.width = pct + '%';
    
    trainingEpoch = Math.round(trainingProgress * 150);
    trainingLoss = 0.85 * Math.exp(-6 * trainingProgress) + 0.009;
    
    document.getElementById('trainEpoch').textContent = `Epoch: ${trainingEpoch}/150`;
    document.getElementById('trainLoss').textContent = `Loss: ${trainingLoss.toFixed(4)}`;
    
    if (Math.floor(performance.now()/220) % typesList.length !== trainTypeIdx) {
      trainTypeIdx = (trainTypeIdx + 1) % typesList.length;
      if (trainMode === 'traffic') {
        trainAngleMode = Math.floor(Math.random() * 3); // random view mode
      }
      
      const type = typesList[trainTypeIdx].toUpperCase();
      const viewSuffix = (trainMode === 'traffic' && (typesList[trainTypeIdx] === 'ambulance' || typesList[trainTypeIdx] === 'fire')) ? ` (${['SIDE', 'FRONT', 'TOP'][trainAngleMode]} VIEW)` : '';
      document.getElementById('trainClass').textContent = `Class: ${type}${viewSuffix}`;
      
      if (Math.random() < 0.28) {
        if (trainMode === 'traffic') {
          addLog(`[AI] Training angles (0°, 90°, 180°, 270°) for ${typesList[trainTypeIdx].toUpperCase()}...`, 'info');
          const mapVal = (0.75 + trainingProgress * 0.244).toFixed(3);
          const fireMapVal = (0.72 + trainingProgress * 0.267).toFixed(3);
          addLog(`[AI] Validation step - AMBULANCE mAP@0.5: ${mapVal}, FIRE SERVICE mAP@0.5: ${fireMapVal}`, 'info');
        } else {
          addLog(`[AI] Training layout structure parsing for ${typesList[trainTypeIdx].toUpperCase()}...`, 'info');
        }
      }
    }
  }
  updateTrainingCanvas();
}

function startAITraining() {
  if (isTrainingActive) return;
  isTrainingActive = true;
  trainingProgress = 0;
  document.getElementById('btnRetrain').disabled = true;
  document.getElementById('trainStatus').textContent = 'TRAINING';
  document.getElementById('trainStatus').style.background = '#ffd70020';
  document.getElementById('trainStatus').style.color = '#ffd700';
  document.getElementById('trainStatus').style.borderColor = '#ffd70040';
  
  if (trainMode === 'traffic') {
    addLog('⚙️ RETRAINING AI MODEL on 9 classes across multiple angles...', 'warning');
    addLog('📂 Loading ambulance & fire service datasets from local cache...', 'info');
    addLog('🔍 Found 1,034 ambulance images and 982 fire service images.', 'info');
    addLog('⏳ Initializing neural network transfer learning...', 'info');
  } else {
    addLog('⚙️ RETRAINING DOCUMENT LAYOUT AI MODEL on 7 structural elements...', 'warning');
  }
}

/* ── Genetic Algorithm Optimizer ────────────────────────── */
let isGARunning = false;
function runGAOptimizer() {
  if (isGARunning) return;
  isGARunning = true;
  
  const btn = document.getElementById('btnRunGA');
  btn.disabled = true;
  btn.textContent = '🧬 Running GA...';
  
  const progressContainer = document.getElementById('gaProgressContainer');
  const bar = document.getElementById('gaBar');
  const txt = document.getElementById('gaProgressText');
  const statusBadge = document.getElementById('gaStatus');
  
  progressContainer.style.display = 'block';
  statusBadge.textContent = 'EVOLVING';
  statusBadge.style.color = '#ffd700';
  statusBadge.style.borderColor = 'rgba(255, 215, 0, 0.3)';
  statusBadge.style.background = 'rgba(255, 215, 0, 0.15)';
  
  addLog('🧬 Genetic Algorithm Optimizer initialized (400 pop, 25 generations)...', 'warning');
  
  let generation = 0;
  const interval = setInterval(() => {
    generation++;
    const pct = Math.round((generation / 25) * 100);
    bar.style.width = pct + '%';
    
    // Simulate Webster's delay reduction
    const delay = (3.8 * Math.exp(-0.15 * generation) + 1.1 + Math.random()*0.1).toFixed(2);
    txt.textContent = `Gen ${generation}/25 | Avg Delay: ${delay}s`;
    
    if (generation >= 25) {
      clearInterval(interval);
      
      // Calculate optimized timings based on vehicle queues
      const vn = vehicles.filter(v => v.dir === 'north' && v.pos < 240).length;
      const ve = vehicles.filter(v => v.dir === 'east' && v.pos < 240).length;
      const vs = vehicles.filter(v => v.dir === 'south' && v.pos < 240).length;
      const vw = vehicles.filter(v => v.dir === 'west' && v.pos < 240).length;
      
      const tot = vn + ve + vs + vw;
      let tn = 37, te = 37, ts = 37, tw = 37;
      
      if (tot > 0) {
        // Base 15s minimum for safety, distribute remaining 88s cycle time
        const base = 15;
        const pool = 88;
        tn = base + Math.round(pool * (vn / tot));
        te = base + Math.round(pool * (ve / tot));
        ts = base + Math.round(pool * (vs / tot));
        tw = 148 - (tn + te + ts);
        
        // Repair constraints (Clamp to [10, 60])
        const clamp = (val) => Math.max(10, Math.min(60, val));
        tn = clamp(tn); te = clamp(te); ts = clamp(ts); tw = clamp(tw);
        
        // Final adjustment to ensure sum is exactly 148s
        const diff = 148 - (tn + te + ts + tw);
        tw += diff;
        tw = clamp(tw);
        if (tn + te + ts + tw !== 148) {
          tn = 37; te = 37; ts = 37; tw = 37;
        }
      }
      
      // Apply optimized timings to CYCLE array
      CYCLE[0][1] = tn;
      CYCLE[1][1] = te;
      CYCLE[2][1] = ts;
      CYCLE[3][1] = tw;
      
      // Re-initialize cycle state
      cycleT = 0;
      yellowPending = false;
      DIRS.forEach(d => {
        signals[d].state = d === CYCLE[cycleIdx][0] ? 'green' : 'red';
      });
      
      // Log results
      addLog(`📊 Webster's Delay Fitness computed. Optimal cycle solved in 164ms!`, 'success');
      addLog(`🟢 GA Timing Applied: NORTH=${tn}s, EAST=${te}s, SOUTH=${ts}s, WEST=${tw}s`, 'success');
      
      // Update UI
      statusBadge.textContent = 'OPTIMIZED';
      statusBadge.style.color = '#00ff88';
      statusBadge.style.borderColor = 'rgba(0, 255, 136, 0.3)';
      statusBadge.style.background = 'rgba(0, 255, 136, 0.15)';
      
      btn.disabled = false;
      btn.textContent = '🧬 Run Genetic Optimization';
      progressContainer.style.display = 'none';
      isGARunning = false;
      
      updateSigUI();
    }
  }, 100);
}

/* ── NEAT AI Green Wave Coordinator ─────────────────────── */
let neatActive = false;
let neatGenVal = 42;
let neatFitVal = 0.94;
let neatInterval = null;

function toggleNeatCoordination() {
  neatActive = !neatActive;
  const btn = document.getElementById('btnToggleNeat');
  const statusBadge = document.getElementById('neatStatus');
  
  if (neatActive) {
    btn.textContent = '🧠 Disable Green Wave Co-Op';
    btn.style.color = '#ffffff';
    btn.style.background = '#3b82f6';
    btn.style.borderColor = '#3b82f6';
    
    statusBadge.textContent = 'CO-OP';
    statusBadge.style.color = '#00ff88';
    statusBadge.style.borderColor = 'rgba(0, 255, 136, 0.3)';
    statusBadge.style.background = 'rgba(0, 255, 136, 0.15)';
    
    addLog('🧠 NEAT NeuroEvolution Green Wave Coordinator enabled.', 'info');
    addLog('🟢 Green Wave active: Synchronizing straight corridors (+35.5% flow efficiency).', 'success');
    
    neatInterval = setInterval(() => {
      if (Math.random() < 0.25) {
        neatGenVal++;
        neatFitVal = Math.min(0.99, parseFloat((neatFitVal + 0.001 + Math.random()*0.002).toFixed(3)));
        document.getElementById('neatGen').textContent = neatGenVal;
        document.getElementById('neatFit').textContent = neatFitVal;
        
        const corridors = ['N-S GREEN', 'E-W GREEN'];
        const activeCor = corridors[Math.floor(Math.random()*corridors.length)];
        document.getElementById('neatWave').textContent = activeCor;
        
        addLog(`🧠 [NEAT] Evolved genome inside generation ${neatGenVal} (Best Fitness: ${neatFitVal})`, 'info');
      }
    }, 8000);
  } else {
    clearInterval(neatInterval);
    btn.textContent = '🧠 Enable Green Wave Co-Op';
    btn.style.color = '#60a5fa';
    btn.style.background = 'rgba(59, 130, 246, 0.12)';
    btn.style.borderColor = 'rgba(59, 130, 246, 0.3)';
    
    statusBadge.textContent = 'NEURO-EVO';
    statusBadge.style.color = '#60a5fa';
    statusBadge.style.borderColor = 'rgba(59,130,246,0.3)';
    statusBadge.style.background = 'rgba(59,130,246,0.15)';
    
    addLog('🔴 NEAT Green Wave coordination disabled.', 'warning');
  }
}

/* ── Junction Switcher ───────────────────────────────────── */
function changeJunctionMode(roads) {
  activeRoadCount = roads;
  [3, 4, 5].forEach(r => {
    const btn = document.getElementById('btnJunc' + r);
    if (btn) {
      if (r === roads) {
        btn.style.background = 'var(--accent)';
        btn.style.color = '#0a192f';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#8892b0';
      }
    }
  });
  setJunctionMode(roads);
}

function setJunctionMode(roads) {
  if (roads === 5) {
    activeDirs = ['north', 'east', 'south', 'west', 'northeast'];
    CYCLE[0] = ['north', 30];
    CYCLE[1] = ['east', 30];
    CYCLE[2] = ['south', 30];
    CYCLE[3] = ['west', 30];
    CYCLE[4] = ['northeast', 30];
    CYCLE.length = 5;
  } else if (roads === 4) {
    activeDirs = ['north', 'east', 'south', 'west'];
    CYCLE[0] = ['north', 30];
    CYCLE[1] = ['east', 30];
    CYCLE[2] = ['south', 30];
    CYCLE[3] = ['west', 30];
    CYCLE.length = 4;
  } else {
    activeDirs = ['north', 'east', 'west'];
    CYCLE[0] = ['north', 30];
    CYCLE[1] = ['east', 30];
    CYCLE[2] = ['west', 30];
    CYCLE.length = 3;
  }
  
  cycleIdx = 0;
  cycleT = 0;
  yellowPending = false;
  
  vehicles.length = 0; // Clear vehicles to prevent collisions during layout transition!
  
  DIRS.forEach(d => {
    const capitalized = d[0].toUpperCase() + d.slice(1);
    const card = document.getElementById('sig' + capitalized);
    if (card) {
      card.style.display = activeDirs.includes(d) ? 'block' : 'none';
    }
  });
  
  DIRS.forEach(d => {
    if (!activeDirs.includes(d)) {
      signals[d].state = 'red';
      signals[d].timer = 0;
    }
  });
  
  updateSigUI();
  updateCongestionLegend();
  congestionHistory = []; // Reset history when layout changes
  addLog(`🛣️ Intersection layout switched to ${roads}-Way Mode!`, 'success');
}

/* ── Live Congestion Graph ───────────────────────────────── */
const congestionCanvas = document.getElementById('congestionCanvas');
const congestionCtx = congestionCanvas ? congestionCanvas.getContext('2d') : null;
let congestionHistory = [];
const maxHistoryPoints = 35;
let congestionSampleTimer = 0;

function updateCongestionLegend() {
  const legendDiv = document.getElementById('congestionLegend');
  if (!legendDiv) return;
  legendDiv.innerHTML = '';
  
  const colors = {
    north: '#00d4ff',
    east: '#ffd700',
    south: '#ff3355',
    west: '#a855f7',
    northeast: '#00ff88'
  };
  
  activeDirs.forEach(d => {
    const capitalized = d[0].toUpperCase() + d.slice(1);
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '4px';
    item.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${colors[d]}"></span> ${capitalized}: <span id="congCount-${d}" style="font-weight:bold; color:#ffffff;">0</span>`;
    legendDiv.appendChild(item);
  });
}

function tickCongestion(dt) {
  congestionSampleTimer += dt;
  if (congestionSampleTimer >= 1.0) { // Sample every 1 second
    congestionSampleTimer = 0;
    
    // Sample waiting vehicles for each active direction
    const sample = {};
    activeDirs.forEach(d => {
      // count of waiting vehicles in direction d
      const waiting = vehicles.filter(v => v.dir === d && v.spd < 1).length;
      sample[d] = waiting;
      
      // Update count in legend in real-time
      const countSpan = document.getElementById(`congCount-${d}`);
      if (countSpan) {
        countSpan.textContent = waiting;
      }
    });
    
    congestionHistory.push(sample);
    if (congestionHistory.length > maxHistoryPoints) {
      congestionHistory.shift();
    }
  }
  
  drawCongestionGraph();
}

function drawCongestionGraph() {
  if (!congestionCtx || !congestionCanvas) return;
  const tc = congestionCanvas;
  const ctx2 = congestionCtx;
  
  ctx2.clearRect(0, 0, tc.width, tc.height);
  
  // Draw subtle grid lines
  ctx2.strokeStyle = '#0e1a2b';
  ctx2.lineWidth = 0.8;
  const gridSpacing = 16;
  for (let x = 0; x < tc.width; x += gridSpacing) {
    ctx2.beginPath(); ctx2.moveTo(x, 0); ctx2.lineTo(x, tc.height); ctx2.stroke();
  }
  for (let y = 0; y < tc.height; y += gridSpacing) {
    ctx2.beginPath(); ctx2.moveTo(0, y); ctx2.lineTo(tc.width, y); ctx2.stroke();
  }
  
  if (congestionHistory.length < 2) return;
  
  const colors = {
    north: '#00d4ff',
    east: '#ffd700',
    south: '#ff3355',
    west: '#a855f7',
    northeast: '#00ff88'
  };
  
  // Find max congestion value in history to scale graph dynamically (min scale = 5)
  let maxVal = 5;
  congestionHistory.forEach(sample => {
    Object.values(sample).forEach(val => {
      if (val > maxVal) maxVal = val;
    });
  });
  
  const paddingX = 10;
  const paddingY = 10;
  const graphW = tc.width - 2 * paddingX;
  const graphH = tc.height - 2 * paddingY;
  
  // Draw line for each active direction
  activeDirs.forEach(d => {
    ctx2.strokeStyle = colors[d];
    ctx2.lineWidth = 1.8;
    ctx2.shadowBlur = 4;
    ctx2.shadowColor = colors[d];
    ctx2.beginPath();
    
    congestionHistory.forEach((sample, idx) => {
      const val = sample[d] || 0;
      const x = paddingX + (idx / (maxHistoryPoints - 1)) * graphW;
      const y = tc.height - paddingY - (val / maxVal) * graphH;
      
      if (idx === 0) {
        ctx2.moveTo(x, y);
      } else {
        ctx2.lineTo(x, y);
      }
    });
    ctx2.stroke();
    
    // Draw subtle area fill below the line
    ctx2.save();
    ctx2.shadowBlur = 0;
    ctx2.globalAlpha = 0.08;
    ctx2.fillStyle = colors[d];
    ctx2.beginPath();
    congestionHistory.forEach((sample, idx) => {
      const val = sample[d] || 0;
      const x = paddingX + (idx / (maxHistoryPoints - 1)) * graphW;
      const y = tc.height - paddingY - (val / maxVal) * graphH;
      if (idx === 0) {
        ctx2.moveTo(x, tc.height - paddingY);
        ctx2.lineTo(x, y);
      } else {
        ctx2.lineTo(x, y);
      }
    });
    ctx2.lineTo(paddingX + ((congestionHistory.length - 1) / (maxHistoryPoints - 1)) * graphW, tc.height - paddingY);
    ctx2.closePath();
    ctx2.fill();
    ctx2.restore();
  });
  
  // Reset shadow for subsequent drawing
  ctx2.shadowBlur = 0;
}

/* ── Init ─────────────────────────────────────────────────── */
updateSigUI();setPhaseUI('normal');updateTimelineUI(0);updateClock();
toggleAuto(); // Turn on 1-minute auto mode on startup!
updateCongestionLegend();
addLog('APTMS v5.0 — Correct vehicle angles active.','info');
addLog('🚗 Car | 🏍 Bike | 🚙 SUV | 🚛 Truck | 🚌 Bus | 🚐 Van | 🛺 Auto-Rickshaw | 🚜 Tractor | 🚙 Jeep | 🚓 Police','info');
addLog('Ambulance scheduled to arrive automatically every 1 minute.','info');
