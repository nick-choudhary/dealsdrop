#!/usr/bin/env node
// Proves the validator rejects spam: each fixture must fail with the expected message.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as yaml from 'js-yaml';

const good = {
  id: 'acme-notes-bf', name: 'Acme Notes', vendor: 'Acme', vendor_domain: 'acme.com', category: 'productivity',
  deal_description: '40% off the first year of Pro for new customers.',
  discount: { type: 'percent', value: 40, up_to: false }, currency: 'USD', regular_price: 100, deal_price: 60,
  url: 'https://acme.com/pricing',
  start_date: '2026-11-20', end_date: '2026-12-01', verified_on: '2026-11-26',
  added_by: 'someone', affiliate: false, disclosure: { affiliated: false }, status: 'active',
};
const cases = [
  ['valid entry passes', {}, null],
  ['affiliate param', { url: 'https://acme.com/pricing?ref=abc' }, /tracking|affiliate/i],
  ['utm param', { url: 'https://acme.com/pricing?utm_source=x' }, /tracking/i],
  ['shortener', { url: 'https://bit.ly/abc' }, /affiliate|shortener|domain/i],
  ['wrong domain', { url: 'https://evil.example/acme' }, /domain/i],
  ['hype word', { deal_description: 'Insane 40% off the first year of Pro.' }, /banned|hype/i],
  ['exclamation', { deal_description: '40% off the first year of Pro!' }, /exclamation/i],
  ['all caps', { deal_description: 'HUGE 40% off the first year of PRO PLANS.' }, /caps|banned/i],
  ['too long', { deal_description: 'x'.repeat(170) }, /schema|160|long/i],
  ['affiliate true', { affiliate: true }, /schema|const|affiliate/i],
  ['undisclosed self-promo', { added_by: 'acme-founder' }, /disclos|affiliat/i],
  ['price inversion', { deal_price: 120 }, /price/i],
  ['end before start', { end_date: '2026-11-01' }, /date/i],
  ['bad category', { category: 'crypto' }, /schema|category|enum/i],
];
let fail = 0;
for (const [label, patch, expect] of cases) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfst-'));
  const d = { ...good, ...patch };
  fs.writeFileSync(path.join(dir, `${d.category}.yaml`), yaml.dump([d]));
  const r = spawnSync(process.execPath, ['scripts/validate.mjs', '--today=2026-11-26'], { env: { ...process.env, DEALS_DIR: dir }, encoding: 'utf8' });
  const out = r.stdout + r.stderr;
  const ok = expect ? r.status !== 0 && expect.test(out) : r.status === 0;
  if (!ok) { fail++; console.log(`FAIL  ${label}\n${out}`); } else console.log(`ok    ${label}`);
  fs.rmSync(dir, { recursive: true, force: true });
}
// duplicate + per-vendor cap
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfst-'));
  const many = [1, 2, 3, 4].map((i) => ({ ...good, id: `acme-${i}`, name: `Acme Plan ${i}`, url: `https://acme.com/p${i}` }));
  fs.writeFileSync(path.join(dir, 'productivity.yaml'), yaml.dump([...many, { ...good, id: 'acme-1' }]));
  const r = spawnSync(process.execPath, ['scripts/validate.mjs', '--today=2026-11-26'], { env: { ...process.env, DEALS_DIR: dir }, encoding: 'utf8' });
  const out = r.stdout;
  for (const [label, re] of [['duplicate id', /duplicate/i], ['max deals per vendor', /per vendor|max/i]]) {
    if (r.status !== 0 && re.test(out)) console.log(`ok    ${label}`); else { fail++; console.log(`FAIL  ${label}\n${out}`); }
  }
  fs.rmSync(dir, { recursive: true, force: true });
}
// big-retailer cap exception (config/rules.json vendor_cap_exceptions)
{
  const rules = JSON.parse(fs.readFileSync('config/rules.json', 'utf8'));
  const cap = rules.vendor_cap_exceptions['flipkart.com'];
  const fk = (n) => Array.from({ length: n }, (_, i) => ({ ...good, id: `fk-${i}`, name: `Flipkart Deal ${i}`, vendor: 'Flipkart', vendor_domain: 'flipkart.com', url: `https://www.flipkart.com/p${i}` }));
  for (const [label, n, pass] of [[`exception vendor allowed ${cap} deals`, cap, true], [`exception vendor rejected at ${cap + 1}`, cap + 1, false]]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfst-'));
    fs.writeFileSync(path.join(dir, 'productivity.yaml'), yaml.dump(fk(n)));
    const r = spawnSync(process.execPath, ['scripts/validate.mjs', '--today=2026-11-26'], { env: { ...process.env, DEALS_DIR: dir }, encoding: 'utf8' });
    const ok = pass ? r.status === 0 : r.status !== 0 && /per vendor/.test(r.stdout);
    if (ok) console.log(`ok    ${label}`); else { fail++; console.log(`FAIL  ${label}\n${r.stdout}`); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
console.log(fail ? `\n${fail} self-test(s) failed` : '\nall validator self-tests passed');
process.exit(fail ? 1 : 0);
