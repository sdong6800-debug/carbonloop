'use strict';
const assert=require('node:assert/strict');
const K=require('./structural-knowledge/index.cjs');
const suite=require('./structural-knowledge/eval-cases.json');

const base={id:'S01',type:'slab',material:'concrete-cast',x:0,y:0,z:3,l:6,w:4,h:.2};
let passed=0;
for(const item of suite.cases){
 const before={...base,...(item.before||{})},after={...before,...(item.after||{})};
 const result=K.retrieve({before,after,project:item.project||{},query:'这次修改能不能用，下一步查什么？'});
 if(item.status)assert.equal(result.status,item.status,item.id);
 else assert.equal(result.status,'retrieved',item.id);
 const ids=result.chunks.map(chunk=>chunk.id);
 for(const id of item.include||[])assert(ids.includes(id),item.id+' should include '+id);
 for(const id of item.exclude||[])assert(!ids.includes(id),item.id+' should exclude '+id);
 if(item.applicability)assert(result.chunks.length&&result.chunks.every(chunk=>chunk.project_applicability===item.applicability),item.id+' applicability');
 for(const chunk of result.chunks){
  assert(['public_web_paraphrase','project_authored'].includes(chunk.licence_status),item.id+' approved licence');
  assert(chunk.source_id&&chunk.locator&&chunk.document_version,item.id+' traceable metadata');
 }
 passed++;
}

const cited=K.retrieve({before:base,after:{...base,h:.27}});
assert.equal(K.validateCitations(['CL-RULE-THICKER-SLAB'],cited),true);
assert.throws(()=>K.validateCitations(['INVENTED-CLAUSE'],cited));
assert.throws(()=>K.validateCitations([],cited));
console.log('PASS '+passed+' structural RAG retrieval evaluations, jurisdiction/version gates, licence metadata and citation validation. No external model called.');
