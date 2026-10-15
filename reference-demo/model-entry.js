(function(){
 'use strict';
 const $=id=>document.getElementById(id),C=window.ModelCore,M=window.MaterialIntake,R=window.RhinoContract,NS='http://www.w3.org/2000/svg';
 const PREVIEW_LIMIT=180,TABLE_LIMIT=60;
 const types={slab:'楼板',finish:'楼地面饰面',beam:'梁',column:'柱',wall:'墙',foundation:'基础',roof:'屋面',glazing:'玻璃/幕墙',mullion:'幕墙框',door:'门',stair:'楼梯',other:'其他',unknown:'未识别'};
 let source=M.sample(),intakeStatus=M.contractStatus?.(),sourceMode='demo';const remembered=new Map();
 let rows=[],scope='floor',floor='1F',chosen=new Set(),selected='S01',group='all',scanned=false,readOnly=false,onDone,onCancel;
 const eligibleSource=()=>source.filter(e=>e.analysisEligible!==false);
 const excludedSource=()=>source.filter(e=>e.analysisEligible===false);
 const scopeRows=()=>eligibleSource().filter(e=>scope==='all'||(scope==='floor'?e.floor===floor:chosen.has(e.id)));
 const scopeName=()=>sourceMode==='rhino'&&scope==='all'&&intakeStatus?.metadata?.selectionMode==='selection'?'Rhino 中选中的构件':scope==='all'?'整个模型':scope==='floor'?`${floor} 楼层`:'选中的构件';
 const box=$('modelEntry');
 box.innerHTML=`<div class="entry-heading"><div><p class="eyebrow">MODEL INTAKE / 接入与核对</p><h2 id="entryTitle" tabindex="-1">先选择要分析的模型</h2><p>不用重新输入尺寸；先读取，再核对构件与材料。</p></div><span class="entry-badge">Rhino 接入协议原型 · 插件未连接</span></div>
 <div class="entry-steps" aria-label="接入步骤"><span id="entryPhase1" class="current">01 选择范围</span><span id="entryPhase2">02 核对识别结果</span><span id="entryPhase3">03 进入碳分析</span></div>
 <p id="entryReadonly" class="entry-readonly" hidden>候选方案已建立。这里仅查看此前的接入记录，不修改原方案，避免影响已有对比。</p>
 <div class="entry-layout"><section class="entry-preview panel"><div class="panelhead"><h3 id="entryPreviewTitle">模型预览</h3><span class="mini-tag">示例几何 · m</span></div><svg id="entryModel" viewBox="0 0 700 440" role="img" aria-label="示例楼板与四根柱，可点击定位"></svg><div class="entry-legend"><span>已确认</span><span>待核对</span><span>当前选中</span></div><p id="entryModelHint" class="entry-note"></p></section>
 <section class="entry-side panel"><div id="entrySetup"><h3>这次读取哪些构件？</h3><div class="entry-scope"><label><input type="radio" name="entryScope" value="all" checked>整个示例模型 · 5 个构件</label><label><input type="radio" name="entryScope" value="selection">选中部分 · 在下方勾选示例构件</label></div><div id="entrySelections" class="entry-selections" hidden></div><p class="help">真实插件将读取 Rhino 中的对象与选择范围；当前按钮只读取本页内置样例，不上传文件。</p><button id="entryRead">读取并识别（示例） →</button><p id="entryReadHint" class="help">尺寸和位置来自样例；分类、材料建议为预设演示，不是 AI 推断。</p></div>
 <div id="entryReview" hidden><h3>对照模型，核对识别结果</h3><p id="entrySummary" class="help" aria-live="polite"></p><div id="entryGroups" class="entry-groups" aria-label="按构件类型筛选"></div><div id="entryRows" class="entry-rows" aria-label="待核对构件"></div><div id="entryDetail" class="entry-detail" hidden><h3 id="entryObjectTitle"></h3><dl id="entryGeometry"></dl><label for="entryType"><span class="entry-field-title">构件类型 <span id="entryTypeState"></span></span></label><select id="entryType"><option value="slab">楼板</option><option value="beam">梁</option><option value="column">柱</option><option value="other">其他</option><option value="unknown">未识别 / 暂不确定</option></select><p id="entryTypeBasis" class="help"></p><label for="entryMaterial"><span class="entry-field-title">碳计算材料 <span id="entryMaterialState"></span></span></label><select id="entryMaterial"><option value="concrete">建筑混凝土 · KBOB 通用参考</option><option value="unknown">未确定 / 不是此材料（暂不计入）</option></select><p id="entryMaterialBasis" class="help"></p><p class="help">只提供已验证的计算条目；其他材料先保留待匹配，不按外观猜强度、配筋或碳因子。</p><button id="entryConfirmOne" class="outline">确认当前构件</button></div><button id="entryConfirmGroup" class="outline">确认当前组的建议</button><p class="help" id="entryConfirmHelp">确认分类与碳材料映射，不代表结构安全或材料性能已核实。</p></div></section></div>
 <p id="entryNotice" role="status"></p><section class="entry-footer panel"><div><p id="entryProgress" aria-live="polite">先选择范围，然后读取示例。</p><label id="entryPartialWrap" class="entry-partial" hidden><input type="checkbox" id="entryPartial">我知道还有未确认构件，仅查看已确认部分的小计。</label></div><div class="entry-actions"><button id="entryCancel" class="outline">返回</button><button id="entryBack" class="outline" hidden>重选范围</button><button id="entryContinue" hidden disabled>确认并进入碳分析 →</button></div></section>`;
 // Keep intake in the same three-column workbench as model analysis.
 const layout=box.querySelector('.entry-layout'),side=box.querySelector('.entry-side'),preview=box.querySelector('.entry-preview');
 const inspector=document.createElement('section');inspector.className='entry-inspector panel';
 inspector.innerHTML='<div id="entryEmpty"><p class="eyebrow">信息核对</p><h3>读取后，在这里检查</h3><p>模型里的尺寸、位置和体积会直接带入，不需要重新填写。</p><ol><li><b>几何信息</b><span>尺寸、位置、体积与单位</span></li><li><b>构件分类</b><span>哪些是梁、板、柱</span></li><li><b>材料匹配</b><span>检查名称是否对应正确材料</span></li></ol><p class="help">没有读取到的信息保留“待确认”，不会猜成已知值。当前分类和材料均为示例预设，不是 AI 识别。</p></div>';
 inspector.append($('entryDetail'));layout.replaceChildren(side,preview,inspector);
 $('entrySetup').insertAdjacentHTML('afterbegin','<div class="entry-connection"><span>模型来源</span><strong>Rhino 数据协议 · 演示输入</strong><p>当前示例已经通过与未来 Rhino 插件相同的数据合同转换和校验；真实插件尚未连接，也不会读取你电脑里的模型。</p></div>');
 $('entryRead').textContent='载入示例模型 →';
 $('entryPreviewTitle').textContent='当前范围预览';
 $('entryReadHint').textContent='一块楼板＋四根柱。载入后，点模型或名称核对信息。';
 $('entrySetup').querySelector('h3').textContent='选择分析范围';
 $('entrySetup').querySelector('p.help').hidden=true;
 $('entryReview').querySelector('h3').textContent='逐个核对构件材料';
 $('entryCancel').textContent='返回入口';
 const rangePanel=document.createElement('details');rangePanel.id='entryRangePanel';rangePanel.className='entry-range-panel';rangePanel.open=true;rangePanel.innerHTML='<summary id="entryRangeSummary">分析范围</summary>';
 $('entrySetup').before(rangePanel);rangePanel.append($('entrySetup'));
 preview.querySelector('.panelhead').insertAdjacentHTML('afterend','<p id="entrySelectedLabel" class="entry-selected-label" aria-live="polite">选择范围后，点构件即可核对</p>');
 const detailGeometry=document.createElement('details');detailGeometry.className='entry-geometry-detail';detailGeometry.innerHTML='<summary>查看尺寸、位置与来源</summary>';
 $('entryGeometry').before(detailGeometry);detailGeometry.append($('entryGeometry'));
 box.querySelector('.entry-heading p:not(.eyebrow)').id='entryInstruction';
 $('entryPhase1').textContent='01 选定分析范围';$('entryPhase2').textContent='02 核对构件与材料';$('entryPhase3').textContent='03 查看所选范围的碳排放';
 box.querySelector('.entry-scope').innerHTML='<label><input type="radio" name="entryScope" value="selection"><span><b>当前选中的构件</b><small>例如：只看一块板和旁边两根柱</small></span></label><label><input type="radio" name="entryScope" value="floor" checked><span><b>指定楼层</b><small>例如：只分析 2F，不读取其他楼层</small></span></label><label><input type="radio" name="entryScope" value="all"><span><b>整个模型</b><small>包含示例中的两层、10 个构件</small></span></label>';
 box.querySelector('[value="all"]').parentElement.querySelector('small').textContent=`两层，共 ${source.length} 个构件`;
 $('entrySelections').before(Object.assign(document.createElement('div'),{id:'entryFloor',innerHTML:'<label for="entryFloorSelect">分析哪一层？</label><select id="entryFloorSelect"><option value="1F">1F · 首层（示例）</option><option value="2F">2F · 二层（示例）</option></select>'}));
 $('entrySelections').before(Object.assign(document.createElement('p'),{id:'entrySelectionHint',className:'help',hidden:true,textContent:'这里模拟在 Rhino 中选择对象：点击模型或勾选下方构件，可跨层选择。'}));
 $('entryRead').before(Object.assign(document.createElement('div'),{id:'entryScopeSummary',className:'entry-scope-summary'}));
 preview.querySelector('.panelhead').insertAdjacentHTML('afterend','<div class="entry-range-bar"><span id="entryRangeLabel" aria-live="polite"></span><label><input id="entryIsolate" type="checkbox">只显示本次范围</label></div>');
 $('entryEmpty').innerHTML='<p class="eyebrow">本次会读入什么</p><h3 id="entrySelectionTitle"></h3><div id="entrySelectionCounts" class="entry-selection-counts"></div><p>仅把高亮构件带入分析，其他构件留作背景，不计入结果。</p><details class="entry-floor-basis"><summary>楼层归属如何确定？</summary><p>当前使用示例标签：每层包含四根柱及其上方楼板。真实插件需读取并核对模型的楼层或图层信息；归属不清、跨层构件应单独确认，不能仅凭高度猜测或自动截断。</p></details><p class="help">这次只读取范围，不修改模型；分类与材料在下一步核对。</p>';
 $('entryReadHint').textContent='按钮只载入高亮的示例构件，不读取真实文件。';
 $('entryEmpty').querySelector('.entry-floor-basis p').textContent='示例对象带有 1F / 2F 楼层标签。真实插件需读取并核对模型的楼层或图层信息；归属不清、跨层构件应单独确认，不能只凭高度猜测或自动截断。';
 $('entryModel').setAttribute('aria-label','两层示例模型，可选择构件并预览分析范围');
 // Review classifications, not the presence of a carbon factor. Confirming steel must never calculate it as concrete.
 const confirmed=r=>r.typeConfirmed&&r.materialConfirmed&&r.type!=='unknown'&&r.material!=='unknown';
 const calculable=r=>confirmed(r)&&!C.element(r).error;
 const uncertain=r=>r.type==='unknown'||r.material==='unknown';
 const sourceKey=r=>JSON.stringify([r.layer||'',r.sourceMaterialId,r.sourceMaterial,r.materialRecord?.grade||'']);
 const matchKey=r=>r.type+'|'+r.material+'|'+sourceKey(r);
 let learnedMappings={};
 try{learnedMappings=JSON.parse(localStorage.getItem('carbonloop.rhino.semantic-mappings.v2')||'{}');}catch(_){learnedMappings={};}
 function saveLearned(){try{localStorage.setItem('carbonloop.rhino.semantic-mappings.v2',JSON.stringify(learnedMappings));}catch(_){}}
 function prepareRow(e){
  const row={...e,...M.match(e.materialRecord),sourceType:e.type,typeConfirmed:false,materialConfirmed:false,typeEdited:false,materialEdited:false};
  const learned=learnedMappings[sourceKey(row)];
  if(learned?.type&&types[learned.type]&&!['CarbonLoop.Type','web-semantic-guard'].includes(row.typeInference?.source)){row.type=learned.type;row.typeInference={source:'confirmed-project-mapping',confidence:1,basis:'采用你此前确认的“图层＋原始材料”项目映射。'};}
  if(learned?.material&&C.materials.some(m=>m.id===learned.material)){row.material=learned.material;row.matchBasis='采用你此前确认的“图层＋原始材料”项目映射；本次仍可修改。';}
  return row;
 }
 function preserveReview(next,previous){
  if(!previous)return next;
  const sameTypeSource=previous.sourceType===next.sourceType&&previous.layer===next.layer&&previous.type===next.type;
  const sameMaterialSource=sourceKey(previous)===sourceKey(next)&&previous.material===next.material;
  if(sameTypeSource){next.typeConfirmed=!!previous.typeConfirmed;next.typeEdited=!!previous.typeEdited;}
  if(sameMaterialSource){next.materialConfirmed=!!previous.materialConfirmed;next.materialEdited=!!previous.materialEdited;}
  return next;
 }
 const visible=()=>rows.filter(r=>group==='all'||(group==='pending'?!confirmed(r):group==='issues'?uncertain(r):group.startsWith('match:')?matchKey(r)===group.slice(6):r.type===group));
 const materialOptions=select=>{select.replaceChildren();for(const family of [...new Set(C.materials.map(m=>m.group))]){const optgroup=document.createElement('optgroup');optgroup.label=family;for(const m of C.materials.filter(m=>m.group===family)){const option=document.createElement('option');option.value=m.id;option.textContent=m.name;optgroup.append(option);}select.append(optgroup);}};
 materialOptions($('entryMaterial'));
 for(const [value,label] of Object.entries(types)){if([...$('entryType').options].some(option=>option.value===value))continue;const opt=document.createElement('option');opt.value=value;opt.textContent=label;$('entryType').append(opt);}
 $('entrySummary').insertAdjacentHTML('afterend','<div id="entryAutoSummary" class="entry-auto-summary" aria-live="polite"></div><div id="entryMaterialGroups" class="entry-material-groups" aria-label="系统整理的构件与材料分组"></div>');
 // The bulk action belongs next to the intake summary, not below a potentially
 // long object table. Architects should never have to confirm hundreds of
 // imported objects one by one.
 $('entryAutoSummary').after($('entryConfirmGroup'));
 const objects=document.createElement('details');objects.id='entryObjectList';objects.className='entry-object-list';objects.innerHTML='<summary>按楼板、梁、柱等构件类型浏览 / 批量核验</summary>';$('entryGroups').before(objects);objects.append($('entryGroups'),$('entryMaterialGroups'));
 const table=document.createElement('table');table.className='entry-component-table';table.innerHTML='<caption>先看构件类型，再核对该构件使用的材料；两者不会混为一类</caption><thead><tr><th>构件类型 / 模型名称</th><th>原模型材料 → 碳材料类别</th><th>核验</th></tr></thead>';
 const tbody=document.createElement('tbody');tbody.id='entryRows';$('entryRows').replaceWith(table);table.append(tbody);
 $('entryObjectTitle').insertAdjacentHTML('afterend','<p class="eyebrow">原模型材料 → 目录匹配</p><dl id="entrySourceMaterial" class="entry-source-material"></dl><div id="entryRecognition" class="entry-recognition"></div><p id="entryMatchBasis" class="help"></p><p id="entryCalculationState" class="help"></p>');
 const corrections=document.createElement('details');corrections.id='entryCorrections';corrections.className='entry-corrections';corrections.innerHTML='<summary>核对与修改 · 可直接选择</summary>';corrections.open=true;
 const typeLabel=box.querySelector('label[for="entryType"]'),materialLabel=box.querySelector('label[for="entryMaterial"]'),oldHelp=$('entryMaterialBasis').nextElementSibling;
 typeLabel.before(corrections);for(const el of [typeLabel,$('entryType'),$('entryTypeBasis'),materialLabel,$('entryMaterial'),$('entryMaterialBasis')])corrections.append(el);
 oldHelp.textContent='混凝土与钢筋分别记录；未建模的钢筋不会自动补出数量。没有计算数据的材料保留分类，不当作零排放。';
 corrections.append(Object.assign(document.createElement('label'),{className:'entry-apply-similar',innerHTML:'<input id="entryApplySimilar" type="checkbox">同时应用到当前材料组 <span id="entrySimilarCount"></span>'}));
 $('entryConfirmHelp').textContent='这里只核对分类与设计意图；计算数据是否齐全由系统另行检查，不代表结构安全。';
 // Keep editable fields above optional provenance; never bury the correction controls.
 $('entryObjectTitle').after(corrections);corrections.after($('entryConfirmOne'));
 const provenance=document.createElement('details');provenance.className='entry-provenance';provenance.innerHTML='<summary>原始材料与匹配依据</summary>';
 $('entrySourceMaterial').before(provenance);provenance.append($('entrySourceMaterial'),$('entryMatchBasis'));
 $('entryObjectTitle').parentElement.querySelector('p.eyebrow').hidden=true;
 function peers(r){return rows.filter(e=>e.sourceType===r.sourceType&&sourceKey(e)===sourceKey(r));}
 function materialGroups(){
  const container=$('entryMaterialGroups');container.replaceChildren();
  const keys=[...new Set(rows.map(matchKey))];
  for(const key of keys){const members=rows.filter(r=>matchKey(r)===key),r=members[0],n=members.filter(confirmed).length;
   const card=document.createElement('div');card.className='entry-material-card';card.dataset.materialGroup=key;
   const view=document.createElement('button');view.className='entry-material-view';view.dataset.match=key;view.setAttribute('aria-pressed',group==='match:'+key);
   const title=document.createElement('strong'),meta=document.createElement('span'),layerLeaf=(r.layer||'').split('::').pop();title.textContent=`构件：${types[r.type]}${layerLeaf?' · '+layerLeaf:''}`;meta.textContent=`${members.length} 个 · ${n===members.length?'已核验':`待核验 ${members.length-n} 个`}`;view.append(title,meta);view.addEventListener('click',()=>{group='match:'+key;objects.open=true;render();$('entryApplySimilar').checked=members.length>1;detail();});
   const mapping=document.createElement('p');mapping.className='entry-card-mapping';mapping.textContent=`材料：${r.sourceMaterial||'模型未提供'} → ${r.materialEdited?'已修正为':'识别为'} ${C.materialInfo(r.material).name}`;
   const status=document.createElement('p');status.textContent=uncertain(r)?'信息缺失，请定位后核对':C.element(r).error||('KBOB '+C.factorFor(r.material).id+' · 瑞士参考因子已接通');
   const approve=document.createElement('button');approve.className='outline';approve.dataset.confirmMatch=key;approve.textContent=n===members.length?'已确认':`分类正确，确认 ${members.length} 个`;approve.disabled=readOnly||uncertain(r)||n===members.length;approve.addEventListener('click',()=>confirm(members));
   card.append(view,mapping,status,approve);container.append(card);
  }
 }
 function svgNode(tag,attrs){const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;}
 let projection={minX:0,minY:0,minZ:0,scale:1};
 function point(x,y,z){const {minX,minY,minZ,scale}=projection;return [350+((x-minX)-(y-minY))*scale*.72,365-((z-minZ)*scale)+((x-minX)+(y-minY))*scale*.15];}
 function polygon(points,attrs){return svgNode('polygon',{points:points.map(p=>point(...p).join(',')).join(' '),...attrs});}
 function draw(){
  const svg=$('entryModel');svg.replaceChildren();
  const minX=Math.min(...source.map(e=>e.x)),minY=Math.min(...source.map(e=>e.y)),minZ=Math.min(...source.map(e=>e.z)),maxX=Math.max(...source.map(e=>e.x+e.l)),maxY=Math.max(...source.map(e=>e.y+e.w)),maxZ=Math.max(...source.map(e=>e.z+e.h));
  const dx=Math.max(maxX-minX,.01),dy=Math.max(maxY-minY,.01),dz=Math.max(maxZ-minZ,.01);projection={minX,minY,minZ,scale:Math.min(58,390/(dx+dy),220/(dz+(dx+dy)*.12))};
  const pad=Math.max(maxX-minX,maxY-minY,.2)*.08;svg.append(polygon([[minX-pad,minY-pad,minZ],[maxX+pad,minY-pad,minZ],[maxX+pad,maxY+pad,minZ],[minX-pad,maxY+pad,minZ]],{fill:'#203038',stroke:'#41555d'}));
  const ids=new Set((scanned?rows:scopeRows()).map(r=>r.id)),show=new Set(visible().map(r=>r.id));
  let preview=source.length>PREVIEW_LIMIT?source.filter(e=>ids.has(e.id)).slice(0,PREVIEW_LIMIT):[...source];
  const selectedObject=source.find(e=>e.id===selected);if(selectedObject&&!preview.some(e=>e.id===selectedObject.id))preview.push(selectedObject);
  preview.sort((a,b)=>scanned&&a.id===selected?1:scanned&&b.id===selected?-1:a.z-b.z||(a.x+a.y)-(b.x+b.y)).forEach(e=>{
   const r=rows.find(r=>r.id===e.id),included=ids.has(e.id),focus=scanned&&e.id===selected;
   const g=svgNode('g',{'data-entry-id':e.id,'data-in-scope':String(included),role:'button',tabindex:0,'aria-label':e.floor+' '+e.name+' '+e.id+(included?'，在本次范围内':'，不在分析范围'),'aria-pressed':scanned?focus:included});
   if($('entryIsolate').checked&&!included){g.setAttribute('display','none');g.setAttribute('tabindex','-1');}
   const fill=focus?'#8dc3ff':(!scanned&&included)||(scanned&&r&&confirmed(r))?'#89cdb7':'#89949d';
   const {x,y,z}=e,X=x+e.l,Y=y+e.w,Z=z+e.h;
   const opacity=(!included||(scanned&&!show.has(e.id))) ? .07 : scanned&&!focus?.38:1;
   [[[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],[[X,y,z],[X,Y,z],[X,Y,Z],[X,y,Z]],[[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]]].forEach((pts,i)=>g.append(polygon(pts,{fill,'fill-opacity':opacity*[.7,.85,1][i],stroke:focus?'#c5e2ff':'#30444e','stroke-width':focus?3:1})));
   svg.append(g);
  });
  for(const level of [...new Set(preview.map(e=>e.floor).filter(Boolean))]){const members=preview.filter(e=>e.floor===level),z=Math.min(...members.map(e=>e.z));const t=svgNode('text',{x:30,y:point(minX,minY,z)[1],fill:'#a4b3b8','font-size':14});t.textContent=level;svg.append(t);}
  if(source.length>preview.length){const t=svgNode('text',{x:30,y:420,fill:'#a4b3b8','font-size':13});t.textContent=`预览显示 ${preview.length} / ${source.length} 个；计算仍保留全部数据`;svg.append(t);}
 }
 function setup(){
  box.dataset.phase='setup';$('entryEmpty').hidden=false;$('entryDetail').hidden=true;rangePanel.open=true;
  const list=scopeRows(),count=list.length;
  $('entrySelections').hidden=scope!=='selection';$('entrySelectionHint').hidden=scope!=='selection';$('entryFloor').hidden=scope!=='floor';$('entryFloorSelect').value=floor;$('entryRead').disabled=!count;
  $('entryTitle').textContent=scanned?'核对构件与材料':'选择分析范围';
  $('entryInstruction').textContent='先选构件、楼层或整个模型，再读取高亮范围的信息。';
  $('entryProgress').textContent=count?`已选 ${count} 个构件`:'请选择构件';
  $('entryRead').textContent=count?`读取这 ${count} 个构件 →`:'请先选择构件';
  $('entryRangeLabel').textContent=`高亮 ${count} / ${source.length} 个 · ${scopeName()}`;
  $('entryScopeSummary').textContent=`本次 ${count} 个 / 排除 ${source.length-count} 个`;
  $('entrySelectionTitle').textContent=count?scopeName():'尚未选择构件';
  $('entrySelectionCounts').replaceChildren();
  for(const [type,label] of Object.entries(types)){const n=list.filter(e=>e.type===type).length;if(n){const p=document.createElement('p');p.textContent=`${label} ${n} 个`;$('entrySelectionCounts').append(p);}}
  if(!count)$('entrySelectionCounts').textContent='点击中间模型，或勾选左侧列表。';
  $('entryModelHint').textContent='绿色是本次范围，灰淡部分不计入；勾选“只显示本次范围”可隐藏背景。';draw();
 }
 function detail(){
  const r=rows.find(r=>r.id===selected);$('entryDetail').hidden=!r;$('entryEmpty').hidden=!!r;if(!r)return;
  // When the user moves to another object, default to reviewing its whole
  // exact-source peer group. Previously render() cleared this checkbox after
  // the row click had enabled it, so the UI fell back to "confirm 1 object"
  // even when hundreds of matching Rhino objects were visible in the list.
  // Keep a manual uncheck while the same object remains selected.
  if(corrections.dataset.selected!==r.id){corrections.open=true;$('entryApplySimilar').checked=peers(r).length>1;corrections.dataset.selected=r.id;}
  $('entryObjectTitle').textContent=`${types[r.type]} · ${r.name||r.id}`;
  $('entryGeometry').replaceChildren();
  const displayDimensions=r.previewAdjusted&&r.sourceDimensions?`${r.sourceDimensions.map(v=>Number(v).toFixed(3)).join(' × ')} m（零厚度方向仅补作预览）`:`${r.l} × ${r.w} × ${r.h} m`;
  for(const [k,v] of [['楼层',r.floor||'待核对'],['图层',r.layer||'模型未提供'],['尺寸',displayDimensions],['位置',`x ${r.x} / y ${r.y} / z ${r.z} m`],['工程量',r.quantity?.kind==='net-volume'?`${Number(r.quantity.value).toFixed(3)} m³`:'模型未提供可计算净体积'],['数据来源',sourceMode==='rhino'?(r.geometryBasis||'Rhino 实时发送；包围盒尺寸已换算为 m'):'内置长方体示例；未读取本机模型']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;$('entryGeometry').append(dt,dd);}
  $('entryType').value=r.type;$('entryMaterial').value=r.material;
  $('entrySourceMaterial').replaceChildren();
  for(const [key,value] of [['原始名称',r.sourceMaterial],['材料编号',r.sourceMaterialId],['原始牌号',r.materialRecord?.grade||'模型未提供'],['读取来源',r.materialRecord?.origin||'示例属性']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;$('entrySourceMaterial').append(dt,dd);}
  $('entryRecognition').textContent=`构件：${types[r.type]} ｜ 材料：${C.materialInfo(r.material).name}`;
  $('entryMatchBasis').textContent=r.materialEdited?'你已修正目录分类；上方原始材料记录不变，可对照检查。':r.matchBasis;
  $('entryCalculationState').hidden=!C.element(r).error;
  $('entryCalculationState').textContent=C.element(r).error||('已接入 KBOB '+C.factorFor(r.material).id+' · '+C.factorNote(r.material)+'。仅生产＋处置，非全生命周期。');
  $('entrySimilarCount').textContent=`（本组 ${peers(r).length} 个 / 本次模型共 ${rows.length} 个）`;
  $('entryApplySimilar').disabled=readOnly||peers(r).length<2;
  $('entryTypeState').textContent=r.typeConfirmed?'已人工确认':'待确认';$('entryMaterialState').textContent=r.materialConfirmed?'已人工确认':'待确认';
  $('entryTypeBasis').textContent=r.typeEdited?'依据：你在本次核对中修改的分类。':r.typeInference?`${r.typeInference.basis} 置信度 ${Math.round((r.typeInference.confidence||0)*100)}%。`:'依据：示例预设分类。';
  $('entryMaterialBasis').textContent=r.materialEdited?'依据：你修正的材料分类；不代表已取得计算因子或材料性能。':r.matchBasis;
  $('entryType').disabled=readOnly;$('entryMaterial').disabled=readOnly;
  const similar=$('entryApplySimilar').checked?peers(r):[r],confirmable=similar.filter(item=>!confirmed(item)&&!uncertain(item));
  $('entryConfirmOne').textContent=$('entryApplySimilar').checked&&similar.length>1?`确认当前材料组的 ${similar.length} 个`:'确认当前构件';
  $('entryConfirmHelp').textContent=$('entryApplySimilar').checked&&similar.length>1
   ?`这里只确认当前材料组 ${similar.length} 个，不是本次模型全部 ${rows.length} 个。要批量确认全部已识别构件，请使用页面上方的“一键确认全部已识别构件”。`
   :'这里只核对当前构件的分类与材料；计算数据是否齐全由系统另行检查，不代表结构安全。';
  $('entryConfirmOne').disabled=readOnly||!confirmable.length;
 }
 function render(){
  const list=visible();if(!list.some(r=>r.id===selected))selected=list[0]?.id||'';
  $('entryGroups').replaceChildren();
  for(const [key,name] of [['all','全部'],...Object.entries(types),['pending','待核对'],['issues','信息不明']]){
   const count=rows.filter(r=>key==='all'||(key==='pending'?!confirmed(r):key==='issues'?uncertain(r):r.type===key)).length;
   const b=document.createElement('button');b.textContent=`${name} ${count}`;b.dataset.group=key;b.setAttribute('aria-pressed',group===key);b.addEventListener('click',()=>{group=key;render();});$('entryGroups').append(b);
  }
  $('entryRows').replaceChildren();
  let displayList=list.slice(0,TABLE_LIMIT);const selectedRow=list.find(r=>r.id===selected);if(selectedRow&&!displayList.some(r=>r.id===selectedRow.id))displayList=[selectedRow,...displayList.slice(0,TABLE_LIMIT-1)];
  for(const r of displayList){
   const tr=document.createElement('tr');tr.className='entry-row';tr.dataset.row=r.id;tr.dataset.selected=String(r.id===selected);tr.dataset.floor=r.floor;tr.dataset.material=r.material;
   const identity=document.createElement('td'),material=document.createElement('td'),actions=document.createElement('td');
   const locate=document.createElement('button');locate.className='entry-locate';locate.dataset.locate=r.id;locate.textContent=`${types[r.type]} · ${r.name||r.id}`;locate.setAttribute('aria-pressed',r.id===selected);
   const location=document.createElement('small');location.textContent=`${r.floor||'楼层待确认'} · ${(r.layer||'图层待确认').split('::').slice(-2).join(' / ')}`;
   const focus=()=>{selected=r.id;$('entryApplySimilar').checked=peers(r).length>1;render();$('entryRows').querySelector(`[data-locate="${r.id}"]`)?.focus({preventScroll:true});};locate.addEventListener('click',event=>{event.stopPropagation();focus();});tr.addEventListener('click',focus);identity.append(locate,location);
   const raw=document.createElement('strong'),mapped=document.createElement('span'),grade=document.createElement('small');raw.textContent=r.sourceMaterial;mapped.textContent=`→ ${C.materialInfo(r.material).name}`;grade.textContent=r.materialRecord?.grade?`原始牌号：${r.materialRecord.grade}`:'原模型未提供牌号';material.append(raw,mapped,grade);
   const choose=document.createElement('select');choose.dataset.rowMaterial=r.id;choose.setAttribute('aria-label',r.floor+' '+r.id+' 材料类别（可修改）');materialOptions(choose);choose.value=r.material;choose.disabled=readOnly;
   choose.addEventListener('click',event=>event.stopPropagation());
   choose.addEventListener('focus',()=>{selected=r.id;$('entryApplySimilar').checked=peers(r).length>1;detail();draw();$('entrySelectedLabel').textContent=r.floor+' · '+types[r.type]+' '+r.id;document.querySelectorAll('.entry-row').forEach(row=>row.dataset.selected=String(row.dataset.row===r.id));});
   choose.addEventListener('change',()=>{selected=r.id;amend(r,'material',choose.value,false);$('entryRows').querySelector('[data-row-material="'+r.id+'"]')?.focus({preventScroll:true});});
   material.append(choose);
   const status=document.createElement('span');status.className='entry-row-status';status.textContent=uncertain(r)?'未匹配':confirmed(r)?'已确认':'待核验';
   const button=document.createElement('button');button.className='outline';button.dataset.confirmRow=r.id;button.textContent=uncertain(r)?'去核对':confirmed(r)?'已确认':'确认';button.disabled=readOnly||confirmed(r);button.addEventListener('click',event=>{event.stopPropagation();if(uncertain(r)){selected=r.id;render();corrections.open=true;$('entryMaterial').focus({preventScroll:true});}else confirm([r]);});actions.append(status,button);tr.append(identity,material,actions);$('entryRows').append(tr);
  }
  if(list.length>displayList.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.className='entry-empty';td.textContent=`当前表格先显示 ${displayList.length} / ${list.length} 个；筛选类型或材料可缩小列表，批量确认仍作用于完整分组。`;tr.append(td);$('entryRows').append(tr);}
  if(!list.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.className='entry-empty';td.textContent='这一组没有构件。可切换“全部”查看。';tr.append(td);$('entryRows').append(tr);}
  const n=rows.filter(confirmed).length,ready=rows.filter(calculable).length,missing=rows.length-ready;
  materialGroups();
  $('entryAutoSummary').textContent=`已读取 ${source.length} 个 Rhino 对象；自动排除 ${excludedSource().length} 个标注/辅助对象。当前范围 ${rows.length} 个：${rows.filter(r=>!uncertain(r)).length} 个的构件类型与材料均已识别，可直接批量确认；${rows.filter(uncertain).length} 个仍需核对。`;
  $('entrySummary').textContent=`${scopeName()} · 已载入 ${rows.length} 个 · 已确认 ${n} / ${rows.length}`;
  $('entryRangeLabel').textContent=`本次 ${rows.length} / ${source.length} 个 · ${scopeName()}`;
  $('entryProgress').textContent=missing?`已确认 ${n}/${rows.length} · 可计算 ${ready} 个`:`已确认 ${n} 个构件`;
  $('entryPartialWrap').lastChild.textContent='仅计算已知部分（有缺项）';
  $('entryPartialWrap').hidden=!missing||readOnly;
  $('entryContinue').disabled=readOnly?false:!n||(missing>0&&!$('entryPartial').checked);
  $('entryContinue').textContent=readOnly?'返回工作台':'确认并计算碳排 →';
  const confirmableCount=list.filter(r=>!confirmed(r)&&!uncertain(r)).length;
  const groupName=group==='all'?'全部已识别构件':group==='pending'?'待核对构件':group==='issues'?'信息不明构件':group.startsWith('match:')?'当前同类构件':types[group]||'当前筛选组';
  $('entryConfirmGroup').textContent=`一键确认${groupName}（${confirmableCount}）`;
  $('entryConfirmGroup').disabled=readOnly||!confirmableCount;
  detail();draw();$('entrySelectedLabel').textContent=selected?`${rows.find(r=>r.id===selected)?.floor} · ${types[rows.find(r=>r.id===selected)?.type]} ${selected}`:'本次范围内没有构件';
  $('entryModelHint').textContent=rangePanel.open&&scope==='selection'?'正在选范围：点击模型可加入或移除构件；收起范围面板后，点击构件核对材料。':'蓝色是当前构件，其他构件半透明。点模型或左侧名称，直接核对、修改；不离开模型。';
 }
 function review(){
  box.dataset.phase='review';
  scanned=true;$('entrySetup').hidden=false;$('entryReview').hidden=false;$('entryContinue').hidden=false;$('entryBack').hidden=true;rangePanel.open=false;$('entryRead').hidden=true;syncScopeControls();
  $('entryTitle').textContent=scanned?'核对构件与材料':'选择分析范围';$('entryInstruction').textContent='模型留在原位：点构件高亮，直接改材料；范围和依据按需展开。';$('entryPhase1').classList.remove('current');$('entryPhase2').classList.add('current');render();
 }
 function confirm(list){
  for(const r of list){if(r.type!=='unknown')r.typeConfirmed=true;if(r.material!=='unknown')r.materialConfirmed=true;}
  $('entryPartial').checked=false;$('entryNotice').textContent='已确认';render();
 }
 function metadata(){const intake=intakeStatus;return {mode:sourceMode==='rhino'?'Rhino 8 插件导入':'Rhino 数据合同演示输入',rhino_connected:sourceMode==='rhino',ai_connected:false,intake_contract_version:intake?.metadata?.contractVersion||null,intake_contract_valid:intake?.valid===true,intake_source_host:intake?.metadata?.sourceHost||null,intake_document_id:intake?.metadata?.documentId||null,intake_plugin_version:intake?.metadata?.pluginVersion||null,intake_semantic_profile_version:intake?.metadata?.semanticProfileVersion||null,intake_unit_system:intake?.metadata?.unitSystem||null,scope,scope_label:scopeName(),floor:scope==='floor'?floor:null,floor_ids:[...new Set(rows.map(r=>r.floor))],floor_basis:sourceMode==='rhino'?'来自 Rhino 对象自定义属性、发送图层或图层名称；必须人工核对':'示例楼层标签，非自动推断；几何仅作交互演示',source_count:source.length,excluded_count:excludedSource().length+(eligibleSource().length-rows.length),selected_ids:rows.map(r=>r.id),checked_at:new Date().toISOString(),confirmed_count:rows.filter(confirmed).length,calculable_count:rows.filter(calculable).length,missing_factor_count:rows.filter(r=>confirmed(r)&&!!C.element(r).error).length,partial_acknowledged:$('entryPartial').checked,records:C.clone(rows)};}
 function syncScopeControls(){
  const list=scopeRows();
  $('entrySelections').hidden=scope!=='selection';$('entrySelectionHint').hidden=scope!=='selection';$('entryFloor').hidden=scope!=='floor';$('entryFloorSelect').value=floor;
  $('entryRangeSummary').textContent='分析范围 · '+scopeName()+' · '+list.length+' 个构件';
  $('entryScopeSummary').textContent='本次 '+list.length+' 个 / 范围外 '+(eligibleSource().length-list.length)+' 个 / 自动排除 '+excludedSource().length+' 个辅助对象';
  $('entryReadHint').textContent=scanned?'范围调整立即生效；同一构件的修改和确认会保留。当前使用预置数据。':'读取后，在同一个工作区核对，不会打开新页面。当前使用预置数据。';
  box.querySelectorAll('[name=entryScope],#entryFloorSelect,[data-pick]').forEach(el=>el.disabled=readOnly);
 }
 function refreshRange(){
  if(readOnly)return;
  rows.forEach(r=>remembered.set(r.id,r));
  rows=scopeRows().map(e=>remembered.get(e.id)||prepareRow(e));
  group='all';$('entryPartial').checked=false;syncScopeControls();
  if(scanned){render();$('entryNotice').textContent='范围已更新';}
 }
 function rangeChanged(){if(scanned)refreshRange();else{setup();syncScopeControls();}}
 $('entryRead').addEventListener('click',()=>{refreshRange();if(!rows.length)return;objects.open=false;
  // Start with the complete intake scope. Individual material cards still
  // provide group-specific confirmation, but the primary action must never
  // silently shrink to the largest material group.
  group='all';$('entryApplySimilar').checked=false;
  review();
 });
 $('entryFloorSelect').addEventListener('change',()=>{floor=$('entryFloorSelect').value;rangeChanged();});
 rangePanel.addEventListener('toggle',()=>{if(scanned)render();});
 $('entryIsolate').addEventListener('change',draw);
 document.querySelectorAll('[name="entryScope"]').forEach(el=>el.addEventListener('change',()=>{scope=el.value;rangeChanged();}));
 function selectionList(){$('entrySelections').replaceChildren();for(const e of eligibleSource()){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=e.id;input.dataset.pick=e.id;input.addEventListener('change',()=>{input.checked?chosen.add(e.id):chosen.delete(e.id);rangeChanged();});label.append(input,document.createTextNode(e.floor+' / '+e.name.replace(/^2F /,'')));$('entrySelections').append(label);}}selectionList();
 function floorList(){const select=$('entryFloorSelect'),floors=[...new Set(eligibleSource().map(e=>e.floor).filter(Boolean))];select.replaceChildren();for(const value of floors){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option);}if(!floors.includes(floor))floor=floors[0]||'待确认';select.value=floor;}
 function sourceUI(){
  const live=sourceMode==='rhino',badge=box.querySelector('.entry-badge'),connection=box.querySelector('.entry-connection'),tag=preview.querySelector('.mini-tag');
  badge.textContent=live?`Rhino 已连接 · ${source.length} 个对象 · 语义映射已启用`:'Rhino 接入协议 · 插件未连接';
  connection?.querySelector('strong')&&(connection.querySelector('strong').textContent=live?'Rhino 8 插件 · 已接收':'Rhino 数据协议 · 演示输入');
  connection?.querySelector('p')&&(connection.querySelector('p').textContent=live?`已通过 ${intakeStatus.metadata.contractVersion} 校验，并使用 ${intakeStatus.metadata.semanticProfileVersion||'本地语义规则'} 翻译图层与材料；${intakeStatus.metadata.syncMode==='automatic'?'本次因“'+intakeStatus.metadata.syncReason+'”自动同步。':'首次发送后，Rhino 的构件、图层和材质修改会自动同步。'} 只需核对不确定项。`:'当前示例通过与未来 Rhino 插件相同的数据合同转换和校验；真实插件尚未连接。');
  if(tag)tag.textContent=live?'Rhino 对象预览 · m':'示例几何 · m';
  $('entryReadHint').textContent=live?'读取后在同一页面核对材料；不会修改 Rhino 模型。':'按钮只载入高亮的示例构件，不读取真实文件。';
  box.querySelector('[value="all"]')?.parentElement.querySelector('small')&&(box.querySelector('[value="all"]').parentElement.querySelector('small').textContent=`共 ${source.length} 个构件`);
 }
 function pick(event){const g=event.target.closest('[data-entry-id]');if(!g)return;const id=g.dataset.entryId;
  if(scope==='selection'&&(!scanned||rangePanel.open)&&!readOnly){chosen.has(id)?chosen.delete(id):chosen.add(id);$('entrySelections').querySelector('[data-pick="'+id+'"]').checked=chosen.has(id);rangeChanged();}
  else if(scanned){if(!rows.some(r=>r.id===id))return;group='all';selected=id;$('entryApplySimilar').checked=peers(rows.find(r=>r.id===id)).length>1;render();$('entryRows').querySelector('[data-row="'+id+'"]')?.scrollIntoView({block:'nearest'});}
  else{selected=id;}
  $('entryModel').querySelector('[data-entry-id="'+id+'"]')?.focus({preventScroll:true});
 }
 $('entryModel').addEventListener('click',pick);$('entryModel').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(e);}});
 $('entryConfirmOne').addEventListener('click',()=>{const current=rows.find(r=>r.id===selected);confirm(current&&$('entryApplySimilar').checked?peers(current):current?[current]:[]);});
 $('entryConfirmGroup').addEventListener('click',()=>confirm(visible()));
 $('entryApplySimilar').addEventListener('change',detail);
 function amend(r,key,value,bulk){
  if(!r||readOnly)return;
  const targets=bulk?peers(r):[r],flag=key==='type'?'typeConfirmed':'materialConfirmed';
  for(const target of targets){target[key]=value;target[flag]=false;target[key+'Edited']=true;const saved=learnedMappings[sourceKey(target)]||{};if(value==='unknown')delete saved[key];else saved[key]=value;saved.updatedAt=new Date().toISOString();learnedMappings[sourceKey(target)]=saved;}
  saveLearned();
  group='all';$('entryPartial').checked=false;$('entryNotice').textContent='已修改 '+targets.length+' 个构件，请确认';render();
 }
 for(const [id,key] of [['entryType','type'],['entryMaterial','material']])$(id).addEventListener('change',()=>amend(rows.find(r=>r.id===selected),key,$(id).value,$('entryApplySimilar').checked));
 $('entryPartial').addEventListener('change',render);
 $('entryCancel').addEventListener('click',()=>{box.hidden=true;onCancel?.();});
  $('entryContinue').addEventListener('click',()=>{if(readOnly){box.hidden=true;onCancel?.();return;}if($('entryContinue').disabled)return;const data=metadata(),elements=rows.map(r=>{const e={};for(const key of ['id','name','type','typeInference','layer','floor','x','y','z','l','w','h','geometryBasis','previewAdjusted','sourceDimensions','quantityRequired','material','materialRecord','sourceMaterial','sourceMaterialId','matchBasis','quantity'])e[key]=r[key];if(r.typeEdited)e.name=types[r.type]+' '+r.id;e.material=confirmed(r)?r.material:'unknown';return e;});box.hidden=true;onDone(elements,data);});
  window.ModelEntry={acceptRhino(payload){const normalized=R.normalize(payload);if(!normalized.valid)return normalized;const previousRows=new Map(rows.map(row=>[row.id,row])),hadReview=scanned;source=C.clone(normalized.objects);intakeStatus=normalized;sourceMode='rhino';remembered.clear();for(const item of source.filter(e=>e.analysisEligible!==false)){const row=preserveReview(prepareRow(item),previousRows.get(item.id));remembered.set(row.id,row);}chosen=new Set(source.filter(e=>e.analysisEligible!==false).map(e=>e.id));scope=normalized.metadata.selectionMode==='floor'?'floor':'all';floor=source.find(e=>e.analysisEligible!==false)?.floor||'待确认';rows=hadReview?scopeRows().map(e=>remembered.get(e.id)||prepareRow(e)):[];group='all';selected=rows.some(e=>e.id===selected)?selected:(source.find(e=>e.analysisEligible!==false)?.id||'');scanned=hadReview;$('entryRead').hidden=hadReview;$('entrySetup').hidden=false;$('entryReview').hidden=!hadReview;$('entryContinue').hidden=!hadReview;selectionList();floorList();sourceUI();if(!box.hidden){if(hadReview)review();else{setup();syncScopeControls();}document.querySelectorAll('[name="entryScope"]').forEach(el=>el.checked=el.value===scope);}$('entryNotice').textContent=hadReview?`Rhino 已自动同步；保留 ${rows.filter(confirmed).length} 个未变化构件的核验，只需检查新增或已变化项。`:`已接收 Rhino 的 ${source.length} 个对象；已自动排除 ${source.filter(e=>e.analysisEligible===false).length} 个标注/辅助对象，请核对其余分组后计算。`;document.dispatchEvent(new CustomEvent('carbon-rhino-intake-ready',{detail:{count:source.length,metadata:normalized.metadata,warnings:normalized.warnings,preservedReview:hadReview}}));return normalized;},open(options){onDone=options.onDone;onCancel=options.onCancel;readOnly=!!options.readOnly;box.hidden=false;$('entryReadonly').hidden=!readOnly;$('entryNotice').textContent='';
  if(options.previous){remembered.clear();rows=C.clone(options.previous.records);scope=options.previous.scope;floor=options.previous.floor||'1F';chosen=new Set(options.previous.selected_ids);group='all';selected=rows[0]?.id||'';$('entryPartial').checked=!!options.previous.partial_acknowledged;review();}
  else if(sourceMode==='rhino'&&scanned&&rows.length){$('entryReadonly').hidden=true;readOnly=false;$('entryPartial').checked=false;review();}
  else{remembered.clear();rows=[];$('entryRead').hidden=false;scanned=false;$('entryIsolate').checked=false;$('entrySetup').hidden=false;$('entryReview').hidden=true;$('entryContinue').hidden=true;$('entryBack').hidden=true;$('entryPartialWrap').hidden=true;$('entryPartial').checked=false;
   if(sourceMode==='rhino'){
    // acceptRhino() has already established the real scope. Do not replace it
    // with the sample model's empty 1F selection when the intake auto-opens.
    scope=intakeStatus?.metadata?.selectionMode==='floor'?'floor':'all';
    floor=source.find(e=>e.analysisEligible!==false)?.floor||'待确认';
    chosen=new Set(source.filter(e=>e.analysisEligible!==false).map(e=>e.id));
    $('entryTitle').textContent='确认 Rhino 模型';
    $('entryProgress').textContent='先读取已发送的构件，再核对分类与材料。';
   }else{
    scope='floor';floor='1F';chosen=new Set();
    $('entryTitle').textContent='先选择要分析的模型';
    $('entryProgress').textContent='先选择范围，然后读取示例。';
   }
   $('entryPhase1').classList.add('current');$('entryPhase2').classList.remove('current');setup();}
   floorList();sourceUI();document.querySelectorAll('[name="entryScope"]').forEach(el=>el.checked=el.value===scope);$('entrySelections').querySelectorAll('input').forEach(el=>el.checked=chosen.has(el.value));syncScopeControls();$('entryTitle').focus();
 }};
})();
