'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],posts=[];let imageCap=1;
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('http://127.0.0.1:8514/**',async r=>{
   if(r.request().url().endsWith('/health'))return r.fulfill({json:{configured:true,changeReviewVersion:5,rulebookVersion:'au-early-design-0.1.0',structuralRagVersion:'au-early-design-rag-0.1.0',solutionVersion:1,solutionImagesVersion:imageCap,provider:'DeepSeek',model:'deepseek-flash'}});
   assert(r.request().url().endsWith('/solutions'));posts.push(r.request().postDataJSON());
   return r.fulfill({json:{mode:'live_ai',imageUsed:true,answer:{preferredId:'material-S01',reason:'根据当前构件与截图标注，先核实不改尺寸的材料路径。',nextStep:'核实候选材料性能。'}}});
  });
  await p.goto('http://127.0.0.1:8513/demo.html');await p.click('#entryRead');await p.click('#entryConfirmGroup');await p.click('#entryContinue');await p.click('#reportExplore');
  const png=await p.locator('#model').screenshot();
  await p.check('#solutionConsent');
  await p.setInputFiles('#solutionImage',{name:'model.png',mimeType:'image/png',buffer:png});
  await p.waitForFunction(()=>!CarbonSolutionAttachment.isLoading()&&!!CarbonSolutionAttachment.getData());
  assert.equal(await p.isChecked('#solutionConsent'),false);assert(await p.isVisible('#solutionImageThumb'));
  await p.click('#solutionFind');assert.equal(posts.length,0);
  await p.check('#solutionConsent');await p.click('#solutionFind');await p.waitForFunction(()=>!document.getElementById('solutionAdvice').hidden);
  assert.equal(posts.length,1);assert.match(posts[0].image,/^data:image\/png;base64,/);
  assert.match(await p.textContent('#solutionReason'),/截图/);
  await p.screenshot({path:'solution-image-desktop.png',fullPage:true});
  await p.click('#solutionImageRemove');assert.equal(await p.isVisible('#solutionAdvice'),false);assert.equal(await p.isChecked('#solutionConsent'),false);
  assert.equal(await p.evaluate(()=>CarbonSolutionAttachment.getData()),null);
  // Simulate an explicit user paste, without reading the system clipboard.
  await p.evaluate(base64=>{const bytes=Uint8Array.from(atob(base64),x=>x.charCodeAt(0)),dt=new DataTransfer();dt.items.add(new File([bytes],'pasted.png',{type:'image/png'}));document.getElementById('solutionGoal').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:dt}));},png.toString('base64'));
  await p.waitForFunction(()=>!CarbonSolutionAttachment.isLoading()&&!!CarbonSolutionAttachment.getData());
  assert(await p.isVisible('#solutionImageThumb'));assert.equal(posts.length,1);
  imageCap=0;await p.click('#solutionReconnect');await p.check('#solutionConsent');await p.click('#solutionFind');
  assert.equal(posts.length,1);assert.match(await p.textContent('#solutionStatus'),/尚未发送截图/);
  await p.setInputFiles('#solutionImage',{name:'too-large.png',mimeType:'image/png',buffer:Buffer.alloc(2*1024*1024+1)});
  assert.match(await p.textContent('#solutionImageStatus'),/2 MB/);assert.equal(await p.evaluate(()=>CarbonSolutionAttachment.getData()),null);
  await p.setInputFiles('#solutionImage',{name:'not-image.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
  assert.equal(await p.evaluate(()=>CarbonSolutionAttachment.getData()),null);
  for(const width of [768,390]){await p.setViewportSize({width,height:1000});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);console.log('PASS image upload, explicit paste, preview, consent reset, multimodal request, removal invalidation, old bridge guard, size/type validation, responsive layout. Mocked AI only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
