const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage(),errors=[],dir=path.join(__dirname,'.test-exports');fs.mkdirSync(dir,{recursive:true});p.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});
 const testUrl=process.env.CARBONLOOP_TEST_URL||'http://127.0.0.1:8513';await require('./test-baseline-route.cjs')(p);
 await p.route('http://127.0.0.1:8515/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({available:false,revision:0})}));
 async function save(selector,name){console.log('Downloading',name);const [d]=await Promise.all([p.waitForEvent('download'),p.click(selector)]);assert.match(d.suggestedFilename(),/\.xlsx$/);await d.saveAs(path.join(dir,name+'.xlsx'));}
 await p.goto(testUrl+'/demo.html');await require('./test-entry-helper.cjs')(p,false);assert.match(await p.textContent('#export'),/Excel/);await save('#export','baseline');
 await p.click('#reportExplore');await p.fill('#dimensionInput','180');await p.locator('#dimensionInput').press('Tab');await p.click('#flowNext');assert.match(await p.textContent('#flowNext'),/Excel/);await save('#flowNext','comparison');
 await p.goto(testUrl+'/dashboard.html');await p.waitForFunction(()=>window.CarbonLoopData);await p.fill('#search','PORR_18');await save('#exportBtn','cases');assert.ok((await p.evaluate(()=>CarbonLoopData.snapshot())).filtered.length>0);
 await p.goto(testUrl+'/index.html');await save('#downloadResult','timber');
 // User-controlled text must remain a string, never an Excel formula.
 const bytes=await p.evaluate(async()=>Array.from(new Uint8Array(await CarbonExcel.build([{name:'安全测试',rows:[['内容','数字'],['=1+1',0],['中文 & <测试>',null]]}]).arrayBuffer())));fs.writeFileSync(path.join(dir,'literal.xlsx'),Buffer.from(bytes));
 assert.deepEqual(errors,[]);console.log('PASS browser downloads: baseline, comparison, missing-data scope, filtered cases, timber, literal text safety.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
