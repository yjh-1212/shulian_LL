const {assert,base,login,report}=require('./helpers789.cjs');
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient(),results=[],prefix='ds-check-'+Date.now(),requestIds=[],subIds=[],packageIds=[],businessIds=[],taskIds=[];
const pass=name=>{results.push({name,result:'PASS'});console.log('PASS',name);};
const day=n=>new Date(Date.now()+n*86400000).toISOString();
const rawFeed=async(key,query='',status=200)=>{const r=await fetch(base+'/data-feed'+query,{headers:{'X-Data-Key':key}});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data;};
let carrierId,supplyId,signalId;
async function fixture(){
 carrierId=prefix+'-carrier';const org=await db.organization.findFirstOrThrow();
 await db.businessEntity.create({data:{id:carrierId,name:prefix+'验收承运企业',type:'CARRIER',organizationId:org.id,registeredRegion:'辽宁省 / 营口市',phone:'私密电话不可导出',isTestData:false}});
 const mode=await db.dictionary.findFirstOrThrow({where:{group:'运输方式',label:'多式联运'}}),grain=await db.dictionary.findFirstOrThrow({where:{group:'粮食品种',label:'玉米'}});
 const s=await db.transportSupply.create({data:{businessNo:prefix+'-supply',name:'验收运力',businessEntityId:carrierId,modeId:mode.id,originCodes:'210000/210800',originRegion:'辽宁省 / 营口市',originAddress:'私密地址',destinationCodes:'440000/440100',destinationRegion:'广东省 / 广州市',destinationAddress:'私密地址',capacityKg:800000,minKg:100000,maxKg:800000,resourceType:'MULTIMODAL',resourceDescription:'测试用运力',loadingType:'BULK',bulkPriceCents:27345,contact:'私密联系人不可导出',phone:'私密电话不可导出',createdBy:'test',updatedBy:'test',sourceType:'TEST',status:'PUBLISHED',isTestData:false,grains:{create:{grainId:grain.id}}}});supplyId=s.id;
 for(let i=0;i<4;i++){
  const id=prefix+'-package-'+i;packageIds.push(id);
  await db.contractPackage.create({data:{id,businessNo:prefix+'-HT-'+i,confirmationId:prefix+'-confirm-'+i,traderId:i===3?'trader-b':'trader-a',carrierId,platformId:'platform',quantityKg:100000,totalCents:2734500,status:'EFFECTIVE',isTestData:false,snapshot:JSON.stringify({origin:'辽宁省营口市私密粮库地址',destination:'广东省广州市私密仓库地址',grain:{name:'玉米'},loadingType:'BULK',trader:{phone:'私密电话不可导出'}})}});
  const b=await db.logisticsBusiness.create({data:{businessNo:prefix+'-LY-'+i,waybillNo:prefix+'-YD-'+i,packageId:id,mode:'ONE',status:i===0?'COMPLETED':'EXECUTING',completedAt:i===0?new Date():null,segments:JSON.stringify([{mode:'ROAD',origin:{city:'营口市'},destination:{city:'营口市'}},{mode:'WATER',origin:{city:'营口市'},destination:{city:'广州市'}}])}});businessIds.push(b.id);
  for(let k=0;k<2;k++){
   const st=await db.transportStage.create({data:{businessId:b.id,sequence:k+1,mode:k?'WATER':'ROAD',origin:'营口港',destination:k?'广州港':'营口港',quantityKg:100000,plannedStartAt:new Date(Date.now()-864e5),plannedEndAt:new Date(Date.now()+864e5),submittedAt:new Date(Date.now()-3600e3),completedAt:i===0?new Date():null,status:i===0?'COMPLETED':'SUBMITTED'}});
   const t=await db.transportTask.create({data:{businessNo:prefix+'-TASK-'+i+'-'+k,businessId:b.id,stageId:st.id,segment:k+1,mode:k?'WATER':'ROAD',quantityKg:100000,resource:JSON.stringify({phone:'私密司机不可导出'}),status:i===0?'COMPLETED':'ACCEPTED',events:{create:{requestKey:prefix+'-event-'+i+'-'+k,type:'DEPART',source:'EXECUTION',userId:'test',payload:JSON.stringify({phone:'私密司机不可导出'})}}}});taskIds.push(t.id);
   if(i===1&&k===0||i===3&&k===0)await db.riskRecord.create({data:{taskId:t.id,type:'DEVIATION',level:'MEDIUM',status:'ONGOING',message:i===3?'其他客户私密预警不可导出':'验收在途路线偏移'}});
  }
 }
 const sig=await db.monitoringSignal.create({data:{kind:'PORT',name:prefix+'公共拥堵',region:'营口市',level:'MEDIUM',delayMinutes:240,details:'测试公共态势',source:'验收来源',sourceUrl:'',observedAt:new Date(),validFrom:new Date(Date.now()-3600000),validTo:new Date(Date.now()+3600000),isTestData:false}});signalId=sig.id;
}
async function cleanup(){
 await db.dataCall.deleteMany({where:{subscriptionId:{in:subIds}}});await db.dataSubscription.deleteMany({where:{id:{in:subIds}}});
 await db.dataAuthorization.deleteMany({where:{requestId:{in:requestIds}}});await db.dataAccessRequest.deleteMany({where:{id:{in:requestIds}}});
 await db.riskRecord.deleteMany({where:{taskId:{in:taskIds}}});await db.forecast.deleteMany({where:{taskId:{in:taskIds}}});
 await db.executionEvent.deleteMany({where:{taskId:{in:taskIds}}});await db.transportTask.deleteMany({where:{id:{in:taskIds}}});
 await db.transportStage.deleteMany({where:{businessId:{in:businessIds}}});await db.logisticsBusiness.deleteMany({where:{id:{in:businessIds}}});await db.contractPackage.deleteMany({where:{id:{in:packageIds}}});
 if(signalId)await db.monitoringSignal.delete({where:{id:signalId}});if(supplyId){await db.supplyGrain.deleteMany({where:{supplyId}});await db.transportSupply.delete({where:{id:supplyId}});}if(carrierId)await db.businessEntity.delete({where:{id:carrierId}});
}
(async()=>{try{
 const t=await login('trader'),other=await login('trader.b'),c=await login('carrier'),a=await login('admin');
 const products=await t.call('GET','/data/products');const catalog=products.filter(p=>p.code.startsWith('GDS-'));assert.equal(catalog.length,5);assert(catalog.every(p=>p.status==='PUBLISHED'&&!p.versions));
 for(const user of [t,c,a]){const menus=await user.call('GET','/menus');const m=menus.find(x=>x.path==='/data');assert(m);assert.equal(m.children.length,0);}
 await t.call('POST','/data/products',{},403);await c.call('POST','/data/authorizations',{},403);await t.call('GET','/data/applications',undefined,403);
 const scenes=await t.call('GET','/data/scenarios');assert.equal(scenes.length,4);assert(scenes.every(s=>s.products.length));pass('三类主体单一菜单、五项产品目录与业务场景、平台维护权限');
 await fixture();const map=Object.fromEntries(catalog.map(p=>[p.dataset,p]));
 const input=(dataset,extra={})=>({productId:map[dataset].id,department:'测试物流部',applicationName:'数据服务验收应用',scenarios:['运输规划'],purpose:'验证平台数据服务授权范围及实际查询结果',edition:'BASIC',scope:map[dataset].profile.scopes[0],startsAt:day(-1),expiresAt:day(30),origin:'营口市',destination:'广州市',accepted:true,...extra});
 const request=async(dataset,extra={})=>{const x=await t.call('POST','/data/requests',input(dataset,extra));requestIds.push(x.id);return x;};
 const approve=async(x,limit=100)=>{await a.call('POST','/data/requests/'+x.id+'/review',{version:x.version,status:'APPROVED',note:'验收用途与范围审核通过',dailyLimit:limit});return (await t.call('GET','/data/authorizations')).find(g=>g.requestId===x.id);};
 const subscribe=async(g,mode='API',limit=100)=>{const s=await t.call('POST','/data/subscriptions',{authorizationId:g.id,name:'测试订阅'+mode,frequency:'按需',mode,dailyLimit:limit});subIds.push(s.id);return s;};
 await t.call('POST','/data/requests',input('CAPACITY',{accepted:false}),400);await t.call('POST','/data/requests',input('CAPACITY',{entityId:'trader-b'}),400);
 await t.call('POST','/data/requests',input('CAPACITY',{department:'  ',purpose:'            '}),400);
 const x=await request('CAPACITY');await t.call('POST','/data/requests',input('CAPACITY'),409);
 assert(!(await other.call('GET','/data/requests')).some(row=>row.id===x.id));await other.call('POST','/data/requests/'+x.id+'/withdraw',{version:1,status:'WITHDRAWN'},404);
 await t.call('POST','/data/requests/'+x.id+'/review',{version:1,status:'APPROVED',note:'越权审核'},403);
 const g=await approve(x);assert.equal(g.entityId,'trader-a');assert.deepEqual(g.constraints.origin,'营口市');await a.call('POST','/data/requests/'+x.id+'/review',{version:1,status:'APPROVED',note:'重复审核'},409);
 await other.call('POST','/data/subscriptions',{authorizationId:g.id,name:'越权订阅',frequency:'按需',mode:'API',dailyLimit:10},404);await t.call('POST','/data/subscriptions',{authorizationId:g.id,name:'超额订阅',frequency:'按需',mode:'API',dailyLimit:101},400);
 const s=await subscribe(g);const capacity=await rawFeed(s.key);assert(capacity.data.some(row=>row.providerCode&&row.priceBands.length));const serialized=JSON.stringify(capacity);assert(!serialized.includes('273.45'));assert(!serialized.includes('私密'));assert(!serialized.includes(carrierId));assert(capacity.data.every(row=>row.origin.includes('营口市')&&row.destination.includes('广州市')));
 await other.call('POST','/data/subscriptions/'+s.id+'/preview',{},404);await other.call('POST','/data/subscriptions/'+s.id+'/key',{version:1,status:'ACTIVE'},404);await other.call('GET','/data/subscriptions/'+s.id+'/file',undefined,404);assert(!(await other.call('GET','/data/subscriptions')).some(row=>row.id===s.id));
 const listed=await t.call('GET','/data/subscriptions');assert(!JSON.stringify(listed).includes(s.key));assert(listed.every(row=>!row.keyHash));pass('企业申请、平台审核、额度上限、跨企业隔离与运力字段脱敏');
 const traceRequest=await request('TRACE',{waybillIds:[businessIds[0]],scope:'OWN'});await t.call('POST','/data/requests',input('TRACE',{waybillIds:[businessIds[3]],scope:'OWN'}),400);
 const trace=await subscribe(await approve(traceRequest));await rawFeed(trace.key,'',400);await rawFeed(trace.key,'?waybillNo='+prefix+'-YD-3',404);const chain=await rawFeed(trace.key,'?waybillNo='+prefix+'-YD-0');assert(chain.data.length>0);assert(chain.data.every(e=>e.waybillNo===prefix+'-YD-0'));assert(!JSON.stringify(chain).includes('私密'));assert(await db.dataCall.count({where:{subscriptionId:trace.id,status:'FAILED'}})>=2);await t.call('GET','/data/subscriptions/'+trace.id+'/report',undefined,400);const traceReport=await t.raw('GET','/data/subscriptions/'+trace.id+'/report?waybillNo='+prefix+'-YD-0');assert.equal(traceReport.status,200);assert(traceReport.bytes.toString().includes(prefix+'-YD-0'));assert(!traceReport.bytes.toString().includes('私密'));await other.call('GET','/data/subscriptions/'+trace.id+'/report?waybillNo='+prefix+'-YD-0',undefined,404);pass('指定运单核验、禁止枚举、结构化事件、授权报告与完整调用审计');
 const corridor=await subscribe(await approve(await request('CORRIDOR',{scope:'OWN'})));const stats=await rawFeed(corridor.key,'?period=DAY');assert.equal(stats.data.length,1);assert.equal(stats.data[0].departedTons,300);assert.equal(stats.data[0].inTransitTons,200);assert.equal(stats.data[0].arrivedTons,100);assert(!JSON.stringify(stats).includes('私密'));assert(!JSON.stringify(stats).includes(prefix+'-YD'));pass('通道按大运单统计、跨阶段不重复计吨与私密地址隐藏');
 const credit=await subscribe(await approve(await request('CREDIT')));const portrait=await rawFeed(credit.key,'?months=3');assert(portrait.data.some(row=>row.providerName.endsWith('***')&&row.disclaimer.includes('法定信用评级')));assert(!JSON.stringify(portrait).includes('私密电话'));pass('承运画像统计、3个月查询、样本量说明与评级边界');
 const risk=await subscribe(await approve(await request('RISK',{scope:'OWN'})));const risks=await rawFeed(risk.key);assert(risks.data.some(row=>row.waybillNo===prefix+'-YD-1'));assert(!JSON.stringify(risks).includes('其他客户私密'));assert(risks.data.some(row=>row.riskId===signalId));
 const stream=await fetch(base+'/data-feed/events',{headers:{'X-Data-Key':risk.key}});assert.equal(stream.status,200);const reader=stream.body.getReader();const packet=await reader.read();assert(new TextDecoder().decode(packet.value).includes('event: risks'));await reader.cancel();pass('公共风险与本企业在途风险、风险事件流订阅');
 const limitedGrant=await approve(await request('CREDIT',{edition:'STANDARD'}),2),limited=await subscribe(limitedGrant,'API',2),file=await subscribe(limitedGrant,'FILE',2);await rawFeed(limited.key);const output=await t.raw('GET','/data/subscriptions/'+file.id+'/file');assert.equal(output.status,200);assert(JSON.stringify(output.json||output.bytes?.toString()).includes('providerCode'));await rawFeed(limited.key,'',429);
 await t.call('POST','/data/subscriptions/'+s.id+'/status',{version:s.version,status:'PAUSED'});await rawFeed(s.key,'',403);
 await t.call('POST','/data/subscriptions/'+s.id+'/status',{version:s.version+1,status:'ACTIVE'});const rotated=await t.call('POST','/data/subscriptions/'+s.id+'/key',{version:s.version+2,status:'ACTIVE'});await rawFeed(s.key,'',403);await rawFeed(rotated.key);
 await a.call('POST','/data/authorizations/'+g.id+'/status',{version:g.version,status:'REVOKED'});await rawFeed(rotated.key,'',403);pass('文件下载、授权共享额度、订阅暂停恢复、密钥轮换与授权撤销');
 const rejected=await request('RISK');await a.call('POST','/data/requests/'+rejected.id+'/review',{version:1,status:'REJECTED',note:'用途说明需补充'});const pending=await request('RISK');await t.call('POST','/data/requests/'+pending.id+'/withdraw',{version:1,status:'WITHDRAWN'});pass('退回后重新申请、撤回申请与审核状态控制');
 const future=await approve(await request('RISK',{startsAt:day(1),expiresAt:day(5)})),futureSub=await subscribe(future);await rawFeed(futureSub.key,'',403);assert.equal((await t.call('GET','/data/subscriptions')).find(x=>x.id===futureSub.id).effectiveStatus,'SCHEDULED');
 await db.dataAuthorization.update({where:{id:future.id},data:{startsAt:new Date(day(-2)),expiresAt:new Date(day(-1))}});await rawFeed(futureSub.key,'',403);pass('授权未生效与到期停止调用');
 report('data-service-workspace',results,{temporaryFixtures:'仅创建验收数据，结束后清理；已有业务保留',products:catalog.map(p=>({code:p.code,name:p.name}))});
}finally{await cleanup();await db.$disconnect();}})().catch(e=>{console.error(e.message.slice(-1800));process.exitCode=1;});
