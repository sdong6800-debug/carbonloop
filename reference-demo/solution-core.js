(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports,C=node?require('./model-core.js'):root.ModelCore,AI=node?require('./ai-core.js'):root.CarbonAI,Change=node?require('./change-core.js'):root.CarbonChange;
 const purpose='帮助建筑师在设计前期，从当前模型出发，寻找满足设计约束的低碳改进方案。';
 const Screening=node?require('./structural-screening-core.js'):root.StructuralScreening;
 function options(o={},elements){
  const scope=o.scope==='selected'?'selected':'all';
  if(scope==='selected'&&!elements.some(e=>e.id===o.selectedId))throw Error('请选择本次研究的构件。');
  const allowDimension=o.allowDimension===true||o.allowThickness===true;
  const out={scope,selectedId:scope==='selected'||allowDimension?o.selectedId:null,allowMaterial:o.allowMaterial!==false,allowDimension,allowThickness:allowDimension};
  if(out.allowThickness){
   const selected=elements.find(e=>e.id===o.selectedId),control=selected&&Change.control(selected);
   if(!selected)throw Error('请先选择要研究尺寸的构件。');
   if(!control?.kind)throw Error(control?.reason||'该构件缺少可靠的尺寸语义，请回 Rhino 修改后重新同步。');
   const min=Number(o.minMm),max=Number(o.maxMm);
   if(!Number.isFinite(min)||!Number.isFinite(max)||min<control.min||max>control.max||min>max)throw Error(`请填写有效探索区间（${control.min}–${control.max} mm 是本工具对“${control.label}”的输入范围，不是规范允许值）。`);
   out.selectedId=o.selectedId;out.minMm=min;out.maxMm=max;out.dimensionKind=control.kind;out.dimensionLabel=control.label;
  }
  return out;
 }
 function calculate(elements,o={}){
  const opts=options(o,elements),base=C.calculate(elements),pool=opts.scope==='selected'?elements.filter(e=>e.id===opts.selectedId):elements;
  const candidates=[],seen=new Set(),excluded=[];
  function materialTargets(e){
   const paths={
    'timber-glulam':['timber-solid'],'timber-clt':['timber-solid'],
    'masonry-clay':['masonry-aac','masonry-concrete'],'masonry-concrete':['masonry-aac'],
    'aluminium':e.type==='mullion'?['steel-section']:[],
    'stone-natural-polished':e.type==='finish'?['timber-solid']:[]
   };
   return (paths[e.material]||[]).filter(material=>C.factorFor(material));
  }
  function changedElement(e,change){
   if(change.factorId){const next=C.clone(e);next.factorId=change.factorId;return next;}
   if(change.material)return Change.changeMaterial(e,change.material);
   if(Number.isFinite(change.mm))return Change.resize(e,change.mm);
   if(change.h){const next=C.clone(e);next.h=change.h;return next;}
   return C.clone(e);
  }
  function add(id,title,changes,kind){
   const next=C.clone(elements);
   for(const change of changes){const index=next.findIndex(x=>x.id===change.elementId),e=next[index];next[index]=changedElement(e,change);}
   const key=JSON.stringify(next);if(seen.has(key))return;seen.add(key);
   const comparison=C.compare(elements,next),affected=changes.map(x=>x.elementId);
   const before=elements.filter(e=>affected.includes(e.id)).map(C.element),after=next.filter(e=>affected.includes(e.id)).map(C.element);
   if(before.some(x=>x.error)||after.some(x=>x.error))return;
   const saved=before.reduce((s,x)=>s+x.value,0)-after.reduce((s,x)=>s+x.value,0);
   if(saved<=.0001)return;
   const materialChange=changes.find(change=>change.material||change.factorId),isConcreteRecipe=!!materialChange?.factorId;
   candidates.push({id,title,kind,changes,elements:next,affected,savedKg:saved,scopeBefore:comparison.compatible?comparison.A.value:null,scopeAfter:comparison.compatible?comparison.B.value:null,scopePercent:comparison.compatible?-comparison.percent:null,scopeComplete:comparison.complete,scopeKnown:comparison.known,scopeTotal:comparison.total,
    status:'research_only',canAdopt:false,structuralScreening:changes.map(change=>({elementId:change.elementId,result:Screening.assess(elements.find(e=>e.id===change.elementId),next.find(e=>e.id===change.elementId))})),
    checks:kind==='material'?(isConcreteRecipe?['核实候选混凝土的强度、耐久与施工性能','核实澳洲项目当地供应及适用 EPD','候选密度不同，需要重新核实自重与受力']:materialChange?.fromMaterial==='stone-natural-polished'?['先确认这是可以更换的饰面层，不是承重石材或必须保留的建筑表达','核实室内／室外适用性、防水、防滑、耐磨、防火、维护和基层连接','寻找澳洲项目可采购的木质饰面产品及适用 EPD；当前只沿用同一净量试算']:['核实替换材料能否承担相同建筑或结构功能','核实防火、耐久、连接、维护和施工要求','寻找澳洲项目可采购产品及适用 EPD；当前只沿用同一几何或净量试算']):['核实该构件的作用、支承、连接与性能要求','按构件类型核验承载、刚度、耐久、防火或围护性能；不要把碳降低当成可实施结论'],
    evidenceIds:kind==='material'?(isConcreteRecipe?['kbob-concrete-v9','limits-v1']:['kbob-materials-v9','limits-v1']):['limits-v1'],
    basis:kind==='material'?(isConcreteRecipe?'KBOB 01.002.13 · 瑞士配方参考，非已确认等效产品':`KBOB 材料因子初筛：${C.materialInfo(materialChange?.fromMaterial).name} → ${C.materialInfo(materialChange?.material).name}；沿用同一几何或净量，仅用于寻找值得进一步验证的方向，不代表功能等效。`):'用户指定的探索区间，非规范允许厚度'});
  }
  if(opts.allowMaterial){
   const eligible=AI.eligible(pool);
   for(const e of eligible.slice(0,2))add('material-'+e.id,'只研究 '+e.id+' 的混凝土配方',[{elementId:e.id,factorId:AI.alternative,fromMaterial:e.material}],'material');
   if(eligible.length>1)add('material-all','同时研究 '+eligible.length+' 个混凝土构件的配方',eligible.map(e=>({elementId:e.id,factorId:AI.alternative,fromMaterial:e.material})),'material');
   const paths=new Map();
   for(const e of pool){
    for(const material of materialTargets(e)){
     const change={elementId:e.id,fromMaterial:e.material,material};let after;
     try{after=C.element(changedElement(e,change));}catch{continue;}
     const before=C.element(e),saving=!before.error&&!after.error?before.value-after.value:0;if(saving<=.0001)continue;
     const key=e.material+'>'+material,list=paths.get(key)||[];list.push({e,change,saving});paths.set(key,list);
    }
   }
   for(const [key,list] of paths){
    list.sort((a,b)=>b.saving-a.saving);const first=list[0],from=C.materialInfo(first.change.fromMaterial).name,to=C.materialInfo(first.change.material).name;
    for(const item of list.slice(0,2))add('material-'+key+'-'+item.e.id,`${item.e.id} · ${from} → ${to}`,[item.change],'material');
    if(list.length>1)add('material-'+key+'-all',`同类 ${list.length} 个构件 · ${from} → ${to}`,list.map(item=>item.change),'material');
   }
  }
  if(opts.allowThickness){
   const selected=elements.find(e=>e.id===opts.selectedId),control=Change.control(selected),min=opts.minMm,max=opts.maxMm;
   const values=[...new Set([min,Math.round((min+max)/2*10)/10,max])];
   for(const mm of values){const change={elementId:selected.id,mm,label:control.label};if(control.kind==='slab')change.h=mm/1000;add('dimension-'+selected.id+'-'+mm,selected.id+' · '+control.label+' '+Number(control.value.toFixed(1))+' → '+mm+' mm',[change],'dimension');}
  }
  for(const e of pool)if(!AI.eligible([e]).length&&!materialTargets(e).length&&!(opts.allowThickness&&e.id===opts.selectedId))excluded.push({id:e.id,reason:C.element(e).error||'当前构件没有满足本版约束的自动低碳候选；仍可在构件工作台手动换材料并调用对应 RAG 核验'});
  candidates.sort((a,b)=>b.savedKg-a.savedKg||a.affected.length-b.affected.length);
  return {purpose,options:opts,base:{value:base.value,known:base.known,total:base.total,complete:base.complete},candidates,excluded,
   locks:['位置、柱网与支承关系不变','构件数量不变','未授权的尺寸和材料不变'],
   boundary:'仅材料生产＋处置；候选按同一范围复算。参考数据库：瑞士 KBOB，不等于澳洲项目产品。',
   optimality:'当前已接入数据与用户授权范围内的有限候选比较；不是全局最优，也不是结构安全结论'};
 }
 function apply(elements,opts,id){const report=calculate(elements,opts),candidate=report.candidates.find(x=>x.id===id);if(!candidate)throw Error('候选方案已失效，请重新寻找。');return candidate;}
 const api={purpose,options,calculate,apply};if(node)module.exports=api;else root.CarbonSolutions=api;
})(typeof window!=='undefined'?window:globalThis);
