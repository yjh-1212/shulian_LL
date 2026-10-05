import {PrismaClient} from '@prisma/client';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
// Import only evidence-backed public references. Existing platform edits are preserved.
export async function seedPublicServices(db:PrismaClient){
 const read=async(file:string)=>JSON.parse(await readFile(resolve(__dirname,'data',file),'utf8'));
 for(const node of await read('intermodal-nodes.json'))await db.transportNode.upsert({where:{id:node.id},update:{},create:{...node,verifiedAt:new Date(node.verifiedAt)}});
 const lookups=[...await read('public-node-lookup.json'),...await read('puhe-node-lookup.json')];
 const selected=[['B0FFLAFJTD','RAIL'],['B0IR3HK9U0','RAIL'],['B0FFHWYHLO','PORT']];
 for(const [id,type] of selected){const p=lookups.flatMap(x=>x.pois).find(p=>p.id===id);if(!p)throw Error('Missing verified POI: '+id);const [lng,lat]=p.location.split(',').map(Number);
  await db.transportNode.upsert({where:{id:'amap-'+id},update:{},create:{id:'amap-'+id,name:p.name,type,province:p.province,city:p.city,district:p.district,address:p.address,lng,lat,coordinateSystem:'GCJ02',source:'AMAP_POI',sourceRef:id,sourceUrl:'https://lbs.amap.com/api/webservice/guide/api/search',quality:'PROVIDER',verifiedAt:new Date('2026-10-01T12:00:00Z')}});
 }
 for(const record of await read('public-services.json')){
  const {originName,destinationName,serviceInfo,...fields}=record;
  const origin=await db.transportNode.findFirst({where:{name:originName}}),destination=await db.transportNode.findFirst({where:{name:destinationName}});
  if(!origin||!destination)throw Error('Public line endpoint missing: '+record.id);
  const km=Math.hypot((origin.lng-destination.lng)*80,(origin.lat-destination.lat)*111)*1.3;const durationSeconds=fields.durationSeconds||Math.round((fields.mode==='WATER'?Math.max(72,km/16+24):Math.max(12,km/35+12))*3600);
  await db.transportLine.upsert({where:{id:record.id},update:{},create:{...fields,durationSeconds,originId:origin.id,destinationId:destination.id,serviceInfo:JSON.stringify(serviceInfo),sourceRef:serviceInfo.code,loadingTypes:'["CONTAINER"]',grainIds:'[]',quality:'PUBLIC_REFERENCE',transferMinutes:0,maintainer:'公开资料整理 · 待承运核实',isTestData:false}});
 }
}
