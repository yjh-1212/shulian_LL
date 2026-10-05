import {scoreSupplies} from './planning-suppliers';
import {supplyAvailability} from './supply-availability';
import {businessDataScope} from './business-data-scope';
const sample=businessDataScope;
const modeNames:Record<string,string>={'1':'ROAD','2':'RAIL','3':'WATER'};
export const matchDemandInclude={grain:true,orderItem:{include:{grain:true}},modes:{include:{mode:true}},businessEntity:{select:{id:true,name:true,registeredRegion:true}}};
export const matchSupplyInclude={mode:true,grains:true,businessEntity:true};
function regionPoint(codes:string,text:string,address:string){const c=codes.split('/'),n=text.split(' / '),areas=require('china-area-data');return {name:address,province:areas['86'][c[0]]||n[0],city:areas[c[0]]?.[c[1]]||n[1]};}
async function conditions(db:any,p:any){
 const d=p.demand,quantity=(p.quantityKg-p.matchedKg)/1000;
 if(p.planRunId){const run=await db.planRun.findUnique({where:{id:p.planRunId},include:{candidates:{include:{segments:true}}}});const c=run?.candidates.find((c:any)=>c.id===run.selectedPlanId);if(c)return {input:{...JSON.parse(run.input),quantity},candidate:c};}
 const modes=d.modes.map((m:any)=>modeNames[m.mode.code]).filter(Boolean);
 return {input:{grainId:d.orderItem?.grainId||d.grainId,quantity,origin:regionPoint(d.originCodes,d.originRegion,d.originAddress),destination:regionPoint(d.destinationCodes,d.destinationRegion,d.destinationAddress),departureAt:d.departureAt,arrivalAt:d.arrivalAt,loadingType:d.loadingType,allowMultimodal:d.allowMultimodal||d.modes.some((m:any)=>m.mode.code==='4')},candidate:{modes:modes.length?modes:['ROAD','RAIL','WATER'],segments:[],preferences:true}};
}
export async function demandRecommendations(db:any,p:any){
 if(p.status!=='ACTIVE'||p.deadline<=new Date()||p.quantityKg<=p.matchedKg||p.demand.departureAt<=new Date())return [];
 const supplies=await db.transportSupply.findMany({where:{status:'PUBLISHED',deletedAt:null,...supplyAvailability(),...sample(),businessEntity:{type:'CARRIER',status:'ACTIVE',deletedAt:null,...sample()},...(p.mode==='DIRECTED'?{businessEntityId:{in:p.recipients.length?p.recipients.map((r:any)=>r.carrierId):[p.targetCarrierId].filter(Boolean)}}:{})},include:matchSupplyInclude});
 const {input,candidate}=await conditions(db,p),history=await db.carrierConfirmation.groupBy({by:['carrierId'],where:{status:'CONFIRMED',carrierId:{in:supplies.map((s:any)=>s.businessEntityId)},publication:{demand:{...sample()}}},_count:{_all:true}});
 const counts=Object.fromEntries(history.map((h:any)=>[h.carrierId,h._count._all]));
 return scoreSupplies(supplies,input,candidate,counts).slice(0,10).map(s=>({...s,invited:p.targetCarrierId===s.carrierId||p.recipients.some((r:any)=>r.carrierId===s.carrierId),hasResponse:p.responses.some((r:any)=>r.carrierId===s.carrierId)}));
}
export async function supplyRecommendations(db:any,s:any,user:any){
 const pubs=await db.matchPublication.findMany({where:{status:'ACTIVE',deadline:{gt:new Date()},quantityKg:{gt:0},demand:{deletedAt:null,departureAt:{gt:new Date()},...sample(),businessEntity:{type:'TRADER',status:'ACTIVE',deletedAt:null,...sample()}},OR:[{mode:'PUBLIC'},{mode:'DIRECTED',targetCarrierId:s.businessEntityId},{mode:'DIRECTED',recipients:{some:{carrierId:s.businessEntityId}}}]},include:{demand:{include:matchDemandInclude},recipients:true,responses:{where:{createdBy:user.id},select:{id:true,status:true}}}});
 const history=await db.carrierConfirmation.groupBy({by:['traderId'],where:{status:'CONFIRMED',traderId:{in:pubs.map((p:any)=>p.demand.businessEntityId)},publication:{demand:{...sample()}}},_count:{_all:true}}),counts=Object.fromEntries(history.map((h:any)=>[h.traderId,h._count._all]));
 const rows:any[]=[];
 for(const p of pubs){if(p.quantityKg<=p.matchedKg)continue;const {input,candidate}=await conditions(db,p),fit=scoreSupplies([s],input,candidate)[0];if(!fit)continue;const orders=counts[p.demand.businessEntityId]||0,registered=regionPoint('',p.demand.businessEntity.registeredRegion||'',''),registrationScore=registered.city&&registered.city===input.origin.city?10:registered.province&&registered.province===input.origin.province?6:0,score=Math.round(fit.routeMatch*.4+15+15+10+registrationScore+Math.min(10,Math.log2(orders+1)*2));
  rows.push({publicationId:p.id,publicationVersion:p.version,businessNo:p.businessNo,traderId:p.demand.businessEntityId,traderName:p.demand.businessEntity.name,registeredRegion:p.demand.businessEntity.registeredRegion||'未填写',grain:p.demand.orderItem?.grain.label||p.demand.grain?.label||'',quantity:input.quantity,origin:p.demand.originRegion,destination:p.demand.destinationRegion,departureAt:p.demand.departureAt,arrivalAt:p.demand.arrivalAt,deadline:p.deadline,score,routeMatch:fit.routeMatch,unitPriceCents:fit.unitPriceCents,totalCents:fit.totalCents,priceLabel:fit.priceLabel,acceptedOrders:orders,reasons:[fit.routeMatch===100?'起讫城市一致':'覆盖起讫省份','粮种与装载适配','数量与服务时间适配',...(registrationScore?['贸易企业注册地靠近粮源地']:[])],warnings:fit.warnings,invited:p.recipients.some((r:any)=>r.carrierId===s.businessEntityId)||p.targetCarrierId===s.businessEntityId,response:p.responses[0]||null});
 }
 rows.sort((a,b)=>b.score-a.score||Number(b.invited)-Number(a.invited)||new Date(a.deadline).getTime()-new Date(b.deadline).getTime());return rows.slice(0,10);
}
