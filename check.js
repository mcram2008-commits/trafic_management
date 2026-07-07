global.CanvasRenderingContext2D = {prototype: {}};
global.document = {
  getElementById: (id) => {
    if (id === 'intersectionCanvas') {
      return {
        getContext: () => ({
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          stroke: () => {},
          fill: () => {},
          fillRect: () => {},
          clearRect: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          rotate: () => {},
          arc: () => {},
          ellipse: () => {},
          drawImage: () => {},
          fillText: () => {},
          measureText: () => ({ width: 10 }),
          setLineDash: () => {},
          createRadialGradient: () => ({ addColorStop: () => {} }),
          createLinearGradient: () => ({ addColorStop: () => {} })
        }),
        width: 800,
        height: 600,
        parentElement: { clientWidth: 800, clientHeight: 600 },
        addEventListener: () => {},
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {} }
      };
    }
    return {
      remove: () => {},
      addEventListener: () => {},
      style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      appendChild: () => {},
      removeChild: () => {},
      children: [],
      getContext: () => ({
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        stroke: () => {},
        fill: () => {},
        fillRect: () => {},
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        arc: () => {},
        ellipse: () => {},
        drawImage: () => {},
        fillText: () => {},
        measureText: () => ({ width: 10 }),
        setLineDash: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createLinearGradient: () => ({ addColorStop: () => {} })
      })
    };
  },
  querySelector: () => ({ clientWidth: 800, clientHeight: 600, appendChild: () => {} }),
  createElement: () => ({
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    appendChild: () => {},
    append: () => {}
  })
};
global.window = {
  addEventListener: () => {},
  performance: { now: () => 0 },
  requestAnimationFrame: () => {}
};
global.requestAnimationFrame = () => {};
global.THREE = {
  Scene: class {}, Color: class {}, PerspectiveCamera: class { get position(){return {set:()=>{}};} },
  OrbitControls: class { setTarget(){} get target(){ return {set:()=>{}}; } enableDamping(){} update(){} },
  WebGLRenderer: class { setSize(){} get domElement(){ return {}; } get shadowMap(){ return {}; } },
  AmbientLight: class {}, DirectionalLight: class { get shadow(){ return {camera:{}}; } set position(v){}},
  Group: class { add(){} remove(){} get children(){return []} }, BoxGeometry: class {}, MeshStandardMaterial: class {}, Mesh: class { get position(){return {set:()=>{}};} get rotation(){return {y:0};} },
  PlaneGeometry: class {}, CylinderGeometry: class {}, SphereGeometry: class {}, MeshBasicMaterial: class {}, PointLight: class { get position(){return {set:()=>{}};} }
};
global.THREE.OrbitControls = function(){ this.target = {set:()=>{}}; };
global.Image = class {};
global.AMB_SRC = ''; global.CAR_SRC = ''; global.AUTO_SRC = ''; global.BUS_SRC = ''; global.TRUCK_SRC = '';
global.BIKE_SRC = ''; global.SHAREAUTO_SRC = ''; global.SCHOOLVAN_SRC = ''; global.TATAACE_SRC = '';
global.POLICE_SRC = ''; global.FIREENGINE_SRC = ''; global.SCOOTER_SRC = ''; global.THAR_SRC = '';
global.TRACTOR_SRC = ''; global.ERICKSHAW_SRC = ''; global.BULLET_SRC = ''; global.GARBAGE_SRC = '';
global.TANKER_SRC = '';

require('./simulation.js');
console.log("No syntax or immediate runtime errors!");
