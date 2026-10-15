const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const testUrl=process.env.CARBONLOOP_TEST_URL||'http://127.0.0.1:8513/demo.html';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://127.0.0.1:8515/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({available:false,revision:0})}));
 await p.goto(testUrl);await require('./test-entry-helper.cjs')(p,false);
 assert.equal(await p.locator('#app').getAttribute('data-step'),'1');assert.equal(await p.locator('#carbonReport').isVisible(),true);
 await p.click('#reportExplore');assert.equal(await p.locator('#app').getAttribute('data-step'),'3');assert.equal(await p.locator('.workspace').isVisible(),true);
 await p.selectOption('#changeElement','C01');assert.equal(await p.textContent('#elementId'),'C01');
 await p.fill('#dimensionInput','350');await p.locator('#dimensionInput').dispatchEvent('change');
 assert.match(await p.textContent('#impactChange'),/400 → 350/);assert.match(await p.textContent('#editFeedbackText'),/用量/);
 await p.click('#flowNext');assert.equal(await p.locator('#app').getAttribute('data-step'),'4');assert.equal(await p.locator('#decisionSummary').isVisible(),true);
 assert.match(await p.textContent('#decisionStructureText'),/结构|规则/);assert.match(await p.textContent('#decisionVariantGrid'),/400 → 350/);
 const [download]=await Promise.all([p.waitForEvent('download'),p.click('#flowNext')]);assert.match(download.suggestedFilename(),/\.xlsx$/);assert.ok(fs.statSync(await download.path()).size>5000);
 assert.deepEqual(errors,[]);console.log('PASS current workflow: confirm model, inspect carbon, create one candidate, edit one component, see immediate impact, compare limitations, and export Excel.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
