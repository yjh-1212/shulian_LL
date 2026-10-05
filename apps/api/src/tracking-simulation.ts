import {meters} from './amap';
// Only explicitly registered development scenarios may produce moving demo positions.
export function simulationPoints(task:any,points:any[],now=Date.now()){
 const scenario=points.filter(p=>p.sourceSystem==='DEMO_BEIDOU'||p.sourceSystem==='DEMO_AIS').sort((a,b)=>a.observedAt.getTime()-b.observedAt.getTime());
 if(process.env.NODE_ENV==='production'||!task.business?.package?.isTestData||scenario.length<2||!scenario.every(p=>p.isTestData))return points;
 if(points.some(p=>p.sourceType!=='SIMULATED'&&p.dataQuality!=='SIMULATED'&&!/^DEMO_/.test(p.sourceSystem)))return points;
 if(['COMPLETED','CANCELLED','RECEIVED','UNLOADED','ARRIVED'].includes(task.status))return points;
 const start=task.plannedStartAt?.getTime()||scenario[0].observedAt.getTime(),end=task.plannedEndAt?.getTime()||start+86400000;
 if(now<start)return [];
 let path=scenario.map(p=>[p.longitude,p.latitude]);
 // A registered road simulation follows the saved driving geometry, including bends.
 try{const segments=JSON.parse(task.business.package.snapshot).plan?.segments||[],segment=segments.find((s:any)=>s.sequence===task.segment&&s.mode==='ROAD'),geometry=segment?.geometry,coords=typeof geometry?.coordinates==='string'?JSON.parse(geometry.coordinates):geometry?.coordinates;if(task.mode==='ROAD'&&/^AMAP_/.test(geometry?.source)&&Array.isArray(coords)&&coords.length>=3&&coords.every((p:any)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))&&meters({lng:coords[0][0],lat:coords[0][1]},{lng:path[0][0],lat:path[0][1]})<1000&&meters({lng:coords.at(-1)[0],lat:coords.at(-1)[1]},{lng:path.at(-1)![0],lat:path.at(-1)![1]})<1000)path=coords;}catch{}
 const until=Math.min(now,end),duration=Math.max(1,end-start),distances=[0];
 for(let i=1;i<path.length;i++)distances.push(distances[i-1]+meters({lng:path[i-1][0],lat:path[i-1][1]},{lng:path[i][0],lat:path[i][1]}));
 const at=(time:number)=>{const ratio=Math.max(0,Math.min(1,(time-start)/duration)),travel=distances.at(-1)!*ratio,index=Math.max(0,distances.findIndex(d=>d>=travel)-1),a=path[index],b=path[Math.min(index+1,path.length-1)],fraction=(travel-distances[index])/Math.max(1,distances[index+1]-distances[index]);return {...scenario[0],id:'simulation:'+task.id+':'+time,longitude:a[0]+(b[0]-a[0])*fraction,latitude:a[1]+(b[1]-a[1])*fraction,observedAt:new Date(time),dataQuality:'SIMULATED',sourceType:'SIMULATED',gapBefore:false};};
 // Regular samples keep a simulated voyage continuous without disguising real telemetry gaps.
 const interval=Math.max(task.mode==='ROAD'?60000:15*60000,Math.ceil((until-start)/998)),windowStart=start,result=[];
 for(let time=windowStart;time<until;time+=interval)result.push(at(time));
 result.push(at(until));return result;
}

