const assert=require('node:assert/strict'),{chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),requests=[];
  await page.route('http://127.0.0.1:8515/**',route=>route.fulfill({status:503,body:'{}'}));
  await page.route('http://127.0.0.1:8514/**',async route=>{
   if(route.request().url().endsWith('/health'))return route.fulfill({json:{configured:true,provider:'DeepSeek',model:'deepseek-flash',changeReviewVersion:5,rulebookVersion:'au-early-design-0.1.0',structuralRagVersion:'au-early-design-rag-0.1.0'}});
   const body=route.request().postDataJSON();requests.push(body);
   return route.fulfill({json:{mode:'live_ai',provider:'MOCK',report:{rag:{retrievedEvidence:[{id:'CL-RULE-THICKER-SLAB',source_title:'CarbonLoop 前期结构知识规则包',locator:'ED-SLAB-THICKER',authority:'early_design_screening',project_applicability:'candidate_reference_only'}]}},answer:{status:'not_determined',priorityCheckIds:['analysis'],reason:'自动分析已运行。',nextStep:'继续结构验证。',citationIds:['CL-RULE-THICKER-SLAB']}}});
  });
  await page.goto('http://127.0.0.1:8513/demo.html?test=auto-ai');
  await page.evaluate(()=>localStorage.setItem('carbonloop-structural-auto-v1','on'));
  await page.reload();
  await page.click('#entryRead');await page.click('#entryConfirmGroup');if(await page.isDisabled('#entryContinue'))await page.check('#entryPartial');await page.click('#entryContinue');await page.click('#reportExplore');
  await page.waitForFunction(()=>StructuralReviewUI.exportState().configured);
  assert.equal(await page.isChecked('#structuralAuto'),true);
  await page.fill('#dimensionInput','210');await page.press('#dimensionInput','Tab');
  await page.waitForFunction(()=>StructuralReviewUI.exportState().ai_result!==null);
  assert.equal(requests.length,1);
  for(const value of [220,230,240]){await page.fill('#dimensionInput',String(value));await page.press('#dimensionInput','Tab');}
  await page.waitForFunction(()=>StructuralReviewUI.exportState().ai_result!==null);
  assert.equal(requests.length,2);
  assert.equal(requests[1].after.h,.24);
  await page.uncheck('#structuralAuto');
  assert.equal(await page.evaluate(()=>localStorage.getItem('carbonloop-structural-auto-v1')),'off');
  console.log('PASS automatic AI preference persists and rapid edits debounce to one final request.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
