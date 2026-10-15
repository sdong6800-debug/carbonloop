(function(root){
 'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./model-core.js'):root.ModelCore;
 const alternative='01.002.13';
 // Small, locally curated retrieval corpus. Project constraints are NOT structural standards.
 const documents=[
  {id:'scope-v1',title:'项目约束：本轮只研究材料配方',kind:'项目规则，非工程规范',tags:['concrete','concrete-cast'],text:'保持构件 ID、类别、位置、尺寸、数量、钢筋及已填结构条件不变。只对一个通用或现浇混凝土构件试换材料碳数据。不得声称结构合格或已验证材料等效。'},
  {id:'kbob-concrete-v9',title:'KBOB 通用混凝土与 Q-A230 配方记录',kind:'数据库条目',tags:['concrete','concrete-cast'],url:C.factorSource.url,text:'基准 01.002：F38=2300 kg/m³，AA38=0.0887、AB38=0.0126 kg CO2e/kg。候选 01.002.13：F53=2367.6，AA53=0.0559、AB53=0.0126。两者均不含钢筋。候选是瑞士特定配方，不是项目所在地可用或强度等效的证明。'},
  {id:'limits-v1',title:'比较边界与待验证事项',kind:'项目计算规则，非工程规范',tags:['concrete','concrete-cast'],text:'仅比较生产与处置；其他阶段和未建模材料不计为零。材料替换后按候选密度重新算质量。强度、耐久、施工、当地供应、价格均需核实。缺项时不能宣称完整方案减排。'}
 ];
 function eligible(elements){return elements.filter(e=>['concrete','concrete-cast'].includes(e.material)&&!e.factorId&&!C.element(e).error).sort((a,b)=>C.element(b).value-C.element(a).value);}
 function retrieve(elements,query=''){const tags=new Set(elements.map(e=>e.material));return documents.filter(d=>d.tags.some(t=>tags.has(t))).map(d=>({...d,score:d.tags.filter(t=>tags.has(t)).length+(query.includes('配方')&&d.id.includes('concrete')?1:0)})).sort((a,b)=>b.score-a.score);}
 function apply(elements,choice){
  if(!choice||choice.factorId!==alternative||!eligible(elements).some(e=>e.id===choice.elementId))throw Error('建议不在本轮允许的材料替换范围内。');
  const next=C.clone(elements);next.find(e=>e.id===choice.elementId).factorId=alternative;
  return {elements:next,comparison:C.compare(elements,next),selectedBefore:C.element(elements.find(e=>e.id===choice.elementId)),selectedAfter:C.element(next.find(e=>e.id===choice.elementId))};
 }
 function validate(value,elements,evidence){
  if(!value||typeof value!=='object'||!['suggestion','insufficient'].includes(value.status))throw Error('AI 返回格式无效，未建立方案。');
  if(Object.keys(value).some(k=>!['status','elementId','factorId','reason','limitations','evidenceIds'].includes(k)))throw Error('AI 返回了未经允许的修改字段，未建立方案。');
  for(const k of ['reason','limitations'])if(typeof value[k]!=='string'||!value[k].trim()||value[k].length>1800)throw Error('AI 说明不完整，未建立方案。');
  if(!Array.isArray(value.evidenceIds)||!value.evidenceIds.length||value.evidenceIds.some(id=>!evidence.some(d=>d.id===id)))throw Error('AI 引用不在检索结果中，未建立方案。');
  if(value.status==='suggestion'){apply(elements,value);if(!value.evidenceIds.includes('kbob-concrete-v9'))throw Error('缺少材料因子来源，未建立方案。');}
  return value;
 }
 function offline(elements){const e=eligible(elements)[0];if(!e)return null;return {status:'suggestion',elementId:e.id,factorId:alternative,reason:'按固定规则选取可试算混凝土中排放最高的构件，比较一个已核对配方条目。不是 AI 生成，也不代表该配方能用于项目。',limitations:'材料性能、结构可行性与当地供应待核实；仅生产＋处置的假设对比。',evidenceIds:documents.map(d=>d.id)};}
 const api={alternative,documents,eligible,retrieve,apply,validate,offline};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CarbonAI=api;
})(typeof window!=='undefined'?window:globalThis);
