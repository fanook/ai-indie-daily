/** Discover independent article files; no manually maintained manifest or routes. */
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateData} from '../content.mjs';
export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export function loadArticles(directory = path.join(projectRoot, '_data/articles')) {
  const files = readdirSync(directory).filter(name => name.endsWith('.json')).sort();
  const items = files.map(name => {
    let article;
    try { article = JSON.parse(readFileSync(path.join(directory, name), 'utf8')); }
    catch (error) { throw new Error(`${name}: ${error.message}`); }
    if (name !== `${article.id}.json`) throw new Error(`${name}: filename must match stable id/slug`);
    return article;
  });
  const updated = items.map(item => item.revised || item.date).sort().at(-1) || '';
  return validateData({updated, items});
}
