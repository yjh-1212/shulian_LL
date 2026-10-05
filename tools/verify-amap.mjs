import 'dotenv/config';import {writeFile,mkdir} from 'node:fs/promises';
const key=process.env.AMAP_WEB_SERVICE_KEY;
async function call(path,params){await new Promise(r=>setTimeout(r,750));const url=new URL('https://restapi.amap.com'+path);url.search=new URLSearchParams({...params,key});const r=await fetch(url,{signal:AbortSignal.timeout(20000)});const d=await r.json();if(d.status!=='1')throw new Error('高德服务返回：'+d.info+' / '+d.infocode);return d;}
const records=[];
for(const [keyword,type,city] of [['鲅鱼圈港','PORT','营口'],['广州港南沙港区','PORT','广州'],['盘锦站','RAIL','盘锦'],['广州北站','RAIL','广州'],['沈阳东站','RAIL','沈阳'],['大连港','PORT','大连']]){
 const data=await call('/v3/place/text',{keywords:keyword,types:type==='PORT'?'150300':'150200',city,citylimit:'true',offset:'3',extensions:'base'});const p=data.pois?.find(p=>String(p.typecode).startsWith(type==='PORT'?'1503':'1502'));if(!p?.location)continue;const [lng,lat]=p.location.split(',').map(Number);records.push({id:'amap-'+p.id,name:p.name,type,province:p.pname,city:p.cityname,district:p.adname,address:typeof p.address==='string'?p.address:'',lng,lat,source:'AMAP_POI',sourceRef:p.id,sourceUrl:'https://lbs.amap.com/api/webservice/guide/api/search',coordinateSystem:'GCJ02',quality:'PROVIDER',verifiedAt:new Date().toISOString()});console.log(JSON.stringify({name:p.name,type,location:p.location}));
}
await mkdir('prisma/data',{recursive:true});await writeFile('prisma/data/transport-nodes.json',JSON.stringify(records,null,2));
const d=await call('/v5/direction/driving',{origin:'121.131979,41.124895',destination:'113.321417,23.159424',strategy:'32',show_fields:'cost,polyline'});
console.log(JSON.stringify({driving:d.status,paths:d.route.paths.map(p=>({distance:p.distance,duration:p.cost?.duration,steps:p.steps.length,points:p.steps.reduce((n,s)=>n+(s.polyline?.split(';').length||0),0)}))}));
