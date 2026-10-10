import type {Corridor,NetworkSegment,PlaybackFrame,Point} from './types';
export const metres=(a:number[],b:number[])=>{const r=Math.PI/180,p=(b[1]-a[1])*r,q=(b[0]-a[0])*r;return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(p/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(q/2)**2)));};
export function preparePath(coordinates:number[][]){
 const cumulative=[0];for(let i=1;i<coordinates.length;i++)cumulative.push(cumulative[i-1]+metres(coordinates[i-1],coordinates[i]));
 return {coordinates,cumulative,length:cumulative.at(-1)||0};
}
export function pointAlong(path:ReturnType<typeof preparePath>,progress:number):{point:Point;heading:number}{
 const c=path.coordinates;if(!c.length)return {point:{lng:NaN,lat:NaN},heading:0};if(c.length===1)return {point:{lng:c[0][0],lat:c[0][1]},heading:0};
 const target=Math.max(0,Math.min(1,progress))*path.length;let low=1,high=c.length-1;
 while(low<high){const middle=(low+high)>>1;if(path.cumulative[middle]<target)low=middle+1;else high=middle;}
 const a=c[low-1],b=c[low],t=(target-path.cumulative[low-1])/(path.cumulative[low]-path.cumulative[low-1]||1);
 return {point:{lng:a[0]+(b[0]-a[0])*t,lat:a[1]+(b[1]-a[1])*t},heading:Math.atan2((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1])};
}
export function buildPlayback(corridor:Corridor){
 const phases:{start:number;end:number;segment:NetworkSegment;phase:PlaybackFrame['phase'];label:string;path:ReturnType<typeof preparePath>}[]=[];let cursor=0;
 for(const [i,segment] of corridor.segments.entries()){
  const path=preparePath(segment.coordinates),add=(seconds:number,phase:PlaybackFrame['phase'],label:string)=>{phases.push({start:cursor,end:cursor+seconds,segment,phase,label,path});cursor+=seconds;};
  if((segment.connectionMeters?.origin||0)>50)add(4,'gap',`${segment.origin} · ${segment.mode==='WATER'?'港区':'站场'}衔接`);
  add(Math.max(14,Math.min(52,14+path.length/70000)),'moving',`${{ROAD:'公路运输',RAIL:'铁路运输',WATER:'水运运输'}[segment.mode]} · ${segment.origin} → ${segment.destination}`);
  if((segment.connectionMeters?.destination||0)>50)add(4,'gap',`${segment.destination} · ${segment.mode==='WATER'?'港区':'站场'}衔接`);
  if(i<corridor.segments.length-1)add(5,'handoff',`${segment.destination} · 换装衔接`);
 }
 return {duration:cursor,at(seconds:number):PlaybackFrame|null{
  if(!phases.length)return null;const t=Math.max(0,Math.min(cursor,seconds)),p=phases.find(v=>t<v.end)||phases.at(-1)!,progress=Math.max(0,Math.min(1,(t-p.start)/(p.end-p.start))),sample=pointAlong(p.path,progress);
  const phase=t===cursor?'complete':p.phase;return {point:phase==='moving'||phase==='complete'?sample.point:null,heading:sample.heading,mode:p.segment.mode,segmentId:p.segment.id,phase,label:phase==='complete'?'路线回放完成':p.label,percent:cursor?t/cursor*100:0};
 }};
}
