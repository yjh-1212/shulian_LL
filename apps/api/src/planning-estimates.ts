// Public corridors are evidence-backed; these planning assumptions are simulations, not tariffs or departure bookings.
export const assumptions:Record<string,any>={
 'public-rail-puhe-guangzhou-x8784':{rate:220,waitHours:24,handlingHours:8,reliability:94,path:[[122.8,41.6],[121.1,41.1],[119.8,39.9],[117.4,39.2],[116.6,37.4],[117,36.7],[116.9,34.8],[114.3,30.6],[113,28.2],[113.5,25.8],[113.6,24.8]]},
 'public-water-pan-asia-ic9':{rate:108,waitHours:24,handlingHours:12,reliability:85,path:[[121.8,39.8],[121.8,38.8],[122.3,37.8],[123.1,36.8],[123.2,34.5],[123,31],[122.7,29],[121.8,27.5],[120.2,25.5],[118.5,23.5],[116.5,22.5],[114.5,22.1],[113.8,22.3]]},
 'public-water-pan-asia-ic15':{rate:104,waitHours:28,handlingHours:12,reliability:84,path:[[121.4,40.5],[121.6,39.4],[122,38.5],[122.5,37.7],[123.2,36.6],[123.2,34.5],[123,31],[122.7,29],[121.8,27.5],[120.2,25.5],[118.5,23.5],[116.5,22.5],[114.5,22.1],[113.8,22.3]]}
};
export function estimateSegment(line:any,dto:any,converted:boolean,chargeConversion=converted){
 const configured=JSON.parse(line.serviceInfo||'{}').planningEstimate;
 const km=Math.hypot((line.origin.lng-line.destination.lng)*80,(line.origin.lat-line.destination.lat)*111)*(configured?.detourFactor||1.3);
 const a=assumptions[line.id]||(configured?{...configured,rate:line.mode==='RAIL'?Math.max(35,km*configured.railRatePerTonKm):configured.waterRatePerTon??108,path:line.mode==='RAIL'?[[line.origin.lng,(line.origin.lat+line.destination.lat)/2]]:coastalPath(line.origin,line.destination)}:null);if(!a)return null;
 const rates=[['干线运输费',a.rate],['始发装卸费',8],['到达装卸费',8],['区段箱具服务费',5],...(chargeConversion?[['散粮装箱与拆箱费',12]]:[])];
 const fees=rates.map(([name,value])=>{const rate=Math.round(Number(value)*1000)/1000;return {name,rate,unit:'元/吨',quantity:dto.quantity,costCents:Math.round(rate*dto.quantity*100),estimated:true};});
 return {unit:'PER_TON',rate:fees.reduce((n,r)=>n+r.rate,0),estimated:true,pending:false,conversionRequired:converted,conversionIncluded:converted,conversionCharged:chargeConversion,durationEstimated:!!configured?.durationEstimated,estimateDistanceKm:configured?Math.round(km):null,source:'参考测算 · 公开走廊与区域参考费率',maintainer:'平台方案测算',fees,waitSeconds:(a.waitHours+a.handlingHours)*3600,reliability:a.reliability,displayPath:[[line.origin.lng,line.origin.lat],...a.path,[line.destination.lng,line.destination.lat]],geometryKind:'SCHEMATIC_CORRIDOR',assumptions:'费用、候班、作业时间和可靠性采用参考估算，实际报价与排程待确认。未公开铁路时效按区域节点间距离×绕行系数÷35km/h+12小时估算；未核验里程不声明实际里程。散粮装拆箱费用整条路线仅计一次；箱具及额外作业待报价确认。'};
}
function coastalPath(origin:any,destination:any){
 const coast=[[121.8,39.5],[122.5,37.8],[123.1,36.5],[123.1,34],[123,31.1],[122.2,29.8],[121.5,27],[120.1,25.5],[118,23.4],[115,22.3],[114.1,21.9],[112,20.8],[110,20.3],[108.7,20.5]];
 return coast.filter(p=>p[1]<Math.max(origin.lat,destination.lat)&&p[1]>Math.min(origin.lat,destination.lat));
}
export function segmentMetrics(s:any,quantity:number){
 const p=typeof s.priceSnapshot==='string'?JSON.parse(s.priceSnapshot):s.priceSnapshot;
 const reliability=p.reliability??(s.mode==='ROAD'?88:s.geometryId?90:78);
 return {reliability,reliabilityLabel:'模型评分，非历史准点率',fees:p.fees||[{name:'区段运输费',unit:p.unit==='PER_TON_KM'?'元/吨公里':p.unit==='PER_CONTAINER'?'元/箱':p.unit==='FIXED'?'元/单':'元/吨',rate:p.rate,quantity:p.unit==='PER_TON_KM'?quantity*s.distanceMeters/1000:p.unit==='FIXED'?1:p.unit==='PER_CONTAINER'?p.containerCount:quantity,costCents:p.pending?null:s.costCents,estimated:!!p.isTestData}],displayPath:p.displayPath||null,geometryKind:p.geometryKind||s.routeProfile};
}
export function pointRegion(p:any){
 const areas:Record<string,Record<string,string>>=require('china-area-data'),text=p.name||'';
 for(const [province,provinceName] of Object.entries(areas['86'])){if(p.province!==provinceName&&!text.includes(provinceName))continue;for(const [city,cityName] of Object.entries(areas[province]||{})){if(p.city!==cityName&&!text.includes(cityName))continue;const district=Object.entries(areas[city]||{}).find(([_,name])=>p.district===name||text.includes(name));return {codes:[province,city,...(district?[district[0]]:[])].join('/'),region:[provinceName,cityName,...(district?[district[1]]:[])].join(' / ')};}}
 return {codes:'',region:[p.province,p.city,p.district].filter(Boolean).join(' / ')};
}
