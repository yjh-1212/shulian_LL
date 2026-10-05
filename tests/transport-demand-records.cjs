// Read-only audit of the new initialization and the records preserved in its backup.
require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');
const {strict:assert}=require('node:assert');
const {createHash}=require('node:crypto');
const fs=require('node:fs/promises'),path=require('node:path');
const {SOURCE,MARKER,main:initialize}=require('../tools/initialize-transport-demand-records.cjs');
const {TransportService}=require('../apps/api/dist/transport.service');
const db=new PrismaClient();let previous;
const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const proof={checkedAt:new Date().toISOString(),checks:[]};
function pass(text){proof.checks.push(text);console.log('PASS '+text);}
async function main(){
  const manifest=JSON.parse(await fs.readFile('docs/acceptance/transport-demand-records.json','utf8'));
  const backupManifest=JSON.parse(await fs.readFile(path.join(path.dirname(manifest.backupPath),'manifest.json'),'utf8'));
  assert.equal(sha(await fs.readFile(manifest.backupPath)),backupManifest.sha256);
  previous=new PrismaClient({datasources:{db:{url:'file:'+manifest.backupPath.replace(/\\/g,'/')}}});
  const orders=await db.tradeOrder.findMany({where:{sourceSystem:SOURCE},include:{items:{include:{grain:true,demands:true}}}});
  assert.equal(orders.length,10);
  for(const order of orders){assert.equal(order.sourceType,'INITIALIZATION');assert.equal(order.isTestData,false);assert.equal(order.status,'ACTIVE');assert.equal(order.businessEntityId,'trader-a');assert.equal(order.items.length,1);const item=order.items[0];assert.equal(item.reservedKg,0);assert.equal(item.demands.length,0);assert.ok(item.quantityKg>=600000&&item.quantityKg<=2400000);assert.equal(item.quantityKg%100,0);assert.equal(item.pickupCodes.split('/').length,3);assert.equal(order.shipperPhone,'');}
  assert.deepEqual([...new Set(orders.flatMap(order=>order.items.map(item=>item.grain.label)))].sort(),['玉米','大豆','小麦','稻谷'].sort());
  pass('10 条待核验交易覆盖四种粮食，所有余量完整且没有转换为需求');
  const drafts=await db.transportDemand.findMany({where:{id:{in:manifest.demands.map(d=>d.id)}},include:{modes:{include:{mode:true}},publications:true,planRuns:true}});
  assert.equal(drafts.length,4);for(const draft of drafts){assert.equal(draft.orderItemId,null);assert.equal(draft.status,'DRAFT');assert.equal(draft.matchedKg,0);assert.equal(draft.matchStage,'UNMATCHED');assert.equal(draft.publications.length,0);assert.equal(draft.planRuns.length,0);assert.equal(draft.budgetCents,null);assert.equal(draft.sourceType,'INITIALIZATION');assert.equal(draft.quantityKg%100,0);assert.ok(draft.arrivalAt>draft.departureAt);assert.equal(draft.originCodes.split('/').length,3);assert.equal(draft.destinationCodes.split('/').length,3);}
  assert.deepEqual(drafts.map(d=>d.modes.map(m=>m.mode.label).sort().join('/')).sort(),[['公路','水运'],['铁路','水运'],['公路','铁路'],['公路','铁路','水运']].map(m=>m.sort().join('/')).sort());
  pass('4 条独立草稿覆盖公铁、公水、铁水、公铁水，未发布、未占用订单');
  const service=new TransportService(db,{write:async()=>undefined});const identities={};for(const username of ['trader','trader.b','admin','carrier'])identities[username]={user:await db.user.findUniqueOrThrow({where:{username},include:{businessEntity:true}})};
  const own=await service.orders({q:'JY2026100301',page:1,pageSize:100,order:'desc'},identities.trader);assert.equal(own.total,10);assert.ok(own.items.every(row=>row.remainingQuantity===row.quantity));
  const other=await service.orders({q:'JY2026100301',page:1,pageSize:100,order:'desc'},identities['trader.b']);assert.equal(other.total,0);
  assert.equal((await service.demands({q:'XQ2026100301',page:1,pageSize:100,order:'desc'},identities.trader)).total,4);
  assert.equal((await service.demands({q:'XQ2026100301',page:1,pageSize:100,order:'desc'},identities['trader.b'])).total,0);
  assert.equal((await service.demands({q:'XQ2026100301',page:1,pageSize:100,order:'desc'},identities.carrier)).total,0);
  pass('新订单和草稿只属于当前贸易企业，其他企业不可选取或查看草稿');
  for(const model of ['tradeOrder','tradeOrderItem','transportDemand','contractTemplate','contractTemplateFile','contractPackage','contractRevision','contractSignature','contractArchive','logisticsBusiness','transportStage','transportTask','serviceFee','bill','settlement','settlementRecord']){
    const table=model[0].toUpperCase()+model.slice(1),columns=await previous.$queryRawUnsafe(`PRAGMA table_info("${table}")`),select=Object.fromEntries(columns.map(column=>[column.name,true]));
    const old=await previous[model].findMany({select,orderBy:{id:'asc'}});const kept=await db[model].findMany({select,where:{id:{in:old.map(row=>row.id)}},orderBy:{id:'asc'}});assert.equal(sha(kept),sha(old),model+' 的既有记录发生变化');
  }
  pass('原交易、需求、合同、模板、运单、任务、费用、账单和结算保持原值');
  const audit=await db.auditLog.findUniqueOrThrow({where:{id:MARKER}});assert.equal(JSON.parse(audit.after).provenance.verification,'UNVERIFIED_BUSINESS_RECORD');
  const beforeCounts=[await db.tradeOrder.count(),await db.transportDemand.count(),await db.auditLog.count()];
  const originalLog=console.log;let output;try{console.log=value=>{output=JSON.parse(value);};await initialize();}finally{console.log=originalLog;}
  assert.equal(output.status,'ALREADY_INITIALIZED');assert.deepEqual([await db.tradeOrder.count(),await db.transportDemand.count(),await db.auditLog.count()],beforeCounts);
  pass('来源、核验状态和备份完整，重复执行不会追加或覆盖资料');
  await fs.writeFile('docs/acceptance/transport-demand-records-tests.json',JSON.stringify({...proof,tradeCount:10,independentDemandCount:4,owner:'trader-a'},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(previous)await previous.$disconnect();await db.$disconnect();});
