/* A separate scenario calculator, never a patch to historical case data. */
(function(root){
 'use strict';
 const SOURCE={name:'KBOB/ecobau-Liste 2022, Version 9.0',checked:'2026-09-27',
  url:'https://www.kbob.admin.ch/fr/donnees-ecobilans-dans-la-construction',
  file:'https://www.kbob.admin.ch/dam/fr/sd-web/GUOl1trUNEVH/%C3%96kobilanzdaten_im_Baubereich_V9.0.xlsx',
  sha256:'9ae2dfecbbc188fa9ed839ddfd1dc62d4ef254e8e5457aa08c42730c78277a5b',
  sheet:'Baumaterialien Matériaux',columns:{production:'AA',disposal:'AB'},unit:'kg CO2e / kg material'};
 const MATERIALS=[
  {id:'01.002',uuid:'E13EE05E-FD34-4FB5-A178-0FC4164A96F2',name:'建筑混凝土（不含钢筋）',original:'Hochbaubeton (ohne Bewehrung)',row:38,density:2300,production:0.0887,disposal:0.0126},
  {id:'06.003',uuid:'1F33844F-91D2-4363-B328-904E15110A1C',name:'钢筋',original:'Armierungsstahl',row:186,production:0.773,disposal:0.0122}
 ];
 function calculate(inputs){
  if(!Array.isArray(inputs)||inputs.length!==MATERIALS.length)return {error:'请填写两项材料重量；不使用的材料明确填 0。',value:null};
  const values=inputs.map(v=>v===null||v===undefined||String(v).trim()===''?NaN:Number(v));
  if(values.some(v=>!Number.isFinite(v)||v<0||v>1e12))return {error:'重量须为 0 至 1 万亿之间的有效数字；空白不按 0 计算。',value:null};
  const lines=MATERIALS.map((m,i)=>({...m,mass:values[i],productionResult:values[i]*m.production,disposalResult:values[i]*m.disposal}));
  const production=lines.reduce((s,m)=>s+m.productionResult,0),disposal=lines.reduce((s,m)=>s+m.disposalResult,0);
  return {error:null,lines,production,disposal,value:production+disposal};
 }
 const api={SOURCE,MATERIALS,calculate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else{
  root.MaterialEstimate=api;
  if(!document.getElementById('concrete'))return;
  const $=id=>document.getElementById(id),fmt=n=>n.toLocaleString('zh-CN',{maximumFractionDigits:3});
  let mode='尚未输入',current;
  function render(){
   current=calculate([$ ('concrete').value,$('steel').value]);
   $('inputMode').textContent=mode;
   $('status').textContent=current.error||'计算的是所列两种材料的生产与处置小计；不是 PORR_18，也不是完整建筑全生命周期结果。';
   ['production','disposal','subtotal'].forEach((id,i)=>$(id).textContent=current.error?'—':fmt([current.production,current.disposal,current.value][i]));
   $('steps').replaceChildren();
   if(!current.error)current.lines.forEach(m=>{const li=document.createElement('li');li.textContent=`${m.name}：${fmt(m.mass)} kg × ${m.production} = ${fmt(m.productionResult)} kg CO₂e（生产）；${fmt(m.mass)} kg × ${m.disposal} = ${fmt(m.disposalResult)} kg CO₂e（处置）。`;$('steps').append(li);});
   $('exportEstimate').disabled=Boolean(current.error);
  }
  ['concrete','steel'].forEach(id=>$(id).addEventListener('input',()=>{mode='用户输入 / 未独立核验';render();}));
  $('example').addEventListener('click',()=>{$('concrete').value=1000;$('steel').value=100;mode='演示假设：1,000 kg 混凝土 + 100 kg 钢筋；不是案例实际用量';render();});
  $('clear').addEventListener('click',()=>{$('concrete').value='';$('steel').value='';mode='尚未输入';render();});
  $('exportEstimate').addEventListener('click',()=>{
   if(current.error)return;
   const payload={schema:'carbonloop-material-scenario-v1',classification:'independent_material_estimate_not_historical_case',quantity_provenance:mode,source:SOURCE,result:current,unit:'kg CO2e',scope:'KBOB manufacturing and disposal columns only; not EN module mapping or whole-building LCA',excluded:'site transport, installation, replacements, operation, other materials and separately calculated module D; not assumed zero',date:new Date().toISOString()};
   const u=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='CarbonLoop-独立材料估算.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
  });
  render();
 }
})(typeof window!=='undefined'?window:globalThis);
