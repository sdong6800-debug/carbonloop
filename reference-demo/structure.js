(function(){
 'use strict';
 const $=id=>document.getElementById(id),KEY='carbonloop-structural-inputs-v1';
 const definitions=[
  ['region','项目所在地','text','例如：中国上海；用于后续确认规范，不自动生成荷载'],
  ['code','拟采用规范及版本','text','由结构专业确认，例如具体规范名称、版本与国家附录'],
  ['method','拟采用分析方法',['','一阶线弹性分析','二阶分析'],'这里只记录分析意图，尚未运行'],
  ['slabGrade','S01 楼板混凝土强度等级',['','C25/30','C30/37','C35/45'],'欧标等级命名示例；不改变 KBOB 碳因子'],
  ['columnGrade','C01–C04 柱混凝土强度等级',['','C25/30','C30/37','C35/45'],'同组四柱；尚未映射材料力学参数库'],
  ['reinforcement','钢筋配置／资料情况','text','填写资料名称或“尚无配筋资料”；不作为已通过配筋校核'],
  ['selfWeight','全部构件自重',['','计入','不计入'],'求解器接入后依结构材料密度生成；当前不计算荷载'],
  ['dead','S01 附加恒载 · kN/m²','number','不含已选构件自重，避免重复计算；允许明确为 0'],
  ['live','S01 活载 · kN/m²','number','数值需有项目依据，不能仅凭城市推断'],
  ['loadBasis','荷载来源与适用范围','text','说明依据，以及风、雪、地震等是否需要另行考虑'],
  ['combinations','拟用荷载组合及依据','text','填写组合表达或组合表引用；本页不解析或验证组合'],
  ['connection','楼板与四根柱的连接假设',['','刚接假设','铰接假设'],'对四处连接统一记录；不是已生成的节点自由度'],
  ...['C01','C02','C03','C04'].map(id=>['support'+id,id+' 柱底支座',['','固定','铰支','自由'],'固定：约束平移与转动；铰支：约束平移、释放转动']),
  ['limit','拟检查的变形限值 · mm','number','仅记录本次意图，需说明适用构件与荷载组合'],
  ['limitBasis','限值适用对象与依据','text','例如构件、工况、所依据条款；不是默认安全判据']
 ];
 const empty=()=>({values:Object.fromEntries(definitions.map(([k])=>[k,''])),source:'人工填写',checked:null,savedAt:null,confirmations:{}});
 let records={A:empty(),B:empty()},context={active:'A',elements:[]},storageMessage='尚未保存；输入只在当前页面内暂存。';
 try{const data=JSON.parse(localStorage.getItem(KEY));if(data?.version===1){for(const id of ['A','B']){const r=data.records?.[id];if(r&&r.values){for(const [k] of definitions)if(typeof r.values[k]==='string')records[id].values[k]=r.values[k].slice(0,1000);records[id].source=typeof r.source==='string'?r.source:'恢复的输入';records[id].checked=r.checked&&typeof r.checked.signature==='string'&&Array.isArray(r.checked.issues)&&r.checked.issues.every(x=>typeof x==='string')?r.checked:null;records[id].savedAt=r.savedAt;}}storageMessage='已恢复本浏览器保存的结构输入。模型几何刷新后仍回到示例初值，请重新核对。';}}catch{storageMessage='无法读取本地保存；仍可填写和导出。';}
 const pane=$('structure');
 pane.classList.add('structure-workspace');
 pane.innerHTML='<div class="dialog-heading"><div><p class="eyebrow">STRUCTURE / INPUT REVIEW</p><h2 id="structureTitle">结构分析准备</h2><p class="help" id="structContext"></p></div><button class="close-dialog outline" aria-label="关闭结构校核">关闭 ×</button></div><div class="dialog-body"><p>先准备输入，再连接求解器。表单检查不是结构安全校核；碳计算与结构材料参数分别记录。</p><div class="structure-actions"><button type="button" id="structExample" class="outline">填入教学示例</button><button type="button" id="structCopy" class="outline">从 A 复制输入到 B</button><span id="structSource" class="mini-tag"></span></div><form id="structForm" novalidate><div id="structFields" class="struct-fields"></div><div class="structure-actions"><button type="submit">检查输入</button><button type="button" id="structSave" class="outline">保存到本浏览器</button><button type="button" id="structExport" class="outline">导出准备包 ↓</button><button type="button" id="structRun" class="outline">尝试运行结构分析</button></div></form><p id="structSaved" class="help" role="status"></p><section class="struct-status"><h3 id="structState"></h3><ul id="structIssues"></ul><p id="structRunMessage" role="status"></p></section><h3>结果区域</h3><div class="struct-results"><div>位移 / 内力<strong>—</strong><small>结构求解未执行</small></div><div>承载力 / 变形校核<strong>—</strong><small>无计算结果，不判定通过</small></div><div>当前关联模型<strong id="structVersion"></strong><small>修改模型后需重新检查</small></div></div><p class="help">接入前仍需：实体转梁／壳分析模型、节点和自由度映射、材料力学参数、荷载组合解析、配筋及适用规范校核。上述字段是准备清单，不是可以直接交给 Karamba3D 的完整输入文件。</p><p><a href="https://karamba3d.com/get-started/" target="_blank" rel="noopener">Karamba3D 安装与许可说明 ↗</a></p></div>';
 // Architecture-facing overview; detailed engineering inputs remain available, not mandatory.
 $('structureTitle').textContent='模型信息与结构准备';
 const body=pane.querySelector('.dialog-body');
 body.firstElementChild.textContent='先看已取得的信息，只确认必要的项目；结构专业资料交给合作工程师补充，不需要建筑师逐项填写。当前仅从内置示例读取，未连接 Rhino。';
 const overview=document.createElement('section');overview.className='struct-overview';
 overview.innerHTML=`<section class="intake-card"><p class="eyebrow">01 / 已读取</p><h3>模型已有的信息</h3><p id="structReadSummary"></p><p class="help">来源：内置示例属性与几何。数量由当前模型自动汇总，不需输入重量；不是 Rhino 识别结果。</p><details><summary>查看构件与几何量</summary><div class="tablewrap"><table><thead><tr><th>构件</th><th>尺寸 m</th><th>体积 m³</th></tr></thead><tbody id="structReadRows"></tbody></table></div></details></section>
 <section class="intake-card"><p class="eyebrow">02 / 待确认</p><h3>按组核对，不逐个填写</h3><p id="structClassification"></p><button id="confirmTypes" class="outline" type="button">确认这组构件分类</button><p id="structMapping"></p><button id="confirmMaterials" class="outline" type="button">确认这组示例碳材料映射</button><p class="help">仅确认示例中的分类和碳计算映射；不确认材料强度、配筋或结构安全。实际项目需要材料依据。</p></section>
 <section class="intake-card"><p class="eyebrow">03 / 专业协作</p><h3>需要结构专业提供或核实</h3><ul id="structProfessionalGroups"></ul><p class="help">有结构模型时可在后续接入中读取；普通建筑几何无法可靠推断这些条件。本版不自动猜测或默认补齐。</p><button id="structHandoff" type="button">下载结构协作清单 ↓</button><p class="help">生成可阅读的清单，由你发给合作工程师；不会自动发送。</p></section>`;
 body.firstElementChild.after(overview);
 const advanced=document.createElement('details');advanced.id='structAdvanced';advanced.className='struct-advanced';advanced.innerHTML='<summary>专业设置 · 查看／补充详细结构输入（可选）</summary><p class="help">适合结构专业人员补录和核对。教学预填只是体验流程，不是从模型读取，也不是经核实的工程条件。</p>';
 overview.after(advanced);
 for(const el of [body.querySelector('.structure-actions'),$('structForm'),$('structSaved'),body.querySelector('.struct-status')])advanced.append(el);
 const professionalGroups=[
  ['项目与规范',['region','code','method']],['结构材料与配筋',['slabGrade','columnGrade','reinforcement']],
  ['荷载与组合',['selfWeight','dead','live','loadBasis','combinations']],
  ['连接与支座',['connection','supportC01','supportC02','supportC03','supportC04']],['变形要求与依据',['limit','limitBasis']]
 ];
 const groups={0:'01 / 项目与分析要求',3:'02 / 构件结构材料',6:'03 / 荷载与组合',11:'04 / 连接与柱底支座',16:'05 / 检查要求'};
 definitions.forEach(([key,label,type,hint],index)=>{
  if(groups[index]){const h=document.createElement('h3');h.textContent=groups[index];$('structFields').append(h);}
  const wrap=document.createElement('label');wrap.className='struct-field';const title=document.createElement('span');title.textContent=label;
  const input=document.createElement(Array.isArray(type)?'select':'input');input.id='s-'+key;input.name=key;
  if(Array.isArray(type))type.forEach(value=>{const o=document.createElement('option');o.value=value;o.textContent=value||'请选择 / 待确认';input.append(o);});else{input.type=type;if(type==='number'){input.min='0';input.step='any';}else input.maxLength=1000;}
  const note=document.createElement('small');note.id='hint-'+key;note.textContent=hint;input.setAttribute('aria-describedby',note.id);wrap.append(title,input,note);$('structFields').append(wrap);
 });
 const record=()=>records[context.active];
 const modelSignature=elements=>JSON.stringify(elements);
 function intake(id=context.active,elements=context.elements){
  const r=records[id],sig=modelSignature(elements);
  return {source:'内置示例属性与几何；未连接 Rhino',element_count:elements.length,
   classifications_confirmed:r.confirmations.types===sig,carbon_mapping_confirmed:r.confirmations.materials===sig,
   professional_groups:professionalGroups.map(([name,keys])=>({name,missing:keys.filter(k=>!r.values[k].trim()).map(k=>definitions.find(d=>d[0]===k)[1]),recorded:keys.filter(k=>r.values[k].trim()).length,total:keys.length,status:keys.some(k=>!r.values[k].trim())?'待专业补充':'已有记录，待专业核实'})),
   structural_safety:'未执行结构求解与规范校核，不可判断'};
 }
 function overviewStatus(){
  const elements=context.elements,info=intake(),valid=elements.length>0&&elements.every(e=>[e.l,e.w,e.h].every(n=>Number.isFinite(n)&&n>0));
  const slabs=elements.filter(e=>e.type==='slab').length,columns=elements.filter(e=>e.type==='column').length;
  $('structReadSummary').textContent=elements.length?`${elements.length} 个构件 · ${slabs} 块楼板 / ${columns} 根柱 · ${valid?'总体积 '+elements.reduce((sum,e)=>sum+e.l*e.w*e.h,0).toFixed(3)+' m³':'几何量待确认'}`:'请先打开示例模型。';
  $('structReadRows').replaceChildren();elements.forEach(e=>{const tr=document.createElement('tr');[e.name+' / '+e.id,`${e.l} × ${e.w} × ${e.h}`,([e.l,e.w,e.h].every(n=>Number.isFinite(n)&&n>0)?(e.l*e.w*e.h).toFixed(3):'待确认')].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);});$('structReadRows').append(tr);});
  $('structClassification').textContent=info.classifications_confirmed?'已人工确认当前示例的构件分类。':record().confirmations.types?'模型已变化，请重新确认分类。':`示例预设：${slabs} 块楼板、${columns} 根柱。请核对分类。`;
  $('confirmTypes').disabled=!valid||elements.some(e=>!['slab','column'].includes(e.type))||info.classifications_confirmed;
  const known=elements.filter(e=>!window.ModelCore.element(e).error).length;
  $('structMapping').textContent=info.carbon_mapping_confirmed?'已人工确认当前示例的碳材料映射；强度仍待核实。':`${known} / ${elements.length} 个构件已有 KBOB 参考计算依据${known<elements.length?'；其余材料未确定或缺计算数据，重复确认分类不能补齐数据':'；需要核对，不是按外观识别'}。`;
  $('confirmMaterials').disabled=!valid||known!==elements.length||info.carbon_mapping_confirmed;
  $('structProfessionalGroups').replaceChildren();info.professional_groups.forEach(g=>{const li=document.createElement('li');const b=document.createElement('b');b.textContent=g.name;const span=document.createElement('span');span.textContent=g.status;li.append(b,span);$('structProfessionalGroups').append(li);});
 }
 const signature=(id=context.active,elements=context.elements)=>JSON.stringify({geometry:elements,values:records[id].values});
 function issues(id=context.active,elements=context.elements){
  const v=records[id].values,out=[];
  definitions.forEach(([key,label,type])=>{if(!v[key].trim())out.push(label+'：尚未填写');else if(type==='number'&&(!Number.isFinite(Number(v[key]))||Number(v[key])<0||(key==='limit'&&Number(v[key])===0)))out.push(label+'：需要有效'+(key==='limit'?'正数':'非负数'));else if(Array.isArray(type)&&!type.includes(v[key]))out.push(label+'：选项不受支持');});
  if(!elements.length)out.push('请先打开示例模型');
  if(elements.some(e=>!['S01','C01','C02','C03','C04'].includes(e.id)))out.push('本次包含二层或跨层构件；旧专业表单仅针对首层示例，不能沿用其荷载、连接和支座映射，需要按新范围重新建立结构输入。');
  if(elements.some(e=>![e.l,e.w,e.h].every(n=>Number.isFinite(n)&&n>0)))out.push('模型存在无效尺寸');
  if(elements.some(e=>e.material==='unknown'))out.push('存在未确认的构件材料；请先确认模型材料');
  if(elements.some(e=>!['concrete','unknown'].includes(e.material)))out.push('存在细分或其他材料类别；碳因子已接入不等于结构参数已接入，不能沿用通用混凝土示例的强度与配筋表单作为结构依据');
  if(['C01','C02','C03','C04'].every(id=>v['support'+id]==='自由'))out.push('四个柱底均为自由：当前没有支承约束，不能作为可运行的结构模型');
  return out;
 }
 function status(){
  const r=record(),stale=r.checked&&r.checked.signature!==signature();
  $('structState').textContent=stale?'模型或输入已变化 · 需重新检查':!r.checked?'尚未检查输入':r.checked.issues.length?'仍有 '+r.checked.issues.length+' 项需要补充':'表单完整性检查完成 · 等待工程建模与求解器';
  $('structIssues').replaceChildren();
  if(r.checked&&!stale)r.checked.issues.forEach(message=>{const li=document.createElement('li');li.textContent=message;$('structIssues').append(li);});
  $('structSource').textContent=r.source;$('structSaved').textContent=storageMessage;
  const label=context.active==='A'?'原始方案':'候选草案';
  $('structVersion').textContent=label+' / '+context.elements.length+' 构件';
  $('structContext').textContent='当前：'+label+'。查看已取得的信息与待办；原始与候选均未执行结构校核。';
  const badge=$('structureBadge');if(badge)badge.textContent=stale?'需重新检查 ↗':r.checked&&!r.checked.issues.length?'输入已检查 · 未求解 ↗':'准备输入 ↗';
  overviewStatus();
  document.dispatchEvent(new Event('structure-input-change'));
 }
 function fill(){definitions.forEach(([key])=>$('s-'+key).value=record().values[key]);$('structRunMessage').textContent='';status();}
 function check(){record().checked={signature:signature(),issues:issues(),checkedAt:new Date().toISOString()};status();}
 function exported(id=context.active,elements=context.elements){return {schema:'carbonloop-structural-preparation-v1',scheme:id,exported_at:new Date().toISOString(),geometry:elements,geometry_unit:'m',inputs:JSON.parse(JSON.stringify(records[id])),units:{dead:'kN/m2',live:'kN/m2',limit:'mm'},review_current:records[id].checked?.signature===signature(id,elements),validation_scope:'字段完整性、数值有效性及有限的矛盾检查；不验证结构稳定、规范适用性或安全',solver_ready:false,solver_connected:false,structural_results:null};}
 $('structForm').addEventListener('input',event=>{const k=event.target.name;if(!definitions.some(([key])=>key===k))return;record().values[k]=event.target.value;record().source=record().source.includes('教学')?'教学假设（已编辑，需工程确认）':'人工填写（待工程确认）';storageMessage='有未保存修改；不会自动上传。';$('structRunMessage').textContent='';status();});
 $('structForm').addEventListener('submit',event=>{event.preventDefault();check();});
 for(const [id,key] of [['confirmTypes','types'],['confirmMaterials','materials']])$(id).addEventListener('click',()=>{record().confirmations[key]=modelSignature(context.elements);storageMessage='分组确认仅在本次页面有效；模型变化后需重新确认。';status();});
 $('structHandoff').addEventListener('click',()=>{
  const info=intake(),r=record();
  const text=['# CarbonLoop 结构协作清单',new Date().toISOString(),context.active==='A'?'原始方案':'候选草案','',info.source,'本清单不是结构计算书；尚未执行结构分析。','',`已取得 ${info.element_count} 个示例构件，尺寸单位 m。`,...context.elements.map(e=>`${e.id} / ${e.name}：${e.l} × ${e.w} × ${e.h} m；材料标记 ${e.material}`),'',`构件分类人工确认：${info.classifications_confirmed?'本次模型已确认':'待确认'}`,`示例碳材料映射人工确认：${info.carbon_mapping_confirmed?'本次模型已确认':'待确认'}`,'','## 请结构专业补充或核实',...info.professional_groups.flatMap(g=>[g.name+'：'+g.status,...g.missing.map(x=>'  - 缺少：'+x)]),'','## 已有结构记录（不视为已核实）','记录来源：'+r.source,...definitions.filter(([k])=>r.values[k].trim()).map(([k,label])=>label+'：'+r.values[k]),'','还需：有效分析模型、材料力学参数、荷载组合、结构求解与适用规范校核；不能只凭碳排差值采用方案。'].join('\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='CarbonLoop-结构协作清单-'+context.active+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 $('structExample').addEventListener('click',()=>{const r=record();if(Object.values(r.values).some(Boolean)&&!confirm('用教学假设替换当前方案的结构输入？另一方案不会改变。'))return;r.values={region:'教学示例：地点未核实',code:'教学示例：拟按 Eurocode 2，版本与国家附录待确认',method:'一阶线弹性分析',slabGrade:'C30/37',columnGrade:'C30/37',reinforcement:'尚无配筋资料，不能进行钢筋混凝土承载力校核',selfWeight:'计入',dead:'1.5',live:'2',loadBasis:'仅演示重力荷载；数值为教学假设，风雪地震等适用性未核查',combinations:'待专业人员提供 ULS / SLS 组合表；此处仅为文字占位',connection:'刚接假设',supportC01:'固定',supportC02:'固定',supportC03:'固定',supportC04:'固定',limit:'20',limitBasis:'教学假设：楼板变形限值；工况和限值依据待专业确认'};r.source='教学假设 · 不用于工程';r.checked=null;storageMessage='已填入教学示例，尚未保存。';fill();});
 $('structSave').addEventListener('click',()=>{try{record().savedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify({version:1,records}));storageMessage='已保存 A/B 结构输入到本浏览器。刷新不会丢失；模型几何不在此处保存。';}catch{storageMessage='浏览器保存失败，请使用“导出准备包”保留输入。';}status();});
 $('structExport').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(exported(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='CarbonLoop-结构准备-'+context.active+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 $('structRun').addEventListener('click',()=>{check();$('structRunMessage').textContent=issues().length?'输入不完整或有冲突，请先处理清单。结构求解未执行。':'已记录输入，但未连接求解器，且工程模型、规范和组合仍需核实；未执行结构分析，不生成通过结论。';});
 // Creation is one transaction: cancel before either geometry or inputs change.
 $('structCopy').remove();
 const previous=document.createElement('details');previous.hidden=!Object.values(records.B.values).some(Boolean);
 previous.innerHTML='<summary>上次保存的候选结构输入</summary><p class="help">这里只恢复了结构表单，没有关联模型几何。创建新草案前，可先下载这份旧记录。</p><button type="button" class="outline">下载上次的结构输入 ↓</button>';
 $('copy').before(previous);
 previous.querySelector('button').addEventListener('click',()=>{const payload={schema:'carbonloop-unpaired-structural-inputs-v1',inputs:records.B,geometry:null,notice:'仅为上次保存的结构表单，没有关联模型，不是完整方案或求解结果'};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='CarbonLoop-上次候选结构输入.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 window.StructurePreparation={
  sync(next){context=next;fill();},exportState:exported,intake,
  createCandidate(){
   if(Object.values(records.B.values).some(Boolean)&&!confirm('已有上次保存的候选结构输入。新草案将用原始方案的输入替换它；如需保留，请取消并展开“上次保存的候选结构输入”下载旧记录。是否继续？'))return false;
   records.B=JSON.parse(JSON.stringify(records.A));records.B.checked=null;records.B.savedAt=null;
   previous.hidden=true;
   storageMessage='候选草案已继承原始方案的结构条件；尚未保存，仍需独立核查。';return true;
  },
  summary(id,elements){return {issues:issues(id,elements),checked:!!records[id].checked,stale:!!records[id].checked&&records[id].checked.signature!==signature(id,elements),source:records[id].source};},
  checkScheme(id,elements){records[id].checked={signature:signature(id,elements),issues:issues(id,elements),checkedAt:new Date().toISOString()};status();},
  differences(){return definitions.filter(([key])=>records.A.values[key]!==records.B.values[key]).map(([,label])=>label);}
 };
 fill();
})();
