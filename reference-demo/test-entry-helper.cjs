module.exports=async function openSample(p,showModel=false){
 await require('./test-baseline-route.cjs')(p);await p.reload();if(await p.locator('#load').isVisible())await p.click('#load');await p.click('#entryRead');await p.click('#entryConfirmGroup');await p.click('#entryContinue');if(showModel)await p.click('#resultModelDetails>summary');
};
