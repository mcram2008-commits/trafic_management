import re

with open('simulation.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove the white/yellow boxes by removing them from the allowed spawn list
code = re.sub(
    r"const t=\['swift'.*?;",
    "const t=['swift','swift','scorpio','suv','garbage','tanker','police','fireengine','thar','tractor','ambulance'];",
    code
)

# Fix ambulance to stay on the road (reduce speed, acceleration)
# Originally: ambulance: {wid:55, len:85, maxSpd:100, acc:80, dec:150, gap:1.5}
# Make it behave more like a standard car so it doesn't drift off road
code = re.sub(
    r"ambulance:\s*\{.*?\}",
    "ambulance: {wid:45, len:75, maxSpd:60, acc:40, dec:100, gap:1.5}",
    code
)

with open('simulation.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated simulation.js")
