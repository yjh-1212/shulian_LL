import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {demandSnapshot} from './match-snapshot';
import {segmentMetrics,pointRegion} from './planning-estimates';
import {supplierRecommendations,resolveRegionPoints} from './planning-suppliers';
import {businessDataScope} from './business-data-scope';
const no=(prefix:string)=>`${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0,6).toUpperCase()}`;
const demandInclude={grain:true,orderItem:{include:{grain:true,tradeOrder:true}},modes:{include:{mode:true}}};

export async function publishPlan(db:any,audit:any,id:string,dto:any,req:any){
 if(req.user.businessEntity.type!=='TRADER')throw new ForbiddenException('仅贸易企业可发布方案');
 const legacy=[dto.targetCarrierId,dto.supplyId,dto.supplyVersion].some(v=>v!==undefined);
 if(dto.suppliers&&legacy)throw new BadRequestException('请使用一种供应商选择方式');
 const selected=dto.suppliers||(legacy?[{targetCarrierId:dto.targetCarrierId,supplyId:dto.supplyId,supplyVersion:dto.supplyVersion}]:[]);
 if(!selected.length||selected.length>10||selected.some((s:any)=>!s.targetCarrierId||!s.supplyId||!s.supplyVersion))throw new BadRequestException('请选择1至10家物流供应商');
 if(new Set(selected.map((s:any)=>s.targetCarrierId)).size!==selected.length||new Set(selected.map((s:any)=>s.supplyId)).size!==selected.length)throw new BadRequestException('物流供应商不能重复选择');
 const selectionKey=(rows:any[])=>rows.map(s=>`${s.carrierId||s.targetCarrierId}:${s.supplyId}`).sort().join('|');
 return db.$transaction(async(tx:any)=>{
  const run=await tx.planRun.findFirst({where:{id,businessEntityId:req.user.businessEntityId,...businessDataScope()},include:{candidates:{include:{segments:{orderBy:{sequence:'asc'}}}}}});
  if(!run)throw new NotFoundException('方案不存在');
  const existing=await tx.matchPublication.findFirst({where:{planRunId:id,status:'ACTIVE',deadline:{gt:new Date()}},include:{recipients:true}});
  if(existing){const recipients=existing.recipients.length?existing.recipients:[{carrierId:existing.targetCarrierId,supplyId:existing.supplyId}];if(run.selectedPlanId!==dto.candidateId||selectionKey(recipients)!==selectionKey(selected))throw new ConflictException('已有发布，请先关闭原发布后更换方案或供应商');return {id:existing.id,demandId:existing.demandId};}
  if(run.revision!==dto.revision)throw new ConflictException('方案已更新，请刷新');
  const latest=await tx.planRun.findFirst({where:{groupId:run.groupId},orderBy:{version:'desc'}});if(latest?.id!==id)throw new ConflictException('请使用最新方案');
  const input=JSON.parse(run.input),candidate=run.candidates.find((c:any)=>c.id===dto.candidateId);
  if(!candidate)throw new BadRequestException('候选方案不属于本次求解');
  if(!input.arrivalAt||new Date(input.departureAt)<=new Date()||new Date(dto.deadline)<=new Date()||new Date(dto.deadline)>new Date(input.departureAt))throw new BadRequestException('截止时间须晚于现在且不晚于发运时间');
  const recommended=await supplierRecommendations(tx,input,candidate),suppliers=selected.map((s:any)=>recommended.find((r:any)=>r.supplyId===s.supplyId&&r.carrierId===s.targetCarrierId&&r.supplyVersion===s.supplyVersion));
  if(suppliers.some((s:any)=>!s))throw new ConflictException('所选运力已变化或不适配，请刷新供应商推荐后重新选择');
  const supplier=suppliers.length===1?suppliers[0]:null;
  let demand=run.demandId?await tx.transportDemand.findFirst({where:{id:run.demandId,businessEntityId:req.user.businessEntityId,deletedAt:null},include:demandInclude}):null;
  if(run.demandId&&(!demand||demand.version!==run.demandVersion||!['DRAFT','PUBLISHED'].includes(demand.status)||demand.matchedKg>0))throw new ConflictException('关联需求已变化或部分承运，请重新求解');
  const normalized=await resolveRegionPoints(tx,input),originRegion=pointRegion(normalized.origin),destinationRegion=pointRegion(normalized.destination);
  if(!demand){
   const grain=await tx.dictionary.findFirst({where:{id:input.grainId,group:'粮食品种',enabled:true}});if(!grain)throw new BadRequestException('粮食品种已停用，请重新求解');
   const contact=dto.contact||req.user.displayName,phone=dto.phone||req.user.phone||req.user.businessEntity.phone;if(!contact||!phone)throw new BadRequestException('请填写联系人和联系电话');
   const modeCodes:Record<string,string>={ROAD:'1',RAIL:'2',WATER:'3'},modes=await tx.dictionary.findMany({where:{group:'运输方式',enabled:true,code:{in:input.modes.map((m:string)=>modeCodes[m])}}});
   demand=await tx.transportDemand.create({data:{businessNo:no('XQ'),name:`${grain.label} ${input.quantity}吨`,businessEntityId:req.user.businessEntityId,grainId:grain.id,cargoName:input.cargoName||grain.label,specification:'',quantityKg:Math.round(input.quantity*1000),originCodes:originRegion.codes,originRegion:originRegion.region,originAddress:input.origin.name,destinationCodes:destinationRegion.codes,destinationRegion:destinationRegion.region,destinationAddress:input.destination.name,departureAt:new Date(input.departureAt),arrivalAt:new Date(input.arrivalAt),allowMultimodal:input.allowMultimodal,allowTransfer:input.allowTransfer,maxTransfers:input.maxTransfers,loadingType:input.loadingType,preference:'BALANCED',contact,phone,notes:input.notes||'',createdBy:req.user.id,updatedBy:req.user.id,sourceType:'PLAN',isTestData:run.isTestData,modes:{create:modes.map((m:any)=>({modeId:m.id}))}},include:demandInclude});
   await audit.write(tx,req,'运输需求',demand.id,'从方案创建运输需求',undefined,{grainId:grain.id,quantityKg:demand.quantityKg});
  }
  if(await tx.matchPublication.count({where:{demandId:demand.id,status:'ACTIVE',deadline:{gt:new Date()}}}))throw new ConflictException('此需求已有有效发布，请先关闭原发布');
  await tx.matchPublication.updateMany({where:{demandId:demand.id,status:'ACTIVE',deadline:{lte:new Date()}},data:{status:'EXPIRED'}});
  const plan={runId:id,businessNo:run.businessNo,version:run.version,name:candidate.name,costCents:candidate.costCents,durationSeconds:candidate.durationSeconds,warnings:JSON.parse(candidate.warnings),segments:candidate.segments.map((s:any)=>({sequence:s.sequence,mode:s.mode,origin:JSON.parse(s.origin),destination:JSON.parse(s.destination),lineName:s.lineName,geometryId:s.geometryId,routeProfile:s.routeProfile,costCents:s.costCents,durationSeconds:s.durationSeconds,waitSeconds:s.waitSeconds,...segmentMetrics(s,input.quantity),service:JSON.parse(s.priceSnapshot).service||null,estimated:!!JSON.parse(s.priceSnapshot).estimated}))};
  const p=await tx.matchPublication.create({data:{businessNo:no('FB'),demandId:demand.id,objectType:'PLAN',planRunId:id,supplyId:supplier?.supplyId,targetCarrierId:supplier?.carrierId,recipients:{create:suppliers.map((s:any)=>({carrierId:s.carrierId,supplyId:s.supplyId,supplyVersion:s.supplyVersion,invitedBy:req.user.id,invitedAt:new Date()}))},mode:'DIRECTED',deadline:new Date(dto.deadline),quoteType:'PER_TON',budgetPublic:false,contactPublic:false,notes:input.notes||'',createdBy:req.user.id,demandVersion:demand.version+1,quantityKg:demand.quantityKg,allowPartial:false,riskNotes:JSON.stringify([...new Set(suppliers.flatMap((s:any)=>s.warnings))]),snapshot:JSON.stringify({...demandSnapshot(demand),modes:JSON.parse(candidate.modes).map((m:string)=>({ROAD:'公路',RAIL:'铁路',WATER:'水运'} as Record<string,string>)[m]),originAddress:input.origin.name,destinationAddress:input.destination.name,originRegion:originRegion.region||demand.originRegion,destinationRegion:destinationRegion.region||demand.destinationRegion,plan,supplier,suppliers})}});
  const changed=await tx.transportDemand.updateMany({where:{id:demand.id,version:demand.version},data:{originAddress:input.origin.name,destinationAddress:input.destination.name,...(originRegion.codes?{originCodes:originRegion.codes,originRegion:originRegion.region}:{}),...(destinationRegion.codes?{destinationCodes:destinationRegion.codes,destinationRegion:destinationRegion.region}:{}),status:'PUBLISHED',matchStage:'WAITING',version:{increment:1},updatedBy:req.user.id}});if(changed.count!==1)throw new ConflictException('需求已更新');
  await tx.planRun.update({where:{id,revision:dto.revision},data:{status:'SELECTED',selectedPlanId:dto.candidateId,demandId:demand.id,demandVersion:demand.version+1,revision:{increment:1},input:JSON.stringify({...input,demandId:demand.id,demandVersion:demand.version+1,sourceOrderNo:demand.orderItem?.tradeOrder.businessNo||null})}});
  await audit.write(tx,req,'供需匹配',p.id,'发布方案并邀约议价',undefined,{runId:id,candidateId:candidate.id,suppliers:suppliers.map((s:any)=>({carrierId:s.carrierId,supplyId:s.supplyId})),demandId:demand.id,quantityKg:demand.quantityKg});
  return {id:p.id,demandId:demand.id};
 },{timeout:15000,maxWait:10000});
}
