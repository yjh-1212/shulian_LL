import {PrismaClient} from '@prisma/client';
import {parse} from 'dotenv';
import JSZip from 'jszip';
import {createWriteStream} from 'node:fs';
import {access,cp,mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,basename,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pipeline} from 'node:stream/promises';
import {compare} from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {fileHash,verifyPackage} from './verify-package.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=resolve(root,'ll_dist');
function inside(path,folder=root){
  const absolute=resolve(path);
  if(!absolute.startsWith(resolve(folder)+sep))throw new Error('打包路径超出工作目录');
  return absolute;
}
async function exists(path){try{await access(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
async function files(folder){
  const items=[];
  for(const entry of await readdir(folder,{withFileTypes:true})){
    const path=resolve(folder,entry.name);
    if(entry.isSymbolicLink())throw new Error('打包不支持符号链接：'+relative(root,path));
    if(entry.isDirectory())items.push(...await files(path));
    else if(entry.isFile())items.push(path);
  }
  return items.sort();
}
async function main(){
  for(const path of ['apps/api/dist/main.js','apps/web/dist/index.html','apps/web/dist/driver.html','.env'])if(!await exists(resolve(root,path)))throw new Error('缺少 '+path+'，请先完成本地配置和构建');
  const local=parse(await readFile(resolve(root,'.env')));
  const server=await exists(resolve(root,'.env.server'))?parse(await readFile(resolve(root,'.env.server'))):{};
  const url=process.env.DATABASE_URL||local.DATABASE_URL;
  if(!url?.startsWith('file:'))throw new Error('当前数据库必须为 SQLite 文件');
  const dbFile=url.slice(5).split('?')[0];
  if(!dbFile||dbFile===':memory:')throw new Error('当前数据库地址无效');
  const sourceDatabase=isAbsolute(dbFile)?resolve(dbFile):resolve(root,'prisma',dbFile);
  await access(sourceDatabase);
  inside(dist);
  await mkdir(dist,{recursive:true});
  let name='liaoliang-server';
  if(await exists(resolve(dist,name))||await exists(resolve(dist,name+'.zip')))name+='-'+new Date().toISOString().replace(/[-:.TZ]/g,'');
  const output=inside(resolve(dist,name),dist);
  await mkdir(output); // Never replace a previous package or its database.
  console.log('正在打包到：'+output);
  async function copy(path,filter){
    const source=inside(resolve(root,path));
    const target=inside(resolve(output,path),output);
    await mkdir(resolve(target,'..'),{recursive:true});
    await cp(source,target,{recursive:true,errorOnExist:true,force:false,filter});
  }
  for(const path of ['apps/web/dist','prisma/migrations'])await copy(path);
  await copy('apps/api/dist',source=>!source.endsWith('.map'));
  for(const path of ['package-lock.json','prisma/schema.prisma','prisma/bootstrap-production.ts','prisma/seed-phase789.ts','prisma/seed-data-service.ts','apps/api/src/data-products.catalog.ts','tools/server.mjs','tools/setup-server.mjs','tools/configure-fixed-accounts.cjs','tools/document-worker.cjs','tools/install-server.mjs','tools/verify-package.mjs','deploy/env.server.example','deploy/nginx.node.conf','deploy/liaoliang.service'])await copy(path);
  for(const language of ['chi_sim','eng'])await copy('.local/ocr/'+language+'.traineddata.gz');
  const manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
  manifest.scripts={
    'install:server':'node tools/install-server.mjs',
    start:'node tools/server.mjs start',
    'server:start':'node tools/server.mjs start',
    'server:setup':'node tools/setup-server.mjs',
    'server:init':'node tools/server.mjs init',
    'server:accounts':'node tools/server.mjs accounts',
    'db:generate':'prisma generate',
    'verify:package':'node tools/verify-package.mjs --initial'
  };
  await writeFile(resolve(output,'package.json'),JSON.stringify(manifest,null,2)+'\n');
  for(const workspace of ['api','web']){
    const data=JSON.parse(await readFile(resolve(root,'apps',workspace,'package.json'),'utf8'));
    delete data.scripts;
    await writeFile(resolve(output,'apps',workspace,'package.json'),JSON.stringify(data,null,2)+'\n');
  }
  let envContents=await readFile(resolve(root,'deploy/env.server.example'),'utf8');
  const env={...server,NODE_ENV:'production',API_HOST:'0.0.0.0',PORT:server.PORT||'8080',SERVE_WEB:'true',DATABASE_URL:'file:./server.db',JWT_SECRET:server.JWT_SECRET||randomBytes(48).toString('hex'),BOOTSTRAP_ADMIN_PASSWORD:server.BOOTSTRAP_ADMIN_PASSWORD||randomBytes(24).toString('base64url')};
  for(const key of ['AMAP_JSAPI_KEY','AMAP_SECURITY_JS_CODE','AMAP_WEB_SERVICE_KEY','DEEPSEEK_API_KEY','DEEPSEEK_BASE_URL','DEEPSEEK_MODEL','FIXED_ACCOUNT_PASSWORD'])env[key]=server[key]||local[key]||'';
  if(env.JWT_SECRET.length<32||env.JWT_SECRET.startsWith('replace-'))throw new Error('服务器 JWT_SECRET 尚未配置');
  for(const [key,value] of Object.entries(env))if(new RegExp('^'+key+'=','m').test(envContents))envContents=envContents.replace(new RegExp('^'+key+'=.*$','m'),()=>key+'='+JSON.stringify(value));
  await writeFile(resolve(output,'.env.server'),envContents,{flag:'wx',mode:0o600});
  const source=new PrismaClient({datasources:{db:{url:'file:'+sourceDatabase.replace(/\\/g,'/')}}});
  let snapshot;
  let database;
  try{
    const databasePath=resolve(output,'prisma/server.db');
    await source.$executeRawUnsafe("VACUUM INTO '"+databasePath.replace(/\\/g,'/').replace(/'/g,"''")+"'");
    snapshot=new PrismaClient({datasources:{db:{url:'file:'+databasePath.replace(/\\/g,'/')}}});
    const integrity=await snapshot.$queryRawUnsafe('PRAGMA integrity_check');
    if(integrity.some(row=>Object.values(row)[0]!=='ok'))throw new Error('数据库完整性校验未通过');
    const tables=await snapshot.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const counts={};
    for(const {name:table} of tables){
      const [row]=await snapshot.$queryRawUnsafe('SELECT COUNT(*) AS count FROM "'+table.replace(/"/g,'""')+'"');
      counts[table]=Number(row.count);
    }
    const accounts=[];
    for(const username of ['admin','trader','carrier']){
      const user=await snapshot.user.findUnique({where:{username},select:{username:true,passwordHash:true,status:true,deletedAt:true}});
      accounts.push({username,preserved:!!user,active:!!user&&user.status==='ACTIVE'&&!user.deletedAt,fixedPasswordMatches:!!user&&!!env.FIXED_ACCOUNT_PASSWORD&&await compare(env.FIXED_ACCOUNT_PASSWORD,user.passwordHash)});
    }
    const attachments=await snapshot.businessFile.findMany();
    await mkdir(resolve(output,'.local/uploads'),{recursive:true});
    let attachmentFiles=0;
    for(const file of attachments){
      if(basename(file.storageName)!==file.storageName||/[\\/]/.test(file.storageName))throw new Error('附件存储名称无效');
      const from=resolve(root,'.local/uploads',file.storageName);
      if(!await exists(from)){if(!file.deletedAt)throw new Error('附件文件缺失：'+file.id);continue;}
      const target=resolve(output,'.local/uploads',file.storageName);
      await cp(from,target,{errorOnExist:true,force:false});
      if(await fileHash(target)!==file.sha256)throw new Error('附件文件校验失败：'+file.id);
      attachmentFiles++;
    }
    database={path:'prisma/server.db',format:'sqlite-vacuum-snapshot',integrity:'ok',bytes:(await stat(databasePath)).size,sha256:await fileHash(databasePath),tables:counts,accounts,attachmentFiles};
    console.log('数据库与附件已打包：'+database.bytes+' 字节，'+attachmentFiles+' 个附件文件。');
  }finally{if(snapshot)await snapshot.$disconnect();await source.$disconnect();}
  await writeFile(resolve(output,'README.md'),`# 辽粮服务器部署包\n\n本包包含已构建的门户、工作台、司机端、API、当前数据库、上传附件、OCR 语言包和服务器配置。\n\n## 安装与启动\n\n1. 将压缩包上传到服务器并解压，进入包内含 package.json 的文件夹。安装 Node.js 22.13 或以上版本。\n2. 执行以下命令，前端与后端已经构建，无须再次构建：\n\n\`\`\`sh\nnpm run install:server\nnpm start\n\`\`\`\n\n3. 放行服务器 ${env.PORT} 端口，在浏览器访问 http://服务器IP:${env.PORT} 。工作台为 /workbench，司机端为 /driver，健康检查为 /api/health。本机也可访问 http://127.0.0.1:${env.PORT} 。\n\n部署包已带入当前数据库，请直接启动。不要运行开发 seed 或 server:init，以免混入其他初始化流程。现有账号和密码均保留；admin、trader、carrier 使用此前设置的密码。\n\n## 配置\n\n隐藏文件 .env.server 已包含当前地图和 AI 配置，上传时需保留。端口可修改 PORT；数据库地址为 DATABASE_URL="file:./server.db"，相对于 prisma 目录。公网页面、API 与司机端使用同一个端口。\n\n使用域名和 HTTPS 时，可参考 deploy/nginx.node.conf 将域名反向代理至 127.0.0.1:${env.PORT}，并将 .env.server 的 WEB_ORIGIN 和 DRIVER_ORIGIN 设置为实际 HTTPS 域名。如果修改了 PORT，也需修改反向代理端口。地图 JSAPI 的域名白名单需包含实际访问域名。\n\n## 持续运行\n\n服务器面板的项目根目录选本文件夹，启动命令为 npm start。Linux systemd 配置见 deploy/liaoliang.service，修改为实际目录和 Node.js 路径后启用。Linux 上启动前执行 chmod 600 .env.server。运行用户需要能写入 prisma、.local/uploads 和 .local/ocr 目录。\n\n## 数据与升级\n\n- 当前数据库：prisma/server.db，包含业务记录、账号、合同及数据库内的单据和凭证。\n- 文件附件：.local/uploads/，需和数据库一起保留。\n- OCR 语言包：.local/ocr/，用于本地单据识别。\n- 升级时先停止服务并备份数据库和 .local/uploads，再替换程序文件；保留正在使用的 .env.server 和数据库，避免被旧包覆盖。npm start 会自动检查并应用数据库结构迁移。\n- release-manifest.json 记录打包时的数据条数与 SHA-256。首次解压后可执行 npm run verify:package 核对传输完整性；使用后数据库和配置发生变化，请勿再用首次快照校验它们。\n\n本包含数据库及密钥，仅用于你的服务器上传，不要提交到公开仓库。\n`);
  const packageFiles=[];
  for(const path of await files(output)){
    const name=relative(output,path).split(sep).join('/');
    packageFiles.push({path:name,bytes:(await stat(path)).size,sha256:await fileHash(path),mutable:name==='.env.server'||name==='prisma/server.db'||name.startsWith('.local/')});
  }
  await writeFile(resolve(output,'release-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),node:'>=22.13',database,files:packageFiles},null,2)+'\n');
  await verifyPackage(output,true);
  const zip=new JSZip();
  for(const path of await files(output)){
    const entry=relative(output,path).split(sep).join('/');
    zip.file('liaoliang-server/'+entry,await readFile(path),{unixPermissions:entry==='.env.server'?0o100600:0o100644});
  }
  const archive=inside(resolve(dist,name+'.zip'),dist);
  await pipeline(zip.generateNodeStream({type:'nodebuffer',streamFiles:true,compression:'DEFLATE',compressionOptions:{level:6},platform:'UNIX'}),createWriteStream(archive,{flags:'wx'}));
  const archiveHash=await fileHash(archive);
  await writeFile(resolve(dist,name+'.sha256'),archiveHash+'  '+basename(archive)+'\n',{flag:'wx'});
  console.log(JSON.stringify({folder:output,archive,archiveBytes:(await stat(archive)).size,databaseBytes:database.bytes,attachmentFiles:database.attachmentFiles,accounts:database.accounts},null,2));
}
main().catch(error=>{console.error('打包失败：'+error.message);process.exitCode=1;});
