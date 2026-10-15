(function(){
 'use strict';
 const W=window.CarbonWorkspace,C=window.ModelCore,D=window.CarbonChange,$=id=>document.getElementById(id);
 const panel=document.createElement('section');panel.id='decisionSummary';panel.className='decision-summary panel';panel.hidden=true;
 panel.innerHTML='<header class="decision-heading"><div><p class="eyebrow">DECISION REVIEW</p><h2>这份候选值得保留吗？</h2><p>先看碳排变化，再看结构依据和缺失资料。</p></div><span id="decisionState" class="decision-state">待判断</span></header><div id="decisionVerdict" class="decision-verdict"></div><div id="decisionImpactMount"></div><div class="decision-grid"><article><span class="decision-label">方案改变</span><h3 id="decisionChangeTitle"></h3><ul id="decisionChanges"></ul></article><article><span class="decision-label">结构与规范</span><div class="decision-status-line"><b id="decisionStructureState"></b><span id="decisionRagState"></span></div><p id="decisionStructureText"></p><details><summary>查看本次 RAG 依据</summary><div id="decisionCitations"></div></details></article></div><details class="decision-missing"><summary id="decisionMissingSummary">还缺哪些资料？</summary><ul id="decisionMissing"></ul></details><footer class="decision-footer"><div><b id="decisionActionTitle"></b><p id="decisionActionNote"></p></div><div id="decisionActions" class="flow-actions"></div></footer>';
 document.getElementById('app').append(panel);
 const originalActions=document.querySelector('.flow-guide .flow-actions');
 let status='not_reviewed',lastSignature='';
 const fmt=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('zh-CN',{maximumFractionDigits:d}):'—';
 function structuralState(){return window.StructuralReviewUI?.exportState?.()||{};}
 function changedRows(state){return state.candidate.flatMap(candidate=>D.differences(state.baseline.find(base=>base.id===candidate.id),candidate).map(text=>({id:candidate.id,name:candidate.name,text})));}
 function addCitation(chunk){const row=document.createElement('div'),title=chunk.source_url?document.createElement('a'):document.createElement('span'),meta=document.createElement('small');row.className='decision-citation';title.textContent=chunk.source_title+' · '+chunk.locator;if(chunk.source_url){title.href=chunk.source_url;title.target='_blank';title.rel='noopener';}meta.textContent=chunk.authority==='normative_reference'?'公开规范摘要':'项目筛查规则';row.append(title,meta);return row;}
 function sync(){
  const state=W.state();if(!state.baseline)return;const active=state.step===4&&state.candidate;panel.hidden=!active;
  if(!active){if($('flowBack').parentElement!==originalActions)originalActions.append($('flowBack'),$('flowNext'));return;}
  const signature=JSON.stringify(state.candidate);if(signature!==lastSignature){status='not_reviewed';lastSignature=signature;}
  panel.dataset.decision=status;
  const comparison=C.compare(state.baseline,state.candidate),changes=changedRows(state),structural=structuralState(),review=structural.selected,answer=structural.ai_result?.answer,rag=structural.ai_result?.report?.rag;
  const reduced=comparison.compatible&&comparison.delta<0,increased=comparison.compatible&&comparison.delta>0,unchanged=comparison.compatible&&Math.abs(comparison.delta)<1e-7;
  $('decisionState').textContent=!comparison.compatible?'资料不完整':!changes.length?'尚无改动':reduced?'可保留为待验证候选':increased?'不符合减碳目标':'碳排未变化';
  $('decisionState').dataset.state=!comparison.compatible?'missing':reduced?'positive':increased?'negative':'neutral';
  const verdict=$('decisionVerdict');verdict.dataset.trend=!comparison.compatible?'unknown':reduced?'down':increased?'up':'same';
  verdict.textContent=!comparison.compatible?'当前计算资料不完整，不能比较两个方案。':reduced?`候选在当前边界内减少 ${fmt(Math.abs(comparison.delta))} kg CO₂e（${fmt(Math.abs(comparison.percent))}%）。` : increased?`候选在当前边界内增加 ${fmt(comparison.delta)} kg CO₂e（${fmt(comparison.percent)}%）。` : unchanged?'当前计算边界内没有变化。':'尚无可比较结果。';
  const impact=$('changeImpact');if(impact&&impact.parentElement!==$('decisionImpactMount'))$('decisionImpactMount').append(impact);
  $('decisionChangeTitle').textContent=changes.length?changes.length+' 项改动':'候选与原方案相同';
  $('decisionChanges').replaceChildren(...(changes.length?changes.map(row=>{const li=document.createElement('li');li.textContent=row.name+' '+row.id+'：'+row.text;return li;}):[Object.assign(document.createElement('li'),{textContent:'请返回上一步调整构件或材料。'})]));
  const citations=rag?.retrievedEvidence?.filter(chunk=>answer?.citationIds?.includes(chunk.id))||[];
  const section=structural.section_capacity,after=section?.results?.find(row=>row.scheme==='after');
  $('decisionStructureState').textContent=after?.status==='capacity_exceeded'?'截面抗弯超限':after?.status==='within_bending_capacity_only'?'仅一项未超限':'待结构复核';
  $('decisionRagState').textContent=citations.length?'RAG 已引用 '+citations.length+' 条':'RAG 尚未用于这个候选';
  $('decisionStructureText').textContent=after?.status==='capacity_exceeded'?'已提供的修改后设计弯矩超过该截面计算抗弯承载力，当前候选不应继续作为可采用方案。':answer?.reason||review?.explanation||'规则只完成前期影响筛查，尚未运行完整结构求解和规范校核。';
  $('decisionCitations').replaceChildren(...(citations.length?citations.map(addCitation):[Object.assign(document.createElement('p'),{textContent:'本候选尚未调用结构 RAG。返回调整页后可对修改请 AI 分析，再回来确认。'})]));
  const missing=[...new Set([...(review?.missing||[]),...(after?.status==='capacity_exceeded'?['修改结构方案并重新计算']:[]),...(!comparison.compatible?['补齐碳计算缺项']:[])])];
  $('decisionMissingSummary').textContent='还缺哪些资料？'+(missing.length?'（'+missing.length+' 项）':'');
  $('decisionMissing').replaceChildren(...(missing.length?missing:['完整结构核验与专业确认']).map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  const exceeded=after?.status==='capacity_exceeded',blocked=!changes.length;
  $('decisionActionTitle').textContent=blocked?'先返回修改':!comparison.compatible?'可导出缺项报告，但不能保留候选':exceeded?'记录风险，不保留为可采用候选':'保留的是“待验证候选”，不是施工结论';
  $('decisionActionNote').textContent=blocked?'至少完成一项改动后再进行对比。':'Excel 会保留碳差值、改动、RAG 引用和待补资料，供下一轮验证。';
  $('decisionActions').append($('flowBack'),$('flowNext'));$('flowBack').hidden=false;$('flowBack').textContent='返回调整';$('flowNext').disabled=blocked;$('flowNext').textContent=blocked?'暂不能保留':!comparison.compatible?'下载缺项报告 Excel ↓':exceeded?'下载风险记录 Excel ↓':'保留候选并下载 Excel ↓';
  panel.dataset.exportKind=!comparison.compatible?'incomplete':exceeded?'risk':'candidate';
 }
 $('flowNext').addEventListener('click',()=>{if(W.state().step===4&&!$('flowNext').disabled){status=panel.dataset.exportKind==='incomplete'?'exported_incomplete':panel.dataset.exportKind==='risk'?'exported_risk_record':'kept_for_validation';panel.dataset.decision=status;}},true);
 $('flowBack').addEventListener('click',()=>{if(W.state().step===4)status='returned_to_edit';},true);
 document.addEventListener('carbon-model-render',sync);document.addEventListener('carbon-structural-feedback',sync);
 window.ComparisonDecision={render:sync,exportState:()=>{const state=W.state(),comparison=state.baseline&&state.candidate?C.compare(state.baseline,state.candidate):null,structural=structuralState(),answer=structural.ai_result?.answer,rag=structural.ai_result?.report?.rag;const meanings={kept_for_validation:'候选被保留进入下一轮验证；不是结构批准或施工结论',exported_incomplete:'资料不完整；仅导出缺项记录，候选未被保留',exported_risk_record:'发现结构风险；仅导出风险记录，候选未被保留'};return {status,meaning:meanings[status]||'尚未保留',carbon_comparison:comparison?{compatible:comparison.compatible,delta_kgco2e:comparison.compatible?comparison.delta:null,percent:comparison.compatible?comparison.percent:null}:null,structural_status:'not_determined',rag_citation_ids:answer?.citationIds||[],rag_knowledge_base_version:rag?.version||null,missing:[...(structural.selected?.missing||[])]};}};
 sync();
})();
