/* Seed the billing workflow for the four existing generated completed waybills.
 * Default is a read-only preview. --apply backs up the database and writes once.
 * No bank receipts, external payments or contract signatures are created.
 */
require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');
const {createHash,randomUUID}=require('node:crypto');
const {mkdir,writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const {BillingService}=require('../apps/api/dist/billing.service');
const {ContractsService}=require('../apps/api/dist/contracts.service');
const {Audit}=require('../apps/api/dist/audit');

const db=new PrismaClient();
const source='BILLING_FLOW_INITIALIZATION';
const scenarios=[
 {index:13,status:'SENT',settlement:null},
 {index:14,status:'DISPUTED',settlement:null},
 {index:15,status:'CONFIRMED',settlement:'PARTIAL'},
 {index:16,status:'CONFIRMED',settlement:'SETTLED'},
];
const billId=index=>`business-init-v1-bill-${index}`;
const parse=raw=>typeof raw==='string'?JSON.parse(raw||'{}'):(raw||{});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

async function plans(client){
 const bills=await client.bill.findMany({where:{id:{in:scenarios.map(s=>billId(s.index))}},include:{items:true,tasks:true,versions:{orderBy:{number:'asc'}},differences:true,settlement:{include:{records:true}}}});
 assert.equal(bills.length,scenarios.length,'Expected the four generated completed-waybill bills');
 return scenarios.map(s=>{
  const b=bills.find(b=>b.id===billId(s.index)),ref=parse(b.reference);
  assert.equal(ref.provenance?.sourceSystem,'BUSINESS_INITIALIZATION');
  assert.equal(b.isTestData,false);
  return {scenario:s,bill:b,alreadyApplied:ref.billingInitialization?.sourceSystem===source};
 });
}

function request(user){return {user,ip:'127.0.0.1',headers:{'user-agent':'initialize-billing-data'},requestId:randomUUID()};}
async function party(client,entityId){
 const user=await client.user.findFirst({where:{businessEntityId:entityId,status:'ACTIVE',deletedAt:null,roles:{some:{role:{code:{in:['trader_admin','carrier_admin','platform_admin']}}}}},include:{businessEntity:true,roles:{include:{role:true}}},orderBy:{createdAt:'asc'}});
 assert(user,`Missing business administrator for ${entityId}`);
 return {...user,roles:user.roles.map(r=>r.role)};
}

function paymentNote(bill,settlement,amountCents,at){
 const {createCanvas}=require('@napi-rs/canvas');
 const canvas=createCanvas(1250,820),ctx=canvas.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,1250,820);
 ctx.fillStyle='#17324d';ctx.font='bold 37px "Microsoft YaHei"';ctx.fillText('业务结算登记说明',65,90);
 ctx.font='23px "Microsoft YaHei"';
 const ref=parse(bill.reference),lines=[
  `账单编号：${bill.businessNo}`,`结算单编号：${settlement.businessNo}`,
  `贸易企业：${ref.snapshot.trader.name}`,`承运企业：${ref.snapshot.carrier.name}`,
  `关联合同：${ref.contractNo}`,`关联运单：${ref.waybillNo}`,
  `本次登记金额：人民币 ${(amountCents/100).toFixed(2)} 元`,
  `登记时间：${at.toISOString()}`,`数据来源：${source}`,
 ];
 lines.forEach((line,i)=>ctx.fillText(line,65,158+i*51));
 ctx.fillStyle='#805829';ctx.font='22px "Microsoft YaHei"';
 ctx.fillText('按业务流程生成的功能展示数据，非银行回单，不代表真实付款。',65,705);
 ctx.fillText('正式结算须以双方核验的合同、运输单据和实际付款凭证为准。',65,749);
 return {buffer:canvas.toBuffer('image/png'),originalname:`结算登记说明-${bill.businessNo}.png`};
}

async function applyOne(tx,plan){
 const {bill:b,scenario:s}=plan;
 assert.equal(b.status,'DRAFT','Do not overwrite a bill already processed by a user');
 assert.equal(b.version,1);assert.equal(b.tasks.length,0);assert.equal(b.versions.length,0);assert.equal(b.differences.length,0);assert.equal(b.settlement,null);
 const business=await tx.logisticsBusiness.findUniqueOrThrow({where:{id:b.businessId},include:{package:{include:{revisions:true}},tasks:{include:{evidence:{select:{id:true,category:true,name:true,mime:true,createdAt:true}}}},stages:{include:{attachments:{select:{id:true,name:true,mime:true,createdAt:true}}}},serviceFees:true}});
 assert.equal(business.status,'COMPLETED');assert(business.completedAt);
 assert(business.tasks.length&&business.tasks.every(t=>t.status==='COMPLETED'&&t.unloadedKg>0));
 assert(business.stages.length&&business.stages.every(stage=>stage.status==='COMPLETED'));
 assert.equal(business.package.traderId,b.traderId);assert.equal(business.package.carrierId,b.carrierId);
 assert.equal(parse(business.package.snapshot).sourceSystem,'BUSINESS_INITIALIZATION');
 assert.equal(await tx.billTask.count({where:{taskId:{in:business.tasks.map(t=>t.id)}}}),0);
 const fees=business.serviceFees.filter(f=>f.selected).sort((a,z)=>a.id.localeCompare(z.id,undefined,{numeric:true}));
 assert(fees.length&&fees.every(f=>!f.billId||f.billId===b.id));
 assert.equal(fees.reduce((sum,f)=>sum+f.amountCents,0),b.totalCents);
 const bySegment=new Map();for(const t of business.tasks)bySegment.set(t.segment,(bySegment.get(t.segment)||0)+t.unloadedKg);
 const quantityKg=Math.max(...bySegment.values());assert.equal(quantityKg,b.quantityKg);
 const trader=await party(tx,b.traderId),carrier=await party(tx,b.carrierId),admin=await party(tx,'platform');
 const audit=new Audit();
 const proxy=new Proxy(tx,{get(target,key){if(key==='$transaction')return async callback=>callback(tx);const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 const billing=new BillingService(proxy,audit,new ContractsService(proxy,audit));
 const carrierReq=request(carrier),traderReq=request(trader),adminReq=request(admin);
 // These generated historical waybills are already completed. Import their
 // corresponding execution state without inventing signatures or bank proofs.
 assert(['DRAFT','EFFECTIVE'].includes(business.package.status));
 await tx.contractPackage.update({where:{id:b.packageId},data:{status:'EFFECTIVE',effectiveAt:business.package.effectiveAt||new Date(b.periodFrom.getTime()-3600000)}});
 const revision=business.package.revisions.sort((a,z)=>z.number-a.number)[0];assert(revision);
 await tx.contractRevision.update({where:{id:revision.id},data:{status:'EFFECTIVE'}});
 await audit.write(tx,adminReq,'对账结算',b.id,'导入已完成运单的履约结算流程',undefined,{sourceSystem:source,packageId:b.packageId,originalContractStatus:business.package.status,externalSignaturesCreated:false});
 const old=parse(b.reference),originalSnapshot=old.snapshot;
 const snapshot={provenance:originalSnapshot.provenance,grain:originalSnapshot.grain,loadingType:originalSnapshot.loadingType,origin:originalSnapshot.origin,destination:originalSnapshot.destination,quantityKg:originalSnapshot.quantityKg,totalCents:originalSnapshot.totalCents,confirmationNo:originalSnapshot.confirmationNo,demandNo:originalSnapshot.demandNo,
  trader:{id:trader.businessEntity.id,name:trader.businessEntity.name},carrier:{id:carrier.businessEntity.id,name:carrier.businessEntity.name}};
 const reference={...old,snapshot,terms:parse(revision.terms),tasks:business.tasks,stages:business.stages,fees,
  billingInitialization:{sourceSystem:source,version:1,generatedAt:new Date().toISOString(),note:'按现有已完成运单补充的流程展示数据；非真实付款或银行回单。'}};
 await tx.bill.update({where:{id:b.id},data:{serviceCompletionKey:business.id,quantityKg,reference:JSON.stringify(reference),remark:`运单 ${business.waybillNo} 费用汇总；按运输阶段及作业费用逐项核对。`,tasks:{create:business.tasks.map(t=>({taskId:t.id}))}}});
 await tx.billItem.deleteMany({where:{billId:b.id}});
 await tx.billItem.createMany({data:fees.map((f,i)=>({billId:b.id,sequence:i+1,feeCode:f.feeCode,feeName:f.name,sourceType:f.source,sourceId:f.id,stageId:f.stageId,taskId:f.taskId,mode:business.stages.find(stage=>stage.id===f.stageId)?.mode||'MULTIMODAL',resource:business.tasks.find(t=>t.id===f.taskId)?.resource||business.waybillNo,quantityMillis:1000,unit:'次',unitPriceCents:f.amountCents,originalCents:f.amountCents,finalCents:f.amountCents,adjustmentCents:0,occurredAt:b.periodTo,basis:f.description||f.name}))});
 await tx.serviceFee.updateMany({where:{id:{in:fees.map(f=>f.id)}},data:{billId:b.id}});
 await billing.snapshot(tx,b.id,carrierReq,'已完成运单费用汇总草稿');
 let bill=await billing.action(b.id,'submit',{version:1},carrierReq);
 if(s.status==='DISPUTED'){
  bill=await billing.action(b.id,'check',{version:bill.version},traderReq);
  const item=bill.items.find(i=>i.feeCode==='PORT_MISC')||bill.items.at(-1);
  await billing.difference(b.id,{version:bill.version,itemSequence:item.sequence,type:'EVIDENCE',acceptedCents:0,description:'港口杂项作业费需补充装卸作业清单及计费依据，待承运方核对后重新提交。'},traderReq);
 }else if(s.status==='CONFIRMED'){
  bill=await billing.action(b.id,'check',{version:bill.version},traderReq);
  bill=await billing.action(b.id,'confirm',{version:bill.version},traderReq);
  const settlement=bill.settlement,amountCents=s.settlement==='PARTIAL'?Math.floor(settlement.confirmedCents*6/10):settlement.confirmedCents;
  const at=new Date(),file=paymentNote(bill,settlement,amountCents,at),evidence=await billing.upload(b.id,file,traderReq);
  const record=await billing.record(settlement.id,{version:settlement.version,requestKey:`billing-flow-init-${s.index}-payment-1`,amountCents,method:'线下结算登记',plannedAt:at.toISOString(),actualAt:at.toISOString(),evidenceId:evidence.id,note:'流程数据初始化：费用核对后的结算登记说明，非真实付款。'},traderReq);
  const current=await tx.settlement.findUniqueOrThrow({where:{id:settlement.id}});
  await billing.confirmRecord(settlement.id,record.id,{version:current.version,accepted:true,reason:'流程数据初始化：双方核对登记金额一致。'},carrierReq);
 }
}

async function verify(client){
 const report=[];
 for(const {bill:b,scenario:s,alreadyApplied} of await plans(client)){
  assert(alreadyApplied,`Uninitialized bill ${b.id}`);assert.equal(b.status,s.status);
  assert.equal(b.items.reduce((n,i)=>n+i.finalCents,0),b.totalCents);
  assert(b.items.every(i=>i.finalCents===i.originalCents+i.adjustmentCents));
  assert.equal(b.versions.length,b.version);assert.equal(b.versions.at(-1).number,b.version);
  const latest=parse(b.versions.at(-1).snapshot);assert.equal(latest.totalCents,b.totalCents);assert.equal(latest.status,b.status);
  const ref=parse(b.reference);assert.equal(b.tasks.length,ref.tasks.length);assert(b.tasks.length>0);
  const sourceFees=await client.serviceFee.findMany({where:{billId:b.id}});
  assert.equal(sourceFees.reduce((n,f)=>n+f.amountCents,0),b.totalCents);
  assert(b.items.every(i=>sourceFees.some(f=>f.id===i.sourceId&&f.amountCents===i.originalCents)));
  if(s.settlement){
   assert.equal(b.settlement.status,s.settlement);assert.equal(b.settlement.confirmedCents,b.totalCents);
   assert.equal(b.settlement.settledCents,b.settlement.records.filter(r=>r.status==='CONFIRMED').reduce((n,r)=>n+r.amountCents,0));
   assert(b.settlement.settledCents<=b.totalCents);
   for(const record of b.settlement.records){assert.notEqual(record.registeredBy,record.confirmedBy);const e=await client.billEvidence.findUniqueOrThrow({where:{id:record.evidenceId}});assert.equal(sha(Buffer.from(e.bytes)),e.digest);assert.equal(e.billId,b.id);}
   assert.equal(!!b.archivedAt,s.settlement==='SETTLED');
  }else assert.equal(b.settlement,null);
  if(s.status==='DISPUTED')assert(b.differences.some(d=>d.status==='OPEN'));
  report.push({billNo:b.businessNo,waybillNo:ref.waybillNo,trader:ref.snapshot.trader.name,carrier:ref.snapshot.carrier.name,status:b.status,totalCents:b.totalCents,items:b.items.length,tasks:b.tasks.length,versions:b.versions.length,settlement:b.settlement?{status:b.settlement.status,confirmedCents:b.settlement.confirmedCents,settledCents:b.settlement.settledCents,remainingCents:b.settlement.confirmedCents-b.settlement.settledCents}:null});
 }
 return {sourceSystem:source,verifiedAt:new Date().toISOString(),bills:report,externalPaymentsSent:false};
}

async function main(){
 const plan=await plans(db);
 if(process.argv.includes('--verify')){console.log(JSON.stringify(await verify(db),null,2));return;}
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({mode:'preview',sourceSystem:source,bills:plan.map(p=>({id:p.bill.id,billNo:p.bill.businessNo,amountCents:p.bill.totalCents,current:p.bill.status,target:p.scenario.status,settlement:p.scenario.settlement,alreadyApplied:p.alreadyApplied}))},null,2));return;}
 if(plan.some(p=>!p.alreadyApplied)){
  const backup=resolve('.local/backups/billing-flow-'+new Date().toISOString().replace(/[:.]/g,'-'));
  const result=spawnSync(process.execPath,['tools/backup.mjs',backup],{cwd:resolve(__dirname,'..'),encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr||result.stdout);console.log(result.stdout.trim());
  await db.$transaction(async tx=>{for(const p of await plans(tx))if(!p.alreadyApplied)await applyOne(tx,p);await verify(tx);},{timeout:60000});
 }
 const report=await verify(db);await mkdir(resolve('docs/acceptance'),{recursive:true});await writeFile(resolve('docs/acceptance/billing-workflow-initialization.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
