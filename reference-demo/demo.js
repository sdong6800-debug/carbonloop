(function(){
 'use strict';
 const C=window.ModelCore,D=window.CarbonChange,$=id=>document.getElementById(id),fmt=(v,d=2)=>v===null||v===undefined?'—':v.toLocaleString('zh-CN',{maximumFractionDigits:d});
 const NS='http://www.w3.org/2000/svg';let A=null,B=null,active='A',selected='S01',step=1,reviewed=null,direction='slab',entryRecord=null;
 let candidateAudit=null,carbonExplanation=null,carbonExplainBusy=false;
 const current=()=>active==='A'?A:B;
 const label=id=>id==='A'?'当前模型':'改进草案';
 const S=window.StructurePreparation;
 const workspace=document.querySelector('.workspace'),resultPanel=document.querySelector('.results');
 const report=document.createElement('section');report.id='carbonReport';report.className='carbon-report';report.setAttribute('aria-labelledby','carbonReportTitle');
 report.innerHTML='<div class="report-heading"><div><p class="eyebrow">CARBON ANALYSIS / 碳分析结果</p><h2 id="carbonReportTitle" tabindex="-1">初步碳分析结果</h2><p id="reportState" role="status"></p></div><span id="reportConfirmation" class="mini-tag"></span></div><div class="report-overview"><div id="reportTotals"></div><section class="panel report-stages"><h3>各阶段：算了哪些，哪些还没算？</h3><p class="help">以下按工作内容列出覆盖情况；不是完整生命周期核算，也不将来源的“处置”擅自拆成规范阶段。</p><div class="tablewrap"><table><thead><tr><th>阶段 / 内容</th><th>kg CO₂e</th><th>计算状态</th></tr></thead><tbody id="reportStages"></tbody></table></div></section></div><section class="panel report-components"><div class="panelhead"><h3>每个构件的排放明细</h3><span class="help">“已确认材料”和“能算出排放”分开显示</span></div><div class="tablewrap"><table><thead><tr><th>楼层 / 构件</th><th>材料类别</th><th>材料核对</th><th>体积 m³</th><th>生产 kg CO₂e</th><th>处置 kg CO₂e</th><th>小计 kg CO₂e</th><th>计算依据 / 缺项</th><th>查看</th></tr></thead><tbody id="reportComponents"></tbody></table></div><p class="help">未建模钢筋等内容不会自动补出数量；已知小计不是完整建筑排放。</p></section><section class="panel report-ai"><div class="panelhead"><div><p class="eyebrow">AI EXPLANATION / 技术解释</p><h3>让 AI 解释这份结果</h3></div><span class="mini-tag">只解释 · 不代替计算</span></div><p>程序先完成计算，再把材料分组、覆盖率和缺项摘要交给 AI。AI 不接管公式，也不能把已知小计说成整栋建筑总量。</p><label class="ai-consent"><input id="reportExplainConsent" type="checkbox">同意发送本次碳结果摘要给已配置的大模型；不发送 Rhino 文件、几何模型或 API 密钥。</label><div class="flow-actions"><button id="reportExplain" disabled>请 AI 解释已知小计</button><span id="reportExplainStatus" class="help" role="status">尚未调用 AI。</span></div><div id="reportExplanation" hidden><h4 id="reportExplainSummary"></h4><p id="reportExplainCoverage"></p><div class="report-explain-grid"><div><b>主要来源</b><ul id="reportExplainDrivers"></ul></div><div><b>边界与缺项</b><ul id="reportExplainLimits"></ul></div><div><b>下一步</b><ul id="reportExplainNext"></ul></div></div></div></section><section class="panel report-next"><h3>看完结果，再探索减排</h3><p>之后的 AI 助手应基于模型数量、已匹配的碳数据和改动限制提出建议；计算工具复算，建筑师选择是否建立改进草案。</p><p class="help">下一步可查看 AI 接口状态；未配置时可用明确标记的规则试算或手动探索。建议必须经你确认，计算由程序复算，不代表结构安全。</p><button id="reportExplore">探索改进 →</button></section>';
 const modelDetails=document.createElement('details');modelDetails.id='resultModelDetails';modelDetails.className='result-model-details';
 modelDetails.innerHTML='<summary>展开模型与构件详情（可选，不需要重新核验）</summary>';
 $('app').append(report,modelDetails);modelDetails.append(workspace);
 $('reportExplore').addEventListener('click',()=>go(2));
 const carbonSummary=()=>{const r=C.calculate(A||[]),groups=new Map();for(const line of r.lines){const key=line.material||'unknown',g=groups.get(key)||{material:C.materialInfo(key).name,count:0,known:0,value:0,production:0,disposal:0,status:new Set(),factorIds:new Set()};g.count++;if(line.error)g.status.add(line.error);else{g.known++;g.value+=line.value;g.production+=line.production;g.disposal+=line.disposal;g.factorIds.add(line.factor.id);}groups.set(key,g);}return {report:{total:r.value,production:r.production,disposal:r.disposal,known:r.known,count:r.total,scope:'KBOB 来源中的材料生产＋处置汇总列；非完整生命周期',source:C.factorSource.name},groups:[...groups.values()].map(g=>({...g,status:g.status.size?[...g.status].join('；'):'已计算',factorIds:[...g.factorIds],value:g.known?g.value:null,production:g.known?g.production:null,disposal:g.known?g.disposal:null}))};};
 function showCarbonExplanation(data,signature){carbonExplanation={...data,signature};$('reportExplainSummary').textContent=data.answer.summary;$('reportExplainCoverage').textContent=data.answer.coverage;for(const [id,values] of [['reportExplainDrivers',data.answer.drivers],['reportExplainLimits',data.answer.limitations],['reportExplainNext',data.answer.nextSteps]]){$(id).replaceChildren(...values.map(value=>{const li=document.createElement('li');li.textContent=value;return li;}));}$('reportExplanation').hidden=false;$('reportExplainStatus').textContent=`${data.provider} / ${data.model} · 已解释；数值仍来自程序。`;}
 async function explainCarbon(){if(carbonExplainBusy||!$('reportExplainConsent').checked||!A)return;carbonExplainBusy=true;$('reportExplain').disabled=true;$('reportExplainStatus').textContent='正在发送结果摘要并生成解释…';const summary=carbonSummary(),signature=JSON.stringify(summary);try{const response=await fetch('http://127.0.0.1:8514/carbon-explain',{method:'POST',signal:AbortSignal.timeout(50000),headers:{'Content-Type':'application/json','X-CarbonLoop':'1'},body:JSON.stringify(summary)}),data=await response.json();if(!response.ok)throw Error(data.error||'AI 解释失败');if(signature!==JSON.stringify(carbonSummary()))throw Error('结果已变化，请重新解释。');showCarbonExplanation(data,signature);}catch(error){$('reportExplainStatus').textContent=error.name==='TimeoutError'?'AI 响应超时，请重试。':error.message;}finally{carbonExplainBusy=false;$('reportExplain').disabled=!$('reportExplainConsent').checked;}}
 $('reportExplainConsent').addEventListener('change',()=>{$('reportExplain').disabled=carbonExplainBusy||!$('reportExplainConsent').checked;});$('reportExplain').addEventListener('click',explainCarbon);
 const materialConfirmed=e=>{const record=entryRecord?.records?.find(r=>r.id===e.id);return !!record?.materialConfirmed&&record.material===e.material&&e.material!=='unknown';};
 function resultReport(r){
  const showing=step===1;report.hidden=!showing;modelDetails.hidden=!showing;
  if(showing){$('reportTotals').append(resultPanel);modelDetails.append(structureAction,document.querySelector('.review-button'),workspace);}
  else{workspace.append(resultPanel);resultPanel.append(document.querySelector('.review-button'));$('flowBack').before(structureAction);$('app').append(workspace);}
  const n=current().filter(materialConfirmed).length;
  $('missing').textContent=r.complete?'所有所选构件已有本版计算依据；仍不包含其他材料和生命周期阶段。':`材料已确认 ${n} / ${r.total} 个；${r.total-r.known} 个构件尚缺计算依据。请看下方明细中的具体原因，当前不能输出完整排放总量。`;
  resultPanel.querySelector('.total-result>span').textContent=r.value===null?'暂无法计算排放':'已计入部分小计';
  resultPanel.querySelector('.total-result small').textContent='kg CO₂e · 仅汇总有依据的生产＋处置';
  $('reportConfirmation').textContent='材料已确认 '+n+' / '+r.total+' 个';
  $('reportState').textContent=r.value===null?'尚无可计算排放：材料分类可以已确认，但碳因子、密度或其他计算资料尚未接通。缺项不按零排放处理。':r.complete?'当前所选构件的各材料生产＋处置已计算；其余材料和阶段见下表，不是全生命周期总量。':'已算出部分构件的小计；其余缺项单独列出，不当作零排放。';
  const stages=[['材料生产',r.value===null?null:r.production,r.known?'已计入 '+r.known+' / '+r.total+' 个构件':'待接入各材料碳因子及换算数据'],['运到工地',null,'未计入 · 缺运输距离与方式'],['现场施工',null,'未计入 · 缺施工能耗及损耗'],['使用、维护与更换',null,'未计入 · 缺寿命与更换情景'],['运行能耗与用水',null,'未计入 · 缺运行数据'],['寿命结束后的处置',r.value===null?null:r.disposal,r.known?'来源的处置汇总列 · '+r.known+' / '+r.total+' 个构件；未分解处置步骤':'待接入处置因子与情景'],['回收 / 再利用的潜在收益',null,'未计入 · 缺回收与替代情景，不抵扣']];
  $('reportStages').replaceChildren();stages.forEach(values=>{const tr=document.createElement('tr');values.forEach((v,i)=>{const td=document.createElement('td');td.textContent=i===1?fmt(v):v;tr.append(td);});$('reportStages').append(tr);});
  $('reportComponents').replaceChildren();
  r.lines.forEach(e=>{const tr=document.createElement('tr');tr.dataset.resultId=e.id;
   const issue=!e.error?`KBOB ${e.factor.id} · 瑞士参考代理；${e.referenceNote}`:e.error;
   [e.floor+' / '+e.name+' '+e.id,C.materialInfo(e.material).name,materialConfirmed(e)?'已确认':'待核对 / 已改变',fmt(e.volume,3),fmt(e.production),fmt(e.disposal),fmt(e.value),issue].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});
   const td=document.createElement('td'),button=document.createElement('button');button.className='outline';button.textContent='定位 / 计算依据';button.setAttribute('aria-label','在模型中查看 '+e.id);button.addEventListener('click',()=>{selected=e.id;render();modelDetails.open=true;$('model').scrollIntoView({block:'center'});});td.append(button);tr.append(td);$('reportComponents').append(tr);
   if(!e.error){const detail=document.createElement('details'),summary=document.createElement('summary'),p=document.createElement('p');summary.textContent='展开数量、因子与来源';p.textContent=`${e.quantityBasis} 净计量体积 ${fmt(e.volume,5)} m³ × ${e.factor.density} kg/m³ = ${fmt(e.mass,3)} kg；生产 × ${e.factor.production}，处置 × ${e.factor.disposal} kg CO₂e/kg。来源：${e.factor.original}；${C.factorSource.name} / ${C.factorSource.sheet} / ${e.factor.cells.density}、${e.factor.cells.production}、${e.factor.cells.disposal}。${e.factor.conversionNote||''} 生物碳含量单列，不抵扣本小计。`;detail.append(summary,p);tr.children[7].append(detail);}
  });
 }
 // Classification names are not interchangeable carbon factors.
 $('material').replaceChildren();
 for(const family of [...new Set(C.materials.map(m=>m.group))]){const group=document.createElement('optgroup');group.label=family;for(const m of C.materials.filter(m=>m.group===family)){const opt=document.createElement('option');opt.value=m.id;opt.textContent=m.name;group.append(opt);}$('material').append(group);}
 $('material').nextElementSibling.textContent='已接入混凝土、钢材、木材、砌体、平板玻璃、铝型材、石膏板和天然石材的瑞士参考因子。每项列明代理假设；保温与未细分饰面继续显示缺项。';
 const factorTable=document.createElement('table');factorTable.innerHTML=`<caption>已核对的 ${C.factors.length} 条来源记录 · 因子单位 kg CO₂e/kg</caption><thead><tr><th>KBOB 条目 / 原名</th><th>密度 kg/m³</th><th>生产</th><th>处置</th><th>原表行号</th></tr></thead><tbody></tbody>`;
 C.factors.forEach(f=>{const tr=document.createElement('tr');[f.id+' / '+f.original,f.density,f.production,f.disposal,f.row].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});factorTable.tBodies[0].append(tr);});
 const factorWrap=document.createElement('div');factorWrap.className='tablewrap';factorWrap.append(factorTable);$('evidence').querySelector('.dialog-body').append(factorWrap);
 const structureAction=document.createElement('button');structureAction.className='outline';structureAction.id='flowStructure';structureAction.textContent='查看模型信息与结构准备';
 $('flowBack').before(structureAction);structureAction.addEventListener('click',()=>$('structure').showModal());
 const snapshot=()=>JSON.stringify({A,B,inputs:['A','B'].map(id=>{const r=S.exportState(id,id==='A'?A:B).inputs;return {values:r.values,confirmations:r.confirmations};})});
 $('editCandidateStructure').textContent='查看信息与结构协作清单 ↗';
 function workflow(){
  if(!A)return;
  $('app').dataset.step=step;
  const guide={1:['01 / 查看结果','初步碳分析结果','先看当前模型的排放、阶段覆盖和构件明细；核验记录已经保留，不需要再确认一遍。','探索改进 →'],2:['02 / 选择改动','从一个明确的改动开始','创建一次草案，模型和已填结构条件一起继承。不需要分别复制；未知信息不会被自动补成已知。',B?'继续编辑候选 →':''],3:['03 / 调整并看变化','改尺寸，看碳排增减',`选择楼板、柱或墙，拖动或输入尺寸；右侧立即对比修改前后。范围是本次选中的 ${A.length} 个构件，不是整栋建筑。`,'查看汇总与保留 →'],4:['04 / 对比与保留','看清变化，也看清尚未验证的部分','这里展示同一版草案的碳排、结构输入与待办。可以下载留给老师讨论，不能把减排数字当作安全结论。','下载待验证草案 ↓']}[step];
  ['flowKicker','flowTitle','flowDescription','flowNext'].forEach((id,i)=>$(id).textContent=guide[i]);
  $('flowNext').hidden=!guide[3];$('flowBack').hidden=step===1;
  structureAction.hidden=step===2||step===4;
  $('explore').hidden=step!==2;$('copy').hidden=!!B;$('candidateExists').hidden=!B;
  $('candidateReview').hidden=step!==4;
  document.querySelectorAll('[data-step]').forEach(b=>{const n=Number(b.dataset.step);b.disabled=n>=3&&!B;b.setAttribute('aria-current',n===step?'step':'false');});
  if(!B)return;
  const carbon=C.compare(A,B),summary=S.summary('B',B),original=S.summary('A',A),changed=S.differences(),stale=reviewed!==null&&reviewed!==snapshot();
  $('reviewState').textContent=stale?'已修改 · 需重新检查':reviewed===null?'待检查':'已检查输入 · 未完成结构验证';
  $('carbonReview').textContent=carbon.compatible?`各材料生产＋处置可试算：${fmt(carbon.B.value)} kg CO₂e。其余阶段及钢筋未计入。`:'材料或几何存在缺项：仅展示已知小计，暂停差值比较。';
  const intake=S.intake('B',B),pending=intake.professional_groups.filter(g=>g.missing.length).length;
  $('engineeringReview').textContent=`已从示例取得 ${intake.element_count} 个构件的几何与属性；${intake.classifications_confirmed&&intake.carbon_mapping_confirmed?'示例分类与碳材料映射已人工确认。':'分类与碳材料映射待分组确认。'}${pending?`${pending} 类专业资料待补充，可下载协作清单交给结构工程师。`:'专业资料已有记录，仍待核实。'}${summary.stale?'模型或输入已变化，原检查失效。':''}两者均未运行结构求解。`;
  $('conditionsReview').textContent=changed.length?`注意：候选的 ${changed.join('、')} 与当前模型不同。仅可查看碳数值差，不作同使用条件下的减排结论。`:'候选与当前模型的结构输入当前一致（包括仍为空的字段）；一致不代表已核实或已通过结构校核。';
  $('reviewIssues').replaceChildren();
  [...summary.issues,'待接入：分析模型、结构求解器及规范校核；需结构专业复核。'].forEach(text=>{const li=document.createElement('li');li.textContent=text;$('reviewIssues').append(li);});
 }
 function go(n){
  if(n===2){if(!B){if(!S.createCandidate())return;B=C.clone(A);direction='workspace';selected=B.some(e=>e.id===selected)?selected:B[0].id;$('tabB').disabled=false;}n=3;}
  if(n>=3&&!B)return;step=n;active=n<=2?'A':'B';render();$('flowTitle').scrollIntoView({block:'nearest'});
 }
 function inspectCandidate(){S.checkScheme('A',A);S.checkScheme('B',B);reviewed=snapshot();workflow();}
 function node(tag,attrs,text){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text)e.textContent=text;return e;}
 function point(x,y,z){const data=current()||[],minX=Math.min(...data.map(e=>e.x)),minY=Math.min(...data.map(e=>e.y)),minZ=Math.min(...data.map(e=>e.z)),maxX=Math.max(...data.map(e=>e.x+e.l)),maxY=Math.max(...data.map(e=>e.y+e.w)),maxZ=Math.max(...data.map(e=>e.z+e.h));const dx=Math.max(maxX-minX,.01),dy=Math.max(maxY-minY,.01),dz=Math.max(maxZ-minZ,.01),scale=Math.min(58,390/(dx+dy),220/(dz+(dx+dy)*.12));return [350+((x-minX)-(y-minY))*scale*.72,365-((z-minZ)*scale)+((x-minX)+(y-minY))*scale*.15];}
 function poly(points,attrs){return node('polygon',{points:points.map(p=>point(...p).join(',')).join(' '),...attrs});}
 function model(){
  const svg=$('model');svg.replaceChildren();
  const bounds=current(),minX=Math.min(...bounds.map(e=>e.x)),minY=Math.min(...bounds.map(e=>e.y)),minZ=Math.min(...bounds.map(e=>e.z)),maxX=Math.max(...bounds.map(e=>e.x+e.l)),maxY=Math.max(...bounds.map(e=>e.y+e.w)),pad=Math.max(maxX-minX,maxY-minY,.2)*.08;
  svg.append(poly([[minX-pad,minY-pad,minZ],[maxX+pad,minY-pad,minZ],[maxX+pad,maxY+pad,minZ],[minX-pad,maxY+pad,minZ]],{fill:'#203038',stroke:'#41555d'}));
  const data=C.calculate(current()),max=Math.max(...data.lines.filter(e=>!e.error).map(e=>e.value),1);
  [...data.lines].sort((a,b)=>a.z-b.z||(a.x+a.y)-(b.x+b.y)).forEach(e=>{
   const color=e.error?'#89949d':$('heat').checked?(e.value/max>.5?'#dda268':'#89cdb7'):'#8aa89e';
   const g=node('g',{'data-id':e.id,role:'button',tabindex:0,'aria-label':`${e.name} ${e.id}，${e.error||fmt(e.value)+' kg CO₂e'}`,'aria-pressed':e.id===selected});
   const x=e.x,y=e.y,z=e.z,X=x+e.l,Y=y+e.w,Z=z+e.h,stroke=e.id===selected?'#8dc3ff':'#23383e';
   g.append(node('title',{},`${e.name} · ${fmt(e.volume,3)} m³ · ${e.error||fmt(e.value)+' kg CO₂e'}`));
   [[[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],[[X,y,z],[X,Y,z],[X,Y,Z],[X,y,Z]],[[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]]].forEach((pts,i)=>g.append(poly(pts,{fill:color,'fill-opacity':[.75,.9,1][i],stroke,'stroke-width':e.id===selected?2.5:1})));
   svg.append(g);
  });
  svg.append(node('text',{x:30,y:425,fill:'#a4b3b8','font-size':12},`${entryRecord?.rhino_connected?'Rhino 几何':'示例几何'} · ${label(active)} · ${fmt(maxX-minX,2)} m × ${fmt(maxY-minY,2)} m`));
  $('elements').replaceChildren();data.lines.forEach(e=>{const b=document.createElement('button');b.textContent=e.name;b.dataset.id=e.id;b.setAttribute('aria-pressed',e.id===selected);$('elements').append(b);});
 }
 function inspector(){
  const e=current().find(e=>e.id===selected),r=C.element(e);
  $('elementName').textContent=e.name;$('elementId').textContent=e.id;
  $('geometry').replaceChildren();
  [['尺寸',`${fmt(e.l,3)} × ${fmt(e.w,3)} × ${fmt(e.h,3)} m`],['几何体积',fmt(r.volume,3)+' m³'],['后台换算重量',r.error?'材料或换算数据待完善':fmt(r.mass,1)+' kg']].forEach(([label,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('geometry').append(dt,dd);});
  $('material').value=e.material;$('material').disabled=active==='A';
  document.querySelector('label[for="material"] span').textContent=materialConfirmed(e)?'接入时已确认':active==='B'?'草案已调整 / 待复核':'材料待核对';
  document.querySelector('label[for="material"]').firstChild.textContent='材料类别 ';

  if(e.materialRecord){for(const [key,value] of [['原模型材料',e.materialRecord.name||'未提供'],['原始牌号',e.materialRecord.grade||'未提供'],['目录分类',C.materialInfo(e.material).name]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;$('geometry').append(dt,dd);}}
  const control=D.control(e),baseControl=D.control(A.find(x=>x.id===e.id));
  $('dimensionLabel').textContent=control.kind?control.label+' · mm':'当前构件尺寸暂不可调';
  for(const key of ['min','max','step'])$('dimension')[key]=control[key]||1;
  $('dimension').value=control.value||1;$('dimension').disabled=active==='A'||!control.kind;
  $('dimensionValue').textContent=control.kind?`修改前 ${fmt(baseControl.value)} → 修改后 ${fmt(control.value)} mm`:'保持原模型净量';
  $('editHint').textContent=active==='A'?'当前模型保持不变；进入探索改进后再试调。':'拖动或输入尺寸，右侧立即重算。输入范围仅用于演示，不是规范允许范围。';
  $('elementCarbon').textContent=fmt(r.value);
  $('selectedResultName').textContent=e.name+' · 当前选中构件';
  $('formula').replaceChildren();
  const lines=r.error?[r.error+'，暂不计算排放。']:[r.quantityBasis,`计量体积：${fmt(r.volume,5)} m³；重量：× ${r.factor.density} kg/m³ = ${fmt(r.mass,3)} kg`,`生产：${fmt(r.mass,3)} × ${r.factor.production} = ${fmt(r.production,3)} kg CO₂e`,`处置：${fmt(r.mass,3)} × ${r.factor.disposal} = ${fmt(r.disposal,3)} kg CO₂e`,`KBOB ${r.factor.id} / ${r.factor.original} / ${r.factor.cells.density}、${r.factor.cells.production}、${r.factor.cells.disposal}`,r.referenceNote,'仅采用来源生产与处置汇总列；木材生物碳含量不抵扣，缺项不按零。'];
  lines.forEach(t=>{const p=document.createElement('p');p.textContent=t;$('formula').append(p);});
 }
 function comparison(){
  $('comparisonBody').replaceChildren();$('export').disabled=!A;
  const live=B?C.compare(A,B):null;
  $('liveDelta').textContent=!live?'当前模型的结果作为后续改进对比依据':live.compatible?`改进 − 当前：${live.delta>0?'+':''}${fmt(live.delta)} kg CO₂e${live.percent===null?'':` / ${fmt(live.percent)}%`} · 未验证结构`:'计算资料不完整 · 暂停比较';
  if(!B){$('comparisonBody').innerHTML='<p class="help">尚未创建候选草案。</p>';return;}
  const r=C.compare(A,B),wrap=document.createElement('div');wrap.className='tablewrap';
  const t=document.createElement('table');t.innerHTML='<thead><tr><th>相同碳计算范围</th><th>当前模型</th><th>改进草案</th></tr></thead>';
  const body=document.createElement('tbody');
  [['已映射构件',`${r.A.known}/${r.A.total}`,`${r.B.known}/${r.B.total}`],['已计入体积 m³',fmt(r.A.lines.filter(e=>!e.error).reduce((s,e)=>s+e.volume,0),3),fmt(r.B.lines.filter(e=>!e.error).reduce((s,e)=>s+e.volume,0),3)],['已计入部分 kg CO₂e',fmt(r.A.value),fmt(r.B.value)]].forEach(vals=>{const tr=document.createElement('tr');vals.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});body.append(tr);});t.append(body);wrap.append(t);$('comparisonBody').append(wrap);
  const diff=document.createElement('p');diff.className=r.compatible?'diff':'warning';diff.id='delta';
  diff.textContent=r.compatible?`改进 − 当前：${r.delta>0?'+':''}${fmt(r.delta)} kg CO₂e${r.percent===null?'':`（${r.percent>0?'+':''}${fmt(r.percent)}%）`} · 仅数值差，非可实施减排结论`:'方案存在未确认材料或无效几何，计算范围不完整，暂停差值和百分比比较。';$('comparisonBody').append(diff);
  const changes=document.createElement('ul');changes.id='changes';
  B.forEach(e=>{const parts=D.differences(A.find(a=>a.id===e.id),e);if(parts.length){const li=document.createElement('li');li.textContent=e.name+'：'+parts.join('；');changes.append(li);}});
  if(!changes.children.length){const li=document.createElement('li');li.textContent='几何和材料尚未改变，不存在几何调整带来的减排。返回“调整并看变化”修改。';changes.append(li);}$('comparisonBody').append(changes);
 }
 function render(){
  $('tabA').setAttribute('aria-pressed',active==='A');$('tabB').setAttribute('aria-pressed',active==='B');
  model();inspector();const r=C.calculate(current());
  $('resultTitle').textContent=label(active);$('coverage').textContent=`有计算依据 ${r.known} / ${r.total} 个构件`;
  $('total').textContent=fmt(r.value);$('production').textContent=r.value===null?'—':fmt(r.production);$('disposal').textContent=r.value===null?'—':fmt(r.disposal);
  $('missing').textContent=r.complete?'这些构件已有计算依据；数值只覆盖各材料生产与处置，不含其他材料和阶段。':`仍有 ${r.total-r.known} 个构件缺材料、计算数据或有效几何，当前只是已知部分小计，不能当作完整方案结果。`;
  const ranked=r.lines.filter(e=>!e.error).sort((a,b)=>b.value-a.value),top=ranked[0];
  $('hotspot').textContent=top?`${top.name}占已计入部分的 ${fmt(top.value/r.value*100,1)}%。`:'尚无可计算构件，请查看材料或计算数据缺项；不代表零排放。';
  $('contributions').replaceChildren();
  [...r.lines].sort((a,b)=>(b.value??-1)-(a.value??-1)).forEach(e=>{
   const button=document.createElement('button');button.className='contribution-row';button.dataset.id=e.id;button.setAttribute('aria-pressed',e.id===selected);
   const meta=document.createElement('span');meta.className='bar-meta';
   const name=document.createElement('span');name.className='bar-name';name.textContent=e.name;
   const value=document.createElement('span');value.className='bar-value';value.textContent=e.error?(e.material==='unknown'?'待确认材料':'待补计算数据'):fmt(e.value)+' kg CO₂e';meta.append(name,value);
   const track=document.createElement('span');track.className='bar-track';const fill=document.createElement('span');fill.className='bar-fill';fill.style.width=(e.error||!r.value?0:e.value/r.value*100)+'%';track.append(fill);button.append(meta,track);$('contributions').append(button);
  });comparison();S.sync({active,elements:C.clone(current())});workflow();resultReport(r);document.dispatchEvent(new Event('carbon-model-render'));
 }
 function enterModel(elements,record){
  A=elements;entryRecord=record;B=null;candidateAudit=null;reviewed=null;active='A';step=1;selected=A[0].id;
  $('app').hidden=false;$('welcome').hidden=true;$('start').hidden=true;$('tabB').disabled=true;
  $('sourceLabel').textContent=`${record.rhino_connected?'Rhino 实际导入':'内置示例'} · ${record.scope_label||'选中范围'} · ${A.length} / ${record.source_count} 个对象 · 单位 m`;
  document.querySelector('.project-bar b').textContent=`本次分析 / ${record.scope_label||'选中范围'}`;
  $('entryCoverage').textContent=`接入时分类确认 ${record.confirmed_count} / ${A.length} 个；可计算 ${C.calculate(A).known} / ${A.length} 个。分类核验不代表计算资料齐全或结构安全。`;
  const counts=`${A.filter(e=>e.type==='slab').length} 块楼板 / ${A.filter(e=>e.type==='column').length} 根柱 / ${A.filter(e=>!['slab','column'].includes(e.type)).length} 个其他或未识别对象`;
  document.querySelector('.project-data dd').textContent=counts;
  const facts=document.querySelectorAll('.project-data dd');
  facts[1].textContent=record.rhino_connected?'尺寸由 Rhino 发送并统一换算为 m；详见选中构件':'每层示例轮廓 6 × 4 m；尺寸详见选中构件';
  facts[4].textContent=`所选楼板面积之和 ${fmt(A.filter(e=>e.type==='slab').reduce((sum,e)=>sum+e.l*e.w,0))} m²；非整栋建筑面积`;
  $('model').setAttribute('aria-label','本次范围内构件的轴测示意');
  const radios=[...document.querySelectorAll('[name="direction"]')];
  radios.forEach(r=>{r.disabled=!A.some(e=>e.type===r.value&&D.control(e).kind);r.checked=false;});
  const first=radios.find(r=>!r.disabled);if(first)first.checked=true;$('copy').disabled=!first;
  modelDetails.open=false;render();$('carbonReportTitle').focus();$('carbonReportTitle').scrollIntoView({block:'start'});
 }
 function openEntry(fresh=false){
  $('app').hidden=true;$('welcome').hidden=true;$('start').hidden=true;
   window.ModelEntry.open({previous:fresh?null:entryRecord,readOnly:fresh?false:!!B,onDone:enterModel,onCancel:()=>{if(A){$('app').hidden=false;$('recheckModel').focus();}else{$('start').hidden=false;$('welcome').hidden=false;$('load').focus();}}});
 }
  $('load').addEventListener('click',()=>openEntry());$('recheckModel').addEventListener('click',()=>openEntry());
  document.addEventListener('carbon-rhino-intake-ready',()=>{if($('modelEntry').hidden)openEntry(true);});
 $('copy').addEventListener('click',()=>{const option=document.querySelector('[name="direction"]:checked');if(!option||option.disabled||B||!S.createCandidate())return;B=C.clone(A);direction=option.value;selected=B.find(e=>e.type===direction&&D.control(e).kind).id;$('tabB').disabled=false;go(3);});
 ['A','B'].forEach(s=>$('tab'+s).addEventListener('click',()=>{active=s;step=s==='A'?1:3;render();}));
 document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>go(Number(b.dataset.step))));
 $('flowBack').addEventListener('click',()=>go(step===3?1:step-1));
 $('flowNext').addEventListener('click',()=>{if(step===4){downloadDraft();return;}if(step===3)inspectCandidate();go(step+1);});
 $('checkCandidate').addEventListener('click',inspectCandidate);
 $('editCandidateStructure').addEventListener('click',()=>{active='B';S.sync({active,elements:C.clone(B)});$('structure').showModal();});
 document.addEventListener('structure-input-change',workflow);
 function select(event){const e=event.target.closest('[data-id]');if(e){const parent=e.closest('#model,#elements,#contributions');selected=e.dataset.id;render();if(parent)parent.querySelector(`[data-id="${selected}"]`)?.focus({preventScroll:true});}}
 $('model').addEventListener('click',select);$('model').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(event);}});$('elements').addEventListener('click',select);
 $('contributions').addEventListener('click',select);
 document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.open).showModal()));
 document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
 $('heat').addEventListener('change',model);
 $('material').addEventListener('change',()=>{if(active!=='B')return;const e=B.find(e=>e.id===selected);e.material=$('material').value;delete e.factorId;render();});
 function resizeSelected(mm){if(active!=='B')return;const i=B.findIndex(e=>e.id===selected);B[i]=D.resize(B[i],mm);render();}
 $('dimension').addEventListener('input',()=>resizeSelected(Number($('dimension').value)));
 function downloadDraft(){
  const payload={schema:'carbonloop-model-demo-v1',exported_at:new Date().toISOString(),origin:entryRecord?.rhino_connected?'Rhino 8 插件导入；分类与材料经网页核对':'内置长方体示例；未连接 Rhino / Revit',geometry_unit:'m',output_unit:'kg CO2e',source:C.factorSource,factors:C.factors,scope:'仅各材料生产与处置；钢筋、运输、施工、更换、运营等未计入；不验证结构安全',A:{elements:A,result:C.calculate(A)},B:B?{elements:B,result:C.calculate(B)}:null,comparison:B?C.compare(A,B):null};
  payload.active_structural_preparation=window.StructurePreparation.exportState();
  payload.structural_change_review=window.StructuralReviewUI?.exportState()||null;
  payload.workflow={status:'待验证草案',candidate_origin:'人工调整，非 AI 生成',direction,review_current:reviewed!==null&&reviewed===snapshot(),structural_safety:'未执行，不可判定',conditions_changed:B?S.differences():[],next_action:'补齐并核实工程输入，接入结构求解及规范校核，再由专业人员复核'};
  payload.structural_preparation={A:S.exportState('A',A),B:B?S.exportState('B',B):null};
  payload.model_intake={A:S.intake('A',A),B:B?S.intake('B',B):null};
  payload.model_entry=entryRecord;
  payload.ai_carbon_explanation=carbonExplanation?{mode:carbonExplanation.mode,provider:carbonExplanation.provider,model:carbonExplanation.model,generatedAt:carbonExplanation.generatedAt,answer:carbonExplanation.answer,input:carbonExplanation.input}:null;
  payload.ai_assistance=candidateAudit?{...candidateAudit,modified_after_creation:JSON.stringify(B)!==candidateAudit.createdSnapshot}:null;
  payload.comparison_decision=window.ComparisonDecision?.exportState()||null;
  payload.workflow.comparison_decision=payload.comparison_decision?.status||'not_reviewed';
  if(candidateAudit)payload.workflow.candidate_origin=candidateAudit.mode==='live_ai'?'真实 AI 建议，经用户确认建立；可能随后手动修改':'固定规则试算，经用户确认建立；非 AI';
  if(candidateAudit?.candidateId)payload.workflow.candidate_origin='程序生成有限候选并复算；'+(candidateAudit.mode==='live_ai'?'AI 推荐优先核实，经用户确认加入草案':'用户选择程序候选加入草案，非 AI 推荐')+'；结构可行性未验证';
  window.CarbonExcel.model(payload);
 }
 $('export').addEventListener('click',downloadDraft);
 window.CarbonWorkspace={applySolution:(options,id,audit,signature)=>{
  if(!B||JSON.stringify(B)!==signature)throw Error('模型已变化，请重新寻找方案。');
  const proposal=window.CarbonSolutions.apply(B,options,id);B=C.clone(proposal.elements);candidateAudit={...C.clone(audit),candidateId:id,options:C.clone(options),canAdopt:false,createdSnapshot:JSON.stringify(B)};selected=proposal.affected[0];reviewed=null;go(3);
 },state:()=>({baseline:A,candidate:B,active,selected,step}),select:id=>{if(current()?.some(e=>e.id===id)){selected=id;render();}},resize:resizeSelected,resetSelected:()=>{if(active!=='B')return;B[B.findIndex(e=>e.id===selected)]=C.clone(A.find(e=>e.id===selected));render();},recipe:id=>{if(active!=='B'||!['','01.002.13'].includes(id))return;const e=B.find(e=>e.id===selected);if(!['concrete','concrete-cast'].includes(e.material))return;if(id)e.factorId=id;else delete e.factorId;render();},researchModel:()=>A?C.clone(B||A):null,applySuggestion:(choice,audit,modelSignature)=>{
  if(!B||JSON.stringify(B)!==modelSignature)throw Error('模型已变化，请重新生成建议。');
  const result=window.CarbonAI.apply(B,choice);B=result.elements;candidateAudit={...C.clone(audit),createdSnapshot:JSON.stringify(B)};selected=choice.elementId;go(3);
 },baseline:()=>A?C.clone(A):null,hasCandidate:()=>!!B,createCandidate:(choice,audit,baselineSignature)=>{
  if(!A||B)throw Error('已有草案或没有模型，不覆盖现有修改。');
  if(JSON.stringify(A)!==baselineSignature)throw Error('模型已变化，旧建议失效，请重新生成。');
  const result=window.CarbonAI.apply(A,choice);if(!S.createCandidate())throw Error('无法继承当前准备信息。');
  B=result.elements;candidateAudit={...C.clone(audit),createdSnapshot:JSON.stringify(B)};direction='material-formula';selected=choice.elementId;$('tabB').disabled=false;go(3);
 }};
 // The plugin-style model intake is the primary entry, not the Concept form.
 openEntry();
})();
