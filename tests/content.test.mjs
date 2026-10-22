import test from 'node:test';
import assert from 'node:assert/strict';
import {loadArticles} from '../scripts/articles.mjs';
import {filterItems, readState, stateQuery, renderBlocks, imageURL, safeURL, migrateSaved, validateData} from '../content.mjs';
const data = loadArticles();

test('all current articles have unique stable IDs and fixed legacy links', () => {
  validateData(data);
  const old = data.items.filter(x => x.legacyIndex !== undefined);
  assert.equal(old.length, 25);
  assert.deepEqual(old.map(x => x.legacyIndex).sort((a,b) => a-b), Array.from({length:25}, (_,i) => i));
  const shuffled = [...data.items].reverse();
  for (const item of old) assert.equal(shuffled.find(x => x.legacyIndex === item.legacyIndex).id, item.id);
});
test('search, category, history and ascending date filters combine', () => {
  const items = [
    {id:'b', category:'news', title:'Agent B', summary:'', label:'Agent', date:'2026-10-21'},
    {id:'a', category:'news', title:'Agent A', summary:'', label:'Agent', date:'2026-10-19'},
    {id:'c', category:'news', title:'Agent C', summary:'', label:'Other', date:'2026-10-20'},
    {id:'d', category:'learn', title:'Agent D', summary:'', label:'Agent', date:'2026-10-20'},
    {id:'e', category:'news', title:'Agent E', summary:'', label:'Agent', date:'2026-09-20'},
  ];
  assert.deepEqual(filterItems(items, readState('?section=news&q=AGENT&label=Agent&month=2026-10&order=old')).map(x => x.id), ['a','b']);
});
test('bookmarks span all four sections and do not depend on array order', () => {
  const saved = new Set(data.items.map(x => x.id));
  assert.equal(filterItems([...data.items].reverse(), readState('?saved=1'), saved).length, data.items.length);
});
test('legacy URL bookmarks migrate once, preserving intentionally removed bookmarks', () => {
  const old = JSON.stringify({[data.items[0].url]:true});
  assert(migrateSaved(data.items, null, old).has(data.items[0].id));
  assert.equal(migrateSaved(data.items, '[]', old).size, 0);
  assert.equal(migrateSaved(data.items, 'broken', old).size, 0);
});
test('filters survive a detail round trip and reject unknown categories', () => {
  const state = readState('?section=ideas&q=羊群&label=创意实验+·+模拟&month=2026-10&order=old&saved=1');
  const href = new URL('https://example.org/project/article.html');
  href.searchParams.set('from', stateQuery(state));
  assert.deepEqual(readState(href.searchParams.get('from')), state);
  assert.equal(readState('?section=__proto__').section,'all');
});
test('untrusted article blocks cannot inject markup or executable URLs', () => {
  const html = renderBlocks([
    {type:'paragraph',text:'<script>alert(1)</script>'},
    {type:'code',text:'</code><img src=x onerror=alert(1)>'},
    {type:'link',url:'javascript:alert(1)',text:'bad'},
    {type:'image',src:'./assets/../../secret',alt:'bad'},
    {type:'image',src:'https://example.com/a.png',alt:'" onerror="alert(1)'},
  ]);
  assert(!html.includes('<script>'));
  assert(!html.includes('href="javascript:'));
  assert(!html.includes('../secret'));
  assert(html.includes('&lt;script&gt;'));
  assert(html.includes('&quot; onerror=&quot;'));
  assert.equal(safeURL('data:text/html,test'), '');
  assert.equal(safeURL('http://insecure.test'), '');
});
test('rich articles support headings, ordered steps, code and sources', () => {
  const html = renderBlocks([{type:'heading',text:'步骤'}, {type:'steps',items:['第一步','第二步']}, {type:'code',text:'print("ok")'}, {type:'link',url:'https://example.com',text:'官方文档'}]);
  assert(html.includes('<h2>步骤</h2>'));
  assert(html.includes('<ol><li>第一步</li>'));
  assert(html.includes('<pre><code>'));
  assert(html.includes('rel="noopener noreferrer"'));
});
test('invalid dataset fails explicitly instead of silently becoming an empty list', () => {
  assert.throws(() => validateData({}));
  assert.throws(() => validateData({items:[data.items[0],data.items[0]]}));
});

test('cover URLs allow safe local assets and HTTPS only', () => {
  assert.equal(imageURL('./assets/covers/context.svg'), './assets/covers/context.svg');
  assert.equal(imageURL('./assets/../../private.svg'), '');
  assert.equal(imageURL('javascript:alert(1)'), '');
  assert.throws(() => validateData({items:[{...data.items[0], cover:{src:'./assets/covers/context.svg'}}]}));
});
