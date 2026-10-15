(function(){
 'use strict';
 const C=window.ConceptCore,$=id=>document.getElementById(id),key='carbonloop-concept-study-v1';
 let state=C.defaults(),step=0,view='plan',selected='A',storageError=false;
 try{
  const raw=JSON.parse(localStorage.getItem(key)||'null');
  if(raw){
   const scalar=v=>typeof v==='string'||typeof v==='number';
   const fields=(obj,template)=>obj&&Object.keys(template).every(k=>scalar(obj[k]));
   if(raw.version!==1||typeof raw.project!=='string'||!fields(raw.geometry,state.geometry)||!fields(raw.loads,state.loads)||!fields(raw.rates,state.rates)||!Array.isArray(raw.schemes)||raw.schemes.length!==3||!raw.schemes.every((s,i)=>fields(s,state.schemes[i])&&s.id===state.schemes[i].id&&s.type===state.schemes[i].type&&typeof s.name==='string'))throw Error('Invalid saved study');
   state=raw;
  }
 }catch{storageError=true;}
 const fmt=(n,d=1)=>n===null||n===undefined||!Number.isFinite(n)?'—':n.toLocaleString('zh-CN',{maximumFractionDigits:d});
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const descriptions=[['建筑几何','先说明这栋建筑有多少跨、多少层，以及每跨有多大。'],['使用条件','记录各方案共同面对的地点、用途与荷载要求。'],['方案与因子','用同一套因子，试算不同楼板和梁柱尺寸的材料用量。'],['结果对比','比较材料、碳小计与已填写的材料费，再保留讨论结果。']];
 function get(path){return path.split('.').reduce((o,k)=>o[k],state);}
 function set(path,value){const a=path.split('.'),last=a.pop();a.reduce((o,k)=>o[k],state)[last]=value;}
 function save(){try{localStorage.setItem(key,JSON.stringify(state));storageError=false;$('saveState').textContent='已保存在此浏览器 · 不上传';}catch{storageError=true;$('saveState').textContent='浏览器未允许保存 · 刷新将丢失';}}
 function initFields(){document.querySelectorAll('[data-path]').forEach(el=>el.value=get(el.dataset.path)??'');}
 function editors(){
  $('schemeEditors').innerHTML=state.schemes.map((s,i)=>`<article class="scheme-card"><h4><b>${s.id}</b>${esc(s.name)}</h4><div class="fields">${[
   ['slab','楼板厚度','mm',80,800],['column','方柱边长','mm',150,1500],...(s.type==='beam'?[['beamWidth','梁宽','mm',100,1500],['beamDepth','梁总高（含板厚）','mm',100,2000]]:[]),['rebar','钢筋估算率','kg/m³ 混凝土',0,600]
  ].map(([p,label,unit,min,max])=>`<label>${label}<small>${unit}</small><input data-scheme="${i}" data-field="${p}" type="number" min="${min}" max="${max}" step="1" value="${esc(s[p])}" aria-label="${s.id} ${label}"></label>`).join('')}</div></article>`).join('');
 }
 function navigate(n){step=n;document.querySelectorAll('[data-panel]').forEach(e=>e.hidden=+e.dataset.panel!==step);document.querySelectorAll('[data-step]').forEach(e=>{if(+e.dataset.step===step)e.setAttribute('aria-current','step');else e.removeAttribute('aria-current');});$('stepCount').textContent=`STEP 0${step+1} / 04`;$('stepTitle').textContent=descriptions[step][0];$('stepDescription').textContent=descriptions[step][1];$('next').textContent=step===3?'← 返回建筑几何':'下一步 →';render();}
 const line=(x1,y1,x2,y2,color='#74998b',w=1,dash='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" ${dash?'stroke-dasharray="'+dash+'"':''}/>`;
 const rect=(x,y,w,h,fill,stroke='none')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"/>`;
 const text=(x,y,value)=>`<text class="dimension" x="${x}" y="${y}" text-anchor="middle">${esc(value)}</text>`;
 function draw(s,r){
  if(!r.valid){$('preview').innerHTML=text(320,190,'请先修正输入，才能生成示意');$('viewCaption').textContent='几何输入不完整，未显示旧模型。';return;}
  const g=state.geometry,nx=+g.nx,ny=+g.ny,n=+g.floors,L=r.L,W=r.W,h=+g.height,c=s.column/1000,t=s.slab/1000,bw=s.beamWidth/1000,bh=s.beamDepth/1000;
  const xs=Array.from({length:nx+1},(_,i)=>i===0?c/2:i===nx?L-c/2:i*g.sx),ys=Array.from({length:ny+1},(_,i)=>i===0?c/2:i===ny?W-c/2:i*g.sy);
  let out='';
  if(view==='plan'){
   const scale=Math.min(480/L,260/W),ox=(640-L*scale)/2,oy=(370-W*scale)/2;
   out+=rect(ox,oy,L*scale,W*scale,'#e0ece4','#a6c1b1');
   xs.forEach(x=>out+=line(ox+x*scale,oy-12,ox+x*scale,oy+W*scale+12,'#93aa9e',1,'4 4'));ys.forEach(y=>out+=line(ox-12,oy+y*scale,ox+L*scale+12,oy+y*scale,'#93aa9e',1,'4 4'));
   if(s.type==='beam'){xs.forEach(x=>out+=rect(ox+(x-bw/2)*scale,oy,bw*scale,W*scale,'#729c88'));ys.forEach(y=>out+=rect(ox,oy+(y-bw/2)*scale,L*scale,bw*scale,'#729c88'));}
   xs.forEach(x=>ys.forEach(y=>out+=rect(ox+(x-c/2)*scale,oy+(y-c/2)*scale,c*scale,c*scale,'#245c50')));
   out+=text(320,oy-22,`X 外轮廓 ${fmt(L)} m / ${nx} 跨`)+text(320,oy+W*scale+35,`Y 外轮廓 ${fmt(W)} m / ${ny} 跨`);
  }else if(view==='section'){
   const scale=Math.min(500/L,275/(n*h)),ox=(640-L*scale)/2,base=332;
   out+=line(ox-20,base,ox+L*scale+20,base,'#a2aba2');
   for(let f=1;f<=n;f++){const top=base-f*h*scale;xs.forEach(x=>out+=rect(ox+(x-c/2)*scale,top+t*scale,c*scale,(h-t)*scale,'#729c88'));if(s.type==='beam')out+=rect(ox,top+t*scale,L*scale,(bh-t)*scale,'#92b3a0');out+=rect(ox,top,L*scale,t*scale,'#b8d6cb','#689682');}
   out+=text(320,32,`${n} 层 × ${fmt(h)} m`)+text(320,365,`X 向剖面 / 板厚 ${fmt(+s.slab,0)} mm${s.type==='beam'?' / 梁总高 '+fmt(+s.beamDepth,0)+' mm':''}`);
  }else{
   const project=(x,y,z)=>[x-y*.65,(x+y)*.3-z];
   const corners=[[0,0,0],[L,0,0],[0,W,0],[L,W,0],[0,0,n*h],[L,0,n*h],[0,W,n*h],[L,W,n*h]].map(p=>project(...p));
   const minX=Math.min(...corners.map(p=>p[0])),maxX=Math.max(...corners.map(p=>p[0])),minY=Math.min(...corners.map(p=>p[1])),maxY=Math.max(...corners.map(p=>p[1]));const sc=Math.min(510/(maxX-minX),295/(maxY-minY));
   const p=(x,y,z)=>{const a=project(x,y,z);return [65+(a[0]-minX)*sc,42+(a[1]-minY)*sc];};
   const segment=(a,b,color,width)=>{const aa=p(...a),bb=p(...b);return line(...aa,...bb,color,width);};
   for(let f=1;f<=n;f++){
    xs.forEach(x=>ys.forEach(y=>out+=segment([x,y,(f-1)*h],[x,y,f*h-t],'#245c50',Math.max(1,c*sc))));
    if(s.type==='beam'){xs.forEach(x=>out+=segment([x,0,f*h-t],[x,W,f*h-t],'#729c88',3));ys.forEach(y=>out+=segment([0,y,f*h-t],[L,y,f*h-t],'#729c88',3));}
    out+=`<polygon points="${[[0,0],[L,0],[L,W],[0,W]].map(([x,y])=>p(x,y,f*h).join(',')).join(' ')}" fill="#bad9c9" fill-opacity=".45" stroke="#78a18b"/>`;
   }
   out+=text(320,375,'轴测示意 / 非结构分析模型');
  }
  $('preview').innerHTML=out;$('viewCaption').textContent='外边柱内收半个柱宽以保持相同建筑外轮廓；未绘制钢筋、连接、基础或开洞。';
 }
 function table(results){return `<table><thead><tr><th>方案 / 未校核</th><th>混凝土<small>m³</small></th><th>钢筋估算<small>t</small></th><th>碳小计<small>t CO₂e</small></th><th>材料费<small>${esc(state.rates.currency)}</small></th></tr></thead><tbody>${results.map(r=>`<tr><td><button class="table-link" data-select="${r.id}"><strong>${r.id} / ${esc(r.name.split(' · ')[0])}</strong><small>${r.valid?'手动设定尺寸':'输入待修正'}</small></button></td><td>${fmt(r.concrete)}</td><td>${fmt(r.steel===undefined?null:r.steel/1000,2)}</td><td>${fmt(r.carbon===null?null:r.carbon/1000,2)}</td><td>${fmt(r.cost,0)}</td></tr>`).join('')}</tbody></table>`;}
 function report(results){
  const g=state.geometry,l=state.loads,r=state.rates,now=new Date().toLocaleString('zh-CN');
  const issues=results.flatMap(x=>x.issues);
  $('printReport').innerHTML=`<h1>CarbonLoop · 概念方案讨论报告</h1><p>${esc(state.project)} / ${esc(now)}</p><p><b>学习试算，非结构设计报告。</b>尺寸、配筋率及默认碳因子是教学假设；无安全校核或自动优化。</p><h2>01 / 共同输入</h2><p>X：${esc(g.nx)} 跨 × ${esc(g.sx)} m；Y：${esc(g.ny)} 跨 × ${esc(g.sy)} m；${esc(g.floors)} 层悬空楼板；层高 ${esc(g.height)} m。${esc(l.location)} / ${esc(l.use)}；附加恒荷载 ${esc(l.dead)}、活荷载 ${esc(l.live)} kN/m²，仅记录、未用于设计。</p><h2>02 / 尺寸与假设</h2><table><thead><tr><th>方案</th><th>板厚 mm</th><th>柱宽 mm</th><th>梁宽×总高 mm</th><th>钢筋率 kg/m³</th></tr></thead><tbody>${state.schemes.map(s=>`<tr><td>${s.id} ${esc(s.name)}</td><td>${esc(s.slab)}</td><td>${esc(s.column)}</td><td>${s.type==='beam'?esc(s.beamWidth)+'×'+esc(s.beamDepth):'不设梁'}</td><td>${esc(s.rebar)}</td></tr>`).join('')}</tbody></table><p>混凝土碳因子 ${esc(r.concrete)} kg CO₂e/m³；钢筋碳因子 ${esc(r.steel)} kg CO₂e/kg。来源：${esc(r.source)||'未填写'}。材料单价：混凝土 ${esc(r.concreteCost)||'未填'} ${esc(r.currency)}/m³；钢筋 ${esc(r.steelCost)||'未填'} ${esc(r.currency)}/kg。</p><h2>03 / 结果</h2>${table(results)}<p>— 代表输入缺失或无效，不代表 0。工期未估算。${esc(issues.join(' '))}</p><h2>04 / 数量公式与边界</h2><p>楼板量＝外轮廓面积×板厚×层数。柱量＝每层柱数×柱截面×（层高−板厚）×层数。梁量只计柱面之间、楼板下方的梁体积，避免重叠。钢筋量＝混凝土量×假设估算率；没有扣除钢筋占据的体积。碳小计＝混凝土量×混凝土因子＋钢筋量×钢筋因子。</p><p>仅含示意悬空楼板与梁柱。基础、地面板、屋面、楼梯、墙体、洞口、其他材料和真实生命周期阶段覆盖未验证；费用仅为两种材料费用。未验证承载力、冲切、变形、抗震、连接、施工与法规符合性。荷载不驱动本版尺寸或配筋。</p><h2>05 / 讨论重点</h2><p>请确认几何范围、候选尺寸与钢筋率是否适合研究；下一步应先取得同口径的真实材料因子及可验证的尺寸选型依据，再讨论“可采用”的方案。</p><p>流程参考：https://www.concretecentre.com/concept 。本页为独立编写的学习原型，未使用 Concept 代码、数据库或计算结果。</p>`;
 }
 function render(){
  const results=state.schemes.map(s=>C.calculate(state,s)),r=results.find(x=>x.id===selected),s=state.schemes.find(x=>x.id===selected),g=state.geometry;
  const any=results.find(x=>x.valid);$('geometrySummary').innerHTML=any?`<span>单层轮廓面积<b>${fmt(any.L*any.W)} m²</b></span><span>悬空楼板面积合计<b>${fmt(any.area)} m²</b></span>`:'<span>请修正几何或方案尺寸，面积暂不可用。</span>';
  $('previewName').textContent=`${s.id} / ${s.name}`;$('liveCarbon').textContent=r.carbon===null?'—':fmt(r.carbon/1000,2);
  $('liveQuantities').innerHTML=r.valid?`<dl><dt>混凝土</dt><dd>${fmt(r.concrete)} m³</dd><dt>钢筋 · 按假设率</dt><dd>${fmt(r.steel/1000,2)} t</dd><dt>单位悬空楼板面积小计</dt><dd>${fmt(r.intensity)} kg CO₂e/m²</dd><dt>结构可用性</dt><dd>未验证</dd></dl>`:'';
  let warnings=[...r.issues];if(r.valid&&r.carbon===null)warnings.push('碳因子缺失或无效，暂不计算碳小计。');
  if(!Number.isFinite(C.num(state.loads.dead))||C.num(state.loads.dead)<0||C.num(state.loads.dead)>100||!Number.isFinite(C.num(state.loads.live))||C.num(state.loads.live)<0||C.num(state.loads.live)>100)warnings.push('荷载记录缺失或不在 0–100 输入范围；数量试算不受此记录影响。');
  if(!String(state.rates.source||'').trim())warnings.push('因子来源说明未填写。');$('validation').textContent=warnings.join(' ');
  draw(s,r);$('resultTable').innerHTML=table(C.rank(results,$('sort').value));
  const max=Math.max(0,...results.map(x=>x.carbon??0));$('chart').innerHTML=results.map(x=>`<div class="chart-row"><span>${x.id}</span><div class="chart-track"><div class="chart-fill" style="width:${x.carbon===null||!max?0:x.carbon/max*100}%"></div></div><b>${x.carbon===null?'—':fmt(x.carbon/1000,2)+' t'}</b></div>`).join('');
  const a=results[0],b=results[1];let message='输入完整后，查看 B 相对 A 的情景差。';
  if(a.carbon!==null&&b.carbon!==null){const d=b.carbon-a.carbon;message=`在相同几何和因子下，B 比 A ${d>0?'增加':d<0?'减少':'变化'} ${fmt(Math.abs(d)/1000,2)} t CO₂e${a.carbon>0?'（'+fmt(Math.abs(d/a.carbon)*100,1)+'%）':''}。这是尺寸及假设钢筋量变化带来的数量差，不证明 B 能承受相同荷载。`;}
  $('comparisonText').textContent=message+(results.some(x=>x.cost===null)?' 材料单价未填全或无效，对应费用保持空缺。':' 材料费不包含模板、人工、基础及施工时间成本。');
  report(results);
 }
 document.addEventListener('input',e=>{const el=e.target;if(el.dataset.path){set(el.dataset.path,el.value);save();render();}else if(el.dataset.scheme!==undefined){state.schemes[+el.dataset.scheme][el.dataset.field]=el.value;save();render();}});
 document.addEventListener('click',e=>{const stepButton=e.target.closest('[data-step]'),viewButton=e.target.closest('[data-view]'),choose=e.target.closest('[data-select]');if(stepButton)navigate(+stepButton.dataset.step);if(viewButton){view=viewButton.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));render();}if(choose){selected=choose.dataset.select;$('previewScheme').value=selected;render();}});
 $('previewScheme').addEventListener('change',e=>{selected=e.target.value;render();});$('sort').addEventListener('change',render);$('next').addEventListener('click',()=>navigate((step+1)%4));$('print').addEventListener('click',()=>{render();window.print();});
 $('reset').addEventListener('click',()=>{if(!confirm('恢复教学示例会覆盖本浏览器中这个学习版的输入，是否继续？'))return;state=C.defaults();selected='A';$('previewScheme').value='A';initFields();editors();save();navigate(0);});
 initFields();editors();navigate(0);if(storageError)$('saveState').textContent='未能恢复记录 · 当前为教学示例';
})();
