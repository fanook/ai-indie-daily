import {SECTIONS, escapeHTML as e, safeURL, readState, stateQuery, filterItems, typeLabel, imageURL, migrateSaved, parseSaved, sourcesFor, renderBlocks, validateData, shuffleItems} from './content.mjs?v=6';

const $ = id => document.getElementById(id);
const isArticle = Boolean($('article'));
const bookmarkIcon = '<svg class="bookmark-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4z"/></svg>';
const SAVE_KEY = 'indielab_saved_v2';
const SECTION_KEY = 'indielab_section';
function initialState() {
  let query = location.search;
  if (!new URLSearchParams(query).has('section')) {
    try { const value = localStorage.getItem(SECTION_KEY); if (value) { const p = new URLSearchParams(query); p.set('section', value); query = p.toString(); } } catch {}
  }
  return readState(query);
}
let data, items = [], saved = new Set(), state = initialState(), pageSize = 20, loaded = false, toastTimer, shuffled = null;
const sectionName = section => SECTIONS[section]?.name || '全部文章';

function notify(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}
function navigation(active = state.section) {
  $('section-select').value = active || 'all';
  $('saved-count').textContent = items.filter(x => saved.has(x.id)).length;
  $('saved-link').toggleAttribute('aria-current', !isArticle && state.saved);
}
function articleURL(item) {
  const params = new URLSearchParams({id: item.id, from: stateQuery(state)});
  return `./article.html?${params}`;
}
function renderSave(item, full = false) {
  const on = saved.has(item.id);
  return `<button class="${full ? 'article-save' : 'icon-button save-button'}" data-save="${e(item.id)}" aria-pressed="${on}" aria-label="${on ? '取消收藏' : '收藏'}：${e(item.title)}" title="${on ? '取消收藏' : '收藏'}">${bookmarkIcon}${full ? `<span>${on ? '已收藏' : '收藏文章'}</span>` : ''}</button>`;
}
function coverHTML(item) {
  const cover = item.cover;
  const src = imageURL(cover?.src);
  const fallback = `<div class="cover-fallback"><span>${e(SECTIONS[item.category].name)}</span><small>暂无核实配图</small></div>`;
  return `<div class="entry-media">${src ? `<img class="entry-cover${cover.fit === 'contain' ? ' contain' : ''}" src="${e(src)}" alt="${e(cover.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}${fallback}</div>`;
}
function card(item) {
  return `<article class="entry" data-category="${e(item.category)}">${coverHTML(item)}<div class="entry-content"><div class="entry-meta"><span class="tag">${e(SECTIONS[item.category].name)}</span><time datetime="${e(item.date)}">${e(item.date.replaceAll('-', '.'))}</time></div><h2><a class="entry-link" href="${e(articleURL(item))}">${e(item.title)}</a></h2><p class="entry-summary">${e(item.summary)}</p><div class="entry-bottom"><span>${e(item.label || typeLabel(item))}</span><span aria-hidden="true">阅读文章 ↗</span></div></div>${renderSave(item)}</article>`;
}
function renderList() {
  navigation();
  $('heading').textContent = state.saved ? '我的收藏' : sectionName(state.section);
  document.title = `${state.saved ? '我的收藏' : sectionName(state.section)} · AI × INDIE LAB`;
  const filtered = filterItems(items, state, saved);
  const results = shuffled ? [...filtered].sort((a,b) => shuffled.indexOf(a.id)-shuffled.indexOf(b.id)) : filtered;
  $('result-count').textContent = `${results.length} 篇${state.saved ? '收藏' : '文章'}${shuffled ? '，已打乱顺序' : ''}`;
  $('shuffle').disabled = results.length < 2;
  $('cards').innerHTML = results.length ? results.slice(0, pageSize).map(card).join('') : `<div class="state-message"><h2>${state.saved ? '还没有收藏' : '这个栏目还没有文章'}</h2><p>${state.saved ? '文章上的书签可以留住值得再读的内容。' : '试试切换至 All 查看所有文章。'}</p><a class="secondary-button" href="./?section=all">浏览全部文章</a></div>`;
  $('cards').querySelectorAll('.entry-cover').forEach(img => {
    const recover = () => { img.remove(); };
    img.addEventListener('error', recover, {once:true});
    if (img.complete && !img.naturalWidth) recover();
  });
  $('cards').setAttribute('aria-busy', 'false');
  $('pagination').hidden = results.length <= pageSize;
  $('page-progress').textContent = `已显示 ${Math.min(results.length, pageSize)} / ${results.length} 篇`;
}
function sectionHTML(title, text, action = false) {
  return text ? `<section${action ? ' class="action-section"' : ''}><h2>${e(title)}</h2><p>${e(text)}</p></section>` : '';
}
function legacyBody(item) {
  const headings = {news: ['事实与背景','对开发者的价值','可执行建议'],learn:['学习目标与方法','为什么值得实践','动手练习'],tools:['工具介绍','适用场景与限制','使用建议'],ideas:['核心玩法','设计价值','最小可玩原型']}[item.category];
  return sectionHTML(headings[0], item.facts) + sectionHTML(headings[1], item.value) + sectionHTML(headings[2], item.action, true);
}
function renderArticle() {
  const params = new URLSearchParams(location.search);
  const item = items.find(x => x.id === params.get('id'));
  if (!item) {
    $('article').innerHTML = '<div class="state-message"><h1>没有找到这篇文章</h1><p>链接可能不完整，或文章暂时无法读取。</p><a class="secondary-button" href="./">浏览所有内容</a></div>';
    $('article').setAttribute('aria-busy', 'false'); navigation(null); return;
  }
  const from = readState(params.get('from') || `section=${item.category}`);
  const back = `./?${stateQuery(from)}`;
  $('back-link').href = back;
  $('back-link').textContent = `← 返回${from.saved ? '我的收藏' : sectionName(from.section)}`;
  navigation(item.category);
  document.title = `${item.title} · AI × INDIE LAB`;
  document.querySelector('meta[name="description"]').content = item.summary;
  const sources = sourcesFor(item);
  const provenance = item.coverProvenance;
  const coverCredit = item.cover && provenance?.sourceURL ? `<p class="cover-credit">配图来源：<a href="${e(safeURL(provenance.sourceURL))}" target="_blank" rel="noopener noreferrer">${e(provenance.sourceTitle || '原文 / 官方资料')} ↗</a></p>` : '';
  const notes = [];
  if (item.category === 'ideas') notes.push(item.type === '真实游戏案例' ? '真实游戏案例：事实以引用来源为准，设计启发属于编辑分析。' : item.type === '市场分析' ? '市场分析：请区分已知数据、推断与待验证的假设。' : '原创玩法构想，尚未经过市场验证。工作量与市场判断均为设计假设。');
  if (item.verification === 'unreviewed') notes.push('历史收录内容，原始报道与具体信息尚待复核。请阅读来源后再据此决策。');
  if (item.origin === 'feed') notes.push('自动收录的官方更新摘要，保留原文语言；不代表本站已完成分析或兼容性验证。');
  let toolFacts = '';
  if (item.category === 'tools' && item.type !== '版本更新') {
    const tool = item.tool || {};
    toolFacts = `<dl class="tool-facts">${[['platforms','支持平台'],['pricing','价格'],['license','授权']].map(([field, label]) => `<div><dt>${label}</dt><dd>${e(tool[field] || '未知 · 尚未核实')}</dd></div>`).join('')}</dl>`;
  }
  $('article').innerHTML = `<header class="article-header"><div class="entry-meta"><span class="tag">${e(typeLabel(item))}</span><span>${e(item.label || SECTIONS[item.category].name)}</span><time datetime="${e(item.date)}">${e(item.date.replaceAll('-', '.'))}</time></div><h1>${e(item.title)}</h1><p class="article-deck">${e(item.summary)}</p><div class="article-tools">${renderSave(item, true)}<button class="article-save" id="copy-link"><span aria-hidden="true">↗</span>复制链接</button></div></header>${notes.map(n => `<p class="content-note">${e(n)}</p>`).join('')}${toolFacts}${coverCredit}<div class="prose">${item.blocks?.length ? renderBlocks(item.blocks) : legacyBody(item)}</div>${sources.length ? `<section class="source-list"><h2>${item.category === 'ideas' ? '参考资料' : '来源与延伸阅读'}</h2><ul>${sources.map(s => `<li><a href="${e(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.title || new URL(s.url).hostname)} ↗</a><small>${e(new URL(s.url).hostname)}${s.accessed ? ` · 核对于 ${e(s.accessed)}` : ''}</small></li>`).join('')}</ul></section>` : ''}<div class="reading-end"><a href="${e(back)}">← 返回列表</a><span>${SECTIONS[item.category].name} · 持续积累</span></div>`;
  $('article').setAttribute('aria-busy', 'false');
  $('copy-link').addEventListener('click', async () => {
    const url = new URL('./article.html', location.href); url.searchParams.set('id', item.id);
    try { await navigator.clipboard.writeText(url.href); notify('文章链接已复制'); } catch { notify('无法访问剪贴板，请复制浏览器地址栏链接'); }
  });
}
function updateList(push = false, controls = false) {
  pageSize = 20;
  history[push ? 'pushState' : 'replaceState']({}, '', `?${stateQuery(state)}`);
  renderList(controls);
}
function resetFilters() {
  state = {...state, q:'', label:'', month:'', order:'new'};
  updateList(false, true); $('section-select').focus();
}
function savePosition() {
  try { sessionStorage.setItem(`indielab_position:${stateQuery(state)}`, JSON.stringify({y:scrollY, pageSize, shuffled})); } catch { /* Optional navigation convenience. */ }
}
function restorePosition() {
  try {
    const position = JSON.parse(sessionStorage.getItem(`indielab_position:${stateQuery(state)}`));
    if (position && Number.isFinite(position.y)) {
      pageSize = Math.max(20, Number(position.pageSize) || 20); shuffled = Array.isArray(position.shuffled) ? position.shuffled : null; renderList();
      requestAnimationFrame(() => window.scrollTo(0, position.y));
    }
  } catch { /* A malformed or unavailable saved position is ignored. */ }
}
$('section-select').addEventListener('change', event => {
  const section = event.target.value;
  if (section !== 'all' && !Object.hasOwn(SECTIONS, section)) return;
  try { localStorage.setItem(SECTION_KEY, section); } catch { notify('浏览器无法保存栏目偏好，本次浏览仍可使用'); }
  if (isArticle) { location.href = `./?section=${encodeURIComponent(section)}`; return; }
  savePosition();
  shuffled = null;
  state = readState(`section=${section}`);
  if (loaded) { updateList(true, true); window.scrollTo(0, 0); }
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-save]');
  if (button && loaded) {
    const id = button.dataset.save;
    if (!items.some(x => x.id === id)) return;
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    let persisted = true;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify([...saved])); } catch { persisted = false; }
    const item = items.find(x => x.id === id);
    const on = saved.has(id);
    button.setAttribute('aria-pressed', String(on)); button.setAttribute('aria-label', `${on ? '取消收藏' : '收藏'}：${item.title}`); button.title = on ? '取消收藏' : '收藏';
    if (isArticle) button.querySelector('span').textContent = on ? '已收藏' : '收藏文章';
    navigation(isArticle ? item.category : state.section);
    if (!isArticle && state.saved) { renderList(true); $('heading').setAttribute('tabindex','-1'); $('heading').focus(); }
    notify(persisted ? (on ? '已加入收藏' : '已取消收藏') : '浏览器无法保存收藏，本次浏览仍可使用');
    return;
  }
  if (event.target.closest('[data-reset]')) { resetFilters(); return; }
  const nav = event.target.closest('#saved-link');
  if (nav && !isArticle && loaded && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
    event.preventDefault(); savePosition(); shuffled = null; state = readState(new URL(nav.href).search); updateList(true, true); window.scrollTo(0, 0);
    return;
  }
  if (event.target.closest('.entry-link') && !isArticle) savePosition();
});
window.addEventListener('storage', event => {
  if (event.key === SAVE_KEY || event.key === null) {
    saved = parseSaved(event.newValue);
    if (loaded) isArticle ? renderArticle() : renderList(true);
  }
});
if (!isArticle) {
  $('shuffle').addEventListener('click', () => {
    if (!loaded) return;
    const filtered = filterItems(items, state, saved);
    const current = shuffled ? [...filtered].sort((a,b) => shuffled.indexOf(a.id)-shuffled.indexOf(b.id)) : filtered;
    shuffled = shuffleItems(current).map(x => x.id);
    renderList(); savePosition();
    notify('已打乱当前栏目顺序');
  });
  $('load-more').addEventListener('click', () => { const previous = pageSize; pageSize += 20; renderList(); document.querySelectorAll('.entry-link')[previous]?.focus(); });
  window.addEventListener('popstate', () => { if (!loaded) return; state = initialState(); shuffled = null; pageSize = 20; renderList(true); restorePosition(); if (new URLSearchParams(location.search).get('shuffle') === '1') $('shuffle').click(); });
  window.addEventListener('pagehide', savePosition);
  window.addEventListener('pageshow', event => { if (event.persisted && loaded) { try { saved = parseSaved(localStorage.getItem(SAVE_KEY)); } catch {} renderList(true); } });
}
if (isArticle) $('shuffle').addEventListener('click', () => { location.href = `./?section=${encodeURIComponent($('section-select').value)}&shuffle=1`; });
async function load() {
  const target = isArticle ? $('article') : $('cards');
  target.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('./data/news.json', {cache:'no-store', signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = validateData(await response.json()); items = data.items;
    try {
      const current = localStorage.getItem(SAVE_KEY);
      saved = migrateSaved(items, current, localStorage.getItem('indielab_saved'));
      if (current === null) localStorage.setItem(SAVE_KEY, JSON.stringify([...saved]));
    } catch { /* Keep in-memory bookmarks available. */ }
    loaded = true;
    // Fixed migration map for old numeric links; never infer from today's array order.
    const old = location.hash.match(/^#article-(\d+)$/);
    if (!isArticle && old) {
      const item = items.find(x => x.legacyIndex === Number(old[1]));
      if (item) { location.replace(`./article.html?id=${encodeURIComponent(item.id)}`); return; }
      notify('旧文章链接未找到，请从列表中查找');
    }
    if (isArticle) renderArticle(); else { renderList(true); restorePosition(); if (new URLSearchParams(location.search).get('shuffle') === '1') $('shuffle').click(); }
  } catch (error) {
    loaded = false; target.setAttribute('aria-busy', 'false');
    target.innerHTML = '<div class="state-message"><h2>内容暂时未能加载</h2><p>请检查网络后重试，你的收藏不会被清除。</p><button class="secondary-button" id="retry">重新加载</button></div>';
    if ($('updated')) $('updated').textContent = '暂时无法读取数据';
    if ($('result-count')) $('result-count').textContent = '加载失败';
    $('retry').addEventListener('click', load);
    console.error('Content load failed:', error.message);
  }
}
load();
