import JSZip from 'jszip';
import {createWriteStream} from 'node:fs';
import {cp,mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {resolve,relative,sep,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {fileHash,verifyPackage} from './verify-package.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const timestamp=new Date().toISOString().replace(/[-:.TZ]/g,'');
const repair=process.argv.includes('--repair');
const name=(repair?'liaoliang-repair-':'liaoliang-update-')+timestamp;
const output=resolve(root,'ll_dist',name,'liaoliang-server');
const archive=resolve(root,'ll_dist',name+'.zip');
const programPaths=['apps/api/dist','apps/web/dist','jiashicang/server','prisma/migrations',
 'package-lock.json','prisma/schema.prisma','prisma/bootstrap-production.ts','prisma/seed-phase789.ts','prisma/seed-data-service.ts','apps/api/src/data-products.catalog.ts',
 'tools/server.mjs','tools/setup-server.mjs','tools/configure-driver-account.cjs','tools/document-worker.cjs','tools/install-server.mjs','tools/verify-package.mjs','tools/backup.mjs'];
if(repair)programPaths.push('tools/repair-business-data.cjs','tools/initialize-billing-data.cjs','tools/initialize-data-service-records.cjs');
async function files(folder){
 const result=[];
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const path=resolve(folder,entry.name);
  if(entry.isSymbolicLink())throw new Error('更新包不支持符号链接');
  if(entry.isDirectory())result.push(...await files(path));
  else if(entry.isFile())result.push(path);
 }
 return result.sort();
}
function allowed(path){
 return !path.endsWith('.map')&&!/(^|\/)(\.env(?:\.|$)|[^/]+\.(?:db|sqlite|sqlite3)(?:$|-))/.test(path)
  && (['apps/api/dist/','apps/web/dist/','jiashicang/server/','prisma/migrations/'].some(prefix=>path.startsWith(prefix))
   ||[...programPaths,'package.json','apps/api/package.json','apps/web/package.json','UPDATE.md','REPAIR.md','release-manifest.json'].includes(path));
}
async function main(){
 for(const path of ['apps/api/dist/main.js','apps/api/dist/auth.js','apps/web/dist/index.html','apps/web/dist/driver.html','jiashicang/server/cockpit.cjs'])await stat(resolve(root,path));
 await mkdir(output,{recursive:true});
 for(const path of programPaths){
  const target=resolve(output,path);
  await mkdir(resolve(target,'..'),{recursive:true});
  await cp(resolve(root,path),target,{recursive:true,errorOnExist:true,force:false,filter:source=>!source.endsWith('.map')});
 }
 const manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
 manifest.scripts={
  'install:server':'node tools/install-server.mjs',start:'node tools/server.mjs start',
  'server:start':'node tools/server.mjs start','server:setup':'node tools/setup-server.mjs','server:init':'node tools/server.mjs init',
  'accounts:driver:init':'node tools/configure-driver-account.cjs --server','db:generate':'prisma generate',
  'verify:package':'node tools/verify-package.mjs --initial',backup:'node tools/backup.mjs'
 };
 if(repair){manifest.scripts['data:check']='node tools/repair-business-data.cjs';manifest.scripts['data:repair']='node tools/repair-business-data.cjs --apply';}
 await writeFile(resolve(output,'package.json'),JSON.stringify(manifest,null,2)+'\n');
 for(const workspace of ['api','web']){
  const pkg=JSON.parse(await readFile(resolve(root,'apps',workspace,'package.json'),'utf8'));
  delete pkg.scripts;
  await writeFile(resolve(output,'apps',workspace,'package.json'),JSON.stringify(pkg,null,2)+'\n');
 }
 await writeFile(resolve(output,'UPDATE.md'),`# 辽粮服务器更新包

## 本次更新

- 暂时隐藏首页导航，访问根地址 / 直接进入 /workbench；未登录时沿用现有 trader 企业账号快捷进入。
- 已有有效登录会话时继续使用当前账号。登录状态可在刷新后保持。
- 自动登录仍检查 trader 账号与所属企业的启用状态，并沿用其现有业务权限。
- 企业工作台使用新生成的明亮港口背景，浅色渐变与深蓝欢迎文字。
- 五个驾驶舱统一为综合驾驶舱的深蓝配色、透明面板和边框样式；综合驾驶舱保持在中间并默认选中。
- 驾驶舱的“返回”回到进入前的业务页面，支持切换栏目和刷新后的返回。
- 账单管理与结算管理合并重复入口，并更新搜索、列宽；合同签署的“新增合同”与搜索放在同一行。
- 企业名称更新为“辽宁省粮食发展集团有限责任公司”，包含相关数据迁移。
- 包含最新数据服务页面、授权订阅界面及其他已完成的前后端修改。
- 同时包含当前前后端构建及司机端资源。

## 已有腾讯云 Node.js 服务更新

1. 使用当前运维方式备份服务器正在使用的数据库、上传附件和配置，然后停止项目进程。
2. 解压本包，将 liaoliang-server 文件夹里面的文件和目录合并覆盖到现有应用根目录（包含 package.json 的目录）。目录同名时选择合并和覆盖文件，不要删除原应用目录。不要把 liaoliang-server 文件夹再嵌套到应用里面。
3. 本包包含程序、依赖清单、Prisma schema 和全部迁移文件。保留服务器原有 .env、.env.server、prisma 数据库及 .local 上传附件/OCR 文件。本包不包含这些运行数据。
4. 在应用根目录执行 node tools/verify-package.mjs，确认“部署文件校验通过”。
5. 执行 npm run install:server，安装锁定版本的依赖并生成当前 Prisma 客户端。需要 Node.js 22.13 或以上版本。
6. 使用原项目管理工具重启；若原来直接使用 Node.js 运行，执行 npm start。启动工具自动应用待执行的数据库迁移。不要运行 server:init、开发 seed、migrate reset 或替换数据库文件。
7. 浏览器强制刷新后访问 /，应直接进入工作台。驾驶舱独立地址为 /cockpit，默认展示中间的综合驾驶舱。健康检查访问 /api/health。

快捷进入使用 trader 账号现有数据和操作权限；已有登录会话继续使用当前账号。管理员和承运商可通过 /login 登录，司机仍使用司机端。服务器数据库中须已有启用的正式 trader 账号及企业，且没有待处理的强制改密要求，否则回到账号登录页面。

## 适用范围

这是已有辽粮 Node.js 部署的程序更新包，包含当前全部构建文件及迁移，不依赖某个旧版本的静态资源。本包不会重置现有账号或替换数据库，不会自动导入本机生成的账单和订阅记录。此前已在服务器上产生的业务记录继续保留。

Render 使用 GitHub 自动部署时，需要更新仓库代码后重新部署；上传本压缩包不能直接更新该 GitHub/Docker 服务。
`,'utf8');
 if(repair){
  const instructions=await readFile(resolve(root,'tools/REPAIR.md'),'utf8');
  await writeFile(resolve(output,'REPAIR.md'),instructions);
  await writeFile(resolve(output,'UPDATE.md'),instructions);
 }
 const entries=[];
 for(const path of await files(output)){
  const name=relative(output,path).split(sep).join('/');
  if(!allowed(name))throw new Error('更新包出现非程序文件：'+name);
  entries.push({path:name,bytes:(await stat(path)).size,sha256:await fileHash(path),mutable:false});
 }
 await writeFile(resolve(output,'release-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),kind:repair?'business-data-repair':'code-update',databaseIncluded:false,configurationIncluded:false,migrationsIncluded:true,files:entries},null,2)+'\n');
 await verifyPackage(output,true);
 const zip=new JSZip();
 for(const path of await files(output))zip.file('liaoliang-server/'+relative(output,path).split(sep).join('/'),await readFile(path),{unixPermissions:0o100644});
 await pipeline(zip.generateNodeStream({type:'nodebuffer',streamFiles:true,compression:'DEFLATE',compressionOptions:{level:6},platform:'UNIX'}),createWriteStream(archive,{flags:'wx'}));
 const unpacked=await JSZip.loadAsync(await readFile(archive),{checkCRC32:true});
 for(const entry of entries){
  const bytes=await unpacked.file('liaoliang-server/'+entry.path)?.async('nodebuffer');
  if(!bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error('压缩包校验失败：'+entry.path);
 }
 for(const entry of Object.values(unpacked.files))if(!entry.dir&&!allowed(entry.name.slice('liaoliang-server/'.length)))throw new Error('压缩包含非程序文件');
 if(!unpacked.file('liaoliang-server/jiashicang/server/statistics.cjs'))throw new Error('驾驶舱统计模块缺失');
 if(!(await unpacked.file('liaoliang-server/apps/api/dist/auth.js').async('string')).includes('experience'))throw new Error('自动登录接口缺失');
 for(const required of ['prisma/schema.prisma','tools/server.mjs','tools/install-server.mjs','apps/web/dist/assets/portal/workbench-port-bright-v2.png','prisma/migrations/20261020040000_rename_liaoning_grain_entity/migration.sql']){
  if(!unpacked.file('liaoliang-server/'+required))throw new Error('更新包必需文件缺失：'+required);
 }
 await writeFile(archive.replace(/\.zip$/,'.sha256'),await fileHash(archive)+'  '+basename(archive)+'\n',{flag:'wx'});
 console.log(JSON.stringify({folder:output,archive,bytes:(await stat(archive)).size,files:entries.length+1,verified:true,databaseIncluded:false,configurationIncluded:false,migrationsIncluded:true},null,2));
}
main().catch(error=>{console.error('更新打包失败：'+error.message);process.exitCode=1;});
