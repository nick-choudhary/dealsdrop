#!/usr/bin/env node
// Marks deals whose end_date has passed as `status: expired` (in place). Used by the daily stale-deal workflow.
import fs from 'node:fs';
import path from 'node:path';
import { DEALS_DIR, todayISO } from './lib.mjs';
const today = todayISO(); let n = 0;
for (const f of fs.readdirSync(DEALS_DIR).filter((x) => x.endsWith('.yaml'))) {
  const p = path.join(DEALS_DIR, f); const src = fs.readFileSync(p, 'utf8');
  // line-based edit keeps comments/formatting intact
  const blocks = src.split(/\n(?=- id: )/);
  const out = blocks.map((b) => {
    const m = b.match(/\n {2}end_date: '?(\d{4}-\d{2}-\d{2})'?/);
    if (m && m[1] < today && !/\n {2}status: expired/.test(b)) { n++; return b.replace(/\n {2}status: active/, '') + '\n  status: expired'; }
    return b;
  }).join('\n');
  if (out !== src) fs.writeFileSync(p, out.endsWith('\n') ? out : out + '\n');
}
console.log(`${n} deal(s) marked expired as of ${today}`);
