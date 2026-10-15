import network from '../map_data/comprehensive-network.json';
import {preparePath,pointAlong} from './route-math';
import type {Mode,Point,MapRoute} from './types';
// Frontend-only business scenarios. Volumes, resources and schedules are illustrative;
// geometry reuses the attributed OSM / Marnet network. No operational records are created.
export interface ChannelStage {name:string;mode:Mode;place:string;hours:number;route?:MapRoute;resource:string;capacity:string}
export interface ChannelTask {id:string;from:string;to:string;grain:string;tons:number;current:number;progress:number;attention:string;start:string;stages:ChannelStage[]}
const route=(id:string):MapRoute=>{const s=network.segments.find(s=>s.id===id)!;return {id,mode:s.mode as Mode,label:`${s.origin} → ${s.destination}`,points:s.coordinates.map(([lng,lat])=>({lng,lat})),selected:false,schematic:false};};
const rail=route('674a185a43e54c66'),direct=route('35826394a44abaf8'),road=route('road-mengdong'),southwest=route('road-southwest');
function sea(id:string){const r=route(id);r.points=[rail.points.at(-1)!,{lng:122.05,lat:40.28},{lng:121.95,lat:40.27},...r.points.slice(1)];return r;}
const stage=(name:string,mode:Mode,place:string,hours:number,resource:string,capacity:string,r?:MapRoute):ChannelStage=>({name,mode,place,hours,resource,capacity,route:r});
function seaChain(tons:number,destination:string,seaId:string):ChannelStage[]{const wagons=Math.ceil(tons/60),ship=sea(seaId),path=preparePath(ship.points.map(p=>[p.lng,p.lat]));return [
 stage('出库质检','ROAD','哈尔滨粮源集运区',3,'批次检验 · 水分 ≤14%','质检合格'),
 stage('铁路装车','RAIL','新香坊站',5,`${wagons} 辆粮食货车`,`${(tons/wagons).toFixed(1)} 吨 / 车`),
 stage('铁路运输','RAIL','新香坊站 → 鲅鱼圈港',18,'粮食货运班列',`${wagons} 辆 · ${tons} 吨`,rail),
 stage('港口接卸','RAIL','鲅鱼圈港粮食作业区',6,'卸粮线 · 筒仓接卸','接卸能力 600 吨/时'),
 stage('港口装船','WATER','鲅鱼圈港粮食泊位',5,'散粮船 · 舱位已预配','装船能力 800 吨/时'),
 stage('沿海运输','WATER',`鲅鱼圈港 → ${destination}`,Math.ceil(path.length/1000/23)+6,'散粮船 · 12.4 节',`${tons} 吨在船`,ship),
 stage('到港交付','WATER',destination,5,'卸船 · 计量 · 签收','接卸能力 700 吨/时')];}
const railStages=[stage('出库集结','ROAD','沈阳蒲河物流基地',4,'粮源集运 · 检验放行','粮温及水分合格'),stage('装车编组','RAIL','沈阳蒲河物流基地',6,'50 辆粮食货车','60 吨 / 车'),stage('铁路运输','RAIL','蒲河物流基地 → 广州国际港',68,'粮食专列','50 辆 · 3,000 吨',direct),stage('卸车交付','RAIL','广州国际港站',6,'卸车 · 转库 · 签收','接卸能力 600 吨/时')];
function roadStages(r:MapRoute,from:string,to:string,tons:number){return [stage('备货装车','ROAD',from,3,`${Math.ceil(tons/32)} 辆粮食运输车`,'单车载货 ≤32 吨'),stage('公路运输','ROAD',`${from} → ${to}`,Math.ceil(preparePath(r.points.map(p=>[p.lng,p.lat])).length/1000/48)+2,'粮食运输车队',`${tons} 吨 · 分车承运`,r),stage('到达接卸','ROAD',to,3,'预约进场 · 过磅接卸','车货单证核验')];}
export const channelTasks:ChannelTask[]=[
 {id:'TD-20261015-081',from:'哈尔滨',to:'广州南沙',grain:'玉米',tons:2800,current:2,progress:.72,attention:'',start:'2026-10-14T14:00:00+08:00',stages:seaChain(2800,'广州南沙港','sea-south')},
 {id:'TD-20261015-076',from:'哈尔滨',to:'宁波舟山',grain:'水稻',tons:2100,current:4,progress:.62,attention:'前船离泊顺延 40 分钟',start:'2026-10-13T20:00:00+08:00',stages:seaChain(2100,'宁波舟山港','sea-east')},
 {id:'TD-20261015-080',from:'通辽',to:'沈阳',grain:'玉米',tons:960,current:1,progress:.38,attention:'',start:'2026-10-15T05:00:00+08:00',stages:roadStages(road,'通辽集运区','沈阳集运中心',960)},
 {id:'TD-20261015-079',from:'哈尔滨',to:'福州',grain:'大豆',tons:1800,current:5,progress:.54,attention:'',start:'2026-10-11T10:00:00+08:00',stages:seaChain(1800,'福州港','sea-fuzhou')},
 {id:'TD-20261015-078',from:'沈阳',to:'广州',grain:'玉米',tons:3000,current:2,progress:.41,attention:'到站接卸计划待确认',start:'2026-10-13T08:00:00+08:00',stages:railStages},
 {id:'TD-20261015-075',from:'武汉',to:'贵阳',grain:'稻谷',tons:640,current:1,progress:.84,attention:'',start:'2026-10-14T08:00:00+08:00',stages:roadStages(southwest,'武汉粮食集散区','贵阳粮食物流园',640)},
 {id:'TD-20261015-083',from:'哈尔滨',to:'宁波舟山',grain:'玉米',tons:2400,current:0,progress:0,attention:'',start:'2026-10-15T16:00:00+08:00',stages:seaChain(2400,'宁波舟山港','sea-east')},
 {id:'TD-20261015-071',from:'通辽',to:'沈阳',grain:'玉米',tons:960,current:2,progress:1,attention:'',start:'2026-10-14T23:00:00+08:00',stages:roadStages(road,'通辽集运区','沈阳集运中心',960)}
];
// One consistent planning snapshot across all eight tasks.
export const channelAsOf='2026-10-15T13:30:00+08:00';
for(const task of channelTasks){
 if(task.current===0&&task.progress===0)continue;
 const elapsed=task.stages.slice(0,task.current).reduce((sum,s)=>sum+s.hours,0)+task.stages[task.current].hours*task.progress;
 const delivered=task.current===task.stages.length-1&&task.progress===1;
 task.start=new Date(Date.parse(channelAsOf)-elapsed*3600000-(delivered?3600000:0)).toISOString();
}
export const modeName:Record<Mode,string>={ROAD:'公路运输',RAIL:'铁路运输',WATER:'沿海运输'};
export function stagePoint(task:ChannelTask,index:number):Point {const s=task.stages[index];if(s.route)return s.route.points[0];const before=task.stages.slice(0,index).reverse().find(s=>s.route);if(before?.route)return before.route.points.at(-1)!;return task.stages.find(s=>s.route)!.route!.points[0];}
export function overallProgress(t:ChannelTask){const total=t.stages.reduce((sum,s)=>sum+s.hours,0);return Math.round((t.stages.slice(0,t.current).reduce((sum,s)=>sum+s.hours,0)+t.stages[t.current].hours*t.progress)/total*100);}
export function taskState(t:ChannelTask){return t.current===t.stages.length-1&&t.progress===1?'done':t.current===0&&t.progress===0?'waiting':'running';}
export function stageTime(t:ChannelTask,index:number){const hours=t.stages.slice(0,index+1).reduce((sum,s)=>sum+s.hours,0);return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(Date.parse(t.start)+hours*3600000));}
export const preparedRoute=(stage:ChannelStage)=>preparePath(stage.route?.points.map(p=>[p.lng,p.lat])||[]);
export {pointAlong};
