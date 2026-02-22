const fs = require('fs');
const path = require('path');

const repoJson = path.resolve(
  __dirname,
  '..',
  'public',
  'assets',
  'data',
  'myidex-hub-sop-complete.json',
);
const backup = repoJson + '.without-fields.bak';
if (!fs.existsSync(repoJson)) {
  console.error('Repo JSON not found at', repoJson);
  process.exit(2);
}
const raw = fs.readFileSync(repoJson, 'utf8');
const data = JSON.parse(raw);
let removed = 0;
for (const modKey of Object.keys(data.modules || {})) {
  const mod = data.modules[modKey];
  if (!mod || !Array.isArray(mod.sections)) continue;
  for (const sec of mod.sections) {
    if ('fields' in sec) {
      delete sec.fields;
      removed++;
    }
    // also remove nested addingValueStream.fields if present
    if (sec.addingValueStream && 'fields' in sec.addingValueStream) {
      delete sec.addingValueStream.fields;
      removed++;
    }
  }
}
fs.copyFileSync(repoJson, backup);
fs.writeFileSync(repoJson, JSON.stringify(data, null, 2), 'utf8');
console.log('Removed', removed, '`fields` entries. Backup written to', backup);
