(function(root){
 'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./model-core.js'):root.ModelCore;
 const I=typeof module!=='undefined'&&module.exports?require('./rhino-contract.js'):root.RhinoContract;
 let lastContract=null;
 const rules=[
  ['concrete',/通用混凝土|generic concrete/i],['concrete-cast',/现浇混凝土|cast[- ]in[- ](?:situ|place) concrete/i],['concrete-precast',/预制混凝土|precast concrete/i],
  ['rebar-mesh',/钢筋网|reinforcing mesh/i],['rebar',/钢筋|rebar|reinforcing steel/i],
  ['steel-section',/型钢|h型钢|steel section|structural steel section/i],['steel-tube',/钢管|steel tube|steel hollow section/i],['steel-plate',/钢板|steel plate/i],
  ['timber-solid',/实木|锯材|木材|solid timber|sawn timber|\btimber\b|\bwood\b|\blumber\b/i],['timber-glulam',/胶合木|glulam|glue[d ]+laminated timber/i],['timber-clt',/交叉层压木|\bCLT\b|cross[- ]laminated timber/i],
  ['masonry-clay',/黏土砖|粘土砖|clay brick/i],['masonry-concrete',/混凝土砌块|concrete block/i],['masonry-aac',/加气混凝土|\bAAC\b|aerated concrete/i],
  ['glass',/玻璃|\bglass\b/i],['aluminium',/铝材|aluminium|aluminum/i],['insulation',/保温材料|insulation/i],['gypsum',/石膏(?:板|抹灰)?|gypsum(?:\s+board)?|plaster(?:\s*board)?/i],
  ['stone-natural-polished',/carrara|marble|natural stone|polished stone|大理石|天然石材|抛光石材/i],['finish',/饰面材料|finish(?:es| material)?|paint|coating|ceramic tile|\btile\b|terrazzo|flooring|carpet|vinyl|render|cladding|plastic|涂料|瓷砖|水磨石|地板|地毯|抹灰|覆层|塑料/i]
 ];
 const normalize=v=>String(v||'').trim();
 function match(record){
  const raw=C.clone(record||{}),name=normalize(raw.name),product=normalize(raw.productType);
  const result=(material,basis,candidates=[])=>({material,materialRecord:raw,matchBasis:basis,matchCandidates:candidates,classificationSource:'local_dictionary',sourceMaterial:name||'未提供材料名称',sourceMaterialId:normalize(raw.id)||name||'unassigned'});
  if(raw.appearanceOnly)return result('unknown','只有渲染外观，不能作为工程材料依据。');
  if(Array.isArray(raw.layers)&&raw.layers.length>1)return result('unknown','包含多种材料，需要分别读取材料层与数量，不能取第一种材料代替整个构件。');
  // Product names/attributes only: no inference from object colour, geometry or material grade alone.
  const direct=C.materials.find(m=>m.id===product&&m.id!=='unknown');
  if(raw.review?.confirmed===true&&raw.inference?.source==='rhino-user-confirmed'){
   if(product==='unknown')return {...result('unknown','建筑师在 Rhino 中确认保留未确定材料，需继续核验。'),classificationSource:'rhino_user_confirmed'};
   if(direct)return {...result(direct.id,raw.inference.basis||'建筑师已在 Rhino 核验面板确认材料类别。'),classificationSource:'rhino_user_confirmed'};
  }
  let matches=rules.filter(([,re])=>re.test(name)).map(([id])=>id);
  if(matches.includes('rebar-mesh'))matches=matches.filter(id=>id!=='rebar');
  // A specific engineered-timber name wins over the generic word "timber".
  // This keeps names such as "GL28 Glulam Timber" and "CLT Timber Panel"
  // useful instead of turning them into false multi-category conflicts.
  if(matches.includes('timber-glulam')||matches.includes('timber-clt'))matches=matches.filter(id=>id!=='timber-solid');
  // Rhino's semantic profile may provide the broad "finish" category while
  // the material name is more specific. Prefer an explicit stone name over
  // that broad category; retain conflict handling for unrelated categories.
  if(direct?.id==='finish'&&matches.includes('stone-natural-polished'))return result('stone-natural-polished','模型给出笼统饰面类别；根据原始材质名称中的 Carrara / marble / natural stone 细分为抛光天然石材，请核对具体产品。');
  if(direct&&matches.some(id=>id!==direct.id))return result('unknown','模型品类字段与材料名称冲突，请核对原始属性。',[direct.id,...matches]);
  if(direct){const inference=raw.inference,basis=inference?.basis||'根据模型提供的材料品类字段匹配；牌号保留原值，未验证真实性。';return result(direct.id,`${basis}${inference?.confidence?` 置信度 ${Math.round(inference.confidence*100)}%。`:''}`);}
  if(matches.length===1)return result(matches[0],'根据原始材料名称中的明确名称匹配目录；请核对，不根据外观猜测。');
  return result('unknown',matches.length?'名称对应多个类别，请核对。':'目录暂时无法匹配这个名称，已保留原名；不会默认为混凝土。',matches);
 }
 function sample(mode='mixed'){
  const elements=C.sample().map(e=>({...e,floor:'1F'})).concat(C.sample().map(e=>({...e,id:e.id+'-2F',name:'2F '+e.name,z:e.z+3.2,floor:'2F'})));
  const records=mode==='concrete'?elements.map(()=>({id:'MAT-GENERIC',name:'通用混凝土',productType:'concrete',grade:''})):[
   {id:'MAT-CON30',name:'现浇混凝土 C30/37',productType:'concrete-cast',grade:'C30/37'},
   {id:'MAT-STEEL',name:'Steel section S355',productType:'steel-section',grade:'S355'},
   {id:'MAT-STEEL',name:'Steel section S355',productType:'steel-section',grade:'S355'},
   {id:'MAT-GLULAM',name:'Glulam GL28h',productType:'timber-glulam',grade:'GL28h'},
   {id:'MAT-GLULAM',name:'Glulam GL28h',productType:'timber-glulam',grade:'GL28h'},
   {id:'MAT-CLT',name:'CLT floor panel',productType:'timber-clt',grade:''},
   {id:'MAT-PRECAST',name:'Precast concrete C40/50',productType:'concrete-precast',grade:'C40/50'},
   {id:'MAT-PRECAST',name:'Precast concrete C40/50',productType:'concrete-precast',grade:'C40/50'},
   {id:'MAT-BRICK',name:'Clay brick',productType:'masonry-clay',grade:''},
   {id:'MAT-CUSTOM',name:'Material 007',productType:'',grade:''}
  ];
  const model=elements.map((e,i)=>{
   const item={...e,materialRecord:{...records[i],origin:'内置示例对象材料属性（模拟宿主输入）'}};
   delete item.material;
   if(mode!=='concrete'&&[1,2].includes(i))item.quantity={kind:'i-section',material:'steel-section',dimensions:[item.l,item.w,item.h],b:.4,d:.4,tf:.02,tw:.012,origin:'演示假设，非真实 Rhino 读取；模型仅绘制外包轮廓'};
   if(mode!=='concrete'&&i===8){item.type='wall';item.name='2F 砌体墙';item.l=5.6;item.w=.15;item.x=0;item.y=3.8;}
   return item;
  });
  if(mode!=='concrete')model.splice(5,0,{id:'W01',name:'墙 01',type:'wall',floor:'1F',x:0,y:3.8,z:0,l:5.6,w:.15,h:3,materialRecord:{id:'MAT-BRICK',name:'Clay brick',productType:'masonry-clay',grade:'',origin:'预置模型对象属性（未连接宿主）'}});
  const normalized=I.normalize(I.fromObjects(model,{documentId:'carbonloop-two-floor-demo',selectionMode:'all'}));
  if(!normalized.valid)throw Error('Rhino 接入协议示例无效：'+normalized.errors.join('；'));
  lastContract=normalized;
  return normalized.objects;
 }
 const api={match,sample,contractStatus:()=>lastContract?C.clone(lastContract):null};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MaterialIntake=api;
})(typeof window!=='undefined'?window:globalThis);
