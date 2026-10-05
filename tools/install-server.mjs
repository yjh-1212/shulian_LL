import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyPackage} from './verify-package.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<13))throw new Error('请安装 Node.js 22.13 或以上版本');
process.chdir(root);
await verifyPackage(root);
function run(command,args,options={}){
  const result=spawnSync(command,args,{cwd:root,env:process.env,stdio:'inherit',windowsHide:true,...options});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
const flags=['ci','--include=dev',...process.argv.slice(2)];
if(process.env.npm_execpath)run(process.execPath,[process.env.npm_execpath,...flags]);
else run(process.platform==='win32'?'npm.cmd':'npm',flags,{shell:process.platform==='win32'});
process.env.DATABASE_URL||='file:./server.db';
run(process.execPath,['node_modules/prisma/build/index.js','generate']);
console.log('服务器依赖和数据库客户端已安装，执行 npm start 启动。');
