(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports,C=node?require('./model-core.js'):root.ModelCore,AI=node?require('./ai-core.js'):root.CarbonAI;
 const purpose='帮助建筑师在设计前期，从当前模型出发，寻找满足设计约束的低碳改进方案。';
 const Screening=node?require('./structural-screening-core.js'):root.StructuralScreening;
 function options(o={},elements){
  const scope=o.scope==='selected'?'selected':'all';
  if(scope==='selected'&&!elements.some(e=>e.id===o.selectedId))throw Error('请选择本次研究的构件。');
  const out={scope,selectedId:scope==='selected'?o.selectedId:null,allowMaterial:o.allowMaterial!==false,allowThickness:o.allowThickness===true};
  if(out.allowThickness){
   const slab=elements.find(e=>e.id===o.selectedId);
   if(!slab||slab.type!=='slab'||!['concrete','concrete-cast','concrete-precast'].includes(slab.material)||slab.quantity)throw Error('厚度探索仅支持所选实心混凝土楼板。');
   const min=Number(o.minMm),max=Number(o.maxMm);
   if(!Number.isFinite(min)||!Number.isFinite(max)||min<60||max>1000||min>max)throw Error('请填写有效探索区间（60–1000 mm 是本工具数值范围，不是规范允许值）。');
   out.selectedId=o.selectedId;out.minMm=min;out.maxMm=max;
  }
  return out;
 }
 function calculate(elements,o={}){
  const opts=options(o,elements),base=C.calculate(elements),pool=opts.scope==='selected'?elements.filter(e=>e.id===opts.selectedId):elements;
  const candidates=[],seen=new Set(),excluded=[];
  function add(id,title,changes,kind){
   const next=C.clone(elements);
   for(const change of changes){const e=next.find(x=>x.id===change.elementId);if(change.factorId)e.factorId=change.factorId;if(change.h)e.h=change.h;}
   const key=JSON.stringify(next);if(seen.has(key))return;seen.add(key);
   const comparison=C.compare(elements,next),affected=changes.map(x=>x.elementId);
   const before=elements.filter(e=>affected.includes(e.id)).map(C.element),after=next.filter(e=>affected.includes(e.id)).map(C.element);
   if(before.some(x=>x.error)||after.some(x=>x.error))return;
   const saved=before.reduce((s,x)=>s+x.value,0)-after.reduce((s,x)=>s+x.value,0);
   if(saved<=.0001)return;
   candidates.push({id,title,kind,changes,elements:next,affected,savedKg:saved,scopeBefore:comparison.compatible?comparison.A.value:null,scopeAfter:comparison.compatible?comparison.B.value:null,scopePercent:comparison.compatible?-comparison.percent:null,scopeComplete:comparison.compatible,
    status:'research_only',canAdopt:false,structuralScreening:changes.map(change=>({elementId:change.elementId,result:Screening.assess(elements.find(e=>e.id===change.elementId),next.find(e=>e.id===change.elementId))})),
    checks:kind==='material'?['核实候选混凝土的强度、耐久与施工性能','核实澳洲项目当地供应及适用 EPD','候选密度不同，需要重新核实自重与受力']:['需要配筋、强度和修改后的设计内力','需要核验抗弯、冲切、变形及构造'],
    evidenceIds:kind==='material'?['kbob-concrete-v9','limits-v1']:['limits-v1'],
    basis:kind==='material'?'KBOB 01.002.13 · 瑞士配方参考，非已确认等效产品':'用户指定的探索区间，非规范允许厚度'});
  }
  if(opts.allowMaterial){
   const eligible=AI.eligible(pool);
   for(const e of eligible.slice(0,2))add('material-'+e.id,'只研究 '+e.id+' 的混凝土配方',[{elementId:e.id,factorId:AI.alternative}],'material');
   if(eligible.length>1)add('material-all','同时研究 '+eligible.length+' 个混凝土构件的配方',eligible.map(e=>({elementId:e.id,factorId:AI.alternative})),'material');
  }
  if(opts.allowThickness){
   const slab=elements.find(e=>e.id===opts.selectedId),min=opts.minMm,max=opts.maxMm;
   const values=[...new Set([min,Math.round((min+max)/2*10)/10,max])];
   for(const mm of values)add('thickness-'+slab.id+'-'+mm,slab.id+' 厚度 '+Math.round(slab.h*1000)+' → '+mm+' mm',[{elementId:slab.id,h:mm/1000}],'thickness');
  }
  for(const e of pool)if(!AI.eligible([e]).length&&!(opts.allowThickness&&e.id===opts.selectedId))excluded.push({id:e.id,reason:C.element(e).error||'当前没有已接入且可比较的替换选项'});
  candidates.sort((a,b)=>b.savedKg-a.savedKg||a.affected.length-b.affected.length);
  return {purpose,options:opts,base:{value:base.value,known:base.known,total:base.total,complete:base.complete},candidates,excluded,
   locks:['位置与柱网不变','构件数量不变','未授权的尺寸和材料不变'],
   boundary:'仅材料生产＋处置；候选按同一范围复算。参考数据库：瑞士 KBOB，不等于澳洲项目产品。',
   optimality:'当前已接入数据与用户授权范围内的有限候选比较；不是全局最优，也不是结构安全结论'};
 }
 function apply(elements,opts,id){const report=calculate(elements,opts),candidate=report.candidates.find(x=>x.id===id);if(!candidate)throw Error('候选方案已失效，请重新寻找。');return candidate;}
 const api={purpose,options,calculate,apply};if(node)module.exports=api;else root.CarbonSolutions=api;
})(typeof window!=='undefined'?window:globalThis);
