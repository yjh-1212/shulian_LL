import * as THREE from 'three';
import {createMapBoundary} from './map-boundary';
import type {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import boundaries from '../map_data/grain-source-boundaries.json';
import satelliteUrl from '../map_data/grain-source-amap-satellite.webp?url';
import satelliteMetadata from '../map_data/grain-source-amap-satellite.json';
import type {CockpitStyle} from './theme';
import {GrainSourceHeatLayer} from './grain-source-heat';
import type {GrainSourcePoint} from './grain-source-points';

/** Markers are reporting-area centres, rather than individual storage facilities. */
export interface GrainMapRegion {id:string;name:string;lng:number;lat:number;production:number|null;area:number|null}
export interface GrainMapAnchor {id:string;x:number;y:number;visible:boolean}
type Polygon=number[][][];
interface GrainFeature {properties:{id:string;name:string};geometry:{type:string;coordinates:Polygon|Polygon[]}}
export const grainFeatures=boundaries.features as unknown as GrainFeature[];
const mercator=(latitude:number)=>Math.log(Math.tan(Math.PI/4+latitude*Math.PI/360))*180/Math.PI;
export const grainProject=(lng:number,lat:number):[number,number]=>[(lng-125.3)*.6,-(mercator(lat)-mercator(46.4))*.6];
const polygons=(feature:GrainFeature):Polygon[]=>feature.geometry.type==='Polygon'?[feature.geometry.coordinates as Polygon]:feature.geometry.coordinates as Polygon[];
export const grainBounds=(()=>{const points=grainFeatures.flatMap(f=>polygons(f).flatMap(p=>p[0].map(c=>grainProject(c[0],c[1]))));return {minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))};})();
const midX=(grainBounds.minX+grainBounds.maxX)/2,midZ=(grainBounds.minZ+grainBounds.maxZ)/2;
const textureBounds=satelliteMetadata.bounds;
const release=(root:THREE.Object3D)=>{const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();root.traverse(object=>{const item=object as THREE.Mesh;if(item.geometry)geometries.add(item.geometry);if(item.material)for(const material of (Array.isArray(item.material)?item.material:[item.material]))materials.add(material);});for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();};

/** A separate regional engine keeps the national cockpit camera and materials unchanged. */
export class GrainSourceMapEngine {
 private renderer:THREE.WebGLRenderer;private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(36,1,.1,120);private controls:OrbitControls;
 private land=new THREE.Group();private markers=new THREE.Group();private base=new THREE.Group();private light=new THREE.DirectionalLight('#fff6df',2.6);private ambient=new THREE.AmbientLight('#ffffff',2);
 private observer:ResizeObserver;private animation=0;private frameAt=0;private clockAt=0;private seconds=0;private disposed=false;private width=1;private height=1;private paused=false;private reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 private heatLayer:GrainSourceHeatLayer;private sourcePoints:GrainSourcePoint[]=[];
 private texture:THREE.Texture|null=null;private glow:THREE.CanvasTexture;private style:CockpitStyle;private regions:GrainMapRegion[]=[];private selected='';private hovered='';private heat=true;
 private surfaces:{id:string;material:THREE.MeshBasicMaterial}[]=[];private sides:THREE.MeshStandardMaterial[]=[];private edges:LineMaterial[]=[];
 private pulses:{mesh:THREE.Mesh;index:number;size:number}[]=[];private beams:THREE.Mesh[]=[];private hoverAt=0;private down:[number,number]|null=null;private raycaster=new THREE.Raycaster();
 constructor(private host:HTMLElement,style:CockpitStyle,private onAnchors:(anchors:GrainMapAnchor[])=>void,private onSelect:(id:string)=>void,private onHover:(id:string)=>void,private onTextureState:(state:'ready'|'error')=>void=()=>{}){
  this.style={...style};this.glow=this.makeGlow();
  this.heatLayer=new GrainSourceHeatLayer(grainBounds,grainProject,grainFeatures.flatMap(feature=>polygons(feature).map(polygon=>polygon.map(ring=>ring.map(c=>grainProject(c[0],c[1]))))));this.scene.add(this.heatLayer.group);
  this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:style.performance!=='smooth',powerPreference:'low-power'});this.renderer.setClearColor(0,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.domElement.setAttribute('aria-label','东三省与蒙东四盟市粮食产量三维地图');this.host.appendChild(this.renderer.domElement);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.12;this.controls.minDistance=7;this.controls.maxDistance=50;this.controls.minPolarAngle=.08;this.controls.maxPolarAngle=Math.PI/2.7;this.controls.target.set(midX,0,midZ);this.controls.enablePan=true;
  this.light.position.set(-8,16,5);this.scene.add(this.land,this.markers,this.base,this.light,this.ambient);this.createLand();this.createBase();this.apply(style);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();this.reset();
  const canvas=this.renderer.domElement;canvas.addEventListener('pointerdown',this.pointerDown);canvas.addEventListener('pointerup',this.pointerUp);canvas.addEventListener('pointermove',this.pointerMove);canvas.addEventListener('pointerleave',this.pointerLeave);document.addEventListener('visibilitychange',this.visibility);this.reduce.addEventListener('change',this.motionChange);
  this.animation=requestAnimationFrame(this.frame);
  new THREE.TextureLoader().load(satelliteUrl,texture=>{if(this.disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());this.texture=texture;this.apply(this.style);this.onTextureState('ready');},undefined,()=>{if(!this.disposed)this.onTextureState('error');});
 }
 private makeGlow(){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const context=canvas.getContext('2d')!;const gradient=context.createRadialGradient(64,64,2,64,64,64);gradient.addColorStop(0,'rgba(255,137,20,.68)');gradient.addColorStop(.3,'rgba(255,175,32,.34)');gradient.addColorStop(.68,'rgba(250,190,63,.13)');gradient.addColorStop(1,'rgba(255,205,111,0)');context.fillStyle=gradient;context.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);}
 private createLand(){
  for(const feature of grainFeatures){
   // Unlit surface preserves the satellite's natural colours; lights still shade the extruded sides.
   const top=new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false});top.userData.region=feature.properties.id;
   const side=new THREE.MeshStandardMaterial({color:'#fffaf0',roughness:.82,metalness:0});this.surfaces.push({id:feature.properties.id,material:top});this.sides.push(side);
   for(const polygon of polygons(feature)){
    const rings=polygon.map(ring=>ring.map(c=>{const [x,z]=grainProject(c[0],c[1]);return new THREE.Vector2(x,-z);}));if(!rings[0]||rings[0].length<3)continue;
    const shape=new THREE.Shape(rings[0]);for(const hole of rings.slice(1))shape.holes.push(new THREE.Path(hole));const geometry=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,steps:1,curveSegments:1});
    const position=geometry.attributes.position,uv:number[]=[];for(let i=0;i<position.count;i++){const lng=position.getX(i)/.6+125.3,m=position.getY(i)/.6+mercator(46.4);uv.push((lng-textureBounds.west)/(textureBounds.east-textureBounds.west),(m-textureBounds.south)/(textureBounds.north-textureBounds.south));}geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const mesh=new THREE.Mesh(geometry,[top,side]);mesh.rotation.x=-Math.PI/2;mesh.userData.id=feature.properties.id;this.land.add(mesh);
    for(const ring of rings){const points=ring.map(p=>new THREE.Vector3(p.x,1.008,-p.y)),border=createMapBoundary(points,this.style.mapEdge,this.style.mapEdgeWidth,.65);this.edges.push(border.material);this.land.add(border);}
   }
  }
 }
 private createBase(){
  const center=new THREE.Group();center.position.set(midX,-.035,midZ);this.base.add(center);
  const grid=new THREE.GridHelper(24,36,'#d5bd92','#d5bd92');grid.name='grain-grid';grid.position.set(midX,-.04,midZ);this.base.add(grid);
  for(const [radius,width,opacity] of [[7.3,.022,.24],[7.7,.012,.16],[8.1,.008,.12]]){const material=new THREE.MeshBasicMaterial({color:'#dfac52',transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}),mesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+width,160,1,Math.PI*.1,Math.PI*1.76),material);mesh.rotation.x=-Math.PI/2;center.add(mesh);}
  const sweep=new THREE.Mesh(new THREE.CircleGeometry(7.8,64,0,Math.PI/10),new THREE.MeshBasicMaterial({color:'#eca34e',transparent:true,opacity:.035,side:THREE.DoubleSide,depthWrite:false}));sweep.rotation.x=-Math.PI/2;sweep.name='sweep';center.add(sweep);
 }
 setData(regions:GrainMapRegion[],selected=''){this.regions=regions;this.selected=selected;release(this.markers);this.markers.clear();this.pulses=[];this.beams=[];const max=Math.max(1,...regions.map(r=>r.production??0));
  for(const [index,region] of regions.entries()){
   if(!Number.isFinite(region.lng)||!Number.isFinite(region.lat))continue;const [x,z]=grainProject(region.lng,region.lat),known=region.production!==null,size=known?.5+.65*Math.sqrt(Math.max(0,region.production!)/max):.45;
   if(known){const glow=new THREE.Mesh(new THREE.PlaneGeometry(size*3,size*3),new THREE.MeshBasicMaterial({map:this.glow,transparent:true,opacity:.66,depthWrite:false,side:THREE.DoubleSide}));glow.rotation.x=-Math.PI/2;glow.position.set(x,this.depth+.025,z);glow.userData.heat=true;this.markers.add(glow);}
   const ring=new THREE.Mesh(new THREE.RingGeometry(.09,.125,40),new THREE.MeshBasicMaterial({color:known?'#e99023':'#9a9381',transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(x,this.depth+.04,z);ring.userData.id=region.id;this.markers.add(ring);
   const pulse=new THREE.Mesh(new THREE.RingGeometry(.16,.18,40),new THREE.MeshBasicMaterial({color:'#e8a13b',transparent:true,opacity:.38,side:THREE.DoubleSide,depthWrite:false}));pulse.rotation.x=-Math.PI/2;pulse.position.set(x,this.depth+.045,z);this.pulses.push({mesh:pulse,index,size:1});this.markers.add(pulse);
   const marker=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.10,12),new THREE.MeshBasicMaterial({color:'#fff4d0'}));marker.position.set(x,this.depth+.1,z);marker.userData.id=region.id;this.markers.add(marker);
   const hit=new THREE.Mesh(new THREE.SphereGeometry(.20,10,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.position.set(x,this.depth+.12,z);hit.userData.id=region.id;this.markers.add(hit);
   if(known){const height=.4+.7*Math.sqrt(Math.max(0,region.production!)/max),beam=new THREE.Mesh(new THREE.ConeGeometry(.085,height,16,1,true),new THREE.MeshBasicMaterial({color:'#f5b959',transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));beam.rotation.z=Math.PI;beam.position.set(x,this.depth+height/2,z);this.beams.push(beam);this.markers.add(beam);}
  }this.paint();this.setHeat(this.heat);
 }
 private get depth(){return Math.max(.15,this.style.mapHeight||.32);}
 private paint(){const data=new Map(this.regions.map(r=>[r.id,r]));const textured=this.style.mapTexture&&!!this.texture;for(const surface of this.surfaces){surface.material.color.set(textured?'#ffffff':this.style.mapColor);if(!data.has(surface.id))surface.material.color.lerp(new THREE.Color(textured?'#626b65':'#eee9df'),textured?.65:.6);if(surface.id===this.hovered)surface.material.color.lerp(new THREE.Color('#f7b349'),textured?.12:.26);if(surface.id===this.selected)surface.material.color.lerp(new THREE.Color(this.style.accent),textured?.22:.43);}}
 apply(style:CockpitStyle){const oldDepth=this.depth,tiltChanged=this.style.mapTilt!==style.mapTilt;this.style={...style};this.renderer.setPixelRatio(Math.min(devicePixelRatio,style.performance==='fine'?2:style.performance==='smooth'?1:1.5));this.land.scale.y=this.depth;for(const surface of this.surfaces){surface.material.map=style.mapTexture?this.texture:null;surface.material.needsUpdate=true;}for(const material of this.sides)material.color.set(style.mapSide);for(const material of this.edges){material.color.set(style.mapEdge);material.linewidth=style.mapEdgeWidth;}const grid=this.base.getObjectByName('grain-grid') as THREE.GridHelper;grid.visible=style.grid;for(const material of (Array.isArray(grid.material)?grid.material:[grid.material])){material.color.set(style.gridColor);material.transparent=true;material.opacity=.16;}this.ambient.intensity=style.ambient;this.light.intensity=style.light;this.paint();if(oldDepth!==this.depth){if(this.regions.length)this.setData(this.regions,this.selected);this.heatLayer.group.position.y=this.depth+.035;}this.resize();if(tiltChanged)this.reset();}
 setSourcePoints(points:GrainSourcePoint[]){this.sourcePoints=points;this.heatLayer.setPoints(points,this.depth);this.setHeat(this.heat);}
 setSelectedSource(id:string){this.heatLayer.setSelected(id);}
 setPaused(paused:boolean){this.paused=paused;this.clockAt=0;}
 setHeat(visible:boolean){this.heat=visible;this.heatLayer.group.visible=visible;this.markers.visible=!visible;}
 reset(){const height=grainBounds.maxZ-grainBounds.minZ,width=grainBounds.maxX-grainBounds.minX,verticalFov=THREE.MathUtils.degToRad(this.camera.fov),distance=Math.max(height*.98,width/Math.max(.7,this.width/this.height)) / Math.tan(verticalFov/2)*.62;this.controls.target.set(midX,this.depth/2,midZ+.45);this.camera.position.set(midX,this.style.mapTilt?distance*.88:distance,this.style.mapTilt?midZ+distance*.48:midZ+.01);this.camera.lookAt(this.controls.target);this.controls.update();}
 private resize(){if(this.disposed)return;const rect=this.host.getBoundingClientRect(),first=this.width===1;this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height,false);if(first)this.reset();}
 private frame=(at:number)=>{if(this.disposed)return;this.animation=requestAnimationFrame(this.frame);if(document.hidden)return;const interval=this.style.performance==='smooth'?50:1000/30;if(at-this.frameAt<interval)return;this.frameAt=at;const animated=!this.paused&&!this.reduce.matches&&this.style.performance!=='smooth';if(this.clockAt&&animated)this.seconds+=Math.min(.1,(at-this.clockAt)/1000)*this.style.motionSpeed;this.clockAt=at;
  this.controls.update();for(const {mesh,index} of this.pulses){const progress=(this.seconds*.22+index*.17)%1;mesh.visible=this.style.pulse;mesh.scale.setScalar(animated?1+progress*2.2:1);(mesh.material as THREE.MeshBasicMaterial).opacity=animated?.4*(1-progress):.22;}
  for(const [index,beam] of this.beams.entries()){beam.visible=this.style.pulse;(beam.material as THREE.MeshBasicMaterial).opacity=.12+(animated?(Math.sin(this.seconds*1.2+index)+1)*.035:0);}
  const ground=this.base.children[0];if(ground){for(const [index,ring] of ground.children.entries()){if(ring.name==='sweep'){ring.visible=this.style.sweep;ring.rotation.z=-this.seconds*.12;}else if(animated&&this.style.flow)ring.rotation.z=this.seconds*(index%2?.015:-.01);}}
  this.heatLayer.animate(this.seconds,animated&&this.style.pulse);
  this.renderer.render(this.scene,this.camera);const anchorRows=this.heat?this.sourcePoints.map(point=>({...point,id:'county:'+point.adcode})):this.regions;this.onAnchors(anchorRows.map(region=>{const [x,z]=grainProject(region.lng,region.lat),point=new THREE.Vector3(x,this.depth+.16,z).project(this.camera);return {id:region.id,x:(point.x+1)*this.width/2,y:(1-point.y)*this.height/2,visible:point.z<1&&Math.abs(point.x)<1&&Math.abs(point.y)<1};}));
 };
 private hit(event:PointerEvent){const rect=this.renderer.domElement.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);const county=this.heat?this.heatLayer.hit(this.raycaster):undefined;if(county)return 'county:'+county;const id=(this.raycaster.intersectObjects(this.heat?[]:this.markers.children).find(hit=>hit.object.userData.id)||this.raycaster.intersectObjects(this.land.children).find(hit=>hit.object.userData.id))?.object.userData.id as string|undefined;return this.regions.some(region=>region.id===id)?id:undefined;}
 private pointerDown=(event:PointerEvent)=>{this.down=[event.clientX,event.clientY];};
 private pointerUp=(event:PointerEvent)=>{if(this.down&&Math.hypot(event.clientX-this.down[0],event.clientY-this.down[1])<5){const id=this.hit(event);if(id)this.onSelect(id);}this.down=null;};
 private pointerMove=(event:PointerEvent)=>{if(this.down||performance.now()-this.hoverAt<80)return;this.hoverAt=performance.now();const id=this.hit(event)||'';if(id!==this.hovered){this.hovered=id;this.paint();this.onHover(id);}this.renderer.domElement.style.cursor=id?'pointer':'grab';};
 private pointerLeave=()=>{this.down=null;this.hovered='';this.paint();this.onHover('');};
 private visibility=()=>{this.clockAt=0;};private motionChange=()=>{this.clockAt=0;};
 destroy(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.animation);this.observer?.disconnect();this.controls.dispose();document.removeEventListener('visibilitychange',this.visibility);this.reduce.removeEventListener('change',this.motionChange);const canvas=this.renderer.domElement;canvas.removeEventListener('pointerdown',this.pointerDown);canvas.removeEventListener('pointerup',this.pointerUp);canvas.removeEventListener('pointermove',this.pointerMove);canvas.removeEventListener('pointerleave',this.pointerLeave);this.heatLayer.destroy();release(this.scene);this.texture?.dispose();this.glow.dispose();this.renderer.dispose();this.renderer.forceContextLoss();canvas.remove();}
}
