const test=require('node:test');
const assert=require('node:assert/strict');
const data=require('../map_data/grain-source-statistics.json');
const boundaries=require('../map_data/grain-source-boundaries.json');

test('grain source uses seven disjoint reporting areas with dated official provenance',()=>{
 assert.equal(data.year,2025);
 const ids=['230000','220000','210000','150700','152200','150500','150400'];
 assert.deepEqual(data.regions.map(r=>r.id).sort(),ids.slice().sort());
 assert.deepEqual(boundaries.features.map(f=>f.properties.id).sort(),ids.slice().sort());
 assert.deepEqual(data.scope.mengdongIds.slice().sort(),ids.slice(3).sort());
 const sources=new Map(data.sources.map(s=>[s.id,s]));
 assert.equal(sources.size,data.sources.length);
 for(const source of data.sources){const url=new URL(source.url);assert.equal(url.protocol,'https:');assert(url.hostname.endsWith('.gov.cn'));assert.match(source.publishedAt,/^\d{4}-\d{2}-\d{2}$/);}
 for(const region of data.regions){
  assert.equal(region.year,data.year);
  assert(region.productionWanTons>0&&region.areaWanHectares>0);
  for(const id of Object.values(region.fieldSources).filter(Boolean))assert(sources.has(id),`${region.name}: ${id}`);
  assert.deepEqual(region.history.map(h=>h.year),[2023,2024,2025]);
  for(const record of region.history){assert(record.productionWanTons>0);assert(sources.has(record.sourceId));}
  assert.equal(region.history.find(h=>h.year===2025).productionWanTons,region.productionWanTons);
  const known=Object.values(region.grains).filter(v=>v!==null);
  assert(known.every(v=>typeof v==='number'&&v>=0));
  assert(known.reduce((sum,v)=>sum+v,0)<=region.productionWanTons+.5,`${region.name} crop components exceed total`);
 }
 const total=year=>data.regions.reduce((sum,r)=>sum+r.history.find(h=>h.year===year).productionWanTons,0);
 assert(Math.abs(total(2025)-18275.54)<.001);
 assert(Math.abs(total(2024)-17799.85)<.001);
 assert.equal(data.regions.find(r=>r.id==='150400').grains.corn,null,'Unpublished crop data stays absent');
 assert.equal(data.regions.find(r=>r.id==='220000').grains.soybean,86.8,'Official soybean output: 17.36 亿斤 × 5');
});

test('crop estimates preserve official gaps, disclose assumptions and stay within total production',()=>{
 const sources=new Set(data.sources.map(s=>s.id));let count=0;
 for(const r of data.regions){
  const merged={...r.grains};
  for(const [crop,e] of Object.entries(r.grainEstimates||{})){
   count++;assert.equal(r.grains[crop],null);assert(e.value>0);assert(e.method&&e.formula&&e.uncertainty);assert(e.sourceIds.every(s=>sources.has(s)));merged[crop]=e.value;
  }
  assert(Object.values(merged).reduce((sum,v)=>sum+(v||0),0)<=r.productionWanTons);
  for(const crop of ['corn','rice','soybean'])assert(merged[crop]>0,`${r.name} ${crop} display missing`);
 }
 assert.equal(count,4);
 const cf=data.regions.find(r=>r.id==='150400').grainEstimates;
 assert.equal(cf.corn.value,Math.round(504.4/650*704.6*10)/10);
 assert.equal(cf.rice.value,Math.round(10.7/650*704.6*10)/10);
 assert.equal(cf.soybean.value,Math.round(12.7*.9/650*704.6*10)/10);
 const hl=data.regions.find(r=>r.id==='150700');assert(hl.grainEstimates.rice.value+398.77+182.76+71.49+35.90<hl.productionWanTons);
});

test('county catalogue keeps unique real administrative centres and original classification',()=>{
 const {data:points,meta}=require('../map_data/grain-source-points.json');
 assert.equal(points.length,132);assert.equal(new Set(points.map(p=>p.adcode)).size,132);
 assert.equal(points.filter(p=>p.level==='core').length,39);assert.equal(points.filter(p=>p.level==='key').length,68);
 assert(meta.description.includes('不代表官方'));
 for(const p of points){assert(p.lng>115&&p.lng<136&&p.lat>38&&p.lat<54);assert.equal(p.pointType,'county_admin_center');assert(p.grainTypes.length);assert.equal(p.weight,{core:5,key:4,normal:3}[p.level]);if(p.province==='内蒙古')assert(['呼伦贝尔','兴安盟','通辽','赤峰'].includes(p.prefecture));}
});
