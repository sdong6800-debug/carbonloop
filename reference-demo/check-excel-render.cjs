const fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const {FileBlob,SpreadsheetFile}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
 for(const [file,views] of [['comparison',[['结果对比','A1:D15'],['构件明细','A1:E8'],['材料因子与来源','A1:D6']]],['cases',[['筛选与依据','A1:B8'],['案例明细','A1:F5']]],['timber',[['时间线结果','A1:D12'],['情景设置与依据','A1:C13']]]]){
  const book=await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(__dirname,'.test-exports',file+'.xlsx')));
  for(const [sheetName,range] of views){const preview=await book.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(path.join(__dirname,'.test-exports',file+'-'+sheetName+'.png'),new Uint8Array(await preview.arrayBuffer()));}
 }console.log('PASS rendered report sheets for visual inspection');
})().catch(e=>{console.error(e);process.exitCode=1;});
