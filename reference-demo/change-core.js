(function(root){
 'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./model-core.js'):root.ModelCore;
 function control(e){
  if(e.quantity?.kind==='i-section'&&e.material==='steel-section')return {kind:'flange',label:'I 形钢柱翼缘厚度',value:e.quantity.tf*1000,min:10,max:30,step:1,reason:'只修改演示 I 形截面的两片翼缘；外包尺寸、腹板、柱高与位置不变。非标准型钢选型，需结构复核。'};
  if(e.quantity)return {reason:'这个构件使用独立净量；需回到建模端重算，本页不能用外包尺寸替代。'};
  if(e.type==='slab')return {kind:'slab',label:'楼板厚度',value:e.h*1000,min:120,max:300,step:10,reason:'保持楼板平面面积不变，只改变厚度。'};
  if(e.type==='wall')return {kind:'wall',label:'墙体厚度',value:e.w*1000,min:100,max:300,step:10,reason:'保持墙长、高度和中心位置不变；示例未扣洞口，不含砂浆。'};
  if(e.type==='column'&&Math.abs(e.l-e.w)<1e-8)return {kind:'column',label:'方柱截面边长',value:e.l*1000,min:300,max:600,step:10,reason:'只改变这根方柱的截面；柱高与中心位置不变，不修改其他柱。'};
  return {reason:'本版未实现这类构件的尺寸编辑；仍可查看材料、数量与排放。'};
 }
 function resize(e,mm){const c=control(e);if(!c.kind||!Number.isFinite(mm)||mm<c.min||mm>c.max)throw Error('超出演示输入范围；该范围不是结构规范限值。');const next=C.clone(e),v=mm/1000;
  if(c.kind==='slab')next.h=v;
  if(c.kind==='wall'){next.y+=(next.w-v)/2;next.w=v;}
  if(c.kind==='column'){next.x+=(next.l-v)/2;next.y+=(next.w-v)/2;next.l=v;next.w=v;}
  if(c.kind==='flange'){if(2*v>=next.quantity.d)throw Error('截面尺寸无效');next.quantity.tf=v;}
  return next;
 }
 function differences(a,b){const parts=[],ca=control(a),cb=control(b);if(ca.kind===cb.kind&&ca.kind&&Math.abs(ca.value-cb.value)>1e-8)parts.push(`${cb.label} ${Number(ca.value.toFixed(2))} → ${Number(cb.value.toFixed(2))} mm`);
  if(a.material!==b.material)parts.push(`${C.materialInfo(a.material).name} → ${C.materialInfo(b.material).name}`);
  const fa=C.element(a).factor,fb=C.element(b).factor;if(a.factorId!==b.factorId)parts.push(`材料配方 ${fa?.id||'未知'} → ${fb?.id||'未知'}`);return parts;
 }
 const api={control,resize,differences};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CarbonChange=api;
})(typeof window!=='undefined'?window:globalThis);
