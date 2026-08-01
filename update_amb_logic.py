import re

code = open(r'C:\Users\Admin\OneDrive\Desktop\ambu\simulation.js', encoding='utf-8').read()

# Update the give way logic to ALSO check for the global AMB object!
old_logic = '''
    // Vehicles give way to ambulance!
    const ambBehind = all.find(v => v.type === 'ambulance' && v.dir === this.dir && v.pos < this.pos && (this.pos - v.pos) < 250);
    if (this.type !== 'ambulance' && ambBehind) {
        this.lph = 25; // Shift 25 pixels sideways to give way!
    } else if (this.type !== 'ambulance') {
        this.lph = 0; // Return to center
    }
'''

new_logic = '''
    // Vehicles give way to ambulance (both regular ones and the Global AMB)
    const ambBehind = all.find(v => v.type === 'ambulance' && v.dir === this.dir && v.pos < this.pos && (this.pos - v.pos) < 250);
    const globalAmbBehind = AMB.active && AMB.dir === this.dir && AMB.pos < this.pos && (this.pos - AMB.pos) < 250;
    
    if (this.type !== 'ambulance' && (ambBehind || globalAmbBehind)) {
        this.lph = 25; // Shift 25 pixels sideways to give way!
    } else if (this.type !== 'ambulance') {
        this.lph = 0; // Return to center
    }
'''

code = code.replace(old_logic.strip(), new_logic.strip())

open(r'C:\Users\Admin\OneDrive\Desktop\ambu\simulation.js', 'w', encoding='utf-8').write(code)
print("Give way logic updated for global AMB!")
