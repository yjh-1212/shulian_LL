<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref} from 'vue';
import {Layers,Pause,Play,RotateCcw,X,MapPin} from 'lucide-vue-next';
import Icon from '../../../apps/web/src/components/Icon.vue';
import CockpitPanel from './CockpitPanel.vue';
import CockpitMap from './CockpitMap.vue';
import SouthSeaInset from './SouthSeaInset.vue';
import {overviewMetrics,transportModes,taskStates,regions,hubNodes,nodeConditions,alerts,summaryRoutes,summaryRegionColors,corridorReferences} from '../comprehensive-data';
import type {CockpitStyle} from '../theme';
import type {MapLabel} from '../map-engine';
import type {Asset,MapNode,MapSelection,Mode} from '../types';
import '../comprehensive.css';
const props=defineProps<{config:CockpitStyle;paused:boolean}>();
const map=ref<InstanceType<typeof CockpitMap>>(),area=ref<HTMLElement>();
const projected=ref<MapLabel[]>([]),selection=ref<MapSelection|null>(null),layersOpen=ref(false),motion=ref(true);
const modes=ref<Mode[]>(['RAIL','ROAD','WATER']),showSources=ref(true),showDestinations=ref(true),showHubs=ref(true);
const bounds=ref({left:400,right:1520,top:70,bottom:1060});let observer:ResizeObserver|undefined;
const emptyAssets:Asset[]=[];
const sceneConfig=computed(()=>({...props.config,flow:props.config.flow&&motion.value&&!props.paused,pulse:props.config.pulse&&motion.value&&!props.paused,edgeFlow:props.config.edgeFlow&&motion.value&&!props.paused,sweep:props.config.sweep&&motion.value&&!props.paused}));
const currentRegion=computed(()=>regions.find(r=>r.id===selection.value?.id));
const currentHub=computed(()=>hubNodes.find(n=>n.id===selection.value?.id));
const currentRoute=computed(()=>summaryRoutes.find(r=>r.id===selection.value?.id));
const selectedRegionIds=computed(()=>currentRegion.value?[currentRegion.value.id]:currentHub.value?.regionIds||[]);
const routes=computed(()=>summaryRoutes.filter(r=>modes.value.includes(r.mode)).map(r=>{
 const related=selection.value?.kind==='route'?r.id===selection.value.id:!selection.value||selectedRegionIds.value.some(id=>corridorReferences.find(s=>s.id===r.id)?.regionIds.includes(id));
 return {...r,selected:!!selection.value&&related,dimmed:!!selection.value&&!related};
}));
const mapNodes=computed<MapNode[]>(()=>[
 ...regions.filter(r=>r.role==='source'?showSources.value:showDestinations.value).map(r=>({id:r.id,name:r.name,lng:r.lng,lat:r.lat,role:r.role,kind:'region',selected:selection.value?.id===r.id})),
 ...(showHubs.value?hubNodes.map(n=>({...n,selected:selection.value?.id===n.id,role:'transfer' as const})):[])
]);
const regionColors=computed(()=>new Map([...summaryRegionColors].filter(([name])=>regions.some(r=>r.provinces.some(p=>p===name)&&(r.role==='source'?showSources.value:showDestinations.value)))));
const regionWeights=computed(()=>new Map(regions.flatMap(r=>r.provinces.map(name=>[name,r.volume] as [string,number]))));
const selectedProvince=computed(()=>selection.value?.kind==='region'?selection.value.id:currentRegion.value?.provinces[0]);
const cardWidth=computed(()=>Math.max(160,Math.min(226,(bounds.value.right-bounds.value.left)*.19)));
const cards=computed(()=>{
 const placed:{x:number;y:number;width:number;height:number}[]=[];
 return regions.filter(r=>(r.role==='source'?showSources.value:showDestinations.value)).flatMap(region=>{
  const anchor=projected.value.find(p=>p.id===region.id);if(!anchor?.visible)return [];
  const width=cardWidth.value,height=(bounds.value.right-bounds.value.left)>1000?86:78,scale=Math.min(1.2,(bounds.value.right-bounds.value.left)/1000);
  const offsets=[[region.dx*scale,region.dy*scale],[region.dx*scale-width-14,region.dy*scale],[region.dx*scale,region.dy*scale+82],[region.dx*scale-width-14,region.dy*scale+82],[region.dx*scale,-160],[region.dx*scale-width-14,-160],[region.dx*scale,165]];
  const candidates=offsets.map(([dx,dy])=>({x:Math.max(bounds.value.left+12,Math.min(bounds.value.right-width-14,anchor.x+dx)),y:Math.max(bounds.value.top+56,Math.min(bounds.value.bottom-height-56,anchor.y+dy)),width,height}));
  const overlap=(a:typeof placed[number],b:typeof placed[number])=>a.x<b.x+b.width+9&&a.x+a.width+9>b.x&&a.y<b.y+b.height+9&&a.y+a.height+9>b.y;
  const box=candidates.find(c=>!placed.some(p=>overlap(c,p)))||candidates.at(-1)!;placed.push(box);
  return [{region,...box,anchor,edgeX:Math.max(box.x,Math.min(box.x+width,anchor.x)),edgeY:Math.max(box.y,Math.min(box.y+height,anchor.y))}];
 });
});
const hubLabels=computed(()=>{
 if(!showHubs.value||!props.config.labels)return [];
 const placed:{x:number;y:number}[]=[];
 return projected.value.filter(p=>hubNodes.some(n=>n.id===p.id)&&p.visible&&p.x>bounds.value.left+8&&p.x<bounds.value.right-85&&p.y>bounds.value.top+65&&p.y<bounds.value.bottom-95).filter(p=>{
  if(cards.value.some(c=>p.x>c.x-50&&p.x<c.x+c.width+8&&p.y>c.y-17&&p.y<c.y+c.height+8)||placed.some(q=>Math.abs(p.x-q.x)<90&&Math.abs(p.y-q.y)<23))return false;
  placed.push(p);return true;
 });
});
const detailTitle=computed(()=>currentRegion.value?.name||currentHub.value?.name||currentRoute.value?.label||selection.value?.id||'');
const detailText=computed(()=>currentRegion.value?`${currentRegion.value.role==='source'?'南向供给':'计划接收'} ${number(currentRegion.value.volume)} 万吨 · 库存 ${number(currentRegion.value.stock)} 万吨`:currentHub.value?`${currentHub.value.kind==='port'?'港口枢纽':'运输节点'} · ${nodeConditions.find(n=>n.id===currentHub.value!.id)?.status||'运行正常'}`:currentRoute.value?`${transportModes.find(m=>m.mode===currentRoute.value!.mode)?.name} · ${currentRoute.value.points.length.toLocaleString()} 个地理折线点`:'全国粮食联运通道');
const formatTick=(v:number)=>`${v}%`;
function number(v:number){return v.toLocaleString('zh-CN',{maximumFractionDigits:1});}
function updateLabels(next:MapLabel[]){if(next.length!==projected.value.length||next.some((p,i)=>p.id!==projected.value[i]?.id||p.visible!==projected.value[i]?.visible||Math.abs(p.x-projected.value[i].x)>.8||Math.abs(p.y-projected.value[i].y)>.8))projected.value=next;}
function toggleMode(mode:Mode){modes.value=modes.value.includes(mode)?modes.value.filter(m=>m!==mode):[...modes.value,mode];}
function choose(value:MapSelection|null){selection.value=selection.value?.kind===value?.kind&&selection.value?.id===value?.id?null:value;}
function reset(){selection.value=null;layersOpen.value=false;modes.value=['RAIL','ROAD','WATER'];showSources.value=true;showDestinations.value=true;showHubs.value=true;map.value?.reset();}
function focus(){const points=currentRegion.value?[currentRegion.value]:currentHub.value?[currentHub.value]:currentRoute.value?.points||[];map.value?.focus(points);}
function escape(e:KeyboardEvent){if(e.key==='Escape'){if(layersOpen.value)layersOpen.value=false;else selection.value=null;}}
onMounted(()=>{observer=new ResizeObserver(()=>{const b=area.value?.getBoundingClientRect();if(b)bounds.value={left:b.left,right:b.right,top:b.top,bottom:b.bottom};});if(area.value)observer.observe(area.value);window.addEventListener('keydown',escape);});
onBeforeUnmount(()=>{observer?.disconnect();window.removeEventListener('keydown',escape);});
defineExpose({reset});
</script>

<template>
 <main class="cc-grid cc-comp-grid" aria-label="综合驾驶舱">
  <aside class="cc-side cc-left">
   <CockpitPanel class="cc-comp-overview-panel" title="通道总体态势" icon="dashboard" subtitle="核心指标">
    <div class="cc-comp-metrics"><div v-for="metric in overviewMetrics" :key="metric.name" class="cc-comp-metric" :data-color="metric.color"><span class="cc-comp-metric-icon"><Icon :name="metric.icon" :size="21"/></span><div><span>{{metric.name}}</span><p><strong>{{metric.value}}</strong><small>{{metric.unit}}</small></p><em>{{metric.change}}</em></div></div></div>
    <div class="cc-comp-overview-foot"><span><i/>北方粮仓 · 南方市场</span><strong>8<small>条主要通道</small></strong></div>
   </CockpitPanel>
   <CockpitPanel class="cc-comp-modes-panel" title="今日运行概况" icon="chart" subtitle="发运结构">
    <div class="cc-comp-mode-list"><button v-for="mode in transportModes" :key="mode.mode" class="cc-comp-mode-row" :style="{'--mode-color':mode.color}" :class="{'is-hidden':!modes.includes(mode.mode)}" :aria-pressed="modes.includes(mode.mode)" :aria-label="`切换${mode.name}线路`" @click="toggleMode(mode.mode)"><span class="cc-comp-mode-icon"><Icon :name="mode.icon" :size="20"/></span><div><div><strong>{{mode.name}}</strong><b>{{mode.share.toFixed(1)}}<small>%</small></b></div><p>{{mode.volume.toFixed(1)}} 万吨<span>运行正常</span></p><span class="cc-comp-meter"><i :style="{width:formatTick(mode.share)}"/></span></div></button></div>
    <div class="cc-comp-transfer"><Icon name="network" :size="19"/><span>铁水联运<strong>8.6<small>万吨</small></strong></span><em>较昨日 +5.2%<Icon name="up" :size="12"/></em></div>
   </CockpitPanel>
   <CockpitPanel title="运输任务执行" icon="package" subtitle="今日计划 138 批">
    <div class="cc-comp-tasks"><figure class="cc-comp-task-ring" aria-label="任务完成率42%，58批已完成"><svg viewBox="0 0 180 180" role="img"><defs><linearGradient id="comp-task-gradient"><stop stop-color="#5a83ff"/><stop offset="1" stop-color="#4dd3c2"/></linearGradient></defs><circle class="cc-comp-ring-orbit" cx="90" cy="90" r="76"/><circle class="cc-comp-ring-base" cx="90" cy="90" r="62"/><circle class="cc-comp-ring-progress" cx="90" cy="90" r="62" pathLength="100" stroke="url(#comp-task-gradient)" stroke-dasharray="42 100"/><text x="90" y="91" class="cc-comp-ring-number">42<tspan>%</tspan></text><text x="90" y="116" class="cc-comp-ring-label">任务完成率</text></svg><figcaption><span>计划兑现</span><strong>有序推进</strong></figcaption></figure><div class="cc-comp-task-states"><div v-for="state in taskStates" :key="state.name" :style="{'--state-color':state.color}"><span><i/>{{state.name}}</span><strong>{{state.value}}<small>批</small></strong></div></div></div>
   </CockpitPanel>
  </aside>

  <section ref="area" class="cc-map-section cc-comp-map" aria-label="北粮南运全国通道地图">
   <CockpitMap ref="map" :style-config="sceneConfig" :routes="routes" :nodes="mapNodes" :assets="emptyAssets" :replay-at="null" :regions="regionWeights" :region-colors="regionColors" :selected-region="selectedProvince" variant="comprehensive" :native-labels="false" @labels="updateLabels" @select="choose"/>
   <div class="cc-comp-map-tools"><button class="cc-comp-tool" :aria-expanded="layersOpen" aria-controls="comprehensive-layers" @click="layersOpen=!layersOpen"><Layers :size="15"/>图层</button><span class="cc-comp-map-caption">全国粮食物流通道 · 万吨</span><div><button class="cc-icon-button" :aria-label="motion?'暂停地图动效':'继续地图动效'" :aria-pressed="motion" @click="motion=!motion"><component :is="motion?Pause:Play" :size="16"/></button><button class="cc-icon-button" aria-label="重置综合驾驶舱地图" @click="reset"><RotateCcw :size="16"/></button></div></div>
   <div v-if="layersOpen" id="comprehensive-layers" class="cc-comp-layers"><header><strong>地图图层</strong><button class="cc-icon-button" aria-label="关闭地图图层" @click="layersOpen=false"><X :size="14"/></button></header><label><input v-model="showSources" type="checkbox"/>北方粮源区</label><label><input v-model="showDestinations" type="checkbox"/>南方接收区</label><label><input v-model="showHubs" type="checkbox"/>运输枢纽节点</label><label v-for="mode in transportModes" :key="mode.mode"><input type="checkbox" :checked="modes.includes(mode.mode)" @change="toggleMode(mode.mode)"/>{{mode.name}}</label><footer><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a><a href="https://github.com/genthalili/searoute-py" target="_blank" rel="noopener noreferrer">Marnet / SeaRoute</a></footer></div>
   <svg class="cc-comp-connectors" aria-hidden="true"><line v-for="card in cards" :key="card.region.id" :x1="card.anchor.x" :y1="card.anchor.y" :x2="card.edgeX" :y2="card.edgeY" :class="card.region.role"/></svg>
   <button v-for="card in cards" :key="card.region.id" class="cc-comp-region" :class="[card.region.role,{'is-selected':selection?.id===card.region.id}]" :style="{left:card.x+'px',top:card.y+'px',width:card.width+'px',height:card.height+'px'}" :aria-label="`查看${card.region.name}粮食${card.region.role==='source'?'发运':'接收'}统计`" :aria-pressed="selection?.id===card.region.id" @click="choose({kind:'node',id:card.region.id})"><header><strong>{{card.region.name}}</strong><small>{{card.region.role==='source'?'粮源区':'接收区'}}</small></header><p v-if="card.region.role==='source'">产量 <b>{{number(card.region.production)}}</b><span>南向 <b>{{number(card.region.volume)}}</b></span></p><p v-else>接收 <b>{{number(card.region.volume)}}</b><span>库存 <b>{{number(card.region.stock)}}</b></span></p><footer>{{card.region.role==='source'?`库存 ${number(card.region.stock)} 万吨`:`在途 ${card.region.transit} 批`}}</footer></button>
   <button v-for="label in hubLabels" :key="label.id" class="cc-comp-hub-label" :class="{'is-selected':selection?.id===label.id}" :style="{left:label.x+'px',top:label.y+'px'}" :aria-label="`查看节点 ${label.name}`" @click="choose({kind:'node',id:label.id})">{{label.name}}</button>
   <div v-if="selection" class="cc-comp-selection" role="status"><MapPin :size="17"/><div><strong>{{detailTitle}}</strong><p>{{detailText}}</p></div><button class="cc-button" @click="focus">聚焦</button><button class="cc-icon-button" aria-label="关闭地图选中内容" @click="selection=null"><X :size="14"/></button></div>
   <div class="cc-comp-legend" aria-label="综合驾驶舱地图图例"><span><i class="source"/>主产区</span><span><i class="target"/>主销区</span><button v-for="mode in transportModes" :key="mode.mode" :class="{'is-hidden':!modes.includes(mode.mode)}" :aria-pressed="modes.includes(mode.mode)" :aria-label="`地图显示${mode.name}`" @click="toggleMode(mode.mode)"><i :class="mode.mode.toLowerCase()" :style="{color:mode.color}"/>{{mode.name}}</button></div>
   <SouthSeaInset :style-config="config"/>
  </section>

  <aside class="cc-side cc-right">
   <CockpitPanel class="cc-comp-efficiency-panel" title="通道运行态势" icon="route" subtitle="通道效率">
    <div class="cc-comp-efficiency"><div v-for="mode in transportModes" :key="mode.mode" :style="{'--mode-color':mode.color}"><div class="cc-comp-efficiency-ring"><svg viewBox="0 0 100 100" :aria-label="`${mode.name}准点率${mode.efficiency}%`" role="img"><circle cx="50" cy="50" r="41" class="cc-comp-ring-base"/><circle cx="50" cy="50" r="41" pathLength="100" :stroke-dasharray="`${mode.efficiency} 100`" class="cc-comp-efficiency-progress"/></svg><span>{{mode.efficiency}}<small>%</small></span></div><strong>{{mode.name}}</strong><small>{{mode.mode==='WATER'?'准班率':'准点率'}}</small><em><i/>运行正常</em></div></div>
    <div class="cc-comp-efficiency-foot"><span>今日发运 <strong>63.4<small>万吨</small></strong></span><span>今日到达 <strong>61.2<small>万吨</small></strong></span></div>
   </CockpitPanel>
   <CockpitPanel title="重点节点态势" icon="network" subtitle="需关注 2 处"><div class="cc-comp-node-list"><button v-for="node in nodeConditions" :key="node.id" :class="{'is-warning':node.warning,'is-selected':selection?.id===node.id}" :aria-label="`查看${node.name}运行态势`" @click="choose({kind:'node',id:node.id})"><span><i/>{{node.name}}</span><span class="cc-comp-node-meter"><i :style="{width:node.value+'%'}"/></span><strong>{{node.status}}<small>{{node.value}}%</small></strong></button></div></CockpitPanel>
   <CockpitPanel title="今日预警" icon="warning" subtitle="2 项重要 · 2 项关注"><div class="cc-comp-alerts"><button v-for="alert in alerts" :key="alert.id" :class="{'is-important':alert.level==='重要','is-selected':selection?.id===alert.nodeId}" :aria-label="`查看预警：${alert.title}`" @click="choose({kind:'node',id:alert.nodeId})"><i/><div><strong>{{alert.title}}</strong><p>{{alert.detail}}</p></div><span>{{alert.level}}</span></button></div></CockpitPanel>
  </aside>
 </main>
</template>
