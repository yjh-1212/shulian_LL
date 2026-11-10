/* Read-only preview by default; --apply imports business authorization/subscription
 * workflow records for trader-a, with a database backup and one transaction.
 * Requests use existing published products; queries read the current business ledger.
 * Full access keys are never logged or persisted by this script.
 */
require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');
const {randomUUID}=require('node:crypto');
const {resolve}=require('node:path');
const {spawnSync}=require('node:child_process');
const {mkdir,writeFile}=require('node:fs/promises');
const assert=require('node:assert/strict');
const {DataService}=require('../apps/api/dist/data-service');
const {Audit}=require('../apps/api/dist/audit');
const db=new PrismaClient(),source='DATA_SERVICE_BUSINESS_INITIALIZATION';
const marker='data-service-business-v1',entityId='trader-a';
const profiles=[
 {dataset:'CAPACITY',department:'物流计划部',applicationName:'粮食运输计划工作台',scenarios:['运输规划'],purpose:'查询盘锦至广州粮食联运运力与运价区间，辅助运输计划编制和承运方案比选。',edition:'STANDARD',scope:'PUBLIC',origin:'盘锦市',destination:'广州市',days:90,
  subscriptions:[{name:'盘锦—广州联运运力查询',frequency:'每小时',mode:'API',dailyLimit:300},{name:'盘锦—广州运力日清单',frequency:'每日',mode:'FILE',dailyLimit:50}]},
 {dataset:'CORRIDOR',department:'运营分析部',applicationName:'粮食通道运营看板',scenarios:['经营分析','运输规划'],purpose:'按周汇总粮食物流通道的发运、在途和到达情况，用于运输组织与通道运行分析。',edition:'STANDARD',scope:'AGGREGATE',days:90,
  subscriptions:[{name:'粮食通道运行周报',frequency:'每日',mode:'FILE',dailyLimit:80}]},
 {dataset:'TRACE',department:'物流执行部',applicationName:'联运全过程跟踪',scenarios:['运输执行'],purpose:'核验本企业指定运单的出库、发运、中转和签收事件，追踪粮食运输交付进度。',edition:'BASIC',scope:'OWN',days:90,waybillIds:['business-init-v1-waybill-13','business-init-v1-waybill-15'],
  subscriptions:[{name:'重点粮食运单链路核验',frequency:'按需',mode:'API',dailyLimit:100}]},
 {dataset:'CREDIT',department:'采购与合作部',applicationName:'承运商合作评估',scenarios:['合作评估'],purpose:'参考承运主体的履约稳定性、准时率和结算表现，为粮食运输合作评估提供依据。',edition:'STANDARD',scope:'PUBLIC',days:90,
  subscriptions:[{name:'承运商履约评估月度资料',frequency:'按需',mode:'FILE',dailyLimit:20,paused:true}]},
 {dataset:'RISK',department:'物流调度部',applicationName:'在途运输风险监测',scenarios:['运输执行'],purpose:'关注本企业在途粮食运单及公共通道风险，辅助识别延误并协调港站衔接安排。',edition:'STANDARD',scope:'OWN',days:5,
  subscriptions:[{name:'在途粮食运输风险提醒',frequency:'实时',mode:'API',dailyLimit:300}]},
];
const requestId=(dataset,suffix='approved')=>`${marker}-request-${dataset.toLowerCase()}-${suffix}`;
const req=user=>({user,headers:{'user-agent':source},ip:'127.0.0.1',requestId:randomUUID()});
const parse=value=>typeof value==='string'?JSON.parse(value):value;
async function actor(client,username){const user=await client.user.findUniqueOrThrow({where:{username},include:{businessEntity:true,roles:{include:{role:{include:{permissions:{include:{permission:true}}}}}}}});assert.equal(user.status,'ACTIVE');assert.equal(user.deletedAt,null);return {...user,roles:user.roles.map(r=>r.role),permissions:[...new Set(user.roles.flatMap(r=>r.role.permissions.map(p=>p.permission.code)))]};}
async function report(client){
 const requests=await client.dataAccessRequest.findMany({where:{id:{startsWith:marker}},include:{product:{select:{code:true,dataset:true,name:true}}},orderBy:{id:'asc'}});
 const grants=await client.dataAuthorization.findMany({where:{requestId:{in:requests.map(r=>r.id)}},include:{product:true,subscriptions:{include:{calls:{select:{status:true,rows:true,channel:true}}}}}});
 return {sourceSystem:source,entityId,requests:requests.map(r=>({id:r.id,product:r.product.code,applicationName:r.applicationName,status:r.status})),authorizations:grants.map(g=>({id:g.id,product:g.product.code,scope:g.scope,status:g.status,startsAt:g.startsAt,expiresAt:g.expiresAt,dailyLimit:g.dailyLimit,subscriptions:g.subscriptions.map(s=>({id:s.id,name:s.name,mode:s.mode,frequency:s.frequency,status:s.status,dailyLimit:s.dailyLimit,successfulQueries:s.calls.filter(c=>c.status==='SUCCESS').length,returnedRows:s.calls.filter(c=>c.status==='SUCCESS').map(c=>c.rows)}))}))};
}
async function verify(client){
 const data=await report(client);assert.equal(data.requests.length,7);assert.equal(data.authorizations.length,5);assert.equal(data.authorizations.flatMap(g=>g.subscriptions).length,6);
 assert.deepEqual(data.requests.reduce((counts,r)=>(counts[r.status]=(counts[r.status]||0)+1,counts),{}),{APPROVED:5,PENDING:1,REJECTED:1});
 const grants=await client.dataAuthorization.findMany({where:{requestId:{startsWith:marker}},include:{product:true,subscriptions:true}});
 for(const g of grants){assert.equal(g.entityId,entityId);assert.equal(g.productVersion,g.product.version);assert.equal(g.product.status,'PUBLISHED');assert(g.startsAt<g.expiresAt);assert(parse(g.fields).every(f=>parse(g.product.fields).includes(f)));assert(g.subscriptions.every(s=>s.dailyLimit<=g.dailyLimit));assert(g.subscriptions.reduce((n,s)=>n+s.dailyLimit,0)<=g.dailyLimit);
  const constraints=parse(g.constraints);assert.equal(constraints.initializationSource,source);
  if(g.product.dataset==='CAPACITY'){assert.equal(constraints.origin,'盘锦市');assert.equal(constraints.destination,'广州市');}
  if(g.product.dataset==='TRACE'){assert.equal(constraints.waybillIds.length,2);assert.equal(await client.logisticsBusiness.count({where:{id:{in:constraints.waybillIds},package:{traderId:entityId,isTestData:false}}}),2);}
 }
 const subs=data.authorizations.flatMap(g=>g.subscriptions);assert.equal(subs.filter(s=>s.status==='PAUSED').length,1);assert(subs.every(s=>s.successfulQueries>=1));assert(!/phase\s*8|浏览器验收|文件验收/i.test(JSON.stringify(data)));
 return {...data,verified:true};
}
async function initialize(tx){
 const trader=await actor(tx,'trader'),admin=await actor(tx,'admin');assert.equal(trader.businessEntityId,entityId);assert(trader.permissions.includes('data:subscribe'));assert(admin.permissions.includes('data:write'));
 const proxy=new Proxy(tx,{get(target,key){if(key==='$transaction')return async callback=>callback(tx);const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 const service=new DataService(proxy,new Audit()),traderReq=req(trader),adminReq=req(admin);
 const now=new Date(),from=new Date(now.getTime()-60000).toISOString();
 const products=await tx.dataProduct.findMany({where:{code:{in:profiles.map(p=>'GDS-'+p.dataset)},status:'PUBLISHED'}});assert.equal(products.length,5);
 async function apply(profile,suffix='approved'){
  const product=products.find(p=>p.dataset===profile.dataset);
  const x=await service.request({...profile,productId:product.id,startsAt:from,expiresAt:new Date(now.getTime()+profile.days*86400000).toISOString(),accepted:true},traderReq);
  const id=requestId(profile.dataset,suffix);
  await tx.dataAccessRequest.update({where:{id:x.id},data:{id,constraints:JSON.stringify({...parse(x.constraints),initializationSource:source})}});
  await tx.auditLog.updateMany({where:{objectId:x.id,module:'数据服务',userAgent:source},data:{objectId:id}});
  return {...x,id};
 }
 for(const profile of profiles){
  const x=await apply(profile);
  await service.review(x.id,{version:x.version,status:'APPROVED',dailyLimit:profile.edition==='BASIC'?100:1000,note:profile.dataset==='TRACE'?'按本企业指定的两笔粮食运单授权，限结构化节点核验。':profile.dataset==='CAPACITY'?'按盘锦至广州线路授权，提供脱敏运力与参考价格区间。':'按申请用途授权当前产品字段，禁止超范围使用或对外转售。'},adminReq);
  const grant=await tx.dataAuthorization.findUniqueOrThrow({where:{requestId:x.id}});
  for(const definition of profile.subscriptions){
   const {paused,...input}=definition;
   const subscription=await service.subscribe({...input,authorizationId:grant.id},traderReq);
   // Use the service's normal query path, with real scoped ledger rows and real
   // call accounting. Do not store the one-time plaintext key from subscribe().
   const query=profile.dataset==='TRACE'?{waybillNo:'YD2026100013'}:profile.dataset==='CORRIDOR'?{period:'WEEK'}:profile.dataset==='CREDIT'?{months:'3'}:{};
   await service.call(subscription.id,undefined,{...traderReq,requestId:randomUUID()},'PREVIEW',query);
   if(profile.dataset==='CAPACITY'||profile.dataset==='RISK')await service.call(subscription.id,undefined,{...traderReq,requestId:randomUUID()},'PREVIEW',query);
   if(paused)await service.state('dataSubscription',subscription.id,{version:subscription.version,status:'PAUSED'},traderReq);
  }
 }
 await apply({...profiles[0],applicationName:'东北产区补充运力计划',origin:'哈尔滨市',destination:'东莞市',purpose:'申请补充哈尔滨至东莞的粮食联运运力查询范围，用于下一批次采购发运计划。'},'pending');
 const rejected=await apply({...profiles[2],applicationName:'采购交付资料核验',purpose:'申请取得指定运单的原始签收影像与合同价格明细，用于采购交付资料核验。'},'rejected');
 await service.review(rejected.id,{version:rejected.version,status:'REJECTED',note:'该产品仅提供结构化运输节点，不开放原始单据影像与合同价格。请调整为链路核验用途后重新申请。'},adminReq);
 await verify(tx);
}
async function main(){
 const current=await report(db);
 if(process.argv.includes('--verify')){console.log(JSON.stringify(await verify(db),null,2));return;}
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({mode:'preview',entityId,sourceSystem:source,existingRequests:current.requests.length,planned:{approvedRequests:5,pendingRequests:1,rejectedRequests:1,authorizations:5,subscriptions:6},profiles:profiles.map(p=>({product:'GDS-'+p.dataset,scope:p.scope,application:p.applicationName,days:p.days,subscriptions:p.subscriptions.map(s=>({name:s.name,mode:s.mode,dailyLimit:s.dailyLimit,status:s.paused?'PAUSED':'ACTIVE'}))}))},null,2));return;}
 if(!current.requests.length){
  const backup=resolve('.local/backups/data-service-records-'+new Date().toISOString().replace(/[:.]/g,'-'));
  const result=spawnSync(process.execPath,['tools/backup.mjs',backup],{cwd:resolve(__dirname,'..'),encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr||result.stdout);console.log(result.stdout.trim());
  await db.$transaction(initialize,{timeout:90000});
 }
 const data=await verify(db);await mkdir(resolve('docs/acceptance'),{recursive:true});await writeFile(resolve('docs/acceptance/data-service-business-records.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data,null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
