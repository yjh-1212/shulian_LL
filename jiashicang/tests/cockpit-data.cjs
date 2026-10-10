const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const fs=require('node:fs');
const path=require('node:path');
require('dotenv').config({quiet:true});
const cockpit=require('../server/cockpit.cjs');
const {corridorProgress}=require('../../apps/api/dist/tracking-quantities');
const db=new PrismaClient();
(async()=>{
 const counts=async()=>({business:await db.logisticsBusiness.count(),demand:await db.transportDemand.count(),contract:await db.contractPackage.count()});
 const baseline=await counts();
 const started=Date.now(),overview=await cockpit.publicOverview(db,{period:'all'}),overviewMs=Date.now()-started;
 const rows=await db.logisticsBusiness.findMany({where:{package:{isTestData:false}},include:{package:true}}),ids=new Set(rows.map(b=>b.id));
 assert.equal(overview.businesses.length,rows.length);assert.ok(overview.businesses.every(b=>ids.has(b.id)));
 assert.equal(overview.metrics.transportedKg,rows.reduce((s,b)=>s+b.package.quantityKg,0),'Quantity must count a business once');
 const stats=overview.statistics;
 for(const name of ['origins','destinations','modeVolumes','heatmap'])assert.equal(stats[name].reduce((s,row)=>s+row.value,0),overview.metrics.transportedKg,`${name} must conserve quantity`);
 for(const column of [0,1])assert.equal(stats.links.filter(link=>link.column===column).reduce((s,row)=>s+row.value,0),overview.metrics.transportedKg,'Sankey layers must conserve quantity');
 assert.ok(stats.scatter.every(point=>Number.isFinite(point.x)&&point.x>0&&Number.isFinite(point.y)&&point.y>0));
 assert.equal(stats.financeTrend.reduce((sum,row)=>sum+row.first,0),overview.finance.totalCents,'Monthly bill totals must agree with stored bills');
 assert.equal(stats.fulfillment.total,overview.businesses.length);
 for(const g of overview.grains){const filtered=await cockpit.publicOverview(db,{period:'all',grain:g});assert.ok(filtered.businesses.every(b=>b.grain===g));assert.equal(filtered.metrics.transportedKg,filtered.businesses.reduce((s,b)=>s+b.quantityKg,0));}
 const combo=b=>['ROAD','RAIL','WATER'].filter(m=>b.modes.includes(m)).map(m=>({ROAD:'公',RAIL:'铁',WATER:'水'}[m])).join('');
 const scopes=[...new Map(overview.businesses.map(b=>[b.origin+'|'+b.destination+'|'+combo(b),{origin:b.origin,destination:b.destination,combination:combo(b)}])).values()];
 for(const scope of scopes){
  const selected=overview.businesses.filter(b=>b.origin===scope.origin&&b.destination===scope.destination&&combo(b)===scope.combination),selectedIds=selected.map(b=>b.id);
  const filtered=await cockpit.publicOverview(db,{period:'all',...scope});
  assert.deepEqual(filtered.businesses.map(b=>b.id).sort(),selectedIds.sort());
  const quantity=selected.reduce((sum,b)=>sum+b.quantityKg,0);
  assert.equal(filtered.metrics.transportedKg,quantity);
  for(const name of ['origins','destinations','modeVolumes','heatmap'])assert.equal(filtered.statistics[name].reduce((s,r)=>s+r.value,0),quantity);
  const expectedBills=await db.bill.findMany({where:{businessId:{in:selectedIds},isTestData:false},select:{totalCents:true}});
  assert.equal(filtered.finance.totalCents,expectedBills.reduce((s,b)=>s+b.totalCents,0),'Scoped bills cannot include other corridors');
  assert.equal(filtered.statistics.fulfillment.contracts,new Set(selected.map(b=>b.contractNo)).size);
 }
 const node=overview.businesses[0].segments[0].origin,byNode=await cockpit.publicOverview(db,{period:'all',node});
 assert.ok(byNode.businesses.length>0&&byNode.businesses.every(b=>b.segments.some(s=>s.origin===node||s.destination===node)));
 const byRegion=await cockpit.publicOverview(db,{period:'all',region:'广东省'});assert.equal(byRegion.businesses.length,overview.businesses.length);
 const noRegion=await cockpit.publicOverview(db,{period:'all',region:'不存在的省份'});assert.equal(noRegion.resources.supplies,0);assert.equal(noRegion.finance.totalCents,0);
 const empty=await cockpit.publicOverview(db,{period:'all',grain:'不存在的粮种'});assert.equal(empty.businesses.length,0);assert.equal(empty.statistics.heatmap.length,0);assert.equal(empty.statistics.links.length,0);
 const fixture=await db.logisticsBusiness.findFirst({where:{package:{isTestData:true}}});if(fixture)assert.equal(await cockpit.publicChain(db,fixture.id,corridorProgress),null);
 assert.equal(await cockpit.publicChain(db,'not-a-business',corridorProgress),null);
 for(const b of overview.businesses){
  const detail=await cockpit.publicChain(db,b.id,corridorProgress);assert.ok(detail);assert.equal(detail.quantityKg,b.quantityKg);
  for(const s of detail.segments)if(s.geometry){assert.ok(!/SIMULAT|PREVIEW|SYNTHETIC/i.test(s.geometry.source));assert.ok(s.geometry.coordinates.every(([lng,lat])=>cockpit.validPoint({lng,lat})));}
  for(const a of detail.assets){assert.ok(a.trajectory.every((p,i)=>!i||new Date(p.at)>=new Date(a.trajectory[i-1].at)));assert.ok(!('phone' in a)&&!('driverId' in a));}
  assert.ok(detail.documents.every(d=>!('bytes' in d)&&!('digest' in d)),'Display returns evidence metadata only');
 }
 assert.deepEqual(await counts(),baseline,'No business records created for visualization');
 const result={status:'PASS',readOnly:true,loginRequired:false,addedBusinessRecords:0,baseline,visibleBusinesses:overview.businesses.length,initializedBusinesses:overview.provenance.initializedBusinesses,plannedTons:overview.metrics.transportedKg/1000,overviewMs};
 fs.mkdirSync(path.resolve(__dirname,'../acceptance'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../acceptance/data-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
