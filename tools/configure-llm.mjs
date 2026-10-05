import {readFile,writeFile} from 'node:fs/promises';
const input=await readFile(new URL('../api_key/deepseek_key.txt',import.meta.url),'utf8');
const key=input.match(/sk-[A-Za-z0-9_-]{20,}/)?.[0];
if(!key)throw new Error('未识别到 DeepSeek 密钥格式');
const path=new URL('../.env',import.meta.url);let env=await readFile(path,'utf8');
if(/^DEEPSEEK_API_KEY=/m.test(env))env=env.replace(/^DEEPSEEK_API_KEY=.*$/m,`DEEPSEEK_API_KEY="${key}"`);else env+=`\nDEEPSEEK_API_KEY="${key}"\n`;
await writeFile(path,env);console.log('DeepSeek 服务端配置完成，密钥未输出。');
