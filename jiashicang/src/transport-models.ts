import * as THREE from 'three';
import type {Mode} from './types';

/** Original low-poly transport models; no external assets, textures or GLB downloads. Front faces -Z. */
export function createTransportModel(mode:Mode,color='#60b8ef') {
 const group=new THREE.Group();
 const paint=new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.25});
 const pale=new THREE.MeshStandardMaterial({color:'#d8e7ef',roughness:.6});
 const dark=new THREE.MeshStandardMaterial({color:'#182b42',roughness:.7});
 const glass=new THREE.MeshStandardMaterial({color:'#75cee9',metalness:.4,roughness:.2});
 const grain=new THREE.MeshStandardMaterial({color:'#d7b66d',roughness:1});
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat=paint)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
 const wheels=(z:number,width=.24)=>{for(const x of [-width,width]){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.035,8),dark);mesh.rotation.z=Math.PI/2;mesh.position.set(x,.07,z);group.add(mesh);}};
 if(mode==='ROAD'){
  box(0,.12,0,.38,.07,1.1,dark);box(0,.27,-.4,.38,.3,.28);box(0,.34,-.547,.31,.12,.009,glass);box(0,.25,.15,.42,.27,.72,pale);
  box(0,.39,.15,.37,.015,.66,grain);box(0,.1,-.56,.4,.04,.04,pale);for(const x of [-.13,.13])box(x,.17,-.55,.075,.04,.012,pale);
  for(const z of [-.42,.24,.43])wheels(z,.2);
  for(const z of [-.14,0,.14,.28,.42])box(0,.25,z,.435,.25,.014);
 }else if(mode==='RAIL'){
  box(0,.19,-.43,.3,.26,.42);box(0,.31,-.49,.28,.12,.22,pale);box(0,.32,-.608,.23,.07,.012,glass);box(0,.08,-.43,.34,.05,.46,dark);
  for(const z of [-.57,-.3])wheels(z,.16);
  for(const z of [.02,.48]){box(0,.1,z,.34,.07,.42,dark);box(0,.23,z,.32,.22,.39,pale);box(0,.345,z,.28,.012,.35,grain);for(const offset of [-.14,.14])wheels(z+offset,.16);for(const offset of [-.12,0,.12])box(0,.23,z+offset,.34,.2,.012);}
 }else{
  const hull=new THREE.Shape();hull.moveTo(0,-.75);hull.lineTo(.23,-.42);hull.lineTo(.23,.57);hull.lineTo(.16,.68);hull.lineTo(-.16,.68);hull.lineTo(-.23,.57);hull.lineTo(-.23,-.42);hull.closePath();
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(hull,{depth:.16,bevelEnabled:false}),paint);mesh.rotation.x=Math.PI/2;mesh.position.y=.22;group.add(mesh);
  box(0,.24,.49,.34,.06,.25,pale);box(0,.35,.48,.28,.19,.2,pale);box(0,.4,.37,.23,.06,.014,glass);box(.08,.52,.5,.065,.16,.07,dark);
  for(const z of [-.38,-.08,.22]){box(0,.24,z,.33,.045,.23,dark);box(0,.266,z,.29,.014,.19,grain);}
  box(0,.42,-.58,.018,.38,.018,pale);box(0,.48,-.58,.22,.015,.015,pale);
 }
 group.userData.mode=mode;return group;
}
export function disposeTransport(root:THREE.Object3D){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();root.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
