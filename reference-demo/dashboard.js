(async function(){
 'use strict';
 const C=window.EUECB,$=id=>document.getElementById(id);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(v,d=2)=>v===null||v===undefined?'—':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:d});
 const countries={Denmark:'丹麦',Austria:'奥地利',Germany:'德国',Switzerland:'瑞士','United Kingdom':'英国',Belgium:'比利时',Finland:'芬兰',Netherlands:'荷兰',France:'法国',Europe:'欧洲（未细分）'};
 const uses={'Single family house':'独栋住宅','Multi-family house':'多户住宅','Office':'办公','Row house':'联排住宅','School and Daycare':'学校与托育','Semi-detached':'双拼住宅','Retail and Restaurant':'零售与餐饮','Other':'其他','Hotel & Resort':'酒店与度假','Mixed use':'混合用途','Hospital and Health':'医疗','Sport & Entertainment':'体育与娱乐','Techonology & Science':'科技科研','Art & Culture':'文化艺术','No data':'用途未提供'};
 const structures={'massive concrete':'实体混凝土结构','frame concrete':'混凝土框架','frame steel':'钢框架','massive wood':'实体木结构','massive brick':'实体砌体','frame wood':'木框架','other':'其他结构','frame concrete/wood':'混凝土 / 木混合框架','No data':'结构未提供','':'结构未填写（空白）'};
 const partNames=['地基','主体结构','次要构件','饰面','机械设备','电气设备','可再生能源设备','设施','装配 / 家具'];
 const tr=(map,v)=>map[v]||v||'未提供';
 let dataset,rows,filtered=[],groupList=[],cohortRows=[],cohortKey='',displayRows=[],page=0,selectedId=null,comparisonIds=new Set();
 const PAGE_SIZE=40,metric=()=>$('scope').value,unit=()=>$('unit').value;
 const unitText=()=>unit()==='annual'?'kg CO₂e/m²/年':'kg CO₂e/m²（原研究期）';
 const value=r=>C.result(r,metric(),unit()).value;
 const reason=r=>C.eligibility(r,metric());
 function options(id,field,map){
  const vals=[...new Set(rows.map(r=>r[field]))].sort((a,b)=>tr(map,a).localeCompare(tr(map,b),'zh'));
  $(id).innerHTML='<option value="*">全部</option>'+vals.map(v=>`<option value="${escape(v)}">${escape(tr(map,v))}</option>`).join('');
 }
 function filteredRows(){
  const q=$('search').value.trim().toLowerCase();
  return rows.filter(r=>(!q||r.admin_project_code.toLowerCase().includes(q)||r.row_id.toLowerCase().includes(q))&&[['country','site_country'],['sector','bldg_use_subtype'],['structure','bldg_struct_type']].every(([id,k])=>$(id).value==='*'||$(id).value===r[k]));
 }
 function cohortLabel(g,i){const r=g.rows[0];return `${i+1}. ${tr(countries,r.site_country)} · ${tr(uses,r.bldg_use_subtype)} · ${r.lca_RSP} 年 · ${r.bldg_area_definition} · ${r.scope_parts} · ${g.rows.length} 条`;}
 function updateGroups(){
  groupList=C.cohorts(filtered,metric());
  let idx=groupList.findIndex(g=>g.key===cohortKey);if(idx<0)idx=0;
  $('cohort').innerHTML=groupList.length?groupList.map((g,i)=>`<option value="${i}">${escape(cohortLabel(g,i))}</option>`).join(''):'<option value="">当前筛选下无符合规则的比较组</option>';
  $('cohort').disabled=!groupList.length;
  if(groupList.length)$('cohort').value=String(idx);
  cohortRows=groupList[idx]?.rows||[];cohortKey=groupList[idx]?.key||'';
 }
 function refresh(resetPage=true){
  if(resetPage)page=0;
  filtered=filteredRows();updateGroups();
  // Selections are never allowed to silently outlive a country/use/structure filter.
  const ids=new Set(filtered.map(r=>r.row_id));comparisonIds=new Set([...comparisonIds].filter(id=>ids.has(id)));
  render();
 }
 function render(){
  const valid=filtered.filter(r=>value(r)!==null),s=C.stats(cohortRows.map(value));
  $('totalCount').textContent=fmt(rows.length,0);$('uniqueCount').textContent=dataset.meta.unique_project_codes+' 个不同项目编号';
  $('count').textContent=fmt(filtered.length,0);$('availableCount').textContent=valid.length+' 条有当前范围完整数值';
  $('cohortCount').textContent=cohortRows.length;$('average').textContent=fmt(s.mean);
  document.querySelectorAll('.unitLabel').forEach(e=>e.textContent=unitText());
  $('scopeCaption').textContent=C.METRICS[metric()].label+' · '+unitText();
  $('median').textContent=fmt(s.median);$('range').textContent=s.n?fmt(s.min)+'–'+fmt(s.max):'—';
  $('sampleWarning').textContent=s.n===0?'没有满足当前条件的比较记录。请放宽筛选，或查看案例缺失原因。':s.n===1?'只有 1 条记录，只能查看数值，不能据此形成组间比较结论。':s.n<5?'样本少于 5 条，仅供逐条讨论，不形成稳定行业基准。':'本组为公开历史案例的等权统计，不是行业基准或减碳因果结论。';
  const g=cohortRows[0];
  $('cohortDescription').textContent=g?`${tr(countries,g.site_country)} · ${tr(uses,g.bldg_use_subtype)} · 面积口径 ${g.bldg_area_definition} · ${g.lca_RSP} 年 · ${g.lca_database} · ${g.lca_software}。纳入：${C.PARTS.filter(k=>g['scope_parts_'+k]==='Yes').map(k=>partNames[C.PARTS.indexOf(k)]).join('、')}。`:'本页仍保留可浏览案例，但不为不兼容的数据计算混合平均值。';
  const eligible=groupList.reduce((n,g)=>n+g.rows.length,0),unknownScenario=g&&!C.known(g.lca_scenarios_decarbonisation);
  $('eligibilityNote').textContent=`当前 ${filtered.length} 条中，${eligible} 条通过字段检查，分为 ${groupList.length} 组；${filtered.length-eligible} 条未通过。默认选记录最多的一组。${unknownScenario?'本组脱碳情景未提供，仍需人工核实。':''}`;
  $('pickPair').disabled=cohortRows.length<2;
  const counts=new Map();filtered.forEach(r=>counts.set(r.site_country,(counts.get(r.site_country)||0)+1));
  $('countryDistribution').innerHTML=counts.size?[...counts].sort((a,b)=>b[1]-a[1]).map(([country,n])=>`<button class="country-card ${$('country').value===country?'active':''}" data-country="${escape(country)}">${escape(tr(countries,country))}<b>${n}</b></button>`).join(''):'<p class="empty">没有匹配记录。点击左侧「重置筛选」重新开始。</p>';
  renderCharts(s);renderTable();renderComparison();renderDetail();
  $('exportBtn').disabled=filtered.length===0;
 }
 function renderCharts(s){
  const sample=cohortRows.slice(0,8),max=Math.max(...sample.map(r=>Math.abs(value(r))),1);
  $('chartCount').textContent=sample.length+' / '+cohortRows.length+' 条';
  $('caseBars').innerHTML=sample.length?sample.map(r=>`<div class="barcol" title="${escape(r.admin_project_code)}: ${fmt(value(r))} ${unitText()}"><span class="bar-number">${fmt(value(r))}</span><div class="barwell"><div class="barfill ${value(r)<0?'negative':''}" style="height:${Math.abs(value(r))/max*100}%"></div></div><small>${escape(r.admin_project_code)}</small></div>`).join(''):'<p class="empty">暂无同口径数据</p>';
  if(sample.some(r=>value(r)<0))$('caseBars').innerHTML='<div class="signed-values"><p class="help">含负值，改用带符号数值显示：</p>'+sample.map(r=>`<p>${escape(r.admin_project_code)} <b>${fmt(value(r))}</b></p>`).join('')+'</div>';
  // Signed values are not plotted as positive gauge fractions.
  if(!s.n||s.min<0){$('gauge').innerHTML=`<div class="empty">${s.n?'含负值，使用数值范围显示，避免误读仪表。':'暂无本组统计'}</div>`;return;}
  const scale=Math.max(s.max,1),fraction=s.mean/scale;
  $('gauge').innerHTML=`<svg viewBox="0 0 320 210" role="img" aria-label="本组均值 ${fmt(s.mean)} ${unitText()}"><path d="M35 160 A125 125 0 0 1 285 160" fill="none" stroke="#e9ece7" stroke-width="22"/><path d="M35 160 A125 125 0 0 1 285 160" fill="none" stroke="#b59e32" stroke-width="22" pathLength="100" stroke-dasharray="${fraction*100} 100"/><text x="160" y="124" text-anchor="middle" fill="#68786e" font-size="12">本组均值</text><text x="160" y="163" text-anchor="middle" fill="#253d30" font-size="38">${fmt(s.mean)}</text><text x="23" y="191" fill="#68786e" font-size="12">0</text><text x="295" y="191" text-anchor="end" fill="#68786e" font-size="12">${fmt(scale)}</text></svg><p class="help">${unitText()} · 刻度上限为本组最大值，非评级阈值。</p>`;
 }
 function renderTable(){
  const members=new Set(cohortRows.map(r=>r.row_id));
  displayRows=$('onlyCohort').checked?cohortRows:filtered;
  const pages=Math.max(1,Math.ceil(displayRows.length/PAGE_SIZE));page=Math.min(page,pages-1);
  if(!displayRows.some(r=>r.row_id===selectedId))selectedId=displayRows[0]?.row_id||null;
  $('valueHeader').innerHTML='碳强度<span class="type">'+unitText()+'</span>';
  $('tableCount').textContent=displayRows.length+' 条';
  $('caseRows').innerHTML=displayRows.length?displayRows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(r=>{
   const reasons=reason(r),res=C.result(r,metric(),unit());
   return `<tr class="${selectedId===r.row_id?'selected':''}"><td><input type="checkbox" aria-label="对照 ${escape(r.row_id)}" data-compare="${r.row_id}" ${comparisonIds.has(r.row_id)?'checked':''}></td><td><button class="link" data-detail="${r.row_id}">${escape(r.admin_project_code)}</button><span class="type">${r.row_id}${r.duplicate_code?' · 编号重复':''}</span></td><td>${escape(tr(countries,r.site_country))}<span class="type">${escape(tr(uses,r.bldg_use_subtype))}</span></td><td>${escape(tr(structures,r.bldg_struct_type))}</td><td>${fmt(C.numeric(r.bldg_area_gfa),0)}<span class="type">${escape(r.bldg_area_definition||'口径未提供')}</span></td><td title="${escape(res.reasons.join('；'))}">${fmt(res.value)}${res.value===null?'<span class="type">缺完整证据</span>':''}</td><td><span class="status ${members.has(r.row_id)?'good':''}" title="${escape(reasons.join('；'))}">${members.has(r.row_id)?'当前组':reasons.length?'未入组':'其他同口径组'}</span></td></tr>`;
  }).join(''):'<tr><td colspan="7" class="empty">没有匹配案例。请重置筛选，或取消「列表仅显示本组」。</td></tr>';
  $('pageInfo').textContent=`${displayRows.length?'第 '+(page*PAGE_SIZE+1)+'–'+Math.min((page+1)*PAGE_SIZE,displayRows.length)+' 条 · ':''}${page+1} / ${pages} 页`;
  $('prevPage').disabled=page===0;$('nextPage').disabled=page>=pages-1;
 }
 function renderDetail(){
  const r=rows.find(r=>r.row_id===selectedId);$('caseDetail').hidden=!r;if(!r)return;
  const res=C.result(r,metric(),unit()),why=reason(r),factor=unit()==='period'?C.numeric(r.lca_RSP):1;
  const detailMeta=[['国家',tr(countries,r.site_country)],['用途',tr(uses,r.bldg_use_subtype)],['结构',tr(structures,r.bldg_struct_type)],['地上层数',fmt(C.numeric(r.bldg_floors_ag),0)],['建筑总面积',fmt(C.numeric(r.bldg_area_gfa),0)+' m²'],['面积口径',r.bldg_area_definition],['研究年限',r.lca_RSP+' 年'],['数据库 / 软件',r.lca_database+' / '+r.lca_software]];
  const stages=[['A123','A1–A3'],['A45','A4–A5'],['B1234','B1–B4'],['B5','B5'],['B67','B6–B7'],['C12','C1–C2'],['C34','C3–C4'],['D','D（单列）']];
  const stagesHtml=stages.map(([code,label])=>{const s=C.stage(r,code);return `<div class="stage"><small>${label}</small><b>${s&&factor>0?fmt(s.value*factor):'—'}</b><small>${unitText()}</small><small>${escape(C.stageStatus(r,code))}</small></div>`;}).join('');
  $('caseDetail').innerHTML=`<div class="panelhead"><h2>${escape(r.admin_project_code)} · 案例依据</h2><span class="pill">${r.row_id} / 特征表第 ${r.source_line} 行</span></div><div class="${why.length?'warning':'positive'}">${why.length?'未纳入同口径统计：'+escape(why.join('；')):'通过本页字段匹配检查；仍需核实专业假设，不代表案例完全等效。'}</div><div class="detail-meta">${detailMeta.map(([a,b])=>`<div><span>${escape(a)}</span><b>${escape(b||'未提供')}</b></div>`).join('')}</div><h3>阶段数值 · ${unitText()}</h3><div class="detail-results">${stagesHtml}</div><h3>当前选择：${C.METRICS[metric()].label} = ${fmt(res.value)} ${unitText()}</h3><div class="audit"><b>数值证据</b><ul>${res.steps.map(s=>`<li>${escape(s.formula)} = ${fmt(s.value,5)} kg CO₂e/m²/年</li>`).join('')}${res.reasons.map(s=>'<li>'+escape(s)+'</li>').join('')}</ul>${unit()==='period'?'<p>上述年化结果相加 × '+escape(r.lca_RSP||'未提供')+' 年。没有重新模拟生命周期。</p>':''}<p>特征表中的 A1–A3 原字段：${fmt(r.featured.GHG_A123_m2a,5)}；C3–C4：${fmt(r.featured.GHG_C34_m2a,5)}（均为 kg CO₂e/m²/年，仅供回查，不直接覆盖上面的完整证据规则）。</p><p><a target="_blank" rel="noopener" href="${dataset.meta.source_url}">打开特征数据表</a> · 搜索 ${escape(r.admin_project_code)}，第 ${r.source_line} 行。${r.evidence_line?`<a target="_blank" rel="noopener" href="${dataset.meta.evidence_url}">汇总前证据表</a>第 ${r.evidence_line} 行。`:'汇总前记录关联不唯一。'}</p><details><summary>查看构件与生命周期纳入清单</summary><p>${C.PARTS.map((k,i)=>partNames[i]+': '+escape(r['scope_parts_'+k]||'未提供')).join('；')}</p><p>${Object.keys(r).filter(k=>k.startsWith('scope_LCS_')).map(k=>k.replace('scope_LCS_','')+': '+escape(r[k]||'未提供')).join('；')}</p><p>D 处理：${escape(r.scope_handling_D||'未提供')}；脱碳情景：${escape(r.lca_scenarios_decarbonisation||'未提供')}</p></details></div>`;
  const reportedTotal=C.result(r,'embodied',unit());
  const totalNote=document.createElement('div');totalNote.className='positive';
  totalNote.textContent=reportedTotal.value===null?'原记录隐含碳合计：未提供完整数值。':`原记录隐含碳合计：${fmt(reportedTotal.value)} ${unitText()}。这是原研究范围的合计，不代表各阶段明细齐全，也不代表完整全生命周期。`;
  $('caseDetail').querySelector('.detail-results').before(totalNote);
  if(r.admin_project_code==='PORR_18'){
   const note=document.createElement('p');note.className='warning';
   note.textContent='已回查原始 Excel：阶段明细与材料用量仍缺失。未用估算覆盖此案例。';
   const link=document.createElement('a');link.href='material-check.html';link.textContent=' 查看原始资料追查与内部计算校验';note.append(link);totalNote.after(note);
  }
 }
 function renderComparison(){
  const rs=rows.filter(r=>comparisonIds.has(r.row_id));if(!rs.length){$('comparisonContent').innerHTML='<p class="help">在列表中勾选最多 3 条，或点击「选取本组前 2 条对照」。</p>';return;}
  const compatible=rs.length>=2&&rs.every(r=>reason(r).length===0)&&new Set(rs.map(r=>C.key(r,metric()))).size===1;
  const dims=[['国家',r=>tr(countries,r.site_country)],['用途',r=>tr(uses,r.bldg_use_subtype)],['结构',r=>tr(structures,r.bldg_struct_type)],['建筑总面积 m²',r=>fmt(C.numeric(r.bldg_area_gfa),0)],['面积口径',r=>r.bldg_area_definition||'未提供'],['研究年限',r=>r.lca_RSP+' 年'],['构件范围',r=>r.scope_parts],['数据库 / 软件',r=>r.lca_database+' / '+r.lca_software],[C.METRICS[metric()].label+' · '+unitText(),r=>fmt(value(r))],['纳入检查',r=>reason(r).join('；')||'通过字段检查']];
  let message=rs.length<2?'还需选择 1 条案例。':compatible?'当前选择属于同口径组，可以查看描述性差异。结构、面积与其他性能条件仍可能不同，差异不能直接视为某个设计措施的减碳效果。':'所选记录缺关键证据或口径不同，仅展示资料，不计算差值、百分比或排名。请使用同口径组重新选择。';
  if(compatible){const delta=value(rs[1])-value(rs[0]);message+=` ${rs[1].admin_project_code} 相对 ${rs[0].admin_project_code} 的数值差为 ${delta>=0?'+':''}${fmt(delta)} ${unitText()}。`;}
  $('comparisonContent').innerHTML=`<div class="${compatible?'positive':'warning'}">${escape(message)}</div><div class="tablewrap"><table class="comparison-table"><thead><tr><th>比较项目</th>${rs.map(r=>'<th>'+escape(r.admin_project_code)+'<br>'+r.row_id+'</th>').join('')}</tr></thead><tbody>${dims.map(([name,fn])=>'<tr><td>'+escape(name)+'</td>'+rs.map(r=>'<td>'+escape(fn(r))+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`;
 }
 function exportResults(){
  const output={schema:'carbonloop-euecb-v1',exported_at:new Date().toISOString(),source:dataset.meta,metric:C.METRICS[metric()],unit:unitText(),filters:{country:$('country').value,subtype:$('sector').value,structure:$('structure').value,search:$('search').value},cohort:{key:cohortKey,row_ids:cohortRows.map(r=>r.row_id),statistics:C.stats(cohortRows.map(value))},comparison_row_ids:[...comparisonIds],rules:'Complete evidence only; exact metadata cohort; duplicate codes excluded from statistics; no missing-to-zero; D separate; no causal/industry claims.',records:filtered.map(r=>({row_id:r.row_id,project_code:r.admin_project_code,country:r.site_country,value:value(r),unit:unitText(),result_evidence:C.result(r,metric(),unit()),comparison_exclusions:reason(r),in_active_cohort:cohortRows.includes(r),source_record:r}))};
  window.CarbonExcel.cases(output);
 }
 try{
  const response=await fetch('data/euecb.json',{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);
  dataset=await response.json();rows=dataset.records;if(!Array.isArray(rows)||!rows.length)throw new Error('数据文件为空');
  options('country','site_country',countries);options('sector','bldg_use_subtype',uses);options('structure','bldg_struct_type',structures);
  $('app').hidden=false;$('loadStatus').textContent=`已载入 ${rows.length} 条公开记录。筛选用于浏览；均值与图表只统计所选同口径组，缺失值不按零处理。`;
  $('sourceInfo').innerHTML=`Röck & Sorensen (2022)，${rows.length} 条记录 / ${dataset.meta.unique_project_codes} 个不同项目编号。版本 ${dataset.meta.commit.slice(0,12)}。<a target="_blank" rel="noopener" href="${dataset.meta.source_url}">特征数据表</a> · <a target="_blank" rel="noopener" href="${dataset.meta.evidence_url}">汇总前证据表</a>。获取日期 ${dataset.meta.retrieved_at.slice(0,10)}。`;
  ['country','sector','structure','scope'].forEach(id=>$(id).addEventListener('change',()=>refresh()));
  $('search').addEventListener('input',()=>refresh());$('unit').addEventListener('change',()=>render());
  $('cohort').addEventListener('change',()=>{const g=groupList[Number($('cohort').value)];cohortRows=g?.rows||[];cohortKey=g?.key||'';page=0;render();});
  $('onlyCohort').addEventListener('change',()=>{page=0;render();});
  $('resetFilters').addEventListener('click',()=>{['country','sector','structure'].forEach(id=>$(id).value='*');$('search').value='';$('onlyCohort').checked=false;comparisonIds.clear();cohortKey='';refresh();});
  $('countryDistribution').addEventListener('click',e=>{const b=e.target.closest('[data-country]');if(b){$('country').value=b.dataset.country;refresh();}});
  $('caseRows').addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(b){selectedId=b.dataset.detail;renderTable();renderDetail();$('caseDetail').scrollIntoView({behavior:'smooth',block:'start'});}});
  $('caseRows').addEventListener('change',e=>{const id=e.target.dataset.compare;if(!id)return;if(e.target.checked){if(comparisonIds.size>=3){e.target.checked=false;$('loadStatus').textContent='最多同时对照 3 条。请先取消一条，或清空已选对照。';return;}comparisonIds.add(id);}else comparisonIds.delete(id);renderComparison();});
  $('pickPair').addEventListener('click',()=>{comparisonIds=new Set(cohortRows.slice(0,2).map(r=>r.row_id));$('onlyCohort').checked=true;selectedId=cohortRows[0]?.row_id;page=0;render();$('comparison').scrollIntoView({behavior:'smooth',block:'start'});});
  $('clearCompare').addEventListener('click',()=>{comparisonIds.clear();renderTable();renderComparison();});
  $('prevPage').addEventListener('click',()=>{page--;renderTable();});$('nextPage').addEventListener('click',()=>{page++;renderTable();});
  $('exportBtn').addEventListener('click',exportResults);
  window.CarbonLoopData={snapshot:()=>({filtered:filtered.map(r=>r.row_id),cohort:cohortRows.map(r=>r.row_id),metric:metric(),unit:unit(),selected:[...comparisonIds]}),getDataset:()=>dataset};
  refresh();
 }catch(error){$('loadStatus').className='notice error';$('loadStatus').textContent='数据未能载入。请确认本地服务仍在运行，然后刷新页面。没有使用演示数据替代。错误：'+error.message;$('app').hidden=true;console.error(error);}
})();
