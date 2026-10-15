'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto('http://127.0.0.1:8513/demo.html');
  await page.waitForFunction(()=>document.querySelector('.entry-badge')?.textContent.includes('Rhino 已连接'));
  await page.waitForFunction(()=>!document.querySelector('#entryRead')?.disabled);
  const connected=(await page.locator('.page-heading .status').innerText()).trim();
  await page.click('#entryRead');
  const checked=await page.isChecked('#entryApplySimilar');
  const button=(await page.textContent('#entryConfirmOne')).trim();
  const recognition=(await page.textContent('#entryRecognition')).trim();
  const match=button.match(/^确认这 (\d+) 个同类构件$/);
  assert.equal(checked,true,'real Rhino repeated group should default to bulk review');
  assert.ok(match&&Number(match[1])>1,'real Rhino review should not fall back to one object');
  assert.match(recognition,/材料：抛光天然石材/);
  await page.click('#entryConfirmOne');
  await page.check('#entryPartial');
  await page.click('#entryContinue');
  await page.waitForFunction(()=>document.querySelector('#reportStages')?.textContent.trim().length>0);
  const stage=(await page.locator('#reportStages').textContent()).replace(/\s+/g,' ');
  assert.match(stage,/已计入 565 \/ 882 个构件/);
  console.log(JSON.stringify({connected,recognition,button,stage},null,2));
  console.log('PASS current Rhino intake opens on a repeated stone group, confirms it in bulk, and calculates all 565 matched objects.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
