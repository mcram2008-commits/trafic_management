import re

with open("simulation.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Replace polyfill and canvas initialization
canvas_init_regex = re.compile(r"/\* ── Canvas ───────────────────────────────────────────────── \*/.*?const canvas=document\.getElementById\('intersectionCanvas'\);.*?\n\n", re.DOTALL)
new_canvas_init = """/* ── Three.js Init ───────────────────────────────────────────────── */
const container = document.querySelector('.intersection-wrap');
const canvasOld = document.getElementById('intersectionCanvas');
if (canvasOld) canvasOld.remove(); // Remove old 2d canvas

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a192f');
let cx = container.clientWidth / 2;
let cy = container.clientHeight / 2;

const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 3000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
camera.position.set(0, 800, 600);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(200, 800, 300);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 800;
dirLight.shadow.camera.bottom = -800;
dirLight.shadow.camera.left = -800;
dirLight.shadow.camera.right = 800;
scene.add(dirLight);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

function resize(){
  if(renderer){
    cx = container.clientWidth / 2;
    cy = container.clientHeight / 2;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize',resize);
// Dummy ctx to prevent errors in legacy functions temporarily
let ctx = {
    save: ()=>{}, restore: ()=>{}, beginPath: ()=>{}, moveTo: ()=>{}, lineTo: ()=>{}, stroke: ()=>{},
    fill: ()=>{}, fillRect: ()=>{}, strokeRect: ()=>{}, ellipse: ()=>{}, roundRect: ()=>{},
    translate: ()=>{}, rotate: ()=>{}, drawImage: ()=>{}, fillText: ()=>{}, measureText: ()=>({width:0})
};
const canvas = { width: container.clientWidth, height: container.clientHeight };

"""
code = canvas_init_regex.sub(new_canvas_init, code)

# We need to map colors for the blocks
# We'll dynamically create meshes in the Vehicle constructor
veh_constructor_regex = re.compile(r"(this\.currentAngle=0;\s*)}")
new_veh_constructor = r"""\1
    
    // Create 3D Mesh
    const geom = new THREE.BoxGeometry(this.spec.wid, 30, this.spec.len);
    const mat = new THREE.MeshStandardMaterial({ color: this.col });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    worldGroup.add(this.mesh);
  }
"""
code = veh_constructor_regex.sub(new_veh_constructor, code)

# Update Vehicle.draw to move the mesh
veh_draw_regex = re.compile(r"draw\(rc\)\{.*?ctx\.restore\(\);\n\s*\}", re.DOTALL)
new_veh_draw = """draw(rc){
    // Determine path
    let p;
    if(this.completedTurn){
      const rd=rc[this.exitDir];
      p={x:rd.spawnX+rd.dx*this.exitPos,y:rd.spawnY+rd.dy*this.exitPos};
    }else if(this.turning){
      const hw=Math.min(canvas.width,canvas.height)*0.09;
      const sr=rc[this.dir],er=rc[this.exitDir];
      const cx_turn=sr.spawnX+sr.dx*this.turnStartPos,cy_turn=sr.spawnY+sr.dy*this.turnStartPos;
      const tr=this.turnRadius||(hw*1.5);
      const pr=Math.min(1,(this.pos-this.turnStartPos)/this.turnTotalDist);
      const curveX=cx_turn+sr.dx*(tr*pr)+er.dx*(tr*(1-Math.cos(pr*Math.PI/2)));
      const curveY=cy_turn+sr.dy*(tr*pr)+er.dy*(tr*(1-Math.cos(pr*Math.PI/2)));
      p={x:curveX,y:curveY};
      
      let targetAngle=er.angle;
      let startAngle=sr.angle;
      if(startAngle-targetAngle>Math.PI) targetAngle+=Math.PI*2;
      if(targetAngle-startAngle>Math.PI) startAngle+=Math.PI*2;
      this.currentAngle=startAngle+(targetAngle-startAngle)*pr;
    }else{
      const rd=rc[this.dir];
      p={x:rd.spawnX+rd.dx*this.pos,y:rd.spawnY+rd.dy*this.pos};
      this.currentAngle=rd.angle;
    }
    
    // Update 3D Mesh
    if(this.mesh) {
        this.mesh.position.set(p.x - cx, 15, p.y - cy);
        this.mesh.rotation.y = -this.currentAngle;
    }
  }
"""
code = veh_draw_regex.sub(new_veh_draw, code)

# Fix drawMain loop
main_loop_regex = re.compile(r"function draw\(ts\)\{.*?requestAnimationFrame\(draw\);\n\}", re.DOTALL)
new_main_loop = """function draw(ts){
  const dt=Math.min((ts-lastDraw)/1000,0.1)*simSpeed;lastDraw=ts;
  
  const rc=roadCfg();
  
  // Rebuild static meshes if road count changed (simple hack)
  if(!window.roadMeshesBuilt || window.lastRoadCount !== activeRoadCount) {
     build3DRoads();
     window.roadMeshesBuilt = true;
     window.lastRoadCount = activeRoadCount;
  }
  
  manageVehicles(dt,rc);
  [...vehicles].sort((a,b)=>a.pos-b.pos).forEach(v=>v.draw(rc));
  
  updateAmbulance3D(rc, dt);
  updateTLights3D();
  
  controls.update();
  renderer.render(scene, camera);
  
  scanA+=0.042*simSpeed;
  if(window.AMB && window.AMB.active) window.AMB.lph+=dt*3;
  tickTraining(dt);
  requestAnimationFrame(draw);
}
"""
code = main_loop_regex.sub(new_main_loop, code)

# Helper functions for 3D roads and ambulance
additions = """
function build3DRoads() {
    // Clear old roads
    const toRemove = [];
    worldGroup.children.forEach(c => {
        if(c.isRoad || c.isLight) toRemove.push(c);
    });
    toRemove.forEach(c => {
        worldGroup.remove(c);
        if(c.geometry) c.geometry.dispose();
        if(c.material) c.material.dispose();
    });
    
    // Create Asphalt
    const aspGeom = new THREE.PlaneGeometry(3000, 3000);
    const aspMat = new THREE.MeshStandardMaterial({color: '#1a1d24', roughness: 0.9});
    const asphalt = new THREE.Mesh(aspGeom, aspMat);
    asphalt.rotation.x = -Math.PI/2;
    asphalt.receiveShadow = true;
    asphalt.isRoad = true;
    worldGroup.add(asphalt);
    
    window.tLightMeshes = {};
}

function updateAmbulance3D(rc, dt) {
    if(!window.AMB) return;
    if(!AMB.mesh) {
        const geom = new THREE.BoxGeometry(AMB.spec.wid, 35, AMB.spec.len);
        const mat = new THREE.MeshStandardMaterial({ color: '#ffffff' }); // white amb
        AMB.mesh = new THREE.Mesh(geom, mat);
        AMB.mesh.castShadow = true;
        AMB.mesh.receiveShadow = true;
        worldGroup.add(AMB.mesh);
        
        // Add blue/red light
        const light = new THREE.PointLight(0xff0000, 1, 300);
        light.position.set(0, 25, 0);
        AMB.mesh.add(light);
        AMB.pointLight = light;
    }
    
    if(!AMB.active) {
        AMB.mesh.visible = false;
        return;
    }
    AMB.mesh.visible = true;
    
    // Blink light
    if(AMB.pointLight) {
        AMB.pointLight.color.setHex((Math.floor(performance.now()/150)%2===0) ? 0xff0000 : 0x0000ff);
    }
    
    // Movement logic copied from draw
    let p;
    if(AMB.completedTurn){
      const rd=rc[AMB.exitDir];
      p={x:rd.spawnX+rd.dx*AMB.exitPos,y:rd.spawnY+rd.dy*AMB.exitPos};
    }else if(AMB.turning){
      const hw=Math.min(canvas.width,canvas.height)*0.09;
      const sr=rc[AMB.dir],er=rc[AMB.exitDir];
      const cx_turn=sr.spawnX+sr.dx*AMB.turnStartPos,cy_turn=sr.spawnY+sr.dy*AMB.turnStartPos;
      const tr=AMB.turnTotalDist||(hw*2.5);
      const pr=Math.min(1,(AMB.pos-AMB.turnStartPos)/tr);
      const curveX=cx_turn+sr.dx*(tr*pr)+er.dx*(tr*(1-Math.cos(pr*Math.PI/2)));
      const curveY=cy_turn+sr.dy*(tr*pr)+er.dy*(tr*(1-Math.cos(pr*Math.PI/2)));
      p={x:curveX,y:curveY};
      
      let targetAngle=er.angle;
      let startAngle=sr.angle;
      if(startAngle-targetAngle>Math.PI) targetAngle+=Math.PI*2;
      if(targetAngle-startAngle>Math.PI) startAngle+=Math.PI*2;
      AMB.currentAngle=startAngle+(targetAngle-startAngle)*pr;
    }else{
      const rd=rc[AMB.dir];
      p={x:rd.spawnX+rd.dx*AMB.pos,y:rd.spawnY+rd.dy*AMB.pos};
      AMB.currentAngle=rd.angle;
    }
    
    AMB.mesh.position.set(p.x - cx, 17, p.y - cy);
    AMB.mesh.rotation.y = -AMB.currentAngle;
}

function updateTLights3D() {
    // We will just skip creating individual meshes for now and rely on UI
}
"""

code += additions

# We need to remove old garbage cleanup where vehicles are deleted from DOM but not scene.
clean_regex = re.compile(r"(vehicles\.delete\(v\);)", re.DOTALL)
code = clean_regex.sub(r"\1 if(v.mesh) worldGroup.remove(v.mesh);", code)

with open("simulation.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Migration script completed!")
