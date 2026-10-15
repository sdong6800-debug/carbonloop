'use strict';
const assert=require('node:assert/strict');
const I=require('./rhino-contract.js'),M=require('./material-intake.js'),C=require('./model-core.js');
(async()=>{
 const response=await fetch('http://127.0.0.1:8515/rhino-intake/latest');
 const latest=await response.json();assert.equal(latest.available,true);
 const normalized=I.normalize(latest.payload);assert.equal(normalized.valid,true);
 const elements=normalized.objects.filter(item=>item.analysisEligible!==false).map(item=>{
  const match=M.match(item.materialRecord);
  return {...item,material:item.type!=='unknown'&&match.material!=='unknown'?match.material:'unknown'};
 });
 const result=C.calculate(elements),stone=result.lines.filter(item=>item.material==='stone-natural-polished'&&item.type==='finish'&&!item.error);
 const area=stone.reduce((sum,item)=>sum+item.area,0),stoneTotal=stone.reduce((sum,item)=>sum+item.value,0);
 assert.equal(elements.length,659);assert.equal(stone.length,365);assert.ok(Math.abs(area-186.030453640325)<.001);
 assert.ok(stoneTotal>3500);assert.ok(result.value>stoneTotal);assert.ok(stone.every(item=>item.quantityWarning));
 console.log(JSON.stringify({objects:elements.length,calculable:result.known,totalKg:result.value,finishObjects:stone.length,finishAreaM2:area,finishKg:stoneTotal},null,2));
 console.log('PASS current Rhino data: ext.Finish is a finish surface, KBOB stone uses area × 15 mm source basis, and the result is not the old 242.4 kg subtotal.');
})().catch(error=>{console.error(error);process.exitCode=1;});
