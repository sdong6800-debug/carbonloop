const assert=require('node:assert/strict'),{chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),requests=[];
  await page.route('http://127.0.0.1:8515/**',route=>route.fulfill({status:503,body:'{}'}));
  await page.route('http://127.0.0.1:8514/**',route=>{
   if(route.request().url().endsWith('/health'))return route.fulfill({json:{configured:true,provider:'DeepSeek',model:'deepseek-flash',carbonExplanationVersion:1}});
   assert.ok(route.request().url().endsWith('/carbon-explain'));
   requests.push(route.request().postDataJSON());
   return route.fulfill({json:{mode:'live_ai',provider:'MOCK',model:'deepseek-flash',answer:{summary:'这是已知构件的小计。',coverage:'仅含材料生产与处置。',drivers:['混凝土'],limitations:['不是整栋建筑总量'],nextSteps:['补齐缺失材料']}}});
  });
  await page.goto('http://127.0.0.1:8513/demo.html?test=carbon-auto-ai');
  await page.evaluate(()=>localStorage.removeItem('carbonloop-carbon-ai-auto-v1'));
  await page.reload();
  await page.click('#entryRead');await page.click('#entryConfirmGroup');if(await page.isDisabled('#entryContinue'))await page.check('#entryPartial');await page.click('#entryContinue');
  await page.waitForFunction(()=>!document.getElementById('reportExplanation').hidden);
  assert.equal(await page.isChecked('#reportExplainConsent'),true);
  assert.equal(requests.length,1);
  assert.match(await page.textContent('#reportExplainStatus'),/已解释/);
  await page.evaluate(()=>CarbonWorkspace.select(CarbonWorkspace.state().selected));await page.waitForTimeout(1200);
  assert.equal(requests.length,1,'unchanged result must not call AI twice');
  await page.uncheck('#reportExplainConsent');
  assert.equal(await page.evaluate(()=>localStorage.getItem('carbonloop-carbon-ai-auto-v1')),'off');
  console.log('PASS carbon result auto-explains once, avoids duplicate API use, and remembers explicit off.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
