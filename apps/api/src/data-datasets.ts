import {BadRequestException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {Database} from './database';
import {parse,sha} from './contracts.service';
import {DataQuery} from './data-service.dto';

const round=(n:number)=>Math.round(n*10)/10;
const inactive=['COMPLETED','CANCELLED','RETURNED'];
const mask=(name:string)=>name.slice(0,4)+'***';
const provider=(e:any)=>({providerCode:'CY-'+sha(e.id).slice(0,10).toUpperCase(),providerName:mask(e.name)});
const privateBusiness=(entity:any)=>entity.type==='PLATFORM'?{}:{OR:[{traderId:entity.id},{carrierId:entity.id}]};
const periodKey=(date:Date,period='WEEK')=>{
 const d=new Date(date);d.setUTCHours(0,0,0,0);
 if(period==='MONTH')return d.toISOString().slice(0,7);
 if(period==='WEEK')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 return d.toISOString().slice(0,10);
};
const band=(cents:number|null,step:number,type:string,unit:string)=>cents===null?null:{type,min:Math.floor(cents/100/step)*step,max:(Math.floor(cents/100/step)+1)*step,unit};
const advice=(type:string)=>type==='PORT_CONGESTION'?'核对港口预约和作业窗口，协调集港计划':type==='DEVIATION'?'联系调度核对路线和定位状态':'核对阶段执行与预计到达，及时协调后续衔接';

export class DataDatasets {
 constructor(private db:Database){}
 async rows(dataset:string,g:any,entity:any,q:DataQuery){
  if(dataset==='CAPACITY')return this.capacity(g,q);
  if(dataset==='CORRIDOR')return this.corridor(g,entity,q);
  if(dataset==='TRACE')return this.trace(g,entity,q);
  if(dataset==='CREDIT')return this.credit(q);
  if(dataset==='RISK')return this.risks(g,entity,q);
  if(dataset==='LINES')return (await this.db.transportLine.findMany({where:{enabled:true,quality:'VERIFIED',isTestData:false},include:{origin:true,destination:true},take:1000})).map(l=>({...l,origin:l.origin.name,destination:l.destination.name,distanceKm:l.distanceMeters/1000,durationMinutes:Math.round(l.durationSeconds/60),asOf:new Date()}));
  const where:any={business:{package:{isTestData:false,...(g.scope==='OWN'?privateBusiness(entity):{})}}};
  if(dataset==='METRICS'){
   const groups=await this.db.transportTask.groupBy({by:['mode','status'],where,_count:{id:true},_sum:{quantityKg:true}});
   return ['ROAD','RAIL','WATER'].map(mode=>({mode,taskCount:groups.filter(x=>x.mode===mode).reduce((s,x)=>s+x._count.id,0),completedCount:groups.filter(x=>x.mode===mode&&x.status==='COMPLETED').reduce((s,x)=>s+x._count.id,0),quantityKg:groups.filter(x=>x.mode===mode).reduce((s,x)=>s+(x._sum.quantityKg||0),0),asOf:new Date()}));
  }
  return (await this.db.transportTask.findMany({where,include:{business:{select:{segments:true}}},orderBy:{createdAt:'desc'},take:1000})).map(t=>({...t,origin:parse(t.business.segments)[t.segment-1]?.origin,destination:parse(t.business.segments)[t.segment-1]?.destination}));
 }
 async capacity(g:any,q:DataQuery){
  const c=parse(g.constraints),now=new Date();
  if(!c.origin||!c.destination)throw new ForbiddenException('运力产品须审核指定起讫线路后使用');
  const supplies=await this.db.transportSupply.findMany({where:{status:'PUBLISHED',deletedAt:null,isTestData:false,businessEntity:{status:'ACTIVE',deletedAt:null},originRegion:{contains:c.origin},destinationRegion:{contains:c.destination},AND:[{OR:[{validFrom:null},{validFrom:{lte:now}}]},{OR:[{validUntil:null},{validUntil:{gt:now}}]}]},include:{businessEntity:true,mode:true,grains:{include:{grain:true}}},take:1000});
  return Promise.all(supplies.filter(s=>(!q.origin||s.originRegion.includes(q.origin))&&(!q.destination||s.destinationRegion.includes(q.destination))).map(async s=>{
   const count=await this.db.contractPackage.count({where:{carrierId:s.businessEntityId,status:{in:['EFFECTIVE','COMPLETED']},isTestData:false}});
   return {...provider(s.businessEntity),origin:s.originRegion,destination:s.destinationRegion,modes:s.mode.label==='多式联运'?['公路','铁路','水运']: [s.mode.label],grains:s.grains.map(x=>x.grain.label),capacityMinTons:round((s.minKg||0)/1000),capacityMaxTons:round((s.maxKg||s.capacityKg)/1000),loadingType:s.loadingType,priceBands:[band(s.bulkPriceCents??(s.loadingType==='BULK'?s.referencePriceCents:null),50,'BULK','元/吨'),band(s.container20PriceCents,500,'20GP','元/箱'),band(s.container40PriceCents,500,'40GP','元/箱')].filter(Boolean),capacityState:'可用',servicePeriod:{from:s.serviceStart||s.validFrom,to:s.serviceEnd||s.validUntil},fulfillment:{effectiveOrCompletedOrders:count},asOf:now};
  }));
 }
 async corridor(g:any,entity:any,q:DataQuery){
  const from=q.from?new Date(q.from):new Date(Date.now()-30*86400000),to=q.to?new Date(q.to):new Date();
  if(from>=to||to.getTime()-from.getTime()>366*86400000)throw new BadRequestException('查询时段须为正且不超过一年');
  const businesses=await this.db.logisticsBusiness.findMany({where:{createdAt:{gte:from,lte:to},package:{isTestData:false,...(g.scope==='OWN'?privateBusiness(entity):{})}},include:{package:true,stages:true},take:1000});
  const signals=await this.db.monitoringSignal.findMany({where:{isTestData:false,validFrom:{lte:new Date()},validTo:{gt:new Date()},level:{not:'LOW'}},take:200});
  const grouped=new Map<string,any>();
  for(const b of businesses){
   const snap=parse(b.package.snapshot),origin=snap.origin||'未登记',destination=snap.destination||'未登记';
   if(q.origin&&!origin.includes(q.origin)||q.destination&&!destination.includes(q.destination))continue;
   // Use city/node corridor labels; never return a warehouse or private street address.
   const segments=parse(b.segments),nodeName=(v:any)=>{
    if(v?.city)return v.city;
    const name=typeof v==='string'?v:v?.name||'';
    const city=name.match(/(?:省|自治区)?([^省区县]{2,8}市)/)?.[1];
    return city||(/港(?:区)?$|站$/.test(name)?name:'未标准化通道');
   };
   const o=nodeName(segments[0]?.origin),d=nodeName(segments.at(-1)?.destination),period=periodKey(b.createdAt,q.period),modes=[...new Set(b.stages.map(s=>s.mode))].sort();
   const key=JSON.stringify([period,o,d,modes]);
   let group=grouped.get(key);if(!group){group={period,origin:o,destination:d,modes,departedTons:0,inTransitTons:0,arrivedTons:0,waybillCount:0,durations:[],waits:[],disturbances:[],asOf:new Date()};grouped.set(key,group);}
   group.waybillCount++;const qty=b.package.quantityKg/1000,started=b.status!=='PENDING'||b.stages.some(s=>['SUBMITTED','COMPLETED'].includes(s.status));
   if(started)group.departedTons+=qty;
   if(b.status==='COMPLETED')group.arrivedTons+=qty;else if(started)group.inTransitTons+=qty;
   if(b.completedAt){const starts=b.stages.map(s=>s.plannedStartAt.getTime());if(starts.length)group.durations.push((b.completedAt.getTime()-Math.min(...starts))/3600000);}
   const affected=signals.filter(s=>[origin,destination,o,d].some(v=>s.region&&v.includes(s.region)||s.name&&v.includes(s.name.split(' ')[0])));
   group.disturbances=[...new Set([...group.disturbances,...affected.map(s=>s.name)])];
   group.waits.push(...affected.map(s=>s.delayMinutes/60));
  }
  return [...grouped.values()].map(({durations,waits,...x})=>({...x,departedTons:x.waybillCount<3?null:round(x.departedTons),inTransitTons:x.waybillCount<3?null:round(x.inTransitTons),arrivedTons:x.waybillCount<3?null:round(x.arrivedTons),averageTransitHours:x.waybillCount>=3&&durations.length?round(durations.reduce((a:number,b:number)=>a+b,0)/durations.length):null,averageWaitHours:x.waybillCount>=3&&waits.length?round(waits.reduce((a:number,b:number)=>a+b,0)/waits.length):null,congestion:x.disturbances.length?'需关注':'无有效扰动记录'}));
 }
 async trace(g:any,entity:any,q:DataQuery){
  if(!q.waybillNo)throw new BadRequestException('链路核验须传入一个获授权运单号，禁止批量枚举');
  const c=parse(g.constraints);if(!c.waybillIds?.length)throw new ForbiddenException('授权未指定核验运单');
  const b=await this.db.logisticsBusiness.findFirst({
   where:{id:{in:c.waybillIds},OR:[{waybillNo:q.waybillNo},{businessNo:q.waybillNo}],package:{isTestData:false,...privateBusiness(entity)}},
   include:{stages:true,tasks:{include:{events:{orderBy:{createdAt:'asc'}},observations:{where:{isTestData:false},orderBy:{observedAt:'asc'}},evidence:{select:{category:true}}}}}
  });
  if(!b)throw new NotFoundException('运单未获授权或不在本企业业务范围');
  const events:any[]=[],names:Record<string,string>={ACCEPT:'任务接收',LOAD:'装货',DEPART:'发运',ARRIVE:'到达',UNLOAD:'卸货',SIGN:'签收',COMPLETE:'运输完成'};
  for(const t of b.tasks){const stage=b.stages.find(s=>s.id===t.stageId);for(const e of t.events){const payload=parse(e.payload);events.push({waybillNo:q.waybillNo,eventType:names[e.type]||e.type,occurredAt:e.createdAt,node:e.type==='ARRIVE'||e.type==='UNLOAD'?stage?.destination:stage?.origin,mode:t.mode,consistency:stage?stage.mode===t.mode?'与声明一致':'运输方式不一致':'声明不足，待核验',evidenceType:t.evidence.map(x=>x.category).join('、')||'无结构化凭证',dataQuality:e.source==='SIMULATED'?'模拟':'执行回传'});}
   for(const e of t.observations)events.push({waybillNo:q.waybillNo,eventType:e.eventType,occurredAt:e.observedAt,node:e.nodeName,mode:t.mode,consistency:stage&&stage.mode!==t.mode?'运输方式不一致':'节点事件待核验',evidenceType:'节点观测',dataQuality:'来源登记'});
  }
  for(const s of b.stages){if(s.submittedAt)events.push({waybillNo:q.waybillNo,eventType:'阶段发运登记',occurredAt:s.submittedAt,node:s.origin,mode:s.mode,consistency:'已声明，待实际事件核验',evidenceType:s.weightTicketNo?'过磅单':s.boxes!=='[]'?'箱号登记':'阶段登记',dataQuality:'人工登记'});if(s.completedAt)events.push({waybillNo:q.waybillNo,eventType:'阶段完成确认',occurredAt:s.completedAt,node:s.destination,mode:s.mode,consistency:s.submittedAt&&s.completedAt<s.submittedAt?'时间顺序异常':'阶段时间顺序一致',evidenceType:'完成确认',dataQuality:'人工确认'});}
  return events.sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime()).slice(0,1000);
 }
 async credit(q:DataQuery){
  const months=Number(q.months||3),from=new Date();from.setUTCMonth(from.getUTCMonth()-months);
  const entities=await this.db.businessEntity.findMany({where:{type:'CARRIER',status:'ACTIVE',deletedAt:null,isTestData:false},take:500});
  return Promise.all(entities.map(async e=>{
   const businesses=await this.db.logisticsBusiness.findMany({where:{createdAt:{gte:from},package:{carrierId:e.id,isTestData:false}},include:{stages:true,tasks:{include:{issues:{select:{id:true}}}}},take:1000});
   const completed=businesses.filter(b=>b.status==='COMPLETED'),stages=businesses.flatMap(b=>b.stages).filter(s=>s.completedAt),onTime=stages.filter(s=>s.completedAt!<=s.plannedEndAt).length,exceptions=businesses.filter(b=>b.tasks.some(t=>t.issues.length)).length;
   const bills=await this.db.bill.findMany({where:{carrierId:e.id,isTestData:false,createdAt:{gte:from}},include:{settlement:true},take:1000});
   const rate=stages.length?round(onTime/stages.length*100):null,exception=businesses.length?round(exceptions/businesses.length*100):null;
   return {...provider(e),registeredRegion:e.registeredRegion,modes:[...new Set(businesses.flatMap(b=>b.stages.map(s=>s.mode)))],periodMonths:months,completedOrders:completed.length,punctualityPercent:stages.length>=3?rate:null,exceptionPercent:businesses.length>=3?exception:null,settlementPercent:bills.length>=3?round(bills.filter(b=>b.settlement?.status==='SETTLED').length/bills.length*100):null,riskGrade:businesses.length<3?'样本不足':exception!>10||rate!==null&&rate<80?'需关注':'合作参考',disclaimer:'仅供业务合作参考，不构成法定信用评级',asOf:new Date()};
  }));
 }
 async risks(g:any,entity:any,q:DataQuery){
  const now=new Date(),signals=await this.db.monitoringSignal.findMany({where:{isTestData:false,validFrom:{lte:now},validTo:{gt:now},level:{not:'LOW'}},take:500});
  const publicRows=signals.filter(s=>(!q.origin||s.region.includes(q.origin)||s.name.includes(q.origin))&&(!q.destination||s.region.includes(q.destination)||s.name.includes(q.destination))).map(s=>({riskId:s.id,riskType:s.kind,level:s.level,title:s.name,affectedNode:s.region||s.name,waybillNo:null,estimatedDelayHours:s.delayMinutes?round(s.delayMinutes/60):null,validUntil:s.validTo,advice:advice(s.kind==='PORT'?'PORT_CONGESTION':s.kind),source:s.source,asOf:s.observedAt}));
  if(g.scope!=='OWN')return publicRows;
  const tasks=await this.db.transportTask.findMany({where:{status:{notIn:inactive},business:{package:{isTestData:false,...privateBusiness(entity)},...(q.waybillNo?{OR:[{waybillNo:q.waybillNo},{businessNo:q.waybillNo}]}:{})}},include:{business:{select:{waybillNo:true,businessNo:true}}},take:1000});
  const taskMap=new Map(tasks.map(t=>[t.id,t]));const risks=await this.db.riskRecord.findMany({where:{taskId:{in:tasks.map(t=>t.id)},status:{in:['NEW','ONGOING']}},orderBy:{lastSeenAt:'desc'},take:500});
  return [...publicRows,...risks.map(x=>({riskId:x.id,riskType:x.type,level:x.level,title:x.message,affectedNode:null,waybillNo:taskMap.get(x.taskId)?.business.waybillNo||taskMap.get(x.taskId)?.business.businessNo,estimatedDelayHours:null,validUntil:null,advice:advice(x.type),source:'平台运输预警',asOf:x.lastSeenAt}))];
 }
}
