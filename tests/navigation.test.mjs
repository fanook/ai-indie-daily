import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as content from '../content.mjs';

// Exercise the shipped navigation functions and lifecycle callbacks, not a copy.
function app() {
  const listeners = {}, elements = new Map();
  const entries = [{dataset:{id:'first'}, getBoundingClientRect:()=>({top:-100,bottom:200})}];
  const element = id => id === 'article' ? null : elements.get(id) || elements.set(id, {
    innerHTML:'', textContent:'', dataset:{}, hidden:false,
    addEventListener(){}, setAttribute(){}, focus(){}, querySelectorAll:()=>entries
  }).get(id);
  const history = {state:{}, replaceState(value){this.state=value;}, pushState(value){this.state=value;}};
  const context = vm.createContext({...content, e:content.escapeHTML, URL, URLSearchParams, console,
    location:{search:'?section=all',hash:''}, history, scrollY:1200,
    localStorage:{getItem:()=>null}, sessionStorage:{setItem(){throw Error('disabled');}},
    requestAnimationFrame:()=>1, cancelAnimationFrame(){}, setTimeout:()=>1,clearTimeout(){},
    document:{getElementById:element, querySelectorAll:()=>[], documentElement:{dataset:{}}, addEventListener(){}, fonts:{ready:Promise.resolve()}},
    window:{scrollTo(x,y){context.scrollY=y;}, addEventListener(name,fn){listeners[name]=fn;},removeEventListener(){}}
  });
  let source = readFileSync(new URL('../app.js',import.meta.url),'utf8');
  source = source.replace(/^import .*\n/, '').replace(/\nload\(\);\s*$/, '');
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  run('loaded = true;');
  return {context, history, listeners, entries, run};
}
test('each history entry owns its pagination and position, even for the same query', () => {
  const a = app(); a.run('pageSize = 40; savePosition()');
  const first = structuredClone(a.history.state);
  a.history.state = {}; a.run('currentEntry = entryID()'); a.context.scrollY = 0; a.run('pageSize = 20; savePosition()');
  assert.equal(a.history.state.indielab_list.pageSize,20);
  a.history.state = first; a.run("currentEntry = history.state.indielab_entry");
  assert.equal(a.run('savedPosition().pageSize'),40);
  assert.equal(a.run('savedPosition().y'),1200);
});
test('query mismatch, malformed values and fresh visits never reuse another visit', () => {
  const a=app(); assert.equal(a.run('savedPosition()'),null);
  for (const value of [{query:'section=news',y:1,pageSize:20},{query:'section=all',y:-1,pageSize:20},{query:'section=all',y:1,pageSize:NaN}]) {
    a.history.state={indielab_list:value}; assert.equal(a.run('savedPosition()'),null);
  }
});
test('history position works without sessionStorage, and saves article anchor offset', () => {
  const a=app(); a.run('savePosition()');
  assert.equal(a.history.state.indielab_list.anchor,'first');
  assert.equal(a.history.state.indielab_list.offset,-100);
  a.context.scrollY=0; a.entries[0].getBoundingClientRect=()=>({top:1400,bottom:1700});
  a.run('restorePosition()'); assert.equal(a.context.scrollY,1500);
});
test('bfcache pageshow keeps existing DOM and pagination, user input cancels recovery', () => {
  const a=app(); a.run('pageSize=40; savePosition(); renderList=()=>{throw Error("must not rebuild")};');
  a.listeners.pageshow({persisted:true});
  assert.equal(a.run('pageSize'),40); assert.equal(a.run('restoring'),true);
  a.listeners.pointerdown(); assert.equal(a.run('restoring'),false);
});
test('same-entry popstate after bfcache does not rebuild the list', () => {
  const a=app(); a.run('savePosition(); renderList=()=>{throw Error("must not rebuild")};');
  a.listeners.popstate(); assert.equal(a.run('restoring'),true);
});

test('scroll snapshots stay in memory and do not exhaust Safari history mutation limits', () => {
  const a=app(); a.run('savePosition()');
  const persisted=a.history.state.indielab_list.y;
  a.history.replaceState=()=>{throw Error('scroll must not call history API');};
  for(let i=0;i<200;i++){a.context.scrollY=i; a.run('savePosition(false)');}
  assert.equal(a.history.state.indielab_list.y,persisted);
  assert.equal(a.run('savedPosition().y'),199);
});
