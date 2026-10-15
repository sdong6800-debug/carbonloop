'use strict';

const raw=require('./chunks.json');
const allowedChangeTypes=new Set(['thickness_increase','thickness_decrease','material_change','position_change']);

function changeTypes(before,after){
 const types=[];
 if(['x','y','z'].some(k=>before?.[k]!==after?.[k]))types.push('position_change');
 if(Number.isFinite(before?.h)&&Number.isFinite(after?.h)&&before.h!==after.h)types.push(after.h>before.h?'thickness_increase':'thickness_decrease');
 if(before?.material!==after?.material||before?.factorId!==after?.factorId)types.push('material_change');
 return types;
}

function explicitForeignJurisdiction(project={}){
 const value=String(project.country||project.jurisdiction||'').trim().toUpperCase();
 return value&&value!=='AU'&&value!=='AUSTRALIA';
}

function tokens(value){
 return new Set(String(value||'').toLowerCase().match(/[a-z0-9\u4e00-\u9fff]+/g)||[]);
}

function score(chunk,context){
 let value=0;
 if(chunk.elements.includes(context.element))value+=5;
 if(chunk.materials.includes(context.material))value+=4;
 if(chunk.materials.includes('all'))value+=1;
 for(const type of context.change_types)if(chunk.change_types.includes(type))value+=8;
 const queryTokens=tokens(context.query),haystack=tokens([chunk.source_title,chunk.locator,chunk.text].join(' '));
 for(const token of queryTokens)if(haystack.has(token))value+=1;
 if(chunk.authority==='normative_reference')value+=2;
 if(chunk.authority==='workflow_gate')value+=1;
 return value;
}

function retrieve({before,after,project={},query='',limit=6}){
 if(!before||!after||before.id!==after.id)throw Error('结构知识检索的前后构件不匹配。');
 if(explicitForeignJurisdiction(project))return {version:raw.knowledge_base_version,status:'unsupported_jurisdiction',context:{jurisdiction:String(project.country||project.jurisdiction),change_types:changeTypes(before,after)},chunks:[]};
 const changes=changeTypes(before,after).filter(x=>allowedChangeTypes.has(x));
 const context={jurisdiction:'AU',state_or_territory:String(project.state_or_territory||project.region||''),building_class:String(project.building_class||''),approval_date:String(project.approval_date||project.project_approval_date||''),selected_edition:String(project.edition||project.code||''),edition_confirmed:project.edition_confirmed===true,element:after.type||'other',material:after.material||'unknown',change_types:changes,query:String(query||'').slice(0,1000)};
 if(!changes.length)return {version:raw.knowledge_base_version,status:'no_structural_change',context,chunks:[]};
 const candidates=raw.chunks.filter(chunk=>chunk.jurisdictions.includes('AU')&&(chunk.elements.includes(context.element)||chunk.elements.includes('building'))&&(chunk.materials.includes(context.material)||chunk.materials.includes('all'))&&changes.some(type=>chunk.change_types.includes(type)));
 const chunks=candidates.map(chunk=>({...chunk,retrieval_score:score(chunk,context),project_applicability:context.edition_confirmed&&context.state_or_territory&&context.building_class?'selected_project_context':'candidate_reference_only'})).sort((a,b)=>b.retrieval_score-a.retrieval_score||a.id.localeCompare(b.id)).slice(0,Math.max(1,Math.min(10,Number(limit)||6)));
 return {version:raw.knowledge_base_version,status:chunks.length?'retrieved':'no_match',context,chunks};
}

function evidencePacket({before,after,project={},query='',report,sectionCapacity}){
 const retrieval=retrieve({before,after,project,query});
 return {
  schema:'structural-evidence-packet-v1',
  task:'explain_early_design_structural_change',
  project_context:retrieval.context,
  model_facts:report.facts,
  deterministic_calculations:{rulebook:report.screening?.rulebook||null,section_capacity:sectionCapacity||null},
  retrieved_evidence:retrieval.chunks,
  missing_fields:[...(report.missing||[])],
  prohibited_claims:['structural_safety','code_compliance','recommended_safe_dimension','invented_load_or_reinforcement','uncited_normative_claim'],
  retrieval_status:retrieval.status,
  knowledge_base_version:retrieval.version
 };
}

function validateCitations(ids,retrieval){
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('AI 没有返回可核验的结构依据。');
 const allowed=new Set((retrieval?.chunks||[]).map(chunk=>chunk.id));
 if(ids.some(id=>!allowed.has(id)))throw Error('AI 引用了本次检索之外的结构依据，未采用。');
 return true;
}

module.exports={version:raw.knowledge_base_version,chunks:raw.chunks,changeTypes,retrieve,evidencePacket,validateCitations};
