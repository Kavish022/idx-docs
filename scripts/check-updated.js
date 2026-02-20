const fs = require('fs');
const path = require('path');

const file = '/tmp/myidex-updated.json';
if (!fs.existsSync(file)) {
  console.error('Updated JSON not found at', file);
  process.exit(2);
}
const raw = fs.readFileSync(file, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('JSON parse error:', e.message);
  process.exit(2);
}

const missing = [];

for (const [moduleKey, mod] of Object.entries(data.modules || {})) {
  if (!mod || !Array.isArray(mod.sections)) continue;
  for (const section of mod.sections) {
    const gaps = [];
    if (!section.title) gaps.push('title');
    if (!section.description && !section.objective && !section.purpose && !section.introduction)
      gaps.push('description/objective');
    if (
      !(section.procedure || section.steps) ||
      (Array.isArray(section.steps) && section.steps.length === 0 && !section.procedure)
    )
      gaps.push('steps/procedure');
    if (!section.screenshots || section.screenshots.length === 0) gaps.push('screenshots');
    if (!section.fields || section.fields.length === 0) gaps.push('fields');
    if (gaps.length) {
      missing.push({
        module: moduleKey,
        sectionId: section.id,
        sectionTitle: section.title || '(no title)',
        missing: gaps,
      });
    }
  }
}

const out = {
  totalSectionsChecked: Object.values(data.modules || {}).reduce(
    (s, m) => s + (m.sections ? m.sections.length : 0),
    0,
  ),
  missing,
};

const outFile = '/tmp/check-updated-result.json';
fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', outFile);
console.log(JSON.stringify(out, null, 2));
