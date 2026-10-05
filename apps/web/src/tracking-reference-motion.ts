import {prepareTrack,trackAt,trackChunks,trackHeading} from './tracking-motion';

const tracks=new WeakMap<object,any>();
function motionTrack(a:any){
 const m=a.movement;
 if(!m||m.sourceSystem!=='BUSINESS_INITIALIZATION'||m.quality!=='INITIALIZATION'||m.routeSource!=='AMAP_V5_DRIVING')return null;
 if(!tracks.has(m))tracks.set(m,prepareTrack({mode:'ROAD',trajectory:m.points.map((p:number[])=>({longitude:p[0],latitude:p[1],observedAt:p[2],sourceSystem:m.sourceSystem,sourceType:'INITIALIZATION',dataQuality:'INITIALIZATION',assetId:a.id}))}));
 return tracks.get(m);
}
export function referencePosition(a:any,time:number){const track=motionTrack(a);return track?trackAt(track,time):a.position;}
export function referenceHeading(a:any,time:number){const track=motionTrack(a);return track?trackHeading(track,time):trackHeading(a);}
export function referenceChunks(a:any,time:number){const track=motionTrack(a);return track?trackChunks(track,time):trackChunks(a);}
