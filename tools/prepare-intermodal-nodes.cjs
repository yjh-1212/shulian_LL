require('dotenv').config({quiet:true});
const fs=require('node:fs/promises');
const queries=[
 ['harbin','新香坊站','RAIL','哈尔滨'],
 ['suihua','绥化站','RAIL','绥化'],['fujin','富锦站','RAIL','佳木斯'],
 ['wukeshu','五棵树站','RAIL','长春'],['gongzhuling','公主岭站','RAIL','长春'],
 ['tongliao','通辽站','RAIL','通辽'],['changchun','长春国际陆港','RAIL','长春'],
 ['qinzhou','钦州港集装箱码头','PORT','钦州'],['quanzhou','泉州港石湖港区','PORT','泉州'],
 ['shanghai','上海港外高桥','PORT','上海'],['ningbo','宁波港北仑港区','PORT','宁波'],
 ['nantong','南通港','PORT','南通'],['shekou','蛇口集装箱码头','PORT','深圳'],
 ['tianjin','天津港集装箱码头','PORT','天津'],['lianyungang','连云港港集装箱码头','PORT','连云港'],
 ['qingdao','青岛港前湾集装箱码头','PORT','青岛'],['xinsha','广州新沙港','PORT','东莞'],
];
(async()=>{
 const login=await fetch('http://127.0.0.1:3001/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'trader',password:process.env.SEED_PASSWORD})});
 const token=(await login.json()).data.accessToken;
 const raw=[],nodes=[];
 for(const [key,query,type,city] of queries){
  const response=await fetch('http://127.0.0.1:3001/api/map/search?q='+encodeURIComponent(query),{headers:{Authorization:'Bearer '+token}});
  const data=await response.json();const pois=data.data||[];raw.push({key,query,pois});
  const matches=pois.filter(p=>p.city.includes(city));const p=matches.find(p=>type==='RAIL'?/^1502/.test(p.typecode):/^1503/.test(p.typecode))||matches.find(p=>/^170/.test(p.typecode)&&/陆港|码头/.test(p.name));
  if(!p){console.log(JSON.stringify({key,missing:true,choices:pois.map(p=>({name:p.name,city:p.city,type:p.typecode}))}));continue;}
  nodes.push({id:'corridor-node-'+key,name:p.name,type,province:p.province,city:p.city,district:p.district,address:p.address,lng:p.lng,lat:p.lat,coordinateSystem:'GCJ02',source:'AMAP_POI',sourceRef:p.sourceRef,sourceUrl:'https://lbs.amap.com/api/webservice/guide/api/search',quality:'PROVIDER',verifiedAt:new Date().toISOString()});
  console.log(JSON.stringify({key,name:p.name,city:p.city,type:p.typecode}));
 }
 await fs.writeFile('prisma/data/intermodal-node-lookup.json',JSON.stringify(raw,null,2));
 await fs.writeFile('prisma/data/intermodal-nodes.json',JSON.stringify(nodes,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
