// Legacy concrete arithmetic fixture: intercepted only by tests, never a public UI choice.
const installed=new WeakSet();
module.exports=async function useBaselineFixture(page){
 if(installed.has(page))return;
 installed.add(page);
 await page.route('**/material-intake.js*',async route=>{
  const response=await route.fetch();
  const body=(await response.text()).replace("function sample(mode='mixed'){","function sample(mode='mixed'){ mode='concrete';");
  await route.fulfill({response,body});
 });
};
