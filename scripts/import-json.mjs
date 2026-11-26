#!/usr/bin/env node
// Maintainer utility: writes data/deals/<category>.yaml from a JSON array of deals (used for the initial seed import).
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { DEALS_DIR } from './lib.mjs';
const src = process.argv[2];
if (!src) { console.error('usage: node scripts/import-json.mjs deals.json'); process.exit(1); }
const deals = JSON.parse(fs.readFileSync(src, 'utf8'));
const by = {};
for (const d of deals) (by[d.category] ||= []).push(d);
for (const [cat, list] of Object.entries(by)) {
  list.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const body = list.map((d) => yaml.dump([d], { lineWidth: -1, noRefs: true, quotingType: "'", forceQuotes: false })).join('\n');
  fs.writeFileSync(path.join(DEALS_DIR, `${cat}.yaml`), `# ${cat} — one entry per deal. Schema: schema/deal.schema.json. See CONTRIBUTING.md.\n${body}`);
}
console.log(`wrote ${Object.keys(by).length} files, ${deals.length} deals`);
