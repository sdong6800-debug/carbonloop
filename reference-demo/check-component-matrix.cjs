'use strict';
const assert=require('node:assert/strict');
const Change=require('./change-core.js');
const Carbon=require('./model-core.js');
const Review=require('./structural-review-core.js');
const Solutions=require('./solution-core.js');
const Knowledge=require('../ai-service/structural-knowledge/index.cjs');
const {normalize}=require('../ai-service/server.cjs');

const fixtures=[
 ['slab','concrete-cast',[6,4,.2]],
 ['finish','stone-natural-polished',[4,3,.015]],
 ['beam','timber-glulam',[6,.3,.5]],
 ['column','concrete-cast',[.4,.4,3]],
 ['wall','masonry-clay',[5,.15,3]],
 ['foundation','concrete-cast',[2,2,.6]],
 ['roof','timber-clt',[6,4,.24]],
 ['glazing','glass',[3,.02,2.8]],
 ['mullion','aluminium',[.08,.12,3]],
 ['door','timber-solid',[.05,1,2.1]],
 ['stair','concrete-cast',[4,1.2,2]],
 ['other','gypsum',[2,.1,2.6]]
].map(([type,material,[l,w,h]],index)=>({id:`${type}-${index}`,name:type,type,material,x:0,y:0,z:0,l,w,h}));

for(const item of fixtures){
 const policy=Change.policy(item);
 assert.equal(policy.materialEditable,true,`${item.type} should allow a material scenario`);
 let candidate;
 const control=Change.control(item);
 if(control.kind){
  const next=Math.min(control.max,control.value+control.step);
  candidate=Change.resize(item,next===control.value?Math.max(control.min,control.value-control.step):next);
 }else candidate=Change.changeMaterial(item,item.material==='concrete-cast'?'timber-solid':'concrete-cast');
 const review=Review.assess(item,candidate);
 const retrieval=Knowledge.retrieve({before:item,after:candidate,query:`研究 ${item.type} 修改影响`});
 assert.equal(review.scope_supported,true,`${item.type} should enter review`);
 assert.notEqual(review.screening.status,'outside_scope',`${item.type} must not be rejected as non-slab`);
 assert.ok(retrieval.chunks.length>0,`${item.type} should retrieve generic RAG evidence`);
 const normalized=normalize({query:'',elements:[item]}).elements[0];
 assert.equal(normalized.type,item.type,`${item.type} should pass AI service normalization`);
 if(control.kind){
  const lower=Math.max(control.min,control.value-control.step*2);
  if(lower<control.value){
   const report=Solutions.calculate([item],{scope:'selected',selectedId:item.id,allowMaterial:false,allowDimension:true,minMm:lower,maxMm:control.value});
   assert.ok(report.candidates.length>0,`${item.type} should generate a dimension carbon candidate`);
   assert.equal(report.options.dimensionKind,control.kind);
  }
 }
}

const net={id:'net-1',name:'roof',type:'roof',material:'timber-clt',x:0,y:0,z:0,l:4,w:3,h:.2,quantity:{kind:'net-volume',material:'timber-clt',value:2,basis:'Rhino net volume'}};
const swapped=Change.changeMaterial(net,'concrete-cast');
assert.equal(swapped.quantity.material,'concrete-cast');
assert.equal(Carbon.element(swapped).error,null);
const steel={id:'steel-1',name:'column',type:'column',material:'steel-section',x:0,y:0,z:0,l:.4,w:.4,h:3,quantity:{kind:'i-section',material:'steel-section',dimensions:[.4,.4,3],b:.4,d:.4,tf:.02,tw:.012}};
assert.equal(Change.policy(steel).materialEditable,false);
assert.throws(()=>Change.changeMaterial(steel,'timber-glulam'));

console.log('PASS all 12 Rhino component categories enter material improvement and generic RAG; every safely interpretable dimension generates candidates, net quantities remain consistent, and I-section misuse is blocked.');
