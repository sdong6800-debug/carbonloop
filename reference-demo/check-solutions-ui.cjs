'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],requests=[];let hold=false,release=null;
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('http://127.0.0.1:8514/**',async r=>{
   if(r.request().url().endsWith('/health'))return r.fulfill({json:{configured:true,changeReviewVersion:5,rulebookVersion:'au-early-design-0.1.0',structuralRagVersion:'au-early-design-rag-0.1.0',solutionVersion:1,provider:'MOCK'}});
   assert(r.request().url().endsWith('/solutions'));
   const body=r.request().postDataJSON();requests.push(body);
   const response={mode:'live_ai',provider:'MOCK',answer:{preferredId:'material-S01',reason:'优先核实楼板的混凝土配方，不改变尺寸。',nextStep:'确认强度、供应与耐久要求。',evidenceIds:['kbob-concrete-v9']}};
   const send=()=>r.fulfill({json:response}).catch(()=>{});
   if(hold){release=send;return;}await send();
  });
  await p.goto('http://127.0.0.1:8513/demo.html');await p.click('#entryRead');await p.click('#entryConfirmGroup');await p.click('#entryContinue');
  assert.match(await p.textContent('#reportExplore'),/寻找减碳方案/);await p.click('#reportExplore');
  assert(await p.isVisible('#solutions'));
  const original=await p.evaluate(()=>JSON.stringify(CarbonWorkspace.state().baseline));
  await p.click('#solutionFind');
  assert.equal(requests.length,0);assert.equal(await p.locator('.solution-card').count(),1);
  assert.match(await p.textContent('#solutionStatus'),/未调用 AI/);
  assert(await p.locator('.solution-card>button').isDisabled());
  await p.check('#solutionConsent');await p.click('#solutionFind');await p.waitForFunction(()=>!document.getElementById('solutionAdvice').hidden);
  assert.equal(requests.length,1);assert.equal(requests[0].options.allowThickness,false);
  assert.match(await p.textContent('.solution-tag'),/AI 建议/);
  await p.screenshot({path:'solutions-desktop.png',fullPage:true});
  await p.check('.solution-card>label input');await p.click('.solution-card>button');
  assert.equal(await p.evaluate(()=>CarbonWorkspace.state().candidate.find(e=>e.id==='S01').factorId),'01.002.13');
  assert.equal(await p.evaluate(()=>JSON.stringify(CarbonWorkspace.state().baseline)),original);
  assert.equal(await p.locator('.solution-card').count(),0);
  await p.click('#resetElement');
  await p.uncheck('#solutionConsent');await p.uncheck('#solutionMaterial');
  await p.locator('.solution-controls details summary').click();await p.check('#solutionThickness');
  await p.fill('#solutionMin','180');await p.fill('#solutionMax','200');await p.click('#solutionFind');
  assert.equal(await p.locator('.solution-card').count(),2);assert.match(await p.textContent('#solutionCards'),/用户指定的探索区间/);
  await p.fill('#solutionGoal','保持厚度不变');assert.equal(await p.locator('.solution-card').count(),0);
  await p.uncheck('#solutionThickness');await p.check('#solutionMaterial');await p.check('#solutionConsent');
  hold=true;await p.click('#solutionFind');await p.waitForTimeout(300);assert(release);
  await p.fill('#dimensionInput','210');await p.press('#dimensionInput','Tab');await release();
  assert.equal(await p.isVisible('#solutionAdvice'),false);assert.equal(await p.locator('.solution-card').count(),0);
  for(const width of [1024,768,390]){await p.setViewportSize({width,height:1100});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
  await p.screenshot({path:'solutions-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS primary solution entry, offline disclosure, consented recommendation, explicit draft acceptance, preserved original, bounded thickness exploration, stale input/result invalidation, responsive UI. Mocked AI only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
