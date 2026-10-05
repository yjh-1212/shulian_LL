import {meters} from './amap';
type Line = any;
export function modeFamily(modes:string[]){return ['ROAD','RAIL','WATER'].filter(m=>modes.includes(m)).join('+');}
export function familyLabel(modes:string[]){const key=modeFamily(modes);return ({'ROAD+RAIL':'公铁联运','RAIL+WATER':'铁水联运','ROAD+WATER':'公水联运','ROAD+RAIL+WATER':'公铁水联运','ROAD':'公路直运','RAIL':'铁路直运','WATER':'水运直运'} as Record<string,string>)[key]||key;}
// Enumerate a bounded graph, including short road links between nearby terminal nodes.
// Keep each mode combination represented before applying cost/time/reliability recommendations.
export function findCorridorChains(lines:Line[],origin:any,destination:any,dto:any,preferred:string[]=[]){
 const direct=meters(origin,destination),roadAllowed=dto.modes.includes('ROAD');
 const accessLimit=Math.min(850000,Math.max(200000,direct*.35)),exitLimit=Math.min(650000,Math.max(200000,direct*.3));
 const canReach=(a:any,b:any,limit:number)=>meters(a,b)<=100||(roadAllowed&&meters(a,b)<=limit);
 const starts=lines.filter(l=>canReach(origin,l.origin,accessLimit)).sort((a,b)=>meters(origin,a.origin)-meters(origin,b.origin));
 const found: {lines:Line[]; family:string; cost:number; time:number; reliability:number; hinted:boolean}[]=[];let explored=0;
 const visit=(chain:Line[],visited:Set<string>,bridges:number)=>{
  if(++explored>5000)return;const first=chain[0],last=chain.at(-1)!;
  const approach=meters(origin,first.origin)>100,exit=meters(last.destination,destination)>100;
  const modes=[...new Set([...chain.map(l=>l.mode),...((approach||exit||bridges)?['ROAD']:[])])];
  const transfers=chain.length+Number(approach)+Number(exit)+bridges-1;
  const required=(!dto.requiredLineId||chain.some(l=>l.id===dto.requiredLineId))&&(!dto.requiredNodeId||[origin.nodeId,destination.nodeId,...chain.flatMap(l=>[l.originId,l.destinationId])].includes(dto.requiredNodeId));
  if(canReach(last.destination,destination,exitLimit)&&transfers<=dto.maxTransfers&&required&&(dto.allowMultimodal||modes.length===1)){
   const roadKm=(meters(origin,first.origin)+meters(last.destination,destination)+chain.slice(1).reduce((n,l,i)=>n+meters(chain[i].destination,l.origin),0))*1.3/1000;
   const corridorKm=chain.reduce((n,l)=>n+(l.distanceMeters||meters(l.origin,l.destination)*1.3)/1000,0);
   // Reject unnecessary backtracking and very long road access to a short main leg.
   if(roadKm*1000+chain.reduce((n,l)=>n+meters(l.origin,l.destination),0)<=direct*1.8&&corridorKm>=roadKm*.5){
    found.push({lines:chain,family:modeFamily(modes),cost:roadKm*.32+chain.reduce((n,l)=>{const p=JSON.parse(l.serviceInfo||'{}').planningEstimate;return n+(l.mode==='RAIL'?Math.max(35,meters(l.origin,l.destination)/1000*1.3*.08):p?.waterRatePerTon??108)+21;},0),time:roadKm/50+chain.reduce((n,l)=>n+l.durationSeconds/3600+24,0),reliability:chain.reduce((n,l)=>n+(l.mode==='RAIL'?93:87),0)/chain.length-transfers*2,hinted:chain.every(l=>preferred.includes(l.id))});
   }
  }
  if(chain.length>=Math.min(3,dto.maxTransfers+1))return;
  for(const next of lines){if(visited.has(next.destinationId)||chain.some(l=>l.id===next.id))continue;const gap=meters(last.destination,next.origin);const bridge=last.destinationId===next.originId?0:gap>100?1:0;
   if(gap>100&&(gap>50000||!roadAllowed))continue;
   const nextSegments=chain.length+1+bridges+bridge+Number(approach);if(nextSegments-1>dto.maxTransfers)continue;
   visit([...chain,next],new Set([...visited,next.destinationId]),bridges+bridge);
  }
 };
 for(const line of starts)visit([line],new Set([line.originId,line.destinationId]),0);
 const chosen:typeof found=[];
 for(const family of new Set(found.map(c=>c.family))){const pool=found.filter(c=>c.family===family);for(const compare of [(a:any,b:any)=>a.cost-b.cost,(a:any,b:any)=>a.time-b.time,(a:any,b:any)=>b.reliability-a.reliability]){const ordered=[...pool].sort(compare);for(const c of ordered.slice(0,2))if(!chosen.includes(c))chosen.push(c);}const hinted=pool.find(c=>c.hinted);if(hinted&&!chosen.includes(hinted))chosen.push(hinted);}
 return {chains:chosen.slice(0,24).map(c=>c.lines),explored,found:found.length,accessLimit,exitLimit};
}
