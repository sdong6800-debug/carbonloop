const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://127.0.0.1:8515/rhino-intake/latest',route=>route.fulfill({status:200,contentType:'application/json',body:'{"available":false}'}));
  await require('./test-baseline-route.cjs')(page);
  await page.goto('http://127.0.0.1:8513/demo.html');
  await page.click('#entryRead');

  assert.match(await page.textContent('.entry-component-table caption'),/构件类型.*材料/);
  assert.equal(await page.locator('#entryConfirmGroup').isVisible(),true);
  assert.equal(await page.textContent('#entryConfirmGroup'),'一键确认全部已识别构件（5）');
  assert.match(await page.textContent('#entryRecognition'),/^构件：楼板 ｜ 材料：/);

  await page.click('#entryConfirmGroup');
  assert.match(await page.textContent('#entrySummary'),/已确认 5 \/ 5/);

  await page.reload();
  await page.click('#entryRead');
  await page.click('[data-row="C01"]');
  assert.equal(await page.isChecked('#entryApplySimilar'),true);
  assert.equal(await page.textContent('#entryConfirmOne'),'确认这 4 个同类构件');
  await page.click('#entryConfirmOne');
  assert.match(await page.textContent('#entrySummary'),/已确认 4 \/ 5/);
  assert.deepEqual(errors,[]);
  console.log('PASS intake classification labels and bulk confirmation');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
