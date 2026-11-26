#!/usr/bin/env node
// Checks that every deal url resolves. 404/410/DNS errors fail; 401/403/429/5xx (bot walls) only warn.
// --changed=file1,file2 limits the check to those YAML files (used on PRs).
import { loadDeals } from './lib.mjs';
const arg = (process.argv.find((a) => a.startsWith('--changed=')) || '').split('=')[1];
const only = arg ? new Set(arg.split(',').map((f) => f.split('/').pop())) : null;
const UA = 'Mozilla/5.0 (compatible; bf-deals-linkcheck/1.0; +https://github.com/nick-choudhary/dealsdrop)';
const items = loadDeals().filter((x) => !only || only.has(x.file));
const urls = [...new Set(items.map((x) => x.deal.url))];
async function probe(u) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(u, { method, redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(20000) });
      if (method === 'HEAD' && r.status >= 400) continue; // some servers mishandle HEAD; confirm with GET
      return r.status;
    } catch (e) { if (method === 'GET') return `ERR ${e.cause?.code || e.name}`; }
  }
}
const res = new Map(); let i = 0;
await Promise.all(Array.from({ length: 16 }, async () => { while (i < urls.length) { const u = urls[i++]; res.set(u, await probe(u)); } }));
let bad = 0, soft = 0;
for (const { file, index, deal } of items) for (const f of ['url']) {
  const s = res.get(deal[f]);
  if (s === 404 || s === 410 || (typeof s === 'string' && /ENOTFOUND|ECONNREFUSED|CERT/.test(s))) { bad++; console.log(`::error::${file}#${index + 1} (${deal.id}) ${f} ${deal[f]} -> ${s}`); }
  else if (typeof s === 'string' || s >= 400) { soft++; console.log(`::warning::${file}#${index + 1} (${deal.id}) ${f} ${deal[f]} -> ${s} (bot wall or transient)`); }
}
console.log(`\n${urls.length} unique links · ${bad} broken · ${soft} blocked/transient`);
process.exit(bad ? 1 : 0);
