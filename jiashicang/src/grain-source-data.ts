import statistics from '../map_data/grain-source-statistics.json';
import type {GrainChartRow} from './grain-source-charts';

export interface GrainSourceRegion {
 id:string;name:string;group:string;year:number;productionWanTons:number|null;areaWanHectares:number|null;
 yieldKgPerHectare:number|null;yoyPercent:number|null;grains:Record<string,number|null>;
 history:{year:number;productionWanTons:number|null;areaWanHectares?:number|null;sourceId:string}[];
 fieldSources:Record<string,string|null>;notes:string[];
 grainEstimates?:Record<string,{value:number;method:string;formula:string;sourceIds:string[];uncertainty:string}>;
}
export interface GrainSourceReference {id:string;title:string;url:string;publishedAt:string;authority:string}
export const sourceStatistics=statistics as unknown as {
 version:number;year:number;scope:{name:string;mengdongIds:string[];notes:string[]};
 regions:GrainSourceRegion[];sources:GrainSourceReference[];derived:unknown[];
};
export const regionCentres:Record<string,{lng:number;lat:number}>={
 '230000':{lng:126.642,lat:45.756},'220000':{lng:125.324,lat:43.886},'210000':{lng:123.432,lat:41.806},
 '150700':{lng:119.766,lat:49.212},'152200':{lng:122.038,lat:46.082},'150500':{lng:122.244,lat:43.653},'150400':{lng:118.887,lat:42.257},
};
export const regionColors:Record<string,string>={'230000':'#b18a42','220000':'#419a8a','210000':'#8b9e61','150700':'#cda25b','152200':'#a18367','150500':'#6da6a3','150400':'#d69054'};
export const scopeChoices=[{id:'all',name:'东北全域'},{id:'黑龙江',name:'黑龙江'},{id:'吉林',name:'吉林'},{id:'辽宁',name:'辽宁'},{id:'蒙东',name:'蒙东'}];
export const grains=[{id:'corn',name:'玉米'},{id:'rice',name:'稻谷'},{id:'soybean',name:'大豆'}];
export function previousOutput(region:GrainSourceRegion){return region.history.find(row=>row.year===sourceStatistics.year-1)?.productionWanTons??null;}
export function toGrainChartRow(region:GrainSourceRegion):GrainChartRow {
 return {id:region.id,name:region.name,output:region.productionWanTons,area:region.areaWanHectares,
  previous:previousOutput(region),year:sourceStatistics.year,previousYear:sourceStatistics.year-1,color:regionColors[region.id],
  grains:grains.map(g=>{const official=region.grains[g.id],estimate=official==null?region.grainEstimates?.[g.id]:undefined;return {name:g.name,value:official??estimate?.value??null,estimated:!!estimate,method:estimate?`${estimate.method} ${estimate.formula}。${estimate.uncertainty}`:undefined};})};
}
export const grainNumber=(value:number|null|undefined,digits=1)=>value==null?'—':value.toLocaleString('zh-CN',{maximumFractionDigits:digits});
export function completeSum(values:(number|null|undefined)[]){return values.length&&values.every(v=>typeof v==='number'&&Number.isFinite(v))?values.reduce<number>((sum,value)=>sum+value!,0):null;}
