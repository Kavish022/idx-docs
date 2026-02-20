const fs = require('fs');
const path = require('path');

const textFile = '/tmp/myidex-full.txt';
const jsonFile = path.resolve(
  __dirname,
  '..',
  'public',
  'assets',
  'data',
  'myidex-hub-sop-complete.json',
);
if (!fs.existsSync(textFile)) {
  console.error('text not found');
  process.exit(2);
}
const raw = fs
  .readFileSync(textFile, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim());
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
for (const t of data.tableOfContents || []) {
  const lc = t.title.toLowerCase();
  let found = -1;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].toLowerCase().includes(lc)) {
      found = i;
      break;
    }
  }
  console.log(t.id, t.title, '=>', found >= 0 ? `line ${found + 1}` : 'NOT FOUND');
}
