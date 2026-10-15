import type {Vector3} from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';

// WebGL native lines ignore widths above one pixel on most browsers.
// Line2 renders the boundary as a strip and updates its viewport resolution.
export function createMapBoundary(points:Vector3[],color:string,width:number,opacity:number):Line2 {
 const geometry=new LineGeometry();
 geometry.setPositions(points.flatMap(point=>[point.x,point.y,point.z]));
 const material=new LineMaterial({color,linewidth:width,worldUnits:false,transparent:true,opacity,depthWrite:false});
 return new Line2(geometry,material);
}
