import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {metres,preparePath,pointAlong,buildPlayback} from '../src/route-math';
import {buildCorridors,mapData,matchingCorridors} from '../src/network';
import type {Business,NetworkReference,Corridor,NetworkSegment} from '../src/types';

const reference:NetworkReference=JSON.parse(fs.readFileSync(path.resolve('jiashicang/map_data/transport-network.json'),'utf8'));
test('distance based playback follows each bend, including uneven and repeated vertices',()=>{
 const route=preparePath([[0,0],[0,0],[.01,0],[.01,.03]]);
 for(let i=0;i<=100;i++){
  const {point,heading}=pointAlong(route,i/100);
  assert.ok(Number.isFinite(heading)&&Number.isFinite(point.lat)&&Number.isFinite(point.lng));
  assert.ok(Math.abs(point.lat)<1e-8||Math.abs(point.lng-.01)<1e-8,'A vehicle must remain on one of the two perpendicular legs');
 }
 const halfway=pointAlong(route,.5).point;
 assert.ok(Math.abs(halfway.lng-.01)<1e-8&&Math.abs(halfway.lat-.01)<1e-6,'Halfway uses distance rather than vertex count');
 assert.deepEqual(pointAlong(route,-1).point,{lng:0,lat:0});
 assert.deepEqual(pointAlong(route,2).point,{lng:.01,lat:.03});
});

test('unverified port approaches are gaps without a vehicle; transfer pauses precede the next mode',()=>{
 const sea=reference.segments.find(s=>s.mode==='WATER')!,road=reference.segments.find(s=>s.mode==='ROAD')!;
 const corridor={segments:[sea,road]} as Corridor,schedule=buildPlayback(corridor);
 const states=Array.from({length:Math.ceil(schedule.duration*10)},(_,i)=>schedule.at(i/10)!);
 assert.ok(states.some(s=>s.phase==='handoff'&&s.point===null));
 assert.ok(states.some(s=>s.phase==='gap'&&s.point===null));
 assert.ok(states.filter(s=>s.phase==='gap').every(s=>s.point===null));
 assert.ok(states.some(s=>s.mode==='WATER'&&s.phase==='moving'));
 assert.ok(states.some(s=>s.mode==='ROAD'&&s.phase==='moving'));
 const last=schedule.at(schedule.duration)!;
 assert.equal(last.phase,'complete');assert.equal(last.percent,100);
 assert.deepEqual(last.point,{lng:road.coordinates.at(-1)![0],lat:road.coordinates.at(-1)![1]});
 assert.equal(buildPlayback({segments:[]} as unknown as Corridor).at(0),null);
});

test('business quantity is counted once per corridor and shared physical legs are deduplicated',()=>{
 const stages=reference.segments.filter(s=>s.origin==='公主岭站'&&s.mode==='ROAD').slice(0,1);
 const water=reference.segments.find(s=>s.origin===stages[0].destination&&s.mode==='WATER')!;
 const segments=[...stages,water];
 const b=(id:string,grain:string,quantityKg:number):Business=>({id,businessNo:id,waybillNo:id,contractNo:id,grain,quantityKg,status:'IN_PROGRESS',origin:segments[0].origin,destination:water.destination,trader:'',carrier:'',nodes:[],modes:['ROAD','WATER'],segments:segments.map(s=>({mode:s.mode,origin:s.origin,destination:s.destination})),createdAt:'2026-10-01',referenceData:false,stageCount:2,completedStages:0});
 const rows=[b('a','玉米',10000),b('b','小麦',20000)],corridors=buildCorridors(rows,reference);
 assert.equal(corridors.length,1);assert.equal(corridors[0].quantityKg,30000);
 assert.deepEqual(corridors[0].segments.map(s=>s.id),segments.map(s=>s.id));
 const data=mapData(corridors,reference,new Set(corridors.map(c=>c.id)));
 assert.equal(data.routes.length,2);assert.ok(data.routes.every(r=>r.quantityKg===30000));
 assert.equal(data.nodes.find(n=>n.name===water.origin)?.kind,'port','The physical facility type must survive business role assignment');
 assert.equal(matchingCorridors(corridors,{dimension:'grain',value:'大豆'},rows).size,0);
 assert.equal(matchingCorridors(corridors,{dimension:'mode',value:'公水',grain:'玉米'},rows).size,1);
 const unknown={...rows[0],id:'unknown',segments:[{mode:'RAIL',origin:'未知站',destination:'另一站'}]} as Business;
 assert.equal(buildCorridors([unknown],reference)[0].missingSegments,1,'Missing geography cannot become a straight endpoint link');
});

test('published sea edges are preserved and road/rail references retain detailed WGS84 paths',()=>{
 const maritime=JSON.parse(fs.readFileSync(path.resolve('jiashicang/tools/reference-data/marnet.geojson'),'utf8'));
 const edge=(a:number[],b:number[])=>[a.join(','),b.join(',')].sort().join('|'),edges=new Set<string>();
 for(const f of maritime.features){const parts=f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates];for(const p of parts)for(let i=1;i<p.length;i++)edges.add(edge(p[i-1],p[i]));}
 assert.equal(reference.coordinateSystem,'WGS84');assert.equal(reference.segments.length,10);
 for(const s of reference.segments){
  assert.ok(s.coordinates.length>2);assert.ok(s.coordinates.every(c=>c.length===2&&c.every(Number.isFinite)&&c[0]>73&&c[0]<136&&c[1]>3&&c[1]<54));
  const length=s.coordinates.slice(1).reduce((sum,c,i)=>sum+metres(s.coordinates[i],c),0);assert.ok(Math.abs(length-s.distanceMeters)<=1);
  if(s.mode==='WATER'){for(let i=1;i<s.coordinates.length;i++)assert.ok(edges.has(edge(s.coordinates[i-1],s.coordinates[i])),'Water geometry must use an actual published network edge');assert.ok(s.connectionMeters!.origin>1000);}
  else assert.ok(s.coordinates.length>20,'Road and rail must retain bends');
 }
});
