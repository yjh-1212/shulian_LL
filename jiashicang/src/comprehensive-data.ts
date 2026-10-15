import reference from '../map_data/comprehensive-network.json';
import type {MapNode,MapRoute,Mode} from './types';

// Static presentation figures, kept separate from operational records and live telemetry.
export const overviewMetrics=[
 {name:'可组织粮源',value:'7,450',unit:'万吨',icon:'grain',change:'南向供给规模',color:'blue'},
 {name:'今日发运',value:'63.4',unit:'万吨',icon:'truck',change:'较昨日 +5.2%',color:'cyan'},
 {name:'当前在途',value:'326',unit:'批',icon:'route',change:'覆盖 8 条主通道',color:'violet'},
 {name:'今日到达',value:'61.2',unit:'万吨',icon:'anchor',change:'接卸有序推进',color:'green'}
];
export const transportModes:{mode:Mode;name:string;volume:number;share:number;efficiency:number;color:string;icon:string}[]=[
 {mode:'RAIL',name:'铁路运输',volume:33.2,share:52.4,efficiency:98.2,color:'#9cbbff',icon:'train'},
 {mode:'ROAD',name:'公路运输',volume:18.1,share:28.6,efficiency:95.4,color:'#efb85a',icon:'truck'},
 {mode:'WATER',name:'海运运输',volume:12.1,share:19,efficiency:91.7,color:'#39b4ff',icon:'ship'}
];
export const taskStates=[{name:'执行中',value:62,color:'#5f8aff'},{name:'已完成',value:58,color:'#4dd3c2'},{name:'待发运',value:12,color:'#9cbbff'},{name:'异常',value:6,color:'#f28b83'}];
export const regions=[
 {id:'heilongjiang',name:'黑龙江',role:'source',lng:126.64,lat:45.75,production:8001.7,volume:3600,stock:1700,transit:0,dx:-170,dy:-114,provinces:['黑龙江省']},
 {id:'mengdong',name:'蒙东',role:'source',lng:122.26,lat:43.62,production:3094.8,volume:1300,stock:700,transit:0,dx:-285,dy:-60,provinces:['内蒙古自治区']},
 {id:'jilin',name:'吉林',role:'source',lng:125.32,lat:43.9,production:4266,volume:2150,stock:900,transit:0,dx:42,dy:-25,provinces:['吉林省']},
 {id:'liaoning',name:'辽宁',role:'source',lng:123.43,lat:41.8,production:2500.3,volume:400,stock:500,transit:0,dx:-230,dy:14,provinces:['辽宁省']},
 {id:'east',name:'华东沿海',role:'target',lng:120.15,lat:30.27,production:0,volume:2600,stock:1320,transit:35,dx:20,dy:-55,provinces:['江苏省','浙江省','上海市','福建省']},
 {id:'central',name:'长江中游',role:'target',lng:114.3,lat:30.59,production:0,volume:1100,stock:860,transit:18,dx:-170,dy:-25,provinces:['湖北省','湖南省','江西省']},
 {id:'southwest',name:'西南地区',role:'target',lng:106.63,lat:26.65,production:0,volume:800,stock:720,transit:11,dx:-195,dy:-55,provinces:['四川省','重庆市','贵州省','云南省']},
 {id:'south',name:'华南沿海',role:'target',lng:113.26,lat:23.13,production:0,volume:2500,stock:1180,transit:34,dx:-165,dy:28,provinces:['广东省','广西壮族自治区']}
] as const;
export type SummaryRegion=typeof regions[number];
export const hubNodes:(MapNode&{regionIds:string[]})[]=[
 {id:'qiqihaer',name:'齐齐哈尔南站',lng:123.97,lat:47.29,kind:'rail',regionIds:['heilongjiang']},
 {id:'harbin',name:'哈尔滨',lng:126.64,lat:45.75,kind:'rail',regionIds:['heilongjiang']},
 {id:'changchun',name:'长春',lng:125.32,lat:43.9,kind:'rail',regionIds:['jilin']},
 {id:'tongliao',name:'通辽',lng:122.26,lat:43.62,kind:'road',regionIds:['mengdong']},
 {id:'shenyang',name:'沈阳铁路枢纽',lng:123.43,lat:41.8,kind:'rail',regionIds:['liaoning']},
 {id:'yingkou',name:'营口港',lng:122.09603,lat:40.289446,kind:'port',regionIds:['liaoning','jilin']},
 {id:'jinzhou',name:'锦州港',lng:121.04,lat:40.83,kind:'port',regionIds:['liaoning']},
 {id:'dalian',name:'大连港',lng:121.69,lat:38.93,kind:'port',regionIds:['liaoning']},
 {id:'tianjin',name:'天津',lng:117.2,lat:39.12,kind:'rail',regionIds:['liaoning','central']},
 {id:'jinan',name:'济南',lng:116.99,lat:36.67,kind:'rail',regionIds:['central']},
 {id:'zhengzhou',name:'郑州',lng:113.62,lat:34.75,kind:'rail',regionIds:['central']},
 {id:'wuhan',name:'武汉',lng:114.3,lat:30.59,kind:'rail',regionIds:['central']},
 {id:'beilun',name:'北仑港',lng:121.85,lat:29.92,kind:'port',regionIds:['east']},
 {id:'fuzhou',name:'福州港',lng:119.56,lat:25.97,kind:'port',regionIds:['east','south']},
 {id:'guangzhou',name:'广州港',lng:113.668807,lat:22.650614,kind:'port',regionIds:['south']},
 {id:'chongqing',name:'重庆',lng:106.55,lat:29.56,kind:'rail',regionIds:['southwest']},
 {id:'guiyang',name:'贵阳',lng:106.63,lat:26.65,kind:'road',regionIds:['southwest']}
];
export const nodeConditions=[
 {id:'yingkou',name:'营口港',value:78,status:'正常',detail:'作业负荷',warning:false},
 {id:'jinzhou',name:'锦州港',value:84,status:'繁忙',detail:'作业负荷',warning:true},
 {id:'dalian',name:'大连港',value:65,status:'正常',detail:'作业负荷',warning:false},
 {id:'shenyang',name:'沈阳铁路枢纽',value:72,status:'正常',detail:'计划兑现',warning:false},
 {id:'qiqihaer',name:'齐齐哈尔南站',value:86,status:'关注',detail:'装车完成',warning:true}
];
export const alerts=[
 {id:'pressure',nodeId:'jinzhou',title:'锦州港集港压力偏高',detail:'预计持续约 3 小时',level:'重要'},
 {id:'wagons',nodeId:'jinzhou',title:'锦州港周边短驳车辆存在缺口',detail:'预计影响 0.8 万吨粮食集港',level:'重要'},
 {id:'loading',nodeId:'qiqihaer',title:'齐齐哈尔南站装车进度偏低',detail:'当前计划完成率 86%',level:'关注'},
 {id:'traffic',nodeId:'shenyang',title:'沈山高速部分路段车流增加',detail:'预计延迟 18 分钟',level:'关注'}
];
export const corridorReferences=reference.segments;
export const summaryRoutes:MapRoute[]=reference.segments.map(s=>({id:s.id,mode:s.mode as Mode,points:s.coordinates.map(([lng,lat])=>({lng,lat})),label:s.label||`${s.origin} → ${s.destination}`,schematic:false,selected:false,quantityKg:0}));
export const summaryRegionColors=new Map(regions.flatMap(r=>r.provinces.map(name=>[name,r.role==='source'?'#3475b5':'#5b668e'] as [string,string])));
