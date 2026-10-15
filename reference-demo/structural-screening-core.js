(function(root){
 'use strict';
 const Rulebook=typeof module!=='undefined'&&module.exports?require('./structural-rulebook.js'):root.StructuralRulebook;
 const basis={loads:{title:'NCC B1D3 → AS/NZS 1170.1：自重与使用荷载',url:'https://www.abcb.gov.au/editions/ncc-2022/adopted/volume-one/b-structure/part-b1-structural-provisions'},concrete:{title:'AS 3600:2018：截面抗弯计算实现',url:'https://concrete-properties.readthedocs.io/en/stable/user_guide/design_codes/as3600.html'}};
 function assess(before,after){
  const rulebook=Rulebook.evaluate(before,after),rows=[],sameMaterial=before.material===after.material&&(before.factorId||'')===(after.factorId||'');
  const slab=before.type==='slab'&&after.type==='slab'&&['concrete','concrete-cast','concrete-precast'].includes(after.material);
  if(!slab)return {status:'outside_scope',can_adopt:false,rows:[{id:'scope',title:'此构件不在本轮混凝土楼板初筛范围内',detail:'不会把混凝土楼板规则用于钢柱、木柱或墙。'}],basis,rulebook};
  for(const r of rulebook.rules){
   if(r.ruleId==='AU-PERMANENT-ACTION-DELTA'&&r.state==='calculated')rows.push({id:'self_weight',title:r.value>0?'加厚会增加楼板自重':'减薄会降低楼板自重',detail:r.detail,value:r.value,unit:r.unit,basis:'loads',ruleId:r.ruleId});
   if(r.ruleId==='ED-LOAD-PATH')rows.push({id:'position',title:'位置改变：需要重新确认支承与传力关系',detail:r.detail,basis:'loads',ruleId:r.ruleId});
   if(r.ruleId==='ED-SLAB-THINNER')rows.push({id:'thinner',title:'减薄：承载、变形和冲切需要重新检查',detail:r.detail,basis:'concrete',ruleId:r.ruleId});
   if(r.ruleId==='ED-SLAB-THICKER')rows.push({id:'thicker',title:'加厚：不能只检查楼板本身',detail:r.detail,basis:'loads',ruleId:r.ruleId});
   if(r.ruleId==='ED-MATERIAL-EQUIVALENCE')rows.push({id:'material',title:'材料改变：原结构性能不能直接沿用',detail:r.detail,basis:'concrete',ruleId:r.ruleId});
  }
  rows.push({id:'capacity',title:'能不能采用：还缺承载力判断依据',detail:'需要混凝土强度、实际配筋及对应改动的设计内力。普通建筑几何不能可靠补出这些数据。',basis:'concrete'});
  return {status:'needs_review',can_adopt:false,rows,basis,rulebook,execution:'已运行可执行的规则检索与几何/自重初筛；不是完整规范验算'};
 }
 const api={assess,basis};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StructuralScreening=api;
})(typeof window!=='undefined'?window:globalThis);
