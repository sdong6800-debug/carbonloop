(function(){
 'use strict';const $=id=>document.getElementById(id),W=window.CarbonWorkspace,C=window.ModelCore,D=window.CarbonChange;
 function dialog(id,title){const d=document.createElement('dialog');d.id=id;d.innerHTML='<div class="dialog-heading"><h2></h2><button class="outline" type="button">关闭</button></div><div class="dialog-body"></div>';d.querySelector('h2').textContent=title;d.querySelector('button').onclick=()=>d.close();document.body.append(d);return d;}
 const help=dialog('productHelp','使用帮助');help.querySelector('.dialog-body').innerHTML='<h3>1. 选择范围</h3><p>选整个模型、一个楼层，或在模型上选择部分构件。读取后，只有这个范围参与计算。当前演示数据已经通过 Rhino 接入协议转换与校验，但真实 Rhino 插件尚未连接；材料匹配仍需建筑师核对。</p><h3>2. 核对材料</h3><p>点击构件或列表，模型会高亮。分类或材料不对时直接修改，再确认。批量确认只确认已有建议，不会补齐未知材料；缺项不会当作零排放。</p><h3>3. 查看碳排</h3><p>结果按所选范围统计。当前只计算材料生产与处置，不是建筑全生命周期总量。明细及来源可以展开查看。</p><h3>4. 改进方案</h3><p>进入同一个工作区，在模型或构件列表切换楼板、柱、墙。修改会累积保存到当前草案；原模型不变。右侧实时显示选中构件与整个所选范围的变化。恢复此构件只撤销这个构件的改动。</p><h3>5. 修改提示与 AI</h3><p>即时提示来自确定性计算。结构 RAG 在真实调用时显示引用 ID 和来源；应用建议前仍需确认，旧建议会在模型变化后失效。</p><p>当前是前期结构影响筛查，不是完整结构规范验算；仍需要适用规范、材料性能、荷载、支承及分析数据。</p><h3>模型、楼层与净量</h3><p>示例采用已有 1F / 2F 标签。真实接入需核对楼层或图层，跨层构件不能仅凭高度自动截断。型钢按演示 I 形截面净量计算；其他示例采用简化实体量。未建模钢筋和墙体洞口等不自动补出。</p>';
 const helpButton=document.createElement('button');helpButton.className='text-button';helpButton.id='openProductHelp';helpButton.textContent='使用帮助';helpButton.onclick=()=>help.showModal();document.querySelector('header nav').append(helpButton);
 // Remove training-style captions from the primary workflow, not status/errors.
 for(const id of ['entryInstruction','entryReadHint','entryModelHint','entrySelectionHint','entryConfirmHelp','entryAutoSummary','entryTypeBasis','entryMaterialBasis','entryMatchBasis'])$(id)?.classList.add('manual-only');
 document.querySelectorAll('#entrySetup>.help,.entry-connection,#entryEmpty>p,.entry-floor-basis,#entryDetail>.help,.entry-scope small').forEach(e=>e.classList.add('manual-only'));
 $('entryEmpty').querySelector('.eyebrow').textContent='所选构件';
 document.querySelector('.entry-badge').textContent='Rhino 接入协议 · 插件未连接';
 document.querySelector('#entryReview>h3').textContent='构件与材料';
 document.querySelector('#entryCorrections>summary').textContent='分类与材料';
 $('entryPhase1').textContent='1 选择范围';$('entryPhase2').textContent='2 核对材料';$('entryPhase3').textContent='3 查看结果';
 $('entryObjectList').querySelector('summary').textContent='筛选构件';
 document.querySelector('#resultModelDetails>summary').textContent='模型详情';
 document.querySelector('.flow-steps [data-step="2"]').hidden=true;
 document.querySelector('.flow-steps [data-step="1"]').innerHTML='01 <span>碳排结果</span>';
 document.querySelector('.flow-steps [data-step="3"]').innerHTML='02 <span>改进方案</span>';
 document.querySelector('.flow-steps [data-step="4"]').innerHTML='03 <span>对比与保留</span>';
 // One editing workspace, one assistant entry. No prerequisite slab/column/wall selection screen.
 const aiDialog=dialog('workbenchAssistant','AI 材料助手'),aiPanel=$('aiPanel');aiDialog.querySelector('.dialog-body').append(aiPanel);
 const feedback=document.createElement('section');feedback.id='editFeedback';feedback.innerHTML='<div class="feedback-heading"><b>修改提示</b><span>计算反馈 · 非 AI</span></div><p id="editFeedbackText" aria-live="polite"></p><div class="feedback-actions"><button id="openWorkbenchAI" class="outline">AI 材料建议</button><button id="openRuleStatus" class="text-button">结构核验未接入</button></div>';
 document.querySelector('.center-column').append(feedback);
 $('openWorkbenchAI').onclick=()=>aiDialog.showModal();
 document.addEventListener('carbon-ai-applied',()=>aiDialog.close());
 $('openRuleStatus').onclick=()=>help.showModal();
 const component=dialog('componentInfo','构件资料');
 // Baseline details are read-only; never expose draft editing controls under carbon results.
 $('reportComponents').addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const row=button.closest('[data-result-id]');if(!row)return;event.stopImmediatePropagation();const e=W.state().baseline.find(e=>e.id===row.dataset.resultId),r=C.element(e);component.querySelector('h2').textContent=e.name+' '+e.id;const body=component.querySelector('.dialog-body');body.replaceChildren();for(const [label,value] of [['材料',C.materialInfo(e.material).name],['尺寸',`${e.l} × ${e.w} × ${e.h} m`],['体积',r.volume==null?'待补充':r.volume.toFixed(3)+' m³'],['排放',r.error||r.value.toFixed(2)+' kg CO₂e'],['计算依据',r.error||`KBOB ${r.factor.id} · 生产＋处置`]]){const p=document.createElement('p');p.textContent=label+'：'+value;body.append(p);}component.showModal();},true);
 function sync(){const state=W.state();document.querySelector('.flow-steps [data-step="3"]').disabled=!state.baseline;
  if(!state.baseline)return;
  // The navigation may enter edit before a candidate exists; route via the same transaction.
  if(state.step===3){$('flowTitle').textContent='寻找减碳方案';$('flowDescription').textContent='';$('flowBack').textContent='返回碳排结果';}
  if(state.step===4)$('flowTitle').textContent='对比并保留方案';
  $('reportExplore').textContent='寻找减碳方案 →';$('recheckModel').textContent='核对记录';
  $('resultModelDetails').hidden=true;
  document.querySelectorAll('#reportComponents button').forEach(b=>b.textContent='查看');
  feedback.hidden=state.step!==3;
  const e=(state.candidate||state.baseline).find(x=>x.id===state.selected),base=state.baseline.find(x=>x.id===state.selected);if(!e||!base)return;
  const before=C.element(base),after=C.element(e),changed=D.differences(base,e);
  $('openWorkbenchAI').disabled=!state.candidate;
  if(after.error)$('editFeedbackText').textContent=after.error+'，请先核对。';
  else if(!changed.length)$('editFeedbackText').textContent='选择构件后修改尺寸或材料。';
  else if(before.error)$('editFeedbackText').textContent='当前可以计算；原材料资料不全，暂不能比较。';
  else if(e.material!==base.material||e.factorId!==base.factorId)$('editFeedbackText').textContent='材料已更换，排放已重算。材料性能仍待核对。';
  else{const delta=after.mass-before.mass,percent=before.mass?Math.abs(delta/before.mass*100):null;$('editFeedbackText').textContent=`${e.name}用量${delta>=0?'增加':'减少'}${percent===null?'':percent.toFixed(1)+'%'}，碳排已同步更新。`;}
 }
 const editNav=document.querySelector('.flow-steps [data-step="3"]');editNav.addEventListener('click',event=>{if(!W.hasCandidate()){event.stopImmediatePropagation();$('reportExplore').click();}},true);
 document.addEventListener('carbon-model-render',sync);sync();
})();
