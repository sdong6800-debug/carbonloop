/* Presentation/validation layer. The supplied reference compute() is unchanged. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  document.documentElement.lang = 'zh-CN';
  document.documentElement.dataset.theme = 'dark';
  document.title = 'CarbonLoop · 木材碳时间线';
  const nav = document.createElement('nav');
  nav.className = 'ref-nav'; nav.setAttribute('aria-label','页面导航');
  nav.innerHTML = '<strong>CarbonLoop</strong><a href="demo.html">我的模型</a><a class="current" href="index.html" aria-current="page">01 木材时间线</a><a href="dashboard.html">02 案例看板</a><button class="btn" id="resetAll" type="button">恢复默认</button><button class="btn" id="downloadResult" type="button">导出结果 ↓</button>';
  document.querySelector('.page').prepend(nav);
  const warning=document.createElement('div'); warning.id='validationNotice'; warning.className='validation-note';warning.setAttribute('role','alert');warning.hidden=true;
  document.querySelector('.results').prepend(warning);
  $('reclaimToggle').setAttribute('aria-label','寿命结束后回收材料');
  $('seqToggle').setAttribute('aria-label','森林再生碳吸收情境');
  $('inputForm').addEventListener('submit',e=>e.preventDefault());
  const dict={
    'Life-cycle assessment · engineered timber':'生命周期情境 · 工程木材',
    'Timber Carbon Timeline':'木材碳时间线',
    'Models the carbon stored in an engineered-timber product cascade and when it is released back to the atmosphere, from manufacturing through reclamation and reuse.':'调整木材去向与回收情境，观察制造、释放和假设的森林碳吸收如何改变时间线。',
    'x: years (0–200) · y: kg CO₂ / m³ timber (−1000…+1000)':'横轴：0–200 年 · 纵轴：kg CO₂ / m³ 木材',
    '1 · Virgin cascade':'1 · 初次加工的材料去向',
    'Share of harvested wood entering each product stream.':'各类产品占采伐木材的比例；合计应为 100%。',
    'Glulam (lamellae)':'胶合木 Glulam','Glulam':'胶合木','Lumber':'锯材 Lumber','Paper':'纸制品 Paper','Sawdust':'锯末 Sawdust','Offcuts':'边角料 Offcuts','Shrinkage':'损耗','(untracked)':'（未继续追踪）',
    'Reset to default cascade':'恢复默认比例','Offcuts handling':'边角料的处理方式','Burned':'焚烧','Building material':'作为建材',
    'shredded to sawdust — uses sawdust factors':'粉碎处理，采用锯末系数','used as-is — uses lumber factors':'直接用作材料，采用锯材系数',
    '2 · Reclaim material at end of life':'2 · 寿命结束后回收材料',
    'Adds a second life cycle: remanufacturing, reuse cascade, reclaimed release.':'开启第二轮情境：再加工、再利用分配与最终释放。',
    'Reclaimed cascade':'回收材料的分配','Reclaimed wood':'回收木材','Offcuts handling (reclaimed)':'回收边角料的处理方式',
    'shredded to sawdust':'粉碎为锯末','used as-is':'直接用作材料','Remanufacturing — transport':'再加工 · 运输','Distance travelled':'运输距离',
    'Remanufacturing — energy mix':'再加工 · 电力来源','Remanufacturing country':'再加工所在国家','Grid carbon intensity':'电力碳强度',
    'Remanufacturing — energy consumption':'再加工 · 能源用量','Energy consumed':'能源消耗','3 · Sequestration':'3 · 森林再生碳吸收情境',
    'Forest regrowth offsetting biogenic carbon released at end of life.':'模拟森林再生吸收对寿命末端生物源碳释放的抵减。',
    'Manufacturing footprint':'初次制造排放','kg CO₂ / m³, locked in at year 1':'kg CO₂/m³ · 第 1 年计入',
    'Peak stored':'曲线最低净值','Peak released':'曲线最高净值','Balance at year 200':'第 200 年净值','net residual footprint':'情境累计净值 · kg CO₂/m³',
    'Carbon timeline':'碳时间线','Step chart — value holds until the next event':'阶梯曲线：两次事件之间数值保持不变',
    'Released to atmosphere':'正净值区域','Stored / sequestered':'负净值区域','Carbon-neutral baseline':'零值参考线',
    'Computed breakdown':'计算明细','Every term feeding the timeline above':'对照每一项输入与公式','Term':'项目','Formula':'公式',
    'Manufacturing — year 1':'制造 · 第 1 年','First-life release — years 2, 7, 60':'第一轮释放 · 第 2、7、60 年',
    'Remanufacturing — year 61':'再加工 · 第 61 年','Second-life release — years 62, 120':'第二轮释放 · 第 62、120 年',
    'sum of the releases above':'上述释放项之和','never goes net-negative':'该情境曲线未低于零','Sequestration':'碳吸收假设','Sequestration (off)':'碳吸收假设（关闭）',
    'New sequestration':'第二轮碳吸收假设','New sequestration (off)':'第二轮碳吸收假设（关闭）',
    'Custom value…':'自定义数值…','Remanufacturing energy':'再加工：能源＋运输',
    'Release of sawdust':'锯末释放','Release of paper':'纸制品释放','Release of gluelam':'胶合木释放','Release of lumber':'锯材释放',
    'Release of new sawdust':'第二轮锯末释放','Release of reclaimed timber':'回收木材释放','New sawdust (manufacturing)':'第二轮锯末加工'
  };
  const countries={'Sweden':'瑞典','Norway':'挪威','Iceland':'冰岛','France':'法国','Switzerland':'瑞士','Finland':'芬兰','Denmark':'丹麦','Brazil':'巴西','Canada':'加拿大','Spain':'西班牙','Austria':'奥地利','United Kingdom':'英国','Belgium':'比利时','Netherlands':'荷兰','Germany':'德国','Italy':'意大利','United States':'美国','Russia':'俄罗斯','Mexico':'墨西哥','South Korea':'韩国','Japan':'日本','Australia':'澳大利亚','World average':'全球平均','China':'中国','Poland':'波兰','India':'印度','South Africa':'南非'};
  function translate(){
    const walker=document.createTreeWalker(document.querySelector('.layout'),NodeFilter.SHOW_TEXT);const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.push(...document.querySelector('.masthead').querySelectorAll('h1,p,.unit-tag'));
    for(const node of nodes){const text=node.textContent.trim();let translated=dict[text];
      if(!translated && /^reached at year \d+$/.test(text))translated='出现于第 '+text.match(/\d+/)[0]+' 年';
      if(!translated && text.startsWith('Offcuts ('))translated=text.includes('burned')?'边角料（焚烧）':'边角料（建材）';
      if(!translated && text.startsWith('Release of offcuts ('))translated=text.includes('burned')?'边角料释放（焚烧）':'边角料释放（建材）';
      if(!translated && text.startsWith('Release of new offcuts ('))translated=text.includes('burned')?'第二轮边角料释放（焚烧）':'第二轮边角料释放（建材）';
      if(!translated && text.startsWith('New offcuts ('))translated=text.includes('burned')?'第二轮边角料加工（焚烧）':'第二轮边角料加工（建材）';
      if(translated)node.textContent=translated;
    }
    for(const opt of $('countrySelect').options){const country=opt.textContent.split('  ·  ')[0];if(countries[country])opt.textContent=opt.textContent.replace(country,countries[country]+' / '+country);}
  }
  function validate(){
    const s=window.TimberReference.snapshot();const problems=[];
    const relevant=[...document.querySelectorAll('#inputForm input')].filter(el=>el.getClientRects().length>0);
    for(const el of relevant){const invalid=el.value.trim()===''||!Number.isFinite(el.valueAsNumber)||!el.checkValidity();el.setAttribute('aria-invalid',String(invalid));if(invalid)problems.push('请输入有效的非负数；材料比例须在 0–100% 之间。');}
    const total=Object.values(s.inputs.virgin).reduce((a,b)=>a+b,0);
    if(Math.abs(total-100)>=.05)problems.push('初次加工的材料比例合计需为 100%，当前为 '+Number(total.toFixed(2))+'%。');
    const rTotal=Object.values(s.inputs.reclaimed).reduce((a,b)=>a+b,0);
    if(s.inputs.reclaim&&Math.abs(rTotal-100)>=.05)problems.push('回收材料的比例合计需为 100%。');
    const invalid=problems.length>0;
    document.querySelector('.results').classList.toggle('invalid',invalid);
    $('downloadResult').disabled=invalid;
    const clipped=s.result.points.some(p=>Math.abs(p.y)>1000);
    warning.hidden=!invalid&&!clipped;
    warning.textContent=invalid?[...new Set(problems)].join(' ')+' 结果已暂停显示，修正后自动恢复。':clipped?'结果超过图表的 ±1000 纵轴范围，图线会被截断；请以计算明细和导出数值为准。':'';
    return !invalid;
  }
  function update(){translate();validate();}
  $('inputForm').addEventListener('input',update);$('inputForm').addEventListener('change',update);$('inputForm').addEventListener('click',update);
  $('resetAll').addEventListener('click',()=>location.reload());
  $('downloadResult').addEventListener('click',()=>{if(!validate())return;window.CarbonExcel.timber(window.TimberReference.snapshot());});
  const method=document.createElement('details');method.className='reference-method';method.innerHTML='<summary>计算说明</summary><ul><li>功能单位：每立方米木材。时间范围：200 年。本工具为木材情境分析，不是整栋建筑的完整生命周期核算。</li><li>固定事件年份：1、2、7、50、60 年；开启回收后增加 61、62、110、120 年。</li><li>曲线最低净值表示累计曲线的最低点，不等于实测储碳量；负值不构成负碳认证。</li><li>回收情境在第 60 年计入首轮木材释放，再进入第二轮。该碳平衡、森林吸收假设及部分材料因子尚待验证，不用于正式工程决策。</li><li>电力因子包含 CO₂ / CO₂e 口径差异，正式应用前需统一。</li></ul>';
  document.querySelector('footer').before(method);
  document.querySelector('footer').innerHTML='<p><strong>计算公式。</strong>制造：胶合木、锯材 = 比例 × 122 / 100；纸制品 = 比例 × 500 / 100；锯末及焚烧边角料 = 比例 × 30 / 100；建材边角料 = 比例 × 122 / 100。释放：锯末及焚烧边角料 = 比例 × 234 / 100；纸制品 = 比例 × 825 / 100；胶合木、锯材及建材边角料 = 比例 × 678 / 100。碳吸收假设 = 同轮各释放项之和。</p><p><strong>再加工。</strong>能源消耗（MJ）× 电力碳强度（g/kWh）÷ 3600 ＋ 运输距离（km）× 0.015。所有结果按每立方米木材计。</p><p><strong>电力碳强度数据。</strong>国家数据：<a href="https://lowcarbonpower.org/ranking?metric=ci" target="_blank" rel="noopener">LowCarbonPower（2024–2025）</a>及<a href="https://lowcarbonpower.org/region/Iceland" target="_blank" rel="noopener">冰岛数据</a>；全球平均：<a href="https://www.iea.org/reports/electricity-2025/emissions" target="_blank" rel="noopener">IEA《Electricity 2025》</a>，采用 2024 年的 445 gCO₂/kWh。此处为模型内置数值，并非实时更新。</p>';
  update();
})();
