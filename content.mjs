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
  return {section: Object.hasOwn(SECTIONS, p.get('section')) ? p.get('section') : 'news', q: p.get('q') || '', label: p.get('label') || '', month: /^\d{4}-\d{2}$/.test(p.get('month')) ? p.get('month') : '', order: p.get('order') === 'old' ? 'old' : 'new', saved: p.get('saved') === '1'};
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
  return items.filter(item => (state.saved ? saved.has(item.id) : item.category === state.section)
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
export function validateData(data) {
  if (!data || !Array.isArray(data.items)) throw new Error('缺少文章列表');
  const ids = new Set();
  for (const item of data.items) {
    if (!item || !/^[a-z0-9][a-z0-9-]{2,95}$/.test(item.id) || ids.has(item.id)) throw new Error('文章 ID 缺失或重复');
    ids.add(item.id);
    if (!Object.hasOwn(SECTIONS, item.category) || typeof item.title !== 'string' || !item.title.trim() || typeof item.summary !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) throw new Error('文章基础字段无效');
    if (item.blocks !== undefined && (!Array.isArray(item.blocks) || item.blocks.some(block => !block || typeof block !== 'object'))) throw new Error('正文格式无效');
    if (item.tags !== undefined && (!Array.isArray(item.tags) || item.tags.some(tag => typeof tag !== 'string'))) throw new Error('标签格式无效');
    if (item.sources !== undefined && (!Array.isArray(item.sources) || item.sources.some(source => !source || !safeURL(source.url)))) throw new Error('来源格式无效');
    if (item.cover !== undefined && (!item.cover || !imageURL(item.cover.src) || typeof item.cover.alt !== 'string' || !item.cover.alt.trim())) throw new Error('封面格式无效');
  }
  return data;
}
