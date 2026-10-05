// Read-only verification of the authored library, its attachments and preserved business records.
require('dotenv').config({quiet:true});
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {strict:assert}=require('node:assert');
const {createHash}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
require.extensions['.ts']=(module,filename)=>{const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,esModuleInterop:true}});module._compile(compiled.outputText,filename);};
const {ContractsService}=require('../apps/api/src/contracts.service.ts');
const {readTemplateFile}=require('../apps/api/src/contract-files.ts');
const {MARKER}=require('../tools/initialize-contract-templates.cjs');
const sha=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,(_k,value)=>typeof value==='bigint'?value.toString():value)).digest('hex');
const db=new PrismaClient();
async function main(){
  let previous;
  try{
    const manifest=JSON.parse(fs.readFileSync('docs/acceptance/contract-template-library-initialization.json','utf8'));
    const backupManifest=JSON.parse(fs.readFileSync(path.join(path.dirname(manifest.backupPath),'manifest.json'),'utf8'));
    assert.equal(sha(fs.readFileSync(manifest.backupPath)),backupManifest.sha256);
    previous=new PrismaClient({datasources:{db:{url:'file:'+manifest.backupPath.replace(/\\/g,'/')}}});
    const service=new ContractsService(db,{write:async()=>undefined});
    const templates=await service.templates(),newTemplates=templates.filter(t=>t.id.startsWith(MARKER));
    assert.equal(newTemplates.length,6);assert.equal(newTemplates.filter(t=>t.type==='MAIN').length,5);
    for(const t of newTemplates){
      assert.equal(t.status,'PUBLISHED');assert.ok(t.body.length>600);assert.ok(t.file&&!('bytes' in t.file));
      assert.ok(!/模拟|演示|样例|Phase\d/i.test(t.name+' '+t.body));
      const attachment=await service.templateFile(t.id),bytes=Buffer.from(attachment.bytes);
      const parsed=await readTemplateFile({originalname:attachment.name,buffer:bytes});
      assert.equal(parsed.mime,'application/pdf');assert.equal(parsed.digest,attachment.digest);assert.equal(parsed.size,attachment.size);
      assert.ok(t.body.includes('结算')||t.body.includes('对账'));
    }
    const selected=await Promise.all(['MAIN','ADDENDUM'].map(type=>db.contractTemplate.findFirst({where:{type,status:'PUBLISHED',effectiveFrom:{lte:new Date()}},orderBy:[{effectiveFrom:'desc'},{version:'desc'}]})));
    assert.equal(selected[0].id,manifest.defaultMain);assert.equal(selected[1].id,manifest.defaultAddendum);
    const docs=service.documents(selected,{trader:{name:'贸易企业'},carrier:{name:'承运企业'},platform:{name:'平台'},confirmationNo:'QR2026100001',grain:'大豆',origin:'东北产区',destination:'南方港区',quantityKg:1250500,totalCents:31262500},{settlement:'双方对账后付款',requirements:'保留过磅与交接资料',platformFeeCents:0,expiresAt:'2027-01-01T00:00:00Z'});
    assert.equal(docs.length,2);assert.ok(docs[0].body.includes('1250.5 吨'));assert.ok(docs[0].body.includes('大豆'));assert.ok(docs[0].fileId);assert.ok(docs[0].body.includes('全程运输'));
    const protectedTables=['ContractTemplate','ContractTemplateFile','ContractPackage','ContractRevision','ContractSignature','ContractArchive','Bill','Settlement','SettlementRecord','TransportTask'];
    for(const table of protectedTables){
      const original=await previous.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`);
      const current=await db.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`);
      const before=original.map(row=>row.id),old=current.filter(row=>before.includes(row.id));
      assert.equal(sha(old),sha(original),table+' 原记录保持不变');
      if(!['ContractTemplate','ContractTemplateFile'].includes(table))assert.equal(current.length,original.length,table+' 未新增交易或凭证记录');
    }
    const ids=newTemplates.map(t=>t.id);const beforeRerun=sha(await db.contractTemplate.findMany({where:{id:{in:ids}},orderBy:{id:'asc'}}));
    await require('../tools/initialize-contract-templates.cjs').main();
    assert.equal(sha(await db.contractTemplate.findMany({where:{id:{in:ids}},orderBy:{id:'asc'}})),beforeRerun);
    const report={passed:true,checkedAt:new Date().toISOString(),templates:6,mainContracts:5,addendums:1,defaultMain:manifest.defaultMain,pdfDownloadsVerified:6,preservedTables:protectedTables,idempotent:true};
    fs.writeFileSync('docs/acceptance/contract-template-library-verification.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  }finally{await previous?.$disconnect();await db.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
