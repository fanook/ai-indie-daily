/** Pure content helpers shared by the browser and regression tests. No dependencies. */
export const SECTIONS = {
  news: {name: 'AI 资讯', description: '关注技术的变化，也关注它能帮你做什么。'},
  learn: {name: 'AI 学习', description: '从一个具体问题出发，把新的方法用进项目。'},
  tools: {name: '游戏工具', description: '找到趁手的工具，让想法更快成为可玩的作品。'},
  ideas: {name: '游戏创意', description: '收集有趣的机制，从一个小小的原型开始验证。'},
};
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
export function imageURL(value) {
  return safeURL(value) || (typeof value === 'string' && /^\.\/assets\/[\w./-]+$/.test(value) && !value.includes('..') ? value : '');
}
export function readState(search) {
  const p = new URLSearchParams(search);
  return {section: Object.hasOwn(SECTIONS, p.get('section')) ? p.get('section') : 'all', q: p.get('q') || '', label: p.get('label') || '', month: /^\d{4}-\d{2}$/.test(p.get('month')) ? p.get('month') : '', order: p.get('order') === 'old' ? 'old' : 'new', saved: p.get('saved') === '1'};
}
export function stateQuery(state) {
  const p = new URLSearchParams({section: state.section});
  for (const field of ['q', 'label', 'month']) if (state[field]) p.set(field, state[field]);
  if (state.order === 'old') p.set('order', 'old');
  if (state.saved) p.set('saved', '1');
  return p.toString();
}
export function filterItems(items, state, saved = new Set()) {
  const q = state.q.trim().toLocaleLowerCase();
  return items.filter(item => (state.saved ? saved.has(item.id) : state.section === 'all' || item.category === state.section)
    && (!state.label || item.label === state.label)
    && (!state.month || item.date.startsWith(state.month))
    && (!q || [item.title, item.summary, item.label, item.facts, item.value, item.action, ...(item.tags || []), ...((item.blocks || []).flatMap(b => [b.text, ...(b.items || [])]))].join(' ').toLocaleLowerCase().includes(q)))
    .sort((a, b) => (state.order === 'old' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || a.id.localeCompare(b.id));
}
export function typeLabel(item) {
  return item.type || {news: '资讯笔记', learn: '学习笔记', tools: '工具档案', ideas: '原创构想'}[item.category];
}
export function parseSaved(value) {
  try { const data = JSON.parse(value); return new Set(Array.isArray(data) ? data.filter(x => typeof x === 'string') : []); } catch { return new Set(); }
}
export function migrateSaved(items, current, legacy) {
  const saved = parseSaved(current);
  // Only migrate once. A user may have intentionally removed a previously saved article.
  if (current !== null) return saved;
  try {
    const old = JSON.parse(legacy);
    if (old && typeof old === 'object' && !Array.isArray(old)) {
      for (const item of items) if (old[item.url || item.title]) saved.add(item.id);
    }
  } catch { /* Corrupt legacy storage is optional data. */ }
  return saved;
}
export function sourcesFor(item) {
  const sources = [...(Array.isArray(item.sources) ? item.sources : [])];
  if (safeURL(item.url) && !sources.some(s => s.url === item.url)) sources.push({url:item.url});
  return sources.filter(s => s && safeURL(s.url));
}
export function renderBlocks(blocks) {
  if (!Array.isArray(blocks)) return '';
  const e = escapeHTML;
  return blocks.map(block => {
    switch (block.type) {
      case 'heading': return `<h${block.level === 3 ? 3 : 2}>${e(block.text)}</h${block.level === 3 ? 3 : 2}>`;
      case 'paragraph': return `<p>${e(block.text)}</p>`;
      case 'list': case 'steps': {
        const tag = block.type === 'steps' ? 'ol' : 'ul';
        return `<${tag}>${(block.items || []).map(x => `<li>${e(x)}</li>`).join('')}</${tag}>`;
      }
      case 'code': return `<pre><code>${e(block.text)}</code></pre>`;
      case 'quote': return `<blockquote>${e(block.text)}</blockquote>`;
      case 'link': return safeURL(block.url) ? `<p><a href="${e(safeURL(block.url))}" target="_blank" rel="noopener noreferrer">${e(block.text || block.url)} ↗</a></p>` : '';
      case 'image': {
        const src = imageURL(block.src);
        return src ? `<figure><img src="${e(src)}" alt="${e(block.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">${block.caption ? `<figcaption>${e(block.caption)}</figcaption>` : ''}</figure>` : '';
      }
      default: return '';
    }
  }).join('');
}
export function shuffleItems(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  // A deliberate click should visibly change a multi-item collection.
  if (result.length > 1 && result.every((item, i) => item === items[i])) result.push(result.shift());
  return result;
}
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export function validateData(data) {
  if (!data || !Array.isArray(data.items)) throw new Error('缺少文章列表');
  const ids = new Set(), legacy = new Set();
  for (const item of data.items) {
    if (!item || !/^[a-z0-9][a-z0-9-]{2,95}$/.test(item.id) || ids.has(item.id)) throw new Error('文章 ID 缺失或重复');
    ids.add(item.id);
    const fail = message => { throw new Error(`${item.id}: ${message}`); };
    if (item.slug !== item.id) fail('slug 必须与稳定 ID 一致');
    if (!Object.hasOwn(SECTIONS, item.category) || typeof item.title !== 'string' || !item.title.trim()
      || typeof item.summary !== 'string' || !item.summary.trim() || !validDate(item.date)) fail('文章基础字段无效');
    if (item.revised !== undefined && (!validDate(item.revised) || item.revised < item.date)) fail('修订日期无效');
    if (item.legacyIndex !== undefined) {
      if (!Number.isInteger(item.legacyIndex) || item.legacyIndex < 0 || legacy.has(item.legacyIndex)) fail('旧链接索引重复或无效');
      legacy.add(item.legacyIndex);
    }
    if (!Array.isArray(item.blocks) || !item.blocks.length) fail('正文必须包含至少一个 blocks 内容块');
    for (const block of item.blocks) {
      if (!block || !['heading','paragraph','list','steps','code','quote','link','image'].includes(block.type)) fail('未知正文块');
      if (['list','steps'].includes(block.type)) {
        if (!Array.isArray(block.items) || !block.items.length || block.items.some(x => typeof x !== 'string' || !x.trim())) fail('列表正文无效');
      } else if (block.type === 'image') {
        if (!imageURL(block.src) || typeof block.alt !== 'string' || !block.alt.trim()) fail('正文图片必须有安全地址和替代文本');
      } else if (typeof block.text !== 'string' || !block.text.trim()) fail('正文文本无效');
      if (block.type === 'heading' && block.level !== undefined && ![2,3].includes(block.level)) fail('标题层级无效');
      if (block.type === 'link' && !safeURL(block.url)) fail('正文链接必须为 HTTPS');
    }
    if (item.tags !== undefined && (!Array.isArray(item.tags) || item.tags.some(tag => typeof tag !== 'string'))) fail('标签格式无效');
    if (!Array.isArray(item.sources) || item.sources.some(source => !source || !safeURL(source.url)
      || (source.accessed !== undefined && !validDate(source.accessed)))) fail('来源格式无效');
    if (item.category === 'news' && !item.sources.length) fail('资讯必须提供来源');
    if (item.url && !safeURL(item.url)) fail('来源必须为 HTTPS');
    const provenance = item.coverProvenance;
    if (item.cover !== undefined) {
      if (!item.cover || !imageURL(item.cover.src) || typeof item.cover.alt !== 'string' || !item.cover.alt.trim()) fail('封面格式无效');
      if (!provenance || provenance.status !== 'verified' || !['primary-article','official-material'].includes(provenance.kind)
        || !safeURL(provenance.sourceURL) || typeof provenance.sourceTitle !== 'string' || !provenance.sourceTitle.trim()
        || !validDate(provenance.accessed) || typeof provenance.rightsNote !== 'string' || !provenance.rightsNote.trim()) fail('封面缺少已核实的原文/官方来源与使用依据');
    } else if (!provenance || provenance.status !== 'unavailable' || typeof provenance.reason !== 'string' || !provenance.reason.trim()) fail('无封面时需注明原因');
  }
  return data;
}
