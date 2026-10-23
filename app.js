import {SECTIONS, escapeHTML as e, safeURL, readState, stateQuery, filterItems, typeLabel, imageURL, sourcesFor, renderBlocks, validateData} from './content.mjs?v=9';

const $ = id => document.getElementById(id);
const isArticle = Boolean($('article'));
const SECTION_KEY = 'indielab_section';
function initialState() {
  let query = location.search;
  if (!new URLSearchParams(query).has('section')) {
    try { const value = localStorage.getItem(SECTION_KEY); if (value) { const p = new URLSearchParams(query); p.set('section', value); query = p.toString(); } } catch {}
  }
  return {...readState(query), saved:false};
}
let data, items = [], state = initialState(), pageSize = 20, loaded = false, toastTimer;
const sectionName = section => SECTIONS[section]?.name || '全部文章';

function notify(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}
function navigation(active = state.section) {
  if (!$('section-toggle')) return;
  $('section-label').textContent = active === 'all' ? '全部' : SECTIONS[active]?.name || '全部';
  $('section-toggle').setAttribute('aria-label', `选择栏目，当前：${$('section-label').textContent}`);
  document.querySelectorAll('.section-option').forEach(option => option.setAttribute('aria-checked', String(option.dataset.section === active)));
}
function closeMenu(restoreFocus = false) {
  if (!$('section-menu')) return;
  $('section-menu').hidden = true;
  $('section-toggle').setAttribute('aria-expanded', 'false');
  if (restoreFocus) $('section-toggle').focus();
}
function openMenu(edge) {
  $('section-menu').hidden = false;
  $('section-toggle').setAttribute('aria-expanded', 'true');
  const options = [...document.querySelectorAll('.section-option')];
  const selected = options.find(option => option.getAttribute('aria-checked') === 'true');
  (edge === 'last' ? options.at(-1) : edge === 'first' ? options[0] : selected || options[0]).focus();
}
function articleURL(item) {
  const params = new URLSearchParams({id: item.id, from: stateQuery(state)});
  return `./article.html?${params}`;
}
function coverHTML(item) {
  const cover = item.cover;
  const src = imageURL(cover?.src);
  if (!src) return '';
  return `<div class="entry-media"><img class="entry-cover${cover.position === 'left top' ? ' left-aligned' : ''}" src="${e(src)}" alt="${e(cover.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`;
}
function card(item) {
  return `<article class="entry" data-category="${e(item.category)}">${coverHTML(item)}<div class="entry-content"><h2><a class="entry-link" href="${e(articleURL(item))}">${e(item.title)}</a></h2><p class="entry-summary">${e(item.summary)}</p><div class="entry-meta entry-bottom"><span class="tag">${e(SECTIONS[item.category].name)}</span><span>${e(item.label || typeLabel(item))}</span><time datetime="${e(item.date)}">${e(item.date.replaceAll('-', '.'))}</time></div></div></article>`;
}
function renderList() {
  navigation();
  $('heading').textContent = sectionName(state.section);
  document.title = `${sectionName(state.section)} · AI × INDIE LAB`;
  const results = filterItems(items, state);
  $('result-count').textContent = `${results.length} 篇文章`;
  $('cards').innerHTML = results.length ? results.slice(0, pageSize).map(card).join('') : `<div class="state-message"><h2>这个栏目还没有文章</h2><p>试试切换至全部查看所有文章。</p><a class="secondary-button" href="./?section=all">浏览全部文章</a></div>`;
  $('cards').querySelectorAll('.entry-cover').forEach(img => {
    const recover = () => { img.closest(".entry-media").remove(); };
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
  navigation(item.category);
  document.title = `${item.title} · AI × INDIE LAB`;
  document.querySelector('meta[name="description"]').content = item.summary;
  const sources = sourcesFor(item);
  const provenance = item.coverProvenance;
  const coverCredit = item.cover && provenance?.sourceURL ? `<p class="cover-credit">配图：<a href="${e(safeURL(provenance.sourceURL))}" target="_blank" rel="noopener noreferrer">${e(provenance.sourceTitle || '原文 / 官方资料')} ↗</a>${provenance.licenseURL ? ` · <a href="${e(safeURL(provenance.licenseURL))}" target="_blank" rel="noopener noreferrer">许可</a>` : ''}<br>${e(provenance.rightsNote || '')}</p>` : '';
  $('article').innerHTML = `<header class="article-header"><div class="entry-meta"><span class="tag">${e(typeLabel(item))}</span><span>${e(item.label || SECTIONS[item.category].name)}</span><time datetime="${e(item.date)}">${e(item.date.replaceAll('-', '.'))}</time></div><h1>${e(item.title)}</h1><p class="article-deck">${e(item.summary)}</p></header><div class="prose">${item.blocks?.length ? renderBlocks(item.blocks) : legacyBody(item)}</div>${sources.length ? `<section class="source-list"><h2>${item.category === 'ideas' ? '参考资料' : '来源与延伸阅读'}</h2><ul>${sources.map(s => `<li><a href="${e(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.title || new URL(s.url).hostname)} ↗</a><small>${e(new URL(s.url).hostname)}${s.accessed ? ` · 核对于 ${e(s.accessed)}` : ''}</small></li>`).join('')}</ul></section>` : ''}${coverCredit}`;
  $('article').setAttribute('aria-busy', 'false');

}
function updateList(push = false, controls = false) {
  pageSize = 20;
  history[push ? 'pushState' : 'replaceState']({}, '', `?${stateQuery(state)}`);
  renderList(controls);
}
function resetFilters() {
  state = {...state, q:'', label:'', month:'', order:'new'};
  updateList(false, true); $('section-toggle').focus();
}
function savePosition() {
  try { sessionStorage.setItem(`indielab_position:${stateQuery(state)}`, JSON.stringify({y:scrollY, pageSize})); } catch { /* Optional navigation convenience. */ }
}
function restorePosition() {
  try {
    const position = JSON.parse(sessionStorage.getItem(`indielab_position:${stateQuery(state)}`));
    if (position && Number.isFinite(position.y)) {
      pageSize = Math.max(20, Number(position.pageSize) || 20); renderList();
      requestAnimationFrame(() => window.scrollTo(0, position.y));
    }
  } catch { /* A malformed or unavailable saved position is ignored. */ }
}
function chooseSection(section) {
  if (section !== 'all' && !Object.hasOwn(SECTIONS, section)) return;
  try { localStorage.setItem(SECTION_KEY, section); } catch { notify('浏览器无法保存栏目偏好，本次浏览仍可使用'); }
  savePosition();
  state = readState(`section=${section}`);
  navigation(); closeMenu(true);
  if (loaded) { updateList(true, true); window.scrollTo(0, 0); }
}
document.documentElement.dataset.inputMode = 'keyboard';
document.addEventListener('pointerdown', event => {
  document.documentElement.dataset.inputMode = 'pointer';
  if (!event.target.closest('.section-picker')) closeMenu();
});
document.addEventListener('keydown', () => { document.documentElement.dataset.inputMode = 'keyboard'; }, true);
if (!isArticle) {
  $('section-toggle').addEventListener('click', () => $('section-menu').hidden ? openMenu() : closeMenu(true));
  $('section-toggle').addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openMenu(event.key === 'ArrowUp' ? 'last' : 'first'); }
    if (event.key === 'Escape') closeMenu(true);
  });
  document.querySelectorAll('.section-option').forEach(option => option.addEventListener('click', () => chooseSection(option.dataset.section)));
  $('section-menu').addEventListener('keydown', event => {
    const options = [...document.querySelectorAll('.section-option')];
    const index = options.indexOf(document.activeElement);
    const keys = {ArrowDown:(index + 1) % options.length, ArrowUp:(index - 1 + options.length) % options.length, Home:0, End:options.length - 1};
    if (Object.hasOwn(keys, event.key)) { event.preventDefault(); options[keys[event.key]].focus(); }
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); }
    if (event.key === 'Tab') closeMenu(true);
  });
}
document.addEventListener('click', event => {
  if (event.target.closest('[data-reset]')) { resetFilters(); return; }
  if (event.target.closest('.entry-link') && !isArticle) savePosition();
});
if (!isArticle) {
  $('load-more').addEventListener('click', () => { const previous = pageSize; pageSize += 20; renderList(); document.querySelectorAll('.entry-link')[previous]?.focus(); });
  window.addEventListener('popstate', () => { if (!loaded) return; state = initialState(); closeMenu(); pageSize = 20; renderList(true); restorePosition(); });
  window.addEventListener('pagehide', savePosition);
  window.addEventListener('pageshow', event => { if (event.persisted && loaded) { renderList(true); } });
}
const loadingMarkup = (isArticle ? $('article') : $('cards')).innerHTML;
async function load() {
  const target = isArticle ? $('article') : $('cards');
  target.setAttribute('aria-busy', 'true');
  target.innerHTML = loadingMarkup;
  if ($('pagination')) $('pagination').hidden = true;
  try {
    const response = await fetch('./data/news.json', {cache:'no-store', signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = validateData(await response.json()); items = data.items;
    loaded = true;
    // Fixed migration map for old numeric links; never infer from today's array order.
    const old = location.hash.match(/^#article-(\d+)$/);
    if (!isArticle && old) {
      const item = items.find(x => x.legacyIndex === Number(old[1]));
      if (item) { location.replace(`./article.html?id=${encodeURIComponent(item.id)}`); return; }
      notify('旧文章链接未找到，请从列表中查找');
    }
    if (isArticle) renderArticle(); else { history.replaceState({}, '', `?${stateQuery(state)}${location.hash}`); renderList(true); restorePosition(); }
  } catch (error) {
    loaded = false; target.setAttribute('aria-busy', 'false');
    target.innerHTML = '<div class="state-message"><h2>内容暂时未能加载</h2><p>请检查网络后重试。</p><button class="secondary-button" id="retry">重新加载</button></div>';
    if ($('updated')) $('updated').textContent = '暂时无法读取数据';
    if ($('result-count')) $('result-count').textContent = '加载失败';
    $('retry').addEventListener('click', load);
    console.error('Content load failed:', error.message);
  }
}
load();
