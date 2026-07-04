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

/* ── State ────────────────────────────────────────────────── */
const DIRS=['north','east','south','west'];
let simSpeed=1.0,autoMode=false,autoTimer=null,phase='normal';
let totalAmb=0,responseTimes=[],detectionStart=0;
let detectionProgress=0,ambPhaseTimer=0;
const signals={
  north:{state:'green', timer:30},
  east: {state:'yellow',timer:5 },
  south:{state:'red',   timer:30},
  west: {state:'red',   timer:30},
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
  const lo=hw*0.40;   // lane offset from road centre
  const SO=100;       // spawn offset off-screen
  const EX=220;       // exit distance past intersection centre
  return {
    // North: spawns at top, travels DOWN → front = DOWN → angle = π
    north:{spawnX:cx-lo,      spawnY:-SO,                 dx:0, dy:1,  angle:Math.PI,
           stopDist: cy-hw-14+SO,
           exitDist: cy+hw+EX+SO},
    // South: spawns at bottom, travels UP → front = UP → angle = 0
    south:{spawnX:cx+lo,      spawnY:canvas.height+SO,    dx:0, dy:-1, angle:0,
           stopDist: canvas.height+SO-(cy+hw+14),
           exitDist: canvas.height+SO-(cy-hw-EX)},
    // East: spawns at right, travels LEFT → front = LEFT → angle = −π/2
    east: {spawnX:canvas.width+SO, spawnY:cy-lo,          dx:-1,dy:0,  angle:-Math.PI/2,
           stopDist: canvas.width+SO-(cx+hw+14),
           exitDist: canvas.width+SO-(cx-hw-EX)},
    // West: spawns at left, travels RIGHT → front = RIGHT → angle = π/2
    west: {spawnX:-SO,        spawnY:cy+lo,               dx:1, dy:0,  angle:Math.PI/2,
           stopDist: cx-hw-14+SO,
           exitDist: cx+hw+EX+SO},
  };
}

/* ── Vehicle specs ────────────────────────────────────────── */
const VSPEC={
  car:  {wid:22,len:40,maxSpd:82,acc:60,dec:130,gap:1.4},
  bike: {wid:10,len:22,maxSpd:98,acc:85,dec:165,gap:1.2},
  suv:  {wid:26,len:46,maxSpd:76,acc:50,dec:108,gap:1.5},
  truck:{wid:28,len:74,maxSpd:56,acc:24,dec:72, gap:1.8},
  bus:  {wid:30,len:90,maxSpd:50,acc:18,dec:62, gap:2.0},
  van:  {wid:24,len:52,maxSpd:68,acc:44,dec:98, gap:1.5},
  auto: {wid:17,len:30,maxSpd:72,acc:64,dec:138,gap:1.3},
  jeep: {wid:24,len:42,maxSpd:74,acc:48,dec:110,gap:1.5},
  tractor:{wid:26,len:44,maxSpd:45,acc:22,dec:95,gap:1.6},
  police:{wid:22,len:40,maxSpd:90,acc:75,dec:140,gap:1.3},
};
const VCOL={
  car:  ['#cc2233','#1144cc','#116633','#777','#f0f0f0','#cc8800','#6633bb','#dd5511'],
  bike: ['#111111','#1a1a1a','#cc2200','#002299','#005500'],
  suv:  ['#222244','#1a3a1a','#3a2a1a','#444','#2a3a4a','#331122'],
  truck:['#1a1a2a','#1a2a1a','#3a2a0a','#2a1a1a','#003344'],
  bus:  ['#cc8800','#dd9900','#2255aa','#cc3300'],
  van:  ['#336699','#333344','#225533','#553322','#888899'],
  auto: ['#cc8800','#ffaa00','#dd7700'],
  jeep: ['#1b3f2b','#3c4e36','#4a3f2d','#2b2b2b','#691b1b'],
  tractor:['#dd2211','#228822','#0044bb'],
  police:['#111111'],
};

/* ── Vehicle class ────────────────────────────────────────── */
let _uid=0;
class Vehicle{
  constructor(dir){
    this.id=_uid++;this.dir=dir;
    const t=['car','car','car','bike','bike','suv','truck','bus','van','auto','jeep','tractor','police'];
    this.type=t[Math.floor(Math.random()*t.length)];
    this.spec=VSPEC[this.type];
    const cp=VCOL[this.type];this.col=cp[Math.floor(Math.random()*cp.length)];
    this.pos=0;this.spd=this.spec.maxSpd*(0.5+Math.random()*0.28);this.done=false;
  }
  xy(rc){const r=rc[this.dir];return{x:r.spawnX+r.dx*this.pos,y:r.spawnY+r.dy*this.pos};}
  update(dt,rc,all){
    const r=rc[this.dir],sig=signals[this.dir].state;
    const stopLine=r.stopDist,dist=stopLine-this.pos;
    const ahead=all.filter(v=>v.id!==this.id&&v.dir===this.dir&&v.pos>this.pos).sort((a,b)=>a.pos-b.pos)[0];
    const mustStop=(sig==='red'||sig==='yellow')&&!(phase==='priority'&&this.dir===AMB.dir);
    let desired=this.spec.maxSpd;
    if(mustStop&&dist>0){const bd=(this.spd*this.spd)/(2*this.spec.dec);if(dist<=bd+18)desired=0;}
    if(mustStop&&this.pos>=stopLine){this.pos=stopLine;desired=0;}
    if(ahead){
      const gap=ahead.pos-this.spec.len/2-(this.pos+this.spec.len/2);
      const safe=this.spec.len*this.spec.gap+10;
      if(gap<safe&&gap>0)desired=Math.min(desired,ahead.spd*(gap/safe));
      else if(gap<=0)desired=0;
    }
    this.spd=this.spd<desired?Math.min(desired,this.spd+this.spec.acc*dt):Math.max(desired,this.spd-this.spec.dec*dt);
    if(this.spd<0.5&&desired===0)this.spd=0;
    this.pos+=this.spd*dt;
    if(this.pos>=r.exitDist)this.done=true;
  }
  draw(rc){
    const r=rc[this.dir],p=this.xy(rc);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(r.angle);
    VDRAW[this.type](this.spec.wid,this.spec.len,this.col,this.spd);
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
};

/* ════════════════════════════════════════════════════════════
   AMBULANCE  — large, clearly visible, correct angle via rc
   ════════════════════════════════════════════════════════════ */
const AMB={dir:'south',pos:0,active:false,spd:0,lph:0};

function drawAmbulance(rc){
  if(!AMB.active)return;
  const r=rc[AMB.dir];
  const ax=r.spawnX+r.dx*AMB.pos, ay=r.spawnY+r.dy*AMB.pos;
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
  ctx.save();ctx.translate(ax,ay);ctx.rotate(r.angle);
  const w=40,h=80;
  // forward headlight beam
  ctx.globalAlpha=0.14;
  const bm=ctx.createLinearGradient(0,-h/2-5,0,-h/2-55);
  bm.addColorStop(0,'rgba(255,255,200,1)');bm.addColorStop(1,'rgba(255,255,200,0)');
  ctx.fillStyle=bm;ctx.beginPath();ctx.ellipse(0,-h/2-28,24,26,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;

  /* ─ Shadow ─ */
  ctx.save();ctx.translate(4,7);ctx.globalAlpha=0.32;ctx.fillStyle='#000028';
  ctx.beginPath();ctx.ellipse(0,0,w*0.55,h*0.46,0,0,Math.PI*2);ctx.fill();ctx.restore();

  /* ─ White body ─ */
  const wg=ctx.createLinearGradient(-w/2,-h/2,w/2,h/2);
  wg.addColorStop(0,'#ffffff');wg.addColorStop(0.5,'#fcfcfc');wg.addColorStop(1,'#eaeaea');
  ctx.fillStyle=wg;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,w*0.15);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.22)';ctx.lineWidth=1.2;ctx.stroke();

  /* ─ Yellow Hood / Bonnet (Force Traveler Style) ─ */
  ctx.fillStyle='#ffd000';
  ctx.beginPath();
  ctx.roundRect(-w/2+1, -h/2+1, w-2, 22, [6, 6, 0, 0]);
  ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.stroke();

  /* ─ Checkered Red/Yellow side stripes (Force Traveler style) ─ */
  const cw=3.5, ch=7;
  for(let i=0; i<6; i++) {
    // left side checkers
    ctx.fillStyle = i % 2 === 0 ? '#ffd000' : '#cc1133';
    ctx.fillRect(-w/2, -18 + i*ch, cw, ch);
    ctx.fillRect(-w/2, 24 + i*ch, cw, ch);
    
    // right side checkers
    ctx.fillStyle = i % 2 === 0 ? '#cc1133' : '#ffd000';
    ctx.fillRect(w/2 - cw, -18 + i*ch, cw, ch);
    ctx.fillRect(w/2 - cw, 24 + i*ch, cw, ch);
  }

  /* ─ Blue Star of Life / Medical Symbol ─ */
  ctx.fillStyle='#0055cc';
  ctx.beginPath(); ctx.arc(0, 12, 7, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
  // Draw simple white cross lines on top of blue circle
  ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(4, 12); ctx.moveTo(0, 8); ctx.lineTo(0, 16); ctx.stroke();

  /* ─ AMBULANCE text on the yellow bonnet ─ */
  ctx.save();
  ctx.font=`bold ${Math.max(5,w*0.22)}px Impact,Arial,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#cc0011';
  ctx.save();ctx.scale(1,-1);ctx.fillText('AMBULANCE',0,-h*0.37);ctx.restore();
  ctx.restore();

  /* ─ Windshield (glass) ─ */
  ctx.fillStyle='rgba(165,222,255,0.85)';ctx.beginPath();ctx.roundRect(-w/2+3.5,-h/2+14,w-7,h*0.14,2.5);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.30)';ctx.beginPath();ctx.roundRect(-w/2+5.5,-h/2+15.5,(w-11)*0.40,h*0.06,1.5);ctx.fill();

  /* ─ Rear window ─ */
  ctx.fillStyle='rgba(145,208,244,0.58)';ctx.beginPath();ctx.roundRect(-w/2+3.5,h/2-h*0.19,w-7,h*0.15,3.5);ctx.fill();

  /* ─ 4 wheels ─ */
  const wW=7.5,wH=12;
  const wy1=-h/2+h*0.09,wy2=h/2-h*0.09-wH;
  const wx1=-w/2-2.5,wx2=w/2-5;
  ctx.fillStyle='#0d0d0d';
  [[wx1,wy1],[wx2,wy1],[wx1,wy2],[wx2,wy2]].forEach(([tx,ty])=>{
    ctx.beginPath();ctx.roundRect(tx,ty,wW,wH,2.5);ctx.fill();
    ctx.fillStyle='#445';ctx.fillRect(tx+1,ty+1.5,wW-2,wH*0.42);ctx.fillStyle='#0d0d0d';
  });

  /* ─ EMERGENCY LIGHTBAR — blue flashing ─ */
  ctx.fillStyle=lo?'#0f22ee':'#ff0808';
  ctx.shadowBlur=28;ctx.shadowColor=lo?'#1122ff':'#ff0000';
  ctx.fillRect(-w/2+2,-h/2-9,w/2-2,8);ctx.shadowBlur=0;
  ctx.fillStyle=(!lo)?'#0f22ee':'#ff0808';
  ctx.shadowBlur=28;ctx.shadowColor=(!lo)?'#1122ff':'#ff0000';
  ctx.fillRect(1,-h/2-9,w/2-2,8);ctx.shadowBlur=0;
  // lightbar housing
  ctx.fillStyle='rgba(60,60,60,0.80)';ctx.beginPath();ctx.roundRect(-w/2+1,-h/2-10,w-2,10,2);ctx.fill();
  ctx.strokeStyle='rgba(100,100,100,0.5)';ctx.lineWidth=0.8;ctx.stroke();

  /* ─ Headlights ─ */
  ctx.fillStyle='#ffffaa';ctx.shadowBlur=18;ctx.shadowColor='#ffff88';
  ctx.beginPath();ctx.ellipse(-w/2+5,-h/2+2.5,5.5,3,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse( w/2-5,-h/2+2.5,5.5,3,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;

  /* ─ Tail lights ─ */
  ctx.fillStyle='#ff2244';ctx.shadowBlur=12;ctx.shadowColor='#ff2244';
  ctx.beginPath();ctx.ellipse(-w/2+5,h/2-2.5,5,3,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse( w/2-5,h/2-2.5,5,3,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;

  /* ─ Side lettering / badge ─ */
  ctx.fillStyle='rgba(0,85,200,0.80)';
  ctx.fillRect(-w/2, -5, cw, 10);
  ctx.fillRect(w/2-cw, -5, cw, 10);

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
const spT={north:0.8,east:0.2,south:1.6,west:1.2},spN={north:1.8,east:1.5,south:2.2,west:2.0};
function manageVehicles(dt,rc){
  vehicles.forEach(v=>v.update(dt,rc,vehicles));
  for(let i=vehicles.length-1;i>=0;i--)if(vehicles[i].done)vehicles.splice(i,1);
  DIRS.forEach(dir=>{
    spT[dir]+=dt;
    if(spT[dir]>=spN[dir]){
      spT[dir]=0;spN[dir]=1.0+Math.random()*2.4;
      if(!vehicles.some(v=>v.dir===dir&&v.pos<110))vehicles.push(new Vehicle(dir));
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
  ctx.fillStyle='#1a2230';ctx.fillRect(0,cy-hw,W,hw*2);ctx.fillRect(cx-hw,0,hw*2,H);
  ctx.fillStyle='#1e2a3c';ctx.fillRect(cx-hw,cy-hw,hw*2,hw*2);
  // road surface texture
  ctx.save();ctx.globalAlpha=0.022;
  for(let i=0;i<60;i++){ctx.fillStyle='#fff';ctx.fillRect(Math.random()*W,Math.random()*H,Math.random()*4+1,1);}
  ctx.restore();
  // kerb lines
  ctx.strokeStyle='#ffffff15';ctx.lineWidth=1.8;
  [[0,cy-hw,cx-hw,cy-hw],[cx+hw,cy-hw,W,cy-hw],[0,cy+hw,cx-hw,cy+hw],[cx+hw,cy+hw,W,cy+hw],
   [cx-hw,0,cx-hw,cy-hw],[cx-hw,cy+hw,cx-hw,H],[cx+hw,0,cx+hw,cy-hw],[cx+hw,cy+hw,cx+hw,H]]
  .forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});
  // centre dashes
  ctx.setLineDash([18,12]);ctx.strokeStyle='#ffff0030';ctx.lineWidth=1.8;
  [[0,cy,cx-hw,cy],[cx+hw,cy,W,cy],[cx,0,cx,cy-hw],[cx,cy+hw,cx,H]]
  .forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});
  ctx.setLineDash([]);
  // lane dividers
  ctx.setLineDash([10,8]);ctx.strokeStyle='#ffffff12';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cx-Math.min(W,H)*0.09*0.55,0);ctx.lineTo(cx-Math.min(W,H)*0.09*0.55,cy-Math.min(W,H)*0.09);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx+Math.min(W,H)*0.09*0.55,cy+Math.min(W,H)*0.09);ctx.lineTo(cx+Math.min(W,H)*0.09*0.55,H);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx+Math.min(W,H)*0.09,cy-Math.min(W,H)*0.09*0.55);ctx.lineTo(W,cy-Math.min(W,H)*0.09*0.55);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,cy+Math.min(W,H)*0.09*0.55);ctx.lineTo(cx-Math.min(W,H)*0.09,cy+Math.min(W,H)*0.09*0.55);ctx.stroke();
  ctx.setLineDash([]);
  // green road glow
  DIRS.forEach(dir=>{
    if(signals[dir].state!=='green')return;
    const gp={north:{x:cx-hw*0.40,y:cy-hw*0.55},south:{x:cx+hw*0.40,y:cy+hw*0.55},
              east:{x:cx+hw*0.55,y:cy-hw*0.40},west:{x:cx-hw*0.55,y:cy+hw*0.40}}[dir];
    ctx.save();ctx.globalAlpha=0.07;ctx.fillStyle='#00ff88';ctx.beginPath();ctx.arc(gp.x,gp.y,hw*0.75,0,Math.PI*2);ctx.fill();ctx.restore();
  });
  const cx2=canvas.width/2,cy2=canvas.height/2,hw2=Math.min(canvas.width,canvas.height)*0.09;
  drawCross(cx2,cy2,hw2);drawStop(cx2,cy2,hw2);drawArrows(cx2,cy2,hw2);drawLabels(cx2,cy2,hw2);
}
function drawCross(cx,cy,hw){
  ctx.fillStyle='#ffffff1c';const L=hw*0.84,n=5,sw=(L/n)*0.66;
  for(let i=0;i<n;i++){ctx.fillRect(cx-L/2+i*(L/n),cy-hw-20,sw,15);ctx.fillRect(cx-L/2+i*(L/n),cy+hw+5,sw,15);ctx.fillRect(cx-hw-20,cy-L/2+i*(L/n),15,sw);ctx.fillRect(cx+hw+5,cy-L/2+i*(L/n),15,sw);}
}
function drawStop(cx,cy,hw){
  ctx.strokeStyle='#ffffff65';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(cx-hw+6,cy-hw-13);ctx.lineTo(cx+hw-6,cy-hw-13);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-hw+6,cy+hw+13);ctx.lineTo(cx+hw-6,cy+hw+13);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-hw-13,cy-hw+6);ctx.lineTo(cx-hw-13,cy+hw-6);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx+hw+13,cy-hw+6);ctx.lineTo(cx+hw+13,cy+hw-6);ctx.stroke();
}
function drawArrows(cx,cy,hw){
  ctx.fillStyle='#ffffff1a';
  const arw=(x,y,dx,dy,s)=>{
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);
    ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(-s*0.5,s*0.26);ctx.lineTo(0,-s*0.22);ctx.lineTo(s*0.5,s*0.26);
    ctx.closePath();ctx.fill();ctx.restore();
  };
  arw(cx-hw*0.40,cy-hw*0.52,0,1,14);arw(cx+hw*0.40,cy+hw*0.52,0,-1,14);
  arw(cx+hw*0.52,cy-hw*0.40,-1,0,14);arw(cx-hw*0.52,cy+hw*0.40,1,0,14);
}
function drawLabels(cx,cy,hw){
  ctx.font='bold 11px Orbitron,monospace';ctx.textAlign='center';
  ctx.fillStyle='rgba(127,168,204,0.40)';
  ctx.fillText('NORTH',cx,cy-hw-45);ctx.fillText('SOUTH',cx,cy+hw+56);
  ctx.fillText('EAST',cx+hw+56,cy+5);ctx.fillText('WEST',cx-hw-56,cy+5);
}

function drawTLights(cx,cy,hw){
  const R=hw*1.18;
  const corners={north:{px:cx+R,py:cy-R,ox:-28,oy:0},east:{px:cx+R,py:cy+R,ox:0,oy:-28},
                 south:{px:cx-R,py:cy+R,ox:28,oy:0},west:{px:cx-R,py:cy-R,ox:0,oy:28}};
  DIRS.forEach(dir=>{
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
  const r=rc[AMB.dir];
  const ax=r.spawnX+r.dx*AMB.pos,ay=r.spawnY+r.dy*AMB.pos;
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
  const cur=CYCLE[cycleIdx],rem=cur[1]-cycleT;
  if(!yellowPending&&rem<=5){signals[cur[0]].state='yellow';yellowPending=true;updateSigUI();}
  if(rem<=0){
    signals[cur[0]].state='red';cycleIdx=(cycleIdx+1)%CYCLE.length;
    const nd=CYCLE[cycleIdx][0];signals[nd].state='green';cycleT=0;yellowPending=false;
    DIRS.forEach(d=>{if(d!==nd&&signals[d].state!=='yellow')signals[d].state='red';});
    updateSigUI();addLog(`🚦 ${nd.toUpperCase()} → GREEN (30s)`,'info');
  }
  DIRS.forEach(dir=>{signals[dir].timer=Math.max(0,Math.ceil(signals[dir].state==='red'?rem+CYCLE[cycleIdx][1]:rem));});
}

/* ── Ambulance ───────────────────────────────────────────── */
function tickAmb(dt){
  if(phase==='normal')return;
  ambPhaseTimer+=dt;
  const rc=roadCfg(),r=rc[AMB.dir];
  switch(phase){
    case 'detecting':
      detectionProgress=Math.min(1,ambPhaseTimer/2.5);
      AMB.spd=32;
      AMB.pos+=AMB.spd*dt;
      updateSensorDetection(detectionProgress);
      signals[AMB.dir].timer = Math.max(15, Math.ceil(20 - ambPhaseTimer));
      if(detectionProgress>=1){phase='priority';ambPhaseTimer=0;activatePriority();}
      break;
    case 'priority':
      AMB.spd=Math.min(150,AMB.spd+82*dt);
      AMB.pos+=AMB.spd*dt;
      detectionProgress=Math.max(0,detectionProgress-dt*0.8);
      signals[AMB.dir].timer = Math.max(15, Math.ceil(17.5 - ambPhaseTimer));
      if(AMB.pos>=r.exitDist){AMB.active=false;phase='resuming';ambPhaseTimer=0;addLog('🚑 Ambulance cleared intersection. Initiating 15s green extension...','info');}
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
}

/* ── Controls ────────────────────────────────────────────── */
function triggerAmbulance(){
  if(phase!=='normal')return;
  document.getElementById('btnAmbulance').disabled=true;
  
  const reds=DIRS.filter(d=>signals[d].state==='red');
  AMB.dir=reds[Math.floor(Math.random()*reds.length)]||'south';
  AMB.pos=120;AMB.active=true;AMB.spd=32;
  
  // PREEMPTION: Instantly switch signals!
  DIRS.forEach(d=>{signals[d].state='red';signals[d].timer=0;});
  signals[AMB.dir].state='green';signals[AMB.dir].timer=30;
  updateSigUI();highlightPriority();

  phase='detecting';ambPhaseTimer=0;detectionProgress=0;detectionStart=performance.now();
  setPhaseUI('detecting');updateTimelineUI(1);
  document.getElementById('detectionOverlay').style.display='block';
  
  addLog(`🚑 Ambulance detected → ${AMB.dir.toUpperCase()} road`,'warning');
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
  updateSigUI();setPhaseUI('resuming');updateTimelineUI(3);
  addLog(`🔄 Resume → ${nd.toUpperCase()} GREEN`,'info');
}
function resetSimulation(){
  phase='normal';AMB.active=false;AMB.pos=0;AMB.spd=0;
  detectionProgress=0;ambPhaseTimer=0;cycleIdx=0;cycleT=0;yellowPending=false;
  Object.assign(signals,{north:{state:'green',timer:30},east:{state:'yellow',timer:5},south:{state:'red',timer:30},west:{state:'red',timer:30}});
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
    const d=dir[0],s=signals[dir].state;
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
  DIRS.forEach(dir=>{const d=dir[0],t=signals[dir].timer;document.getElementById(`${d}Timer`).textContent=t>0?t+'s':'—';});
  document.getElementById('statCars').textContent=vehicles.filter(v=>v.spd<1).length;
}
function setPhaseUI(p){
  const lbl={normal:'Normal Operation',detecting:'Ambulance Detected',priority:'Priority GREEN Active',resuming:'Resuming Normal Signals'};
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
const trainTypes = ['car', 'bike', 'suv', 'truck', 'bus', 'van', 'auto', 'ambulance'];
let isTrainingActive = false;
let trainingProgress = 1.0;
let trainingEpoch = 150;
let trainingLoss = 0.009;

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

  const type = trainTypes[trainTypeIdx];
  const col = VCOL[type] ? VCOL[type][0] : '#ffffff';
  
  // Swap context
  const oldCtx = ctx;
  ctx = trainCtx;
  
  try {
    if (type === 'ambulance') {
      if (trainAngleMode === 0) {
        // Draw Side View of Force Traveler Ambulance
        trainCtx.save();
        trainCtx.translate(tc.width/2, tc.height/2 + 2);
        
        // Shadow
        trainCtx.fillStyle = 'rgba(0,10,25,0.22)';
        trainCtx.beginPath(); trainCtx.ellipse(0, 16, 38, 5, 0, 0, Math.PI*2); trainCtx.fill();
        
        // White Body
        trainCtx.fillStyle = '#ffffff';
        trainCtx.beginPath(); trainCtx.roundRect(-36, -18, 72, 30, 4); trainCtx.fill();
        trainCtx.strokeStyle = '#9ca4ac'; trainCtx.lineWidth = 1; trainCtx.stroke();
        
        // Yellow Grille & Bonnet Area (Force Traveler style)
        trainCtx.fillStyle = '#ffd000';
        trainCtx.beginPath(); trainCtx.roundRect(14, -6, 22, 18, [0, 4, 4, 0]); trainCtx.fill();
        trainCtx.strokeStyle = '#ffd000'; trainCtx.stroke();
        
        // Wheels
        trainCtx.fillStyle = '#181818';
        trainCtx.beginPath(); trainCtx.arc(-18, 12, 8, 0, Math.PI*2); trainCtx.fill();
        trainCtx.beginPath(); trainCtx.arc(16, 12, 8, 0, Math.PI*2); trainCtx.fill();
        trainCtx.fillStyle = '#7a8590';
        trainCtx.beginPath(); trainCtx.arc(-18, 12, 4, 0, Math.PI*2); trainCtx.fill();
        trainCtx.beginPath(); trainCtx.arc(16, 12, 4, 0, Math.PI*2); trainCtx.fill();
        
        // Windows (Driver + Side Compartment)
        trainCtx.fillStyle = 'rgba(165,222,255,0.7)';
        trainCtx.beginPath(); trainCtx.roundRect(16, -14, 12, 9, 2); trainCtx.fill();
        trainCtx.beginPath(); trainCtx.roundRect(-2, -14, 14, 9, 1); trainCtx.fill();
        trainCtx.beginPath(); trainCtx.roundRect(-24, -14, 18, 9, 1); trainCtx.fill();
        
        // Red and Yellow side checkers
        for(let i=0; i<8; i++) {
          trainCtx.fillStyle = i % 2 === 0 ? '#ffd000' : '#cc1133';
          trainCtx.fillRect(-34 + i*6, -1, 6, 6);
        }
        
        // Blue Star of life logo on side
        trainCtx.fillStyle = '#0055cc';
        trainCtx.beginPath(); trainCtx.arc(-15, 7, 3, 0, Math.PI*2); trainCtx.fill();
        
        // "AMBULANCE" text on side
        trainCtx.fillStyle = '#cc1133'; trainCtx.font = 'bold 5px Arial';
        trainCtx.fillText('AMBULANCE', -25, 7);
        
        // Blue Lightbar on top
        trainCtx.fillStyle = '#0f22ee';
        trainCtx.fillRect(10, -22, 10, 4);
        trainCtx.fillStyle = 'rgba(60,60,60,0.8)';
        trainCtx.fillRect(8, -21, 14, 3);
        
        trainCtx.restore();
        
      } else if (trainAngleMode === 1) {
        // Draw Front View of Force Traveler Ambulance
        trainCtx.save();
        trainCtx.translate(tc.width/2, tc.height/2 + 2);
        
        // Shadow
        trainCtx.fillStyle = 'rgba(0,10,25,0.22)';
        trainCtx.beginPath(); trainCtx.ellipse(0, 18, 24, 4, 0, 0, Math.PI*2); trainCtx.fill();
        
        // White Body Frame
        trainCtx.fillStyle = '#ffffff';
        trainCtx.beginPath(); trainCtx.roundRect(-20, -22, 40, 39, 4); trainCtx.fill();
        trainCtx.strokeStyle = '#9ca4ac'; trainCtx.lineWidth = 1; trainCtx.stroke();
        
        // Yellow Grille & Bonnet Area (Force Traveler style)
        trainCtx.fillStyle = '#ffd000';
        trainCtx.beginPath(); trainCtx.roundRect(-20, 0, 40, 17, [0, 0, 4, 4]); trainCtx.fill();
        
        // Black Radiator Grille
        trainCtx.fillStyle = '#1c1d22';
        trainCtx.beginPath(); trainCtx.roundRect(-12, 3, 24, 8, 2); trainCtx.fill();
        
        // Force logo in center
        trainCtx.fillStyle = '#ffd000'; trainCtx.font = 'bold 6px Arial'; trainCtx.textAlign = 'center';
        trainCtx.fillText('F', 0, 9);
        
        // Headlights
        trainCtx.fillStyle = '#ffffcc';
        trainCtx.beginPath(); trainCtx.arc(-16, 7, 2.5, 0, Math.PI*2); trainCtx.fill();
        trainCtx.beginPath(); trainCtx.arc(16, 7, 2.5, 0, Math.PI*2); trainCtx.fill();
        
        // Windshield
        trainCtx.fillStyle = 'rgba(165,222,255,0.72)';
        trainCtx.beginPath(); trainCtx.roundRect(-16, -16, 32, 13, 2); trainCtx.fill();
        
        // Side mirrors
        trainCtx.fillStyle = '#1c1d22';
        trainCtx.fillRect(-23, -12, 3, 7);
        trainCtx.fillRect(20, -12, 3, 7);
        
        // Blue flashing lightbar on roof
        const flash = Math.sin(performance.now()/80)>0;
        trainCtx.fillStyle = flash ? '#0f22ee' : '#cc1133';
        trainCtx.fillRect(-12, -26, 24, 4);
        
        // "AMBULANCE" text on yellow hood
        trainCtx.fillStyle = '#cc0011'; trainCtx.font = 'bold 5px Arial';
        trainCtx.fillText('AMBULANCE', 0, -2);
        
        trainCtx.restore();
        
      } else {
        // Draw Top-Down View of Force Traveler Ambulance
        trainCtx.save();
        trainCtx.translate(tc.width/2, tc.height/2);
        trainCtx.rotate(trainAngle);
        
        const w = 24, h = 48;
        // White body
        trainCtx.fillStyle = '#ffffff'; trainCtx.beginPath(); trainCtx.roundRect(-w/2, -h/2, w, h, 4); trainCtx.fill();
        trainCtx.strokeStyle = 'rgba(0,0,0,0.3)'; trainCtx.lineWidth = 0.7; trainCtx.stroke();
        
        // Yellow bonnet
        trainCtx.fillStyle = '#ffd000'; trainCtx.beginPath(); trainCtx.roundRect(-w/2+0.5, -h/2+0.5, w-1, 13, [3, 3, 0, 0]); trainCtx.fill();
        
        // Windshield
        trainCtx.fillStyle = 'rgba(165,222,255,0.85)'; trainCtx.beginPath(); trainCtx.roundRect(-w/2+2.5, -h/2+11, w-5, 8, 1.5); trainCtx.fill();
        
        // Red/Yellow checkers along side edges
        const t_cw = 2.5, t_ch = 4.5;
        for(let i=0; i<4; i++) {
          trainCtx.fillStyle = i % 2 === 0 ? '#ffd000' : '#cc1133';
          trainCtx.fillRect(-w/2, -6 + i*t_ch, t_cw, t_ch);
          trainCtx.fillRect(w/2 - t_cw, -6 + i*t_ch, t_cw, t_ch);
        }
        
        // Blue Symbol
        trainCtx.fillStyle = '#0055cc';
        trainCtx.beginPath(); trainCtx.arc(0, 10, 4, 0, Math.PI*2); trainCtx.fill();
        
        // Flashing blue lightbar
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

  // Bounding box overlay
  trainCtx.save();
  const boxW = 54, boxH = 74;
  const bx = tc.width/2 - boxW/2;
  const by = tc.height/2 - boxH/2;
  
  const scanY = by + (boxH/2) + Math.sin(performance.now()/200) * (boxH/2);
  trainCtx.strokeStyle = isTrainingActive ? 'rgba(0,255,136,0.35)' : 'rgba(0,212,255,0.25)';
  trainCtx.lineWidth = 1;
  trainCtx.beginPath(); trainCtx.moveTo(bx, scanY); trainCtx.lineTo(bx + boxW, scanY); trainCtx.stroke();
  
  trainCtx.strokeStyle = isTrainingActive ? '#ffd700' : '#00ff88';
  trainCtx.lineWidth = 1.2;
  trainCtx.strokeRect(bx, by, boxW, boxH);
  
  trainCtx.fillStyle = isTrainingActive ? '#ffd700' : '#00ff88';
  trainCtx.font = 'bold 8px monospace';
  const conf = isTrainingActive ? (55 + Math.random()*42).toFixed(1) : '99.4';
  trainCtx.fillText(`${type.toUpperCase()}: ${conf}%`, bx, by - 4);

  // Dots
  trainCtx.fillStyle = '#ff3355';
  [[bx,by],[bx+boxW,by],[bx,by+boxH],[bx+boxW,by+boxH],[tc.width/2, tc.height/2]].forEach(([kx,ky])=>{
    trainCtx.beginPath(); trainCtx.arc(kx, ky, 2, 0, Math.PI*2); trainCtx.fill();
  });
  
  trainCtx.restore();
}

function tickTraining(dt) {
  if (!isTrainingActive) {
    if (Math.random() < 0.005) {
      trainTypeIdx = (trainTypeIdx + 1) % trainTypes.length;
    }
    
    // Cycle view modes for ambulance slowly when idle
    if (trainTypes[trainTypeIdx] === 'ambulance' && Math.random() < 0.015) {
      trainAngleMode = (trainAngleMode + 1) % 3;
    }
    
    const type = trainTypes[trainTypeIdx].toUpperCase();
    const viewSuffix = trainTypes[trainTypeIdx] === 'ambulance' ? ` (${['SIDE', 'FRONT', 'TOP'][trainAngleMode]} VIEW)` : '';
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
    
    addLog('🎉 AI retrained on all vehicles & angles (0°,90°,180°,270°)! Accuracy: 99.4%', 'success');
  } else {
    const pct = Math.round(trainingProgress * 100);
    document.getElementById('trainBar').style.width = pct + '%';
    
    trainingEpoch = Math.round(trainingProgress * 150);
    trainingLoss = 0.85 * Math.exp(-6 * trainingProgress) + 0.009;
    
    document.getElementById('trainEpoch').textContent = `Epoch: ${trainingEpoch}/150`;
    document.getElementById('trainLoss').textContent = `Loss: ${trainingLoss.toFixed(4)}`;
    
    if (Math.floor(performance.now()/220) % trainTypes.length !== trainTypeIdx) {
      trainTypeIdx = (trainTypeIdx + 1) % trainTypes.length;
      trainAngleMode = Math.floor(Math.random() * 3); // random view mode
      
      const type = trainTypes[trainTypeIdx].toUpperCase();
      const viewSuffix = trainTypes[trainTypeIdx] === 'ambulance' ? ` (${['SIDE', 'FRONT', 'TOP'][trainAngleMode]} VIEW)` : '';
      document.getElementById('trainClass').textContent = `Class: ${type}${viewSuffix}`;
      
      if (Math.random() < 0.28) {
        addLog(`[AI] Training angles (0°, 90°, 180°, 270°) for ${trainTypes[trainTypeIdx].toUpperCase()}...`, 'info');
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
  
  addLog('⚙️ RETRAINING AI MODEL on 8 classes across multiple angles...', 'warning');
}

/* ── Init ─────────────────────────────────────────────────── */
updateSigUI();setPhaseUI('normal');updateTimelineUI(0);updateClock();
toggleAuto(); // Turn on 1-minute auto mode on startup!
addLog('APTMS v5.0 — Correct vehicle angles active.','info');
addLog('🚗 Car | 🏍 Bike | 🚙 SUV | 🚛 Truck | 🚌 Bus | 🚐 Van | 🛺 Auto-Rickshaw | 🚜 Tractor | 🚙 Jeep | 🚓 Police','info');
addLog('Ambulance scheduled to arrive automatically every 1 minute.','info');
