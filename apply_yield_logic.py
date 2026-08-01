import re

code = open(r'C:\Users\Admin\OneDrive\Desktop\ambu\simulation.js', encoding='utf-8').read()

old_logic = '''
    const ahead=all.filter(v=>v.id!==this.id&&v.dir===this.dir&&!v.completedTurn&&v.pos>this.pos).sort((a,b)=>a.pos-b.pos)[0];
    const mustStop=(sig==='red'||sig==='yellow')&&!(phase==='priority'&&this.dir===AMB.dir) && (this.pos < stopLine || (this.pos < stopLine + 20 && this.spd < 5));
    let desired=this.spec.maxSpd;
    if(mustStop&&dist>0){const bd=(this.spd*this.spd)/(2*this.spec.dec);if(dist<=bd+18)desired=0;}
    if(mustStop&&this.pos>=stopLine){this.pos=stopLine;desired=0;}
    if(ahead){
      const gap=ahead.pos-this.spec.len/2-(this.pos+this.spec.len/2);
      const safe=this.spec.len*this.spec.gap+10;
      if(gap<safe&&gap>0)desired=Math.min(desired,ahead.spd*(gap/safe));
      else if(gap<=0)desired=0;
    }
'''

new_logic = '''
    let aheadList=all.filter(v=>v.id!==this.id&&v.dir===this.dir&&!v.completedTurn&&v.pos>this.pos);
    if (this.type === 'ambulance') {
        aheadList = aheadList.filter(v => v.type === 'ambulance'); // Ambulance ignores regular vehicles to pass them
    }
    const ahead = aheadList.sort((a,b)=>a.pos-b.pos)[0];

    // Vehicles give way to ambulance!
    const ambBehind = all.find(v => v.type === 'ambulance' && v.dir === this.dir && v.pos < this.pos && (this.pos - v.pos) < 250);
    if (this.type !== 'ambulance' && ambBehind) {
        this.lph = 25; // Shift 25 pixels sideways to give way!
    } else if (this.type !== 'ambulance') {
        this.lph = 0; // Return to center
    }

    const mustStop=(sig==='red'||sig==='yellow')&&!(phase==='priority'&&this.dir===AMB.dir) && (this.pos < stopLine || (this.pos < stopLine + 20 && this.spd < 5));
    let desired=this.spec.maxSpd;
    if(mustStop&&dist>0){const bd=(this.spd*this.spd)/(2*this.spec.dec);if(dist<=bd+18)desired=0;}
    if(mustStop&&this.pos>=stopLine){this.pos=stopLine;desired=0;}
    
    if(ahead){
      const gap=ahead.pos-this.spec.len/2-(this.pos+this.spec.len/2);
      const safe=this.spec.len*this.spec.gap+10;
      if(gap<safe&&gap>0)desired=Math.min(desired,ahead.spd*(gap/safe));
      else if(gap<=0)desired=0;
    }
'''

code = code.replace(old_logic.strip(), new_logic.strip())

open(r'C:\Users\Admin\OneDrive\Desktop\ambu\simulation.js', 'w', encoding='utf-8').write(code)
print("Give way logic applied.")
