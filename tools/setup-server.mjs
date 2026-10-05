import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'dotenv';

const root=fileURLToPath(new URL('../',import.meta.url));
const target=resolve(root,process.env.ENV_FILE||'.env.server');
if(existsSync(target)){
  console.log('已有服务器配置已保留：'+target);
}else{
  const local=existsSync(resolve(root,'.env'))?parse(readFileSync(resolve(root,'.env'))):{};
  let contents=readFileSync(resolve(root,'deploy/env.server.example'),'utf8');
  const values={JWT_SECRET:randomBytes(48).toString('hex'),BOOTSTRAP_ADMIN_PASSWORD:randomBytes(24).toString('base64url')};
  for(const key of ['DATABASE_URL','AMAP_JSAPI_KEY','AMAP_SECURITY_JS_CODE','AMAP_WEB_SERVICE_KEY','DEEPSEEK_API_KEY','DEEPSEEK_BASE_URL','DEEPSEEK_MODEL','FIXED_ACCOUNT_PASSWORD'])if(local[key])values[key]=local[key];
  for(const [key,value] of Object.entries(values))contents=contents.replace(new RegExp('^'+key+'=.*$','m'),key+'='+JSON.stringify(value));
  writeFileSync(target,contents,{flag:'wx',mode:0o600});
  console.log('服务器配置已生成：'+target+'；请补充服务密钥。已有本地配置不变。');
}
