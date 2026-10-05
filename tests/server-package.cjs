const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const net=require('node:net');
const {spawn,spawnSync}=require('node:child_process');
const {createRequire}=require('node:module');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const JSZip=require('jszip');
const {parse}=require('dotenv');

const root=path.resolve(__dirname,'..');
const archive=path.resolve(process.argv[2]||path.join(root,'ll_dist/liaoliang-server.zip'));
const temporaryRoot=path.join(root,'.local');
fs.mkdirSync(temporaryRoot,{recursive:true});
const temporary=fs.mkdtempSync(path.join(temporaryRoot,'package-check-'));
const unpacked=path.join(temporary,'liaoliang-server');
let server,db,logs='';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function availablePort(){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));return port;}
function run(args,env=process.env){const result=spawnSync(process.execPath,args,{cwd:unpacked,env,encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:4*1024*1024});if(result.error)throw result.error;return result;}
async function main(){
  const zip=await JSZip.loadAsync(await fsp.readFile(archive));
  for(const entry of Object.values(zip.files)){
    const target=path.resolve(temporary,entry.name);
    assert.ok(target.startsWith(temporary+path.sep),'压缩包路径必须位于解压目录');
    if(entry.dir){await fsp.mkdir(target,{recursive:true});continue;}
    await fsp.mkdir(path.dirname(target),{recursive:true});
    await fsp.writeFile(target,await entry.async('nodebuffer'));
  }
  const {verifyPackage}=await import(pathToFileURL(path.join(unpacked,'tools/verify-package.mjs')).href);
  const release=await verifyPackage(unpacked,true);
  console.log('压缩包已解压并核对所有文件，正在独立安装运行依赖。');
  const environment={...process.env,DATABASE_URL:'file:./server.db'};
  let installation=run(['tools/install-server.mjs','--offline','--no-audit','--no-fund'],environment);
  if(installation.status!==0&&/ENOTCACHED/.test(installation.stdout+installation.stderr)){
    console.log('本地缓存不完整，改用锁定版本安装依赖。');
    installation=run(['tools/install-server.mjs','--no-audit','--no-fund'],environment);
  }
  assert.equal(installation.status,0,(installation.stdout+installation.stderr).slice(-1800));
  const packageRequire=createRequire(path.join(unpacked,'package.json'));
  for(const dependency of ['@prisma/client','@nestjs/core','express','dotenv','tesseract.js','@napi-rs/canvas','exceljs'])assert.ok(packageRequire.resolve(dependency).startsWith(path.join(unpacked,'node_modules')+path.sep),'运行依赖必须来自解压后的包：'+dependency);
  assert.ok(fs.existsSync(path.join(unpacked,'node_modules/prisma/build/index.js')),'Prisma CLI 必须安装在包内');
  const {PrismaClient}=packageRequire('@prisma/client');
  const databasePath=path.join(unpacked,'prisma/server.db');
  db=new PrismaClient({datasources:{db:{url:'file:'+databasePath.replace(/\\/g,'/')}}});
  const integrity=await db.$queryRawUnsafe('PRAGMA integrity_check');
  assert.ok(integrity.every(row=>Object.values(row)[0]==='ok'));
  for(const [name,expected] of Object.entries(release.database.tables)){
    const [row]=await db.$queryRawUnsafe('SELECT COUNT(*) AS count FROM "'+name.replace(/"/g,'""')+'"');
    assert.equal(Number(row.count),expected,'打包数据库表条数：'+name);
  }
  const port=await availablePort(),base='http://127.0.0.1:'+port;
  const config=parse(await fsp.readFile(path.join(unpacked,'.env.server')));
  assert.equal(config.DATABASE_URL,'file:./server.db');
  const env={...process.env,ENV_FILE:'.env.server',DATABASE_URL:config.DATABASE_URL,PORT:String(port),API_HOST:'0.0.0.0'};
  server=spawn(process.execPath,['tools/server.mjs','start'],{cwd:unpacked,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>logs=(logs+chunk).slice(-16000));
  server.stderr.on('data',chunk=>logs=(logs+chunk).slice(-16000));
  for(let attempt=0;attempt<180;attempt++){
    if(server.exitCode!==null)throw new Error('包内服务器启动失败：'+logs.slice(-1500));
    try{if((await fetch(base+'/api/health')).ok)break;}catch{}
    if(attempt===179)throw new Error('包内服务器启动超时：'+logs.slice(-1500));
    await wait(250);
  }
  for(const route of ['/','/workbench','/driver']){const response=await fetch(base+route);assert.equal(response.status,200,route);assert.match(response.headers.get('content-type'),/text\/html/);}
  for(const route of ['/.env.server','/prisma/server.db','/.local/uploads','/tools/server.mjs'])assert.equal((await fetch(base+route)).status,404,'私有文件不得公开：'+route);
  let adminToken;
  for(const username of ['admin','trader','carrier']){
    const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username,password:config.FIXED_ACCOUNT_PASSWORD})});
    assert.equal(response.status,201,'保留账号可登录：'+username);
    const data=(await response.json()).data;
    assert.equal(data.user.username,username);
    if(username==='admin')adminToken=data.accessToken;
  }
  const headers={Authorization:'Bearer '+adminToken};
  async function get(route){const response=await fetch(base+route,{headers});assert.equal(response.status,200,route);return (await response.json()).data;}
  const contracts=await get('/api/contracts');
  const orders=await get('/api/trade-orders');
  const waybills=await get('/api/intermodal');
  const templates=await get('/api/contracts/templates');
  assert.ok(contracts.length>0,'合同数据应可查看');
  assert.ok(orders.total>0,'交易数据应可查看');
  assert.ok(waybills.total>0,'运单数据应可查看');
  assert.ok(templates.length>0,'模板数据应可查看');
  const attachment=await db.businessFile.findFirst({where:{deletedAt:null}});
  assert.ok(attachment);
  const download=await fetch(base+'/api/transport-files/'+attachment.id,{headers});
  assert.equal(download.status,200,'文件附件可下载');
  assert.equal(sha(Buffer.from(await download.arrayBuffer())),attachment.sha256);
  const template=await db.contractTemplate.findFirst({where:{fileId:{not:null},status:{not:'ARCHIVED'}},include:{file:true}});
  if(template){const response=await fetch(base+'/api/contracts/templates/'+template.id+'/file',{headers});assert.equal(response.status,200);assert.equal(sha(Buffer.from(await response.arrayBuffer())),template.file.digest);}
  const stage=await db.stageAttachment.findFirst();
  if(stage){const response=await fetch(base+'/api/intermodal/attachments/'+stage.id,{headers});assert.equal(response.status,200);assert.equal(sha(Buffer.from(await response.arrayBuffer())),stage.digest);}
  const ExcelJS=packageRequire('exceljs'),workbook=new ExcelJS.Workbook();
  workbook.addWorksheet('运输').addRow(['运单号','数量']);workbook.worksheets[0].addRow(['PACKAGE-VERIFY',1200.5]);
  const document=path.join(temporary,'document.xlsx');await workbook.xlsx.writeFile(document);
  const recognition=run(['tools/document-worker.cjs',document,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],env);
  assert.equal(recognition.status,0);assert.match(JSON.parse(recognition.stdout).text,/PACKAGE-VERIFY/);
  console.log(JSON.stringify({passed:true,archiveFiles:release.files.length,databaseTables:Object.keys(release.database.tables).length,databaseBytes:release.database.bytes,uploadedAttachments:release.database.attachmentFiles,fixedAccountLogins:3,visibleContracts:contracts.length,visibleOrders:orders.total,visibleWaybills:waybills.total,visibleTemplates:templates.length,attachmentDownloads:true,documentWorker:true}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{
  if(server){server.kill();await Promise.race([new Promise(resolve=>server.once('exit',resolve)),wait(5000)]);}
  if(db)await db.$disconnect();
  const absolute=path.resolve(temporary);
  if(!absolute.startsWith(path.resolve(temporaryRoot)+path.sep)||!path.basename(absolute).startsWith('package-check-'))throw new Error('测试目录清理校验失败');
  await fsp.rm(absolute,{recursive:true,force:true,maxRetries:5,retryDelay:300});
});
