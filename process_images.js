const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const artifactsDir = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\f75b7e13-6572-4aaf-9959-4ef7c9110022';
const files = {
    car: 'indian_car_topdown_1783178560228.png',
    auto: 'indian_auto_topdown_1783178579341.png',
    bus: 'indian_bus_topdown_1783178596995.png',
    truck: 'indian_truck_topdown_1783178609304.png',
    amb: 'indian_ambulance_topdown_1783178620784.png'
};

async function processImages() {
    let outputJS = '';

    for (const [name, filename] of Object.entries(files)) {
        const filepath = path.join(artifactsDir, filename);
        if (!fs.existsSync(filepath)) {
            console.log(`Skipping ${filename}, not found`);
            continue;
        }

        const image = await Jimp.read(filepath);
        
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            
            if (g > 150 && r < 150 && b < 150) {
                this.bitmap.data[idx + 3] = 0; // alpha
            }
        });

        const base64 = await image.getBase64Async(Jimp.MIME_PNG);
        outputJS += `const ${name.toUpperCase()}_SRC = '${base64}';\n\n`;
        console.log(`Processed ${name}`);
    }

    fs.writeFileSync('images.js', outputJS);
    console.log('Done!');
}

processImages().catch(console.error);
