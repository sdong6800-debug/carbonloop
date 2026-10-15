/* CarbonLoop comparison rules. Dataset-derived outputs: CC BY-SA 4.0. */
(function(root){
  'use strict';
  const numeric=v=>v===null||v===undefined||String(v).trim()===''?null:(Number.isFinite(Number(v))?Number(v):null);
  const known=v=>Boolean(v)&&!['No data','Other','n/a','nan'].includes(v);
  const PARTS=['1_ground','2_structure','3_secondary','4_finishes','5_mechanical','6_electrical','6+_renewables','7_facilities','8_fittings'];
  const METRICS={
    reference:{label:'A1–A3 + C3–C4',description:'材料生产 + 废物处理与处置',groups:['A123','C34']},
    production:{label:'A1–A3',description:'材料生产阶段',groups:['A123']},
    upfront:{label:'A1–A5',description:'生产、运输与施工',groups:['A123','A45']},
    end:{label:'C3–C4',description:'废物处理与处置',groups:['C34']},
    embodied:{label:'原记录隐含碳合计',description:'仅在原记录阶段清单一致时比较，不称作完整全生命周期',groups:['sum_em']}
  };
  const COMPONENTS={A123:['A1','A2','A3'],A45:['A4','A5'],B1234:['B1','B2','B3','B4'],B67:['B6','B7'],C12:['C1','C2'],C34:['C3','C4']};
  function sourceValue(r,stage){
    const reported=r.reported||{}, field='GHG_'+stage+'_m2a';
    const n=numeric(reported[field]);
    if(n!==null)return {value:n,fields:[field],formula:field+'（原记录年化值）'};
    const totalField='GHG_'+stage, total=numeric(reported[totalField]);
    const context=r.evidence_context||r;
    const area=numeric(context.bldg_area_gfa),years=numeric(context.lca_RSP);
    if(total!==null&&area>0&&years>0)return{value:total/area/years,fields:[totalField,'bldg_area_gfa','lca_RSP'],formula:totalField+' ÷ 建筑总面积 ÷ 研究年限'};
    return null;
  }
  function stage(r,name){
    const direct=sourceValue(r,name);if(direct)return direct;
    const parts=COMPONENTS[name];if(!parts)return null;
    const vals=parts.map(p=>sourceValue(r,p));
    if(vals.some(v=>v===null))return null;
    return {value:vals.reduce((a,b)=>a+b.value,0),fields:vals.flatMap(v=>v.fields),formula:parts.map(p=>'GHG_'+p).join(' + ')+'（全部分项齐全，统一年化后相加）'};
  }
  function flagsFor(group){return group==='A123'?['A123']:COMPONENTS[group]||[group];}
  function stageStatus(r,name){
    const flags=flagsFor(name).map(k=>r['scope_LCS_'+k]);
    if(flags.every(v=>v==='No'))return '原研究未纳入（不是零）';
    if(stage(r,name))return flags.some(v=>v!=='Yes')?'有报告数值；纳入范围需核对':'原记录完整汇总 / 分项';
    if(flags.every(v=>v==='Yes'))return '已纳入；缺分项或汇总值';
    if(flags.some(v=>v==='Yes'))return '部分阶段纳入；无完整数值';
    return '范围或数值未明确；不能当成零';
  }
  function result(r,metric='reference',unit='annual'){
    const groups=METRICS[metric].groups, reasons=[];
    if(!r.evidence_line)reasons.push('原记录无法唯一关联');
    if(metric!=='embodied')for(const g of groups)for(const s of flagsFor(g))if(r['scope_LCS_'+s]!=='Yes')reasons.push(s+' 未明确纳入');
    const vals=groups.map(g=>stage(r,g));
    groups.forEach((g,i)=>{if(vals[i]===null)reasons.push(g+' 缺完整分项或汇总值');});
    const years=numeric(r.lca_RSP);
    if(unit==='period'&&!(years>0))reasons.push('缺研究年限，不能换算');
    return {value:reasons.length?null:vals.reduce((a,b)=>a+b.value,0)*(unit==='period'?years:1),reasons:[...new Set(reasons)],steps:vals.filter(Boolean),groups};
  }
  function eligibility(r,metric){
    const reasons=[...result(r,metric).reasons];
    if(r.duplicate_code)reasons.push('项目编号重复，暂不纳入统计');
    for(const [key,label] of [['bldg_area_definition','面积口径'],['site_country','国家'],['bldg_use_subtype','用途细类'],['lca_database','碳因子数据库'],['lca_software','评估软件'],['bldg_project_status','项目状态']])if(!known(r[key]))reasons.push(label+' 未明确');
    if(!(numeric(r.lca_RSP)>0))reasons.push('研究年限未明确');
    if(PARTS.some(k=>!['Yes','No'].includes(r['scope_parts_'+k])))reasons.push('构件范围不完整');
    if(metric==='embodied'&&Object.keys(r).filter(k=>k.startsWith('scope_LCS_')).some(k=>!['Yes','No'].includes(r[k])))reasons.push('生命周期阶段清单不完整');
    if(metric==='embodied'&&r.scope_handling_D!=='separately considered'&&r.scope_LCS_D==='Yes')reasons.push('D 是否独立于合计未明确');
    return [...new Set(reasons)];
  }
  function key(r,metric){
    const dims=['site_country','bldg_use_subtype','bldg_area_definition','lca_RSP','lca_database','lca_software','bldg_project_status','lca_scenarios_decarbonisation',...PARTS.map(p=>'scope_parts_'+p)];
    if(metric==='embodied')dims.push(...Object.keys(r).filter(k=>k.startsWith('scope_LCS_')).sort(),'scope_handling_D');
    return JSON.stringify(dims.map(k=>r[k]||''));
  }
  function cohorts(rows,metric){
    const groups=new Map();
    for(const r of rows){if(eligibility(r,metric).length)continue;const k=key(r,metric);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
    return [...groups].map(([key,rows])=>({key,rows})).sort((a,b)=>b.rows.length-a.rows.length||a.key.localeCompare(b.key));
  }
  function stats(values){
    if(!values.length)return {n:0,mean:null,median:null,min:null,max:null};
    const s=[...values].sort((a,b)=>a-b),m=(s.length-1)/2;
    return {n:s.length,mean:s.reduce((a,b)=>a+b,0)/s.length,median:(s[Math.floor(m)]+s[Math.ceil(m)])/2,min:s[0],max:s[s.length-1]};
  }
  const api={numeric,known,PARTS,METRICS,stage,stageStatus,result,eligibility,key,cohorts,stats};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EUECB=api;
})(typeof window!=='undefined'?window:globalThis);
