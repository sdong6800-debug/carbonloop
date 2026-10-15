(function(root){
 'use strict';

 const version='au-early-design-0.1.0';
 const sources=Object.freeze({
  'ncc-b1d2':Object.freeze({
   title:'NCC 2022 Volume One · B1D2 Resistance to actions',
   url:'https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-one/b-structure/part-b1-structural-provisions',
   authority:'normative_reference',
   note:'公开条文要求结构抗力大于最不利作用组合产生的作用效应；具体项目仍须确认适用版本与州/领地变体。'
  }),
  'ncc-b1d3':Object.freeze({
   title:'NCC 2022 Volume One · B1D3 Determination of individual actions',
   url:'https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-one/b-structure/part-b1-structural-provisions',
   authority:'normative_reference',
   note:'公开条文指出永久作用取决于已知尺寸、材料单位重量及 AS/NZS 1170.1；使用荷载取决于建筑用途等信息。'
  }),
  'ncc-b1d4':Object.freeze({
   title:'NCC 2022 Volume One · B1D4 Determination of structural resistance',
   url:'https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-one/b-structure/part-b1-structural-provisions',
   authority:'normative_reference',
   note:'公开条文把钢筋及预应力混凝土的结构抗力判定指向 AS 3600；本规则包未包含该标准全文。'
  })
 });

 const rules=Object.freeze([
  Object.freeze({id:'AU-NCC-ACTION-RESISTANCE',title:'符合性必须同时比较作用效应与结构抗力',level:'normative_reference',appliesTo:['building','element'],triggers:['any_structural_change'],requiredInputs:['适用规范版本','作用与组合','结构分析结果','相应材料抗力'],executor:null,sourceIds:['ncc-b1d2'],outcome:'没有作用与抗力两侧的数据时，不输出“符合规范”或“结构安全”。'}),
  Object.freeze({id:'AU-PERMANENT-ACTION-DELTA',title:'尺寸或单位重量变化会改变永久作用',level:'normative_reference',appliesTo:['slab'],triggers:['thickness_change','material_change'],requiredInputs:['构件尺寸','材料单位重量'],executor:'solid_slab_self_weight_ratio',sourceIds:['ncc-b1d3'],outcome:'可在平面范围和材料单位重量不变时计算楼板自身重量的相对变化；不等于总楼面荷载或下部构件内力变化。'}),
  Object.freeze({id:'AU-CONCRETE-RESISTANCE-ROUTE',title:'混凝土构件抗力须进入相应混凝土结构设计检查',level:'normative_reference',appliesTo:['concrete_slab'],triggers:['thickness_change','material_change'],requiredInputs:['结构体系与支承','材料力学性能','荷载与组合','分析结果','必要的构造资料'],executor:null,sourceIds:['ncc-b1d4'],outcome:'当前只给出后续检查路径，不用碳因子或几何比例代替 AS 3600 结构判断。'}),
  Object.freeze({id:'ED-SLAB-THINNER',title:'楼板减薄优先检查承载与正常使用表现',level:'early_design_screening',appliesTo:['concrete_slab'],triggers:['thickness_decrease'],requiredInputs:['有效跨度与支承方式','楼面用途和荷载','材料与结构体系'],executor:'screen_thinner_slab',sourceIds:['ncc-b1d2','ncc-b1d4'],outcome:'减薄可以降低材料用量，但必须继续核实承载、变形、冲切和构造等适用项目。'}),
  Object.freeze({id:'ED-SLAB-THICKER',title:'楼板加厚会把新增自重传给支承体系',level:'early_design_screening',appliesTo:['concrete_slab'],triggers:['thickness_increase'],requiredInputs:['支承与传力关系','材料单位重量','相关梁柱墙基础条件'],executor:'screen_thicker_slab',sourceIds:['ncc-b1d2','ncc-b1d3'],outcome:'加厚并不自动表示整体结构更安全；需检查新增永久作用及其对支承构件的影响。'}),
  Object.freeze({id:'ED-MATERIAL-EQUIVALENCE',title:'低碳材料不能仅凭碳因子视为结构等效',level:'early_design_screening',appliesTo:['element'],triggers:['material_change'],requiredInputs:['候选材料力学性能','耐久与耐火要求','产品或配方适用资料'],executor:'screen_material_change',sourceIds:['ncc-b1d4'],outcome:'碳排更低只说明当前计算边界内的环境数据变化，不证明结构性能等效。'}),
  Object.freeze({id:'ED-LOAD-PATH',title:'移动构件或改变支承会改变传力路径',level:'engineering_principle',appliesTo:['element'],triggers:['position_change'],requiredInputs:['支承关系','连接关系','整体分析模型'],executor:'screen_load_path',sourceIds:['ncc-b1d2'],outcome:'位置或支承变化不能沿用原方案的局部比较结果，必须重新建立受力模型。'})
 ]);

 function isConcreteSlab(e){return !!e&&e.type==='slab'&&['concrete','concrete-cast','concrete-precast'].includes(e.material);}
 function same(a,b,key){return (a?.[key]??null)===(b?.[key]??null);}
 function changed(before,after){
  return {
   position:['x','y','z'].some(k=>!same(before,after,k)),
   thickness:Number.isFinite(before?.h)&&Number.isFinite(after?.h)&&before.h!==after.h,
   thinner:Number.isFinite(before?.h)&&Number.isFinite(after?.h)&&after.h<before.h,
   thicker:Number.isFinite(before?.h)&&Number.isFinite(after?.h)&&after.h>before.h,
   material:!same(before,after,'material')||!same(before,after,'factorId')
  };
 }
 function matches(rule,before,after,delta){
  const concrete=isConcreteSlab(after),type=concrete?'concrete_slab':after?.type;
  if(!rule.appliesTo.some(x=>x==='element'||x==='building'||x===type||x===after?.type))return false;
  return rule.triggers.some(t=>t==='any_structural_change'&&(delta.position||delta.thickness||delta.material)||t==='position_change'&&delta.position||t==='thickness_change'&&delta.thickness||t==='thickness_decrease'&&delta.thinner||t==='thickness_increase'&&delta.thicker||t==='material_change'&&delta.material);
 }
 function retrieve(before,after){
  if(!before||!after||before.id!==after.id)throw Error('前后构件不匹配');
  const delta=changed(before,after);
  return rules.filter(r=>matches(r,before,after,delta));
 }
 function evaluate(before,after){
  const selected=retrieve(before,after),delta=changed(before,after),results=[];
  for(const rule of selected){
   let state=rule.executor?'needs_input':'reference_only',detail=rule.outcome,value=null,unit=null;
   if(rule.executor==='solid_slab_self_weight_ratio'){
    const samePlan=['l','w'].every(k=>same(before,after,k)),sameMaterial=same(before,after,'material')&&same(before,after,'factorId'),solid=!before.quantity&&!after.quantity;
    if(samePlan&&sameMaterial&&solid&&before.h>0){value=(after.h/before.h-1)*100;unit='%';state='calculated';detail='平面范围、材料与单位重量不变时，楼板自身重量'+(value>=0?'增加 ':'减少 ')+Math.abs(value).toFixed(1)+'%。这不是总楼面荷载或梁柱内力的变化。';}
    else detail='平面范围、材料或数量口径同时改变，不能只用厚度比例计算自重变化。';
   }
   if(rule.executor==='screen_thinner_slab'||rule.executor==='screen_thicker_slab'||rule.executor==='screen_material_change'||rule.executor==='screen_load_path')state='screened';
   results.push({ruleId:rule.id,title:rule.title,level:rule.level,state,detail,value,unit,requiredInputs:[...rule.requiredInputs],sourceIds:[...rule.sourceIds]});
  }
  return {version,scope:'澳大利亚前期设计筛查；不是结构设计认证',verdict:'not_determined',canAdopt:false,changes:delta,rules:results,sources:selected.reduce((a,r)=>{for(const id of r.sourceIds)if(!a.some(x=>x.id===id))a.push({id,...sources[id]});return a;},[])};
 }
 const api={version,sources,rules,changed,retrieve,evaluate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StructuralRulebook=api;
})(typeof window!=='undefined'?window:globalThis);
