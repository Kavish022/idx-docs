const fs = require('fs');
const src = '/tmp/myidex-updated.json';
const out = '/tmp/myidex-updated-fixed.json';
if (!fs.existsSync(src)) {
  console.error('Source not found:', src);
  process.exit(2);
}
const data = JSON.parse(fs.readFileSync(src, 'utf8'));
let changed = 0;
for (const modKey of Object.keys(data.modules || {})) {
  const mod = data.modules[modKey];
  if (!mod || !Array.isArray(mod.sections)) continue;
  for (const section of mod.sections) {
    if (!('fields' in section) || !Array.isArray(section.fields)) {
      section.fields = section.fields && Array.isArray(section.fields) ? section.fields : [];
      changed++;
    }
    if (!('procedure' in section) && !('steps' in section)) {
      section.steps = Array.isArray(section.steps) ? section.steps : [];
      changed++;
    }
    // ensure screenshots exists
    if (!('screenshots' in section) || !Array.isArray(section.screenshots)) {
      section.screenshots =
        section.screenshots && Array.isArray(section.screenshots) ? section.screenshots : [];
      changed++;
    }
  }
}
fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
console.log('Wrote', out, 'changed entries:', changed);
