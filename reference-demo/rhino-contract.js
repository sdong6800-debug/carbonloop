(function(root){
 'use strict';
 const VERSION='carbonloop.rhino.intake/1.0.0';
 const scales={Meters:1,Millimeters:.001,Centimeters:.01};
 const clone=value=>JSON.parse(JSON.stringify(value));
 function fromObjects(objects,metadata={}){
  return {schemaVersion:VERSION,source:{host:'Rhino',mode:'contract_demo',documentId:metadata.documentId||'carbonloop-demo-model',unitSystem:metadata.unitSystem||'Meters',pluginVersion:metadata.pluginVersion||'not-connected'},selection:{mode:metadata.selectionMode||'all'},objects:clone(objects).map(item=>({id:item.id,name:item.name,typeHint:item.type||'unknown',floor:item.floor||null,layer:item.layer||null,geometry:{kind:'box',origin:[item.x,item.y,item.z],dimensions:[item.l,item.w,item.h]},material:item.materialRecord||null,quantity:item.quantity||null}))};
 }
 function normalize(payload){
  const errors=[],warnings=[];
  if(!payload||payload.schemaVersion!==VERSION)errors.push('接入协议版本不匹配');
  const scale=scales[payload?.source?.unitSystem];if(!scale)errors.push('模型单位缺失或不支持');
  if(!Array.isArray(payload?.objects)||!payload.objects.length)errors.push('没有可读取的模型构件');
  const ids=new Set(),objects=[];
  for(const [index,item] of (payload?.objects||[]).entries()){
   const errorCount=errors.length;
   const label=item?.id||`第 ${index+1} 个构件`;
   if(!item?.id)errors.push(label+'：缺少稳定对象 ID');else if(ids.has(item.id))errors.push(label+'：对象 ID 重复');else ids.add(item.id);
   const origin=item?.geometry?.origin,dimensions=item?.geometry?.dimensions;
   if(!Array.isArray(origin)||origin.length!==3||origin.some(v=>!Number.isFinite(v)))errors.push(label+'：位置数据无效');
   if(!Array.isArray(dimensions)||dimensions.length!==3||dimensions.some(v=>!Number.isFinite(v)||v<=0))errors.push(label+'：几何尺寸无效');
   if(!item?.floor)warnings.push(label+'：缺少楼层或图层归属，需人工确认');
   if(!item?.material?.name)warnings.push(label+'：缺少模型材料名称，保持待匹配');
   if(errors.length>errorCount)continue;
   const [x,y,z]=origin.map(v=>v*scale),[l,w,h]=dimensions.map(v=>v*scale);
   let quantity=item.quantity?clone(item.quantity):undefined;
   if(quantity?.kind==='net-volume'&&Number.isFinite(quantity.value)){
    quantity.value*=scale**3;
    quantity.basis=quantity.basis||'Rhino 封闭几何净体积（已换算为 m³）';
   }
   if(quantity?.kind==='i-section'){
    for(const key of ['b','d','tf','tw'])if(Number.isFinite(quantity[key]))quantity[key]*=scale;
    if(Array.isArray(quantity.dimensions))quantity.dimensions=quantity.dimensions.map(v=>v*scale);
   }
   let type=item.typeHint||'unknown',typeInference=item.typeInference?clone(item.typeInference):null;
   const explicitType=typeInference?.source==='CarbonLoop.Type';
   if(!explicitType&&/(^|::|[._\-\s])(?:ext\.?\s*)?finish(?:es)?($|::|[._\-\s])/i.test(item.layer||'')){
    type='finish';typeInference={source:'web-semantic-guard',confidence:.98,basis:'图层名称明确包含 Finish，按饰面层识别，不作为结构楼板。'};
   }
   objects.push({id:item.id,name:item.name||item.id,type,typeInference,analysisEligible:item.analysisEligible!==false,eligibilityBasis:item.eligibilityBasis||'',floor:item.floor||'待确认',layer:item.layer||'',x,y,z,l,w,h,geometryBasis:item.geometry?.basis||'',previewAdjusted:item.geometry?.previewAdjusted===true,sourceDimensions:Array.isArray(item.geometry?.sourceDimensions)?item.geometry.sourceDimensions.map(v=>v*scale):null,quantityRequired:item.quantityRequired===true,materialRecord:item.material?{...clone(item.material),origin:item.material.origin||'Rhino 接入协议中的对象材料属性'}:{id:'',name:'',productType:'',grade:'',origin:'Rhino 接入协议未提供材料'},quantity});
  }
  return {valid:errors.length===0,errors,warnings,objects,metadata:{contractVersion:VERSION,sourceHost:payload?.source?.host||null,documentId:payload?.source?.documentId||null,unitSystem:payload?.source?.unitSystem||null,pluginVersion:payload?.source?.pluginVersion||null,semanticProfileVersion:payload?.source?.semanticProfileVersion||null,transmissionId:payload?.source?.transmissionId||null,sentAt:payload?.source?.sentAt||null,syncMode:payload?.source?.syncMode||'manual',syncReason:payload?.source?.syncReason||'用户发送',selectionMode:payload?.selection?.mode||null,receivedCount:payload?.objects?.length||0}};
 }
 const api={VERSION,fromObjects,normalize};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RhinoContract=api;
})(typeof window!=='undefined'?window:globalThis);
