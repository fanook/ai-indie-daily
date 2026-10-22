/** Verify the actual Pages Jekyll output agrees with the dependency-free local build. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadArticles} from './articles.mjs';
import {validateData} from '../content.mjs';
const file = process.argv[2] || '_site/data/news.json';
const compiled = validateData(JSON.parse(readFileSync(file, 'utf8')));
const expected = loadArticles();
compiled.items.sort((a,b) => a.id.localeCompare(b.id));
expected.items.sort((a,b) => a.id.localeCompare(b.id));
assert.deepEqual(compiled, expected, 'Pages and local build must discover the exact same article data');
console.log(`Verified actual Jekyll output: ${compiled.items.length} articles match source files.`);
