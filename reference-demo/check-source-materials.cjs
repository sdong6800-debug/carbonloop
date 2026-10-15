const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8513/demo.html');
 assert.equal(await p.locator('#entrySample,#entryCatalogue,#entryShowCatalogue').count(),0);
 assert.match(await p.textContent('.entry-connection'),/当前模型/);
 await p.click('#entryRead');assert.equal(await p.locator('.entry-row').count(),6);
 for(const [id,material,raw] of [['S01','concrete-cast','C30/37'],['C01','steel-section','S355'],['C02','steel-section','S355'],['C03','timber-glulam','GL28h'],['C04','timber-glulam','GL28h'],['W01','masonry-clay','Clay brick']]){
  const row=p.locator('[data-row="'+id+'"]');assert.equal(await row.getAttribute('data-material'),material);assert.equal(await row.getAttribute('data-floor'),'1F');assert.match(await row.textContent(),new RegExp(raw));
 }
 assert.equal(await p.locator('#entryObjectList').evaluate(e=>e.open),false);
 await p.click('[data-locate=C01]');assert.equal(await p.locator('#entryModel [data-entry-id=C01]').getAttribute('aria-pressed'),'true');assert.match(await p.textContent('#entrySourceMaterial'),/S355/);
 await p.click('[data-confirm-row=C01]');assert.match(await p.textContent('#entrySummary'),/已确认 1/);
 await p.click('#entryConfirmGroup');assert.match(await p.textContent('#entrySummary'),/已确认 6/);
 assert.equal(await p.isDisabled('#entryContinue'),false);
 await p.screenshot({path:'component-review-desktop.png',fullPage:true});
 for(const width of [1024,768,390]){await p.setViewportSize({width,height:950});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
 await p.screenshot({path:'component-review-mobile.png',fullPage:true});await p.click('#entryContinue');assert.equal(await p.textContent('#total'),'2,569.79');
 const [d]=await Promise.all([p.waitForEvent('download'),p.click('#export')]);const data=JSON.parse(fs.readFileSync(await d.path(),'utf8'));
 assert.equal(data.A.elements.length,6);assert.equal(data.model_entry.confirmed_count,6);assert.equal(data.model_entry.calculable_count,6);assert.equal(data.model_entry.ai_connected,false);assert.equal(data.model_entry.rhino_connected,false);assert.ok(!('sample_mode' in data.model_entry));
 assert.ok(data.A.elements.filter(e=>e.material==='steel-section').every(e=>e.materialRecord.grade==='S355'));
 await p.setViewportSize({width:1440,height:1100});await p.goto('http://127.0.0.1:8513/demo.html');await p.check('[name=entryScope][value=all]');await p.click('#entryRead');assert.equal(await p.locator('.entry-row').count(),11);
 await p.click('[data-confirm-row=C04-2F]');assert.equal(await p.locator('#entryCorrections').evaluate(e=>e.open),true);assert.match(await p.textContent('#entrySourceMaterial'),/Material 007/);assert.equal(await p.inputValue('#entryMaterial'),'unknown');assert.ok(await p.isDisabled('#entryConfirmOne'));
 await p.selectOption('#entryMaterial','steel-tube');await p.click('#entryConfirmOne');assert.equal(await p.locator('[data-row=C04-2F]').getAttribute('data-material'),'steel-tube');
 await p.click('[data-locate=C01]');await p.check('#entryApplySimilar');await p.selectOption('#entryMaterial','steel-plate');
 assert.match(await p.textContent('#entryNotice'),/修正 2 个/);assert.equal(await p.locator('[data-row=C03]').getAttribute('data-material'),'timber-glulam');
 assert.deepEqual(errors,[]);console.log('PASS current model, per-component materials, confirmation/highlight, unknown correction, provenance, missing factors, scoped edits and responsive layout');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
