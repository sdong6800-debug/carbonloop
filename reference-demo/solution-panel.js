(function(){
 'use strict';
 const C=window.ModelCore,Core=window.CarbonSolutions,W=window.CarbonWorkspace,$=id=>document.getElementById(id);
 const panel=document.createElement('section');panel.id='solutions';panel.className='panel';panel.hidden=true;
 panel.innerHTML='<div class="solution-heading"><div><p class="eyebrow">AI-ASSISTED DESIGN</p><h2>寻找减碳方案</h2><p>说清目标，系统比较可研究的改法；原模型不会被覆盖。</p></div><span id="solutionMode">本地试算</span></div><div class="solution-controls"><section class="solution-request"><label for="solutionGoal">你希望怎样改进？</label><textarea id="solutionGoal" maxlength="1000" rows="2">尽量减少碳排，保持柱位、跨度和建筑空间不变，优先研究不改尺寸的方案。</textarea><div class="solution-locks"><b>保持不变</b><span>构件位置</span><span>柱网与跨度</span><span>建筑空间</span></div><div class="solution-options"><label>研究范围 <select id="solutionScope"><option value="all">本次模型分析范围</option><option value="selected">仅选中构件</option></select></label><label><input id="solutionMaterial" type="checkbox" checked>可以更换材料配方</label></div><details><summary>可选：探索构件尺寸</summary><div class="solution-thickness"><label><input id="solutionThickness" type="checkbox">可以探索当前楼板厚度</label><div class="solution-range"><label>最小 mm <input id="solutionMin" type="number" min="60" max="1000" placeholder="下限"></label><label>最大 mm <input id="solutionMax" type="number" min="60" max="1000" placeholder="上限"></label></div><p>区间只用于比较；系统不会移动梁柱或改变跨度。</p></div></details></section><aside class="solution-actions"><b>生成并比较方案</b><p>程序负责复算碳排；AI 负责理解要求、解释取舍和安排优先核实项。</p><label class="solution-ai-switch"><input id="solutionConsent" type="checkbox">让 AI 参与推荐</label><small>发送本次构件数据与要求 · 消耗 API 额度</small><button id="solutionFind">生成改进方案</button><div class="solution-connection-row"><span id="solutionConnection" role="status"></span><button id="solutionReconnect" class="text-button">检查连接</button></div></aside></div><p id="solutionStatus" role="status"></p><div id="solutionAdvice" hidden><b>AI 建议优先核实</b><p id="solutionReason"></p><p id="solutionNext"></p></div><div id="solutionCards"></div><details id="solutionBasis"><summary>查看比较范围、数据来源与未覆盖内容</summary><p id="solutionBoundary"></p><p>材料路径目前接入一条混凝土配方替换记录。厚度路径只比较所填区间的下限、中点和上限；不是连续优化，不搜索整个设计空间。没有结构分析资料时，不判定可实施。</p><p id="solutionExcluded"></p><a href="https://www.kbob.admin.ch/de/oekobilanzdaten-im-baubereich" target="_blank" rel="noopener">KBOB 材料数据库来源</a></details>';
 document.querySelector('.flow-guide').after(panel);
 let report=null,ai=null,signature='',controller=null,configured=false,compatible=false,imageCompatible=false,inputRevision=0,generatedRevision=-1;
 const fmt=n=>Number.isFinite(n)?n.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—';
 const model=()=>W.researchModel()||[];
 const modelSignature=()=>JSON.stringify(model());
 function readOptions(){return {scope:$('solutionScope').value,selectedId:W.state().selected,allowMaterial:$('solutionMaterial').checked,allowThickness:$('solutionThickness').checked,minMm:$('solutionMin').value,maxMm:$('solutionMax').value};}
 function invalidate(note){controller?.abort();controller=null;report=null;ai=null;$('solutionCards').replaceChildren();$('solutionAdvice').hidden=true;$('solutionFind').disabled=false;if(note)$('solutionStatus').textContent=note;}
 function renderCards(){
  $('solutionCards').replaceChildren();if(!report)return;
  for(const candidate of report.candidates){
   const card=document.createElement('article');card.className='solution-card';card.dataset.candidateId=candidate.id;
   const top=document.createElement('span');top.className='solution-tag';top.textContent=ai?.answer?.preferredId===candidate.id?'AI 建议优先核实':'待验证候选';
   const title=document.createElement('h3');title.textContent=candidate.title;
   const amount=document.createElement('strong');amount.textContent='试算减少 '+fmt(candidate.savedKg)+' kg CO₂e';
   const scope=document.createElement('p');scope.className='solution-impact';scope.innerHTML='<b>碳排影响</b><span></span>';scope.querySelector('span').textContent=candidate.scopeComplete?fmt(candidate.scopeBefore)+' → '+fmt(candidate.scopeAfter)+' kg CO₂e（−'+fmt(candidate.scopePercent)+'%）':'范围存在缺项，仅显示所改构件的差值。';
   const changed=document.createElement('p');changed.className='solution-change';changed.innerHTML='<b>怎么改</b><span></span>';changed.querySelector('span').textContent=candidate.kind==='material'?'更换混凝土配方参考；尺寸、位置和数量不变。':'调整所选楼板厚度；材料、平面范围和位置不变。';
   const structure=document.createElement('p');structure.className='solution-structure';structure.innerHTML='<b>结构提示</b><span></span>';structure.querySelector('span').textContent=candidate.checks[0];
   const basis=document.createElement('p');basis.className='solution-caveat';basis.textContent=candidate.basis;
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='采用前需要核实什么';details.append(summary);for(const check of candidate.checks){const p=document.createElement('p');p.textContent=check;details.append(p);}
   const accept=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';accept.append(checkbox,document.createTextNode('我知道这是一份待验证方案'));
   const apply=document.createElement('button');apply.className='outline';apply.textContent='加入对比';apply.disabled=true;checkbox.onchange=()=>apply.disabled=!checkbox.checked;
   apply.onclick=()=>{try{if(signature!==modelSignature()||generatedRevision!==inputRevision)throw Error('模型或要求已改变，请重新寻找。');W.applySolution(report.options,candidate.id,{mode:ai?.mode==='live_ai'&&ai.answer.preferredId===candidate.id?'live_ai':'rule_trial',origin:'程序生成有限候选并复算，AI 仅在真实调用成功时解释优先核实方向',provider:ai?.provider||null,model:ai?.model||null,answer:ai?.answer||null,query:$('solutionGoal').value,imageUsed:!!ai?.imageUsed,candidate,evidence:window.CarbonAI.retrieve(model()),confirmedAt:new Date().toISOString()},signature);$('solutionStatus').textContent='已加入待验证草案；原方案保留。可在下方模型查看变化。';$('scopeImpactSummary').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){$('solutionStatus').textContent=e.message;}};
   card.append(top,title,amount,changed,scope,structure,basis,details,accept,apply);$('solutionCards').append(card);
  }
 }
 async function health(){
  $('solutionConnection').textContent='正在检查…';
  try{const res=await fetch('http://127.0.0.1:8514/health',{signal:AbortSignal.timeout(4000),cache:'no-store'});const h=await res.json();configured=res.ok&&h.configured===true;compatible=h.solutionVersion>=1;imageCompatible=h.solutionImagesVersion>=1&&h.provider==='DeepSeek'&&h.model==='deepseek-flash';$('solutionConnection').textContent=configured&&compatible?'AI 已连接':configured?'连接程序需要更新':'AI 未连接 · 可用本地试算';$('solutionMode').textContent=configured&&compatible?'AI 已连接':'本地试算';}catch{configured=false;compatible=false;imageCompatible=false;$('solutionConnection').textContent='AI 未连接 · 可用本地试算';$('solutionMode').textContent='本地试算';}
 }
 $('solutionReconnect').onclick=health;
 $('solutionFind').onclick=async()=>{
  if(window.CarbonSolutionAttachment?.isLoading()){$('solutionStatus').textContent='截图正在读取，请稍候。';return;}
  invalidate();signature=modelSignature();generatedRevision=inputRevision;
  try{report=Core.calculate(model(),readOptions());}catch(e){$('solutionStatus').textContent=e.message;return;}
  renderCards();$('solutionBoundary').textContent=report.boundary+' '+report.optimality;$('solutionExcluded').textContent='未生成替换候选的构件：'+(report.excluded.map(x=>x.id+'（'+x.reason+'）').join('；')||'无');
  if(!report.candidates.length){$('solutionStatus').textContent='当前数据与允许改动中，没有找到可计算的减碳候选。没有随意缩小构件或编造材料。';return;}
  $('solutionStatus').textContent='已复算 '+report.candidates.length+' 个候选，按试算减排量排序；结构适用性未验证。';
  if(!$('solutionConsent').checked){$('solutionStatus').textContent+=' 当前为程序试算，未调用 AI；勾选上方 AI 选项后可请求取舍建议。';return;}
  if(!configured||!compatible){$('solutionStatus').textContent+=' AI 尚未就绪，请检查连接；下方不是 AI 推荐。';return;}
  const image=window.CarbonSolutionAttachment?.getData();
  if(image&&!imageCompatible){$('solutionStatus').textContent='已保留本地候选，尚未发送截图。请在连接窗口选择 DeepSeek Flash 并重新连接，再检查 AI 连接。';return;}
  const sig=signature,revision=inputRevision,abort=new AbortController();controller=abort;$('solutionFind').disabled=true;$('solutionStatus').textContent='候选已复算，AI 正在按你的要求比较…';
  const timeout=setTimeout(()=>abort.abort(),55000);
  try{
   const elements=model().map(e=>Object.fromEntries(['id','type','material','x','y','z','l','w','h','factorId','quantity'].filter(k=>e[k]!==undefined).map(k=>[k,e[k]])));
   const res=await fetch('http://127.0.0.1:8514/solutions',{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json','X-CarbonLoop':'1'},body:JSON.stringify({elements,options:report.options,query:$('solutionGoal').value,...(image?{image}:{})})});const data=await res.json();if(!res.ok)throw Error(data.error||'请求失败');if(abort.signal.aborted||sig!==modelSignature()||revision!==inputRevision)return;
   if(data.mode!=='live_ai'||!data.answer||data.answer.preferredId&&!report.candidates.some(c=>c.id===data.answer.preferredId))throw Error('AI 返回的候选不匹配，未采用。');
   ai=data;if(image&&data.imageUsed)window.CarbonSolutionAttachment.markUsed(image);$('solutionAdvice').hidden=false;$('solutionReason').textContent=data.answer.reason;$('solutionNext').textContent='下一步：'+data.answer.nextStep;renderCards();$('solutionStatus').textContent=data.answer.preferredId?'AI 已给出优先核实方向；没有自动修改模型。':'AI 没有推荐符合额外要求的方案；下方仍是程序试算，不代表满足你的全部要求。';
  }catch(e){if(sig===modelSignature()&&revision===inputRevision)$('solutionStatus').textContent=(e.name==='AbortError'?'AI 请求取消或超时。':e.message)+' 下方保留程序试算，未标成 AI 推荐。';}
  finally{clearTimeout(timeout);if(controller===abort){controller=null;$('solutionFind').disabled=false;}}
 };
 for(const id of ['solutionGoal','solutionScope','solutionMaterial','solutionThickness','solutionMin','solutionMax'])$(id).addEventListener('input',()=>{inputRevision++;invalidate('要求已改变，请重新寻找方案。');});
 $('solutionConsent').onchange=()=>{if(!$('solutionConsent').checked&&controller){controller.abort();controller=null;$('solutionFind').disabled=false;$('solutionStatus').textContent='已停止请求，未继续生成 AI 推荐。';}};
 document.addEventListener('carbon-solution-image-change',()=>{inputRevision++;$('solutionConsent').checked=false;invalidate('截图已改变，旧建议已清除。确认截图后重新勾选 AI 发送选项。');});
 let previousSignature='',previousSelected='';
 function sync(){const s=W.state();panel.hidden=s.step!==3;const next=modelSignature(),selectionRelevant=$('solutionScope').value==='selected'||$('solutionThickness').checked;
  if(next!==previousSignature||(selectionRelevant&&s.selected!==previousSelected)){invalidate(report?'模型或构件已改变，请重新寻找方案。':'');previousSignature=next;previousSelected=s.selected;}
  if(panel.hidden&&controller)invalidate('已停止请求。');
  if($('reportExplore'))$('reportExplore').textContent='寻找减碳方案 →';
 }
 document.addEventListener('carbon-model-render',sync);window.addEventListener('pagehide',()=>controller?.abort());sync();health();
})();
