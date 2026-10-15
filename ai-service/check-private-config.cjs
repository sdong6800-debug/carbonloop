'use strict';
const assert=require('node:assert/strict'),{Readable}=require('node:stream'),{spawn}=require('node:child_process'),{once}=require('node:events'),{privateConfig,readPrivateConfig,createServer,generate}=require('./server.cjs'),AI=require('../reference-demo/ai-core.js'),M=require('../reference-demo/material-intake.js');
(async()=>{
 const config={provider:'deepseek',key:'sk-test-only-never-real-123456',model:'deepseek-flash'};
 assert.deepEqual(privateConfig(JSON.stringify(config)),config);
 for(const value of [{...config,key:'sk-****'}, {...config,model:'invented'}, {...config,provider:'unknown'}])assert.throws(()=>privateConfig(JSON.stringify(value)));
 await assert.rejects(()=>readPrivateConfig(Readable.from(['x'.repeat(4097)])));
 assert.deepEqual(await readPrivateConfig(Readable.from([JSON.stringify(config)])),config);
 const elements=M.sample().filter(e=>e.floor==='1F').map(e=>({...e,...M.match(e.materialRecord)})),answer=AI.offline(elements);
 const mock=async(url,opts)=>{assert.equal(url,'https://api.deepseek.com/responses');assert.equal(JSON.parse(opts.body).reasoning.effort,'none');return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(answer)}]}]})};};
 await generate({query:'研究配方',elements},config,mock);
 const server=createServer(config,mock);await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  const base='http://127.0.0.1:'+server.address().port,health=await(await fetch(base+'/health')).json();assert.equal(health.networkVerified,false);assert.equal(JSON.stringify(health).includes(config.key),false);
  const response=await fetch(base+'/suggest',{method:'POST',headers:{Origin:'http://127.0.0.1:8513','Content-Type':'application/json','X-CarbonLoop':'1'},body:JSON.stringify({query:'研究配方',elements})});assert.equal(response.status,200);assert.equal((await(await fetch(base+'/health')).json()).networkVerified,true);
 }finally{await new Promise(r=>server.close(r));}
 // Invalid stdin never exposes its content, even in diagnostics.
 const child=spawn(process.execPath,[require.resolve('./server.cjs'),'--config-stdin'],{stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);const done=once(child,'close');child.stdin.end(JSON.stringify({...config,model:'invalid'}));const [code]=await done;assert.equal(code,1);assert.equal(output.includes(config.key),false);
 console.log('PASS private configuration validation, bounded stdin, no secret in diagnostics/health, DeepSeek bounded output settings, mocked verified status. No real API calls.');
})().catch(e=>{console.error(e);process.exitCode=1});
