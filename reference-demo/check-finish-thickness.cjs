'use strict';
const assert=require('node:assert/strict');
const C=require('./model-core.js');
const Change=require('./change-core.js');
const Review=require('./structural-review-core.js');
const Knowledge=require('../ai-service/structural-knowledge/index.cjs');

const finish={
 id:'finish-1',name:'ext.Finish',type:'finish',layer:'02_Building::Floors::ext.Finish',
 x:0,y:0,z:0,l:.8,w:.6,h:.02,sourceDimensions:[.8,.6,.02],
 material:'stone-natural-polished',quantityRequired:true,
 quantity:{kind:'net-volume',value:.00048,basis:'Rhino net volume'}
};
const control=Change.control(finish);
assert.equal(control.kind,'finish-thickness');
assert.equal(control.value,15);
assert.equal(control.min,5);
assert.equal(control.max,50);

const thicker=Change.resize(finish,30);
const before=C.element(finish);
const after=C.element(thicker);
assert.equal(thicker.finishThickness,.03);
assert.ok(Math.abs(after.value/before.value-2)<1e-12);
assert.match(after.quantityBasis,/候选厚度 30 mm/);
assert.match(after.quantityWarning,/30 mm 候选厚度/);
assert.deepEqual(Change.differences(finish,thicker),['饰面参考厚度 15 → 30 mm']);
const review=Review.assess(finish,thicker);
const retrieval=Knowledge.retrieve({before:{...finish,finishThickness:.015},after:thicker,query:'这次饰面厚度修改有什么影响？'});
assert.equal(review.scope_supported,true);
assert.equal(review.review_scope,'generic_component');
assert.equal(review.section_capacity_applicable,false);
assert.equal(review.facts.thickness.before_mm,15);
assert.equal(review.facts.thickness.after_mm,30);
assert.ok(retrieval.chunks.some(chunk=>chunk.id==='AU-NCC2022-B1D3-PERMANENT-ACTION'));
console.log('PASS imported ext.Finish exposes a 15–50 mm scenario control, scales carbon, and reaches generic Australian load/action RAG without pretending to run the concrete slab solver.');
