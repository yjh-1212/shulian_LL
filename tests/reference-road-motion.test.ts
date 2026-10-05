import {test} from 'node:test';
import assert from 'node:assert/strict';
import {referenceRoadMovement,referenceRoadHistory,referenceRoadForecast} from '../apps/api/src/reference-road-motion';
import {referencePosition,referenceChunks} from '../apps/web/src/tracking-reference-motion';
import {prepareTrack,trackAt,validTrack} from '../apps/web/src/tracking-motion';
const start=Date.UTC(2026,9,3),end=start+3600000;
const spec={version:1,sourceSystem:'BUSINESS_INITIALIZATION',quality:'INITIALIZATION',routeSource:'AMAP_V5_DRIVING',startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),coordinates:[[123,41],[123.003,41],[123.003,41.003]]};
const task=()=>({id:'truck-1',mode:'ROAD',status:'IN_TRANSIT',vehicleId:'vehicle-1',feedback:JSON.stringify({referenceRoadMotion:spec}),business:{package:{status:'DRAFT',snapshot:JSON.stringify({sourceSystem:'BUSINESS_INITIALIZATION'})}},trackPoints:[]});
test('only explicitly tagged initialization drafts move; actual observations win',()=>{
 assert.ok(referenceRoadMovement(task()));
 for(const patch of [{mode:'RAIL'},{status:'COMPLETED'},{business:{package:{status:'EFFECTIVE',snapshot:JSON.stringify({sourceSystem:'BUSINESS_INITIALIZATION'})}}},{trackPoints:[{sourceType:'BEIDOU'}]},{trackPoints:[{sourceType:'GPS'}]},{business:{package:{status:'DRAFT',snapshot:'{}'}}}])assert.equal(referenceRoadMovement({...task(),...patch}),null);
});
test('reference history reveals no future points and stops at destination without looping',()=>{
 assert.deepEqual(referenceRoadHistory(task(),start-1),[]);
 const half=referenceRoadHistory(task(),start+1800000)!;
 assert.equal(Number(half.at(-1)!.observedAt),start+1800000);assert.ok(half.every(p=>Number(p.observedAt)<=start+1800000));
 const final=referenceRoadHistory(task(),end+3600000)!;assert.equal(final.at(-1)!.longitude,123.003);assert.equal(final.at(-1)!.latitude,41.003);assert.equal(Number(final.at(-1)!.observedAt),end);assert.equal(final.at(-1)!.sourceType,'INITIALIZATION');
 assert.equal(referenceRoadForecast(task(),end+1)!.remainingKm,0);
});
test('invalid geometry and impossible speed never create moving positions',()=>{
 for(const change of [{coordinates:[[123,41],[126,44],[126.001,44]]},{endAt:new Date(start+1000).toISOString()},{coordinates:[[123,41],[NaN,41],[123,41.003]]}])assert.equal(referenceRoadMovement({...task(),feedback:JSON.stringify({referenceRoadMotion:{...spec,...change}})}),null);
});
test('client position follows sampled road bends with independent vehicle schedules',()=>{
 const m=referenceRoadMovement(task())!,a={id:'one',mode:'ROAD',movement:m},p=referencePosition(a,start+1800000);
 assert.equal(p.longitude,123.003);assert.ok(p.latitude>=41&&p.latitude<41.003);assert.equal(p.sourceSystem,'BUSINESS_INITIALIZATION');
 const later={...m,points:m.points.map((x:number[])=>[x[0],x[1],x[2]+600000])},q=referencePosition({...a,id:'two',movement:later},start+1800000);
 assert.ok(Math.hypot(p.longitude-q.longitude,p.latitude-q.latitude)>.0005);
 assert.ok(referenceChunks(a,start+1800000).flat().every(x=>Number(new Date(x.observedAt))<=start+1800000));
 assert.equal(referencePosition(a,start-1),null);
});
test('prepared tracks interpolate quickly while live mutations remain revalidated',()=>{
 const trajectory=[{longitude:123,latitude:41,observedAt:start,sourceType:'GPS',assetId:'a'},{longitude:123.001,latitude:41,observedAt:end,sourceType:'GPS',assetId:'a'}],a=prepareTrack({mode:'ROAD',trajectory});
 assert.equal(trackAt(a,start+1800000).longitude,123.0005);assert.equal(validTrack(a),validTrack(a));
 trajectory[1]={...trajectory[1],assetId:'b'};assert.equal(validTrack({mode:'ROAD',trajectory})[1].gapBefore,true);
});
