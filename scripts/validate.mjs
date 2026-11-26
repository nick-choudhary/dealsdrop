#!/usr/bin/env node
// Validates every deal in data/deals/*.yaml. Exit code 1 on any error.
// Flags: --strict (warnings become errors), --today=YYYY-MM-DD (override clock for tests)
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { loadDeals, readJSON, hostOf, todayISO, normName } from './lib.mjs';

const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const TODAY = (args.find((a) => a.startsWith('--today=')) || '').split('=')[1] || todayISO();
const schema = readJSON('schema/deal.schema.json');
const rules = readJSON('config/rules.json');
const allow = readJSON('config/domain-allowlist.json');
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const errors = []; const warnings = [];
const err = (loc, m) => errors.push(`${loc}: ${m}`);
const warn = (loc, m) => warnings.push(`${loc}: ${m}`);
const trackRe = rules.tracking_params.map((p) => new RegExp(p, 'i'));
const affPathRe = rules.affiliate_path_patterns.map((p) => new RegExp(p, 'i'));
const bannedRe = rules.banned_words.map((w) => /^[\w' -]+$/.test(w)
  ? new RegExp(`(^|[^a-z0-9])${w.replace(/[-]/g, '[- ]?').replace(/ /g, '\\s+')}($|[^a-z0-9])`, 'i')
  : new RegExp(w.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&'), 'i'));
const EMOJI = /\p{Extended_Pictographic}/u;

function checkUrl(loc, field, u) {
  let url; try { url = new URL(u); } catch { return err(loc, `${field} is not a valid URL`); }
  const host = url.hostname.toLowerCase();
  if (rules.affiliate_hosts.some((h) => host === h || host.endsWith('.' + h))) err(loc, `${field} uses a link shortener / affiliate host (${host})`);
  for (const [k] of url.searchParams) if (trackRe.some((r) => r.test(k))) err(loc, `${field} has tracking/affiliate parameter "${k}" — remove it`);
  if (affPathRe.some((r) => r.test(url.pathname + url.search))) err(loc, `${field} path looks like an affiliate redirect (${url.pathname})`);
  if (url.hash && /ref|aff|utm/i.test(url.hash)) err(loc, `${field} has tracking data in the #fragment`);
}

const all = loadDeals();
const seenId = new Map(); const seenKey = new Map(); const perVendor = new Map(); const seenUrlCode = new Map();

for (const { file, index, deal: d } of all) {
  const loc = `${file}#${index + 1}${d && d.id ? ` (${d.id})` : ''}`;
  if (!validateSchema(d)) {
    for (const e of validateSchema.errors) err(loc, `schema ${e.instancePath || '/'} ${e.message}${e.params && e.params.allowedValues ? ' ' + JSON.stringify(e.params.allowedValues) : ''}`);
    continue;
  }
  // file/category consistency
  if (file !== `${d.category}.yaml`) err(loc, `category "${d.category}" must live in data/deals/${d.category}.yaml`);
  // ids & duplicates
  if (seenId.has(d.id)) err(loc, `duplicate id (also ${seenId.get(d.id)})`); else seenId.set(d.id, loc);
  const key = `${d.vendor_domain}|${normName(d.name)}`;
  if (seenKey.has(key)) err(loc, `duplicate deal for same vendor+name (also ${seenKey.get(key)})`); else seenKey.set(key, loc);
  if (d.coupon_code) {
    const uc = `${d.url.replace(/\/$/, '')}|${d.coupon_code.toUpperCase()}`;
    if (seenUrlCode.has(uc)) err(loc, `same url + coupon already listed (${seenUrlCode.get(uc)})`); else seenUrlCode.set(uc, loc);
  }
  perVendor.set(d.vendor_domain, [...(perVendor.get(d.vendor_domain) || []), loc]);
  // URLs
  checkUrl(loc, 'url', d.url);
  const host = hostOf(d.url);
  const okHosts = [d.vendor_domain, ...(allow[d.vendor_domain] || [])];
  if (!okHosts.some((h) => host === h || host.endsWith('.' + h))) err(loc, `url host "${host}" does not match vendor_domain "${d.vendor_domain}" (official links only; maintainers can add sister domains in config/domain-allowlist.json)`);
  // self-promotion / disclosure
  const handle = d.added_by.toLowerCase().replace(/-/g, '');
  const vendorSlug = normName(d.vendor); const domSlug = normName(d.vendor_domain.split('.').slice(-2, -1)[0]);
  const looksAffiliated = handle.length >= 4 && (handle.includes(domSlug) || handle.includes(vendorSlug) || (domSlug.length >= 4 && domSlug.includes(handle)));
  if (looksAffiliated && !d.disclosure.affiliated) err(loc, `added_by "${d.added_by}" looks related to ${d.vendor} — set disclosure.affiliated: true with a relationship`);
  if (d.disclosure.affiliated) {
    warn(loc, `affiliated submission (${d.disclosure.relationship}) — needs maintainer review`);
  }
  // copy rules
  for (const f of ['name', 'deal_description', 'notes']) {
    const v = d[f]; if (!v) continue;
    if (EMOJI.test(v)) err(loc, `${f} must not contain emoji`);
    const vb = (rules.banned_word_exceptions || []).reduce((acc, ph) => acc.split(ph).join(' '), v);
    for (const r of bannedRe) if (r.test(vb)) { err(loc, `${f} contains banned hype word (${r.source.replace(/\(\^\|\[\^a-z0-9\]\)|\(\$\|\[\^a-z0-9\]\)/g, '')})`); break; }
    if ((v.match(/!/g) || []).length > 0 && f !== 'name') err(loc, `${f} must not use exclamation marks`);
    const shouty = (v.match(/\b[A-Z]{5,}\b/g) || []).filter((w) => !(d.coupon_code || '').toUpperCase().split(/[^A-Z0-9]+/).concat((d.coupon_code || '').toUpperCase()).includes(w) && !/^(BFCM|USD|INR|EUR|GBP|OLED|QLED|HDMI|NVME|LIFETIME)$/.test(w) && !(rules.allowed_caps || []).includes(w));
    if (shouty.length) err(loc, `${f} has ALL-CAPS words (${shouty.join(', ')}) — write normally`);
  }
  if (d.coupon_code && !d.deal_description.toLowerCase().includes(d.coupon_code.toLowerCase()) && !d.notes) { /* fine: code shown in its own column */ }
  // prices
  if (d.regular_price != null && d.deal_price != null && d.deal_price >= d.regular_price) err(loc, 'deal_price must be lower than regular_price');
  if ((d.regular_price != null || d.deal_price != null) && !d.currency) err(loc, 'currency is required when a price is given');
  if (d.discount.type === 'percent' && d.discount.value != null && d.discount.value > 100) err(loc, 'percent discount cannot exceed 100');
  // dates
  if (d.start_date && d.end_date && d.end_date < d.start_date) err(loc, 'end_date is before start_date');
  if (d.end_date && !/^202[67]-/.test(d.end_date)) err(loc, 'end_date must be in the 2026 season (2026 or early 2027)');
  if (d.verified_on > TODAY) err(loc, 'verified_on is in the future');
  if (d.end_date && d.end_date < TODAY && d.status !== 'expired') warn(loc, `expired on ${d.end_date} — set status: expired or remove`);
  const age = (Date.parse(TODAY) - Date.parse(d.verified_on)) / 864e5;
  if (age > rules.stale_verification_days) warn(loc, `verified_on is ${Math.round(age)} days old — re-verify`);
}
const capFor = (v) => (typeof rules.vendor_cap_exceptions?.[v] === 'number' ? rules.vendor_cap_exceptions[v] : rules.max_deals_per_vendor);
for (const [v, locs] of perVendor) if (locs.length > capFor(v)) err(locs[locs.length - 1], `vendor ${v} has ${locs.length} deals (max ${capFor(v)} per vendor; see vendor_cap_exceptions in config/rules.json)`);

for (const w of warnings) console.log(`::warning::${w}`);
for (const e of errors) console.log(`::error::${e}`);
const fail = errors.length || (STRICT && warnings.length);
console.log(`\n${all.length} deals checked · ${errors.length} errors · ${warnings.length} warnings${STRICT ? ' (strict)' : ''}`);
process.exit(fail ? 1 : 0);
