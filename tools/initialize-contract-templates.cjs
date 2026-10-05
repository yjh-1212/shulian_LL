/* Add authored contract templates and source attachments, with an auditable backup.
 * No transaction contracts, signatures, payments or evidence are created.
 */
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const { resolve } = require('node:path');
require('dotenv').config({ quiet: true });
const MARKER = 'contract-template-library-2026-10-v1';
const SOURCE = 'CONTRACT_TEMPLATE_LIBRARY';
const ROOT = resolve('output/contract-templates');
const REPORT = resolve('docs/acceptance/contract-template-library-initialization.json');
const sha = value => createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
async function backup(db) {
  const dir=resolve('.local/backups','contract-templates-'+new Date().toISOString().replace(/[:.]/g,'-'));
  await mkdir(dir,{recursive:true});
  const path=resolve(dir,'database.db');
  await db.$executeRawUnsafe(`VACUUM INTO '${path.replace(/'/g,"''")}'`);
  const bytes=await readFile(path);
  await writeFile(resolve(dir,'manifest.json'),JSON.stringify({sourceSystem:SOURCE,createdAt:new Date().toISOString(),bytes:bytes.length,sha256:sha(bytes),method:'SQLITE_VACUUM_INTO'},null,2));
  return path;
}
async function main() {
  const db = new PrismaClient();
  try {
    const done=await db.auditLog.findUnique({where:{id:MARKER}});
    if(done){console.log(JSON.stringify({status:'ALREADY_INITIALIZED',...JSON.parse(done.after)},null,2));return;}
    const library=JSON.parse(await readFile(resolve(ROOT,'manifest.json'),'utf8'));
    if(library.revision!=='2026-10-v1'||library.templates.length!==6)throw Error('完整模板库尚未生成');
    const attachments=await Promise.all(library.templates.map(async t=>{
      const bytes=await readFile(resolve(ROOT,t.pdf));
      if(bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.toString('latin1').includes('%%EOF')||bytes.length>8*1024*1024)throw Error('模板文件格式或大小无效');
      if(t.body.length<600||t.body.length>30000||/模拟|演示|样例|Phase\d/i.test(t.name+' '+t.body))throw Error('模板正文不完整');
      return {template:t,bytes,digest:sha(bytes)};
    }));
    const admin=await db.user.findFirst({where:{username:'admin',status:'ACTIVE',deletedAt:null,businessEntity:{type:'PLATFORM',status:'ACTIVE',deletedAt:null}}});
    if(!admin)throw Error('有效的平台管理账号不存在');
    const summary={sourceSystem:SOURCE,revision:library.revision,templates:attachments.map(x=>({id:MARKER+'-'+x.template.key,name:x.template.name,type:x.template.type,pages:x.template.pages,digest:x.digest})),sources:library.sources,defaultMain:MARKER+'-grain-general',defaultAddendum:MARKER+'-platform-service',authorship:'按用户要求整理的可复用合同条款，非实际签署合同或官方示范文本'};
    if(!process.argv.includes('--apply')){console.log(JSON.stringify({status:'PREVIEW',...summary},null,2));return;}
    const backupPath=await backup(db),now=new Date();
    await db.$transaction(async tx=>{
      if(await tx.auditLog.findUnique({where:{id:MARKER}}))throw Error('模板库已由其他进程初始化');
      const max={};
      for(const type of ['MAIN','ADDENDUM'])max[type]=(await tx.contractTemplate.findFirst({where:{type},orderBy:{version:'desc'},select:{version:true}}))?.version||0;
      for(const {template:t,bytes,digest} of attachments){
        const id=MARKER+'-'+t.key,fileId=id+'-file';
        await tx.contractTemplateFile.create({data:{id:fileId,name:t.pdf,mime:'application/pdf',size:bytes.length,digest,bytes:new Uint8Array(bytes),previewText:'',createdBy:admin.id,createdAt:now}});
        await tx.contractTemplate.create({data:{id,type:t.type,name:t.name,mode:t.mode,version:++max[t.type],body:t.body,status:'PUBLISHED',effectiveFrom:now,createdAt:now,fileId}});
      }
      await tx.auditLog.create({data:{id:MARKER,userId:admin.id,userName:admin.displayName,role:'platform',businessEntityId:admin.businessEntityId,ip:'local',userAgent:'contract-template-library-initialization',module:'合同模板',objectId:MARKER,action:'新增粮食联运合同模板库',after:JSON.stringify({...summary,initializedAt:now.toISOString(),backupPath}),requestId:MARKER}});
    },{timeout:30000,maxWait:30000});
    await writeFile(REPORT,JSON.stringify({...summary,initializedAt:now.toISOString(),backupPath},null,2));
    console.log(JSON.stringify({status:'INITIALIZED',templates:summary.templates.length,defaultMain:summary.defaultMain,defaultAddendum:summary.defaultAddendum,backupPath},null,2));
  } finally {await db.$disconnect();}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={MARKER,SOURCE,main};
