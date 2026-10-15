const assert=require('node:assert/strict'),{chromium}=require('playwright'),C=require('./concept-core.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const original=C.defaults(),copy=structuredClone(original),a=C.calculate(copy,copy.schemes[0]);
near(a.area,648);near(a.slabVolume,162);near(a.columnVolume,24.4215);near(a.concrete,186.4215);near(a.carbon,65247.525);assert.equal(a.cost,null);
const b=C.calculate(copy,copy.schemes[1]),c=C.calculate(copy,copy.schemes[2]);near(b.carbon,58520.07);near(c.beamVolume,34.4736);near(c.carbon,65136.798);assert.deepEqual(copy,original);
copy.rates.concreteCost=0;copy.rates.steelCost=0;assert.equal(C.calculate(copy,copy.schemes[0]).cost,0);
copy.rates.concreteCost=100;copy.rates.steelCost=2;near(C.calculate(copy,copy.schemes[0]).cost,55926.45);
copy.rates.steel='';assert.equal(C.calculate(copy,copy.schemes[0]).carbon,null);assert.equal(C.calculate(copy,copy.schemes[0]).concrete,a.concrete);
copy.rates.steel=0;copy.rates.concrete=0;assert.equal(C.calculate(copy,copy.schemes[0]).carbon,0);
for(const [path,value] of [['nx',0],['nx',1.5],['floors',16],['sx',''],['sx',Infinity],['height',-1]]){const x=C.defaults();x.geometry[path]=value;const result=C.calculate(x,x.schemes[0]);assert.equal(result.valid,false);assert.equal(result.carbon,null);}
for(const [field,value] of [['beamWidth',500],['beamDepth',100],['rebar',''],['slab',-1]]){const x=C.defaults();x.schemes[2][field]=value;assert.equal(C.calculate(x,x.schemes[2]).valid,false);}
assert.deepEqual(C.rank([a,b,c],'carbon').map(x=>x.id),['B','C','A']);
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8513/concept.html');assert.ok((await p.locator('#liveCarbon').textContent()).includes('65.25'));
 await p.screenshot({path:'concept-geometry-desktop.png',fullPage:true});
 await p.fill('[data-path="geometry.nx"]','4');assert.ok((await p.locator('#geometrySummary').textContent()).includes('864'));
 await p.reload();assert.equal(await p.inputValue('[data-path="geometry.nx"]'),'4');
 await p.fill('[data-path="geometry.nx"]','');assert.equal(await p.locator('#liveCarbon').textContent(),'—');assert.ok((await p.locator('#preview').textContent()).includes('修正'));
 await p.fill('[data-path="geometry.nx"]','3');await p.click('[data-step="1"]');await p.fill('[data-path="loads.live"]','9');assert.equal(await p.locator('#liveCarbon').textContent(),'65.25');
 await p.click('[data-step="2"]');await p.fill('[data-scheme="1"][data-field="slab"]','200');await p.selectOption('#previewScheme','B');assert.ok((await p.locator('#liveCarbon').textContent())!=='65.25');
 await p.fill('[data-path="rates.steel"]','');assert.equal(await p.locator('#liveCarbon').textContent(),'—');await p.fill('[data-path="rates.steel"]','1');
 await p.fill('[data-path="rates.concreteCost"]','100');await p.fill('[data-path="rates.steelCost"]','2');await p.click('[data-step="3"]');
 assert.ok((await p.locator('#resultTable').textContent()).includes('55,926'));assert.ok((await p.locator('#comparisonText').textContent()).includes('不证明'));
 for(const view of ['section','axon','plan']){await p.click(`[data-view="${view}"]`);assert.ok(await p.locator('#preview').innerHTML());}
 await p.click('[data-select="C"]');assert.equal(await p.inputValue('#previewScheme'),'C');await p.screenshot({path:'concept-results-desktop.png',fullPage:true});
 await p.evaluate(()=>window.print=()=>window.__printed=true);await p.click('#print');assert.equal(await p.evaluate(()=>window.__printed),true);assert.ok((await p.locator('#printReport').textContent()).includes('9 kN/m²'));
 await p.emulateMedia({media:'print'});await p.screenshot({path:'concept-print.png',fullPage:true});await p.emulateMedia({media:'screen'});
 await p.setViewportSize({width:390,height:844});for(let n=0;n<4;n++){await p.click(`[data-step="${n}"]`);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow step ${n}`);}await p.screenshot({path:'concept-mobile.png',fullPage:true});
 await p.click('[data-step="2"]');await p.fill('[data-path="rates.source"]','<img src=x onerror=alert(1)>');assert.equal(await p.locator('#printReport img').count(),0);
 p.once('dialog',d=>d.dismiss());await p.click('#reset');assert.equal(await p.inputValue('[data-path="rates.source"]'),'<img src=x onerror=alert(1)>');
 p.once('dialog',d=>d.accept());await p.click('#reset');assert.equal(await p.inputValue('[data-path="geometry.nx"]'),'3');
 await p.evaluate(()=>localStorage.setItem('carbonloop-concept-study-v1','{"version":1,"geometry":{}}'));await p.reload();assert.equal(await p.inputValue('[data-path="geometry.nx"]'),'3');assert.ok((await p.locator('#saveState').textContent()).includes('未能恢复'));
 assert.deepEqual(errors,[]);console.log('PASS: quantity arithmetic, missing vs zero, input limits, navigation, views, comparison, persistence including invalid save, report, reset, mobile and script safety');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
