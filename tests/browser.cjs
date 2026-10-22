/** Run against the dependency-free build or TEST_BASE_URL for the live Pages site. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:8767/';
fs.mkdirSync('test-results', {recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.CI ? {channel:'chrome'} : {})});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const links = () => page.locator('.entry-link').evaluateAll(nodes => nodes.map(node => node.href));
    for (const width of [320,375,390,430,768,1440]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(BASE);
      await page.locator('.entry').first().waitFor();
      assert.equal(await page.inputValue('#section-select'), 'all');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `list overflow ${width}`);
      await page.screenshot({path:`test-results/daily-${width}.png`,fullPage:true});
      await page.locator('.entry-link').first().click();
      await page.locator('.prose').waitFor();
      assert.equal(await page.locator('#article [data-save], #copy-link').count(),0,'detail has no bookmark or copy actions');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `detail overflow ${width}`);
      await page.screenshot({path:`test-results/detail-${width}.png`,fullPage:true});
      console.log(`Viewport ${width}: list/detail and no overflow PASS`);
    }
    await page.goto(BASE);
    await page.locator('.entry').first().waitFor();
    await page.selectOption('#section-select','news');
    await page.goBack();
    assert.equal(await page.inputValue('#section-select'),'all');
    await page.goForward();
    assert.equal(await page.inputValue('#section-select'),'news');
    for (const category of ['news','learn','tools','ideas']) {
      await page.selectOption('#section-select',category);
      await page.reload();
      await page.locator('.entry').first().waitFor();
      assert.equal(await page.inputValue('#section-select'), category);
      await page.goto(BASE);
      await page.locator('.entry').first().waitFor();
      assert.equal(await page.inputValue('#section-select'), category, 'bare URL must restore localStorage preference');
      assert(await page.locator('.entry').evaluateAll((nodes, category) => nodes.every(n => n.dataset.category === category),category));
      const before = await links();
      await page.click('#shuffle');
      const after = await links();
      assert.notDeepEqual(after,before);
      assert.deepEqual([...after].sort(),[...before].sort());
      await page.locator('.entry-link').first().click();
      await page.locator('.prose').waitFor();
      await page.click('#back-link');
      await page.locator('.entry').first().waitFor();
      assert.equal(await page.inputValue('#section-select'),category);
      assert.deepEqual(await links(),after);
    }
    console.log('All four categories: persistence, filtered Shuffle and detail round trip PASS');
    await page.locator('[data-save]').first().click();
    await page.click('#saved-link');
    await page.locator('.entry').first().waitFor();
    assert.equal(await page.locator('.entry').count(),1);
    await page.locator('[data-save]').first().click();
    await page.getByText('还没有收藏').waitFor();
    await page.goto(BASE+'article.html?id=bad');
    await page.getByText('没有找到这篇文章').waitFor();
    await page.goto(BASE+'#article-0');
    await page.locator('.prose').waitFor();
    assert.match(page.url(),/article\.html\?id=post-/);
    assert.deepEqual(errors,[]);
    const restricted = await browser.newContext();
    await restricted.addInitScript(() => { Object.defineProperty(window,'localStorage',{get(){throw new Error('storage disabled')}}); });
    const restrictedPage = await restricted.newPage();
    await restrictedPage.route('**/*',route => route.request().resourceType() === 'image' ? route.abort() : route.continue());
    await restrictedPage.goto(BASE);
    await restrictedPage.locator('.entry').first().waitFor();
    await restrictedPage.selectOption('#section-select','news');
    await restrictedPage.click('#shuffle');
    await restrictedPage.locator('.entry-link').first().click();
    await restrictedPage.locator('.prose').waitFor();
    await restricted.close();
    console.log('Bookmarks, legacy links, missing article, blocked storage/images PASS');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exit(1);});
