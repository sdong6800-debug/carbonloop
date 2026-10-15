const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8513/demo.html');await p.click('#entryRead');await p.click('#entryConfirmGroup');await p.click('#entryContinue');
 await p.click('#reportExplore');assert.ok(await p.locator('[name="direction"][value="wall"]').isEnabled());
 const input=async value=>{await p.fill('#dimensionInput',String(value));await p.locator('#dimensionInput').press('Tab');};
 const select=async id=>p.click(`[data-component-id="${id}"]`);
 await input(230);assert.match(await p.textContent('#impactChange'),/200 → 230/);assert.match(await p.textContent('#impactSelected'),/增加 167.75/);assert.match(await p.textContent('#impactScope'),/2,737.54/);assert.match(await p.textContent('#impactScope'),/增加 167.75/);
 assert.equal(await p.locator('#candidateReview').isVisible(),false);await p.screenshot({path:'change-impact-desktop.png',fullPage:true});
 await input(180);assert.match(await p.textContent('#impactSelected'),/减少 111.84/);await p.click('#resetElement');assert.match(await p.textContent('#impactSelected'),/未变化/);
 await select('W01');await input(200);let state=await p.evaluate(()=>CarbonWorkspace.state());let a=state.baseline.find(x=>x.id==='W01'),b=state.candidate.find(x=>x.id==='W01');assert.equal(b.w,.2);assert.ok(Math.abs((a.y+a.w/2)-(b.y+b.w/2))<1e-9);assert.match(await p.textContent('#impactChange'),/150 → 200/);await p.click('#resetElement');
 await select('C01');assert.match(await p.textContent('#dimensionLabel'),/翼缘/);await input(22);state=await p.evaluate(()=>CarbonWorkspace.state());b=state.candidate.find(x=>x.id==='C01');assert.equal(b.quantity.tf,.022);assert.equal(b.l,.4);assert.match(await p.textContent('#impactSelected'),/增加/);await p.click('#resetElement');
 await select('C03');await input(350);assert.match(await p.textContent('#impactSelected'),/减少/);await p.click('#resetElement');
 await select('S01');await p.selectOption('#changeRecipe','01.002.13');assert.match(await p.textContent('#impactScope'),/2,229.9/);assert.match(await p.textContent('#impactExplanation'),/密度与因子/);await p.selectOption('#material','unknown');assert.match(await p.textContent('#impactScope'),/暂不能比较/);assert.equal(await p.locator('#impactScope .impact-delta').getAttribute('data-trend'),'unknown');await p.click('#resetElement');await input(230);
 for(const width of [1024,768,390]){await p.setViewportSize({width,height:950});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);}await p.screenshot({path:'change-impact-mobile.png',fullPage:true});
 await p.setViewportSize({width:1440,height:1050});await p.click('#flowNext');assert.ok(await p.locator('#changeImpact').isVisible());assert.ok(await p.locator('#decisionSummary').isVisible());assert.equal(await p.locator('#candidateReview').isVisible(),false);assert.match(await p.textContent('#decisionChanges'),/200 → 230/);assert.match(await p.textContent('#impactScope'),/增加 167.75/);state=await p.evaluate(()=>CarbonWorkspace.state());assert.equal(state.baseline.find(x=>x.id==='S01').h,.2);
 assert.deepEqual(errors,[]);console.log('PASS slab up/down, wall, I-steel net section, timber column, reset, material recipe, missing data, scope comparison, baseline preserved and responsive UI');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
