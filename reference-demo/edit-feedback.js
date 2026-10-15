(function(){
 'use strict';
 const $=id=>document.getElementById(id),W=window.CarbonWorkspace;
 const card=document.createElement('section');card.id='editReview';card.setAttribute('aria-label','本次修改反馈');
 card.innerHTML='<div class="edit-review-heading"><b>前期结构判断</b><span id="editReviewState"></span></div><p id="editReviewImpact"></p><div id="editRuleTrace" aria-label="本次规则判断"></div><p id="editReviewVerdict"></p><div id="editReviewAI" hidden><div class="edit-ai-heading"><b>DeepSeek + RAG 分析</b><span id="editReviewRagCount"></span></div><p id="editReviewReason"></p><div id="editReviewRagProof" aria-label="本次 RAG 引用"></div></div><p id="editReviewConnection" role="status"></p><div class="edit-review-actions"><button id="editReviewAsk" type="button" class="outline">请 AI 分析</button></div>';
 $('editorSize').append(card);
 // Move the existing consent control: one authorization, no duplicate checkbox.
 const consent=$('structuralAuto').closest('label');
 consent.lastChild.textContent='修改后自动分析（开启一次，之后自动记住）';
 consent.title='开启一次后会记住设置。每次停止修改 1.5 秒后，发送当前构件、修改内容及项目资料给已连接的大模型；取消勾选即停止自动分析。';
 card.append(consent);
 const disclosure=document.createElement('small');disclosure.textContent='停止修改 1.5 秒后调用一次 · 发送修改资料给 AI · 消耗 API 额度';consent.append(document.createElement('br'),disclosure);
 $('editReviewAsk').title='发送本次修改给已连接的大模型，消耗 API 额度';
 $('editReviewAsk').onclick=()=>window.StructuralReviewUI.ask({consent:true});
 const detail=$('structureStatusLink');detail.textContent='查看依据与详细分析';$('editReviewAsk').after(detail);
 const openDetails=detail.onclick;
 detail.onclick=()=>{openDetails();$('decisionStructure').scrollIntoView({behavior:'smooth',block:'start'});};
 function render(){
  const state=W.state(),review=window.StructuralReviewUI.exportState(),r=review.selected;
  card.hidden=state.step!==3||!r;
  if(card.hidden)return;
  const rows=r.screening?.rows||[],weight=rows.find(x=>x.id==='self_weight'),risk=rows.find(x=>['position','material','thinner','thicker','scope'].includes(x.id));
  const percent=weight?Math.abs(weight.value).toLocaleString('zh-CN',{maximumFractionDigits:1}):null;
  $('editReviewImpact').textContent=weight?'同密度下，这块楼板的自重'+(weight.value>0?'增加 ':'减少 ')+percent+'%。'+(weight.value>0?'支承构件也要承受新增重量。':'仍需检查承载与变形。'):risk?.title||'尚未改变尺寸或材料。';
  const matched=r.screening?.rulebook?.rules||[],trace=$('editRuleTrace');trace.replaceChildren();
  const addTrace=(state,label,text)=>{const row=document.createElement('div'),tag=document.createElement('span'),content=document.createElement('p');row.className='rule-trace-row';row.dataset.state=state;tag.textContent=label;content.textContent=text;row.append(tag,content);trace.append(row);};
  const calculated=matched.find(x=>x.state==='calculated'),screened=matched.find(x=>x.state==='screened'),reference=matched.find(x=>x.state==='reference_only');
  if(calculated)addTrace('calculated','已计算',calculated.detail);
  if(screened)addTrace('screened','已筛查',screened.title);
  if(reference)addTrace('reference','待验证','是否可实施，还要比较构件受到的作用和它能承受的能力。');
  if(!matched.length)addTrace('reference','未匹配',r.scope_supported?'当前修改尚未触发规则。':'当前规则包尚未覆盖这个构件。');
  const calc=review.section_capacity,after=calc?.results?.find(x=>x.scheme==='after'),exceeded=calc?.status==='calculated'&&after?.status==='capacity_exceeded',carbonDelta=r.facts?.carbon_delta_kgco2e,thicknessDelta=r.facts?.thickness?.delta_mm;
  card.dataset.level=exceeded?'danger':'review';
  const worsensCarbon=Number.isFinite(carbonDelta)&&carbonDelta>0,improvesCarbon=Number.isFinite(carbonDelta)&&carbonDelta<0;
  $('editReviewState').textContent=exceeded?'抗弯超限':!r.scope_supported?'暂不支持':worsensCarbon&&thicknessDelta>0?'不建议':improvesCarbon&&thicknessDelta<0?'可研究':'待核验';
  $('editReviewVerdict').textContent=exceeded?'提供的设计弯矩已超过修改后截面的抗弯承载力。':after?.status==='within_bending_capacity_only'?'仅截面抗弯这一项未超限；冲切、变形等检查尚未完成。':!r.scope_supported?'当前规则包尚未覆盖这个构件，暂不提供结构方向。':worsensCarbon&&thicknessDelta>0?'不建议把这次加厚作为减碳方案：碳排和楼板自重同时上升。除非有其他设计原因，否则可先恢复原厚度或研究低碳材料。':improvesCarbon&&thicknessDelta<0?'这是一个值得继续比较的减碳方向：碳排和楼板自重下降。下一步先确认跨度、支承方式和楼面用途，再判断这个厚度是否值得进入结构验证。':after?.status==='missing_design_action'?'已计算截面承载力，但修改后的设计作用缺失或已过期。':'当前可以继续比较碳排；是否可实施，需要结合这次修改命中的结构规则进一步验证。';
  const answer=review.ai_result?.answer,rag=review.ai_result?.report?.rag,usedIds=new Set(answer?.citationIds||[]),usedEvidence=(rag?.retrievedEvidence||[]).filter(item=>usedIds.has(item.id));$('editReviewAI').hidden=!answer;
  $('editReviewReason').textContent=answer?.reason||'';
  $('editReviewRagCount').textContent=answer?'已引用 '+usedEvidence.length+' 条':'';
  $('editReviewRagProof').replaceChildren(...usedEvidence.map(item=>{const row=document.createElement('div'),title=document.createElement('b'),meta=document.createElement('span');row.className='edit-rag-row';title.textContent=item.source_title;meta.textContent='引用 ID：'+item.id+' · '+item.locator;row.append(title,meta);return row;}));
  $('editReviewAsk').disabled=!review.configured||review.busy||review.section_busy||!r.scope_supported;
  $('editReviewAsk').textContent=review.busy?'正在分析…':answer?'重新分析':'请 AI 分析';
  $('editReviewConnection').textContent=review.busy?'AI 正在阅读本次修改…':review.message.includes('自动分析…')?'停止调整后自动分析…':answer?'本次回答已通过 RAG 引用校验':review.configured?'DeepSeek 已连接，等待分析当前修改':'AI 尚未连接；上面的规则判断仍然有效。';
  detail.textContent=weight?(weight.value>0?'展开完整加厚分析':'展开完整减薄分析'):risk?.id==='material'?'展开完整材料分析':'展开完整结构分析';
 }
 document.addEventListener('carbon-model-render',render);
 document.addEventListener('carbon-structural-feedback',render);
 render();
})();
