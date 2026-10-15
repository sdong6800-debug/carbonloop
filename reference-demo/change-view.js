(function(){
 'use strict';const W=window.CarbonWorkspace,C=window.ModelCore,D=window.CarbonChange,$=id=>document.getElementById(id);
 const fmt=(n,d=2)=>n==null?'—':n.toLocaleString('zh-CN',{maximumFractionDigits:d}),signed=n=>(n>0?'+':'')+fmt(n);
 // Keep the primary edit and live consequence together; detailed calculation remains expandable.
 const picker=document.createElement('div');picker.className='change-picker';picker.innerHTML='<label for="changeElement">1 · 选择要修改的构件</label><select id="changeElement"></select><p id="changeAvailability" class="help"></p>';
 document.querySelector('.inspector').prepend(picker);
 const controls=document.createElement('div');controls.className='change-exact';controls.innerHTML='<label for="dimensionInput">修改后 · mm</label><input id="dimensionInput" type="number"><button id="resetElement" class="outline">恢复此构件</button><p id="changeInputError" role="status"></p>';
 $('dimension').after(controls);
 const materialLabel=document.querySelector('label[for="material"]'),materialHelp=$('material').nextElementSibling;
 const materialDetails=document.createElement('details');materialDetails.id='changeMaterialDetails';materialDetails.innerHTML='<summary>材料配方与类别（可选）</summary><label for="changeRecipe">混凝土配方参考</label><select id="changeRecipe"><option value="">沿用通用参考</option><option value="01.002.13">Q-A230 配方 · 瑞士参考，待验证</option></select><p class="help">切换配方会更换对应密度与碳因子，尺寸保持不变；不代表性能等效或当地可供应。</p>';
 materialLabel.before(materialDetails);materialDetails.append(materialLabel,$('material'),materialHelp);
 const quantityDetails=document.createElement('details');quantityDetails.className='change-quantity';quantityDetails.innerHTML='<summary>查看原模型属性与材料数量</summary>';$('geometry').before(quantityDetails);quantityDetails.append($('geometry'));
 const impact=document.createElement('section');impact.id='changeImpact';impact.className='change-impact';impact.innerHTML='<p class="eyebrow">2 · 修改后即时更新</p><h2 id="impactHeading">排放变化</h2><p id="impactChange" aria-live="polite"></p><div id="impactSelected"></div><div id="impactScope"></div><p id="impactExplanation"></p><p id="impactBoundary" class="help"></p><div class="impact-warning"><b>碳排能算，不代表结构能用</b><p>尚未运行承载力、变形或规范核验；当前输入范围仅用于演示。</p></div><details><summary>这次还有哪些改动？</summary><ul id="impactAllChanges"></ul></details>';
 const results=document.querySelector('.results');results.prepend(impact);
 const ai=document.getElementById('aiPanel');if(ai){const details=document.createElement('details');details.className='change-ai';details.innerHTML='<summary>换材料配方 · 打开建议助手（可选）</summary>';ai.before(details);details.append(ai);}
 const tableDetails=document.createElement('details');tableDetails.className='change-table';tableDetails.innerHTML='<summary>展开完整数值与改动记录</summary>';$('comparisonBody').before(tableDetails);tableDetails.append($('comparisonBody'));
 // Progressive disclosure: keep decisions visible, move explanatory prose behind one explicit entry.
 function fold(node,title,className){const d=document.createElement('details');d.className=className;const s=document.createElement('summary');s.textContent=title;node.before(d);d.append(s,node);return d;}
 const why=document.createElement('details');why.className='impact-basis';why.innerHTML='<summary>查看计算依据</summary>';impact.append(why);why.append($('impactExplanation'),$('impactBoundary'));
 const warning=impact.querySelector('.impact-warning');warning.replaceChildren();const status=document.createElement('span');status.textContent='结构待核验';warning.append(status);const statusDetails=document.createElement('p');statusDetails.textContent='尚未进行结构安全与规范核验；尺寸输入范围仅用于演示，不能视为允许的设计范围。';why.append(statusDetails);
 const parameterNotes=document.createElement('details');parameterNotes.className='parameter-notes';parameterNotes.innerHTML='<summary>调整说明</summary>';document.querySelector('.parameter').append(parameterNotes);parameterNotes.append($('changeAvailability'),$('editHint'));
 const reviewFold=fold($('candidateReview'),'结构待核验 · 查看待办','review-disclosure');
 const stageFold=fold(document.querySelector('.report-stages'),'查看生命周期各阶段','report-disclosure stage-disclosure');
 const componentFold=fold(document.querySelector('.report-components'),'查看构件明细与数据来源','report-disclosure component-disclosure');
 const exploreNotes=document.createElement('details');exploreNotes.className='explore-notes';exploreNotes.innerHTML='<summary>查看试算范围与限制</summary>';$('copy').before(exploreNotes);exploreNotes.append(...document.querySelectorAll('#explore>.help,#explore>.inherited-note'));
 document.querySelector('#explore>h2').textContent='你想改什么？';
 document.querySelector('#explore>h3').textContent='改尺寸';
 document.querySelector('.change-ai>summary').textContent='换材料 · 建议助手';
 document.querySelector('.change-quantity>summary').textContent='构件资料';
 materialDetails.querySelector('summary').textContent='更换材料';
 document.querySelector('.calculation-detail>summary').textContent='计算公式';
 tableDetails.querySelector('summary').textContent='查看完整对比';
 document.querySelector('#comparison>.panelhead').hidden=true;
 tableDetails.append(document.querySelector('.comparison-note'));
 document.querySelector('.report-next h3').textContent='想进一步降低碳排？';
 document.querySelectorAll('.report-next p').forEach(p=>p.hidden=true);
 document.querySelector('.report-components h3').textContent='构件明细';
 document.querySelector('.report-stages h3').textContent='生命周期阶段';
 const baselineStatus=document.createElement('p');baselineStatus.className='baseline-status';baselineStatus.textContent='结构待核验';document.querySelector('.total-result').after(baselineStatus);
 const resultNotes=document.createElement('details');resultNotes.className='result-notes';resultNotes.innerHTML='<summary>查看计算范围与缺项</summary>';results.append(resultNotes);resultNotes.append(results.querySelector('.coverage'),results.querySelector('.warning'));
 const foot=document.querySelector('footer>span:last-child');foot.firstChild.textContent='演示版 ';document.querySelector('.page-heading>.status').textContent='演示模型 · 未连接 Rhino';
 function chart(id,title,before,after,canCompare,caption){const box=$(id);box.replaceChildren();const h=document.createElement('h3');h.textContent=title;box.append(h);const max=Math.max(before||0,after||0,1);
  [['修改前',before,'before'],['修改后',after,'after']].forEach(([label,value,kind])=>{const row=document.createElement('div');row.className='impact-bar-row';const name=document.createElement('span'),track=document.createElement('div'),fill=document.createElement('i'),number=document.createElement('b');name.textContent=label;track.className='impact-bar-track';fill.className=kind;fill.style.width=value==null?'0%':Math.max(0,value)/max*100+'%';number.textContent=fmt(value)+' kg CO₂e';track.append(fill);row.append(name,track,number);box.append(row);});
  const delta=document.createElement('p');delta.className='impact-delta';if(canCompare&&before!==null&&after!==null){const diff=after-before;delta.dataset.trend=diff>1e-7?'up':diff<-1e-7?'down':'same';delta.textContent=Math.abs(diff)<1e-7?'未变化':`${diff>0?'↑ 增加':'↓ 减少'} ${fmt(Math.abs(diff))} kg CO₂e${before?`（${signed(diff/before*100)}%）`:''}`;}else{delta.textContent='资料不齐，暂不能比较';delta.dataset.trend='unknown';}box.append(delta);const p=document.createElement('p');p.className='help';p.textContent=caption;if(caption)box.append(p);
 }
 function sync(){const state=W.state();if(!state.baseline)return;const list=state.active==='A'?state.baseline:state.candidate,e=list?.find(x=>x.id===state.selected);if(!e)return;const base=state.baseline.find(x=>x.id===e.id),c=D.control(e);
  const guide={2:['寻找减碳方案','从当前模型出发寻找一个可比较的改进方向。'],3:['寻找减碳方案','修改构件或材料，碳排与结构提示同步更新。'],4:['对比并保留方案','确认变化、风险和待办，再导出报告。']}[state.step];if(guide){$('flowTitle').textContent=guide[0];$('flowDescription').textContent=guide[1];}
  if(state.step===3)$('flowNext').textContent='对比并保留 →';if(state.step===4)$('flowNext').textContent='下载 Excel 报告 ↓';
  const options=list.map(x=>{const ctl=D.control(x);return [x.id,`${x.floor||''} ${x.name} ${x.id} · ${ctl.kind?ctl.label:'尺寸暂不可调'}`];});$('changeElement').replaceChildren(...options.map(([value,text])=>{const opt=document.createElement('option');opt.value=value;opt.textContent=text;return opt;}));$('changeElement').value=e.id;
  $('changeAvailability').textContent=c.reason;$('dimensionInput').disabled=state.active!=='B'||!c.kind;for(const k of ['min','max','step'])$('dimensionInput')[k]=c[k]||'';$('dimensionInput').value=c.kind?Number(c.value.toFixed(3)):'';$('resetElement').disabled=state.active!=='B'||!D.differences(base,e).length;
  $('changeRecipe').disabled=state.active!=='B'||!['concrete','concrete-cast'].includes(e.material);$('changeRecipe').value=e.factorId||'';
  reviewFold.hidden=state.step!==4;
  parameterNotes.open=!c.kind;
  const baseResult=C.calculate(state.baseline);$('reportState').textContent=baseResult.complete?'材料生产＋处置 · 所选 '+state.baseline.length+' 个构件':`当前仅计算 ${baseResult.known} / ${baseResult.total} 个构件，不是整个模型总排放。`;
  results.querySelector('.total-result>span').textContent=baseResult.complete?'所选范围小计':'已确认构件小计';
  results.querySelector('.total-result small').textContent='kg CO₂e · 生产＋处置';
  impact.hidden=state.step!==3&&state.step!==4;if(state.step===4)$('comparison').prepend(impact);else results.prepend(impact);
  $('resultModelDetails').hidden=true;
  if(!state.candidate)return;const changed=state.candidate.flatMap(x=>D.differences(state.baseline.find(y=>y.id===x.id),x).map(t=>`${x.name} ${x.id}：${t}`));
  $('impactAllChanges').replaceChildren(...(changed.length?changed:['还没有修改任何参数']).map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
  const selectedCandidate=state.candidate.find(x=>x.id===e.id),old=C.element(base),next=C.element(selectedCandidate),diffs=D.differences(base,selectedCandidate),all=C.compare(state.baseline,state.candidate);
  $('impactHeading').textContent=state.step===4?'改动结果':'碳排变化';$('impactChange').textContent=diffs.length?`${e.name} ${e.id}：${diffs.join('；')}`:`${e.name} ${e.id} · 尚未修改`;
  chart('impactSelected',`${e.name} · ${e.id}`,old.value,next.value,!old.error&&!next.error,'');
  chart('impactScope',`所选 ${state.baseline.length} 个构件合计`,all.A.value,all.B.value,all.compatible,all.compatible?'生产＋处置':`可计算：修改前 ${all.A.known}/${all.A.total}，修改后 ${all.B.known}/${all.B.total}`);
  $('impactBoundary').textContent='比较范围：材料生产＋处置；未建模钢筋及其他生命周期阶段不在本次小计内。';
  const sameFactor=old.factor?.id===next.factor?.id;
  $('impactExplanation').textContent=old.error||next.error?'当前构件资料有缺项，先核对材料和净量，再比较。':!diffs.length?'拖动左侧参数，或展开材料选项；这里立即显示变化。':sameFactor?`材料因子未变；该构件用量由 ${fmt(old.volume,4)} 变为 ${fmt(next.volume,4)} m³，所以排放随用量变化。其他改动见下方清单。`:'材料配方或类别已改变；使用对应密度与因子重新计算，不能仅凭碳更低判断材料可以替代。';
 }
 $('changeElement').addEventListener('change',()=>{W.select($('changeElement').value);$('changeInputError').textContent='';});
 $('dimensionInput').addEventListener('change',()=>{try{W.resize(Number($('dimensionInput').value));$('changeInputError').textContent='';}catch(e){$('changeInputError').textContent=e.message;sync();}});
 $('resetElement').addEventListener('click',()=>{W.resetSelected();$('changeInputError').textContent='';});
 $('changeRecipe').addEventListener('change',()=>W.recipe($('changeRecipe').value));
 document.addEventListener('carbon-model-render',sync);sync();
})();
