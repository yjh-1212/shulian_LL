const {PrismaClient}=require('@prisma/client');
const {strict:assert}=require('node:assert');
const {writeFile,readFile}=require('node:fs/promises');
const {createHash}=require('node:crypto');
const {ContractsService}=require('../apps/api/dist/contracts.service');
const {TrackingService}=require('../apps/api/dist/tracking.service');
const {TrackingWorkspaceService}=require('../apps/api/dist/tracking-workspace.service');
const {referenceRoadHistory}=require('../apps/api/dist/reference-road-motion');
require('dotenv').config({quiet:true});
const meters=(a,b)=>{const r=Math.PI/180,dy=(b.latitude-a.latitude)*r,dx=(b.longitude-a.longitude)*r;return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(dy/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(dx/2)**2)));};
async function main(){const db=new PrismaClient();let backup;try{
 const manifest=JSON.parse(await readFile('docs/acceptance/road-movement-initialization.json','utf8')),bytes=await readFile(manifest.backup),backupMeta=JSON.parse(await readFile(manifest.backup.replace(/database\.db$/,'manifest.json'),'utf8'));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),backupMeta.sha256);
 backup=new PrismaClient({datasources:{db:{url:'file:'+manifest.backup.replaceAll('\\','/')}}});
 assert.equal(await db.trackPoint.count(),await backup.trackPoint.count());
 const contracts=new ContractsService(db,null),tracking=new TrackingService(db,contracts,null,null),workspace=new TrackingWorkspaceService(db,contracts,tracking),user=await db.user.findUniqueOrThrow({where:{username:'admin'},include:{businessEntity:true}}),request={user},query={page:1,pageSize:20,mode:'ROAD',includeTest:'false'},rows=await workspace.list(query,request),active=rows.items.flatMap(w=>w.assets).filter(a=>a.mode==='ROAD'&&a.status==='IN_TRANSIT');
 assert.equal(active.length,8);assert.ok(active.every(a=>a.movement&&a.positionStatus==='FRESH'&&a.position.dataQuality==='INITIALIZATION'&&a.eta===a.movement.endAt));
 assert.equal(new Set(active.map(a=>a.movement.geometryId)).size,6);assert.equal(new Set(active.map(a=>a.plannedDepartureAt)).size,8);
 assert.ok(active.every(a=>!a.alerts.some(r=>['STALE_POSITION','DEVIATION','STATIONARY','ETA_DELAY'].includes(r.type))));
 let minimum=Infinity;for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)minimum=Math.min(minimum,meters(active[i].position,active[j].position));assert.ok(minimum>1000);
 const now=Date.now(),trips=[];
 for(const a of active){const t=await db.transportTask.findUniqueOrThrow({where:{id:a.id},include:{business:{include:{package:true}},trackPoints:{take:80}}}),p=referenceRoadHistory(t,now).at(-1),q=referenceRoadHistory(t,now+10000).at(-1),speed=meters(p,q)/10*3.6;
  assert.ok(speed>20&&speed<65);assert.ok(a.trajectory.every(p=>new Date(p.observedAt).getTime()<=now));assert.ok(a.trajectory.every(p=>!p.gapBefore));
  trips.push({plate:a.title,taskId:a.id,geometryId:a.movement.geometryId,departureAt:a.plannedDepartureAt,eta:a.eta,distanceKm:a.movement.distanceMeters/1000,position:a.position,measuredTenSecondKmh:Math.round(speed*10)/10,points:a.trajectory.length});
 }
 const proof={checkedAt:new Date().toISOString(),passed:true,activeTrucks:8,uniqueRoadPaths:6,independentDepartures:8,minimumSeparationMeters:Math.round(minimum),trackRecordsPreserved:true,backupSha256:backupMeta.sha256,referenceClockRate:1,trips};
 await writeFile('docs/acceptance/road-movement-verification.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({passed:true,activeTrucks:8,uniqueRoadPaths:6,independentDepartures:8,minimumSeparationMeters:proof.minimumSeparationMeters,trackRecordsPreserved:true}));
 }finally{await backup?.$disconnect();await db.$disconnect();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
