import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadArticles} from '../scripts/articles.mjs';
import {filterItems, readState, shuffleItems, validateData} from '../content.mjs';
const data = loadArticles();
const base = data.items[0];
const valid = patch => ({...structuredClone(base), ...patch});

test('new independent file is discovered without touching an index or route', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'indie-articles-'));
  try {
    const article = valid({id:'new-independent-article', slug:'new-independent-article'});
    delete article.legacyIndex;
    writeFileSync(path.join(dir, `${article.id}.json`), JSON.stringify(article));
    assert.equal(loadArticles(dir).items[0].slug, article.slug);
    writeFileSync(path.join(dir, 'another-article.json'), JSON.stringify({...article,id:'another-article',slug:'another-article'}));
    assert.equal(loadArticles(dir).items.length, 2);
    writeFileSync(path.join(dir, 'wrong-filename.json'), JSON.stringify(article));
    assert.throws(() => loadArticles(dir), /filename must match/);
  } finally { rmSync(dir, {recursive:true,force:true}); }
});
test('all is the default and all four categories remain independently filterable', () => {
  assert.equal(readState('').section, 'all');
  assert.equal(filterItems(data.items, readState('')).length, data.items.length);
  for (const category of ['news','learn','tools','ideas']) {
    assert(filterItems(data.items, readState(`?section=${category}`)).every(item => item.category === category));
  }
});
test('shuffle keeps the same filtered set without mutation and always visibly changes multiple items', () => {
  const filtered = filterItems(data.items, readState('?section=learn'));
  const before = filtered.map(item => item.id);
  const result = shuffleItems(filtered, () => 0.999999);
  assert.deepEqual(filtered.map(item => item.id), before);
  assert.deepEqual(result.map(item => item.id).sort(), [...before].sort());
  assert.notDeepEqual(result.map(item => item.id), before);
  assert.deepEqual(shuffleItems([]), []);
  assert.deepEqual(shuffleItems([base]), [base]);
});
test('article schema rejects malformed stable slug, calendar date, category, body and source', () => {
  for (const patch of [{slug:'changed'}, {date:'2026-02-30'}, {category:'unknown'}, {blocks:[]},
    {blocks:[{type:'script',text:'evil'}]}, {sources:[{url:'javascript:alert(1)'}]},
    {sources:[{url:'https://example.org',accessed:'2026-02-30'}]}, {coverProvenance:null}]) {
    assert.throws(() => validateData({items:[valid(patch)]}));
  }
});
test('cover requires original or official material, citation, date and rights basis', () => {
  const cover = {src:'https://example.org/official-product.webp',alt:'官方产品界面'};
  assert.throws(() => validateData({items:[valid({cover})]}));
  const provenance = {status:'verified',kind:'official-material',sourceURL:'https://example.org/announcement',sourceTitle:'Official announcement',accessed:'2026-10-22',rightsNote:'Published press asset; credit retained.'};
  assert.doesNotThrow(() => validateData({items:[valid({cover,coverProvenance:provenance})]}));
  assert.throws(() => validateData({items:[valid({cover,coverProvenance:{...provenance,kind:'concept-illustration'}})]}));
});
test('historical source fields and stable URL mappings survive editorial improvements', () => {
  assert.equal(data.items.length >= 25, true);
  for (const article of data.items.filter(item => item.legacyIndex !== undefined)) {
    for (const field of ['facts','value','action']) assert.equal(typeof article[field], 'string');
    assert(article.blocks.some(block => block.type === 'paragraph' && block.text.length > 20));
    assert.equal(article.slug, article.id);
    if (article.cover) {
      assert.equal(article.coverProvenance.status, 'verified');
      assert.notEqual(article.cover.src, article.legacyCover?.src);
    } else assert.equal(article.coverProvenance.status, 'unavailable');
  }
});
