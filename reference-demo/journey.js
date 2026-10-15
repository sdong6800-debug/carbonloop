(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const stages=[
  ['选择范围','选择整个模型、某一楼层或部分构件。'],
  ['核对模型','对着模型确认构件分类和材料；识别错误可以直接修改。'],
  ['碳排结果','查看总量、构件贡献、计算阶段和数据来源。'],
  ['寻找方案','让 AI 和规则工具提出减碳方向，再由你选择要研究的方案。'],
  ['对比确认','比较修改前后碳排，并查看结构风险与仍需核实的信息。'],
  ['导出报告','下载 Excel，保留模型范围、计算依据、改动和待办。']
 ];
 const list=$('journeySteps');
 stages.forEach(([name],index)=>{const item=document.createElement('li');item.dataset.number=String(index+1).padStart(2,'0');item.innerHTML='<span></span>';item.querySelector('span').textContent=name;list.append(item);});
 let exported=false;
 function visible(element){return element&&!element.hidden&&getComputedStyle(element).display!=='none';}
 function current(){
  const entry=$('modelEntry'),app=$('app');
  if(visible(entry))return entry.dataset.phase==='review'?2:1;
  if(visible(app)){
   const step=Number(app.dataset.step||1);
   if(exported)return 6;
   if(step===4)return 5;
   if(step===3||step===2)return 4;
   return 3;
  }
  return 1;
 }
 function sync(){
  const active=current();
  [...list.children].forEach((item,index)=>{const n=index+1;item.dataset.state=n<active?'done':n===active?'current':'next';if(n===active)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
  $('journeyStage').textContent='第 '+active+' 步';$('journeyTitle').textContent=stages[active-1][0];$('journeyDescription').textContent=stages[active-1][1];
 }
 function markExported(){
  exported=true;
  if(Number($('app')?.dataset.step)===4){$('flowTitle').textContent='报告已导出';$('flowDescription').textContent='Excel 已保存；包含模型范围、计算依据、改动和仍需核实的事项。';$('flowNext').textContent='再次下载 Excel ↓';}
  requestAnimationFrame(sync);
 }
 const observer=new MutationObserver(sync);
 for(const target of [$('start'),$('modelEntry'),$('app')])if(target)observer.observe(target,{attributes:true,attributeFilter:['hidden','data-phase','data-step']});
 document.addEventListener('carbon-model-render',()=>{exported=false;sync();});
 $('export')?.addEventListener('click',markExported);
 $('flowNext')?.addEventListener('click',()=>{if(Number($('app')?.dataset.step)===4)markExported();},{capture:true});
 sync();
 window.CarbonJourney={sync,current:()=>current()};
})();
