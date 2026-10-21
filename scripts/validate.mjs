import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateData, safeURL} from '../content.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const data = validateData(JSON.parse(readFileSync(path.join(root, 'data/news.json'), 'utf8')));
const errors = [];
const legacy = new Set();
for (const item of data.items) {
  const fail = message => errors.push(`${item.id}: ${message}`);
  if (new Date(`${item.date}T00:00:00Z`).toISOString().slice(0,10) !== item.date) fail('invalid calendar date');
  if (item.legacyIndex !== undefined) {
    if (!Number.isInteger(item.legacyIndex) || item.legacyIndex < 0 || legacy.has(item.legacyIndex)) fail('duplicate/invalid legacyIndex');
    legacy.add(item.legacyIndex);
  }
  if (item.cover && !safeURL(item.cover.src) && !existsSync(path.join(root, item.cover.src))) fail('missing cover image');
  if (item.url && !safeURL(item.url)) fail('url must be HTTPS');
  if (item.sources !== undefined && !Array.isArray(item.sources)) fail('sources must be an array');
  for (const source of item.sources || []) if (!safeURL(source.url)) fail('invalid source URL');
  if (item.category === 'news' && !item.url && !item.sources?.length) fail('news must link to a source');
  for (const block of item.blocks || []) {
    if (!['heading','paragraph','list','steps','code','quote','link','image'].includes(block.type)) fail('unknown block type');
    if (['list','steps'].includes(block.type) && (!Array.isArray(block.items) || block.items.some(x => typeof x !== 'string'))) fail('invalid list');
    if (block.type === 'link' && !safeURL(block.url)) fail('invalid block URL');
    if (block.type === 'image') {
      if (!block.alt) fail('images require descriptive alt text');
      if (!safeURL(block.src)) {
        if (!/^\.\/assets\/[\w./-]+$/.test(block.src || '') || block.src.includes('..') || !existsSync(path.join(root, block.src))) fail('invalid or missing local image');
      }
    }
  }
}
for (const file of ['index.html','article.html']) {
  const html = readFileSync(path.join(root, file), 'utf8');
  for (const [, ref] of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)(?:\?[^"#]*)?"/g)) {
    if (!existsSync(path.join(root, ref))) errors.push(`${file}: missing ${ref}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Validated ${data.items.length} articles; stable IDs, sources, blocks and page assets are valid.`);
