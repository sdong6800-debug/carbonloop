'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1100}}),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('http://127.0.0.1:8514/**',async r=>{
   if(r.request().url().endsWith('/health'))return r.fulfill({json:{configured:true,componentMatrixVersion:1,changeReviewVersion:5,rulebookVersion:'au-early-design-0.1.0',structuralRagVersion:'au-early-design-rag-0.1.0',provider:'MOCK'}});
   assert(r.request().url().endsWith('/structural-review'));
   const body=r.request().postDataJSON();requests.push(body);
   await r.fulfill({json:{mode:'live_ai',report:{rag:{retrievedEvidence:[{id:'CL-RULE-THICKER-SLAB',source_title:'CarbonLoop 前期结构知识规则包',locator:'ED-SLAB-THICKER',source_url:null,authority:'early_design_screening',project_applicability:'candidate_reference_only'}]}},answer:{status:'not_determined',priorityCheckIds:['analysis'],nextData:'荷载与支承',reason:body.after.h<body.before.h?'减薄后需要重新核实承载和变形。':'加厚会增加楼板自重，需要检查支承构件。',nextStep:'确认配筋与修改后的设计内力。',citationIds:['CL-RULE-THICKER-SLAB']}}});
  });
  await p.goto('http://127.0.0.1:8513/demo.html');
  await p.click('#entryRead');await p.click('#entryConfirmGroup');await p.click('#entryContinue');await p.click('#reportExplore');
  const edit=async value=>{await p.fill('#dimensionInput',String(value));await p.press('#dimensionInput','Tab');};
  await edit(210);
  assert.equal(await p.getAttribute('#decision-carbon','aria-selected'),'true');
  assert(await p.isVisible('#editReview'));
  assert.match(await p.textContent('#editReviewImpact'),/增加 5%/);
  assert.match(await p.textContent('#editRuleTrace'),/已计算.*楼板自身重量增加 5\.0%.*已筛查.*楼板加厚.*待验证/s);
  assert.match(await p.textContent('#editReviewVerdict'),/不建议.*减碳方案.*碳排和楼板自重同时上升/);
  assert.equal(await p.textContent('#editReviewState'),'不建议');
  assert.equal(requests.length,0);assert.equal(await p.isChecked('#structuralAuto'),false);
  await p.click('#editReviewAsk');await p.waitForFunction(()=>!document.getElementById('editReviewAI').hidden);
  assert.equal(requests.length,1);assert.equal(requests[0].after.h,.21);
  assert.match(await p.textContent('#editReviewReason'),/加厚/);
  assert.match(await p.textContent('#editReviewRagCount'),/已引用 1 条/);
  assert.match(await p.textContent('#editReviewRagProof'),/CarbonLoop 前期结构知识规则包.*CL-RULE-THICKER-SLAB.*ED-SLAB-THICKER/s);
  assert.match(await p.textContent('#editReviewConnection'),/已通过 RAG 引用校验/);
  await edit(180);
  assert.equal(await p.isVisible('#editReviewAI'),false);
  assert.match(await p.textContent('#editReviewImpact'),/减少 10%/);
  assert.match(await p.textContent('#editReviewVerdict'),/值得继续比较.*确认跨度、支承方式和楼面用途/);
  assert.equal(await p.textContent('#editReviewState'),'可研究');
  await p.check('#structuralAuto');await p.waitForFunction(()=>!document.getElementById('editReviewAI').hidden);
  assert.equal(requests.length,2);
  await edit(250);await edit(260);await edit(270);
  await p.waitForFunction(()=>!document.getElementById('editReviewAI').hidden);
  assert.equal(requests.length,3);assert.equal(requests[2].after.h,.27);
  await p.uncheck('#structuralAuto');
  await p.click('[data-component-id="C03"]');
  assert.equal(await p.isVisible('#editReviewAI'),false);assert(await p.isDisabled('#editReviewAsk'));
  assert.match(await p.textContent('#editReviewVerdict'),/暂|未判断/);
  await p.click('[data-component-id="S01"]');await edit(270);
  await p.screenshot({path:'inline-feedback-desktop.png',fullPage:true});
  await p.click('#structureStatusLink');assert.equal(await p.getAttribute('#decision-structure','aria-selected'),'true');
  assert.equal(await p.locator('#structuralAuto').count(),1);
  for(const width of [1024,768,390]){await p.setViewportSize({width,height:1100});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
  await p.screenshot({path:'inline-feedback-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS inline risk, manual/automatic consent, selected modification payload, debounce, stale-result clearing, unsupported material, one checkbox, responsive widths. Mocked AI only.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
