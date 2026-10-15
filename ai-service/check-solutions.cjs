'use strict';
const assert=require('node:assert/strict'),Core=require('../reference-demo/solution-core.js'),C=require('../reference-demo/model-core.js'),Agent=require('./solution-agent.cjs'),{normalize,createServer}=require('./server.cjs');
(async()=>{
 const elements=C.sample(),snapshot=JSON.stringify(elements);
 const report=Core.calculate(elements,{});
 assert.equal(report.candidates.length,3);assert.equal(report.candidates[0].affected.length,5);
 for(const c of report.candidates){assert.equal(c.canAdopt,false);assert(c.savedKg>0);for(let i=0;i<elements.length;i++)for(const k of ['x','y','z','l','w','h'])assert.equal(c.elements[i][k],elements[i][k]);assert(Math.abs(c.savedKg-(C.calculate(elements).value-C.calculate(c.elements).value))<1e-7);}
 const selected=Core.calculate(elements,{scope:'selected',selectedId:'S01'});assert.equal(selected.candidates.length,1);
 const dims=Core.calculate(elements,{scope:'selected',selectedId:'S01',allowMaterial:false,allowThickness:true,minMm:180,maxMm:200});
 assert.equal(dims.candidates.length,2);assert.equal(dims.candidates[0].changes[0].h,.18);assert(dims.candidates.every(c=>c.status==='research_only'));
 assert.equal(JSON.stringify(elements),snapshot);
 assert.throws(()=>Core.calculate(elements,{selectedId:'C01',allowThickness:true,minMm:180,maxMm:200}));
 assert.throws(()=>Core.calculate(elements,{selectedId:'S01',allowThickness:true,minMm:10,maxMm:200}));
 const incomplete=Core.calculate([...elements,{...elements[0],id:'unknown',material:'unknown'}],{});assert.equal(incomplete.candidates[0].scopeComplete,false);assert(Number.isFinite(incomplete.candidates[0].scopePercent));assert(Number.isFinite(incomplete.candidates[0].scopeBefore));
 const mullion={id:'M01',name:'幕墙框',type:'mullion',material:'aluminium',x:0,y:0,z:0,l:.08,w:.05,h:3,quantityRequired:true,quantity:{kind:'net-volume',material:'aluminium',dimensions:[.08,.05,3],value:.0012,basis:'Rhino 净体积'}};
 const genericMaterial=Core.calculate([mullion],{});assert(genericMaterial.candidates.some(c=>c.changes.some(change=>change.material==='steel-section')));assert(genericMaterial.candidates.every(c=>c.status==='research_only'&&c.canAdopt===false));
 const stone={id:'F01',name:'楼地面饰面',type:'finish',material:'stone-natural-polished',x:0,y:0,z:0,l:2,w:2,h:.015,quantityRequired:true,quantity:{kind:'net-volume',material:'stone-natural-polished',value:.06,basis:'Rhino 净体积'}};
 const stoneMaterial=Core.calculate([stone],{});assert(stoneMaterial.candidates.some(c=>c.changes.some(change=>change.material==='timber-solid')));assert(stoneMaterial.candidates.every(c=>c.checks.some(text=>text.includes('防滑'))));
 const config={provider:'deepseek',model:'deepseek-flash',key:'test-only'},body={elements,options:{},query:'保持几何，减少碳排'};
 let called=0;
 const mocked=async(url,opts)=>{called++;const payload=JSON.parse(opts.body),input=JSON.parse(payload.input);assert(input.candidates.length===3);assert(input.retrieved_evidence.length);return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({preferredId:report.candidates[0].id,reason:'优先核实不改尺寸的配方路径，先确认材料性能。',nextStep:'核实当地可用的同用途产品及性能资料。',evidenceIds:['kbob-concrete-v9']})}]}]})};};
 const result=await Agent.generate(body,config,normalize,mocked);assert.equal(result.mode,'live_ai');assert.equal(called,1);
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOuoAAAAASUVORK5CYII=';
 const multimodal=await Agent.generate({...body,image},config,normalize,async(url,options)=>{
  const request=JSON.parse(options.body);assert.equal(request.input[0].content[1].image_url,image);
  assert.match(JSON.parse(request.input[0].content[0].text).image_role,/不能据此补造工程数据/);
  return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result.answer)}]}]})};
 });
 assert.equal(multimodal.imageUsed,true);assert(!JSON.stringify(multimodal).includes('base64'));
 await assert.rejects(()=>Agent.generate({...body,image:'https://example.com/private.png'},config,normalize,mocked));
 await assert.rejects(()=>Agent.generate({...body,image},{...config,model:'deepseek-v4-pro'},normalize,mocked));
 const invalid=async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...result.answer,preferredId:'fabricated'})}]}]})});
 await assert.rejects(()=>Agent.generate(body,config,normalize,invalid));
 const server=createServer(config,mocked);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const url='http://127.0.0.1:'+server.address().port,headers={Origin:'http://127.0.0.1:8513','X-CarbonLoop':'1','Content-Type':'application/json'};
 assert.equal((await (await fetch(url+'/health')).json()).solutionVersion,2);
 const response=await fetch(url+'/solutions',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(response.status,200);assert.equal((await response.json()).mode,'live_ai');
 assert.equal((await fetch(url+'/solutions',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{}'})).status,403);
 }finally{await new Promise(r=>server.close(r));}
 console.log('PASS finite candidates, locked geometry, explicit thickness exploration, missing coverage, immutable baseline, recalculation, grounded AI ids, API and origin guards. Mocked provider.');
})().catch(e=>{console.error(e);process.exitCode=1;});
