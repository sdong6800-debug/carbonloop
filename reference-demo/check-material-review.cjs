const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright'),C=require('./model-core.js');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await require('./test-baseline-route.cjs')(p);
 const open=async()=>{await p.goto('http://127.0.0.1:8513/demo.html');await p.click('#entryRead');await p.click('#entryObjectList summary');};
 const edit=async()=>{if(!await p.locator('#entryCorrections').evaluate(e=>e.open))await p.click('#entryCorrections summary');};
 const exported=async()=>{const [d]=await Promise.all([p.waitForEvent('download'),p.click('#export')]);return JSON.parse(fs.readFileSync(await d.path(),'utf8'));};
 await open();assert.equal(await p.locator('.entry-material-card').count(),2);assert.equal(await p.locator('#entryCorrections').evaluate(e=>e.open),true);
 await p.screenshot({path:'material-review-default-desktop.png',fullPage:true});
 assert.equal(await p.locator('#entryMaterial option').count(),20);assert.equal(await p.locator('#material option').count(),20);
 await p.click('[data-match^="column|concrete|"]');assert.equal(await p.locator('.entry-row').count(),4);
 assert.equal(await p.locator('#entryModel [data-entry-id=C01]').getAttribute('aria-pressed'),'true');
 await p.click('[data-confirm-match^="column|concrete|"]');assert.match(await p.textContent('#entrySummary'),/已确认 4/);
 await edit();await p.check('#entryApplySimilar');await p.selectOption('#entryMaterial','steel-section');
 assert.match(await p.textContent('#entryNotice'),/修正 4 个/);assert.match(await p.textContent('#entrySummary'),/已确认 0/);
 await p.click('[data-confirm-match^="column|steel-section|"]');assert.match(await p.textContent('#entryProgress'),/分类已确认 4.*可计算 0/);
 await p.click('[data-confirm-match^="slab|concrete|"]');assert.match(await p.textContent('#entryProgress'),/分类已确认 5.*可计算 1/);
 assert.equal(await p.isDisabled('#entryContinue'),true);await p.check('#entryPartial');
 await p.screenshot({path:'material-review-desktop.png',fullPage:true});
 for(const width of [1280,1024,768,390]){await p.setViewportSize({width,height:950});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
 await p.screenshot({path:'material-review-mobile.png',fullPage:true});await p.click('#entryContinue');
 const data=await exported();assert.equal(data.model_entry.confirmed_count,5);assert.equal(data.model_entry.calculable_count,1);assert.equal(data.model_entry.missing_factor_count,4);
 assert.equal(data.model_entry.ai_connected,false);assert.equal(data.A.elements.filter(e=>e.material==='steel-section').length,4);assert.equal(data.A.result.known,1);assert.equal(data.A.result.complete,false);
 assert.ok(Math.abs(data.A.result.value-C.calculate(C.sample().slice(0,1)).value)<1e-8);
 assert.ok(data.A.result.lines.filter(e=>e.material==='steel-section').every(e=>e.value===null&&e.error.includes('缺实际截面')));
 assert.ok(data.model_entry.records.every(e=>e.sourceMaterial==='通用混凝土'));assert.equal(data.model_entry.excluded_count,5);
 await p.click('#recheckModel');assert.match(await p.textContent('#entrySummary'),/已确认 5/);await p.click('#entryContinue');await p.click(await p.locator('#carbonReport').isVisible()?'#reportExplore':'#flowNext');await p.click('#copy');await p.click('#recheckModel');
 assert.ok(await p.isDisabled('[data-confirm-match^="column|steel-section|"]'));assert.ok(await p.isDisabled('#entryMaterial'));
 await open();await edit();await p.selectOption('#entryMaterial','unknown');assert.ok(await p.isDisabled('#entryConfirmOne'));await p.click('[data-group=issues]');assert.equal(await p.locator('.entry-row').count(),1);assert.ok(await p.isDisabled('#entryConfirmGroup'));
 await p.click('[data-group=all]');await p.click('#entryConfirmGroup');assert.match(await p.textContent('#entrySummary'),/已确认 4/);
 // All confirmed classifications but no factors: retain names, null result, no zero or fake complete comparison.
 await open();await p.click('[data-match^="column|concrete|"]');await edit();await p.check('#entryApplySimilar');await p.selectOption('#entryMaterial','insulation');
 await p.click('[data-row=S01]');await edit();assert.equal(await p.isChecked('#entryApplySimilar'),false);await p.selectOption('#entryMaterial','finish');
 await p.click('#entryConfirmGroup');await p.check('#entryPartial');await p.click('#entryContinue');const noFactors=await exported();
 assert.equal(noFactors.A.result.value,null);assert.equal(noFactors.A.result.known,0);assert.equal(noFactors.model_entry.confirmed_count,5);assert.equal(await p.textContent('#total'),'—');
 assert.equal(C.compare(noFactors.A.elements,noFactors.A.elements).compatible,false);
 assert.deepEqual(errors,[]);console.log('PASS material catalogue, grouped confirmation/highlight, collapsed corrections, scoped bulk edits, invalidation, unknown vs missing-factor states, null results, export provenance, readonly review and responsive layouts');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
