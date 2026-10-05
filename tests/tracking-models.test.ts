import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validTrack,trackChunks,trackAt} from '../apps/web/src/tracking-motion';
const at=(lng:number,lat:number,minute:number,extra={})=>({longitude:lng,latitude:lat,observedAt:new Date(Date.UTC(2026,9,3,0,minute)).toISOString(),assetId:'car-1',sourceType:'GPS',...extra});
test('road gaps and impossible jumps are not connected or interpolated',()=>{
 const asset={mode:'ROAD',trajectory:[at(122,40,0),at(122.001,40.001,1),at(125,43,2),at(125.001,43.001,3)]};
 assert.equal(validTrack(asset)[2].gapBefore,true);assert.equal(trackChunks(asset).length,2);
 const position=trackAt(asset,Date.UTC(2026,9,3,0,1,30));assert.equal(position.longitude,122.001);assert.equal(position.trackGap,true);
});
test('ordinary sampled bends remain continuous and asset switches stay split',()=>{
 const asset={mode:'ROAD',trajectory:[at(122,40,0),at(122.001,40.002,1),at(122.002,40.002,2)]};
 assert.equal(trackChunks(asset).length,1);assert.equal(trackChunks(asset)[0].length,3);
 asset.trajectory[2]=at(122.002,40.002,2,{assetId:'car-2'});assert.equal(validTrack(asset)[2].gapBefore,true);
});
