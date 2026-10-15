const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8513/demo.html');
 const active=async()=>page.locator('#journeySteps [aria-current="step"]').innerText();
 assert.equal(await page.locator('#journeySteps li').count(),6);assert.equal(await active(),'选择范围');
 assert.equal(await page.locator('#welcome').isVisible(),false);assert.equal(await page.locator('.entry-steps').isVisible(),false);
 await page.screenshot({path:'journey-scope.png',fullPage:true});
 await page.click('#entryRead');assert.equal(await active(),'核对模型');assert.equal(await page.textContent('#entryTitle'),'核对构件与材料');
 await page.screenshot({path:'journey-review.png',fullPage:true});
 await page.click('#entryConfirmGroup');await page.click('#entryContinue');assert.equal(await active(),'碳排结果');
 await page.click('#reportExplore');assert.equal(await active(),'寻找方案');assert.equal(await page.textContent('#flowTitle'),'寻找减碳方案');
 await page.fill('#dimensionInput','180');await page.press('#dimensionInput','Tab');await page.click('#flowNext');assert.equal(await active(),'对比确认');assert.equal(await page.textContent('#flowTitle'),'对比并保留方案');
 const [download]=await Promise.all([page.waitForEvent('download'),page.click('#flowNext')]);assert.ok((await download.suggestedFilename()).endsWith('.xlsx'));assert.equal(await active(),'导出报告');
 for(const width of [1024,768,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);}
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'journey-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS one six-stage journey, consistent actions, Excel export, responsive layout');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
