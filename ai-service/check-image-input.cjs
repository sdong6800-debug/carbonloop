'use strict';
const assert=require('node:assert/strict'),{validateImage,responseInput}=require('./image-input.cjs'),{generate}=require('./server.cjs'),AI=require('../reference-demo/ai-core.js'),M=require('../reference-demo/material-intake.js');
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOuoAAAAASUVORK5CYII=',config={provider:'deepseek',model:'deepseek-flash',key:'test-only'};
(async()=>{
 assert.equal(validateImage(image,config),image);assert.throws(()=>validateImage(image,{...config,model:'deepseek-v4-pro'}));assert.throws(()=>validateImage('https://example.com/image.png',config));assert.throws(()=>validateImage('data:image/png;base64,YWJj',config));assert.throws(()=>validateImage('data:image/svg+xml;base64,YWJj',config));assert.throws(()=>validateImage('x'.repeat(3000000),config));
 assert.equal(responseInput({},image)[0].content[1].type,'input_image');
 const elements=M.sample().filter(e=>e.floor==='1F').map(e=>({...e,...M.match(e.materialRecord)})),answer=AI.offline(elements);let calls=0;
 const mock=async(url,opts)=>{calls++;const payload=JSON.parse(opts.body);assert.equal(payload.input[0].content[1].image_url,image);const context=JSON.parse(payload.input[0].content[0].text);assert.equal(context.selected_element_id,'S01');assert.equal(context.selected_element.h,.2);assert.equal(context.targets.length,1);return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(answer)}]}]})};};
 await generate({query:'研究当前楼板',elements,selectedElementId:'S01',image},config,mock);
 await assert.rejects(()=>generate({query:'研究',elements,selectedElementId:'C01',image},config,mock));await assert.rejects(()=>generate({query:'研究',elements,selectedElementId:'invented',image},config,mock));assert.equal(calls,1);
 console.log('PASS local image limits/types, vision-model guard, model-linked context, selected target restriction; mocked calls only.');
})().catch(e=>{console.error(e);process.exitCode=1});
