/* Independent educational quantity model. No ECFE data or structural solver. */
(function(root){
 'use strict';
 const defaults=()=>({version:1,project:'规则柱网教学项目',geometry:{nx:3,ny:2,sx:6,sy:6,floors:3,height:3.6},loads:{dead:1.5,live:3,location:'未指定',use:'办公（演示）'},rates:{concrete:250,steel:1,concreteCost:'',steelCost:'',currency:'CNY',source:'教学假设，非 EPD 或 Concept 默认值'},schemes:[
  {id:'A',name:'平板方案 · 基准',type:'flat',slab:250,column:450,beamWidth:300,beamDepth:600,rebar:100},
  {id:'B',name:'平板方案 · 减薄试算',type:'flat',slab:220,column:450,beamWidth:300,beamDepth:600,rebar:100},
  {id:'C',name:'梁板方案 · 对照',type:'beam',slab:180,column:450,beamWidth:300,beamDepth:600,rebar:120}
 ]});
 const num=x=>x===null||x===undefined||String(x).trim()===''?NaN:Number(x);
 function range(x,min,max,integer=false){const v=num(x);return Number.isFinite(v)&&v>=min&&v<=max&&(!integer||Number.isInteger(v));}
 function calculate(state,s){
  const g=state.geometry,r=state.rates,issues=[];
  for(const [k,min,max,int,label] of [['nx',1,8,true,'X 向跨数'],['ny',1,8,true,'Y 向跨数'],['sx',2,12,false,'X 向跨度'],['sy',2,12,false,'Y 向跨度'],['floors',1,15,true,'悬空楼板层数'],['height',2,6,false,'层高']])if(!range(g[k],min,max,int))issues.push(`${label}须在 ${min}–${max} 之间${int?'且为整数':''}（演示输入范围，非规范限值）。`);
  for(const [k,min,max,label] of [['slab',80,800,'板厚'],['column',150,1500,'柱宽'],['rebar',0,600,'钢筋估算率']])if(!range(s[k],min,max))issues.push(`${s.id}：${label}须在 ${min}–${max} 之间（试算输入范围）。`);
  if(!['flat','beam'].includes(s.type))issues.push('未知方案类型。');
  if(s.type==='beam'){
   if(!range(s.beamWidth,100,1500)||!range(s.beamDepth,100,2000))issues.push(`${s.id}：梁尺寸不在演示输入范围。`);
   if(num(s.beamWidth)>num(s.column))issues.push(`${s.id}：本简化模型仅支持梁宽不大于柱宽。`);
   if(num(s.beamDepth)<=num(s.slab)||num(s.beamDepth)/1000>=num(g.height))issues.push(`${s.id}：梁总高须大于板厚且小于层高。`);
  }
  if(issues.length)return {id:s.id,name:s.name,issues,valid:false,carbon:null,cost:null};
  const nx=+g.nx,ny=+g.ny,n=+g.floors,L=nx*g.sx,W=ny*g.sy,t=s.slab/1000,c=s.column/1000,area=L*W*n;
  const slabVolume=area*t,columnCount=(nx+1)*(ny+1)*n,columnVolume=columnCount*c*c*(g.height-t);
  // Column centres at outer edges are inset by half a column; net beam lengths
  // exclude column footprints. Only the beam web BELOW the slab is counted.
  const beamLength=((L-(nx+1)*c)*(ny+1)+(W-(ny+1)*c)*(nx+1))*n;
  const beamVolume=s.type==='beam'?beamLength*(s.beamWidth/1000)*((s.beamDepth-s.slab)/1000):0;
  const concrete=slabVolume+columnVolume+beamVolume,steel=concrete*s.rebar;
  const factorOK=range(r.concrete,0,10000)&&range(r.steel,0,100);
  const priceOK=range(r.concreteCost,0,1e7)&&range(r.steelCost,0,1e7);
  const carbon=factorOK?concrete*r.concrete+steel*r.steel:null,cost=priceOK?concrete*r.concreteCost+steel*r.steelCost:null;
  return {id:s.id,name:s.name,valid:true,issues,area,L,W,columnCount,slabVolume,columnVolume,beamVolume,concrete,steel,carbon,cost,intensity:carbon===null?null:carbon/area,parts:factorOK?[slabVolume,columnVolume,beamVolume].map(v=>v*r.concrete+v*s.rebar*r.steel):null,structuralStatus:'not_checked'};
 }
 function rank(results,key){return [...results].sort((a,b)=>{const av=a[key],bv=b[key];return av===null||av===undefined?bv===null||bv===undefined?0:1:bv===null||bv===undefined?-1:av-bv;});}
 const api={defaults,calculate,rank,num};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ConceptCore=api;
})(typeof window!=='undefined'?window:globalThis);
