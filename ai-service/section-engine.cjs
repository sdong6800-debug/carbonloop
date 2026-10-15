'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const python=path.join(__dirname,'.venv-structural','Scripts','python.exe');
function available(){return fs.existsSync(python)&&fs.existsSync(path.join(__dirname,'.venv-structural','Lib','site-packages','concreteproperties','__init__.py'));}
async function calculate(before,after,sectionInput,signal){
 if(!sectionInput)return {status:'missing_input',can_adopt:false,tool_available:available(),missing:['混凝土强度','实际配筋与保护层','受弯方向与分析截面','修改后设计内力'],reference:'https://concrete-properties.readthedocs.io/en/stable/user_guide/design_codes/as3600.html'};
 if(!available())return {status:'tool_unavailable',can_adopt:false};
 if(!before||!after||before.id!==after.id||before.material!==after.material||before.l!==after.l||before.w!==after.w||['x','y','z'].some(k=>before[k]!==after[k]))return {status:'unsupported_change',can_adopt:false,error:'当前仅支持同材料、同平面与位置的楼板厚度变化；不沿用旧受力模型判断材料替换或移位。'};
 const payload=JSON.stringify({before,after,sectionInput});if(payload.length>60000)throw Error('结构资料过大');
 return new Promise(resolve=>{let output='',settled=false;const child=spawn(python,[path.join(__dirname,'section-capacity.py')],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,MPLBACKEND:'Agg'}});
  const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);resolve(result);};
  const cancel=()=>{child.kill();finish({status:'cancelled',can_adopt:false});};
  const timer=setTimeout(()=>{child.kill();finish({status:'timeout',can_adopt:false});},45000);
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)return cancel();
  child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>100000)cancel();});child.stderr.on('data',()=>{});
  child.on('error',()=>finish({status:'tool_error',can_adopt:false}));
  child.on('close',()=>{try{finish(JSON.parse(output.trim()));}catch{finish({status:'tool_error',can_adopt:false});}});
  child.stdin.on('error',()=>{});child.stdin.end(payload);
 });
}
module.exports={calculate,available};
