'use strict';
const MAX_BYTES=2*1024*1024;
function validateImage(image,config){
 if(image===undefined||image===null)return null;
 if(config.provider!=='deepseek'||config.model!=='deepseek-flash')throw Error('图片输入需要 DeepSeek Flash；请在连接窗口选择该模型。');
 if(typeof image!=='string'||image.length>Math.ceil(MAX_BYTES/3)*4+64)throw Error('截图过大，最多 2 MB。');
 const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
 if(!match)throw Error('仅支持本地 PNG 或 JPEG 截图，不接受图片网址。');
 const bytes=Buffer.from(match[2],'base64');
 if(bytes.length>MAX_BYTES||bytes.toString('base64')!==match[2])throw Error('图片数据无效或过大。');
 const png=bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR';
 const jpeg=bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;
 if(match[1]==='png'?!png:!jpeg)throw Error('图片格式与文件内容不一致。');
 if(png){const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);if(!w||!h||w*h>20000000)throw Error('图片像素过大，请使用较小截图。');}
 return image;
}
function responseInput(input,image){return image?[{role:'user',content:[{type:'input_text',text:JSON.stringify(input)},{type:'input_image',image_url:image,detail:'high'}]}]:JSON.stringify(input);}
module.exports={validateImage,responseInput,MAX_BYTES};
