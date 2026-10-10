// Export geographic references only. Never creates business rows or positioning records.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config({quiet:true});
const {PrismaClient} = require('@prisma/client');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0,16);
const distance = (a,b) => {const r=Math.PI/180,p=(b[1]-a[1])*r,q=(b[0]-a[0])*r;return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(p/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(q/2)**2)));};
// Iterative RDP, with a 25 m maximum perpendicular deviation. Retain the route's turns.
function simplify(points, tolerance=25){
 const out=new Set([0,points.length-1]),stack=[[0,points.length-1]];
 while(stack.length){const [a,b]=stack.pop();let far=tolerance,index=-1;const scale=Math.cos(points[a][1]*Math.PI/180),x=(points[b][0]-points[a][0])*111320*scale,y=(points[b][1]-points[a][1])*111320;
  for(let i=a+1;i<b;i++){const px=(points[i][0]-points[a][0])*111320*scale,py=(points[i][1]-points[a][1])*111320,t=Math.max(0,Math.min(1,(px*x+py*y)/(x*x+y*y||1))),d=Math.hypot(px-t*x,py-t*y);if(d>far){far=d;index=i;}}
  if(index>=0){out.add(index);stack.push([a,index],[index,b]);}
 }
 return [...out].sort((a,b)=>a-b).map(i=>points[i].map(n=>+n.toFixed(6)));
}
// GCJ02 references in the existing database -> WGS84 used by maritime/OSM geometry.
function toWgs(point){let w=[...point];for(let i=0;i<4;i++){const g=toGcj(w);w=[w[0]+point[0]-g[0],w[1]+point[1]-g[1]];}return w;}
function toGcj([lng,lat]){
 const p=Math.PI,x=lng-105,y=lat-35;let a=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x)),b=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));
 a+=(20*Math.sin(6*x*p)+20*Math.sin(2*x*p))*2/3+(20*Math.sin(y*p)+40*Math.sin(y/3*p))*2/3+(160*Math.sin(y/12*p)+320*Math.sin(y*p/30))*2/3;
 b+=(20*Math.sin(6*x*p)+20*Math.sin(2*x*p))*2/3+(20*Math.sin(x*p)+40*Math.sin(x/3*p))*2/3+(150*Math.sin(x/12*p)+300*Math.sin(x/30*p))*2/3;
 const r=lat/180*p,m=1-.00669342162296594323*Math.sin(r)**2,s=Math.sqrt(m);return [lng+b*180/(6378245/s*Math.cos(r)*p),lat+a*180/(6378245*(1-.00669342162296594323)/(m*s)*p)];
}
function seaGraph(){
 const graph=new Map(),nodes=new Map();
 for(const f of read(path.join(__dirname,'reference-data/marnet.geojson')).features){
  const parts=f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates];
  for(const points of parts)for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],ak=a.join(','),bk=b.join(',');nodes.set(ak,a);nodes.set(bk,b);if(!graph.has(ak))graph.set(ak,[]);if(!graph.has(bk))graph.set(bk,[]);graph.get(ak).push([bk,distance(a,b)]);graph.get(bk).push([ak,distance(a,b)]);}
 }
 return {graph,nodes};
}
function seaPath(network,start,end){
 const nearest=p=>[...network.nodes].reduce((best,[key,c])=>distance(p,c)<best.d?{key,d:distance(p,c)}:best,{d:Infinity,key:''});
 const a=nearest(start),b=nearest(end),cost=new Map([[a.key,0]]),previous=new Map(),open=new Set([a.key]);
 while(open.size){let current='',best=Infinity;for(const key of open)if(cost.get(key)<best){best=cost.get(key);current=key;}open.delete(current);if(current===b.key)break;
  for(const [next,d] of network.graph.get(current)||[])if(best+d<(cost.get(next)??Infinity)){cost.set(next,best+d);previous.set(next,current);open.add(next);}
 }
 if(!cost.has(b.key))throw Error('Published maritime network is disconnected');
 const keys=[b.key];while(previous.has(keys[0]))keys.unshift(previous.get(keys[0]));
 // Preserve network vertices; never append an invented straight port approach.
 return {coordinates:keys.map(k=>network.nodes.get(k)),connectionMeters:{origin:Math.round(a.d),destination:Math.round(b.d)}};
}
async function main(){
 const db=new PrismaClient({errorFormat:'minimal'});
 try{
  const rows=await db.logisticsBusiness.findMany({where:{package:{isTestData:false}},include:{package:true}}),references=new Map(),nodes=new Map();
  for(const b of rows){const snap=parse(b.package.snapshot);for(const s of snap.plan?.segments||[]){
   if(!s.origin?.name||!s.destination?.name)continue;const key=[s.mode,s.origin.name,s.destination.name].join('|');
   for(const n of [s.origin,s.destination]){if(!Number.isFinite(n.lng)||!Number.isFinite(n.lat))continue;const coord=toWgs([n.lng,n.lat]);nodes.set(n.name,{id:n.name,name:n.name,lng:+coord[0].toFixed(6),lat:+coord[1].toFixed(6),province:n.province||'',kind:/港/.test(n.name)?'port':'rail',source:n.source||'AMAP_POI'});}
   if(references.has(key))continue;let geometry=s.geometry;if((!geometry?.coordinates?.length)&&s.geometryId)geometry=await db.routeGeometry.findUnique({where:{id:s.geometryId}});
   if(!geometry?.coordinates)continue;const coords=parse(geometry.coordinates);
   if(!Array.isArray(coords)||coords.length<3)continue;
   if(s.mode==='WATER'){references.set(key,{key,id:hash(key),mode:s.mode,origin:s.origin.name,destination:s.destination.name});continue;}
   if(!['AMAP_V5_DRIVING','OPENSTREETMAP_RAIL_INFRASTRUCTURE'].includes(geometry.source))continue;
   // Railway fixtures append unverified short station connectors. Exclude those connectors.
   const real=s.mode==='RAIL'?coords.slice(1,-1):coords;
   const wgs=real.map(toWgs);references.set(key,{key,id:hash(key),mode:s.mode,origin:s.origin.name,destination:s.destination.name,coordinates:simplify(wgs),source:geometry.source,sourceUrl:s.mode==='ROAD'?'https://lbs.amap.com/api/webservice/guide/api/newroute':'https://www.openstreetmap.org/copyright',sourceLabel:s.mode==='ROAD'?'高德道路路径':'OpenStreetMap 铁路基础设施',queriedAt:geometry.queriedAt||null,connectionMeters:geometry.connectionMeters||null,railLineNames:geometry.railLineNames||[],basis:s.mode==='ROAD'?'道路参考路径':'铁路基础设施走向'});
  }}
  const network=seaGraph(),source=read(path.join(__dirname,'reference-data/source.json'));
  for(const route of references.values()){
   if(route.mode==='WATER'){const a=nodes.get(route.origin),b=nodes.get(route.destination),sea=seaPath(network,[a.lng,a.lat],[b.lng,b.lat]);Object.assign(route,sea,{source:'MARNET_PUBLISHED_NETWORK',sourceUrl:'https://github.com/genthalili/searoute-py',sourceLabel:'Marnet 公开海运网络',queriedAt:source.retrievedAt,version:source.commit,basis:'港外航路参考；港区衔接段未包含'});}
   route.distanceMeters=Math.round(route.coordinates.slice(1).reduce((sum,c,i)=>sum+distance(route.coordinates[i],c),0));route.checksum=hash(JSON.stringify(route.coordinates));
  }
  const data={version:1,coordinateSystem:'WGS84',builtAt:new Date().toISOString(),sources:{road:'高德驾车路径缓存；未核验车辆限行参数',rail:'© OpenStreetMap contributors (ODbL)；铁路基础设施参考',water:'Marnet shipping lane network; searoute-py '+source.commit+' (Apache-2.0); upstream network: Eurostat SeaRoute / ORNL shipping lanes'},nodes:[...nodes.values()],segments:[...references.values()]};
  fs.writeFileSync(path.join(root,'map_data/transport-network.json'),JSON.stringify(data));console.log(JSON.stringify({nodes:data.nodes.length,segments:data.segments.map(s=>({mode:s.mode,origin:s.origin,destination:s.destination,points:s.coordinates.length,km:Math.round(s.distanceMeters/1000),connectionMeters:s.connectionMeters})),bytes:fs.statSync(path.join(root,'map_data/transport-network.json')).size},null,2));
 }finally{await db.$disconnect();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={simplify,distance,toWgs,seaPath};
