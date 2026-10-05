import 'dotenv/config';
import {readFile} from 'node:fs/promises';
const path=process.argv[2];
if(!path||!process.env.IMPORT_USERNAME||!process.env.IMPORT_PASSWORD){console.error('用法：设置 IMPORT_USERNAME、IMPORT_PASSWORD 后运行 node tools/import-orders.mjs orders.json');process.exit(1);}
const url=process.env.API_URL||'http://127.0.0.1:3001/api';
async function request(path,body,token){const response=await fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(`${response.status}: ${result.message}`);return result.data;}
let token;
try{
 const data=JSON.parse(await readFile(path,'utf8'));const orders=Array.isArray(data)?data:[data];
 if(!orders.length)throw new Error('没有待导入的订单');
 const auth=await request('/auth/login',{username:process.env.IMPORT_USERNAME,password:process.env.IMPORT_PASSWORD});token=auth.accessToken;
 for(const order of orders){const result=await request('/trade-orders/import',order,token);console.log(`已导入 / 已存在：${result.businessNo} (${result.id})`);}
}catch(error){console.error('导入停止：'+error.message);process.exitCode=1;}
finally{if(token)await request('/auth/logout',{},token).catch(()=>{});}
