<script setup lang="ts">
import {computed,ref,watch,onMounted,onBeforeUnmount} from 'vue';
import {Layers,Route,Play,Pause,X,Focus,RotateCcw,ChevronDown,MapPin,Ship,Truck,TrainFront,Navigation,ExternalLink} from 'lucide-vue-next';
import CockpitMap from './CockpitMap.vue';
import networkUrl from '../../map_data/transport-network.json?url';
import maritimeLicenseUrl from '../../tools/reference-data/LICENCE.txt?url';
import {buildCorridors,matchingCorridors,mapData,modeName} from '../network';
import {buildPlayback} from '../route-math';
import type {CockpitStyle} from '../theme';
import type {Business,NetworkReference,MapSelection,MapHover,ChartSelection,Point,View,Overview,Asset} from '../types';
const props=defineProps<{businesses:Business[];config:CockpitStyle;view:View;chartSelection:ChartSelection|null;risks:Overview['risks'];paused:boolean;scoped:boolean}>();
const emit=defineEmits<{filter:[scope:Record<string,string>,label:string];clearHighlight:[]}>();
const reference=ref<NetworkReference|null>(null),networkError=ref(''),selection=ref<MapSelection|null>(null),selectedCorridorId=ref(''),hover=ref<MapHover|null>(null),map=ref<InstanceType<typeof CockpitMap>>(),area=ref<HTMLElement>();
const routeList=ref(false),layersOpen=ref(false),sourcesOpen=ref(false),layer=ref<'network'|'origin'|'destination'|'risk'>('network'),modes=ref(['ROAD','RAIL','WATER']),cruising=ref(false);
const playbackOpen=ref(false),playing=ref(false),playhead=ref(0),speed=ref(1);const emptyAssets:Asset[]=[];let request:AbortController|undefined,raf=0,last=0,cruiseElapsed=0,cruiseIndex=0,playElapsed=0;
const empty:NetworkReference={version:1,coordinateSystem:'WGS84',nodes:[],segments:[],sources:{}};
const corridors=computed(()=>buildCorridors(props.businesses,reference.value||empty));
const chartMatches=computed(()=>{if(props.chartSelection?.dimension==='risk'){const types:Record<string,string>={PORT_CONGESTION:'港口拥堵',ENVIRONMENT:'环境影响',ETA_DELAY:'到达时效偏差',DELAY:'运输延迟',QUANTITY:'数量异常',MISSING_EVIDENCE:'凭证待补充'},ids=new Set(props.risks.filter(r=>(types[(r as any).type]||'节点衔接异常')===props.chartSelection!.value).map(r=>r.businessId));return new Set(corridors.value.filter(c=>c.businessIds.some(id=>ids.has(id))).map(c=>c.id));}return matchingCorridors(corridors.value,props.chartSelection,props.businesses);});
const related=computed(()=>{if(!selection.value)return corridors.value.filter(c=>chartMatches.value.has(c.id));const {kind,id}=selection.value;if(kind==='route')return corridors.value.filter(c=>c.segments.some(s=>s.id===id));if(kind==='node')return corridors.value.filter(c=>c.nodeNames.includes(id));return corridors.value.filter(c=>c.nodeNames.some(n=>reference.value?.nodes.find(v=>v.name===n)?.province===id));});
const current=computed(()=>corridors.value.find(c=>c.id===selectedCorridorId.value)||null);
const highlighted=computed(()=>selection.value?new Set((current.value&&selection.value.kind==='route'?[current.value]:related.value).map(c=>c.id)):chartMatches.value);
const schedule=computed(()=>current.value?buildPlayback(current.value):null);
const frame=computed(()=>playbackOpen.value?schedule.value?.at(playhead.value)||null:null);
const activeSegment=computed(()=>frame.value?.segmentId||(selection.value?.kind==='route'?selection.value.id:undefined));
const activeNode=computed(()=>selection.value?.kind==='node'?selection.value.id:frame.value?.phase==='handoff'?current.value?.nodeNames.find(n=>frame.value!.label.startsWith(n)):undefined);
const allMapData=computed(()=>mapData(corridors.value,reference.value||empty,highlighted.value,activeSegment.value,activeNode.value));
const data=computed(()=>{const sorted=allMapData.value.routes.filter(r=>modes.value.includes(r.mode)).sort((a,b)=>Number(a.dimmed)-Number(b.dimmed)||(b.quantityKg||0)-(a.quantityKg||0));const routes=selection.value||props.chartSelection?sorted:sorted.slice(0,Math.round(props.config.routeLimit||8));return {routes,nodes:allMapData.value.nodes};});
const regions=computed(()=>{const values=new Map<string,number>();for(const c of corridors.value){const names=layer.value==='destination'?[c.destination]:[c.origin];for(const name of names){const province=reference.value?.nodes.find(n=>n.name===name)?.province;if(province)values.set(province,(values.get(province)||0)+c.quantityKg);}}return values;});
const regionValue=computed(()=>related.value.reduce((sum,c)=>sum+c.quantityKg,0));
const regionBusinesses=computed(()=>new Set(related.value.flatMap(c=>c.businessIds)).size);
const scopedPoints=computed(()=>{const names=[...new Set(related.value.flatMap(c=>c.nodeNames))];return reference.value?.nodes.filter(n=>names.includes(n.name))||[];});
const title=computed(()=>selection.value?.kind==='route'?current.value?.label||'运输通道':selection.value?.id||'');
const metric=computed(()=>selection.value?.kind==='route'?current.value?.quantityKg||0:regionValue.value);
const visibleRoutes=computed(()=>corridors.value.filter(c=>chartMatches.value.has(c.id)));
const tons=(kg:number)=>(kg/1000).toLocaleString('zh-CN',{maximumFractionDigits:1});
const time=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const modeIcon=(mode:string)=>mode==='ROAD'?Truck:mode==='RAIL'?TrainFront:Ship;
const routeColor=(mode:string)=>mode==='ROAD'?props.config.roadColor:mode==='RAIL'?props.config.railColor:props.config.waterColor;
const tooltip=computed(()=>{const h=hover.value;if(!h)return null;const {kind,id}=h.selection;if(kind==='route'){const segment=reference.value?.segments.find(s=>s.id===id),route=allMapData.value.routes.find(r=>r.id===id);return segment&&route?{title:`${segment.origin} → ${segment.destination}`,line:`${modeName(segment.mode)} · ${tons(route.quantityKg||0)} 吨`}:null;}if(kind==='node'){const n=allMapData.value.nodes.find(n=>n.id===id);return n?{title:n.name,line:`${n.kind==='port'?'港口枢纽':n.role==='transfer'?'换装节点':'运输节点'} · ${tons(n.quantityKg||0)} 吨`}:null;}return {title:id,line:`${layer.value==='destination'?'到达量':'发运量'} ${(regions.value.get(id)||0)?tons(regions.value.get(id)||0):'0'} 吨`};});
const tooltipStyle=computed(()=>{const rect=area.value?.closest('.cc-map-section')?.getBoundingClientRect(),h=hover.value;if(!h||!rect)return {};return {left:`${Math.max(rect.left+8,Math.min(rect.right-240,h.x+14))}px`,top:`${Math.max(rect.top+100,Math.min(rect.bottom-75,h.y+12))}px`};});
const riskNodes=computed(()=>{if(layer.value!=='risk')return [];return allMapData.value.nodes.filter(n=>corridors.value.some(c=>c.nodeNames.includes(n.name)&&props.risks.some(r=>c.businessIds.includes(r.businessId))));});
const mapNodes=computed(()=>layer.value==='risk'?data.value.nodes.map(n=>({...n,selected:riskNodes.value.some(r=>r.id===n.id)||n.selected})):data.value.nodes);
async function loadReference(){request?.abort();request=new AbortController();networkError.value='';try{const response=await fetch(networkUrl,{signal:request.signal});if(!response.ok)throw Error('network');reference.value=await response.json();}catch(e:any){if(e.name!=='AbortError')networkError.value='运输线路暂未加载';}}
function stopPlayback(){playing.value=false;playbackOpen.value=false;playhead.value=0;}
function clear(){selection.value=null;selectedCorridorId.value='';hover.value=null;sourcesOpen.value=false;stopPlayback();}
function choose(value:MapSelection|null){cruising.value=false;hover.value=null;sourcesOpen.value=false;stopPlayback();selection.value=value;routeList.value=false;if(value?.kind==='route')selectedCorridorId.value=corridors.value.find(c=>chartMatches.value.has(c.id)&&c.segments.some(s=>s.id===value.id))?.id||corridors.value.find(c=>c.segments.some(s=>s.id===value.id))?.id||'';else selectedCorridorId.value='';}
function chooseCorridor(id:string,focus=true){const c=corridors.value.find(c=>c.id===id);if(!c)return;choose({kind:'route',id:c.segments[0]?.id||''});selectedCorridorId.value=c.id;if(focus)map.value?.focus(c.segments.flatMap(s=>s.coordinates.map(([lng,lat])=>({lng,lat}))));}
function focus(){if(current.value)map.value?.focus(current.value.segments.flatMap(s=>s.coordinates.map(([lng,lat])=>({lng,lat}))));else map.value?.focus(scopedPoints.value);}
function startPlayback(){const c=current.value;if(!c||!c.segments.length||c.missingSegments)return;if(playhead.value>=schedule.value!.duration)playhead.value=0;modes.value=[...new Set([...modes.value,...c.segments.map(s=>s.mode)])];playbackOpen.value=true;playing.value=true;cruising.value=false;hover.value=null;focus();}
function seek(event:Event){playing.value=false;playElapsed=0;playhead.value=(schedule.value?.duration||0)*(Number((event.target as HTMLInputElement).value)/1000);}
function scope(){if(!selection.value)return;if(current.value)emit('filter',{origin:current.value.origin,destination:current.value.destination,combination:current.value.combination},current.value.label);else emit('filter',selection.value.kind==='node'?{node:selection.value.id}:{region:selection.value.id},selection.value.id);}
function toggleMode(mode:string){stopPlayback();modes.value=modes.value.includes(mode)?modes.value.filter(v=>v!==mode):[...modes.value,mode];}
function reset(){cruising.value=false;clear();emit('clearHighlight');map.value?.reset();}
function interact(){cruising.value=false;hover.value=null;}
function keydown(event:KeyboardEvent){if(event.key==='Escape'&&!props.paused){reset();routeList.value=false;layersOpen.value=false;}}
function tick(now:number){raf=requestAnimationFrame(tick);const dt=Math.min(.15,(now-last)/1000||0);last=now;if(document.hidden||props.paused)return;
 if(playing.value&&schedule.value){playElapsed+=dt;if(playElapsed>=.04){playhead.value=Math.min(schedule.value.duration,playhead.value+playElapsed*speed.value);playElapsed=0;if(playhead.value===schedule.value.duration)playing.value=false;}}else playElapsed=0;
 if(cruising.value){cruiseElapsed+=dt;if(cruiseElapsed>=10){cruiseElapsed=0;const c=visibleRoutes.value[cruiseIndex++%Math.max(1,visibleRoutes.value.length)];if(c){chooseCorridor(c.id);cruising.value=true;}else map.value?.reset();}}
}
watch(()=>props.view,()=>{reset();routeList.value=false;layersOpen.value=false;});
watch(()=>props.config.autoCruise,value=>{cruising.value=!!value&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;cruiseElapsed=9.5;},{immediate:true});
watch(()=>props.chartSelection,()=>{clear();if(props.chartSelection){if(props.chartSelection.dimension==='risk')layer.value='risk';const rows=corridors.value.filter(c=>chartMatches.value.has(c.id)),names=new Set(rows.flatMap(c=>c.nodeNames));map.value?.focus(reference.value?.nodes.filter(n=>names.has(n.name))||[]);}});
watch(corridors,rows=>{if(selectedCorridorId.value&&!rows.some(c=>c.id===selectedCorridorId.value))clear();});
watch(()=>props.paused,value=>{if(value){playing.value=false;cruising.value=false;}});
watch(layer,()=>{hover.value=null;});
onMounted(()=>{void loadReference();raf=requestAnimationFrame(tick);document.addEventListener('keydown',keydown);});
onBeforeUnmount(()=>{request?.abort();cancelAnimationFrame(raf);document.removeEventListener('keydown',keydown);});
defineExpose({reset,focus:(nodes:Point[])=>map.value?.focus(nodes)});
</script>

<template>
 <div ref="area" class="cc-explorer" :data-playing="playing" :data-progress="playhead.toFixed(2)" :data-selected-corridor="current?.id||''" :data-scoped="scoped">
  <CockpitMap ref="map" :style-config="config" :routes="data.routes" :nodes="mapNodes" :assets="emptyAssets" :replay-at="null" :frame="frame" :regions="regions" :selected-region="selection?.kind==='region'?selection.id:''" @select="choose" @hover="hover=$event" @interact="interact"/>
  <div v-if="networkError" class="cc-network-error" role="alert">{{networkError}}<button @click="loadReference">重新加载</button></div>
  <div v-if="tooltip&&!selection&&!routeList&&!layersOpen" class="cc-map-tooltip" :style="tooltipStyle"><strong>{{tooltip.title}}</strong><span>{{tooltip.line}}</span></div>
  <Transition name="cc-map-detail">
   <section v-if="selection" class="cc-route-detail" aria-label="地图详情">
    <header><span><Route v-if="selection.kind==='route'" :size="14"/><MapPin v-else :size="14"/>{{selection.kind==='route'?'运输通道':selection.kind==='node'?'联运节点':'地区分布'}}</span><button class="cc-icon-button" aria-label="关闭地图详情" @click="clear"><X :size="15"/></button></header>
    <h3>{{title}}</h3>
    <div class="cc-route-figures"><div><small>关联运输量</small><strong>{{tons(metric)}}<em>吨</em></strong></div><div><small>关联业务</small><strong>{{current?.businessIds.length||regionBusinesses}}<em>单</em></strong></div></div>
    <ol v-if="current" class="cc-route-stages"><li v-for="(segment,i) in current.segments" :key="segment.id" :class="{'is-active':frame?.segmentId===segment.id}" :style="{'--route-color':routeColor(segment.mode)}"><component :is="modeIcon(segment.mode)" :size="14"/><span>{{i===0?segment.origin:''}}{{i===0?' → ':''}}{{segment.destination}}<small>{{modeName(segment.mode)}} · {{(segment.distanceMeters/1000).toFixed(0)}} km</small></span></li></ol>
    <div v-else class="cc-node-corridors"><button v-for="c in related.slice(0,3)" :key="c.id" @click="chooseCorridor(c.id)"><span>{{c.label}}</span><small>{{c.combination}} · {{tons(c.quantityKg)}} 吨</small></button><p v-if="!related.length">当前范围暂无关联通道</p></div>
    <div class="cc-route-detail-actions"><button @click="focus"><Focus :size="13"/>聚焦</button><button :disabled="!related.length" @click="scope">{{current?'筛选此通道':selection.kind==='node'?'筛选此节点':'筛选此地区'}}</button><button v-if="current" class="cc-action-accent" :disabled="!current.segments.length||!!current.missingSegments" @click="startPlayback"><Play :size="13"/>路线回放</button></div>
    <template v-if="current"><button class="cc-route-source-toggle" :aria-expanded="sourcesOpen" @click="sourcesOpen=!sourcesOpen">路线来源<ChevronDown :size="12"/></button><div v-if="sourcesOpen" class="cc-route-sources"><div v-for="segment in current.segments" :key="segment.id"><a :href="segment.sourceUrl" target="_blank" rel="noopener noreferrer">{{segment.sourceLabel}}<ExternalLink :size="10"/></a><small>{{segment.basis}}</small><small v-if="segment.connectionMeters&&(segment.connectionMeters.origin>50||segment.connectionMeters.destination>50)">未包含接驳：起点 {{(segment.connectionMeters.origin/1000).toFixed(1)}} km · 终点 {{(segment.connectionMeters.destination/1000).toFixed(1)}} km</small></div><p v-if="current.missingSegments">部分区段暂无可用线路</p></div></template>
   </section>
  </Transition>
  <div v-if="chartSelection" class="cc-map-highlight">{{chartSelection.grain?`${chartSelection.grain} · `:''}}{{chartSelection.value}}<button aria-label="取消图表高亮" @click="emit('clearHighlight')"><X :size="12"/></button></div>
  <div class="cc-map-tools">
   <button :class="{active:routeList}" :aria-expanded="routeList" @click="routeList=!routeList;layersOpen=false"><Route :size="15"/>运输通道<span>{{visibleRoutes.length}}</span></button>
   <button :class="{active:layersOpen}" :aria-expanded="layersOpen" @click="layersOpen=!layersOpen;routeList=false"><Layers :size="15"/>图层</button>
   <button :class="{active:cruising}" :aria-pressed="cruising" @click="cruising=!cruising;cruiseElapsed=9.5"><Navigation :size="14"/>巡航</button>
  </div>
  <div v-if="routeList" class="cc-map-popover cc-corridor-list" aria-label="运输通道列表"><header>主要运输通道<button class="cc-icon-button" aria-label="关闭运输通道列表" @click="routeList=false"><X :size="14"/></button></header><button v-for="c in visibleRoutes" :key="c.id" class="cc-corridor-option" @click="chooseCorridor(c.id)"><span>{{c.label}}</span><small>{{c.combination}}<b>{{tons(c.quantityKg)}} 吨</b></small></button><p v-if="!visibleRoutes.length" class="cc-empty">当前范围暂无运输通道</p></div>
  <div v-if="layersOpen" class="cc-map-popover cc-layer-options" aria-label="地图图层设置"><header>地图图层<button class="cc-icon-button" aria-label="关闭图层设置" @click="layersOpen=false"><X :size="14"/></button></header><div class="cc-map-layer-tabs"><button v-for="option in [{id:'network',name:'联运网络'},{id:'origin',name:'发运分布'},{id:'destination',name:'到达分布'},{id:'risk',name:'风险节点'}]" :key="option.id" :class="{active:layer===option.id}" @click="layer=option.id as any">{{option.name}}</button></div><div class="cc-map-mode-choices"><button v-for="mode in ['ROAD','RAIL','WATER']" :key="mode" :aria-pressed="modes.includes(mode)" :class="{inactive:!modes.includes(mode)}" @click="toggleMode(mode)"><component :is="modeIcon(mode)" :size="14" :style="{color:routeColor(mode)}"/>{{modeName(mode)}}</button></div><div class="cc-map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a><a href="https://github.com/genthalili/searoute-py" target="_blank" rel="noopener noreferrer">Marnet / SeaRoute</a><a :href="maritimeLicenseUrl" target="_blank" rel="noopener noreferrer">数据许可</a></div></div>
  <div v-if="playbackOpen&&schedule" class="cc-route-player" aria-label="路线回放控制"><header><span :style="{color:routeColor(frame?.mode||'ROAD')}"><component :is="modeIcon(frame?.mode||'ROAD')" :size="15"/></span><strong>{{frame?.label}}</strong><button class="cc-icon-button" aria-label="关闭路线回放" @click="stopPlayback"><X :size="15"/></button></header><div class="cc-player-controls"><button class="cc-icon-button" :aria-label="playing?'暂停回放':'继续回放'" @click="playing?playing=false:startPlayback()"><component :is="playing?Pause:Play" :size="17"/></button><input :value="Math.round(playhead/schedule.duration*1000)" type="range" min="0" max="1000" step="1" aria-label="路线回放进度" @input="seek"/><time>{{time(playhead)}} / {{time(schedule.duration)}}</time><select v-model.number="speed" aria-label="路线回放速度"><option :value=".5">0.5×</option><option :value="1">1×</option><option :value="2">2×</option><option :value="4">4×</option></select><button class="cc-icon-button" aria-label="重新播放路线" @click="playhead=0;playing=true"><RotateCcw :size="14"/></button></div></div>
 </div>
</template>
