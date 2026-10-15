(function(){
 'use strict';
 const $=id=>document.getElementById(id),W=window.CarbonWorkspace,C=window.ModelCore,D=window.CarbonChange;
 // Presentation only: retain existing event handlers, calculation and consent gates.
 const results=document.querySelector('.results'),viewer=document.querySelector('.viewer');
 const rail=document.createElement('section');rail.id='decisionRail';rail.innerHTML='<div class="decision-tabs" role="tablist" aria-label="查看结果或助手"><button type="button" role="tab" id="decision-carbon" aria-controls="decisionCarbon" aria-selected="true" tabindex="0">碳排变化</button><button type="button" role="tab" id="decision-structure" aria-controls="decisionStructure" aria-selected="false" tabindex="-1">结构检查</button><button type="button" role="tab" id="decision-assistant" aria-controls="decisionAssistant" aria-selected="false" tabindex="-1">设计助手</button></div><div id="decisionCarbon" role="tabpanel" aria-labelledby="decision-carbon"></div><div id="decisionStructure" role="tabpanel" aria-labelledby="decision-structure" hidden></div><div id="decisionAssistant" role="tabpanel" aria-labelledby="decision-assistant" hidden></div>';
 results.append(rail);
 $('decisionStructure').append($('structuralChange'));
 $('decisionAssistant').append($('aiPanel'));
 let activeTab='carbon',editTab='size',previousStep=null;
 const names={carbon:'decisionCarbon',structure:'decisionStructure',assistant:'decisionAssistant'};
 function activate(name,focus=false){activeTab=name;for(const [key,id] of Object.entries(names)){const b=$('decision-'+key);b.setAttribute('aria-selected',String(key===name));b.tabIndex=key===name?0:-1;$(id).hidden=key!==name;}if(focus)$('decision-'+name).focus();}
 for(const name of Object.keys(names))$('decision-'+name).onclick=()=>activate(name);
 rail.querySelector('[role="tablist"]').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const keys=Object.keys(names),index=keys.indexOf(activeTab);activate(keys[event.key==='Home'?0:event.key==='End'?keys.length-1:(index+(event.key==='ArrowRight'?1:keys.length-1))%keys.length],true);});
 // Keep both existing assistant paths reachable, without covering the model with a modal.
 $('openWorkbenchAI').onclick=()=>activate('assistant');
 $('openRuleStatus').onclick=()=>{activate('structure');$('structuralDetails').open=true;};
 document.addEventListener('carbon-ai-applied',()=>activate('carbon'));
 const status=document.createElement('button');status.id='structureStatusLink';status.type='button';status.className='structure-status-link';status.textContent='结构未核验 · 查看';status.onclick=()=>activate('structure');$('decisionCarbon').append(status);
 // API settings and long disclosures are secondary. Do not alter their actual authorization.
 const structuralAI=document.createElement('details');structuralAI.id='structuralAISettings';structuralAI.innerHTML='<summary>AI 连接与授权</summary>';$('structuralChange').append(structuralAI);structuralAI.hidden=true;
 const evidenceIntro=$('structuralBasisIntro');if(evidenceIntro)evidenceIntro.textContent='澳洲规范参考 · 州、建筑类别与适用版本待确认。';
 $('structuralDetails').querySelector('summary').textContent='依据与适用范围';
 // The checklist is the content of the structure tab; citations stay collapsed.
 // Detailed checklist stays under the evidence disclosure.
 $('aiPanel').querySelector('.eyebrow').textContent='针对当前修改';
 $('aiPanel').querySelector('h2').textContent='设计助手';
 $('aiGenerate').textContent='请 AI 分析这次修改';$('aiReconnect').textContent='检查连接';
 const settings=document.createElement('details');settings.id='assistantSettings';settings.innerHTML='<summary>连接与发送设置</summary>';$('aiPanel').querySelector('.flow-actions').after(settings);settings.append(document.querySelector('#aiPanel>.ai-consent'),$('aiReconnect'));
 // Connection feedback and consent must not be hidden prerequisites.
 settings.before($('aiReconnect'),document.querySelector('#assistantSettings>.ai-consent'));settings.hidden=true;
 // Keep automatic analysis visible, beside the result, not inside settings.
 // One editor with two local tabs; choosing a tab never resets the selected element.
 const editorTabs=document.createElement('div');editorTabs.className='editor-tabs';editorTabs.setAttribute('role','tablist');editorTabs.setAttribute('aria-label','修改内容');editorTabs.innerHTML='<button id="editor-size" role="tab" aria-controls="editorSize" aria-selected="true" type="button">尺寸</button><button id="editor-material" role="tab" aria-controls="editorMaterial" aria-selected="false" tabindex="-1" type="button">材料</button>';
 const size=document.createElement('section');size.id='editorSize';size.setAttribute('role','tabpanel');size.setAttribute('aria-labelledby','editor-size');
 const material=document.createElement('section');material.id='editorMaterial';material.setAttribute('role','tabpanel');material.setAttribute('aria-labelledby','editor-material');material.hidden=true;
 const parameter=document.querySelector('.parameter');parameter.before(editorTabs,size,material);size.append(parameter);material.append($('changeMaterialDetails'));$('changeMaterialDetails').open=true;
 const categoryLabel=document.querySelector('label[for="material"]'),recipeLabel=document.querySelector('label[for="changeRecipe"]');recipeLabel.before(categoryLabel,$('material'));categoryLabel.firstChild.textContent='材料类别 ';
 const editorInfo=document.createElement('details');editorInfo.id='editorInfo';editorInfo.innerHTML='<summary>构件资料与计算依据</summary>';document.querySelector('.inspector').append(editorInfo);editorInfo.append(document.querySelector('.change-quantity'),document.querySelector('.calculation-detail'),document.querySelector('.parameter-notes'));
 // Remove the extra green feedback card; its useful quantity feedback stays beside the input.
 const feedback=$('editFeedbackText');feedback.classList.add('editor-feedback');size.append(feedback);
 size.append(status);
 const materialWarning=document.createElement('p');materialWarning.className='material-inline-note';materialWarning.textContent='更换材料后重新计算碳排；结构适用性待核验。';material.append(materialWarning);
 function setEditor(name,focus=false){editTab=name;size.hidden=name!=='size';material.hidden=name!=='material';for(const key of ['size','material']){const b=$('editor-'+key);b.setAttribute('aria-selected',String(key===name));b.tabIndex=key===name?0:-1;}if(focus)$('editor-'+name).focus();}
 $('editor-size').onclick=()=>setEditor('size');$('editor-material').onclick=()=>setEditor('material');editorTabs.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setEditor(e.key==='Home'?'size':e.key==='End'?'material':editTab==='size'?'material':'size',true);}});
 document.querySelector('.change-picker label').textContent='修改哪个构件？';
 $('resetElement').textContent='撤销此构件改动';
 const viewerLabel=viewer.querySelector('.section-label>span');viewerLabel.id='currentModelLabel';
 const changes=document.createElement('details');changes.id='workspaceChanges';changes.innerHTML='<summary id="workspaceChangesTitle">还没有改动</summary><div id="workspaceChangesList"></div>';viewer.after(changes);
 const oldChanges=$('impactAllChanges').parentElement;oldChanges.classList.add('legacy-change-list');
 // Object-first editing: one selection, one inspector, with scope totals kept in view.
 const workspace=document.querySelector('.workspace'),center=document.querySelector('.center-column'),controls=document.querySelector('.controls');
 const navigator=document.createElement('aside');navigator.id='componentNavigator';navigator.className='panel';navigator.hidden=true;
 navigator.innerHTML='<div class="navigator-heading"><h2>构件</h2><span id="navigatorCount"></span></div><label class="sr-only" for="componentSearch">查找构件</label><input id="componentSearch" type="search" placeholder="查找名称、编号或材料"><div id="componentTree" aria-label="分析范围内的构件"></div><p id="navigatorEmpty" hidden>没有匹配的构件</p><div class="navigator-footer"><span id="editedCount">未修改</span><span>● 已修改</span></div>';
 workspace.prepend(navigator);
 const dock=document.createElement('div');dock.id='objectWorkbench';dock.hidden=true;workspace.append(dock);
 const objectHeading=document.createElement('div');objectHeading.id='objectHeading';objectHeading.innerHTML='<span>选中构件</span><h2 id="objectTitle"></h2><div id="objectDelta" role="status"></div>';controls.prepend(objectHeading);
 const scopeSummary=document.createElement('section');scopeSummary.id='scopeImpactSummary';scopeSummary.className='panel';scopeSummary.hidden=true;
 scopeSummary.innerHTML='<div class="scope-summary-heading"><h2>整体碳排变化</h2><span id="scopeCount"></span></div><div class="scope-metrics"><div><span>修改前</span><strong id="scopeBefore"></strong></div><span class="scope-arrow">→</span><div><span>修改后</span><strong id="scopeAfter"></strong></div><div class="scope-difference"><span>累计变化</span><strong id="scopeDifference" role="status"></strong></div></div><div class="scope-summary-footer"><span>kg CO₂e · 材料生产＋处置</span><span id="scopeCoverage"></span></div>';
 center.prepend(scopeSummary);
 const fmt=n=>Number.isFinite(n)?n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
 const signed=n=>(n>0?'+':'')+fmt(n);
 function renderNavigator(s){
  const focused=document.activeElement?.dataset?.componentId,query=$('componentSearch').value.trim().toLowerCase(),fragment=document.createDocumentFragment();let visible=0;
  for(const e of s.candidate||[]){const info=C.materialInfo(e.material),base=s.baseline.find(x=>x.id===e.id),diff=D.differences(base,e),a=C.element(base),b=C.element(e);
   if(query&&![e.name,e.id,info.name].join(' ').toLowerCase().includes(query))continue;visible++;
   const button=document.createElement('button');button.type='button';button.className='component-item';button.dataset.componentId=e.id;button.setAttribute('aria-pressed',String(e.id===s.selected));
   const title=document.createElement('b');title.textContent=e.name+' · '+e.id;const subtitle=document.createElement('span');subtitle.textContent=info.name;
   const delta=document.createElement('small');delta.textContent=diff.length?(!a.error&&!b.error?'● '+signed(b.value-a.value)+' kg CO₂e':'● 待补资料'):'未修改';delta.className=diff.length?'component-edited':'';delta.dataset.trend=!a.error&&!b.error&&b.value>a.value?'up':'down';
   button.append(title,subtitle,delta);button.onclick=()=>{W.select(e.id);$('componentTree').querySelector('[data-component-id="'+e.id+'"]')?.focus({preventScroll:true});};fragment.append(button);
  }
  $('componentTree').replaceChildren(fragment);$('navigatorEmpty').hidden=visible>0;$('navigatorCount').textContent=(s.candidate||[]).length+' 个';
  if(focused)$('componentTree').querySelector('[data-component-id="'+focused+'"]')?.focus({preventScroll:true});
 }
 $('componentSearch').addEventListener('input',()=>renderNavigator(W.state()));
 function objectLayout(s){const editing=s.step===3;navigator.hidden=dock.hidden=scopeSummary.hidden=!editing;
  if(!editing){if(controls.parentElement===dock)center.before(controls);if(results.parentElement===dock)center.after(results);return;}
  dock.prepend(controls);dock.append(results);
  // Both properties are visible; switching component never means switching editing pages.
  editorTabs.hidden=true;size.hidden=false;material.hidden=false;size.removeAttribute('role');material.removeAttribute('role');size.removeAttribute('aria-labelledby');material.removeAttribute('aria-labelledby');
  const e=s.candidate?.find(x=>x.id===s.selected);if(!e)return;
  $('objectTitle').textContent=e.name+' · '+e.id;renderNavigator(s);
  const original=C.element(s.baseline.find(x=>x.id===e.id)),current=C.element(e),delta=current.value-original.value;
  $('objectDelta').textContent=original.error||current.error?'碳排数据待补齐':delta===0?'碳排暂无变化':(delta<0?'↓ 减少 ':'↑ 增加 ')+fmt(Math.abs(delta))+' kg CO₂e';
  $('objectDelta').dataset.trend=original.error||current.error||delta===0?'same':delta<0?'down':'up';
  const comparison=C.compare(s.baseline,s.candidate),changed=s.candidate.filter(x=>D.differences(s.baseline.find(b=>b.id===x.id),x).length).length;
  $('scopeBefore').textContent=fmt(comparison.A.value);$('scopeAfter').textContent=fmt(comparison.B.value);
  $('scopeDifference').textContent=comparison.compatible?signed(comparison.delta):'暂不能比较';
  $('scopeDifference').dataset.trend=comparison.delta<0?'down':comparison.delta>0?'up':'same';
  $('scopeCount').textContent=s.baseline.length+' 个构件';$('editedCount').textContent=changed+' 个已修改';
  $('scopeCoverage').textContent=comparison.compatible?(comparison.partial?`已知部分 ${comparison.known}/${comparison.total} 可比较 · ${changed} 个已修改`:changed+' 个构件已修改'):'两方案可计算范围不一致';
 }
 // Accessible view state lives in the same document. Nothing is duplicated or re-created per render.
 function sync(){const s=W.state();document.body.dataset.productStep=s.step;rail.hidden=s.step!==3;
  objectLayout(s);
  if(s.step!==3)return;
  if(previousStep!==3)activate('carbon');previousStep=s.step;
  results.append(rail);$('decisionCarbon').prepend($('changeImpact'));
  // Whole-scope effect is the primary result; selected-element contribution is second.
  $('impactSelected').before($('impactScope'));
  $('impactHeading').textContent='这个构件的变化';
  $('flowTitle').textContent='寻找减碳方案';$('flowDescription').textContent='';
  document.querySelector('.project-bar .tabs').setAttribute('aria-hidden','true');
  const e=s.candidate?.find(x=>x.id===s.selected),before=s.baseline?.find(x=>x.id===s.selected);if(!e||!before)return;
  viewerLabel.textContent='模型 · '+e.name+' '+e.id;
  const dimension=D.control(e),baseDimension=D.control(before);
  $('dimensionValue').textContent=dimension.kind?'原尺寸 '+Number(baseDimension.value.toFixed(2))+' mm':'暂无可调整尺寸';
  const selectedChanges=D.differences(before,e);feedback.hidden=!selectedChanges.length;
  const changed=s.candidate.filter(x=>D.differences(s.baseline.find(b=>b.id===x.id),x).length);
  $('workspaceChangesTitle').textContent=changed.length?changed.length+' 个构件已修改':'还没有改动';$('flowNext').textContent=changed.length?'查看 '+changed.length+' 项改动 →':'查看对比 →';
  $('workspaceChangesList').replaceChildren(...changed.map(x=>{const b=document.createElement('button');b.type='button';b.className='change-record';b.textContent=x.name+' '+x.id+' · '+D.differences(s.baseline.find(y=>y.id===x.id),x).join('；');b.onclick=()=>W.select(x.id);return b;}));
  const scope=C.compare(s.baseline,s.candidate);$('impactScope').querySelector('h3').textContent='本次分析范围 · '+s.baseline.length+' 个构件';
  $('impactSelected').querySelector('h3').textContent='选中构件 · '+e.name+' '+e.id;
  const report=window.StructuralReviewUI?.exportState().selected,thickness=report?.facts?.thickness;
  status.textContent=thickness?.delta_mm>0?'加厚后需复核自重与受力 · 查看':thickness?.delta_mm<0?'减薄后需复核承载与变形 · 查看':'结构尚未核验 · 查看';status.dataset.changed=String(!!changed.length);
  $('changeRecipe').parentElement.classList.toggle('recipe-unavailable',!['concrete','concrete-cast'].includes(e.material));
  if(!scope.compatible)$('impactHeading').textContent='这个构件的变化';
 }
 document.addEventListener('carbon-structural-feedback',()=>{const review=window.StructuralReviewUI?.exportState();if(review?.busy)status.textContent='AI 正在分析这次修改…';else if(review?.ai_result)status.textContent='AI 已回复本次修改 · 查看';});
 document.addEventListener('carbon-model-render',()=>{if(W.state().step!==3)previousStep=W.state().step;sync();});sync();
})();
