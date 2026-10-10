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
const name='liaoliang-update-'+timestamp;
const output=resolve(root,'ll_dist',name,'liaoliang-server');
const archive=resolve(root,'ll_dist',name+'.zip');
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
 return !path.endsWith('.map') && (path.startsWith('apps/api/dist/')||path.startsWith('apps/web/dist/')||path.startsWith('jiashicang/server/')||['tools/verify-package.mjs','UPDATE.md','release-manifest.json'].includes(path));
}
async function main(){
 for(const path of ['apps/api/dist/main.js','apps/api/dist/auth.js','apps/web/dist/index.html','apps/web/dist/driver.html','jiashicang/server/cockpit.cjs'])await stat(resolve(root,path));
 await mkdir(output,{recursive:true});
 for(const path of ['apps/api/dist','apps/web/dist','jiashicang/server','tools/verify-package.mjs']){
  const target=resolve(output,path);
  await mkdir(resolve(target,'..'),{recursive:true});
  await cp(resolve(root,path),target,{recursive:true,errorOnExist:true,force:false,filter:source=>!source.endsWith('.map')});
 }
 await writeFile(resolve(output,'UPDATE.md'),`# 辽粮服务器更新包

## 本次更新

- 首页的“进入平台”“立即体验”和“进入智能多式联运平台”在未登录时自动以 trader 账号进入工作台。
- 已有有效登录会话时继续使用当前账号。登录状态可在刷新后保持。
- 自动登录仍检查 trader 账号与所属企业的启用状态，并沿用其现有业务权限。
- 包含当前两个统计驾驶舱及所需后端模块，独立入口为 /cockpit。
- 同时包含当前前后端构建及司机端资源。

## 已有腾讯云 Node.js 服务更新

1. 使用当前运维方式备份服务器正在使用的数据库、上传附件和配置，然后停止项目进程。
2. 解压本包，将 liaoliang-server 文件夹里面的文件和目录合并覆盖到现有应用根目录（包含 package.json 的目录）。目录同名时选择合并和覆盖文件，不要删除原应用目录。不要把 liaoliang-server 文件夹再嵌套到应用里面。
3. 本包只更新 apps/api/dist、apps/web/dist、jiashicang/server、tools/verify-package.mjs 和更新说明/校验清单。保留服务器原有 .env、.env.server、prisma 数据库及 .local 上传附件/OCR 文件。
4. 在应用根目录执行 node tools/verify-package.mjs，确认“部署文件校验通过”。
5. 使用原项目管理工具重启；若原来直接使用 Node.js 运行，执行 npm start。无需重新构建、安装依赖、初始化数据库或重新设置密码。
6. 浏览器强制刷新首页。未登录时点击三个入口中的任意一个，应进入 trader 的工作台。驾驶舱访问 /cockpit?view=platform 或 /cockpit?view=chain。健康检查访问 /api/health。

自动登录开放的是 trader 账号现有数据和操作权限；管理员、承运商和司机继续使用各自的登录入口。服务器数据库中须已有启用的 trader 账号及企业，且该账号没有待处理的强制改密要求，否则首页会提示账号不可用。

## 适用范围

这是已有辽粮 Node.js 部署的增量程序更新包，不是首次安装包。API 依赖、数据库结构和迁移文件与此前服务器包保持一致。压缩包不包含数据库、密钥配置、上传附件或 node_modules，也不会重置现有账号。

Render 使用 GitHub 自动部署时，需要更新仓库代码后重新部署；上传本压缩包不能直接更新该 GitHub/Docker 服务。
`,'utf8');
 const entries=[];
 for(const path of await files(output)){
  const name=relative(output,path).split(sep).join('/');
  if(!allowed(name))throw new Error('更新包出现非程序文件：'+name);
  entries.push({path:name,bytes:(await stat(path)).size,sha256:await fileHash(path),mutable:false});
 }
 await writeFile(resolve(output,'release-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),kind:'code-update',databaseIncluded:false,configurationIncluded:false,files:entries},null,2)+'\n');
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
 await writeFile(archive.replace(/\.zip$/,'.sha256'),await fileHash(archive)+'  '+basename(archive)+'\n',{flag:'wx'});
 console.log(JSON.stringify({folder:output,archive,bytes:(await stat(archive)).size,files:entries.length+1,verified:true,databaseIncluded:false,configurationIncluded:false},null,2));
}
main().catch(error=>{console.error('更新打包失败：'+error.message);process.exitCode=1;});
