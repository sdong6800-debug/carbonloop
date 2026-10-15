'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const contract=require('../reference-demo/rhino-contract.js');
const host='127.0.0.1';
const port=Number(process.env.CARBONLOOP_RHINO_PORT||8515);
const sitePort=Number(process.env.CARBONLOOP_SITE_PORT||8513);
const siteRoot=path.resolve(__dirname,'../reference-demo');
const maxBytes=8*1024*1024;
let latest=null,revision=0;

function originAllowed(origin){
 if(!origin)return true;
 try{const url=new URL(origin);return ['127.0.0.1','localhost'].includes(url.hostname)&&url.port==='8513';}catch{return false;}
}
function headers(req){
 const origin=req.headers.origin;
 return {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(originAllowed(origin)&&origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})};
}
function send(req,res,status,value){res.writeHead(status,headers(req));res.end(value===undefined?'':JSON.stringify(value));}
function body(req){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){reject(Error('payload_too_large'));req.destroy();return;}chunks.push(chunk);});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(Error('invalid_json'));}});req.on('error',reject);});}

const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(req.method==='OPTIONS'){
  if(!originAllowed(req.headers.origin))return send(req,res,403,{error:'origin_not_allowed'});
  res.writeHead(204,{...headers(req),'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();
 }
 if(req.method==='GET'&&url.pathname==='/health')return send(req,res,200,{service:'CarbonLoop Rhino Bridge',status:'ready',contractVersion:contract.VERSION,latestRevision:latest?.revision||null});
 if(req.method==='GET'&&url.pathname==='/rhino-intake/latest')return send(req,res,200,latest?{available:true,...latest}:{available:false});
 if(req.method==='POST'&&url.pathname==='/rhino-intake/reset'){latest=null;return send(req,res,200,{reset:true});}
 if(req.method==='POST'&&url.pathname==='/rhino-intake'){
  try{
   const payload=await body(req),validation=contract.normalize(payload);
   if(!validation.valid)return send(req,res,422,{accepted:false,errors:validation.errors,warnings:validation.warnings});
   latest={revision:++revision,receivedAt:new Date().toISOString(),payload,validation:{valid:true,warnings:validation.warnings,metadata:validation.metadata}};
   return send(req,res,202,{accepted:true,revision:latest.revision,receivedAt:latest.receivedAt,objectCount:validation.objects.length,warnings:validation.warnings});
  }catch(error){return send(req,res,error.message==='payload_too_large'?413:400,{accepted:false,error:error.message});}
 }
 send(req,res,404,{error:'not_found'});
});
server.listen(port,host,()=>console.log(`CarbonLoop Rhino Bridge ready: http://${host}:${port}`));

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.zip':'application/zip'};
const site=http.createServer((req,res)=>{
 const url=new URL(req.url,`http://${host}`);
 const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'demo.html';
 const target=path.resolve(siteRoot,relative);
 if(target!==siteRoot&&!target.startsWith(siteRoot+path.sep)){res.writeHead(403);return res.end('Forbidden');}
 fs.stat(target,(error,stat)=>{
  if(error||!stat.isFile()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found');}
  res.writeHead(200,{'Content-Type':mime[path.extname(target).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(target).pipe(res);
 });
});
site.on('error',error=>{
 if(error.code==='EADDRINUSE')console.log(`CarbonLoop local site already running: http://${host}:${sitePort}/demo.html`);
 else console.error('CarbonLoop local site failed:',error.message);
});
site.listen(sitePort,host,()=>console.log(`CarbonLoop local site ready: http://${host}:${sitePort}/demo.html`));

