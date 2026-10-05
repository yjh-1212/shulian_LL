import {config} from 'dotenv';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const envPath=resolve(root,process.env.ENV_FILE||(existsSync(resolve(root,'.env.server'))?'.env.server':'.env'));
if(existsSync(envPath))config({path:envPath});
process.env.NODE_ENV='production';
process.env.API_HOST||='0.0.0.0';
process.env.PORT||='8080';
process.env.SERVE_WEB='true';
process.env.DATABASE_URL||='file:./server.db';
if(!process.env.DATABASE_URL.startsWith('file:'))throw new Error('当前数据库配置需要 SQLite 的 file: 地址');
const dbPath=process.env.DATABASE_URL.slice(5).split('?')[0];
if(!dbPath||dbPath===':memory:')throw new Error('服务器需要持久化数据库文件');
const databasePath=isAbsolute(dbPath)?dbPath:resolve(root,'prisma',dbPath);
mkdirSync(dirname(databasePath),{recursive:true});
if(!existsSync(databasePath))writeFileSync(databasePath,'',{flag:'wx'});
function run(args){
  const result=spawnSync(process.execPath,args,{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
const command=process.argv[2]||'start';
if(command==='accounts'){
  run(['tools/configure-fixed-accounts.cjs']);
}else if(command==='init'){
  run(['node_modules/prisma/build/index.js','migrate','deploy']);
  run(['node_modules/tsx/dist/cli.mjs','prisma/bootstrap-production.ts']);
}else if(command==='start'){
  for(const path of ['apps/api/dist/main.js','apps/web/dist/index.html','apps/web/dist/driver.html'])if(!existsSync(resolve(root,path)))throw new Error('构建文件缺失，请先执行 npm run build');
  run(['node_modules/prisma/build/index.js','migrate','deploy']);
  console.log('网页、司机端与 API 已使用同一服务端口：'+process.env.PORT);
  await import(pathToFileURL(resolve(root,'apps/api/dist/main.js')).href);
}else{
  throw new Error('支持的命令：start、init、accounts');
}
