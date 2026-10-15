'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://127.0.0.1:8514/health',route=>route.fulfill({json:{configured:false}}));
 await page.goto('http://127.0.0.1:8513/demo.html');await page.click('#entryRead');await page.click('#entryConfirmGroup');await page.click('#entryContinue');await page.click('#reportExplore');
 await page.fill('#dimensionInput','180');await page.press('#dimensionInput','Tab');await page.click('#flowNext');
 assert.equal(await page.getAttribute('#app','data-step'),'4');assert(await page.isVisible('#decisionSummary'));assert(await page.isVisible('#changeImpact'));assert.equal(await page.locator('#changeImpact').evaluate(node=>node.parentElement.id),'decisionImpactMount');
 assert.match(await page.textContent('#decisionVerdict'),/减少/);assert.match(await page.textContent('#decisionChangeTitle'),/1 项改动/);assert.match(await page.textContent('#decisionStructureState'),/待结构复核/);assert.match(await page.textContent('#decisionRagState'),/尚未/);assert.match(await page.textContent('#decisionMissingSummary'),/还缺哪些资料/);
 assert.equal(await page.locator('#flowNext').evaluate(node=>node.parentElement.id),'decisionActions');assert.match(await page.textContent('#flowNext'),/保留候选/);assert.equal(await page.isDisabled('#flowNext'),false);assert.equal(await page.isVisible('#comparison'),false);
 await page.screenshot({path:'comparison-decision-desktop.png',fullPage:true});
 const [download]=await Promise.all([page.waitForEvent('download'),page.click('#flowNext')]);assert.match(await download.suggestedFilename(),/\.xlsx$/);assert.equal(await page.evaluate(()=>ComparisonDecision.exportState().status),'kept_for_validation');
 for(const width of [1024,768,390]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}assert.deepEqual(errors,[]);
 console.log('PASS one decision page, visible carbon comparison, structural/RAG status, missing-data disclosure, explicit keep action, Excel export and responsive layout.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
