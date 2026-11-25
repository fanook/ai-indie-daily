import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadArticles} from '../scripts/articles.mjs';
import {SECTIONS, filterItems, readState, validateData} from '../content.mjs';
const data = loadArticles();
const base = data.items[0];
const valid = patch => ({...structuredClone(base), ...patch});

test('new independent file is discovered without touching an index or route', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'indie-articles-'));
  try {
    const article = valid({id:'new-independent-article', slug:'new-independent-article', category:'game-knowledge'});
    delete article.legacyIndex;
    writeFileSync(path.join(dir, `${article.id}.json`), JSON.stringify(article));
    assert.equal(loadArticles(dir).items[0].slug, article.slug);
    writeFileSync(path.join(dir, 'another-article.json'), JSON.stringify({...article,id:'another-article',slug:'another-article'}));
    assert.equal(loadArticles(dir).items.length, 2);
    writeFileSync(path.join(dir, 'wrong-filename.json'), JSON.stringify(article));
    assert.throws(() => loadArticles(dir), /filename must match/);
  } finally { rmSync(dir, {recursive:true,force:true}); }
});
test('all is the default and all three categories remain independently filterable', () => {
  assert.equal(readState('').section, 'all');
  assert.equal(filterItems(data.items, readState('')).length, data.items.length);
  assert.deepEqual(Object.keys(SECTIONS), ['news','game-news','game-knowledge']);
  for (const category of Object.keys(SECTIONS)) {
    assert.equal(readState(`?section=${category}`).section, category);
    assert(filterItems(data.items, readState(`?section=${category}`)).every(item => item.category === category));
  }
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
test('the live collection does not expose withdrawn legacy entries', () => {
  assert(data.items.length > 0);
  for (const article of data.items) {
    assert.equal(article.legacyIndex, undefined);
    assert.equal(article.slug, article.id);
    assert(article.sources.length > 0);
  }
});
