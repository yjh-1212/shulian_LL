<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref,watch,computed} from 'vue';
import {CockpitMapEngine,project,mapFeatures,provinceAt,mapVerticalOffset,type MapLabel} from '../map-engine';
import type {CockpitStyle} from '../theme';
import type {MapRoute,MapNode,Asset,Point,MapSelection,MapHover,PlaybackFrame} from '../types';
const props=defineProps<{styleConfig:CockpitStyle;routes:MapRoute[];nodes:MapNode[];assets:Asset[];replayAt:number|null;frame?:PlaybackFrame|null;regions?:Map<string,number>;selectedRegion?:string}>();
const emit=defineEmits<{select:[selection:MapSelection|null];hover:[hover:MapHover|null];interact:[];ready:[]}>();
const host=ref<HTMLElement>(),labels=ref<MapLabel[]>([]),failed=ref(false),ready=ref(false);let engine:CockpitMapEngine|undefined;
const paths=computed(()=>mapFeatures.flatMap((f:any)=>(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).map((p:number[][][])=>p.map(r=>r.map((c,i)=>{const [x,z]=project({lng:c[0],lat:c[1]});return `${i?'L':'M'}${x*42+410},${z*42+285}`;}).join(' ')+' Z').join(' '))));
const fallbackNode=(p:Point)=>{const [x,z]=project(p);return {x:x*42+410,y:z*42+285};};
const fallbackRoutes=computed(()=>props.routes.map(r=>{
 const points=r.points.filter(p=>Number.isFinite(p.lng)&&Number.isFinite(p.lat)).map(fallbackNode);if(points.length<2)return {...r,d:''};
 const a=points[0],b=points.at(-1)!;
 return {...r,d:r.schematic?`M${a.x},${a.y} Q${(a.x+b.x)/2-28},${(a.y+b.y)/2-25} ${b.x},${b.y}`:points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')};
}));
const fallbackAssets=computed(()=>props.assets.flatMap(a=>{
 const p=props.replayAt==null?a.position:a.trajectory.filter(p=>p.at&&new Date(p.at).getTime()<=props.replayAt!).at(-1);
 return p&&Number.isFinite(p.lng)&&Number.isFinite(p.lat)?[{...a,point:fallbackNode(p)}]:[];
}));
const routeColor=(mode:string)=>mode==='ROAD'?props.styleConfig.roadColor:mode==='RAIL'?props.styleConfig.railColor:props.styleConfig.waterColor;
const regionColors=computed(()=>{const colors=new Map<string,string>();for(const node of props.nodes){const region=provinceAt(node);if(region&&!colors.has(region))colors.set(region,node.role==='source'?props.styleConfig.chartPalette==='grain'?props.styleConfig.accent:props.styleConfig.primary:props.styleConfig.waterColor);}return colors;});
const flatColors=computed(()=>mapFeatures.flatMap((f:any)=>(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).map(()=>regionColors.value.get(f.properties.name)||props.styleConfig.mapColor)));
const flatNames=mapFeatures.flatMap((f:any)=>(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).map(()=>f.properties.name));
const provinceColor=(name:string,index:number)=>name===props.selectedRegion?props.styleConfig.accent:(props.regions?.get(name)?props.styleConfig.primary:flatColors.value[index]);
function reset(){engine?.reset();}function focus(nodes:Point[]){engine?.focus(nodes);}
function update(){engine?.setData(props.routes,props.nodes,props.assets);}
onMounted(()=>{try{engine=new CockpitMapEngine(host.value!,props.styleConfig,v=>{
 // Keep a few horizontal labels; avoid collisions at a national scale.
 const occupied:{x:number;y:number}[]=[],area=host.value?.closest('.cc-map-section')?.getBoundingClientRect();const next=v.filter(label=>{if(!label.visible||(area&&(label.x<area.left+10||label.x>area.right-100||label.y<area.top+100||label.y>area.bottom-65))||occupied.some(p=>Math.abs(p.x-label.x)<110&&Math.abs(p.y-label.y)<28))return false;occupied.push(label);return true;}).slice(0,props.styleConfig.labelLimit||8);
 if(next.length!==labels.value.length||next.some((n,i)=>n.id!==labels.value[i].id||Math.abs(n.x-labels.value[i].x)>.7||Math.abs(n.y-labels.value[i].y)>.7))labels.value=next;
},selection=>emit('select',selection),hover=>emit('hover',hover),()=>emit('interact'));update();engine.setRegions(props.regions||new Map(),props.selectedRegion);ready.value=true;emit('ready');}catch{engine?.destroy();engine=undefined;failed.value=true;ready.value=true;emit('ready');}});
watch(()=>[props.routes,props.nodes,props.assets],update);
watch(()=>props.styleConfig,s=>{engine?.apply(s);update();},{deep:true});
watch(()=>props.replayAt,at=>engine?.setPlayback(at));
watch(()=>props.frame,frame=>engine?.setReplayFrame(frame||null));
watch(()=>[props.regions,props.selectedRegion],()=>engine?.setRegions(props.regions||new Map(),props.selectedRegion));
onBeforeUnmount(()=>engine?.destroy());defineExpose({reset,focus});
</script>
<template>
 <div class="cc-map-renderer" :class="{'cc-map-flat':failed}">
  <div ref="host" class="cc-map-canvas" data-testid="cockpit-map"/>
  <template v-if="!failed&&styleConfig.labels"><button v-for="label in labels" :key="label.id" class="cc-map-label" :class="{'is-selected':label.selected}" :style="{transform:`translate(${label.x}px,${label.y}px)`,fontSize:`${styleConfig.labelSize}px`}" :aria-label="`查看节点 ${label.name}`" @click="emit('select',{kind:'node',id:label.id})">{{label.name}}</button></template>
  <svg v-if="failed" class="cc-map-fallback" viewBox="0 0 820 740" aria-label="中国联运地图二维视图"><g :transform="`translate(0 ${740*mapVerticalOffset})`">
   <path v-for="(d,i) in paths" :key="i" :d="d" :fill="provinceColor(flatNames[i],i)" role="button" tabindex="0" :aria-label="`查看地区 ${flatNames[i]}`" @click="emit('select',{kind:'region',id:flatNames[i]})" @keydown.enter="emit('select',{kind:'region',id:flatNames[i]})" :stroke="styleConfig.mapEdge" stroke-width="0.6"/>
   <path v-for="r in fallbackRoutes" :key="r.id" :d="r.d" fill="none" :stroke="r.selected?styleConfig.accent:routeColor(r.mode)" :stroke-width="styleConfig.routeWidth+2" :opacity="r.dimmed?.15:.9" role="button" tabindex="0" :aria-label="`查看线路 ${r.label}`" @click="emit('select',{kind:'route',id:r.id})" @keydown.enter="emit('select',{kind:'route',id:r.id})"/>
   <g v-for="n in nodes" :key="n.id" role="button" tabindex="0" :aria-label="`查看节点 ${n.name}`" @click="emit('select',{kind:'node',id:n.id})" @keydown.enter="emit('select',{kind:'node',id:n.id})"><circle :cx="fallbackNode(n).x" :cy="fallbackNode(n).y" r="12" fill="transparent"/><circle :cx="fallbackNode(n).x" :cy="fallbackNode(n).y" r="3" :fill="styleConfig.primary"/><text v-if="styleConfig.labels" :x="fallbackNode(n).x+5" :y="fallbackNode(n).y" :fill="styleConfig.text" :font-size="styleConfig.labelSize">{{n.name}}</text></g>
   <circle v-if="styleConfig.assets&&frame?.point" :cx="fallbackNode(frame.point).x" :cy="fallbackNode(frame.point).y" r="5" :fill="routeColor(frame.mode)"/>
  </g></svg>
  <small v-if="failed" class="cc-flat-notice">当前设备使用二维地图</small>
  <div v-if="!ready" class="cc-map-loading" role="status">正在载入中国地图…</div>
 </div>
</template>
