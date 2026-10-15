(function(root){
 'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./model-core.js'):root.ModelCore;
 const typeNames={slab:'楼板',finish:'饰面',beam:'梁',column:'柱',wall:'墙',foundation:'基础',roof:'屋面',glazing:'玻璃／幕墙',mullion:'幕墙框',door:'门',stair:'楼梯',other:'其他构件',unknown:'未识别构件'};
 const materialLockedQuantity=e=>e.quantity?.kind==='i-section';
 function policy(e){
  const ctl=control(e),known=e&&e.type!=='unknown';
  return {type:e?.type||'unknown',label:typeNames[e?.type]||typeNames.other,materialEditable:known&&!materialLockedQuantity(e),dimensionEditable:!!ctl.kind,dimensionKind:ctl.kind||null,
   materialReason:!known?'先确认构件类别和材料。':materialLockedQuantity(e)?'该构件使用 I 形截面净量；当前只允许保持型钢类别并调整已知截面参数。':'可在候选方案中更换材料类别并按相同已知工程量重算；这不证明性能等效。',dimensionReason:ctl.reason};
 }
 function control(e){
  if(e.quantity?.kind==='i-section'&&e.material==='steel-section')return {kind:'flange',label:'I 形钢柱翼缘厚度',value:e.quantity.tf*1000,min:10,max:30,step:1,reason:'只修改演示 I 形截面的两片翼缘；外包尺寸、腹板、柱高与位置不变。非标准型钢选型，需结构复核。'};
  const finishFactor=C.factorFor(e.material);
  if(e.type==='finish'&&finishFactor?.sourceThickness){
   const thickness=Number.isFinite(e.finishThickness)&&e.finishThickness>0?e.finishThickness:finishFactor.sourceThickness;
   return {kind:'finish-thickness',label:'饰面参考厚度',value:thickness*1000,min:5,max:50,step:1,reason:`当前材料数据以 ${finishFactor.sourceThickness*1000} mm 石材板为基准；可在候选方案中试调厚度并按比例重算用量。这里只改变碳分析假设，不会改写 Rhino 几何。`};
  }
  if(e.quantity)return {reason:'材料可在本页研究；尺寸使用 Rhino 读取的独立净量，需回到 Rhino 修改后重新同步，不能拿包围盒替代。'};
  if(e.type==='slab')return {kind:'slab',label:'楼板厚度',value:e.h*1000,min:120,max:300,step:10,reason:'保持楼板平面面积不变，只改变厚度。'};
  if(e.type==='roof'&&e.h<Math.min(e.l,e.w)*.35)return {kind:'roof-depth',label:'屋面构造厚度',value:e.h*1000,min:50,max:600,step:10,reason:'仅适用于水平、轴向清楚的简化屋面实体；保持平面范围不变。斜屋面或复合屋面应回 Rhino 修改。'};
  if(e.type==='foundation')return {kind:'foundation-depth',label:'基础竖向尺寸',value:e.h*1000,min:200,max:2000,step:25,reason:'保持基础平面范围不变，只研究竖向尺寸；桩、承台组合或复杂基础应回 Rhino 修改。'};
  if(e.type==='wall'){const axis=e.l<=e.w?'l':'w',value=e[axis]*1000;return {kind:'wall-thickness',axis,label:'墙体厚度',value,min:60,max:500,step:10,reason:'保持墙高、较长方向和中心位置不变；示例未扣洞口，不含砂浆。'};}
  if(e.type==='column'&&Math.abs(e.l-e.w)<1e-8)return {kind:'column',label:'方柱截面边长',value:e.l*1000,min:300,max:600,step:10,reason:'只改变这根方柱的截面；柱高与中心位置不变，不修改其他柱。'};
  if(e.type==='beam'&&e.h<Math.max(e.l,e.w))return {kind:'beam-depth',label:'梁截面高度',value:e.h*1000,min:150,max:1200,step:10,reason:'保持梁轴线、跨度和截面宽度不变，只研究竖向截面高度；旋转或变截面梁应回 Rhino 修改。'};
  if(['glazing','door'].includes(e.type)){const dims=[['l','x'],['w','y'],['h','z']].sort((a,b)=>e[a[0]]-e[b[0]]),axis=dims[0][0];return {kind:e.type+'-thickness',axis,label:e.type==='glazing'?'玻璃构造厚度':'门扇构造厚度',value:e[axis]*1000,min:e.type==='glazing'?4:20,max:e.type==='glazing'?80:150,step:e.type==='glazing'?1:5,reason:'只在单层、轴向清楚的简化实体上调整最小尺寸；复合玻璃、门框五金与多层构造应回 Rhino 修改。'};}
  if(e.type==='mullion')return {reason:'材料可在本页研究；幕墙框截面需要型材净面积或 Rhino 截面资料，不能用外包尺寸代替。'};
  if(e.type==='stair')return {reason:'材料可在本页研究；楼梯由梯段、平台和支承组成，尺寸应在 Rhino 修改后重新同步。'};
  return {reason:'材料可在本页研究；当前几何不足以可靠判断可编辑方向，尺寸请回 Rhino 修改后自动同步。'};
 }
 function resize(e,mm){const c=control(e);if(!c.kind||!Number.isFinite(mm)||mm<c.min||mm>c.max)throw Error('超出演示输入范围；该范围不是结构规范限值。');const next=C.clone(e),v=mm/1000;
  if(c.kind==='slab')next.h=v;
  if(c.kind==='roof-depth'||c.kind==='foundation-depth'||c.kind==='beam-depth'){next.z+=(next.h-v)/2;next.h=v;}
  if(c.kind==='wall-thickness'){const position=c.axis==='l'?'x':'y';next[position]+=(next[c.axis]-v)/2;next[c.axis]=v;}
  if(c.kind==='column'){next.x+=(next.l-v)/2;next.y+=(next.w-v)/2;next.l=v;next.w=v;}
  if(c.kind==='flange'){if(2*v>=next.quantity.d)throw Error('截面尺寸无效');next.quantity.tf=v;}
  if(c.kind==='finish-thickness')next.finishThickness=v;
  if(c.kind==='glazing-thickness'||c.kind==='door-thickness'){const position=c.axis==='l'?'x':c.axis==='w'?'y':'z';next[position]+=(next[c.axis]-v)/2;next[c.axis]=v;}
  return next;
 }
 function changeMaterial(e,material){
  if(!C.materials.some(item=>item.id===material))throw Error('材料类别无效。');
  const p=policy(e);if(!p.materialEditable)throw Error(p.materialReason);
  const next=C.clone(e);next.material=material;delete next.factorId;
  if(next.quantity?.kind==='net-volume'){next.quantity.material=material;next.quantity.basis=(next.quantity.basis||'Rhino 净体积')+'；候选沿用同一净体积，仅更换材料类别';}
  return next;
 }
 function differences(a,b){const parts=[],ca=control(a),cb=control(b);if(ca.kind===cb.kind&&ca.kind&&Math.abs(ca.value-cb.value)>1e-8)parts.push(`${cb.label} ${Number(ca.value.toFixed(2))} → ${Number(cb.value.toFixed(2))} mm`);
  if(a.material!==b.material)parts.push(`${C.materialInfo(a.material).name} → ${C.materialInfo(b.material).name}`);
  const fa=C.element(a).factor,fb=C.element(b).factor;if(a.factorId!==b.factorId)parts.push(`材料配方 ${fa?.id||'未知'} → ${fb?.id||'未知'}`);return parts;
 }
 const api={control,policy,resize,changeMaterial,differences,typeNames};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CarbonChange=api;
})(typeof window!=='undefined'?window:globalThis);
