'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const testUrl=process.env.CARBONLOOP_TEST_URL||'http://127.0.0.1:8513/demo.html';
  const p=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],requests=[];let hold=false,release=null;
  await require('./test-baseline-route.cjs')(p);
  await p.route('http://127.0.0.1:8515/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({available:false,revision:0})}));
  p.on('pageerror',e=>errors.push(e.stack||e.message));
  await p.route('http://127.0.0.1:8514/**',async r=>{
   if(r.request().url().endsWith('/health'))return r.fulfill({json:{configured:true,componentMatrixVersion:1,changeReviewVersion:5,rulebookVersion:'au-early-design-0.1.0',structuralRagVersion:'au-early-design-rag-0.1.0',solutionVersion:2,provider:'MOCK'}});
   if(!r.request().url().endsWith('/solutions'))return r.fulfill({status:503,json:{error:'not part of this test'}});
   const body=r.request().postDataJSON();requests.push(body);
   const response={mode:'live_ai',provider:'MOCK',answer:{preferredId:'material-S01',reason:'优先核实楼板的混凝土配方，不改变尺寸。',nextStep:'确认强度、供应与耐久要求。',evidenceIds:['kbob-concrete-v9']}};
   const send=()=>r.fulfill({json:response}).catch(()=>{});
   if(hold){release=send;return;}await send();
  });
  await p.goto(testUrl);await p.click('#entryRead');await p.click('#entryConfirmGroup');if(await p.isDisabled('#entryContinue'))await p.check('#entryPartial');await p.click('#entryContinue');
  assert.match(await p.textContent('#reportExplore'),/寻找减碳方案/);await p.click('#reportExplore');
  assert(await p.isVisible('#solutions'));
  const original=await p.evaluate(()=>JSON.stringify(CarbonWorkspace.state().baseline));
  await p.click('#solutionFind');await p.waitForFunction(()=>!document.getElementById('solutionFind').disabled);
  assert.equal(requests.length,0);assert.equal(await p.locator('.solution-card').count(),3);
  assert.match(await p.textContent('#solutionStatus'),/未调用 AI/);
  assert.equal(await p.evaluate(()=>CarbonWorkspace.state().alternatives.length),3);assert.match(await p.textContent('#solutionCards'),/已自动进入最终对比/);
  await p.check('#solutionConsent');await p.click('#solutionFind');await p.waitForFunction(()=>!document.getElementById('solutionAdvice').hidden);
  assert.equal(requests.length,1);assert.equal(requests[0].options.allowThickness,false);
  assert.match(await p.textContent('[data-candidate-id="material-S01"] .solution-tag'),/AI 建议/);
  await p.screenshot({path:'solutions-desktop.png',fullPage:true});
  assert.equal(await p.evaluate(()=>CarbonWorkspace.state().alternatives.length),3);
  assert.equal(await p.evaluate(()=>CarbonWorkspace.state().alternatives.find(item=>item.candidateId==='material-S01').elements.find(e=>e.id==='S01').factorId),'01.002.13');
  assert.match(await p.evaluate(()=>CarbonWorkspace.state().alternatives.find(item=>item.candidateId==='material-S01').origin),/AI 建议/);
  assert.equal(await p.evaluate(()=>CarbonWorkspace.state().candidate.find(e=>e.id==='S01').factorId),undefined);
  assert.equal(await p.evaluate(()=>JSON.stringify(CarbonWorkspace.state().baseline)),original);
  assert.equal(await p.locator('.solution-card').count(),3);assert.match(await p.textContent('[data-candidate-id="material-S01"]'),/已自动进入最终对比/);
  await p.uncheck('#solutionConsent');await p.uncheck('#solutionMaterial');
  await p.locator('.solution-controls details summary').click();await p.check('#solutionThickness');
  await p.fill('#solutionMin','180');await p.fill('#solutionMax','200');await p.click('#solutionFind');await p.waitForFunction(()=>!document.getElementById('solutionFind').disabled);
  assert.equal(await p.locator('.solution-card').count(),2);assert.match(await p.textContent('#solutionCards'),/用户指定的探索区间/);
  await p.fill('#solutionGoal','保持厚度不变');assert.equal(await p.locator('.solution-card').count(),0);
  await p.uncheck('#solutionThickness');await p.check('#solutionMaterial');await p.check('#solutionConsent');
  hold=true;await p.click('#solutionFind');await p.waitForTimeout(300);assert(release);
  await p.fill('#solutionGoal','请求期间改变研究要求');await release();await p.waitForFunction(()=>document.querySelectorAll('.solution-card').length===0);
  assert.equal(await p.isVisible('#solutionAdvice'),false);assert.equal(await p.locator('.solution-card').count(),0);
  for(const width of [1024,768,390]){await p.setViewportSize({width,height:1100});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
  await p.screenshot({path:'solutions-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS primary solution entry, automatic candidate-set persistence, consented recommendation, preserved original, bounded dimension exploration, stale input/result invalidation, responsive UI. Mocked AI only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
