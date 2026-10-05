import {meters} from './amap';

export const completedTransport=(task:any)=>['COMPLETED','ARRIVED','UNLOADED','RECEIVED'].includes(task.status)||task.stage?.status==='COMPLETED'||task.business?.status==='COMPLETED';
// Missing geometry remains a gap. Runtime tracking does not create observations.
export function previewPath(segment:any,observations:any[]=[]):number[][]{
 const saved=segment?.geometry?.coordinates;return Array.isArray(saved)&&saved.length>=3?saved:[];
}
export function previewTracking(task:any,points:any[],segment:any,observations:any[],enabled:boolean,now=Date.now()):{points:any[];forecast:any;alerts:any[];preview:boolean}{
 return {points,forecast:null,alerts:[] as any[],preview:false};
}

export function trackingNodes(progress:any[],segments:any[],nodes:any[]){
 const resolve=(name:string)=>segments.flatMap(s=>[s.origin,s.destination]).find(p=>p.name===name&&Number.isFinite(p.lng))||nodes.find(n=>n.name===name);
 const groups=new Map<string,any>();
 for(const p of progress){const location=p.mode==='WATER'?p.origin:p.destination,position=resolve(location),port=nodes.some(n=>n.type==='PORT'&&n.name===location)||segments.some(s=>s.mode==='WATER'&&[s.origin?.name,s.destination?.name].includes(location));
  if(!port){groups.set(p.id,{...p,position,isPort:false,showQuantity:false});continue;}
  const key='port:'+location;let g=groups.get(key);if(!g){g={id:'node:'+key,title:location,destination:location,origin:p.origin,position,isPort:true,showQuantity:true,mode:'PORT',targetKg:p.targetKg,collectedKg:0,reportedKg:0,awaitingEvidenceKg:0,shippedKg:0,arrivedKg:0,unverifiedTasks:0,boxes:[],tickets:[],warnings:[],taskIds:[],ledgers:[]};groups.set(key,g);}
  g.targetKg=Math.max(g.targetKg,p.targetKg);g.ledgers.push(p);g.taskIds.push(...p.taskIds);g.warnings.push(...p.warnings);g.unverifiedTasks+=p.unverifiedTasks;
  if(p.mode==='ROAD'){g.collectedKg+=p.arrivedKg;g.reportedKg+=p.reportedKg||0;g.awaitingEvidenceKg+=p.awaitingEvidenceKg||0;g.boxes.push(...p.boxes);g.tickets.push(...p.tickets);}
  if(p.mode==='WATER')g.shippedKg+=p.shippedKg;
 }
 return [...groups.values()].map(g=>g.isPort?{...g,collectedKg:Math.min(g.targetKg,g.collectedKg),shippedKg:Math.min(g.targetKg,g.shippedKg),arrivedKg:Math.min(g.targetKg,g.collectedKg),percent:Math.min(100,Math.round(g.collectedKg/Math.max(1,g.targetKg)*100)),allArrived:g.collectedKg>=g.targetKg,allShipped:g.shippedKg>=g.targetKg}:g);
}
