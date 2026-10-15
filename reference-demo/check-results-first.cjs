const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const testUrl=process.env.CARBONLOOP_TEST_URL||'http://127.0.0.1:8513/demo.html';
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://127.0.0.1:8515/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({available:false,revision:0})}));
 await p.goto(testUrl);await p.click('#entryRead');await p.click('#entryConfirmGroup');await p.click('#entryContinue');
 assert.equal(await p.locator('#carbonReport').isVisible(),true);assert.equal(await p.locator('.workspace').isVisible(),false);
 assert.equal(await p.textContent('#total'),'2,569.79');assert.match(await p.textContent('#reportState'),/材料生产＋处置/);
 assert.equal(await p.locator('#reportComponents tr').count(),6);assert.equal(await p.locator('#reportStages tr').count(),7);
 for(const row of await p.locator('#reportComponents tr').all()){assert.match(await row.textContent(),/已确认/);assert.match(await row.textContent(),/KBOB/);assert.equal(await row.locator('details').count(),1);}
 assert.match(await p.textContent('#reportConfirmation'),/6 \/ 6/);assert.ok(!(await p.locator('#app').innerText()).includes('原始方案'));
 await p.screenshot({path:'carbon-results-factors-desktop.png',fullPage:true});
 await p.click('.component-disclosure>summary');await p.getByRole('button',{name:'在模型中查看 C01',exact:true}).click();assert.equal(await p.locator('#componentInfo').isVisible(),true);assert.match(await p.textContent('#componentInfo'),/C01/);assert.match(await p.textContent('#componentInfo'),/KBOB/);await p.keyboard.press('Escape');
 await p.click('#reportExplore');assert.equal(await p.locator('.workspace').isVisible(),true);assert.equal(await p.locator('#carbonReport').isVisible(),false);assert.equal(await p.locator('#app').getAttribute('data-step'),'3');await p.click('#flowBack');assert.equal(await p.locator('#carbonReport').isVisible(),true);
 for(const width of [1280,1024,768,390]){await p.setViewportSize({width,height:950});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
 await p.screenshot({path:'carbon-results-mobile.png',fullPage:true});
 // Verified concrete fixture proves the report uses actual calculated totals, not placeholder numbers.
 await require('./test-entry-helper.cjs')(p,false);assert.equal(await p.locator('#carbonReport').isVisible(),true);assert.equal(await p.textContent('#total'),'1,565.69');
 const first=await p.locator('#reportStages tr').first().textContent();assert.match(first,/1,370.95/);assert.match(await p.locator('#reportStages tr').nth(5).textContent(),/194.75/);
 assert.match(await p.textContent('#reportComponents'),/KBOB 01.002/);await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:'carbon-results-calculated-desktop.png',fullPage:true});
 await p.click('#recheckModel');await p.locator('[data-row="S01"]').click();await p.selectOption('#entryMaterial','unknown');await p.check('#entryPartial');await p.click('#entryContinue');assert.match(await p.textContent('#reportConfirmation'),/4 \/ 5/);assert.match(await p.locator('[data-result-id=S01]').textContent(),/材料未确认/);assert.equal(await p.textContent('#total'),'447.34');
 const [d]=await Promise.all([p.waitForEvent('download'),p.click('#export')]);assert.match(d.suggestedFilename(),/\.xlsx$/);assert.ok(fs.statSync(await d.path()).size>5000);
 assert.deepEqual(errors,[]);console.log('PASS results-first, confirmed vs missing-factor states, seven stage coverage rows, component dialog, one-workspace improvement, actual arithmetic, Excel export and responsive layouts');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
