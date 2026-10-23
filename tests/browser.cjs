/** Run against the build or TEST_BASE_URL for live Pages verification. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:8767/';
fs.mkdirSync('test-results', {recursive:true});
const labels = {all:'全部',news:'AI 资讯',learn:'AI 学习',tools:'游戏工具',ideas:'游戏创意'};
async function chooseSection(page, category) {
  const toggle = page.locator('#section-toggle');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await page.locator(`.section-option[data-section="${category}"]`).click();
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#section-label').innerText(),labels[category]);
  assert.equal(await page.locator(`.section-option[data-section="${category}"]`).getAttribute('aria-checked'),'true');
}
async function checkLoading(browser, detail) {
  const context = await browser.newContext({viewport:{width:375,height:1100},reducedMotion:'reduce'});
  const page = await context.newPage();
  let release;
  const gate = new Promise(resolve => {release = resolve;});
  await page.route('**/data/news.json',async route => {await gate; await route.continue();});
  try {
    await page.goto(BASE+(detail ? 'article.html?id=post-119e1b48c591b518' : ''),{waitUntil:'domcontentloaded'});
    const target = page.locator(detail ? '#article' : '#cards');
    const skeleton = page.locator(detail ? '.skeleton-detail' : '.skeleton-list');
    await skeleton.locator('.skeleton-line').first().waitFor({state:'visible'});
    assert.equal(await target.getAttribute('aria-busy'),'true');
    assert.equal(await skeleton.getAttribute('aria-hidden'),'true');
    assert(!/正在读取|正在加载/.test(await target.evaluate(root => {const copy=root.cloneNode(true);copy.querySelectorAll('.sr-only').forEach(node=>node.remove());return copy.textContent;})),'no visible loading prose');
    assert(await skeleton.evaluate(root => [root,...root.querySelectorAll('*')].every(node => [null,'::before','::after'].every(pseudo => {
      const style = getComputedStyle(node,pseudo);
      return style.animationName === 'none' || style.animationDuration.split(',').every(value => parseFloat(value) === 0);
    }))),'reduced motion disables skeleton animation');
    await page.screenshot({path:`test-results/skeleton-${detail ? 'detail' : 'list'}375.png`});
    release();
    await page.locator(detail ? '.prose' : '.entry-link').first().waitFor();
    assert.equal(await target.getAttribute('aria-busy'),'false');
    assert.equal(await skeleton.count(),0,'loading skeleton removed after content arrives');
  } finally {release(); await context.close();}
}
(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.CI ? {channel:'chrome'} : {})});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    const links = () => page.locator('.entry-link').evaluateAll(nodes => nodes.map(node => node.href));
    for (const width of [320,375,390,430,768,1440]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(BASE);
      await page.locator('.entry-link').first().waitFor();
      assert.equal(await page.locator('#section-label').innerText(),'全部');
      assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(238, 231, 221)');
      assert.equal(await page.locator('.entry').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 253, 247)');
      assert.equal(await page.locator('select, #shuffle, .shuffle-button').count(),0);
      assert.equal(await page.locator('#section-toggle').getAttribute('aria-haspopup'),'menu');
      assert.equal(await page.locator('#section-menu').getAttribute('role'),'menu');
      assert.equal(await page.locator('.section-option[role=menuitemradio]').count(),5);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,`list overflow ${width}`);
      await page.locator('.entry-cover').evaluateAll(imgs => Promise.all(imgs.map(img => {img.loading='eager';return img.decode().catch(() => {});})));
      await page.screenshot({path:`test-results/daily-${width}.png`,fullPage:true});
      await page.screenshot({path:`test-results/viewport-${width}.png`});
      assert.equal(await page.locator('.entry').first().evaluate(el => getComputedStyle(el).borderWidth),'0px');
      await page.locator('.entry-link').first().click();
      await page.locator('.prose').waitFor();
      assert.equal(await page.locator('#section-toggle, #section-menu, select, #shuffle, #article [data-save], #copy-link, #back-link, .reading-end').count(),0,'detail has no browsing controls or bookmark/copy actions');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,`detail overflow ${width}`);
      await page.screenshot({path:`test-results/detail-${width}.png`,fullPage:true});
      await page.screenshot({path:`test-results/detail-viewport-${width}.png`});
      console.log(`Viewport ${width}: list/detail and no overflow PASS`);
    }
    await page.goto(BASE);
    await page.locator('.entry-link').first().waitFor();
    const toggle = page.locator('#section-toggle');
    const menu = page.locator('#section-menu');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    assert(await menu.isVisible());
    assert(await toggle.evaluate(el => {const s=getComputedStyle(el);return s.outlineStyle==='none'||parseFloat(s.outlineWidth)===0;}),'pointer focus has no outline');
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert(await toggle.evaluate(el => document.activeElement===el),'Escape returns focus to toggle');
    await toggle.click();
    await page.locator('body').click({position:{x:2,y:2}});
    assert.equal(await toggle.getAttribute('aria-expanded'),'false','outside click closes menu');
    await toggle.focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('html').getAttribute('data-input-mode'),'keyboard');
    await page.keyboard.press('Home');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.section),'all');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.section),'news');
    await page.keyboard.press('End');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.section),'ideas');
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.section),'tools');
    assert(await page.evaluate(() => {const s=getComputedStyle(document.activeElement);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;}),'keyboard focus remains visible');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#section-label').innerText(),labels.tools);
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    await toggle.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false','Tab dismisses menu without a focus trap');
    await chooseSection(page,'all');
    await chooseSection(page,'news');
    await page.goBack();
    assert.equal(await page.locator('#section-label').innerText(),labels.all);
    await page.goForward();
    assert.equal(await page.locator('#section-label').innerText(),labels.news);
    for (const category of ['news','learn','tools','ideas']) {
      await chooseSection(page,category);
      await page.reload();
      await page.locator('.entry-link').first().waitFor();
      assert.equal(await page.locator('#section-label').innerText(),labels[category]);
      await page.goto(BASE);
      await page.locator('.entry-link').first().waitFor();
      assert.equal(await page.locator('#section-label').innerText(),labels[category],'bare URL restores localStorage preference');
      assert(await page.locator('.entry').evaluateAll((nodes,category) => nodes.every(n => n.dataset.category===category),category));
      const before = await links();
      await page.locator('.entry-link').last().scrollIntoViewIfNeeded();
      const scrollBefore = await page.evaluate(() => scrollY);
      await page.locator('.entry-link').last().click();
      await page.locator('.prose').waitFor();
      await page.goBack();
      await page.locator('.entry-link').first().waitFor();
      assert.equal(await page.locator('#section-label').innerText(),labels[category]);
      assert.deepEqual(await links(),before);
      await page.waitForFunction(y => Math.abs(scrollY-y)<3,scrollBefore);
    }
    console.log('Custom menu pointer/keyboard, persistence, category history and detail scroll restoration PASS');
    assert.equal(await page.locator('[data-save], #saved-link, #saved-count').count(),0);
    await page.goto(BASE+'article.html?id=bad');
    await page.getByText('没有找到这篇文章').waitFor();
    await page.goto(BASE+'#article-0');
    await page.locator('.prose').waitFor();
    assert.match(page.url(),/article\.html\?id=post-/);
    assert.deepEqual(errors,[]);
    const restricted = await browser.newContext();
    await restricted.addInitScript(() => {Object.defineProperty(window,'localStorage',{get(){throw new Error('storage disabled');}});});
    const restrictedPage = await restricted.newPage();
    await restrictedPage.route('**/*',route => route.request().resourceType()==='image' ? route.abort() : route.continue());
    await restrictedPage.goto(BASE);
    await restrictedPage.locator('.entry-link').first().waitFor();
    await chooseSection(restrictedPage,'news');
    await restrictedPage.locator('.entry-link').first().click();
    await restrictedPage.locator('.prose').waitFor();
    await restricted.close();
    await checkLoading(browser,false);
    await checkLoading(browser,true);
    console.log('Legacy links, missing article, blocked storage/images, skeleton lifecycle and reduced motion PASS');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exit(1);});
