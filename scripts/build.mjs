/** Dependency-free local build. Production Pages uses the equivalent Liquid template. */
import {mkdirSync, cpSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {loadArticles, projectRoot} from './articles.mjs';
const data = loadArticles();
const output = path.join(projectRoot, 'dist');
mkdirSync(path.join(output, 'data'), {recursive:true});
for (const file of ['index.html','article.html','styles.css','app.js','content.mjs','theme.js','favicon.svg','assets']) {
  cpSync(path.join(projectRoot, file), path.join(output, file), {recursive:true});
}
writeFileSync(path.join(output, 'data/news.json'), JSON.stringify(data, null, 2) + '\n');
console.log(`Built ${data.items.length} articles into dist/. Serve with python3 -m http.server --directory dist 8767`);
