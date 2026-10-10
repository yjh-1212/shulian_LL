import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import geoRaw from '../map_data/china-provinces.geojson?raw';
import terrainUrl from '../map_data/china-terrain.webp?url';
import type {CockpitStyle} from './theme';
import type {MapRoute,MapNode,Asset,Point,MapSelection,MapHover,PlaybackFrame} from './types';
import {preparePath,pointAlong} from './route-math';

const mercator=(lat:number)=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI;
export const mapVerticalOffset=0.085;
export function project(point:Point):[number,number]{return [(point.lng-104)*0.24,-(mercator(point.lat)-mercator(35))*0.24];}
const sourceFeatures=JSON.parse(geoRaw).features;
// Keep the southern offshore islands and boundary in a fixed inset instead of extending the main map.
const offshorePolygon=(polygon:number[][][])=>polygon[0].every(point=>point[1]<18);
export const southSeaPolygons:number[][][][]=sourceFeatures.find((f:any)=>f.properties.adcode===460000).geometry.coordinates.filter(offshorePolygon);
export const mapFeatures=sourceFeatures.filter((f:any)=>f.properties.adcode!=='100000_JD').map((f:any)=>f.properties.adcode===460000?{...f,geometry:{...f.geometry,coordinates:f.geometry.coordinates.filter((p:number[][][])=>!offshorePolygon(p))}}:f);
const inRing=(ring:number[][],p:Point)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p.lat)!==(b[1]>p.lat)&&p.lng<(b[0]-a[0])*(p.lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
export function provinceAt(p:Point):string|undefined {return mapFeatures.find((feature:any)=>(feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates).some((polygon:number[][][])=>inRing(polygon[0],p)&&!polygon.slice(1).some(ring=>inRing(ring,p))))?.properties.name;}
export interface MapLabel {id:string;name:string;x:number;y:number;visible:boolean;mode?:string;businessId?:string;selected?:boolean}
const valid=(p:Point)=>Number.isFinite(p.lng)&&Number.isFinite(p.lat);
function release(group:THREE.Object3D){group.traverse(obj=>{const mesh=obj as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();if(mesh.material)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.dispose();});}

export class CockpitMapEngine {
 private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(37,1,0.1,100);
 private renderer:THREE.WebGLRenderer;private controls:OrbitControls;private land=new THREE.Group();private data=new THREE.Group();private ground=new THREE.Group();
 private ambient=new THREE.AmbientLight('#b7d8e8',2);private light=new THREE.DirectionalLight('#d9e9ef',3);
 private observer:ResizeObserver;private raf=0;private disposed=false;private active=true;private labels:MapNode[]=[];private style:CockpitStyle;
 private curves:{path:ReturnType<typeof preparePath>;dot:THREE.Mesh;index:number;active:boolean}[]=[];
 private assetMeshes:{asset:Asset;mesh:THREE.Mesh}[]=[];private texture:THREE.Texture|null=null;private lastFrame=0;private width=1;private height=1;
 private edges:THREE.Line[]=[];private mapMaterials:THREE.MeshStandardMaterial[]=[];private nodes:THREE.Mesh[]=[];private replayAt:number|null=null;
 private raycaster=new THREE.Raycaster();private down=[0,0];private pointerIsDown=false;private hoverTime=0;
 private playback:PlaybackFrame|null=null;private vehicle=new THREE.Group();private vehicleMode='';private handoffRing:THREE.Mesh|undefined;
 private cameraTween:{from:THREE.Vector3;to:THREE.Vector3;targetFrom:THREE.Vector3;targetTo:THREE.Vector3;start:number}|null=null;
 private regionValues=new Map<string,number>();private selectedRegion='';
 constructor(private host:HTMLElement,style:CockpitStyle,private onLabels:(labels:MapLabel[])=>void,private onSelect:(selection:MapSelection|null)=>void,private onHover:(hover:MapHover|null)=>void=()=>{},private onInteract:()=>void=()=>{}){
  this.style=style;
  this.renderer=new THREE.WebGLRenderer({antialias:style.performance!=='smooth',alpha:true,powerPreference:'low-power'});
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0,0);this.renderer.domElement.setAttribute('aria-label','中国粮食联运三维地图');
  this.host.appendChild(this.renderer.domElement);this.controls=new OrbitControls(this.camera,this.renderer.domElement);
  this.controls.enableDamping=true;this.controls.dampingFactor=0.1;this.controls.minDistance=1.8;this.controls.maxDistance=46;this.controls.maxPolarAngle=Math.PI/2.5;this.controls.minPolarAngle=0.08;
  this.controls.enablePan=true;this.controls.target.set(0,0,0.2);this.reset();
  this.light.position.set(-5,14,8);this.scene.add(this.land,this.data,this.ground,this.ambient,this.light);
  this.createLand();this.createGround();this.apply(style);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
  this.renderer.domElement.addEventListener('pointerdown',this.pointerDown);this.renderer.domElement.addEventListener('pointerup',this.pointerUp);
  this.renderer.domElement.addEventListener('pointermove',this.pointerMove);this.renderer.domElement.addEventListener('pointerleave',this.pointerLeave);this.renderer.domElement.addEventListener('wheel',this.interact,{passive:true});
  document.addEventListener('visibilitychange',this.visibility);
  this.raf=requestAnimationFrame(this.frame);
  new THREE.TextureLoader().load(terrainUrl,texture=>{if(this.disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());this.texture=texture;this.apply(this.style);},undefined,()=>{});
 }
 private createLand(){
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const feature of sourceFeatures)for(const polygon of feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates)for(const ring of polygon)for(const c of ring){const [x,z]=project({lng:c[0],lat:c[1]});minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,-z);maxY=Math.max(maxY,-z);}
  for(const feature of mapFeatures){
   const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
   const top=new THREE.MeshStandardMaterial({color:this.style.mapColor,roughness:0.86,metalness:0.08});
   top.userData.province=feature.properties.name;
   const side=new THREE.MeshStandardMaterial({color:this.style.mapSide,roughness:0.8,metalness:0.08});this.mapMaterials.push(top,side);
   for(const polygon of polygons){
    const rings:THREE.Vector2[][]=polygon.map((ring:number[][])=>ring.map(c=>{const [x,z]=project({lng:c[0],lat:c[1]});return new THREE.Vector2(x,-z);}));
    if(!rings[0]||rings[0].length<3)continue;
    const shape=new THREE.Shape(rings[0]);for(const hole of rings.slice(1))shape.holes.push(new THREE.Path(hole));
    const depth=1;
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:1,steps:1});
    const position=geometry.attributes.position,uv=[];
    for(let i=0;i<position.count;i++)uv.push((position.getX(i)-minX)/(maxX-minX),(position.getY(i)-minY)/(maxY-minY));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const mesh=new THREE.Mesh(geometry,[top,side]);mesh.rotation.x=-Math.PI/2;mesh.userData.selection={kind:'region',id:feature.properties.name};this.land.add(mesh);
    const coords=rings[0].map(v=>new THREE.Vector3(v.x,depth,-v.y));
    const border=new THREE.Line(new THREE.BufferGeometry().setFromPoints(coords),new THREE.LineBasicMaterial({color:this.style.mapEdge,transparent:true,opacity:0.32}));this.edges.push(border);this.land.add(border);
   }
  }
 }
 private createGround(){
  const grid=new THREE.GridHelper(28,28,this.style.gridColor,this.style.gridColor);grid.position.y=-0.04;grid.name='grid';this.ground.add(grid);
  const ring=new THREE.Mesh(new THREE.RingGeometry(8.5,8.52,128),new THREE.MeshBasicMaterial({color:this.style.mapEdge,transparent:true,opacity:0.1,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-0.05;ring.name='ring';this.ground.add(ring);
  const sweep=new THREE.Mesh(new THREE.CircleGeometry(8.4,48,0,Math.PI/14),new THREE.MeshBasicMaterial({color:this.style.primary,transparent:true,opacity:0.035,side:THREE.DoubleSide}));sweep.rotation.x=-Math.PI/2;sweep.position.y=-0.025;sweep.name='sweep';this.ground.add(sweep);
 }
 apply(style:CockpitStyle){
  const tiltChanged=this.style.mapTilt!==style.mapTilt;this.style={...style};
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,style.performance==='smooth'?1:style.performance==='fine'?2:1.4));
  this.land.scale.y=Math.max(0.001,style.mapHeight);
  for(let i=0;i<this.mapMaterials.length;i++){const material=this.mapMaterials[i];material.color.set(i%2?style.mapSide:style.mapColor);material.map=i%2===0&&style.mapTexture?this.texture:null;material.needsUpdate=true;}
  for(const edge of this.edges)(edge.material as THREE.LineBasicMaterial).color.set(style.mapEdge);
  this.ambient.intensity=style.ambient;this.light.intensity=style.light;
  const grid=this.ground.getObjectByName('grid')!;grid.visible=style.grid;
  const gridMaterials=(grid as THREE.GridHelper).material;
  for(const material of Array.isArray(gridMaterials)?gridMaterials:[gridMaterials]){material.color.set(style.gridColor);material.transparent=true;material.opacity=0.2;}
  this.ground.getObjectByName('sweep')!.visible=style.sweep;
  this.data.position.y=style.mapHeight+0.03;
  if(tiltChanged)this.reset();
  this.resize();
 }
 setRegions(values:Map<string,number>,selected=''){this.regionValues=values;this.selectedRegion=selected;this.paintRegions();}
 private paintRegions(){const maximum=Math.max(1,...this.regionValues.values());for(let i=0;i<this.mapMaterials.length;i+=2){const material=this.mapMaterials[i],name=material.userData.province,value=this.regionValues.get(name)||0;material.color.set(this.style.mapColor);if(value)material.color.lerp(new THREE.Color(this.style.chartPalette==='grain'?this.style.accent:this.style.primary),.18+.6*Math.sqrt(value/maximum));if(name===this.selectedRegion)material.color.set(this.style.accent);}}
 private ribbon(points:THREE.Vector3[],width:number,color:string,opacity:number,selection?:MapSelection){
  const vertices:number[]=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(!length)continue;const nx=-dz/length*width,nz=dx/length*width;vertices.push(a.x+nx,a.y,a.z+nz,a.x-nx,a.y,a.z-nz,b.x+nx,b.y,b.z+nz,b.x+nx,b.y,b.z+nz,a.x-nx,a.y,a.z-nz,b.x-nx,b.y,b.z-nz);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));mesh.userData.selection=selection;this.data.add(mesh);return mesh;
 }
 setData(routes:MapRoute[],nodes:MapNode[],assets:Asset[]){
  this.paintRegions();
  release(this.data);this.scene.remove(this.data);this.data=new THREE.Group();this.data.position.y=this.style.mapHeight+0.03;this.scene.add(this.data);
  this.curves=[];this.assetMeshes=[];this.nodes=[];this.labels=nodes.slice().sort((a,b)=>Number(b.selected)-Number(a.selected)||Number(a.dimmed)-Number(b.dimmed)).slice(0,14);this.vehicle=new THREE.Group();this.vehicleMode='';this.data.add(this.vehicle);
  routes.slice(0,24).forEach((route,index)=>{
   // Draw every retained polyline vertex. Resampling a tube can cut across sharp road bends.
   if(route.schematic)return;const coordinates=route.points.filter(valid).map(p=>[p.lng,p.lat]);const positions=coordinates.map(([lng,lat])=>{const [x,z]=project({lng,lat});return new THREE.Vector3(x,.055,z);});if(positions.length<2)return;
   const color=route.selected?this.style.accent:this.color(route.mode),opacity=route.dimmed?.12:route.selected?1:.7,width=this.style.routeWidth*.008*(1+Math.min(1.2,Math.sqrt((route.quantityKg||0)/5000000)))*(route.selected?1.35:1),selection:MapSelection={kind:'route',id:route.id};
   this.ribbon(positions,width*2.7,color,opacity*.1);
   this.ribbon(positions,width,color,route.mode==='WATER'?opacity*.45:opacity,selection);
   if(route.mode==='WATER'){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(positions),new THREE.LineDashedMaterial({color,transparent:true,opacity,dashSize:.12,gapSize:.04}));line.computeLineDistances();this.data.add(line);}
   // A transparent wider strip makes narrow routes usable with the mouse.
   const hit=this.ribbon(positions,.065,color,0,selection);hit.renderOrder=2;
   const path=preparePath(coordinates);
   if(route.mode==='RAIL'){
    const marks:number[]=[];const count=Math.min(180,Math.ceil(path.length/12000));for(let j=0;j<count;j++){const {point,heading}=pointAlong(path,j/Math.max(1,count-1)),[x,z]=project(point),dx=Math.cos(heading)*.045,dz=Math.sin(heading)*.045;marks.push(x-dx,.06,z-dz,x+dx,.06,z+dz);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(marks,3));this.data.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:opacity*.7})));
   }
   if(!route.dimmed&&(route.selected||index<5)){const dot=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:'#e5f7fa',transparent:true,opacity:.85}));this.data.add(dot);this.curves.push({path,dot,index,active:true});}
  });
  for(const node of nodes){if(!valid(node))continue;const [x,z]=project(node);
   const nodeColor=node.role==='target'?this.style.waterColor:node.selected?this.style.accent:this.style.primary;
   const marker=new THREE.Mesh(node.kind==='port'?new THREE.CylinderGeometry(.07,.07,.11,6):new THREE.BoxGeometry(.11,.11,.11),new THREE.MeshBasicMaterial({color:nodeColor,transparent:true,opacity:node.dimmed?.2:1}));marker.position.set(x,.11,z);marker.userData.selection={kind:'node',id:node.id};this.data.add(marker);
   const ring=new THREE.Mesh(new THREE.RingGeometry(.11,.14,24),new THREE.MeshBasicMaterial({color:nodeColor,transparent:true,opacity:node.dimmed?.1:node.selected?.8:.4,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(x,.015,z);ring.userData.selected=node.selected;this.data.add(ring);this.nodes.push(ring);
   const hit=new THREE.Mesh(new THREE.SphereGeometry(.15,8,6),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.set(x,.1,z);hit.userData.selection={kind:'node',id:node.id};this.data.add(hit);
  }
  for(const asset of assets){if(!asset.position||!valid(asset.position))continue;
   const geometry=asset.mode==='WATER'?new THREE.ConeGeometry(0.085,0.26,4):new THREE.BoxGeometry(asset.mode==='RAIL'?0.075:0.09,0.09,asset.mode==='RAIL'?0.3:0.16);
   const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:this.color(asset.mode)}));mesh.visible=this.style.assets;this.data.add(mesh);this.assetMeshes.push({asset,mesh});
  }
  this.setPlayback(this.replayAt);
  this.handoffRing=new THREE.Mesh(new THREE.RingGeometry(.18,.21,32),new THREE.MeshBasicMaterial({color:this.style.accent,transparent:true,opacity:.65,side:THREE.DoubleSide}));this.handoffRing.rotation.x=-Math.PI/2;this.handoffRing.visible=false;this.data.add(this.handoffRing);this.setReplayFrame(this.playback);
 }
 setReplayFrame(frame:PlaybackFrame|null){
  this.playback=frame;this.vehicle.visible=this.style.assets&&!!frame?.point;this.vehicle.userData.selection=frame?{kind:'route',id:frame.segmentId}:undefined;
  if(!frame?.point)return;
  if(this.vehicleMode!==frame.mode){release(this.vehicle);this.vehicle.clear();this.vehicleMode=frame.mode;const color=this.color(frame.mode),material=new THREE.MeshBasicMaterial({color});
   const body=new THREE.Mesh(new THREE.BoxGeometry(frame.mode==='WATER'?.11:.1,.09,frame.mode==='RAIL'?.3:.2),material);body.position.y=.09;this.vehicle.add(body);
   const cab=new THREE.Mesh(new THREE.BoxGeometry(.085,.1,.07),new THREE.MeshBasicMaterial({color:'#eafaff'}));cab.position.set(0,.12,-.1);this.vehicle.add(cab);
   if(frame.mode==='RAIL')for(const z of [.24,.42]){const wagon=new THREE.Mesh(new THREE.BoxGeometry(.1,.08,.15),material.clone());wagon.position.set(0,.08,z);this.vehicle.add(wagon);}
   if(frame.mode==='WATER'){const bow=new THREE.Mesh(new THREE.ConeGeometry(.08,.15,3),material.clone());bow.rotation.x=-Math.PI/2;bow.position.set(0,.06,-.15);this.vehicle.add(bow);}
  }
  const [x,z]=project(frame.point);this.vehicle.position.set(x,.04,z);this.vehicle.rotation.y=-frame.heading;
 }
 setPlayback(at:number|null){this.replayAt=at;for(const {asset,mesh} of this.assetMeshes){const point=at==null?asset.position:asset.trajectory.filter(p=>p.at&&new Date(p.at).getTime()<=at).at(-1);mesh.visible=this.style.assets&&!!point;if(point){const [x,z]=project(point);mesh.position.set(x,0.15,z);}}}
 private color(mode:string){return mode==='ROAD'?this.style.roadColor:mode==='RAIL'?this.style.railColor:this.style.waterColor;}
 private moveCamera(to:THREE.Vector3,targetTo:THREE.Vector3){if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){this.camera.position.copy(to);this.controls.target.copy(targetTo);this.controls.update();return;}this.cameraTween={from:this.camera.position.clone(),to,targetFrom:this.controls.target.clone(),targetTo,start:performance.now()};}
 reset(){const to=new THREE.Vector3(0,this.style.mapTilt?16:24,this.style.mapTilt?16:.4),target=new THREE.Vector3(0,0,.2);if(this.width>1)this.moveCamera(to,target);else{this.controls?.target.copy(target);this.camera.position.copy(to);this.camera.lookAt(target);this.controls?.update();}}
 focus(nodes:Point[]){const points=nodes.filter(valid);if(!points.length)return;const p=points.map(project),xs=p.map(v=>v[0]),zs=p.map(v=>v[1]),x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2,halfWidth=(Math.max(...xs)-Math.min(...xs))/2,halfHeight=(Math.max(...zs)-Math.min(...zs))/2,safeWidth=Math.max(.3,1-this.style.panelWidth/50),distance=Math.max(3,Math.min(42,Math.max(halfHeight*1.4,halfWidth/(this.width/this.height*safeWidth))*3.8));this.moveCamera(new THREE.Vector3(x,distance*.85,z+distance*.65),new THREE.Vector3(x,this.style.mapHeight,z));}
 private resize(){if(this.disposed)return;const {width,height}=this.host.getBoundingClientRect();this.width=Math.max(1,width);this.height=Math.max(1,height);this.camera.setViewOffset(this.width,this.height,0,-this.height*mapVerticalOffset,this.width,this.height);this.renderer.setSize(this.width,this.height,false);}
 private frame=(timestamp:number)=>{
  if(this.disposed)return;this.raf=requestAnimationFrame(this.frame);
  if(!this.active||document.hidden)return;
  const interval=this.style.performance==='smooth'?50:1000/30;if(timestamp-this.lastFrame<interval)return;this.lastFrame=timestamp;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animated=!reduce&&this.style.performance!=='smooth',seconds=timestamp/1000*this.style.motionSpeed;
  if(this.cameraTween){const tween=this.cameraTween,t=Math.min(1,(timestamp-tween.start)/850),e=1-(1-t)**3;this.camera.position.lerpVectors(tween.from,tween.to,e);this.controls.target.lerpVectors(tween.targetFrom,tween.targetTo,e);if(t===1)this.cameraTween=null;}
  this.controls.update();
  for(const {path,dot,index} of this.curves){dot.visible=animated&&this.style.flow&&!this.playback;const {point}=pointAlong(path,(seconds*.045+index*.23)%1),[x,z]=project(point);dot.position.set(x,.08,z);}
  for(const node of this.nodes){const scale=animated&&this.style.pulse&&node.userData.selected?1+Math.sin(seconds*1.6)*.18:1;node.scale.set(scale,scale,scale);}
  this.vehicle.scale.setScalar(Math.max(.6,Math.min(1.6,this.camera.position.distanceTo(this.controls.target)/16)));
  if(this.handoffRing){this.handoffRing.visible=this.playback?.phase==='handoff';if(this.handoffRing.visible){const n=this.labels.find(n=>this.playback?.label.startsWith(n.name));if(n){const [x,z]=project(n);this.handoffRing.position.set(x,.04,z);}this.handoffRing.scale.setScalar(animated?1+(Math.sin(seconds*2)+1)*.35:1);}}
  if(animated&&this.style.edgeFlow)for(const [i,edge] of this.edges.entries())(edge.material as THREE.LineBasicMaterial).opacity=0.24+0.13*Math.sin(seconds+i/5);
  else for(const edge of this.edges)(edge.material as THREE.LineBasicMaterial).opacity=0.32;
  this.ground.getObjectByName('sweep')!.rotation.z=-seconds*0.12;
  this.renderer.render(this.scene,this.camera);
  this.onLabels(this.labels.filter(n=>valid(n)&&!n.dimmed).map(n=>{const [x,z]=project(n);const projected=new THREE.Vector3(x,this.style.mapHeight+.32,z).project(this.camera);return {id:n.id,name:n.name,x:(projected.x+1)*this.width/2,y:(1-projected.y)*this.height/2,visible:projected.z<1&&Math.abs(projected.x)<.95&&Math.abs(projected.y)<.94,businessId:n.businessId,selected:n.selected};}));
 };
 private visibility=()=>{this.lastFrame=0;};
 private hit(event:PointerEvent):MapSelection|null{const rect=this.renderer.domElement.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);const data=this.raycaster.intersectObjects(this.data.children,true).find(v=>v.object.userData.selection);return data?.object.userData.selection||this.raycaster.intersectObjects(this.land.children).find(v=>v.object.userData.selection)?.object.userData.selection||null;}
 private interact=()=>{this.cameraTween=null;this.onHover(null);this.onInteract();};
 private pointerDown=(event:PointerEvent)=>{this.down=[event.clientX,event.clientY];this.pointerIsDown=true;this.interact();};
 private pointerUp=(event:PointerEvent)=>{this.pointerIsDown=false;if(Math.hypot(event.clientX-this.down[0],event.clientY-this.down[1])>5)return;this.onSelect(this.hit(event));};
 private pointerMove=(event:PointerEvent)=>{if(this.pointerIsDown||performance.now()-this.hoverTime<70)return;this.hoverTime=performance.now();const selection=this.hit(event);this.renderer.domElement.style.cursor=selection?'pointer':'grab';this.onHover(selection?{selection,x:event.clientX,y:event.clientY}:null);};
 private pointerLeave=()=>{this.pointerIsDown=false;this.onHover(null);};
 destroy(){this.disposed=true;cancelAnimationFrame(this.raf);this.observer.disconnect();this.controls.dispose();document.removeEventListener('visibilitychange',this.visibility);this.renderer.domElement.removeEventListener('pointerdown',this.pointerDown);this.renderer.domElement.removeEventListener('pointerup',this.pointerUp);this.renderer.domElement.removeEventListener('pointermove',this.pointerMove);this.renderer.domElement.removeEventListener('pointerleave',this.pointerLeave);this.renderer.domElement.removeEventListener('wheel',this.interact);release(this.scene);this.texture?.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
