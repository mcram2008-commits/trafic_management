const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });

dom.window.onerror = function(msg, url, line) {
  console.log("JSDOM Error:", msg, "Line:", line);
};

setTimeout(() => {
  console.log("Finished running scripts in JSDOM.");
}, 2000);
