(function(){
 'use strict';const R=window.StructuralReview,W=window.CarbonWorkspace,$=id=>document.getElementById(id);
 const panel=document.createElement('section');panel.id='structuralChange';panel.className='panel';
 panel.innerHTML='<div class="feedback-heading"><b>这次修改能用吗？</b><span id="structuralState">待核实</span></div><p id="structuralSummary" aria-live="polite"></p><div id="structuralFacts" class="change-facts"></div><div id="structuralRisks" class="change-facts" aria-live="polite"></div><p id="structuralAIStatus" role="status"></p><label class="structural-consent"><input id="structuralAuto" type="checkbox" disabled>修改后自动请 AI 分析（发送构件与项目资料，消耗 API 额度）</label><div class="feedback-actions"><button id="structuralAsk" class="outline">分析这次修改</button><button id="structuralReconnect" class="text-button">检查连接</button></div><div id="structuralAnswer" hidden><b>AI 对本次修改的建议 · 非完整结构验算</b><p id="structuralReason"></p><b>下一步</b><p id="structuralNextStep"></p><b>本次使用的 RAG 依据</b><div id="structuralCitations" class="rag-evidence"></div></div><details id="structuralDetails"><summary>检查内容与依据</summary><p id="structuralRuleSummary"></p><div id="structuralRuleMatches"></div><div id="sectionCapacity"><b>AS 3600:2018 · 截面抗弯工具</b><p id="sectionStatus">需接入结构资料：强度、配筋和对应改动的设计内力。</p><label>接入已有工程资料 <input id="sectionFile" type="file" accept=".json,application/json"></label><button id="sectionRun" type="button" class="outline">计算截面抗弯</button><div id="sectionResult"></div><p>此接口接收结构工具导出的资料，不从建筑外形猜测配筋。只计算选定板带的正弯矩抗弯，未检查冲切、挠度和支承构件；不能代替完整结构核验。</p></div><details id="modelDataHelp"><summary>接入真实模型后，哪些信息能自动得到？</summary><p><b>模型已有的，可以读取：</b>构件位置、实际几何，以及已填写的材料和钢筋信息。普通 Rhino 几何里不一定有钢筋或材料强度。</p><p><b>模型没有的，不能凭外形补出：</b>钢筋怎么布置、楼面使用荷载、梁板柱怎么连接与支承。需要项目资料或确认后的设计假设。</p><p><b>需要计算的：</b>修改后梁板柱承受多大作用、会变形多少、需要多少钢筋，要由结构分析与设计工具计算。当前只接通特定截面的抗弯工具，尚未接通整个模型的结构分析。</p><p>本页当前仍使用示例模型，尚未连接 Rhino / Revit。截图只辅助理解位置和意图，不作为配筋、荷载或精确尺寸的来源。</p></details><ul id="structuralChecks"></ul><p id="structuralBasisIntro">澳洲规范参考 · 州、建筑类别与适用版本待确认。</p><div id="structuralSources"></div><p>程序计算碳排与变化风险；RAG 只检索本次相关的公开摘要和项目规则；工程资料齐全时可运行截面抗弯工具。整体结构求解、冲切和变形等检查尚未接通。</p></details>';
 document.querySelector('.center-column').prepend(panel);
 let sectionInput=null,sectionResult=null,sectionController=null,sectionTimer=null;
 let configured=false,provider='模型服务',fingerprint='',controller=null,timer=null,report=null,body=null,latest=null,message='';
 const fmt=n=>Number.isFinite(n)?n.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—';
 const emit=()=>document.dispatchEvent(new Event('carbon-structural-feedback'));
 function info(text){message=text;$('structuralAIStatus').textContent=text;emit();}
 function context(){const s=W.state();if(!s.baseline||!s.candidate)return null;const before=s.baseline.find(e=>e.id===s.selected),after=s.candidate.find(e=>e.id===s.selected);if(!before||!after)return null;const v=window.StructurePreparation.exportState('B',s.candidate).inputs.values;return {before,after,...(sectionInput?.elementId===after.id?{sectionInput:sectionInput.input}:{}),project:{region:v.region||'',code:v.code||''}};}
 function summary(r){const t=r.facts.thickness;return r.facts.element_id+' · '+(t?fmt(t.before_mm)+' → '+fmt(t.after_mm)+' mm'+(t.delta_mm?'（'+(t.delta_mm>0?'加厚 ':'减薄 ')+fmt(Math.abs(t.delta_mm)/10)+' 厘米）':'（厚度未变）'):'构件修改');}
 function factLines(r){const f=r.facts;return ['材料用量：'+fmt(f.before.volume_m3)+' → '+fmt(f.after.volume_m3)+' m³','该构件碳排：'+fmt(f.before.carbon_kgco2e)+' → '+fmt(f.after.carbon_kgco2e)+' kg CO₂e',Number.isFinite(f.carbon_delta_kgco2e)?'碳排'+(f.carbon_delta_kgco2e>0?'增加 ':f.carbon_delta_kgco2e<0?'减少 ':'变化 ')+fmt(Math.abs(f.carbon_delta_kgco2e))+' kg CO₂e'+(Number.isFinite(f.carbon_percent)?'（'+fmt(Math.abs(f.carbon_percent))+'%）':''):'碳排资料不齐，暂不能比较','程序计算 · 仅材料生产＋处置'];}
 function paintChecks(ids){$('structuralChecks').replaceChildren();for(const row of report.checks){const li=document.createElement('li');li.textContent=(ids?.includes(row.id)?'优先 · ':'')+row.title+'：'+row.needs;$('structuralChecks').append(li);}}
 function paintCitations(data,ids){const box=$('structuralCitations');box.replaceChildren();const chunks=data?.report?.rag?.retrievedEvidence||[],used=new Set(ids||[]);for(const chunk of chunks.filter(x=>used.has(x.id))){const row=document.createElement('div'),title=chunk.source_url?document.createElement('a'):document.createElement('span'),meta=document.createElement('small');row.className='rag-evidence-row';title.textContent=chunk.source_title+' · '+chunk.locator;if(chunk.source_url){title.href=chunk.source_url;title.target='_blank';title.rel='noopener';}meta.textContent=(chunk.authority==='normative_reference'?'公开规范摘要':'项目规则')+' · '+(chunk.project_applicability==='selected_project_context'?'项目条件已选定':'项目版本仍待确认');row.append(title,meta);box.append(row);}if(!box.childElementCount){const p=document.createElement('p');p.textContent='本次没有可显示的引用，回答未采用。';box.append(p);}}
 function buttons(){$('structuralAsk').disabled=!configured||!report?.scope_supported||!!controller;$('structuralAuto').disabled=!configured;}
 function cancel(){controller?.abort();controller=null;sectionController?.abort();sectionController=null;clearTimeout(timer);clearTimeout(sectionTimer);buttons();}
 function sync(){const s=W.state();panel.hidden=s.step!==3;const next=context();if(!next){cancel();report=null;body=null;latest=null;fingerprint='';emit();return;}if(s.step!==3)cancel();const key=JSON.stringify({next,model:s.candidate});if(key===fingerprint)return;
  fingerprint=key;cancel();sectionController?.abort();sectionController=null;sectionResult=null;$('sectionResult').replaceChildren();$('structuralCitations').replaceChildren();latest=null;body=next;report=R.assess(next.before,next.after,next.project);$('structuralAnswer').hidden=true;
  $('structuralSummary').textContent=summary(report);$('structuralFacts').replaceChildren(...factLines(report).map(t=>{const p=document.createElement('p');p.textContent=t;return p;}));
  $('structuralRisks').replaceChildren(...report.screening.rows.map(row=>{const p=document.createElement('p'),title=document.createElement('b');title.textContent=row.title;p.append(title,document.createElement('br'),document.createTextNode(row.detail));return p;}));
  const matched=report.screening.rulebook?.rules||[];$('structuralRuleSummary').textContent='规则包 '+(report.screening.rulebook?.version||'—')+' · 本次匹配 '+matched.length+' 条；“引用”不是已完成验算。';$('structuralRuleMatches').replaceChildren(...matched.map(rule=>{const p=document.createElement('p');p.textContent=rule.ruleId+' · '+rule.title+' · '+(rule.state==='calculated'?'已计算':rule.state==='screened'?'已筛查':'规范路径');return p;}));
  $('sectionStatus').textContent=body.sectionInput?'已读取该构件工程资料；尺寸变化后将校验内力是否仍对应。':'缺少该构件的混凝土强度、钢筋布置和受力计算结果，暂不能判断是否承受得住。';
  $('structuralState').textContent=report.scope_supported?'待核实':'暂不支持此构件';paintChecks();$('structuralSources').replaceChildren();for(const source of report.evidence){const p=document.createElement('p'),a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener';a.textContent=source.title;a.title=source.scope;p.append(a);$('structuralSources').append(p);}
  info(!report.scope_supported?'目前只接通混凝土楼板的修改分析。':configured?'这组变化已算好。点击分析，或开启修改后自动分析。':'请检查 AI 连接，再分析这次修改。');buttons();
  if(body.sectionInput&&s.step===3&&!($('structuralAuto').checked&&configured))sectionTimer=setTimeout(calculateSection,400);
  if(configured&&$('structuralAuto').checked&&report.changed&&report.scope_supported&&s.step===3){info('改动已记录，停止调整后自动分析…');timer=setTimeout(()=>ask({consent:true}),1500);}
 }
 async function health(){if($('structuralReconnect').disabled)return;$('structuralReconnect').disabled=true;info('正在检查 AI 连接…');try{const res=await fetch('http://127.0.0.1:8514/health',{signal:AbortSignal.timeout(4000),cache:'no-store'});if(!res.ok)throw Error();const h=await res.json();configured=h.configured===true&&h.changeReviewVersion>=5&&h.rulebookVersion==='au-early-design-0.1.0'&&h.structuralRagVersion==='au-early-design-rag-0.1.0';provider=h.provider||'模型服务';info(h.configured&&!configured?'当前仍是旧连接。请在 CarbonLoop 连接窗口点“重新连接（加载更新）”。':configured?provider+' 已连接结构 RAG。可分析当前修改。':'请先在连接窗口填写密钥并启用连接。');}catch{configured=false;info('未连接：请启用本地 AI 连接，并保持窗口打开。');}finally{if(!configured)$('structuralAuto').checked=false;$('structuralReconnect').disabled=false;buttons();emit();}}
 async function ask(options={}){
  if(!configured||!body||!report?.scope_supported||controller)return;
  if(sectionController){info('截面计算正在进行，请完成后再请 AI 分析。');return;}
  clearTimeout(sectionTimer);
  if(!options.consent&&!$('structuralAuto').checked){info('请在设计助手勾选发送授权，或开启上方自动分析。');return;}
  clearTimeout(timer);const key=fingerprint,abort=new AbortController();controller=abort;latest=null;$('structuralAnswer').hidden=true;buttons();info('AI 正在分析 '+summary(report)+'…');
  const timeout=setTimeout(()=>abort.abort(),55000);
  try{const request={...body,query:options.query||'针对本次修改，解释影响以及下一步该检查什么。',...(options.image?{image:options.image}:{})};const res=await fetch('http://127.0.0.1:8514/structural-review',{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json','X-CarbonLoop':'1'},body:JSON.stringify(request)});const data=await res.json();if(!res.ok)throw Error(data.error||'请求失败');if(key!==fingerprint)return;
   const a=data.answer;if(data.mode!=='live_ai'||a?.status!=='not_determined'||typeof a.reason!=='string'||typeof a.nextStep!=='string'||!Array.isArray(a.priorityCheckIds)||a.priorityCheckIds.some(id=>!R.checks[id])||!Array.isArray(a.citationIds)||!a.citationIds.length)throw Error('回复不是新版 RAG 修改分析，请重启本地连接后重试。');
   latest=data;if(data.report?.section_capacity)paintSection(data.report.section_capacity);paintChecks(a.priorityCheckIds);paintCitations(data,a.citationIds);$('structuralReason').textContent=a.reason;$('structuralNextStep').textContent=a.nextStep;$('structuralAnswer').hidden=false;info(provider+' 已检索并引用 '+a.citationIds.length+' 条依据 · 结构可用性仍待验算');
  }catch(e){if(key===fingerprint){info(e.name==='AbortError'?'分析已取消或超时，请重试。':e.message);if(e.name!=='AbortError')$('structuralAuto').checked=false;}}
  finally{clearTimeout(timeout);if(controller===abort){controller=null;buttons();emit();}}
 }

 function paintSection(result){
  sectionResult=result;$('sectionResult').replaceChildren();
  if(result.status!=='calculated'){$('sectionStatus').textContent=result.status==='missing_input'?'还缺混凝土强度、钢筋布置及改动后的受力计算结果。':result.error||'截面计算未完成（'+result.status+'），未作通过判断。';emit();return;}
  $('sectionStatus').textContent='已运行 concreteproperties '+result.version+' · '+result.code;
  for(const row of result.results){const p=document.createElement('p');p.textContent=(row.scheme==='before'?'修改前':'修改后')+'：抗弯承载力 '+fmt(row.capacity_knm)+' kN·m / '+fmt(row.strip_width_mm)+' mm 板带；'+(row.demand_knm===null?'设计内力缺失或已过期，不能判断该项是否满足。':'提供的设计弯矩 '+fmt(row.demand_knm)+' kN·m。'+(row.status==='capacity_exceeded'?'超过该截面抗弯承载力，不能按当前资料采用。':'仅这一项未超限，其他检查未完成。'));$('sectionResult').append(p);}emit();
 }
 async function calculateSection(){
  if(!body||!body.sectionInput){$('sectionStatus').textContent='请接入此构件的工程资料；不会用示例配筋替代真实配筋。';return;}
  sectionController?.abort();const control=new AbortController(),key=fingerprint;sectionController=control;$('sectionRun').disabled=true;$('sectionStatus').textContent='正在运行本地截面抗弯计算，不消耗 AI 额度…';emit();
  try{const res=await fetch('http://127.0.0.1:8514/section-check',{method:'POST',signal:AbortSignal.any([control.signal,AbortSignal.timeout(50000)]),headers:{'Content-Type':'application/json','X-CarbonLoop':'1'},body:JSON.stringify(body)});const data=await res.json();if(!res.ok)throw Error(data.error||'计算接口不可用');if(key===fingerprint)paintSection(data);}
  catch(e){if(key===fingerprint&&e.name!=='AbortError')$('sectionStatus').textContent='计算未完成：'+e.message;}
  finally{if(sectionController===control)sectionController=null;$('sectionRun').disabled=false;emit();}
 }
 $('sectionRun').onclick=calculateSection;
 $('sectionFile').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>60000)throw Error('工程资料文件过大');const data=JSON.parse(await file.text());if(!data||typeof data.elementId!=='string'||!data.input||data.input.method!=='rectangular-section-pure-bending')throw Error('需要包含 elementId 与 input 的截面工程资料，不是普通模型或碳排导出文件。');sectionInput=data;fingerprint='';sync();if(body?.after.id!==data.elementId)$('sectionStatus').textContent='已读取 '+data.elementId+' 的资料，请选中相应构件。';}
  catch(e){$('sectionStatus').textContent=e.message;}
 };

 $('structuralAsk').title='发送修改前后构件与项目资料给已配置模型，消耗 API 额度';$('structuralAsk').onclick=()=>ask({consent:true});$('structuralReconnect').onclick=health;$('structuralAuto').onchange=()=>{clearTimeout(timer);if($('structuralAuto').checked)ask({consent:true});else cancel();};
 $('openRuleStatus').textContent='查看本次修改分析';$('openRuleStatus').onclick=()=>{panel.scrollIntoView({behavior:'smooth',block:'center'});};
 document.addEventListener('carbon-model-render',sync);document.addEventListener('structure-input-change',sync);window.addEventListener('pagehide',cancel);
 window.StructuralReviewUI={ask,health,cancel,summary,factLines,calculateSection,exportState:()=>({section_capacity:sectionResult,selected:report,ai_result:latest,message,configured,busy:!!controller,section_busy:!!sectionController,status:'not_determined',solver_run:false,rulebook_retrieval_run:!!report?.execution?.rulebook_retrieval_run,rag_retrieval_run:!!latest?.report?.execution?.rag_retrieval_run,normative_rules_run:false})};
 sync();health();
})();
