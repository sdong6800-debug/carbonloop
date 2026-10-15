'use strict';

// Provider-compatible extraction for Responses API output. This remains strict
// about the JSON value itself; it only tolerates harmless transport wrappers
// such as a top-level output_text field or a single Markdown JSON fence.
function outputText(data){
 if(typeof data?.output_text==='string')return data.output_text;
 const parts=[];
 for(const item of data?.output||[]){
  if(typeof item?.output_text==='string')parts.push(item.output_text);
  for(const content of item?.content||[]){
   if(['output_text','text'].includes(content?.type)&&typeof content.text==='string')parts.push(content.text);
  }
 }
 return parts.join('');
}

function fenced(text){
 const match=text.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
 return match?match[1]:text;
}

function firstObject(text){
 let start=-1,depth=0,inString=false,escape=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(start<0){if(ch==='{'){start=i;depth=1;}continue;}
  if(inString){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')inString=false;continue;}
  if(ch==='"'){inString=true;continue;}
  if(ch==='{')depth++;
  else if(ch==='}'&&--depth===0)return text.slice(start,i+1);
 }
 return '';
}

function parseResponseJson(data){
 const text=outputText(data).trim();
 if(!text)throw Error('empty_output');
 const candidates=[text,fenced(text),firstObject(text)].filter((value,index,list)=>value&&list.indexOf(value)===index);
 for(const value of candidates){try{return JSON.parse(value);}catch{}}
 throw Error('invalid_json');
}

module.exports={outputText,parseResponseJson};
