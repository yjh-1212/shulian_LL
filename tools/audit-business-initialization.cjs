const {PrismaClient}=require('@prisma/client');
const {strict:assert}=require('node:assert');
const {writeFile,readFile}=require('node:fs/promises');
const {createHash}=require('node:crypto');
const {meters}=require('./initialize-business-data.cjs');
require('dotenv').config({quiet:true});
async function main(){const db=new PrismaClient();try{
 const businesses=await db.logisticsBusiness.findMany({where:{id:{startsWith:'business-init-v1-waybill-'}},include:{package:{include:{revisions:{include:{signatures:true}}}},stages:{include:{tasks:{include:{trackPoints:{orderBy:{observedAt:'asc'}}}}}}}});
 const [vehicles,users,orders,supplies,bills,templates]=await Promise.all([
  db.fleetVehicle.findMany(),db.user.findMany({select:{id:true,businessEntityId:true}}),
  db.tradeOrder.count({where:{sourceSystem:'BUSINESS_INITIALIZATION'}}),
  db.transportSupply.findMany({where:{id:{startsWith:'business-init-v1-supply-'}}}),
  db.bill.findMany({where:{id:{startsWith:'business-init-v1-bill-'}}}),
  db.contractTemplate.findMany({where:{status:{not:'ARCHIVED'}},select:{id:true,name:true}}),
 ]);
 assert.equal(businesses.length,16);assert.equal(orders,16);assert.equal(supplies.length,16);assert.equal(bills.length,4);
 const counts={tasks:0,points:0,roadTasks:0,activeRoadTasks:0,signatureRecords:0};const grains=new Set(),families=new Set(),rows=[];
 for(const b of businesses){const snap=JSON.parse(b.package.snapshot);assert.equal(snap.sourceSystem,'BUSINESS_INITIALIZATION');assert.equal(snap.verification,'UNVERIFIED_BUSINESS_RECORD');assert.equal(b.package.status,'DRAFT');assert.equal(b.package.quantityKg%100,0);assert.equal(b.package.isTestData,false);grains.add(snap.grain);families.add(snap.plan.segments.map(s=>s.mode).join('/'));
  for(const r of b.package.revisions){assert.equal(r.signatures.length,0);counts.signatureRecords+=r.signatures.length;}
  const activeCoordinates=[];
  for(const s of b.stages){const segment=snap.plan.segments.find(p=>p.mode===s.mode&&p.origin.name===s.origin&&p.destination.name===s.destination);assert.ok(segment?.geometry?.coordinates?.length>=3);if(s.mode==='RAIL')assert.equal(segment.geometry.source,'OPENSTREETMAP_RAIL_INFRASTRUCTURE');
   let returned=0;
   for(const t of s.tasks){counts.tasks++;counts.points+=t.trackPoints.length;assert.ok(t.trackPoints.length<=5000);if(t.mode==='ROAD'){counts.roadTasks++;assert.equal(t.quantityKg,0);const vehicle=vehicles.find(v=>v.id===t.vehicleId);assert.equal(vehicle?.carrierId,b.package.carrierId);assert.equal(users.find(u=>u.id===t.driverId)?.businessEntityId,b.package.carrierId);assert.ok((t.unloadedKg||0)<=vehicle.capacityKg);returned+=t.unloadedKg||0;if(t.status==='IN_TRANSIT'){counts.activeRoadTasks++;const p=t.trackPoints.at(-1);assert.ok(p);activeCoordinates.push(p.longitude+','+p.latitude);}}
    for(let i=0;i<t.trackPoints.length;i++){const p=t.trackPoints[i];assert.equal(p.sourceType,'INITIALIZATION');assert.equal(p.dataQuality,'INITIALIZATION');assert.equal(p.isTestData,false);assert.ok(p.longitude>=70&&p.longitude<=140&&p.latitude>=15&&p.latitude<=55);if(i){const prev=t.trackPoints[i-1];assert.ok(meters([prev.longitude,prev.latitude],[p.longitude,p.latitude])<=1501,'轨迹点间距过大');assert.ok(p.observedAt>=prev.observedAt);}}
    if(t.status==='COMPLETED'&&t.trackPoints.length){const last=t.trackPoints.at(-1),end=segment.geometry.coordinates.at(-1);assert.ok(meters([last.longitude,last.latitude],end)<5,'完整回放缺少终点');}
   }assert.ok(returned<=s.quantityKg,'阶段数量超出运单量');
  }assert.equal(new Set(activeCoordinates).size,activeCoordinates.length,'在途车辆坐标重复');rows.push({waybill:b.waybillNo,grain:snap.grain,tonnes:(b.package.quantityKg/1000).toFixed(1),status:b.status,route:snap.plan.segments.map(s=>s.mode),tasks:b.stages.reduce((n,s)=>n+s.tasks.length,0),activeRoadCoordinates:activeCoordinates.length});
 }
 assert.equal(grains.size,4);assert.equal(families.size,4);assert.ok(supplies.some(s=>s.loadingType==='BULK'));assert.ok(supplies.some(s=>s.loadingType==='CONTAINER'));assert.ok(bills.every(b=>b.status==='DRAFT'));assert.ok(templates.every(t=>!/模拟|演示|验收/.test(t.name)));
 const manifest=JSON.parse(await readFile('docs/acceptance/business-data-initialization.json','utf8'));const backup=await readFile(manifest.backupPath+'/database.db');const saved=JSON.parse(await readFile(manifest.backupPath+'/manifest.json','utf8'));assert.equal(createHash('sha256').update(backup).digest('hex'),saved.sha256);
 const result={checkedAt:new Date().toISOString(),passed:true,orders,supplies:supplies.length,bills:bills.length,grains:[...grains],...counts,backupVerified:true,checks:['16个运单来源可追溯','合同草案无签章','吨数1位小数','道路任务不预分配运输量','车辆司机归属正确','回传净重不超车辆和阶段','轨迹点连续并保留完成终点','在途多车坐标各异','非道路几何齐全','散货与集装箱运力','旧模板归档','备份SHA256验证'],waybills:rows};await writeFile('docs/acceptance/business-data-integrity.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,orders,waybills:businesses.length,supplies:supplies.length,bills:bills.length,...counts,backupVerified:true}));
 }finally{await db.$disconnect();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
