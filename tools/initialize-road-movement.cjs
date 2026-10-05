/* Default is read-only. --apply updates only initialization draft reference
 * schedules. Cached AMap routes are used; no GPS/provider record is invented. */
const {PrismaClient}=require('@prisma/client');
const {createHash}=require('node:crypto');
const {mkdir,readFile,writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
require('dotenv').config({quiet:true});
const SOURCE='BUSINESS_INITIALIZATION',MARKER='business-init-v1-road-movement-v1',HOUR=3600000;
const parse=JSON.parse,sha=v=>createHash('sha256').update(v).digest('hex');
const meters=(a,b)=>{const r=Math.PI/180,dy=(b[1]-a[1])*r,dx=(b[0]-a[0])*r;return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(dy/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dx/2)**2)));};
function continuous(path){const result=[path[0]];for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=meters(a,b);if(d<.1)continue;const steps=Math.ceil(d/900);for(let n=1;n<=steps;n++)result.push([a[0]+(b[0]-a[0])*n/steps,a[1]+(b[1]-a[1])*n/steps]);}return result;}
async function main(){const db=new PrismaClient();try{
 const prior=await db.auditLog.findUnique({where:{id:MARKER}});if(prior){console.log(JSON.stringify({status:'ALREADY_INITIALIZED',...parse(prior.after)},null,2));return;}
 const ids=[5,6].flatMap(b=>[3,4,5,6].map(i=>`business-init-v1-task-${b}-1-1-${i}`));
 const tasks=await db.transportTask.findMany({where:{id:{in:ids}},include:{stage:true,business:{include:{package:true}},trackPoints:{select:{sourceType:true}}},orderBy:{id:'asc'}});
 if(tasks.length!==8)throw Error('Expected eight designated initialization road trips');
 const routes=await db.routeGeometry.findMany({where:{mode:'ROAD',source:'AMAP_V5_DRIVING'},select:{id:true,coordinates:true,distanceMeters:true,steps:true,source:true,queriedAt:true}});
 const now=Date.now(),updates=[];
 for(const task of tasks){const snapshot=parse(task.business.package.snapshot),feedback=parse(task.feedback);
  if(task.mode!=='ROAD'||task.status!=='IN_TRANSIT'||task.business.package.status!=='DRAFT'||snapshot.sourceSystem!==SOURCE||feedback.sourceSystem!==SOURCE||task.trackPoints.some(p=>p.sourceType!=='INITIALIZATION'))throw Error('Reference-only guard failed: '+task.id);
  const segment=snapshot.plan.segments.find(s=>s.mode==='ROAD'&&s.origin.name===task.stage.origin&&s.destination.name===task.stage.destination);
  if(!segment)throw Error('Missing source segment');
  const origin=[segment.origin.lng,segment.origin.lat],destination=[segment.destination.lng,segment.destination.lat],seen=new Set();
  const candidates=routes.map(g=>({...g,path:parse(g.coordinates)})).filter(g=>meters(g.path[0],origin)<350&&meters(g.path.at(-1),destination)<350).sort((a,b)=>a.distanceMeters-b.distanceMeters).filter(g=>{const k=sha(g.coordinates);if(seen.has(k))return false;seen.add(k);return true;});
  if(candidates.length<2)throw Error('Need distinct cached road alternatives');
  const index=Number(task.id.split('-').at(-1))-3,isLong=task.businessId==='business-init-v1-logistics-5'||task.id.includes('-task-5-'),g=candidates[index%3],path=continuous(g.path),duration=(isLong?12:4)*HOUR,ratio=(isLong?[.83,.59,.36,.12]:[.80,.55,.30,.08])[index],start=now-duration*ratio,end=start+duration;
  const km=path.slice(1).reduce((total,p,i)=>total+meters(path[i],p),0)/1000;
  if(path.length>6000||km/(duration/HOUR)>100)throw Error('Unsafe route/speed');
  const roads=[...new Set(parse(g.steps).map(s=>s.road).filter(Boolean))].filter(s=>s.includes('高速')).slice(0,3);
  const spec={version:1,sourceSystem:SOURCE,quality:'INITIALIZATION',routeSource:g.source,geometryId:g.id,geometryQueriedAt:g.queriedAt,routeName:roads.join(' → ')||`${task.stage.origin} → ${task.stage.destination} · 道路方案 ${index%3+1}`,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),coordinates:path};
  updates.push({task,feedback:{...feedback,referenceRoadMotion:spec},start:new Date(start),end:new Date(end),summary:{taskId:task.id,vehicleId:task.vehicleId,routeName:spec.routeName,geometryId:g.id,points:path.length,distanceKm:Math.round(km*10)/10,referenceKmh:Math.round(km/(duration/HOUR)*10)/10,startAt:spec.startAt,endAt:spec.endAt,progressAtCreation:ratio}});
 }
 const summary={sourceSystem:SOURCE,quality:'INITIALIZATION',trips:updates.map(u=>u.summary),providerRecordsWritten:0,trackPointsPreserved:true,clockRate:1};
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({status:'PREVIEW',...summary},null,2));return;}
 const directory=resolve('.local/backups','road-movement-'+new Date(now).toISOString().replace(/[:.]/g,'-'));await mkdir(directory,{recursive:true});const backup=resolve(directory,'database.db');
 await db.$executeRawUnsafe(`VACUUM INTO '${backup.replace(/'/g,"''")}'`);const bytes=await readFile(backup);await writeFile(resolve(directory,'manifest.json'),JSON.stringify({sourceSystem:SOURCE,createdAt:new Date(now).toISOString(),bytes:bytes.length,sha256:sha(bytes),method:'SQLITE_VACUUM_INTO'},null,2));
 const admin=await db.user.findFirst({where:{businessEntity:{type:'PLATFORM'},status:'ACTIVE',deletedAt:null}});if(!admin)throw Error('Missing platform actor');
 await db.$transaction(async tx=>{
  for(const u of updates){const current=await tx.transportTask.findUniqueOrThrow({where:{id:u.task.id},include:{business:{include:{package:true}}}});if(current.feedback!==u.task.feedback||current.business.package.status!=='DRAFT')throw Error('Concurrent task edit, refusing overwrite');await tx.transportTask.update({where:{id:current.id},data:{feedback:JSON.stringify(u.feedback),plannedStartAt:u.start,plannedEndAt:u.end}});}
  for(const stageId of [...new Set(updates.map(u=>u.task.stageId))]){const stage=await tx.transportStage.findUniqueOrThrow({where:{id:stageId}}),changes=updates.filter(u=>u.task.stageId===stageId),allocations=parse(stage.allocations).map(a=>{const u=changes.find(v=>v.task.vehicleId===a.vehicleId);return u?{...a,startAt:u.start.toISOString(),endAt:u.end.toISOString()}:a;});await tx.transportStage.update({where:{id:stageId},data:{allocations:JSON.stringify(allocations),plannedStartAt:new Date(Math.min(...allocations.map(a=>Date.parse(a.startAt)))),plannedEndAt:new Date(Math.max(...allocations.map(a=>Date.parse(a.endAt))))}});}
  await tx.auditLog.create({data:{id:MARKER,userId:admin.id,userName:admin.displayName,role:'platform',businessEntityId:admin.businessEntityId,ip:'local',userAgent:'reference-road-movement',module:'运输参考轨迹',objectId:MARKER,action:'补充错峰车辆道路运动参考',after:JSON.stringify({...summary,backup,initializedAt:new Date(now).toISOString()}),requestId:MARKER}});
 },{timeout:30000});
 await mkdir(resolve('docs/acceptance'),{recursive:true});await writeFile(resolve('docs/acceptance/road-movement-initialization.json'),JSON.stringify({...summary,backup,initializedAt:new Date(now).toISOString()},null,2));console.log(JSON.stringify({status:'INITIALIZED',...summary,backup},null,2));
 }finally{await db.$disconnect();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
