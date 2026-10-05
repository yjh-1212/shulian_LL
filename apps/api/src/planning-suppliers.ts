import {meters} from './amap';
import {supplyAvailability} from './supply-availability';
import {pointRegion} from './planning-estimates';
import {businessDataScope} from './business-data-scope';

const sample=businessDataScope;
const region=(codes:string,text:string)=>{const c=codes?.split('/')||[],names=text?.split(/\s*\/\s*/) || [];return {province:c[0]||names[0]||'',city:c[1]||names[1]||names[0]||''};};
const fit=(a:any,b:any)=>a.city&&a.city===b.city?20:a.province&&a.province===b.province?14:0;

export function scoreSupplies(supplies:any[],input:any,candidate:any,counts:Record<string,number>={}){
 const a=pointRegion(input.origin),b=pointRegion(input.destination),origin=region(a.codes,a.region),destination=region(b.codes,b.region);
 const quantityKg=Math.round(input.quantity*1000),modes=Array.isArray(candidate.modes)?candidate.modes:JSON.parse(candidate.modes);
 const converted=candidate.segments.some((s:any)=>{const p=typeof s.priceSnapshot==='string'?JSON.parse(s.priceSnapshot):s.priceSnapshot;return p.conversionRequired;});
 const modeCode:Record<string,string>={ROAD:'1',RAIL:'2',WATER:'3'};
 const rows:any[]=[];
 for(const s of supplies){
  const start=fit(origin,region(s.originCodes,s.originRegion)),end=fit(destination,region(s.destinationCodes,s.destinationRegion));
  if(!start||!end||quantityKg>s.capacityKg||s.minKg&&quantityKg<s.minKg||s.maxKg&&quantityKg>s.maxKg)continue;
  if(s.grains.length&&!s.grains.some((g:any)=>g.grainId===input.grainId))continue;
  if(candidate.preferences){if(s.mode.code==='4'?!input.allowMultimodal:!modes.some((m:string)=>modeCode[m]===s.mode.code))continue;}
  else if(s.mode.code!=='4'&&(modes.length!==1||s.mode.code!==modeCode[modes[0]]))continue;
  if(s.serviceStart&&new Date(input.departureAt)<s.serviceStart||s.serviceEnd&&new Date(input.arrivalAt||input.departureAt)>s.serviceEnd||s.validUntil&&new Date(input.departureAt)>=s.validUntil)continue;
  if(s.loadingType!==input.loadingType&&!(input.loadingType==='BULK'&&converted&&s.loadingType==='CONTAINER'))continue;
  let total:number|null=null,priceLabel='待协商',boxCount:number|null=null;
  const warnings:string[]=[];
  if(start<20||end<20)warnings.push('覆盖同省其他城市，实际接驳范围需在议价时确认');
  if(s.loadingType==='BULK'&&s.bulkPriceCents!=null){total=Math.round(s.bulkPriceCents*input.quantity);priceLabel=`${s.bulkPriceCents/100} 元/吨`;}
  if(s.loadingType==='CONTAINER'){
   const type=input.containerType||'20GP',price=type==='40GP'?s.container40PriceCents:s.container20PriceCents;
   boxCount=input.containerCount||Math.ceil(input.quantity/(type==='40GP'?27:26));
   if(price!=null){total=price*boxCount!;priceLabel=`${type} · ${price/100} 元/箱 · ${boxCount} 箱`;}
   if(!input.containerCount)warnings.push(`箱数按${type==='40GP'?27:26}吨/箱参考估算，实际配箱、装拆箱和附加费用需确认`);
  }
  const orders=counts[s.businessEntityId]||0,registered=region(s.businessEntity.registeredCodes,s.businessEntity.registeredRegion);
  const registrationScore=registered.city&&registered.city===origin.city?10:registered.province&&registered.province===origin.province?6:0;
  rows.push({carrierId:s.businessEntityId,carrierName:s.businessEntity.name,registeredRegion:s.businessEntity.registeredRegion||'未填写',acceptedOrders:orders,supplyId:s.id,supplyVersion:s.version,supplyNo:s.businessNo,origin:s.originRegion,destination:s.destinationRegion,loadingType:s.loadingType,capacityMin:(s.minKg||0)/1000,capacityMax:Math.min(s.capacityKg,s.maxKg??s.capacityKg)/1000,totalCents:total,unitPriceCents:total==null?null:Math.round(total/input.quantity),priceLabel,boxCount,routeMatch:Math.round((start+end)/40*100),modeLabel:s.mode.label,modeCode:s.mode.code,registrationScore,orderScore:Math.min(15,Math.log2(orders+1)*3),warnings,resourceDescription:s.resourceDescription,baseScore:start+end+(modes.length>1?15:s.mode.code==='4'?10:15),isTestData:s.isTestData});
 }
 const known=rows.filter(r=>r.totalCents!=null&&r.totalCents>0),lowest=Math.min(...known.map(r=>r.totalCents));
 for(const r of rows){r.priceScore=r.totalCents?20*lowest/r.totalCents:0;r.score=Math.round(r.baseScore+r.priceScore+r.orderScore+r.registrationScore);r.reasons=[r.routeMatch===100?'起讫城市一致':'覆盖起讫省份',(candidate.preferences?r.modeCode==='4':modes.length>1)?'已发布整程联运运力':'运输方式适配',...(r.registrationScore?['注册地靠近粮源地']:[]),...(r.acceptedOrders?[`已有${r.acceptedOrders}笔有效接单记录`]:[])];}
 rows.sort((a,b)=>b.score-a.score||(a.totalCents??Infinity)-(b.totalCents??Infinity)||a.carrierName.localeCompare(b.carrierName));
 // Recommend a company's best matching published supply, not duplicate company cards.
 const seen=new Set<string>();return rows.filter(r=>{if(seen.has(r.carrierId))return false;seen.add(r.carrierId);return true;});
}

export async function resolveRegionPoints(db:any,input:any){
 const normalized=structuredClone(input);const nodes=await db.transportNode.findMany({where:{enabled:true,quality:{notIn:['DRAFT','SAMPLE']},source:{not:'DEVELOPMENT_SCENARIO'}},select:{lng:true,lat:true,province:true,city:true,district:true}});
 for(const key of ['origin','destination'])if(!normalized[key].province||!normalized[key].city){const close=nodes.filter((n:any)=>meters(n,normalized[key])<50000).sort((a:any,b:any)=>meters(a,normalized[key])-meters(b,normalized[key]))[0];if(close)normalized[key]={...close,...normalized[key],province:normalized[key].province||close.province,city:normalized[key].city||close.city};}
 return normalized;
}
export async function supplierRecommendations(db:any,input:any,candidate:any){
 const normalized=await resolveRegionPoints(db,input);
 const supplies=await db.transportSupply.findMany({where:{status:'PUBLISHED',deletedAt:null,...supplyAvailability(),...sample(),businessEntity:{type:'CARRIER',status:'ACTIVE',deletedAt:null,...sample()}},include:{businessEntity:true,mode:true,grains:true}});
 const history=await db.carrierConfirmation.groupBy({by:['carrierId'],where:{carrierId:{in:supplies.map((s:any)=>s.businessEntityId)},status:'CONFIRMED',publication:{demand:{...sample()}}},_count:{_all:true}});
 return scoreSupplies(supplies,normalized,candidate,Object.fromEntries(history.map((r:any)=>[r.carrierId,r._count._all])));
}
