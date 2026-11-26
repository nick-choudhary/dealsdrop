import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const DEALS_DIR = process.env.DEALS_DIR || path.join(ROOT, 'data', 'deals');
export const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

export const CATEGORY_META = {
  'ai': { title: 'AI Tools', emoji: '🤖' },
  'developer-tools': { title: 'Developer Tools', emoji: '🛠️' },
  'hosting-cloud': { title: 'Hosting, Cloud & Domains', emoji: '☁️' },
  'website-builders': { title: 'Website Builders, Templates & WordPress', emoji: '🧱' },
  'design-media': { title: 'Design, Photo, Video & Audio', emoji: '🎨' },
  'productivity': { title: 'Productivity & Utilities', emoji: '⚡' },
  'business-marketing': { title: 'Marketing, Sales & SEO', emoji: '📈' },
  'security-privacy': { title: 'VPN, Security & Privacy', emoji: '🔒' },
  'learning': { title: 'Courses & Learning', emoji: '📚' },
  'electronics': { title: 'Tech, Gadgets, Laptops, Phones & Audio', emoji: '💻' },
  'home-appliances': { title: 'Home & Appliances', emoji: '🏠' },
  'fashion': { title: 'Fashion & Beauty', emoji: '👟' },
  'gaming': { title: 'Gaming', emoji: '🎮' },
  'travel': { title: 'Travel', emoji: '✈️' },
  'streaming-subscriptions': { title: 'Streaming & Subscriptions', emoji: '📺' },
};

export function loadDeals() {
  const files = fs.readdirSync(DEALS_DIR).filter((f) => f.endsWith('.yaml')).sort();
  const out = [];
  for (const f of files) {
    const docs = yaml.load(fs.readFileSync(path.join(DEALS_DIR, f), 'utf8'), { schema: yaml.JSON_SCHEMA }) || [];
    if (!Array.isArray(docs)) throw new Error(`${f}: top level must be a YAML list of deals`);
    docs.forEach((d, i) => out.push({ file: f, index: i, deal: d }));
  }
  return out;
}

export const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; } };
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const normName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
