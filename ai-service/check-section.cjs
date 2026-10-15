'use strict';
const assert=require('node:assert/strict'),E=require('./section-engine.cjs'),S=require('../reference-demo/structural-screening-core.js');
async function run(){
 const before={id:'TEST-ONLY',type:'slab',material:'concrete',x:0,y:0,z:3,l:6,w:4,h:.2},after={...before,h:.3};
 const p={method:'rectangular-section-pure-bending',reinforcement_tracking:'fixed-bottom-cover',source:'Synthetic automated test, NOT actual project',strip_width_mm:1000,concrete_fc_mpa:32,steel_fy_mpa:500,bottom_cover_mm:30,bottom_bars:[100,300,500,700,900].map(x=>({diameter_mm:12,x_mm:x}))};
 const sig=Object.fromEntries(['strip_width_mm','concrete_fc_mpa','steel_fy_mpa','bottom_cover_mm','bottom_bars'].map(k=>[k,p[k]]));
 p.design_actions=Object.fromEntries([['before',before,20],['after',after,1000]].map(([label,e,moment])=>[label,{element_id:e.id,section_signature:sig,geometry_m:['x','y','z','l','w','h'].map(k=>e[k]),source:'Synthetic test load, NOT actual analysis',moment_knm_for_strip:moment}]));
 assert.equal((await E.calculate(before,after)).status,'missing_input');
 assert(Math.abs(S.assess(before,after).rows.find(x=>x.id==='self_weight').value-50)<1e-9);
 const result=await E.calculate(before,after,p);
 assert.equal(result.status,'calculated',JSON.stringify(result));assert.equal(result.version,'0.8.0');assert.equal(result.can_adopt,false);
 assert(result.results[1].capacity_knm>result.results[0].capacity_knm);
 assert.equal(result.results[1].status,'capacity_exceeded');
 // Independent rectangular stress-block calculation for a lightly reinforced strip.
 const As=5*Math.PI*12*12/4,alpha=Math.max(.85-.0015*32,.67),gamma=Math.max(.97-.0025*32,.67),d=200-30-6;
 const neutral=As*500/(alpha*32*1000*gamma),nominal=As*500*(d-gamma*neutral/2)/1e6;
 assert(Math.abs(result.results[0].unfactored_capacity_knm/nominal-1)<.02);
 const stale=structuredClone(p);stale.design_actions.after.geometry_m[5]=.2;
 assert.equal((await E.calculate(before,after,stale)).results[1].status,'missing_design_action');
 const invalid=structuredClone(p);invalid.bottom_bars[1].x_mm=100;
 assert.equal((await E.calculate(before,after,invalid)).status,'invalid_input_or_calculation');
 const changed={...after,x:2};assert.equal((await E.calculate(before,changed,p)).status,'unsupported_change');
 const {createServer}=require('./server.cjs'),server=createServer({});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  const url='http://127.0.0.1:'+server.address().port,headers={Origin:'http://127.0.0.1:8513','X-CarbonLoop':'1','Content-Type':'application/json'};
  const response=await fetch(url+'/section-check',{method:'POST',headers,body:JSON.stringify({before,after,sectionInput:p})});
  assert.equal(response.status,200);assert.equal((await response.json()).results[1].status,'capacity_exceeded');
  assert.equal((await (await fetch(url+'/health')).json()).networkVerified,false);
  assert.equal((await fetch(url+'/section-check',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{}'})).status,403);
 } finally { await new Promise(r=>server.close(r)); }
 console.log('PASS section engine: real library, independent bending benchmark, overload, stale demand, invalid bars, restricted scope');
 console.log(JSON.stringify({testOnly:true,results:result.results}));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
