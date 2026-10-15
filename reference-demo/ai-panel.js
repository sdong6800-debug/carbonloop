(function(){
 'use strict';
 const C=window.ModelCore,AI=window.CarbonAI,W=window.CarbonWorkspace,$=id=>document.getElementById(id);
 const local=['127.0.0.1','localhost'].includes(location.hostname),base=local?'http://127.0.0.1:8514':'';
 let configured=false,pending=null,busy=false,lastSignature='',controller=null,lastSelected='',attachment=null,imageRevision=0,imageLoading=false,vision=false;
 const panel=document.createElement('section');panel.className='ai-panel';panel.id='aiPanel';
 panel.innerHTML='<div class="panelhead"><div><p class="eyebrow">辅助研究 / 保持几何不变</p><h2>AI 材料建议</h2></div><span id="aiStatus" class="mini-tag">正在检查本地后台</span></div><p>研究混凝土配方替换，尺寸和位置不变。</p><label for="aiRequest">你希望保持什么、研究什么？</label><textarea id="aiRequest" rows="2" maxlength="1000">保持尺寸、柱位和结构体系不变，研究混凝土材料配方的减排可能。</textarea><p id="aiScope" class="help"></p><label class="ai-consent"><input id="aiConsent" type="checkbox">同意把本次精简构件数据和上方要求发送给已配置的大模型服务商；不发送模型文件、截图或 API 密钥。</label><div class="flow-actions"><button id="aiGenerate" disabled>查依据并生成 AI 建议</button><button id="aiReconnect" class="outline">检查 AI 连接</button></div><p id="aiNotice" role="status"></p><details class="ai-offline"><summary>规则试算（非 AI）</summary><p class="help">只按固定规则选择一个混凝土构件与固定配方；不会理解上方自由输入，也不会冒充 AI 回答。</p><button id="aiOffline" class="outline">运行规则试算（非 AI）</button></details><div id="aiSuggestion" hidden><span id="aiMode" class="mini-tag"></span><h3 id="aiTitle"></h3><p id="aiReason"></p><p class="warning" id="aiLimit"></p><div id="aiNumbers" class="ai-numbers"></div><details><summary>本次检索到的依据</summary><div id="aiEvidence"></div></details><p class="help">采用的候选：KBOB 01.002.13，瑞士 Q-A230 混凝土配方参考。不是与现有材料性能等效的证明。</p><label class="ai-consent"><input id="aiAccept" type="checkbox">我知道这只是材料数据替换的假设，尚未核实性能、供应和结构适用性。</label><button id="aiApply" disabled>应用材料建议</button></div><hr></section>';
 $('explore').prepend(panel);
 const modeUI=document.createElement('label');modeUI.className='ai-mode';modeUI.innerHTML='我想了解<select id="aiTask"><option value="change">这次尺寸或材料修改的影响</option><option value="material">其他：比较混凝土配方</option></select>';panel.querySelector('.panelhead').after(modeUI);
 const intro=panel.querySelector(':scope > p');intro.id='aiTaskIntro';
 const changeAnswer=document.createElement('div');changeAnswer.id='aiChangeAnswer';changeAnswer.hidden=true;changeAnswer.innerHTML='<b>AI 对本次修改的建议 · 未验算</b><p id="aiChangeReason"></p><b>下一步</b><p id="aiChangeNext"></p>';panel.append(changeAnswer);
 const changeFacts=document.createElement('div');changeFacts.id='aiChangeFacts';changeFacts.className='change-facts';$('aiScope').after(changeFacts);
 const materialQuery=$('aiRequest').value;
 const changeQuery='我这样修改有什么影响？现在能判断是否可用吗？下一步需要检查什么？';
 $('aiRequest').value=changeQuery;
 const questionLabel=panel.querySelector('label[for="aiRequest"]');
 intro.after($('aiScope'),changeFacts,changeAnswer);
 const changeMode=()=>$('aiTask').value==='change';
 const attachmentUI=document.createElement('div');attachmentUI.className='ai-attachment';attachmentUI.innerHTML='<label for="aiImage">附加模型截图（可选 · PNG/JPEG，最多 2 MB）</label><input id="aiImage" type="file" accept="image/png,image/jpeg"><div id="aiImagePreview" hidden><img id="aiImageThumb" alt="本次附加截图的本地预览"><button id="aiImageRemove" type="button" class="outline">移除截图</button></div><p id="aiImageStatus" role="status">无需截图也能读取当前选中的模型构件。</p>';$('aiRequest').after(attachmentUI);
 const imageDetails=document.createElement('details');imageDetails.id='aiImageDetails';imageDetails.innerHTML='<summary>附加截图（可选）</summary>';attachmentUI.before(imageDetails);imageDetails.append(attachmentUI);
 $('aiConsent').parentElement.lastChild.textContent='同意把本次构件数据、文字要求和我附加的截图发送给所配置的大模型服务商；不上传完整模型文件。';
 function invalidate(){pending=null;$('aiSuggestion').hidden=true;controller?.abort();}
 function clearImage(){imageRevision++;attachment=null;imageLoading=false;$('aiImage').value='';$('aiImageThumb').removeAttribute('src');$('aiImagePreview').hidden=true;$('aiImageStatus').textContent='未附加截图。';invalidate();sync();}
 $('aiImageRemove').onclick=clearImage;
 $('aiImage').onchange=async()=>{const file=$('aiImage').files[0];clearImage();if(!file)return;const revision=imageRevision;
  if(!['image/png','image/jpeg'].includes(file.type)||file.size>2*1024*1024){$('aiImageStatus').textContent='请选择不超过 2 MB 的 PNG 或 JPEG 图片。';return;}
  imageLoading=true;$('aiImageStatus').textContent='正在读取本地截图…';sync();
  try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(file);});if(revision!==imageRevision)return;
   const bitmap=await createImageBitmap(file);const oversized=bitmap.width*bitmap.height>20000000;bitmap.close();if(oversized)throw Error('图片像素过大，请缩小截图。');if(revision!==imageRevision)return;
   attachment=data;$('aiImageThumb').src=data;$('aiImagePreview').hidden=false;$('aiConsent').checked=false;$('aiImageStatus').textContent='截图已在本地准备好，尚未发送。请确认画面没有密钥或敏感资料。';
  }catch(e){if(revision===imageRevision)$('aiImageStatus').textContent=e.message;}finally{if(revision===imageRevision){imageLoading=false;sync();}}
 };
 const fmt=n=>n===null?'—':n.toLocaleString('zh-CN',{maximumFractionDigits:2});
 const model=()=>W.researchModel?W.researchModel():W.baseline();
 const signature=()=>JSON.stringify(model());
 function sync(){const elements=model()||[],sig=signature(),selected=W.state().selected;if(sig!==lastSignature||selected!==lastSelected){lastSignature=sig;lastSelected=selected;invalidate();}
  const e=elements.find(x=>x.id===selected),review=window.StructuralReviewUI?.exportState(),n=AI.eligible(elements).filter(x=>x.id===selected).length,isChange=changeMode(),supported=isChange?review?.selected?.scope_supported:!!n;
  $('aiScope').textContent=isChange?(review?.selected?window.StructuralReviewUI.summary(review.selected):'请先选择一个构件。'):(e?'比较 '+e.id+' 的混凝土配方，保持当前尺寸不变。':'请先选择一个构件。');
  questionLabel.textContent=isChange?'你想问什么？':'你希望比较什么配方？';
  if(isChange&&review?.ai_result)$('aiStatus').textContent=review.ai_result.provider+' · 已回复';
  $('aiTaskIntro').textContent=isChange?'AI 根据当前选中的构件和修改前后数据回答。':'比较另一种混凝土配方的碳数据，不是厚度调整建议。';
  panel.querySelector('.eyebrow').textContent=isChange?'针对当前修改':'可选 · 混凝土配方比较';
  $('aiGenerate').textContent=isChange?'请 AI 分析这次修改':'比较混凝土配方';
  $('aiChangeFacts').hidden=!isChange;
  if(isChange&&review?.selected)$('aiChangeFacts').replaceChildren(...window.StructuralReviewUI.factLines(review.selected).map(t=>{const p=document.createElement('p');p.textContent=t;return p;}));
  panel.querySelector('.ai-offline').hidden=isChange;
  if(isChange){$('aiSuggestion').hidden=true;$('aiNotice').textContent=review?.message||'正在读取本次修改…';}
  const result=isChange?review?.ai_result:null;$('aiChangeAnswer').hidden=!result;
  if(result){$('aiChangeReason').textContent=result.answer.reason;$('aiChangeNext').textContent=result.answer.nextStep;}
  $('aiGenerate').disabled=busy||review?.busy||imageLoading||!(isChange?review?.configured:configured)||!$('aiConsent').checked||!supported||!!(attachment&&!vision);$('aiOffline').disabled=busy||!n;$('aiApply').disabled=!pending||!$('aiAccept').checked||pending.signature!==sig||pending.answer.status!=='suggestion';
  if(attachment&&configured&&!vision)$('aiImageStatus').textContent='当前模型不支持本页图片输入，请在连接窗口选择 deepseek-flash 或移除截图。';
 }
 async function health(){if($('aiReconnect').disabled)return;configured=false;$('aiReconnect').disabled=true;$('aiReconnect').textContent='正在检查…';$('aiStatus').textContent='正在检查本地连接…';$('aiNotice').textContent='正在联系电脑上的 AI 服务（最多等待 4 秒）。';sync();
  try{if(!local)throw Error('公网版 AI 后台尚未部署；请勿在页面填写密钥。');const res=await fetch(base+'/health',{signal:AbortSignal.timeout(4000),cache:'no-store'});if(!res.ok)throw Error('后台状态检查失败');const s=await res.json();configured=s.configured===true;vision=s.provider==='DeepSeek'&&s.model==='deepseek-flash';$('aiStatus').textContent=configured?s.provider+(s.networkVerified?' · 已验证调用':' 已配置 · 待实测'):'AI 未连接 · 缺 API 配置';$('aiNotice').textContent=configured?'本地连接正常。勾选发送授权后可生成建议；只有生成才会调用模型并产生用量。':'本地服务已启动，但还没有密钥。请在“CarbonLoop · 连接 DeepSeek”窗口中输入密钥并启用连接。';}
  catch(e){configured=false;vision=false;$('aiStatus').textContent='连接失败 · 本地服务未启动';$('aiNotice').textContent=local?'未连接到本地服务。请打开“CarbonLoop · 连接 DeepSeek”小窗口，输入密钥并点击“启用本地 AI 连接”，保持窗口打开后再重试。':e.message;}
  finally{$('aiReconnect').disabled=false;$('aiReconnect').textContent='重新检查连接';sync();}
 }
 function show(data,sig){if(sig!==signature())throw Error('模型已改变，请重新生成。');const elements=model();AI.validate(data.answer,elements,AI.retrieve(elements,$('aiRequest').value));pending={...data,signature:sig};$('aiAccept').checked=false;$('aiSuggestion').hidden=false;$('aiMode').textContent=data.mode==='live_ai'?`AI 建议 · ${data.provider} / ${data.model}`:'固定规则试算 · 非 AI';$('aiTitle').textContent=data.answer.status==='suggestion'?`研究 ${data.answer.elementId} 的混凝土配方替换`:'当前资料不足或要求超出本轮范围';$('aiReason').textContent=data.answer.reason;$('aiLimit').textContent='待验证：'+data.answer.limitations;$('aiEvidence').replaceChildren();
  for(const id of data.answer.evidenceIds){const source=AI.documents.find(d=>d.id===id),p=document.createElement('p'),b=document.createElement('b');b.textContent=source.title+'（'+source.kind+'）';p.append(b,document.createElement('br'),document.createTextNode(source.text));if(source.url){const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener';a.textContent=' 查看官方来源';p.append(a);}$('aiEvidence').append(p);}
  $('aiNumbers').replaceChildren();if(data.answer.status==='suggestion'){const calc=AI.apply(elements,data.answer);for(const [label,val] of [['该构件当前',calc.selectedBefore.value],['该构件替换后',calc.selectedAfter.value],['所选范围当前小计',calc.comparison.A.value],['所选范围候选小计',calc.comparison.B.value],['完整范围差值（候选−当前）',calc.comparison.delta]]){const p=document.createElement('p');p.textContent=label+'：'+fmt(val)+' kg CO₂e';$('aiNumbers').append(p);}const note=document.createElement('p');note.className='help';note.textContent='以上由计算程序复算，不采用模型提供的数字。仅生产＋处置；缺项时不输出完整范围差值。';$('aiNumbers').append(note);}sync();}
 $('aiGenerate').addEventListener('click',async()=>{if($('aiGenerate').disabled)return;if(changeMode()){await window.StructuralReviewUI.ask({query:$('aiRequest').value,image:attachment,consent:$('aiConsent').checked});sync();return;}busy=true;pending=null;$('aiSuggestion').hidden=true;sync();$('aiNotice').textContent='检索相关资料并请求模型，请稍候；尚未更改方案。';const sig=signature(),selectedElementId=W.state().selected,revision=imageRevision;controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),55000);try{const elements=model().map(e=>Object.fromEntries(['id','type','material','x','y','z','l','w','h','factorId','quantity'].filter(k=>e[k]!==undefined).map(k=>[k,e[k]])));const res=await fetch(base+'/suggest',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','X-CarbonLoop':'1'},body:JSON.stringify({query:$('aiRequest').value,elements,selectedElementId,...(attachment?{image:attachment}:{})})});const data=await res.json();if(!res.ok)throw Error(data.error||'模型调用失败');if(data.mode!=='live_ai')throw Error('返回来源无效');if(revision!==imageRevision||selectedElementId!==W.state().selected)throw Error('所选构件或截图已改变，请重新生成。');show(data,sig);$('aiStatus').textContent=data.provider+' · 已验证调用';$('aiNotice').textContent='已取得真实模型回复并复算；请核对建议，修改尚未应用。';}catch(e){$('aiNotice').textContent=e.name==='AbortError'?'请求取消或超时，未建立方案。':e.message;}finally{clearTimeout(timer);controller=null;busy=false;sync();}});
 $('aiOffline').addEventListener('click',()=>{try{const answer=AI.offline(model().filter(e=>e.id===W.state().selected));if(!answer)return;show({mode:'rule_trial',answer,generatedAt:new Date().toISOString()},signature());$('aiNotice').textContent='当前结果来自固定规则，没有调用 AI，也没有解析你输入的自然语言要求。';}catch(e){$('aiNotice').textContent=e.message;}});
 $('aiApply').addEventListener('click',()=>{try{if($('aiApply').disabled)return;(W.hasCandidate()?W.applySuggestion:W.createCandidate)(pending.answer,{mode:pending.mode,provider:pending.provider||null,model:pending.model||null,answer:pending.answer,evidence:AI.retrieve(model()),generatedAt:pending.generatedAt,confirmedAt:new Date().toISOString()},pending.signature);$('aiNotice').textContent='已应用到当前改进方案。';document.dispatchEvent(new Event('carbon-ai-applied'));}catch(e){$('aiNotice').textContent=e.message;}sync();});
 $('aiConsent').addEventListener('change',sync);$('aiAccept').addEventListener('change',sync);$('aiReconnect').addEventListener('click',()=>{health();window.StructuralReviewUI?.health();});
 $('aiRequest').addEventListener('input',()=>{pending=null;$('aiSuggestion').hidden=true;controller?.abort();sync();});
 $('aiTask').onchange=()=>{invalidate();$('aiRequest').value=changeMode()?changeQuery:materialQuery;if(!changeMode())$('aiNotice').textContent=configured?'已连接。可选择比较另一种混凝土配方。':'未连接到本地服务，请启用本地 AI 连接后检查。';sync();};
 document.addEventListener('carbon-structural-feedback',sync);
 document.addEventListener('carbon-model-render',sync);sync();health();
})();
