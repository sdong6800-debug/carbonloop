'use strict';
// DeepSeek Responses defaults to thinking. This bounded classification/research
// workflow uses non-thinking mode so reasoning cannot consume its small output budget.
// Official specification verified 2026-10-06: https://api-docs.deepseek.com/api/create-response/
module.exports=config=>config.provider==='deepseek'?{reasoning:{effort:'none'}}:{};
