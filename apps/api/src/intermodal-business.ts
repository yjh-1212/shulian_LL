export const serviceWaybill=(contractNo:string)=>'YD'+contractNo.replace(/^HT/,'');
const json=(value:string)=>JSON.parse(value);
const endpoint=(value:any)=>typeof value==='string'?value:value?.address||value?.name||value?.city||value?.region||'';
export async function ensureIntermodalBusiness(tx:any,p:any){
 const snap=json(p.snapshot),start=new Date(snap.deal?.departureAt||Date.now()),rawEnd=new Date(snap.deal?.arrivalAt||start.getTime()+5*86400000),end=rawEnd>start?rawEnd:new Date(start.getTime()+5*86400000);
 const planned=(snap.plan?.segments||[]).map((s:any)=>({mode:s.mode,origin:endpoint(s.origin),destination:endpoint(s.destination)})).filter((s:any)=>['ROAD','RAIL','WATER'].includes(s.mode)&&s.origin&&s.destination);
 let b=await tx.logisticsBusiness.findUnique({where:{packageId:p.id},include:{tasks:true,stages:true}});const legacy=!!b;
 if(!b)b=await tx.logisticsBusiness.create({data:{packageId:p.id,businessNo:'LY'+p.businessNo.replace(/^HT/,''),mode:'SINGLE',waybillNo:serviceWaybill(p.businessNo),segments:JSON.stringify(planned.length?planned:[{mode:'ROAD',origin:snap.origin,destination:snap.destination}])},include:{tasks:true,stages:true}});
 if(b.mode!=='SINGLE'||!b.waybillNo)b=await tx.logisticsBusiness.update({where:{id:b.id},data:{mode:'SINGLE',waybillNo:b.waybillNo||serviceWaybill(p.businessNo)},include:{tasks:true,stages:true}});
 if(!b.stages.length){
  const segments=json(b.segments);
  for(let i=0;i<segments.length;i++){
   const tasks=b.tasks.filter((t:any)=>t.segment===i+1&&t.status!=='CANCELLED'),done=tasks.length&&tasks.every((t:any)=>t.status==='COMPLETED'),stage=await tx.transportStage.create({data:{businessId:b.id,managed:!legacy,sequence:i+1,mode:segments[i].mode,origin:segments[i].origin,destination:segments[i].destination,quantityKg:tasks.reduce((sum:number,t:any)=>sum+t.quantityKg,0)||p.quantityKg,plannedStartAt:start,plannedEndAt:end,containerized:snap.loadingType==='CONTAINER',status:done?'COMPLETED':tasks.length?'SUBMITTED':'DRAFT',...(done?{actualEndAt:new Date(),completedAt:new Date()}:{}),allocations:JSON.stringify(tasks.filter((t:any)=>t.mode==='ROAD').map((t:any)=>({vehicleId:t.vehicleId,driverId:t.driverId,quantityKg:t.quantityKg})))}});
   if(tasks.length)await tx.transportTask.updateMany({where:{id:{in:tasks.map((t:any)=>t.id)}},data:{stageId:stage.id,plannedStartAt:start,plannedEndAt:end}});
  }
  if(b.tasks.length){const taskIds=b.tasks.filter((t:any)=>t.status!=='CANCELLED').map((t:any)=>t.id),used=await tx.billTask.count({where:{taskId:{in:taskIds}}});await tx.logisticsBusiness.update({where:{id:b.id},data:{status:taskIds.length&&b.tasks.filter((t:any)=>t.status!=='CANCELLED').every((t:any)=>t.status==='COMPLETED')&&used===taskIds.length?'COMPLETED':'IN_PROGRESS'}});}
 }
 await tx.serviceFee.upsert({where:{sourceKey:'CONTRACT:'+b.id},update:{},create:{sourceKey:'CONTRACT:'+b.id,businessId:b.id,source:'CONTRACT',feeCode:'CONTRACT',name:'合同运输费用',amountCents:p.totalCents,description:`合同 ${p.businessNo} 约定的全程运输费用`,userId:'SYSTEM'}});
 return b;
}
