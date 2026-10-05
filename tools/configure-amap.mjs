import {readFile,writeFile} from 'node:fs/promises';
const raw=await readFile('api_key/高德api.txt','utf8');
const values=raw.match(/[a-fA-F0-9]{32}/g)||[];
if(values.length!==3)throw new Error('高德配置格式不符：需JSAPI Key、安全码、Web服务Key三项，请检查本地文件');
let env=await readFile('.env','utf8');
for(const [name,value] of Object.entries({AMAP_JSAPI_KEY:values[0],AMAP_SECURITY_JS_CODE:values[1],AMAP_WEB_SERVICE_KEY:values[2]})){
 const pattern=new RegExp('^'+name+'=.*$','m');env=pattern.test(env)?env.replace(pattern,`${name}="${value}"`):env+`\n${name}="${value}"\n`;
}
await writeFile('.env',env);console.log('高德三项配置已保存至本地 .env；未输出凭据。');
