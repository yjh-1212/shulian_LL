import type {Business,Corridor,NetworkReference,MapNode,MapRoute,ChartSelection} from './types';
export const modeName=(mode:string)=>({ROAD:'公路',RAIL:'铁路',WATER:'水运'}[mode]||mode);
export const combination=(business:Business)=>['ROAD','RAIL','WATER'].filter(m=>business.modes.includes(m as any)).map(m=>modeName(m)[0]).join('');
export function buildCorridors(businesses:Business[],reference:NetworkReference):Corridor[]{
 const groups=new Map<string,Corridor>();
 for(const b of businesses){const combo=combination(b),id=[b.origin,b.destination,combo].join('|');let corridor=groups.get(id);
  if(!corridor){const stages=b.segments||[];const ordered=stages.length?stages.map(s=>reference.segments.find(r=>r.key===[s.mode,s.origin,s.destination].join('|'))):reference.segments.filter(s=>b.nodes.some(n=>n.name===s.origin)&&b.nodes.some(n=>n.name===s.destination)&&b.modes.includes(s.mode));
   const segments=ordered.filter((s):s is NonNullable<typeof s>=>!!s),nodeNames=stages.length?[stages[0].origin,...stages.map(s=>s.destination)]:[...new Set(segments.flatMap(s=>[s.origin,s.destination]))];
   corridor={id,label:`${b.origin} → ${b.destination}`,origin:b.origin,destination:b.destination,combination:combo,quantityKg:0,businessIds:[],grains:[],segments,nodeNames,completed:0,active:0,missingSegments:ordered.filter(s=>!s).length};groups.set(id,corridor);
  }
  corridor.quantityKg+=b.quantityKg;corridor.businessIds.push(b.id);if(!corridor.grains.includes(b.grain))corridor.grains.push(b.grain);if(b.status==='COMPLETED')corridor.completed++;if(b.status==='IN_PROGRESS')corridor.active++;
 }
 return [...groups.values()].sort((a,b)=>b.quantityKg-a.quantityKg);
}
export function matchingCorridors(corridors:Corridor[],selection:ChartSelection|null,businesses:Business[]){
 if(!selection)return new Set(corridors.map(c=>c.id));
 return new Set(corridors.filter(c=>{
  if(selection.dimension==='origin')return c.origin===selection.value;
  if(selection.dimension==='destination')return c.destination===selection.value;
  if(selection.dimension==='grain')return c.grains.includes(selection.value);
  if(selection.dimension==='mode')return c.combination===selection.value&&(!selection.grain||c.grains.includes(selection.grain));
  if(selection.dimension==='status')return businesses.some(b=>c.businessIds.includes(b.id)&&({COMPLETED:'已完成',IN_PROGRESS:'执行中',CANCELLED:'已取消'}[b.status]||'待启动')===selection.value);
  return true;
 }).map(c=>c.id));
}
export function mapData(corridors:Corridor[],reference:NetworkReference,highlight:Set<string>,selectedSegment?:string,selectedNode?:string){
 const routes=new Map<string,MapRoute>(),nodeRows=new Map<string,MapNode>();
 for(const c of corridors){const active=highlight.has(c.id);for(const s of c.segments){let r=routes.get(s.id);if(!r){r={id:s.id,mode:s.mode,points:s.coordinates.map(([lng,lat])=>({lng,lat})),label:`${s.origin} → ${s.destination}`,schematic:false,selected:s.id===selectedSegment,quantityKg:0,dimmed:true};routes.set(s.id,r);}r.quantityKg!+=c.quantityKg;if(active)r.dimmed=false;}
  for(const name of c.nodeNames){const node=reference.nodes.find(n=>n.name===name);if(!node)continue;let row=nodeRows.get(name);if(!row){row={...node,role:name===c.origin?'source':name===c.destination?'target':'transfer',quantityKg:0,dimmed:true,selected:name===selectedNode};nodeRows.set(name,row);}row.quantityKg!+=c.quantityKg;if(active)row.dimmed=false;}
 }
 return {routes:[...routes.values()],nodes:[...nodeRows.values()]};
}
