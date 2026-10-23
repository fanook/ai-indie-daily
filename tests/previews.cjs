/** Preview-only palette overrides. This script never edits production CSS or saved preferences. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:8767/';
const OUTPUT = 'test-results';
const keys = ['background','paper','ink','muted','accent','control','control-hover','skeleton'];
// Text tokens are adjusted against the surfaces where they render, not unused combinations.
const palettes = {
  '01-butter-cobalt':['#FFE69A','#FFF9E7','#172443','#4F5870','#234FD5','#FFD45A','#F2C343','#E7CF86'],
  '02-coral-editorial':['#FFAD98','#FFF2E5','#4D2A35','#68464F','#A8244B','#F68F7C','#EC7C69','#E6C6B6'],
  '03-lilac-lemon':['#CAB8F0','#FFFADE','#35265B','#584964','#6935C0','#B49ADF','#A68ACF','#DACDD0'],
  '04-mint-electric':['#99E1CD','#F6FFE9','#153B4E','#425F6A','#2554CE','#6CCBB5','#55B9A3','#C3DDC6'],
  '05-sky-custard':['#9ECCFF','#FFF1B8','#193254','#44556A','#1C4BCA','#76AFE8','#639DD8','#DDCF99'],
  '06-category-colors':['#FBF4E8','#DBD1FA','#273345','#4F5C6A','#244BA7','#E3E0F2','#D3CEE7','#D9D8DF'],
};
const categoryColors = {news:'#FFD6C9',learn:'#DBD1FA',tools:'#C7EBE0',ideas:'#FFE5A0'};
function luminance(color) {
  const rgb = color.startsWith('#')
    ? [1,3,5].map(index => parseInt(color.slice(index,index+2),16))
    : color.match(/[\d.]+/g).slice(0,3).map(Number);
  const linear = rgb.map(value => {const s=value/255;return s<=0.04045 ? s/12.92 : ((s+0.055)/1.055)**2.4;});
  return linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
}
function contrast(foreground,background) {
  const [dark,light]=[luminance(foreground),luminance(background)].sort((a,b)=>a-b);
  return (light+0.05)/(dark+0.05);
}
for (const [name,values] of Object.entries(palettes)) {
  const cards=[values[1],...(name==='06-category-colors' ? Object.values(categoryColors) : [])];
  for (const index of [2,3,4]) {
    const surfaces=[...cards,...(index===2 ? [values[0],values[5],values[6]] : index===3 ? [values[0]] : [])];
    const minimum=Math.min(...surfaces.map(surface=>contrast(values[index],surface)));
    assert(minimum>=4.5,`${name}: ${keys[index]} contrast ${minimum.toFixed(3)} must be >=4.5`);
  }
  assert(contrast(values[4],values[5])>=3,`${name}: nontext checkmark contrast must be >=3`);
}
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
      const categoryStyle=name==='06-category-colors' ? Object.entries(categoryColors).map(([category,color])=>`.entry[data-category="${category}"]{background:${color}}`).join('') : '';
      const style=await page.addStyleTag({content:`:root{${keys.map((key,index) => `--${key}:${values[index]}`).join(';')}}${categoryStyle}`});
      assert.deepEqual(await page.locator('.entry-link').allTextContents(),initialTitles,'all palettes show identical content and order');
      const rendered=await page.locator('.entry-link,.entry-summary,.entry-bottom span,.entry-bottom time').evaluateAll(nodes=>nodes.map(node=>({text:node.textContent.trim().slice(0,35),foreground:getComputedStyle(node).color,background:getComputedStyle(node.closest('.entry')).backgroundColor})));
      assert(rendered.length>0,'card text must be present for contrast verification');
      for (const sample of rendered) {
        const ratio=contrast(sample.foreground,sample.background);
        assert(ratio>=4.5,`${name}: rendered text ${sample.text} contrast ${ratio.toFixed(3)} is below4.5`);
      }
      console.log(`${name}: minimum rendered card text contrast ${Math.min(...rendered.map(sample=>contrast(sample.foreground,sample.background))).toFixed(2)}:1`);
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
    console.log('Saved six bold palette comparisons, pointer/keyboard menu states, and list/detail skeleton previews.');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exit(1);});
