'use strict';
const assert=require('node:assert/strict'),Agent=require('./variant-review-agent.cjs'),{createServer}=require('./server.cjs');
const variants=[
 {id:'generated:timber',title:'石材饰面改为木饰面',origin:'程序生成候选',calculation:{before:1000,after:700,delta:-300,percent:-30,known:10,total:12,complete:false,compatible:true},changes:['10 个饰面：天然石材 → 实木'],checks:['核实室外适用性和防火'],evidenceIds:['kbob-materials-v9','limits-v1']},
 {id:'manual-draft',title:'你的手动调整方案',origin:'构件工作台手动调整',calculation:{before:1000,after:900,delta:-100,percent:-10,known:10,total:12,complete:false,compatible:true},changes:['楼板厚度 200 → 180 mm'],checks:['核实承载与刚度'],evidenceIds:['limits-v1']}
];
const answer={preferredId:'generated:timber',summary:'木饰面候选的已知减排更大，但材料功能与项目适用性仍需优先核实。',tradeoffs:[{id:'generated:timber',assessment:'已知碳排较低，需核实防火、耐久和供应。'},{id:'manual-draft',assessment:'改动直接，但涉及楼板尺寸与结构条件。'}],nextStep:'先确认饰面用途和项目性能要求，再决定是否进入深化。',evidenceIds:['kbob-materials-v9','variant-review-scope-v1']};
const config={provider:'deepseek',model:'deepseek-flash',key:'test-only'};
const mock=async(url,options)=>{const request=JSON.parse(options.body),input=JSON.parse(request.input);assert.equal(request.text.format.name,'carbon_variant_review');assert.equal(input.variants.length,2);assert(input.retrieved_evidence.some(item=>item.id==='variant-review-scope-v1'));return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(answer)}]}]})};};
(async()=>{
 const result=await Agent.generate({query:'降低碳排并控制风险',variants},config,mock);assert.equal(result.answer.preferredId,'generated:timber');assert.equal(result.answer.tradeoffs.length,2);
 await assert.rejects(()=>Agent.generate({query:'x',variants},config,async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...answer,preferredId:'invented'})}]}]})})));
 await assert.rejects(()=>Agent.generate({query:'x',variants},config,async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...answer,summary:'这个方案结构安全，可以直接采用。'})}]}]})})));
 const server=createServer(config,mock);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{const base='http://127.0.0.1:'+server.address().port,headers={Origin:'http://127.0.0.1:8613','X-CarbonLoop':'1','Content-Type':'application/json'},health=await(await fetch(base+'/health')).json();assert.equal(health.solutionComparisonVersion,1);const response=await fetch(base+'/compare-solutions',{method:'POST',headers,body:JSON.stringify({query:'降低碳排并控制风险',variants})});assert.equal(response.status,200);assert.equal((await response.json()).answer.preferredId,'generated:timber');}finally{await new Promise(resolve=>server.close(resolve));}
 console.log('PASS multi-variant AI review contract, candidate allowlist, engineering-claim guard, route and health version. Mocked provider.');
})().catch(error=>{console.error(error);process.exitCode=1;});
