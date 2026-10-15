(function(){
 'use strict';const $=id=>document.getElementById(id);
 const box=document.createElement('div');box.id='solutionAttachment';
 box.innerHTML='<label class="solution-upload" for="solutionImage">＋ 添加截图 <span>选择、拖入，或在要求框里粘贴 · PNG / JPG</span></label><input id="solutionImage" type="file" accept="image/png,image/jpeg"><div id="solutionImagePreview" hidden><img id="solutionImageThumb" alt="本次方案探索的截图预览"><button id="solutionImageRemove" type="button" class="text-button">移除截图</button></div><p id="solutionImageStatus" role="status">可标出想改的位置或需要保留的空间。截图不能代替尺寸、荷载或配筋资料。</p>';
 $('solutionGoal').after(box);
 let data=null,loading=false,revision=0;
 function changed(){document.dispatchEvent(new Event('carbon-solution-image-change'));}
 function clear(){revision++;data=null;loading=false;$('solutionImage').value='';$('solutionImageThumb').removeAttribute('src');$('solutionImagePreview').hidden=true;$('solutionImageStatus').textContent='未附加截图。';changed();}
 async function load(file){
  clear();if(!file)return;const current=revision;
  if(!['image/png','image/jpeg'].includes(file.type)||file.size>2*1024*1024){$('solutionImageStatus').textContent='请选择不超过 2 MB 的 PNG 或 JPG 截图。';return;}
  loading=true;$('solutionImageStatus').textContent='正在读取截图…';changed();
  try{
   const bitmap=await createImageBitmap(file),tooLarge=bitmap.width*bitmap.height>20000000;bitmap.close();if(tooLarge)throw Error('截图像素过大，请缩小后再试。');
   const result=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('截图读取失败'));reader.readAsDataURL(file);});
   if(current!==revision)return;data=result;$('solutionImageThumb').src=result;$('solutionImagePreview').hidden=false;$('solutionImageStatus').textContent='截图已准备好，尚未发送。请确认不含密钥或敏感信息，再勾选 AI 发送选项。';
  }catch(e){if(current===revision)$('solutionImageStatus').textContent='无法读取：'+e.message;}
  finally{if(current===revision){loading=false;changed();}}
 }
 $('solutionImage').onchange=e=>load(e.target.files[0]);$('solutionImageRemove').onclick=clear;
 box.addEventListener('dragover',e=>{e.preventDefault();});
 box.addEventListener('drop',e=>{e.preventDefault();load(e.dataTransfer.files[0]);});
 $('solutionGoal').addEventListener('paste',e=>{const item=[...(e.clipboardData?.items||[])].find(x=>x.kind==='file'&&x.type.startsWith('image/'));if(item){e.preventDefault();load(item.getAsFile());}});
 window.CarbonSolutionAttachment={getData:()=>data,isLoading:()=>loading,clear,markUsed:image=>{if(data&&data===image)$('solutionImageStatus').textContent='这张截图已随本次要求交给 AI；替换或移除后需要重新生成建议。';}};
})();
