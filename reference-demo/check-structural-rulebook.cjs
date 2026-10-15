const assert=require('node:assert/strict');
const R=require('./structural-rulebook.js');
const before={id:'S01',type:'slab',material:'concrete-cast',factorId:'01.002',x:0,y:0,z:3,l:6,w:4,h:.2};

const thinner=R.evaluate(before,{...before,h:.18});
assert.equal(thinner.version,'au-early-design-0.1.0');
assert.equal(thinner.verdict,'not_determined');
assert.equal(thinner.canAdopt,false);
assert(thinner.rules.some(x=>x.ruleId==='ED-SLAB-THINNER'));
assert(!thinner.rules.some(x=>x.ruleId==='ED-SLAB-THICKER'));
assert(Math.abs(thinner.rules.find(x=>x.ruleId==='AU-PERMANENT-ACTION-DELTA').value+10)<1e-9);
assert(thinner.sources.some(x=>x.id==='ncc-b1d2'));
assert(thinner.sources.some(x=>x.id==='ncc-b1d3'));
assert(thinner.sources.some(x=>x.id==='ncc-b1d4'));

const thicker=R.evaluate(before,{...before,h:.3});
assert(Math.abs(thicker.rules.find(x=>x.ruleId==='AU-PERMANENT-ACTION-DELTA').value-50)<1e-9);
assert(thicker.rules.some(x=>x.ruleId==='ED-SLAB-THICKER'));

const material=R.evaluate(before,{...before,material:'concrete-precast',factorId:'other'});
assert(material.rules.some(x=>x.ruleId==='ED-MATERIAL-EQUIVALENCE'));
assert.equal(material.rules.find(x=>x.ruleId==='AU-PERMANENT-ACTION-DELTA').state,'needs_input');

const moved=R.evaluate(before,{...before,x:1});
assert(moved.rules.some(x=>x.ruleId==='ED-LOAD-PATH'));
assert.equal(moved.canAdopt,false);
assert(!JSON.stringify(R.rules).match(/180\s*mm.*safe|安全厚度|最低厚度/));
console.log('PASS rule retrieval, self-weight delta, source traceability and no fabricated safe thickness.');
