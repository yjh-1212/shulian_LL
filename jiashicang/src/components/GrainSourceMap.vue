<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue';
import {Layers,Pause,Play,RotateCcw,Compass,X} from 'lucide-vue-next';
import {preferredSourceNames,sourceLevelName,type GrainSourcePoint} from '../grain-source-points';
import {GrainSourceMapEngine,grainFeatures,grainProject,grainBounds,type GrainMapRegion,type GrainMapAnchor} from '../grain-source-map-engine';
import type {CockpitStyle} from '../theme';

const props=defineProps<{config:CockpitStyle;regions:GrainMapRegion[];points:GrainSourcePoint[];selected:string;paused:boolean}>();
const emit=defineEmits<{select:[id:string];pause:[paused:boolean]}>();
const host=ref<HTMLElement>(),stage=ref<HTMLElement>(),ready=ref(false),flat=ref(false),heat=ref(true),localPaused=ref(false),hovered=ref(''),anchors=ref<GrainMapAnchor[]>([]),size=ref({width:1,height:1});
let engine:GrainSourceMapEngine|undefined,observer:ResizeObserver|undefined,detailObserver:ResizeObserver|undefined;
const effectivePaused=computed(()=>props.paused||localPaused.value);
const textureState=ref<'loading'|'ready'|'error'>('loading');
const selectedSource=ref('');
const detailElement=ref<HTMLElement>(),detailSize=ref({width:252,height:140});
const detailPosition=computed(()=>{
 const anchor=anchors.value.find(a=>a.id==='county:'+selectedSource.value);
 const {width,height}=size.value,box=detailSize.value,margin=12,gap=48;
 if(!anchor?.visible||anchor.x<0||anchor.x>width||anchor.y<0||anchor.y>height)return null;
 const left=Math.max(margin,Math.min(width-box.width-margin,anchor.x-box.width/2));
 const above=anchor.y-gap-box.height>=margin;
 const top=Math.max(margin,Math.min(height-box.height-margin,above?anchor.y-gap-box.height:anchor.y+20));
 return {left,top,placement:above?'above':'below',tip:Math.max(14,Math.min(box.width-14,anchor.x-left))};
});
watch(detailElement,element=>{
 detailObserver?.disconnect();
 if(!element)return;
 const measure=()=>{detailSize.value={width:element.offsetWidth,height:element.offsetHeight};};
 measure();element.focus({preventScroll:true});detailObserver=new ResizeObserver(measure);detailObserver.observe(element);
},{flush:'post'});
const sourceDetail=computed(()=>props.points.find(p=>p.adcode===selectedSource.value));
const sourceCounts=computed(()=>({core:props.points.filter(p=>p.level==='core').length,key:props.points.filter(p=>p.level==='key').length}));
const countyLabels=computed(()=>{
 const indexed=new Map(anchors.value.map(a=>[a.id,a])),occupied:{x:number;y:number}[]=[],result:any[]=[];
 const rank=(p:GrainSourcePoint)=>p.adcode===selectedSource.value?-100:p.adcode===hovered.value.replace('county:','')?-90:preferredSourceNames.includes(p.name)?preferredSourceNames.indexOf(p.name):p.level==='core'?30:50;
 for(const p of [...props.points].sort((a,b)=>rank(a)-rank(b))){const a=indexed.get('county:'+p.adcode);if(!a?.visible)continue;const x=a.x,y=a.y-30;
  if(x<60||x>size.value.width-60||y<195||y>size.value.height-145||occupied.some(r=>Math.abs(r.x-x)<112&&Math.abs(r.y-y)<42))continue;
  occupied.push({x,y});result.push({...p,x,y});if(result.length>=Math.max(6,Math.min(11,Math.floor(size.value.width/85))))break;
 }return result;
});
const number=(value:number|null)=>value===null?'未发布':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(value);
const regionIds=computed(()=>new Set(props.regions.map(region=>region.id)));
const maxProduction=computed(()=>Math.max(1,...props.regions.map(region=>region.production??0)));
const mapWidth=grainBounds.maxX-grainBounds.minX,mapHeight=grainBounds.maxZ-grainBounds.minZ,flatScale=Math.min(650/mapWidth,750/mapHeight);
const point=(lng:number,lat:number)=>{const [x,z]=grainProject(lng,lat);return {x:375+(x-(grainBounds.minX+grainBounds.maxX)/2)*flatScale,y:430+(z-(grainBounds.minZ+grainBounds.maxZ)/2)*flatScale};};
const paths=grainFeatures.map(feature=>({id:feature.properties.id,name:feature.properties.name,d:(feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates).map(polygon=>(polygon as number[][][]).map(ring=>ring.map((coord,index)=>{const projected=point(coord[0],coord[1]);return `${index?'L':'M'}${projected.x},${projected.y}`;}).join(' ')+' Z').join(' ')).join(' ')}));
const offsets:Record<string,[number,number]>={'230000':[60,-30],'220000':[65,-24],'210000':[58,24],'150700':[-65,-28],'152200':[-67,-23],'150500':[-65,-12],'150400':[-75,22]};
const labels=computed(()=>{
 const occupied:{x:number;y:number}[]=[],width=size.value.width,height=size.value.height;
 return anchors.value.filter(anchor=>anchor.visible).map(anchor=>{const region=props.regions.find(r=>r.id===anchor.id);if(!region)return null;const offset=offsets[anchor.id]||[30,-30];let x=Math.min(width-72,Math.max(72,anchor.x+offset[0])),y=Math.min(height-115,Math.max(153,anchor.y+offset[1]));let tries=0;
  while(occupied.some(other=>Math.abs(other.x-x)<135&&Math.abs(other.y-y)<51)&&tries++<8)y=Math.min(height-70,y+54);
  occupied.push({x,y});return {...anchor,region,x,y};
 }).filter((value):value is NonNullable<typeof value>=>!!value);
});
function flatAnchors(){const width=size.value.width,height=size.value.height,scale=Math.min(width/750,height/860),left=(width-750*scale)/2,top=(height-860*scale)/2;anchors.value=(heat.value?props.points.map(p=>({...p,id:'county:'+p.adcode})):props.regions).map(region=>{const p=point(region.lng,region.lat);return {id:region.id,x:left+p.x*scale,y:top+p.y*scale,visible:true};});}
function update(){engine?.setData(props.regions,props.selected);if(flat.value)flatAnchors();}
function updateSources(){if(!props.points.some(p=>p.adcode===selectedSource.value))selectedSource.value='';engine?.setSourcePoints(props.points);if(flat.value)flatAnchors();}
function reset(){selectedSource.value='';engine?.reset();if(flat.value)flatAnchors();}
function toggleHeat(){heat.value=!heat.value;engine?.setHeat(heat.value);if(flat.value)flatAnchors();}
function togglePaused(){localPaused.value=!localPaused.value;engine?.setPaused(effectivePaused.value);emit('pause',effectivePaused.value);}
function select(id:string){if(id.startsWith('county:')){selectedSource.value=id.slice(7);engine?.setSelectedSource(selectedSource.value);return;}if(regionIds.value.has(id))emit('select',id===props.selected?'':id);}
function keydown(event:KeyboardEvent){if(event.key==='Escape'){selectedSource.value='';emit('select','');}}
onMounted(()=>{
 observer=new ResizeObserver(()=>{const rect=stage.value?.getBoundingClientRect();if(rect)size.value={width:rect.width,height:rect.height};if(flat.value)flatAnchors();});if(stage.value)observer.observe(stage.value);
 try{engine=new GrainSourceMapEngine(host.value!,props.config,next=>{if(next.length!==anchors.value.length||next.some((anchor,index)=>anchor.id!==anchors.value[index]?.id||Math.abs(anchor.x-anchors.value[index].x)>.65||Math.abs(anchor.y-anchors.value[index].y)>.65||anchor.visible!==anchors.value[index].visible))anchors.value=next;},select,id=>hovered.value=id,state=>textureState.value=state);engine.setData(props.regions,props.selected);engine.setPaused(effectivePaused.value);}
 catch{engine?.destroy();engine=undefined;host.value?.replaceChildren();flat.value=true;flatAnchors();}updateSources();ready.value=true;
});
watch(()=>[props.regions,props.selected],update,{deep:true});
watch(()=>props.points,updateSources);
watch(selectedSource,id=>engine?.setSelectedSource(id));
watch(()=>props.config,config=>engine?.apply(config),{deep:true});
watch(effectivePaused,paused=>engine?.setPaused(paused));
onBeforeUnmount(()=>{engine?.destroy();observer?.disconnect();detailObserver?.disconnect();});
defineExpose({reset});
</script>

<template>
 <section ref="stage" class="gs-regional-map" :class="{'is-flat':flat,'is-paused':effectivePaused}" :data-ready="ready" :data-source-count="points.length" :data-heat="heat" aria-label="东三省与蒙东四盟市粮源分布" @keydown="keydown">
  <div ref="host" class="gs-regional-map__canvas" data-testid="grain-source-map"/>
  <svg v-if="flat" class="gs-regional-map__flat" viewBox="0 0 750 860" aria-label="东三省与蒙东四盟市二维统计地图">
   <defs><radialGradient id="grain-source-heat"><stop offset="0" stop-color="#ef941f" stop-opacity=".48"/><stop offset=".4" stop-color="#ffc458" stop-opacity=".27"/><stop offset="1" stop-color="#ffc458" stop-opacity="0"/></radialGradient></defs>
   <g class="gs-regional-map__flat-land"><path v-for="region in paths" :key="region.id" :d="region.d" :fill="region.id===selected?config.accent:config.mapColor" :fill-opacity="!regionIds.has(region.id)?.35:region.id===selected?.7:1" :stroke="config.mapEdge" :stroke-width="config.mapEdgeWidth" vector-effect="non-scaling-stroke" :role="regionIds.has(region.id)?'button':undefined" :tabindex="regionIds.has(region.id)?0:undefined" :aria-label="`查看${region.name}粮食统计`" :aria-pressed="region.id===selected" @click="select(region.id)" @keydown.enter="select(region.id)" @mouseenter="hovered=region.id" @mouseleave="hovered=''"/></g>
   <g v-if="!heat"><g v-for="region in regions" :key="region.id" :transform="`translate(${point(region.lng,region.lat).x},${point(region.lng,region.lat).y})`" aria-hidden="true"><circle v-if="region.production!==null" :r="30+50*Math.sqrt(region.production/maxProduction)" fill="url(#grain-source-heat)"/><circle r="5" fill="#f5a531" stroke="#fff8df" stroke-width="2"/><circle r="10" fill="none" stroke="#e19a36" stroke-opacity=".45"/></g></g>
   <g v-else><g v-for="p in points" :key="p.adcode" :transform="`translate(${point(p.lng,p.lat).x},${point(p.lng,p.lat).y})`" role="button" tabindex="0" :aria-label="`查看${p.name}粮源`" @click="select('county:'+p.adcode)" @keydown.enter="select('county:'+p.adcode)"><circle :r="p.level==='core'?18:11" :fill="p.level==='core'?'#f2552e':'#77d954'" fill-opacity=".25"/><circle :r="p.level==='core'?5:3" :fill="p.level==='core'?'#fff0a2':'#1cb9a0'" stroke="#ffe093" stroke-width="1"/></g></g>
  </svg>
  <div class="gs-regional-map__tools" aria-label="粮源地图工具">
   <button type="button" :class="{'is-active':heat}" :aria-pressed="heat" title="切换粮源集聚热力与区域产量" @click="toggleHeat"><Layers :size="16"/><span>{{heat?'粮源集聚':'区域产量'}}</span></button>
   <button type="button" :title="localPaused?'继续动效':'暂停动效'" :aria-label="localPaused?'继续地图动效':'暂停地图动效'" :aria-pressed="effectivePaused" @click="togglePaused"><Play v-if="localPaused" :size="16"/><Pause v-else :size="16"/></button>
   <button type="button" title="复位地图" aria-label="复位粮源地图" @click="reset"><RotateCcw :size="16"/></button>
  </div>
  <svg v-if="config.labels&&!heat" class="gs-regional-map__leaders" :viewBox="`0 0 ${size.width} ${size.height}`" aria-hidden="true"><path v-for="label in labels" :key="label.id" :d="`M${anchors.find(a=>a.id===label.id)?.x||0},${anchors.find(a=>a.id===label.id)?.y||0} L${label.x},${label.y}`" :class="{'is-selected':label.id===selected}"/></svg>
  <div v-if="config.labels&&!heat" class="gs-regional-map__labels">
   <button v-for="label in labels" :key="label.id" type="button" class="gs-grain-marker" :class="{'is-selected':label.id===selected,'is-hovered':label.id===hovered}" :style="{left:`${label.x}px`,top:`${label.y}px`}" :aria-label="`${label.region.name}，粮食产量${number(label.region.production)}${label.region.production===null?'':'万吨'}`" :aria-pressed="label.id===selected" @click="select(label.id)"><span>{{label.region.name}}</span><strong>{{number(label.region.production)}}<small v-if="label.region.production!==null">万吨</small></strong></button>
  </div>
  <div v-if="config.labels&&heat" class="gs-regional-map__labels">
   <button v-for="p in countyLabels" :key="p.adcode" class="gs-county-label" :class="{'is-selected':selectedSource===p.adcode}" :style="{left:`${p.x}px`,top:`${p.y}px`}" :aria-label="`查看${p.name}粮源`" @click="select('county:'+p.adcode)">{{p.name}}</button>
  </div>
  <div v-if="heat" class="gs-heat-legend"><span>粮源集聚 <i/> 低—高</span><span>当前 <b>{{points.length}}</b> 个粮源点</span><span>核心 <b>{{sourceCounts.core}}</b> · 重点 <b>{{sourceCounts.key}}</b></span></div>
  <div v-if="heat&&!points.length" class="gs-empty-sources" role="status">当前条件下暂无粮源点，可切换粮种或等级</div>
  <div v-if="heat&&sourceDetail&&detailPosition" ref="detailElement" class="gs-county-detail" :data-placement="detailPosition.placement" :style="{left:`${detailPosition.left}px`,top:`${detailPosition.top}px`,'--tip-left':`${detailPosition.tip}px`}" role="region" tabindex="-1" aria-label="县域粮源详情"><button aria-label="关闭粮源详情" @click="selectedSource=''"><X :size="14"/></button><strong>{{sourceDetail.name}}</strong><span>{{sourceDetail.province}} · {{sourceDetail.prefecture}} · {{sourceLevelName[sourceDetail.level]}}</span><p>{{sourceDetail.grainTypes.join(' / ')}}</p><small>县域行政中心 · 粮源目录分级</small></div>
  <div class="gs-regional-map__compass" aria-hidden="true"><span>北</span><Compass :size="28"/></div>
  <div v-if="!flat&&config.mapTexture" class="gs-regional-map__imagery" :data-texture-state="textureState">
   <a v-if="textureState==='ready'" href="https://www.amap.com/" target="_blank" rel="noopener noreferrer">© 高德地图 · 卫星影像</a>
   <span v-else role="status">{{textureState==='error'?'影像未能加载，刷新重试':'影像加载中…'}}</span>
  </div>
  <div v-if="!ready" class="gs-regional-map__loading" role="status">正在载入粮源地图…</div>
 </section>
</template>

<style scoped>
.gs-regional-map{position:relative;isolation:isolate;width:100%;height:100%;min-height:0;overflow:hidden;color:var(--cc-text,#5a4a42);background:transparent}
.gs-empty-sources{position:absolute;left:50%;bottom:132px;transform:translateX(-50%);z-index:4;padding:8px 12px;background:var(--cc-bg);border:1px solid var(--cc-border);color:var(--cc-muted);font-size:11px;white-space:nowrap}
.gs-regional-map__imagery{position:absolute;right:12px;bottom:64px;z-index:4;font-size:10px;color:var(--cc-muted,#807565)}.gs-regional-map__imagery a{color:inherit;text-decoration:none}.gs-regional-map__imagery a:hover{text-decoration:underline}
.gs-county-label{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;padding:5px 8px;border:1px solid #dbab54;border-radius:2px;background:rgba(38,43,30,.86);color:#fff5d8;font:600 11px/1.2 'Microsoft YaHei',sans-serif;white-space:nowrap;cursor:pointer;box-shadow:0 0 10px #c59d3c30}.gs-county-label.is-selected{background:#785321;border-color:#fff1a1}.gs-heat-legend{position:absolute;bottom:88px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:15px;padding:7px 12px;background:color-mix(in srgb,var(--cc-bg) 88%,transparent);border:1px solid var(--cc-border);font-size:10px;white-space:nowrap;z-index:4;color:var(--cc-muted)}.gs-heat-legend span{display:flex;align-items:center;gap:5px}.gs-heat-legend i{width:48px;height:5px;background:linear-gradient(90deg,#28d38b,#fae120,#ff8514,#f3271d)}.gs-heat-legend b{color:var(--cc-primary);font-size:13px}.gs-county-detail{position:absolute;z-index:7;display:grid;gap:7px;box-sizing:border-box;width:252px;max-width:calc(100% - 24px);padding:14px 28px 13px 14px;background:color-mix(in srgb,var(--cc-bg) 96%,transparent);border:1px solid var(--cc-primary);box-shadow:0 6px 24px #40341a20;color:var(--cc-text)}.gs-county-detail::after{content:"";position:absolute;left:var(--tip-left);width:10px;height:10px;background:var(--cc-bg);border-right:1px solid var(--cc-primary);border-bottom:1px solid var(--cc-primary);pointer-events:none}.gs-county-detail[data-placement="above"]::after{bottom:-6px;transform:translateX(-50%) rotate(45deg)}.gs-county-detail[data-placement="below"]::after{top:-6px;transform:translateX(-50%) rotate(225deg)}.gs-county-detail>button{position:absolute;right:4px;top:4px;border:0;background:transparent;color:var(--cc-muted);cursor:pointer}.gs-county-detail strong{font-size:17px}.gs-county-detail span,.gs-county-detail p{font-size:11px;margin:0}.gs-county-detail small{font-size:10px;color:var(--cc-muted)}
.gs-regional-map__canvas,.gs-regional-map__flat,.gs-regional-map__leaders,.gs-regional-map__labels{position:absolute;inset:0;width:100%;height:100%}.gs-regional-map__canvas :deep(canvas){display:block;width:100%;height:100%;outline:none;cursor:grab}.gs-regional-map__canvas :deep(canvas:active){cursor:grabbing}.gs-regional-map__flat{filter:drop-shadow(0 11px 0 rgba(255,255,255,.95)) drop-shadow(0 19px 13px rgba(112,84,30,.09))}.gs-regional-map__flat-land path{cursor:pointer;transition:fill .2s}.gs-regional-map__flat-land path:hover{fill:#f1c77e}
.gs-regional-map__tools{position:absolute;right:10px;top:95px;display:flex;gap:5px;z-index:6}.gs-regional-map__tools button{height:32px;padding:0 8px;display:inline-flex;align-items:center;gap:5px;border:1px solid color-mix(in srgb,var(--cc-primary,#d08330) 22%,transparent);border-radius:3px;background:color-mix(in srgb,var(--cc-bg,#fff5e8) 72%,transparent);color:var(--cc-muted,#9a7855);cursor:pointer;font:inherit;font-size:11px}.gs-regional-map__tools button:hover,.gs-regional-map__tools button.is-active{color:var(--cc-primary,#cb792d);border-color:color-mix(in srgb,var(--cc-primary,#d08330) 47%,transparent)}.gs-regional-map button:focus-visible,.gs-regional-map path:focus-visible{outline:2px solid var(--cc-primary,#d08330);outline-offset:3px}
.gs-regional-map__leaders,.gs-regional-map__labels{pointer-events:none;z-index:3}.gs-regional-map__leaders path{fill:none;stroke:#c79448;stroke-width:1;opacity:.45;stroke-dasharray:2 3}.gs-regional-map__leaders path.is-selected{stroke:var(--cc-primary,#cf752b);stroke-dasharray:none;opacity:.8}.gs-grain-marker{position:absolute;transform:translate(-50%,-50%);min-width:112px;max-width:142px;padding:7px 10px;display:flex;flex-direction:column;align-items:flex-start;gap:3px;border:1px solid rgba(195,148,74,.36);border-left:2px solid #d7963c;border-radius:2px;background:rgba(255,249,232,.84);color:#65513c;box-shadow:0 3px 10px rgba(111,82,27,.045);cursor:pointer;pointer-events:auto;text-align:left;white-space:nowrap;transition:border-color .2s,background .2s}.gs-grain-marker>span{font-size:12px;font-weight:600;line-height:1.2}.gs-grain-marker>strong{font-size:16px;font-weight:650;line-height:1.15;font-variant-numeric:tabular-nums;letter-spacing:-.02em;color:#a96625}.gs-grain-marker small{font-size:10px;font-weight:400;margin-left:4px;color:#967b5b}.gs-grain-marker.is-selected,.gs-grain-marker.is-hovered{background:#fff5d6;border-color:#d08b27;border-left-width:3px;box-shadow:0 4px 16px rgba(182,128,34,.12)}
.gs-regional-map__compass{position:absolute;right:25px;bottom:95px;display:flex;flex-direction:column;align-items:center;gap:3px;color:#b59464;opacity:.7;pointer-events:none}.gs-regional-map__compass>span{font-size:10px}.gs-regional-map__loading{position:absolute;inset:0;display:grid;place-items:center;background:rgba(255,249,235,.6);font-size:13px;color:#a0804b}
@media(min-width:2300px){.gs-grain-marker{min-width:140px;padding:10px 13px}.gs-grain-marker>span{font-size:15px}.gs-grain-marker>strong{font-size:21px}.gs-grain-marker small{font-size:12px}.gs-regional-map__tools button{height:36px;font-size:13px}}
@media(prefers-reduced-motion:reduce){.gs-regional-map *{transition:none!important}}
</style>


