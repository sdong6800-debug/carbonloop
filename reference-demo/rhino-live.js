(function(){
 'use strict';
 const endpoint='http://127.0.0.1:8515',topStatus=document.querySelector('.page-heading .status');
 // Start each page load from revision 0 so refreshing/reopening the workbench
 // restores the latest Rhino payload. Session storage must not suppress the
 // import when the page's in-memory model has been reset.
 let lastMessageKey='',bridgeSeen=false,connectedOnce=false;
 function status(text,state){if(!topStatus)return;topStatus.textContent='● '+text;topStatus.dataset.rhinoState=state;}
 async function poll(){
  try{
   const response=await fetch(endpoint+'/rhino-intake/latest',{cache:'no-store'});if(!response.ok)throw Error('bridge_error');
   bridgeSeen=true;const message=await response.json();
   if(!message.available){status(connectedOnce?'Rhino 已重连 · 等待发送模型':'Rhino 已连接 · 等待首次发送','waiting');return;}
   const messageKey=message.payload?.source?.transmissionId||`${message.revision}|${message.receivedAt||''}`;
   if(messageKey!==lastMessageKey){
    const result=window.ModelEntry?.acceptRhino(message.payload);
    if(!result?.valid){status('Rhino 数据校验失败','error');return;}
    lastMessageKey=messageKey;
   }
   const receivedCount=message.validation?.metadata?.receivedCount
    ??(Array.isArray(message.payload?.objects)?message.payload.objects.length:0);
   const automatic=message.payload?.source?.syncMode==='automatic';
   connectedOnce=true;
   status(`Rhino 已连接 · ${receivedCount} 个对象${automatic?' · 已自动同步':''}`,'connected');
  }catch{if(bridgeSeen)bridgeSeen=false;status(connectedOnce?'Rhino 连接中断 · 正在自动重连':'正在连接 Rhino 插件…','offline');}
 }
 poll();setInterval(poll,2000);
 window.CarbonRhinoLive={poll,endpoint};
})();
