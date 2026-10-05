import {Database} from './database';
import {businessDataScope} from './business-data-scope';
import {signingComplete} from './contract-progress';

/** Lightweight overview: never load position histories or expose another enterprise's records. */
export async function workbench(db:Database,user:any){
 const platform=user.businessEntity.type==='PLATFORM',entityId=user.businessEntityId;
 const can=(p:string)=>user.permissions.includes(p);
 const own={...businessDataScope(),...(platform?{}:{businessEntityId:entityId})};
 const contractScope={...businessDataScope(),...(platform?{}:{OR:[{traderId:entityId},{carrierId:entityId}]})};
 const businessWhere={package:contractScope};
 const serviceVisible=can('service:read')||can('tracking:read');
 const now=new Date(),parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).formatToParts(now);
 const monthStart=new Date(Date.UTC(Number(parts.find(p=>p.type==='year')!.value),Number(parts.find(p=>p.type==='month')!.value)-1,1,-8));
 const [pending,running,completed,recent,riskTasks,plans,demands,supplies,contracts]=await Promise.all([
  serviceVisible?db.logisticsBusiness.count({where:{...businessWhere,status:'PENDING'}}):null,
  serviceVisible?db.logisticsBusiness.count({where:{...businessWhere,status:'IN_PROGRESS'}}):null,
  serviceVisible?db.logisticsBusiness.count({where:{...businessWhere,status:'COMPLETED',completedAt:{gte:monthStart}}}):null,
  serviceVisible?db.logisticsBusiness.findMany({where:businessWhere,orderBy:{createdAt:'desc'},take:6,select:{id:true,waybillNo:true,businessNo:true,status:true,createdAt:true,package:{select:{businessNo:true,snapshot:true,quantityKg:true}},stages:{orderBy:{sequence:'asc'},select:{id:true,sequence:true,mode:true,status:true,origin:true,destination:true,plannedStartAt:true,plannedEndAt:true,actualEndAt:true}}}}):[],
  can('tracking:read')?db.transportTask.findMany({where:{business:businessWhere,status:{notIn:['COMPLETED','CANCELLED']}},select:{id:true,businessId:true,business:{select:{package:{select:{snapshot:true}}}}}}):[],
  can('plan:read')?db.planRun.findMany({where:own,orderBy:{createdAt:'desc'},distinct:['groupId'],select:{status:true,selectedPlanId:true}}):[],
  can('demand:read')?db.transportDemand.findMany({where:{...own,deletedAt:null,status:{in:['DRAFT','PUBLISHED']}},select:{status:true,matchedKg:true,quantityKg:true}}):[],
  can('supply:read')&&user.businessEntity.type!=='TRADER'?db.transportSupply.count({where:{...own,deletedAt:null,status:'PUBLISHED',OR:[{validUntil:null},{validUntil:{gte:now}}]}}):null,
  can('contract:read')?db.contractPackage.findMany({where:{...contractScope,status:{in:['REVIEW','SIGNING']}},include:{revisions:{orderBy:{number:'asc'},include:{signatures:true}}}}):[]
 ]);
 const parse=(value:string)=>{try{return JSON.parse(value);}catch{return {};}};
 const risks=riskTasks.length?await db.riskRecord.findMany({where:{taskId:{in:riskTasks.map(t=>t.id)},status:{in:['NEW','ONGOING']}},select:{id:true,taskId:true,type:true,message:true,level:true,lastSeenAt:true}}):[];
 const taskMap=new Map(riskTasks.map(t=>[t.id,t]));
 const activeRisks=risks.filter(r=>r.lastSeenAt.getTime()>=now.getTime()-120000||parse(taskMap.get(r.taskId)!.business.package.snapshot).sourceSystem==='BUSINESS_INITIALIZATION');
 const endpoint=(v:any)=>typeof v==='string'?v:v?.address||v?.name||'';
 const items=recent.map(b=>{const s=parse(b.package.snapshot);return {id:b.id,waybillNo:b.waybillNo||b.businessNo,contractNo:b.package.businessNo,status:b.status,grain:s.grain||'粮食',quantityKg:b.package.quantityKg,origin:endpoint(s.origin),destination:endpoint(s.destination),shipper:s.trader?.name||'',carrier:s.carrier?.name||'',stages:b.stages,expectedArrivalAt:b.stages.at(-1)?.plannedEndAt||null};});
 const awaitingContracts=contracts.filter(p=>parse(p.snapshot)?.provenance?.sourceSystem!=='BUSINESS_INITIALIZATION'&&(p.status==='REVIEW'?(platform||p.carrierId===entityId):!signingComplete(p,entityId))).length;
 const todos=[
  ...(can('demand:read')?[{key:'demands',title:'运输需求待完善',count:demands.filter(d=>d.status==='DRAFT').length,description:'补充运输条件，准备发布需求',path:'/supply-demand/demands',icon:'file'}]:[]),
  ...(can('plan:read')?[{key:'plans',title:'运输方案待选择',count:plans.filter(p=>p.status==='READY'&&!p.selectedPlanId).length,description:'比较路线、时效与费用，选择方案',path:'/plans/solve',icon:'route'}]:[]),
  ...(can('match:read')&&(user.businessEntity.type==='CARRIER'?can('supply:read'):can('demand:read'))?[{key:'matches',title:user.businessEntity.type==='CARRIER'?'运力等待匹配':'运输需求待匹配',count:user.businessEntity.type==='CARRIER'?(supplies||0):demands.filter(d=>d.status==='PUBLISHED'&&d.matchedKg<d.quantityKg).length,description:'查看推荐资源，推进报价与协同',path:'/matches',icon:'handshake'}]:[]),
  ...(can('tracking:read')?[{key:'risks',title:'运输预警待关注',count:activeRisks.length,description:'查看影响运输进度的风险信息',path:'/tracking/journeys',icon:'warning'}]:[]),
  ...(can('contract:read')?[{key:'contracts',title:'合同待确认与签署',count:awaitingContracts,description:'核对合同条款与签署进度',path:'/contracts/signing',icon:'file'}]:[])
 ];
 return {scope:platform?'平台全局':'本企业',metrics:{pending,running,alerts:can('tracking:read')?activeRisks.length:null,completed},todos,items,alerts:activeRisks.slice(0,3).map(r=>({id:r.id,businessId:taskMap.get(r.taskId)!.businessId,taskId:r.taskId,message:r.message,level:r.level})),asOf:now};
}
