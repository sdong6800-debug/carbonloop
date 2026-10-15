(function(root){
 'use strict';
 const F=typeof module!=='undefined'&&module.exports?require('./material-estimate.js').MATERIALS[0]:root.MaterialEstimate.MATERIALS[0];
 const clone=x=>JSON.parse(JSON.stringify(x));
 // Values transcribed from the official workbook; AA/AB are kg CO2e per kg,
 // F is density (kg/m3). AC is stored carbon (kg C/kg), NOT a GWP credit.
 const factorSource={name:'KBOB/ecobau 2022 v9.0',region:'瑞士市场参考',checked:'2026-10-04',sheet:'Baumaterialien Matériaux',url:'https://www.kbob.admin.ch/de/oekobilanzdaten-im-baubereich',sha256:'9ae2dfecbbc188fa9ed839ddfd1dc62d4ef254e8e5457aa08c42730c78277a5b',unit:'kg CO2e/kg',scope:'来源的生产 AA ＋处置 AB 汇总列；非全生命周期'};
 const factors=[
  ['01.002',38,'Hochbaubeton (ohne Bewehrung)',2300,.0887,.0126,0,'E13EE05E-FD34-4FB5-A178-0FC4164A96F2'],
  ['01.002.13',53,'Hochbaubeton, Q-A230-M10 D E25, 150 kg CEM II/B (ohne Bewehrung)',2367.6,.0559,.0126,0,'2e04ff74-0507-429b-a901-870d3cb40d30'],
  ['06.003',186,'Armierungsstahl',7850,.773,.0122,0,'1F33844F-91D2-4363-B328-904E15110A1C'],
  ['06.012',197,'Stahlprofil, blank',7850,.73,.00693,0,'4DC70979-B6CA-4DA5-A291-6F1A082EE475'],
  ['06.010',195,'Stahlblech, blank',7850,2.79,.00693,0,'38C1572A-3CE8-47C0-B24E-5E924A8AD97E'],
  ['07.003',202,'Brettschichtholz',439,.286,.0492,.446,'75F8C2B2-0B4E-4243-93D6-9D8B721B4D12'],
  ['07.020',207,'Brettsperrholz',436,.316,.0492,.449,'83c72ece-6641-4675-97f0-a6236caf7e7f'],
  ['07.011',221,'Massivholz Fichte / Tanne / Lärche, kammergetr., gehobelt',465,.134,.039,.451,'3D89DC7F-1638-4C94-AFA8-DC31CAC210BC'],
  ['02.001',83,'Backstein',900,.254,.0127,0,'958BA083-03C8-4336-BFC5-0DB5B6BC1B43'],
  ['02.006',91,'Porenbetonstein',500,.413,.0127,0,'406B9ED4-C9C0-41E2-B945-7844C7313250'],
  ['02.007',92,'Zementstein',1700,.114,.0127,0,'69524911-E277-4B29-827D-B8475E4D8C23'],
  ['03.006',102,'Flachglas unbeschichtet',2500,1.12,.0191,0,'8A03A7D4-FB51-48D0-BA86-9D13EE70A0D9'],
  ['03.008',105,'Gipskartonplatte',850,.283,.0187,.018,'38A83C73-92BD-492B-B435-97332A84863E'],
  ['06.002',184,'Aluminiumprofil, blank',2690,5.69,.00792,0,'9D19FB5F-33F0-44B4-9489-B6E224103955'],
  // KBOB row 328 is a 15 mm polished natural-stone plate reported per m².
  // 40.5 kg/m² / 0.015 m = 2700 kg/m³. Dividing AA/AB by 40.5
  // converts the source values to the kg CO2e/kg convention used here.
  ['11.017',328,'Natursteinplatte poliert, 15 mm',2700,19.1/40.5,.514/40.5,0,'09098784-8F4C-4C60-BD8D-39EB2145D8C4']
 ].map(([id,row,original,density,production,disposal,storedCarbon,uuid])=>({id,row,original,density,production,disposal,storedCarbon,uuid,source:factorSource,cells:{density:'F'+row,production:'AA'+row,disposal:'AB'+row,storedCarbon:'AC'+row}}));
 const stone=factors.find(f=>f.id==='11.017');
 Object.assign(stone,{sourceUnit:'m² for a 15 mm plate',sourceMassPerArea:40.5,sourceThickness:.015,conversionNote:'KBOB F328 = 40.5 kg/m²，按 15 mm 厚度换算为 2700 kg/m³；AA328 19.1 与 AB328 0.514 kg CO₂e/m² 分别除以 40.5 kg/m²，换算为当前质量口径。'});
 const mapping={concrete:'01.002','concrete-cast':'01.002','concrete-precast':'01.002',rebar:'06.003','rebar-mesh':'06.003','steel-section':'06.012','steel-tube':'06.012','steel-plate':'06.010','timber-solid':'07.011','timber-glulam':'07.003','timber-clt':'07.020','masonry-clay':'02.001','masonry-aac':'02.006','masonry-concrete':'02.007',glass:'03.006',aluminium:'06.002',gypsum:'03.008','stone-natural-polished':'11.017'};
 const factorFor=id=>factors.find(f=>f.id===mapping[id])||null;
 function factorNote(id){return ({'concrete':'通用、不含钢筋','concrete-cast':'以通用无筋混凝土作早期代理，未匹配强度与配方','concrete-precast':'以通用无筋混凝土作代理，非预制产品 EPD，未体现特定工厂工艺','rebar':'钢筋通用参考，须有独立钢筋数量','rebar-mesh':'钢筋通用代理，未细分焊网加工','steel-section':'裸型钢通用参考，未匹配 S355 牌号与防火涂层','steel-tube':'以裸型钢条目作前期代理；未体现钢管制造、牌号、壁厚和涂层差异','steel-plate':'裸钢板通用参考','timber-solid':'针叶材、窑干刨光参考，树种与工艺待项目确认','timber-glulam':'胶合木通用参考，未匹配 GL28h 产品','timber-clt':'CLT 通用参考，未匹配具体产品','masonry-clay':'瑞士砖材参考密度 900 kg/m³；墙体演示不含砂浆及洞口','masonry-aac':'加气混凝土块通用参考，不含砂浆','masonry-concrete':'水泥砌块通用参考，不含砂浆','glass':'以无镀膜平板玻璃作前期代理；未计中空层、夹胶、镀膜和幕墙框','aluminium':'以裸铝型材作前期代理；未匹配合金、再生含量、表面处理与具体 EPD','gypsum':'Rhino 的 Plaster / Plasterboard 暂以石膏板条目作前期代理；湿抹灰与板材并非同一产品，需人工确认，且未计龙骨、饰面和安装损耗','stone-natural-polished':'KBOB 抛光天然石板 15 mm 参考；Carrara 大理石按天然石材早期代理，未匹配具体矿区与产品 EPD。原始每平方米数据已按 40.5 kg/m² 换算为质量口径。'})[id]||'尚无适用计算条目';}
 // Classification catalogue is deliberately separate from verified calculation factors.
 const materials=[
  ['concrete','混凝土','建筑混凝土（通用，未细分配方）'],['concrete-cast','混凝土','现浇混凝土'],['concrete-precast','混凝土','预制混凝土'],
  ['rebar','钢筋','钢筋'],['rebar-mesh','钢筋','钢筋网'],
  ['steel-section','结构钢','型钢'],['steel-tube','结构钢','钢管'],['steel-plate','结构钢','钢板'],
  ['timber-solid','木材','实木'],['timber-glulam','木材','胶合木'],['timber-clt','木材','交叉层压木板（CLT）'],
  ['masonry-clay','砌体','黏土砖'],['masonry-concrete','砌体','混凝土砌块'],['masonry-aac','砌体','加气混凝土砌块'],
  ['glass','围护与装修','玻璃'],['aluminium','围护与装修','铝材'],['insulation','围护与装修','保温材料'],['gypsum','围护与装修','石膏制品／抹灰（石膏板代理）'],['stone-natural-polished','围护与装修','抛光天然石材（含大理石代理）'],['finish','围护与装修','其他饰面层（待细分）'],
  ['unknown','待核对','未确定材料']
 ].map(([id,group,name])=>({id,group,name,calculable:!!factorFor(id)}));
 const materialInfo=id=>materials.find(m=>m.id===id)||materials[materials.length-1];
 function sample(){return [{id:'S01',name:'楼板',type:'slab',x:0,y:0,z:3,l:6,w:4,h:.2,material:'concrete'},...[[0,0],[5.6,0],[0,3.6],[5.6,3.6]].map(([x,y],i)=>({id:'C0'+(i+1),name:'柱 '+(i+1),type:'column',x,y,z:0,l:.4,w:.4,h:3,material:'concrete'}))];}
 function element(e){
  if(![e.l,e.w,e.h].every(v=>Number.isFinite(v)&&v>0))return {error:'几何尺寸无效',volume:null,value:null};
  const buildingTypes=['slab','column','beam','wall','roof'];
  if(e.quantityRequired&&buildingTypes.includes(e.type)&&Array.isArray(e.sourceDimensions)&&e.sourceDimensions.length===3&&e.sourceDimensions.every(Number.isFinite)&&Math.max(...e.sourceDimensions)<.1)return {error:'构件尺寸异常：最大原始尺寸小于 100 mm，请检查 Rhino 文件单位或建模尺度；本次不按零排放计算',volume:null,value:null};
  let volume=e.l*e.w*e.h,quantityBasis='演示实心长方体：长 × 宽 × 高（非通用模型包围盒算法）';
  const override=e.factorId;
  const allowedOverride=override==='01.002.13'&&['concrete','concrete-cast'].includes(e.material);
  const factor=allowedOverride?factors.find(f=>f.id===override):factorFor(e.material),fail=error=>({error,volume:null,value:null,factor});
  if(override&&!allowedOverride)return fail('候选因子与材料类别不匹配，需重新核对');
  if(!factor)return fail(e.material==='unknown'||!materials.some(m=>m.id===e.material)?'材料未确认':materialInfo(e.material).name+'：计算数据待接入');
  const finishSurface=e.material==='stone-natural-polished'&&(e.type==='finish'||/(^|[:._\-\s])(?:ext\.?\s*)?finish(?:es)?($|[:._\-\s])/i.test(e.layer||''));
  const q=e.quantity;
  if(!q&&e.quantityRequired&&!finishSurface)return fail(e.previewAdjusted?'已识别平面/线性对象；缺真实厚度或材料净量，预览厚度不参与碳计算':'Rhino 对象缺材料净体积，不能用包围盒体积代替实际工程量');
  if(q){
   if(q.material&&q.material!==e.material)return fail('数量依据与材料类别不一致，需重新读取实际材料净量');
   if(Array.isArray(q.dimensions)&&JSON.stringify(q.dimensions)!==JSON.stringify([e.l,e.w,e.h]))return fail('几何已改变，原材料净量失效，需重新读取');
   if(q.kind==='net-volume'&&finishSurface&&Number.isFinite(q.value)&&q.value>0){volume=q.value;quantityBasis=q.basis||'Rhino 壳体净体积（仅作核对，不用于 15 mm 饰面代理）';}
   else if(q.kind==='i-section'){
    const {b,d,tf,tw}=q;
    if(![b,d,tf,tw].every(v=>Number.isFinite(v)&&v>0)||2*tf>=d||tw>=b||b>e.l||d>e.w)return fail('型钢截面尺寸无效');
    volume=(2*b*tf+(d-2*tf)*tw)*e.h;quantityBasis=`演示 I 形截面假设：翼缘 ${b}×${tf} m，两片；腹板高 ${d-2*tf} m、厚 ${tw} m；净截面积 × 柱高。不代表标准型钢型号。`;
   }else if(q.kind==='net-volume'&&Number.isFinite(q.value)&&q.value>0&&q.value<=volume*(1+1e-9)){volume=Math.min(q.value,volume);quantityBasis=q.basis||'声明的材料净体积 m³';}
   else return fail('材料净量格式无效');
  }else if(['steel-section','steel-tube','rebar','rebar-mesh'].includes(e.material))return fail('已有碳因子；缺实际截面或材料净体积，不能用外包尺寸代替');
  // The KBOB natural-stone record is natively a 15 mm plate per m². Imported
  // architectural finish meshes often contain a modelling shell (the current
  // Farnsworth sample is about 1 mm thick), which must not silently replace
  // the product thickness represented by the source record. For an explicitly
  // named finish layer, keep the Rhino volume as an audit value and calculate
  // the early-design proxy directly from surface area × the source's m² data.
  let area=null,modelVolume=null,quantityWarning='';
  if(finishSurface&&factor.sourceMassPerArea&&factor.sourceThickness){
   const dims=(Array.isArray(e.sourceDimensions)&&e.sourceDimensions.length===3?e.sourceDimensions:[e.l,e.w,e.h]).filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>b-a);
   if(dims.length<2)return fail('饰面构件缺有效表面积，暂不能按平方米计算');
   area=dims[0]*dims[1];modelVolume=q?.kind==='net-volume'&&Number.isFinite(q.value)?q.value:null;
   volume=area*factor.sourceThickness;
   quantityBasis=`饰面面积 ${area.toLocaleString('zh-CN',{maximumFractionDigits:4})} m² × KBOB 参考厚度 ${factor.sourceThickness*1000} mm`;
   if(modelVolume&&Math.abs(modelVolume-volume)/volume>.25)quantityWarning=`Rhino 净体积 ${modelVolume.toLocaleString('zh-CN',{maximumFractionDigits:6})} m³ 与 15 mm 来源口径不一致；本次未用该建模壳体积，需核对实际石材厚度。`;
  }
  const mass=area===null?volume*factor.density:area*factor.sourceMassPerArea,production=mass*factor.production,disposal=mass*factor.disposal;
  return {error:null,volume,area,modelVolume,quantityWarning,mass,production,disposal,value:production+disposal,factor,quantityBasis,referenceNote:override?'瑞士特定混凝土配方数据的假设替换；强度、耐久、供应与施工适用性未验证，非等效产品推荐':factorNote(e.material),storedCarbonKgC:mass*factor.storedCarbon};
 }
 function calculate(elements){const lines=elements.map(e=>({...e,...element(e)})),valid=lines.filter(e=>!e.error);return {lines,known:valid.length,total:lines.length,complete:valid.length===lines.length&&lines.length>0,value:valid.length?valid.reduce((s,e)=>s+e.value,0):null,production:valid.reduce((s,e)=>s+e.production,0),disposal:valid.reduce((s,e)=>s+e.disposal,0)};}
 function compare(a,b){const A=calculate(a),B=calculate(b),compatible=A.complete&&B.complete&&a.length===b.length&&a.every(e=>b.some(f=>f.id===e.id));return {A,B,compatible,delta:compatible?B.value-A.value:null,percent:compatible&&A.value!==0?(B.value-A.value)/A.value*100:null};}
 const api={F,factors,factorSource,factorFor,factorNote,materials,materialInfo,clone,sample,element,calculate,compare};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ModelCore=api;
})(typeof window!=='undefined'?window:globalThis);
