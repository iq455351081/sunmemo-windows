import io
f = r'E:\Agentic_Engineering\ZCode\sunidea\_test-v17.mjs'
s = io.open(f, encoding='utf-8').read()
old = """const birdSeed = await ev(`({ bird: !!document.getElementById('ropeBird'), seed: !!document.getElementById('ropeSeed'), date: document.body.dataset.sunSeed || '' })`);
chk('全完成 → 小鸟现身', birdSeed.bird === true, JSON.stringify(birdSeed));
chk('太阳种子挂在绳尾（当日持久）', birdSeed.seed === true && birdSeed.date === new Date().toISOString().slice(0, 10), JSON.stringify(birdSeed));"""
new = """const birdSeed = await ev(`({ bird: !!document.getElementById('ropeBird'), seed: !!document.getElementById('ropeSeed') })`);
const cfg = JSON.parse(fs.readFileSync(process.env.APPDATA + E + 'SunMemo' + E + 'config.json', 'utf8'));
chk('全完成 → 小鸟现身', birdSeed.bird === true, JSON.stringify(birdSeed));
chk('太阳种子挂绳尾并当日持久', birdSeed.seed === true && cfg.settings.sunSeedDate === new Date().toISOString().slice(0, 10), JSON.stringify({ birdSeed, seedDate: cfg.settings.sunSeedDate }));"""
assert old in s, 'assert anchor'
s = s.replace(old, new)
if "import fs from" not in s:
    s = s.replace("const E = String.fromCharCode(92);", "import fs from 'node:fs';\nconst E = String.fromCharCode(92);", 1)
io.open(f, 'w', encoding='utf-8', newline='').write(s)
print('fixed')
