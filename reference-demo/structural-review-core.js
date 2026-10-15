(function(root){
 'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./model-core.js'):root.ModelCore;
 const Screening=typeof module!=='undefined'&&module.exports?require('./structural-screening-core.js'):root.StructuralScreening;
 const nccReference='https://www.abcb.gov.au/editions/ncc-2022/adopted/volume-one/b-structure/part-b1-structural-provisions';
 const profile=Object.freeze({country:'AU',label:'澳大利亚 · 混凝土楼板',state_or_territory:null,building_class:null,project_approval_date:null,edition_confirmed:false,clauses_loaded:false,reference_only:true});
 const sources=[
  {id:'au-ncc',title:'NCC · 项目适用要求',url:nccReference,scope:'NCC 2022 Volume One Part B1 的公开参考（该卷为 Class 2–9 建筑）；不是为本项目选定的版本。州或领地、建筑类别、项目审批时间与适用版本待确认。'},
  {id:'au-1170-0',title:'AS/NZS 1170.0 · 设计原则与荷载组合',url:nccReference,scope:'NCC B1D2 引用的一般设计程序。链接是 NCC 引用依据，不是标准全文；尚未加载可执行的荷载组合规则。'},
  {id:'au-1170-1',title:'AS/NZS 1170.1 · 恒荷载与使用荷载',url:nccReference,scope:'NCC B1D3 引用的作用确定依据；项目用途、实际荷载与支承仍需核实。未导入标准全文、荷载表或取值。'},
  {id:'au-3600',title:'AS 3600 · 混凝土结构',url:nccReference,scope:'NCC B1D4 引用的混凝土结构依据。没有加载授权标准全文；另有开源 AS3600:2018 截面抗弯计算接口，需真实工程输入才运行，变形、冲切及完整构造验算尚未接通。不能据此判断楼板整体合格。'}
 ];
 const checks={
  basis:{title:'适用规范与版本',needs:'澳洲州或领地、建筑类别、审批时间与适用规范版本',sourceIds:['au-ncc']},
  analysis:{title:'受力与荷载',needs:'有效跨度、支承、连接、荷载及组合',sourceIds:['au-1170-0','au-1170-1']},
  resistance:{title:'承载能力',needs:'材料力学性能、配筋、分析模型和内力结果',sourceIds:['au-3600']},
  serviceability:{title:'变形与裂缝',needs:'正常使用工况、刚度与长期效应资料',sourceIds:['au-3600']},
  detailing:{title:'构造、耐久与耐火',needs:'保护层、构造及项目耐久和耐火要求',sourceIds:['au-ncc','au-3600']}
 };
 function assess(before,after,project={}){
  if(!before||!after||before.id!==after.id)throw Error('前后构件不匹配');
  const valid=e=>['x','y','z','l','w','h'].every(k=>Number.isFinite(e[k]))&&['l','w','h'].every(k=>e[k]>0);
  if(!valid(before)||!valid(after))throw Error('构件尺寸无效');
  const old=C.element(before),next=C.element(after),changed=JSON.stringify(before)!==JSON.stringify(after),concrete=after.type==='slab'&&['concrete','concrete-cast','concrete-precast'].includes(after.material);
  const thickness=after.type==='slab'?{before_mm:before.h*1000,after_mm:after.h*1000,delta_mm:(after.h-before.h)*1000}:null;
  const rows=Object.entries(checks).filter(([id])=>concrete||['basis','analysis'].includes(id)).map(([id,c])=>({id,...c,sourceIds:concrete?c.sourceIds:[],state:'not_checked'}));
  const comparable=!old.error&&!next.error;
  const facts={element_id:after.id,element_type:after.type,thickness,
   before:{dimensions_m:[before.l,before.w,before.h],material:before.material,volume_m3:old.error?null:old.volume,carbon_kgco2e:old.error?null:old.value},
   after:{dimensions_m:[after.l,after.w,after.h],material:after.material,volume_m3:next.error?null:next.volume,carbon_kgco2e:next.error?null:next.value},
   volume_delta_m3:comparable?next.volume-old.volume:null,volume_percent:comparable&&old.volume>0?(next.volume-old.volume)/old.volume*100:null,
   carbon_delta_kgco2e:comparable?next.value-old.value:null,carbon_percent:comparable&&old.value!==0?(next.value-old.value)/old.value*100:null,
   carbon_boundary:'当前构件，材料生产＋处置；非完整生命周期，非整栋建筑。瑞士 KBOB 因子，不是澳洲碳数据库。',
   carbon_mass_proxy_delta_kg:comparable?next.mass-old.mass:null,quantity_basis:'碳计算数据库密度的材料质量差，不是已核实的结构自重荷载'};
  return {schema:'structural-change-review-v1',status:'not_determined',can_adopt:false,changed,scope_supported:concrete,
   headline:changed?'尺寸或材料已改变，结构可用性尚不能判断':'当前方案也尚未完成结构核验',
   explanation:!concrete?'本轮结构资料只整理了混凝土楼板的检查框架；该构件需相应结构体系依据。':thickness?.delta_mm>0?'楼板加厚不能直接判为更安全，需重新检查自重变化及承载、变形等影响。':thickness?.delta_mm<0?'楼板变薄后，需重新检查承载、变形和构造要求，不能只看减碳量。':'需同时核实材料性能与受力条件，不能根据碳因子判断结构等效。',
   facts,screening:Screening.assess(before,after),checks:rows,project:{region:String(project.region||'').slice(0,120),code:String(project.code||'').slice(0,160),recorded_only:true},
   reference_profile:{...profile},evidence:concrete?sources:[],basis_status:'澳洲规范方向已选择；项目版本待确认，单项截面抗弯工具须有工程输入才运行，不是完整规范核验',
   execution:{llm_called:false,solver_run:false,rulebook_retrieval_run:true,normative_rules_run:false},
   missing:['有效分析模型与构件连接','核实的力学材料及配筋数据','项目荷载、组合和支承条件','确认澳洲州或领地、建筑类别、审批时间与适用规范条款','结构分析及规范验算工具']};
 }
 const api={profile,sources,checks,assess};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StructuralReview=api;
})(typeof window!=='undefined'?window:globalThis);
