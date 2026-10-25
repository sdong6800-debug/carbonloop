'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const root=__dirname;
 const server=http.createServer((req,res)=>{
  const relative=new URL(req.url,'http://localhost').pathname;
  const target=path.resolve(root,'.'+relative);
  if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(target,(error,body)=>{if(error){res.writeHead(404);res.end();return;}
   const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'}[path.extname(target)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime+'; charset=utf-8'});res.end(body);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/rhino-intake/latest',route=>route.fulfill({json:{available:false}}));
  await page.route('http://127.0.0.1:8514/**',route=>route.fulfill({json:{configured:false}}));
  await page.goto(`http://127.0.0.1:${server.address().port}/demo.html`);
  await page.waitForFunction(()=>!!window.ModelEntry);
  const make=(confirmed=true,material='timber-solid')=>({schemaVersion:'carbonloop.rhino.intake/1.0.0',source:{host:'Rhino',mode:'installed-plugin',documentId:'review-browser-test',unitSystem:'Meters',pluginVersion:'0.3.0',transmissionId:Math.random().toString()},selection:{mode:'selection'},objects:[{id:'slab-review',name:'floor slab',floor:'1F',layer:'Floors::ext.Finish',typeHint:'slab',typeInference:{source:'CarbonLoop.Type',basis:'Rhino 用户确认',confidence:1},geometry:{origin:[0,0,0],dimensions:[6,4,.2]},material:{id:'mat-1',name:'timbre',originalName:'timbre',productType:material,review:{confirmed,version:'rhino-review-1'},inference:{source:'rhino-user-confirmed',basis:'Rhino 用户确认'}},quantity:{kind:'net-volume',value:4.8},quantityRequired:true}]});
  await page.evaluate(payload=>{
   window.ModelEntry.acceptRhino(payload);
   window.ModelEntry.open({onDone:(elements,metadata)=>{window.reviewTestResult={elements,metadata};},onCancel:()=>{}});
  },make());
  await page.click('#entryRead');
  assert.match(await page.textContent('#entrySummary'),/已确认 1 \/ 1/);
  assert.equal(await page.inputValue('#entryType'),'slab');
  assert.equal(await page.inputValue('#entryMaterial'),'timber-solid');
  assert.equal(await page.isDisabled('#entryContinue'),false);
  await page.click('#entryContinue');
  const result=await page.evaluate(()=>window.reviewTestResult);
  assert.equal(result.metadata.confirmed_count,1);assert.equal(result.metadata.calculable_count,1);
  assert.equal(result.elements[0].materialRecord.originalName,'timbre');
  // Seed an older browser mapping that conflicts with the next explicit Rhino review.
  await page.evaluate(()=>{
   const key=JSON.stringify(['Floors::ext.Finish','mat-1','timbre','']);
   localStorage.setItem('carbonloop.rhino.semantic-mappings.v2',JSON.stringify({[key]:{type:'column',material:'glass'}}));
  });
  await page.reload();await page.waitForFunction(()=>!!window.ModelEntry);
  await page.evaluate(payload=>{
   window.ModelEntry.acceptRhino(payload);
   window.ModelEntry.open({onDone:()=>{},onCancel:()=>{}});
  },make());await page.click('#entryRead');
  assert.equal(await page.inputValue('#entryType'),'slab');assert.equal(await page.inputValue('#entryMaterial'),'timber-solid');
  await page.evaluate(payload=>window.ModelEntry.acceptRhino(payload),make(true,'unknown'));
  assert.equal(await page.inputValue('#entryMaterial'),'unknown');
  assert.match(await page.textContent('#entrySummary'),/已确认 0 \/ 1/);
  assert.deepEqual(errors,[]);
  console.log('PASS browser: Rhino confirmations imported, no duplicate material confirmation, old browser mapping cannot override Rhino, explicit unknown stays pending');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
