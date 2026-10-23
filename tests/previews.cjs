/** Preview-only palette overrides. This script never edits production CSS or saved preferences. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:8767/';
const OUTPUT = 'test-results';
const keys = ['background','paper','ink','muted','accent','control','control-hover','skeleton'];
const palettes = {
  'A-warm-ivory':['#eee7dd','#fffdf7','#342f2a','#7b7266','#8d6241','#e3d8c9','#d8ccb9','#ded5c6'],
  'B-sage-cream':['#dfe8e1','#fbfcf5','#293c32','#65776c','#47745e','#ccdacf','#bfd0c3','#c9d5cc'],
  'C-gallery-stone':['#ffffff','#f1f0ec','#292a29','#696b67','#4e6359','#eeede9','#e1e0da','#dfded8'],
  'D-pale-ink':['#e2e8f0','#ffffff','#243952','#62758b','#476c96','#ccd8e8','#bdcde0','#c9d4e3'],
};
fs.mkdirSync(OUTPUT,{recursive:true});
async function loadingPreview(browser,detail) {
  const context = await browser.newContext({viewport:{width:375,height:1100},reducedMotion:'reduce'});
  const page = await context.newPage();
  let release;
  const gate = new Promise(resolve => {release=resolve;});
  await page.route('**/data/news.json',async route => {await gate;await route.continue().catch(() => {});});
  try {
    await page.goto(BASE+(detail ? 'article.html?id=post-119e1b48c591b518' : ''),{waitUntil:'domcontentloaded'});
    const skeleton=page.locator(detail ? '.skeleton-detail' : '.skeleton-list');
    await skeleton.locator('.skeleton-line').first().waitFor({state:'visible'});
    assert.equal(await skeleton.getAttribute('aria-hidden'),'true');
    assert(!/正在读取|正在加载/.test(await page.locator(detail ? '#article' : '#cards').evaluate(root => {const copy=root.cloneNode(true);copy.querySelectorAll('.sr-only').forEach(node=>node.remove());return copy.textContent;})));
    await page.screenshot({path:`${OUTPUT}/skeleton-${detail ? 'detail' : 'list'}375.png`});
  } finally {release();await context.close();}
}
(async () => {
  const browser=await chromium.launch({headless:true,...(process.env.CI ? {channel:'chrome'} : {})});
  try {
    const context=await browser.newContext({viewport:{width:375,height:1100},reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto(BASE);
    await page.locator('.entry-link').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.entry-cover').evaluateAll(imgs => Promise.all(imgs.map(img => {img.loading='eager';return img.decode().catch(() => {});})));
    const initialTitles=await page.locator('.entry-link').allTextContents();
    for (const [name,values] of Object.entries(palettes)) {
      const style=await page.addStyleTag({content:`:root{${keys.map((key,index) => `--${key}:${values[index]}`).join(';')}}`});
      assert.deepEqual(await page.locator('.entry-link').allTextContents(),initialTitles,'all palettes show identical content and order');
      await page.screenshot({path:`${OUTPUT}/${name}.png`});
      await style.evaluate(element => element.remove());
    }
    await page.locator('#section-toggle').click();
    await page.locator('#section-menu').waitFor({state:'visible'});
    await page.screenshot({path:`${OUTPUT}/menu-open375.png`});
    await page.keyboard.press('Escape');
    await page.locator('#section-toggle').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('html').getAttribute('data-input-mode'),'keyboard');
    await page.screenshot({path:`${OUTPUT}/menu-keyboard375.png`});
    await context.close();
    await loadingPreview(browser,false);
    await loadingPreview(browser,true);
    console.log('Saved four palette comparisons, pointer/keyboard menu states, and list/detail skeleton previews.');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exit(1);});
