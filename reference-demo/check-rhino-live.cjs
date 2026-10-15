'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const floor={id:'guid-live-1',name:'S01 Floor Slab',typeHint:'slab',floor:'L1',layer:'L1::Slab',geometry:{kind:'box',origin:[100000,200000,0],dimensions:[6000,4000,200]},material:{id:'m1',name:'Cast-in-place concrete',productType:'concrete-cast',grade:'C30'},quantity:{kind:'net-volume',value:4800000000,basis:'Rhino net volume'}};
const column={id:'guid-live-2',name:'C01 Column',typeHint:'column',floor:'L1',layer:'L1::Columns',geometry:{kind:'box',origin:[100000,200000,0],dimensions:[400,400,3000]},material:{id:'m1',name:'Cast-in-place concrete',productType:'concrete-cast',grade:'C30'},quantity:{kind:'net-volume',value:480000000,basis:'Rhino net volume'}};
const floor2={...floor,id:'guid-live-3',name:'S02 Floor Slab',geometry:{...floor.geometry,origin:[106000,200000,0]}};
const floor3={...floor,id:'guid-live-4',name:'S03 Floor Slab',geometry:{...floor.geometry,origin:[112000,200000,0]}};
const glazing={...floor,id:'guid-live-glass',name:'G01 Glazing',typeHint:'glazing',layer:'L1::Glazing',geometry:{kind:'box',origin:[100000,204000,0],dimensions:[3000,20,2800]},material:{id:'glass-1',name:'Clear flat glass',productType:'glass',grade:''},quantity:{kind:'net-volume',value:168000000,basis:'Rhino net volume'}};
const testUrl=process.env.CARBONLOOP_TEST_URL||'http://127.0.0.1:8513/demo.html';
function makePayload(transmissionId,objects){return {schemaVersion:'carbonloop.rhino.intake/1.0.0',source:{host:'Rhino',mode:'test',documentId:'browser-test.3dm',unitSystem:'Millimeters',pluginVersion:'carbonloop-rhino-script/test',semanticProfileVersion:'test-profile',transmissionId},selection:{mode:'selection'},objects};}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];let current=makePayload('send-1',[floor,glazing]);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://127.0.0.1:8515/rhino-intake/latest',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({available:true,revision:1,receivedAt:'2026-10-11T00:00:00Z',payload:current,validation:{valid:true,warnings:[],metadata:{contractVersion:current.schemaVersion,sourceHost:'Rhino',documentId:current.source.documentId,unitSystem:current.source.unitSystem,pluginVersion:current.source.pluginVersion,semanticProfileVersion:current.source.semanticProfileVersion,selectionMode:'selection',receivedCount:current.objects.length}}})}));
  await page.goto(testUrl);
  await page.waitForFunction(()=>document.querySelector('.entry-badge')?.textContent.includes('Rhino 已连接'));
  assert.match(await page.locator('.page-heading .status').innerText(),/Rhino 已连接 · 2 个对象/);
  assert.match(await page.locator('#entryRangeLabel').innerText(),/Rhino 中选中的构件/);
  await page.click('#entryRead');assert.equal(await page.locator('#entryMaterial').inputValue(),'concrete-cast');
  assert.equal(await page.textContent('#entryConfirmGroup'),'一键确认全部已识别构件（2）','first Rhino review must default to the complete scope, not the largest material group');
  await page.click('#entryConfirmGroup');assert.equal(await page.locator('#entryContinue').isDisabled(),false);
  await page.click('#entryContinue');assert.match(await page.locator('#sourceLabel').innerText(),/Rhino 实际导入/);assert.notEqual(await page.locator('#total').innerText(),'—');
  current=makePayload('send-2',[column,floor,floor2,floor3]);
  await page.evaluate(()=>window.CarbonRhinoLive.poll());
  await page.waitForFunction(()=>document.querySelector('.entry-badge')?.textContent.includes('4 个对象'));
  assert.equal(await page.locator('#modelEntry').isVisible(),true,'new Rhino send should reopen intake');
  assert.equal(await page.locator('#entryRead').isVisible(),false,'automatic sync should stay in review instead of asking to read again');
  assert.match(await page.textContent('#entrySummary'),/已确认 1 \/ 4/,'unchanged object confirmation should survive automatic sync');
  assert.equal(await page.textContent('#entryConfirmGroup'),'一键确认全部已识别构件（3）');
  await page.click('#entryConfirmGroup');assert.match(await page.textContent('#entrySummary'),/已确认 4 \/ 4/);
  current=makePayload('send-3',[{...floor,material:{id:'glass-1',name:'Clear flat glass',productType:'glass',grade:''}}]);
  await page.evaluate(()=>window.CarbonRhinoLive.poll());await page.waitForFunction(()=>document.querySelector('.entry-badge')?.textContent.includes('1 个对象'));
  assert.match(await page.textContent('#entrySummary'),/已确认 0 \/ 1/,'changed source material must be reviewed again');
  current=makePayload('send-4',[column]);current.source.documentId='new-building-model.3dm';
  await page.evaluate(()=>window.CarbonRhinoLive.poll());await page.waitForFunction(()=>document.querySelector('.entry-badge')?.textContent.includes('1 个对象'));
  assert.equal(await page.locator('#entryRead').isVisible(),true,'a different Rhino document must replace the previous review and start fresh');
  assert.match(await page.textContent('#entryNotice'),/已用新 Rhino 模型替换上一份数据/);
  assert.deepEqual(errors,[]);
  console.log('PASS Rhino live UI: same-document sync preserves unchanged review, while a new Rhino document replaces the old model and starts fresh.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

