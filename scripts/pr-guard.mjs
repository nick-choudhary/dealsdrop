#!/usr/bin/env node
// PR guard rails for outside contributors. Usage: node scripts/pr-guard.mjs <baseSha> <prAuthor>
import { execFileSync } from 'node:child_process';
import * as yaml from 'js-yaml';
import { readJSON } from './lib.mjs';

const [base, author = ''] = process.argv.slice(2);
if (!base) { console.error('usage: pr-guard.mjs <baseSha> <author>'); process.exit(2); }
const rules = readJSON('config/rules.json');
const maintainers = (rules.maintainers || []).map((m) => m.toLowerCase());
const isMaintainer = maintainers.includes(author.toLowerCase());
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' });
const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
const errors = [];

if (!isMaintainer) {
  const outside = changed.filter((f) => !f.startsWith('data/deals/') && !['README.md', 'generated/deals.json', 'generated/deals.csv'].includes(f));
  if (outside.length) errors.push(`Contributors may only change data/deals/*.yaml (plus the regenerated README/generated files). Also changed: ${outside.join(', ')}`);
}

const load = (ref, f) => { try { return yaml.load(git('show', `${ref}:${f}`)) || []; } catch { return []; } };
const added = [];
for (const f of changed.filter((x) => x.startsWith('data/deals/') && x.endsWith('.yaml'))) {
  const before = new Map(load(base, f).map((d) => [d.id, JSON.stringify(d)]));
  for (const d of load('HEAD', f)) if (before.get(d.id) !== JSON.stringify(d)) added.push({ ...d, _new: !before.has(d.id) });
}
if (!isMaintainer) {
  const vendors = new Set(added.map((d) => d.vendor_domain));
  if (vendors.size > 1) errors.push(`One vendor per PR please; this PR touches ${vendors.size}: ${[...vendors].join(', ')}`);
  const maxNew = rules.max_new_deals_per_pr ?? 3;
  if (added.filter((d) => d._new).length > maxNew) errors.push(`At most ${maxNew} new deals per PR.`);
  for (const d of added.filter((x) => x._new)) {
    if ((d.added_by || '').toLowerCase() !== author.toLowerCase()) errors.push(`${d.id}: added_by must be your GitHub handle (@${author}).`);
    if (d.disclosure?.affiliated) console.log(`::warning::${d.id}: submitter disclosed affiliation (${d.disclosure.relationship}). Maintainer must verify the deal independently; label "affiliated".`);
  }
}
for (const e of errors) console.log(`::error::${e}`);
console.log(`pr-guard: ${changed.length} files changed, ${added.length} deals added/edited, author @${author}${isMaintainer ? ' (maintainer)' : ''} · ${errors.length} errors`);
process.exit(errors.length ? 1 : 0);
