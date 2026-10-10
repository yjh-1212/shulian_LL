<script setup lang="ts">
import lineRaw from '../../map_data/nine-dash-line.geojson?raw';
import {mapFeatures,southSeaPolygons,project} from '../map-engine';
import type {CockpitStyle} from '../theme';
defineProps<{styleConfig:CockpitStyle}>();
const lines:number[][][]=JSON.parse(lineRaw).geometry.coordinates;
const polygons:number[][][][]=[...southSeaPolygons,...mapFeatures.filter((f:any)=>['海南省','台湾省'].includes(f.properties.name)).flatMap((f:any)=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates)];
const points=[...lines.flat(),...polygons.flat(2)].map(p=>project({lng:p[0],lat:p[1]}));
const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
const minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
const scale=Math.min(84/(maxX-minX),134/(maxY-minY));
const left=(100-(maxX-minX)*scale)/2,top=(150-(maxY-minY)*scale)/2;
const path=(ring:number[][],closed=false)=>ring.map((p,i)=>{const [x,y]=project({lng:p[0],lat:p[1]});return `${i?'L':'M'}${(left+(x-minX)*scale).toFixed(2)},${(top+(y-minY)*scale).toFixed(2)}`;}).join(' ')+(closed?' Z':'');
const islandPaths=polygons.map(p=>p.map(r=>path(r,true)).join(' '));
const linePaths=lines.map(r=>path(r));
</script>

<template>
 <aside class="cc-south-sea-inset" aria-label="南海诸岛与断续线附图">
  <svg viewBox="0 0 100 150" role="img" aria-label="南海诸岛与断续线">
   <path v-for="(d,i) in islandPaths" :key="`island-${i}`" :d="d" :fill="styleConfig.mapColor" :stroke="styleConfig.mapEdge" stroke-width=".55" opacity=".7"/>
   <g class="cc-south-sea-lines" fill="none" :stroke="styleConfig.mapEdge" stroke-width="1.35" stroke-linecap="round"><path v-for="(d,i) in linePaths" :key="i" :d="d"/></g>
  </svg>
 </aside>
</template>
