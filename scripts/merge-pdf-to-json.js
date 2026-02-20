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
  console.error('Text file not found:', textFile);
  process.exit(2);
}
const rawText = fs.readFileSync(textFile, 'utf8');
const textLines = rawText
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));

const titles = (data.tableOfContents || []).map((t) => t.title);

// build occurrences map
const occurrences = {};
for (const title of titles) occurrences[title] = [];
for (let i = 0; i < textLines.length; i++) {
  const line = textLines[i].toLowerCase();
  for (const title of titles) {
    if (line.includes(title.toLowerCase())) occurrences[title].push(i);
  }
}

const allOcc = Object.values(occurrences).flat();
const tocEnd = allOcc.length ? Math.max(...allOcc) : 0;

function findTitleIndex(title) {
  const cand = occurrences[title] || [];
  if (cand.length === 0) return -1;
  for (const idx of cand) {
    if (idx <= tocEnd) continue;
    const lookAhead = textLines.slice(idx + 1, idx + 8).join(' ');
    if (
      /\b(Objective|Procedure|Step|Steps|To add|To view|Navigation|This Standard Operating Procedure)\b/i.test(
        lookAhead,
      )
    )
      return idx;
  }
  for (const idx of cand) if (idx > tocEnd) return idx;
  return cand[cand.length - 1];
}

const titlePositions = titles
  .map((t) => ({ title: t, idx: findTitleIndex(t) }))
  .filter((t) => t.idx >= 0);
titlePositions.sort((a, b) => a.idx - b.idx);

function extractBlock(title) {
  const pos = titlePositions.find((p) => p.title === title);
  if (!pos) return null;
  const start = pos.idx + 1;
  const later = titlePositions.filter((p) => p.idx > pos.idx);
  const end = later.length ? later[0].idx : textLines.length;
  return textLines.slice(start, end).join('\n');
}

function extractParagraph(block, heading) {
  const lines = block.split(/\n/);
  const idx = lines.findIndex((l) => l.toLowerCase().startsWith(heading.toLowerCase()));
  if (idx < 0) return null;
  const out = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) break;
    if (/^(Procedure|Steps|Navigation|Notes|Screenshots|Objective|Purpose|Introduction):?/i.test(l))
      break;
    out.push(l);
  }
  return out.join(' ');
}

function extractNumbered(block) {
  const lines = block.split(/\n/);
  const items = [];
  for (const l of lines) {
    const m = l.match(/^\s*(?:\d+|\d+\.)[\)\.]?\s+(.*)$/);
    if (m) items.push(m[1].trim());
  }
  if (items.length === 0) {
    for (const l of lines) {
      if (/^\d+\s+/.test(l)) items.push(l.replace(/^\d+\s+/, '').trim());
    }
  }
  return items;
}

let updated = 0;

for (const moduleKey of Object.keys(data.modules || {})) {
  const mod = data.modules[moduleKey];
  if (!mod.sections) continue;
  for (const sec of mod.sections) {
    const tocEntry = (data.tableOfContents || []).find((t) => t.title === sec.title);
    const block = tocEntry ? extractBlock(tocEntry.title) : null;
    if (!block) continue;

    // objective/description
    if (!sec.description && !sec.objective && !sec.purpose && !sec.introduction) {
      const obj =
        extractParagraph(block, 'Objective') ||
        extractParagraph(block, 'Purpose') ||
        extractParagraph(block, 'Introduction');
      if (obj) {
        sec.objective = obj;
        updated++;
      } else {
        // fallback: use first paragraph of the block as a short description
        const lines = block
          .split(/\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length) {
          const para = [];
          for (const l of lines) {
            if (/^\d+\./.test(l)) break;
            if (/^(Financial Graph|Procedure|Steps|Notes|Screenshot|Screenshots)/i.test(l)) break;
            para.push(l);
            if (para.length >= 3) break;
          }
          if (para.length) {
            sec.description = para.join(' ');
            updated++;
          }
        }
      }
    }

    // steps/procedure (numbered lists)
    const procList = extractNumbered(block);
    if (
      ((!sec.procedure && !(sec.steps && sec.steps.length)) ||
        (sec.steps && sec.steps.length === 0)) &&
      procList.length
    ) {
      sec.procedure = procList;
      updated++;
    }

    // screenshots placeholder
    if ((!sec.screenshots || sec.screenshots.length === 0) && /screenshot/i.test(block))
      sec.screenshots = sec.screenshots || [];

    // try to infer simple fields: look for lines after 'Enter' or lines that look like 'Field: Description' or table-like lines
    if (!sec.fields || sec.fields.length === 0) {
      const lines = block.split(/\n/);
      const found = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        if (!l) continue;
        // common label lines
        if (
          /^Enter\b/i.test(l) ||
          /^Select\b/i.test(l) ||
          /Field|Name|Type|Required|Description|Notes/i.test(l)
        ) {
          // take this line or next few as candidate
          const candidate = l.replace(/^[-0-9\.\s:]*/, '').slice(0, 120);
          if (candidate && candidate.length > 2) found.push(candidate);
        }
        // lines that look like "FieldName - Type - Required"
        if (/^[A-Za-z0-9 _\-]+\s+[\-\|]\s+[A-Za-z]+/i.test(l) || l.includes(':')) {
          found.push(l);
        }
      }
      if (found.length) {
        sec.fields = found.slice(0, 40).map((s) => ({
          name: s
            .replace(/^[-0-9\.\s:]*/, '')
            .trim()
            .slice(0, 60),
          type: 'string',
        }));
        updated++;
      }
    }
  }
}

if (updated > 0) {
  const outFile = '/tmp/myidex-updated.json';
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf8');
  console.log('Updated JSON written to', outFile, 'fields updated:', updated);
} else {
  console.log('No updates found from PDF extraction.');
}
