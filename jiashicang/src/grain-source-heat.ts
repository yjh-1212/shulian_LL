import * as THREE from 'three';
import {preferredSourceNames,type GrainSourcePoint} from './grain-source-points';

type Point=[number,number];
type Bounds={minX:number;maxX:number;minZ:number;maxZ:number};
/** County-centre density weighted by source catalogue level, never a production raster. */
export class GrainSourceHeatLayer {
 readonly group=new THREE.Group();
 private dots:THREE.InstancedMesh|null=null;
 private rings:THREE.InstancedMesh|null=null;
 private points:GrainSourcePoint[]=[];
 private ringPoints:GrainSourcePoint[]=[];
 private texture:THREE.CanvasTexture|null=null;
 private dummy=new THREE.Object3D();
 private selected='';
 constructor(private bounds:Bounds,private project:(lng:number,lat:number)=>Point,private landRings:Point[][][]){}
 setPoints(points:GrainSourcePoint[],depth:number){
  this.clear();this.points=points;this.group.position.y=depth+.035;
  if(!points.length)return;
  const {minX,maxX,minZ,maxZ}=this.bounds,w=maxX-minX,h=maxZ-minZ;
  const width=768,height=Math.round(768*h/w),values=new Float32Array(width*height);
  // A fixed bandwidth and scale make the same location comparable across filters.
  const radius=.45,rx=radius/w*width,ry=radius/h*height;
  for(const p of points){const [x,z]=this.project(p.lng,p.lat),cx=(x-minX)/w*width,cy=(z-minZ)/h*height,weight=p.level==='core'?1:p.level==='key'?.6:.28;
   for(let py=Math.max(0,Math.floor(cy-ry*2));py<Math.min(height,cy+ry*2);py++)for(let px=Math.max(0,Math.floor(cx-rx*2));px<Math.min(width,cx+rx*2);px++){
    const d=((px-cx)/rx)**2+((py-cy)/ry)**2;if(d<4)values[py*width+px]+=Math.exp(-d*2.8)*weight;
   }
  }
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d')!,image=context.createImageData(width,height);
  const stops=[[0,40,211,139],[.25,109,233,55],[.48,250,225,32],[.72,255,133,20],[1,243,39,29]];
  for(let i=0;i<values.length;i++){const v=Math.min(1,values[i]/1.15);if(v<.025)continue;let n=1;while(n<stops.length-1&&v>stops[n][0])n++;const a=stops[n-1],b=stops[n],t=(v-a[0])/(b[0]-a[0]);for(let c=0;c<3;c++)image.data[i*4+c]=a[c+1]+(b[c+1]-a[c+1])*t;image.data[i*4+3]=Math.min(.8,v*2)*255;}
  context.putImageData(image,0,0);
  // Clip the heat surface to the actual regional polygons, including water holes.
  const mask=document.createElement('canvas');mask.width=width;mask.height=height;const m=mask.getContext('2d')!;m.fillStyle='#fff';
  for(const polygon of this.landRings){m.beginPath();for(const ring of polygon){ring.forEach(([x,z],i)=>{const px=(x-minX)/w*width,py=(z-minZ)/h*height;i?m.lineTo(px,py):m.moveTo(px,py);});m.closePath();}m.fill('evenodd');}
  context.globalCompositeOperation='destination-in';context.drawImage(mask,0,0);
  this.texture=new THREE.CanvasTexture(canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
  const surface=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1}));surface.rotation.x=-Math.PI/2;surface.position.set((minX+maxX)/2,0,(minZ+maxZ)/2);this.group.add(surface);
  this.dots=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshBasicMaterial({toneMapped:false}),points.length);
  for(const [i,p] of points.entries()){const [x,z]=this.project(p.lng,p.lat),size=p.level==='core'?.075:p.level==='key'?.048:.032;this.dummy.position.set(x,.035,z);this.dummy.scale.setScalar(size);this.dummy.updateMatrix();this.dots.setMatrixAt(i,this.dummy.matrix);this.dots.setColorAt(i,new THREE.Color(p.level==='core'?'#fff6c7':p.level==='key'?'#a2fff3':'#43dfbd'));}this.dots.instanceMatrix.needsUpdate=true;this.group.add(this.dots);
  this.ringPoints=points.filter(p=>p.level==='core');
  this.rings=new THREE.InstancedMesh(new THREE.RingGeometry(.12,.145,32),new THREE.MeshBasicMaterial({color:'#ffed9a',transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}),this.ringPoints.length);this.group.add(this.rings);this.animate(0,false);
  const beamVertices:number[]=[],beamColors:number[]=[];
  for(const p of points.filter(p=>preferredSourceNames.includes(p.name)&&p.level==='core').slice(0,10)){const [x,z]=this.project(p.lng,p.lat);beamVertices.push(x,.06,z,x,.6,z);beamColors.push(1,.63,.12,1,.94,.65);}
  const beams=new THREE.BufferGeometry();beams.setAttribute('position',new THREE.Float32BufferAttribute(beamVertices,3));beams.setAttribute('color',new THREE.Float32BufferAttribute(beamColors,3));this.group.add(new THREE.LineSegments(beams,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.7,depthWrite:false,toneMapped:false})));
 }
 setSelected(id:string){this.selected=id;}
 animate(seconds:number,animated:boolean){if(!this.rings)return;for(const [i,p] of this.ringPoints.entries()){const [x,z]=this.project(p.lng,p.lat),scale=p.adcode===this.selected?1.65:animated?1+(Math.sin(seconds*1.8+i*.8)+1)*.18:1.12;this.dummy.position.set(x,.025,z);this.dummy.rotation.set(-Math.PI/2,0,0);this.dummy.scale.setScalar(scale);this.dummy.updateMatrix();this.rings.setMatrixAt(i,this.dummy.matrix);}this.dummy.rotation.set(0,0,0);this.rings.instanceMatrix.needsUpdate=true;}
 hit(raycaster:THREE.Raycaster){if(!this.group.visible||!this.dots)return;const hit=raycaster.intersectObject(this.dots)[0];return hit?.instanceId!==undefined?this.points[hit.instanceId]?.adcode:undefined;}
 private clear(){this.group.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry?.dispose();if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();if(object instanceof THREE.InstancedMesh)object.dispose();});this.group.clear();this.texture?.dispose();this.texture=null;this.dots=null;this.rings=null;}
 destroy(){this.clear();}
}
