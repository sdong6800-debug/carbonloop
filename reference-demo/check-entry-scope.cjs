const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await require('./test-baseline-route.cjs')(p);
const open=async()=>{await p.goto('http://127.0.0.1:8513/demo.html');};
const confirm=async()=>{if(await p.locator('#entryRead').isVisible())await p.click('#entryRead');await p.click('#entryConfirmGroup');await p.click('#entryContinue');};
const exported=async()=>{const [d]=await Promise.all([p.waitForEvent('download'),p.click('#export')]);return JSON.parse(fs.readFileSync(await d.path(),'utf8'));};
await open();assert.equal(await p.isChecked('[name=entryScope][value=floor]'),true);assert.equal(await p.locator('#entryModel [data-in-scope=true]').count(),5);
await p.selectOption('#entryFloorSelect','2F');assert.ok((await p.textContent('#entryRangeLabel')).includes('2F'));
assert.ok((await p.locator('#entryModel [data-in-scope=true]').evaluateAll(es=>es.map(e=>e.dataset.entryId))).every(id=>id.endsWith('-2F')));
await p.check('#entryIsolate');assert.equal(await p.locator('#entryModel [display=none]').count(),5);await p.uncheck('#entryIsolate');
await p.screenshot({path:'entry-scope-floor-desktop.png',fullPage:true});
await confirm();assert.ok((await p.textContent('#sourceLabel')).includes('2F 楼层'));assert.equal(await p.locator('#model g[data-id]').count(),5);
const second=await exported();assert.equal(second.model_entry.floor,'2F');assert.equal(second.model_entry.excluded_count,5);assert.equal(second.model_entry.source_count,10);assert.ok(second.A.elements.every(e=>e.floor==='2F'&&e.z>=3.2));assert.ok(Math.abs(second.A.result.value-1565.6928)<1e-7);
assert.ok((await p.evaluate(es=>window.StructurePreparation.summary('A',es).issues,second.A.elements)).some(x=>x.includes('旧专业表单仅针对首层')));
assert.ok(await p.locator('#model polygon').evaluateAll(es=>es.every(e=>[...e.points].every(p=>p.x>=0&&p.x<=700&&p.y>=0&&p.y<=440))));
await p.click('#recheckModel');assert.ok((await p.textContent('#entrySummary')).includes('2F 楼层'));
await p.click('#entryRangeSummary');assert.equal(await p.inputValue('#entryFloorSelect'),'2F');
await p.check('[name=entryScope][value=all]');assert.equal(await p.locator('#entryModel [data-in-scope=true]').count(),10);assert.ok((await p.textContent('#entryScopeSummary')).includes('排除 0'));await confirm();const whole=await exported();assert.equal(whole.A.elements.length,10);assert.ok(Math.abs(whole.A.result.value-2*1565.6928)<1e-7);assert.equal(whole.model_entry.scope,'all');assert.deepEqual(whole.model_entry.floor_ids,['1F','2F']);assert.ok((await p.textContent('.project-data')).includes('48 m²'));
await open();await p.check('[name=entryScope][value=selection]');assert.equal(await p.isDisabled('#entryRead'),true);assert.equal(await p.locator('#entryModel [data-in-scope=true]').count(),0);
await p.check('[data-pick=C02]');await p.check('[data-pick="S01-2F"]');assert.equal(await p.locator('#entryModel [data-in-scope=true]').count(),2);
await p.check('[name=entryScope][value=floor]');await p.check('[name=entryScope][value=selection]');assert.equal(await p.locator('#entryModel [data-in-scope=true]').count(),2);
await p.locator('#entryModel [data-entry-id=C02]').press('Enter');assert.equal(await p.isChecked('[data-pick=C02]'),false);await p.check('[data-pick=C02]');
for(const width of [1280,1024,768,390]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
await p.screenshot({path:'entry-scope-selected-mobile.png',fullPage:true});await confirm();const partial=await exported();assert.deepEqual(partial.model_entry.selected_ids,['C02','S01-2F']);assert.equal(partial.model_entry.scope,'selection');assert.equal(partial.model_entry.confirmed_count,2);assert.equal(partial.model_entry.excluded_count,8);assert.equal(partial.A.elements.length,2);assert.equal(partial.A.result.complete,true);assert.equal(partial.model_entry.partial_acknowledged,false);
assert.deepEqual(errors,[]);console.log('PASS floor/whole/cross-floor selection, empty blocking, highlight, isolation, actual calculation scope, export provenance, restored scope, 2F visibility, keyboard and mobile');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
