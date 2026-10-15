<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref,watch,nextTick} from 'vue';
import {Search,Play,Pause,RotateCcw,Truck,TrainFront,Ship,Check,ArrowRight,Focus,LocateFixed,Globe2,AlertTriangle} from 'lucide-vue-next';
import CockpitPanel from './CockpitPanel.vue';
import CockpitMap from './CockpitMap.vue';
import SouthSeaInset from './SouthSeaInset.vue';
import TransportModel from './TransportModel.vue';
import {channelTasks,modeName,overallProgress,taskState,stageTime,stagePoint,preparedRoute,pointAlong} from '../channel-data';
import type {ChannelTask} from '../channel-data';
import type {CockpitStyle} from '../theme';
import type {Mode,MapNode,MapRoute,MapSelection,PlaybackFrame,Asset} from '../types';
import '../channel.css';
const props=defineProps<{config:CockpitStyle;paused:boolean}>();
const query=ref(''),filter=ref('all'),mode=ref<Mode|'all'>('all'),scope=ref('all'),selected=ref(channelTasks[0].id),stageIndex=ref(channelTasks[0].current),cameraMode=ref('global');
const map=ref<InstanceType<typeof CockpitMap>>(),playing=ref(false),progress=ref(channelTasks[0].progress);let timer:number;const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
const emptyAssets:Asset[]=[],task=computed(()=>channelTasks.find(t=>t.id===selected.value)!),stage=computed(()=>task.value.stages[stageIndex.value]);
const color=(m:Mode)=>m==='ROAD'?props.config.roadColor:m==='RAIL'?props.config.railColor:props.config.waterColor;
const icon=(m:Mode)=>m==='ROAD'?Truck:m==='RAIL'?TrainFront:Ship;
const filtered=computed(()=>channelTasks.filter(t=>(filter.value==='all'||filter.value==='attention'?filter.value!=='attention'||!!t.attention:taskState(t)===filter.value)&&(mode.value==='all'||t.stages[t.current].mode===mode.value)&&`${t.id}${t.from}${t.to}${t.grain}`.includes(query.value.trim())));
const totalTons=computed(()=>channelTasks.reduce((s,t)=>s+t.tons,0));
const summary=computed(()=>[{name:'运行中',value:channelTasks.filter(t=>taskState(t)==='running').length,unit:'批',icon:TrainFront},{name:'待发运',value:channelTasks.filter(t=>taskState(t)==='waiting').length,unit:'批',icon:Truck},{name:'已交付',value:channelTasks.filter(t=>taskState(t)==='done').length,unit:'批',icon:Check},{name:'运输规模',value:(totalTons.value/10000).toFixed(2),unit:'万吨',icon:Ship}]);
const modeStats=computed(()=>(['ROAD','RAIL','WATER'] as Mode[]).map(m=>{const rows=channelTasks.filter(t=>t.stages[t.current].mode===m&&taskState(t)==='running');return {mode:m,count:rows.length,tons:rows.reduce((s,t)=>s+t.tons,0)};}));
const routes=computed<MapRoute[]>(()=>{
 if(!filtered.value.length)return [];
 const unique=new Map<string,MapRoute>();for(const t of (scope.value==='current'?[task.value]:filtered.value)){for(const [i,s] of t.stages.entries()){if(!s.route||(mode.value!=='all'&&s.route.mode!==mode.value))continue;if(unique.has(s.route.id)&&t.id!==selected.value)continue;unique.set(s.route.id,{...s.route,id:`${t.id}:${i}`,businessId:t.id,selected:t.id===selected.value&&i===stageIndex.value,dimmed:t.id!==selected.value,label:`${t.from} → ${t.to} · ${s.name}`});}}
 return [...unique.values()].sort((a,b)=>Number(a.selected)-Number(b.selected));
});
const nodes=computed<MapNode[]>(()=>{
 if(!filtered.value.length)return [];
 const result:MapNode[]=[];for(const t of (scope.value==='current'?[task.value]:filtered.value))for(const [i,s] of t.stages.entries()){if(!s.route)continue;for(const [j,p] of [s.route.points[0],s.route.points.at(-1)!].entries()){const name=s.place.split(' → ')[j]||s.place;if(result.some(n=>n.name===name))continue;result.push({...p,id:`${t.id}:${i}:${j}`,name,kind:s.mode==='WATER'?'port':'rail',businessId:t.id,role:j?'target':'source',selected:t.id===selected.value});}}return result;
});
const path=computed(()=>preparedRoute(stage.value));
const frame=computed<PlaybackFrame>(()=>{const sample=stage.value.route?pointAlong(path.value,progress.value):{point:stagePoint(task.value,stageIndex.value),heading:0};return {...sample,mode:stage.value.mode,segmentId:`${task.value.id}:${stageIndex.value}`,phase:stage.value.route?'moving':'handoff',label:stage.value.place,percent:progress.value*100};});
const sceneConfig=computed(()=>({...props.config,flow:props.config.flow&&!props.paused,pulse:props.config.pulse&&!props.paused,edgeFlow:props.config.edgeFlow&&!props.paused,labelLimit:10}));
const nextStage=computed(()=>task.value.stages[stageIndex.value+1]);
const remaining=computed(()=>Math.max(0,path.value.length*(1-progress.value)/1000));
const status=(index:number)=>index<task.value.current?'已完成':index===task.value.current?(taskState(task.value)==='done'?'已完成':taskState(task.value)==='waiting'?'待发运':'进行中'):'待衔接';
const number=(v:number)=>v.toLocaleString('zh-CN',{maximumFractionDigits:1});
const completion=computed(()=>Math.round(channelTasks.filter(t=>taskState(t)==='done').length/channelTasks.length*100));
function choose(t:ChannelTask){selected.value=t.id;stageIndex.value=t.current;progress.value=t.progress;playing.value=false;void nextTick(()=>viewCamera(cameraMode.value));}
function chooseStage(index:number){if(mode.value!=='all'&&task.value.stages[index].mode!==mode.value)mode.value='all';stageIndex.value=index;progress.value=index<task.value.current?1:index===task.value.current?task.value.progress:0;playing.value=false;void nextTick(()=>viewCamera(cameraMode.value));}
function selectMap(s:MapSelection|null){if(!s||s.kind==='region')return;const parts=s.id.split(':'),t=channelTasks.find(t=>t.id===parts[0]);if(t){choose(t);chooseStage(Number(parts[1]));}}
function viewCamera(value:string){cameraMode.value=value;map.value?.follow(false);if(value==='global')map.value?.reset();else if(value==='follow')map.value?.follow(true);else map.value?.focus(stage.value.route?.points||[stagePoint(task.value,stageIndex.value)]);}
function reset(){query.value='';filter.value='all';mode.value='all';scope.value='all';cameraMode.value='global';choose(channelTasks[0]);map.value?.reset();}
function togglePlayback(){if(progress.value>=1)progress.value=0;playing.value=!playing.value;}
watch(filtered,list=>{if(list.length&&!list.some(t=>t.id===selected.value))choose(list[0]);});
watch(()=>props.paused,value=>{if(value)playing.value=false;});
onMounted(()=>{timer=window.setInterval(()=>{if(!playing.value||props.paused||document.hidden)return;progress.value=Math.min(1,progress.value+.001);if(progress.value>=1)playing.value=false;},100);});
onBeforeUnmount(()=>clearInterval(timer));defineExpose({reset});
</script>
<template>
 <main class="cc-grid ch-grid" aria-label="通道运行驾驶舱">
  <aside class="cc-side ch-left">
   <CockpitPanel title="运行任务概况" icon="dashboard" subtitle="重点任务"><div class="ch-kpis"><div v-for="item in summary" :key="item.name"><component :is="item.icon" :size="19"/><span>{{item.name}}<strong>{{item.value}}<small>{{item.unit}}</small></strong></span></div></div></CockpitPanel>
   <CockpitPanel title="当前运输任务" icon="route" :subtitle="`${filtered.length} / ${channelTasks.length} 批`"><div class="ch-task-area"><div class="ch-tabs"><button v-for="f in [['all','全部'],['running','运行中'],['attention','需关注']]" :key="f[0]" :class="{active:filter===f[0]}" @click="filter=f[0]">{{f[1]}}</button></div><label class="ch-search"><Search :size="14"/><input v-model="query" aria-label="搜索运输任务" placeholder="任务号 / 起讫地 / 粮种"/><button v-if="query" aria-label="清空任务搜索" @click="query=''">×</button></label><div class="ch-task-list"><button v-for="t in filtered" :key="t.id" class="ch-task" :class="{selected:selected===t.id}" :aria-pressed="selected===t.id" :aria-label="`选择任务 ${t.from}至${t.to} ${t.id}`" @click="choose(t)"><header><strong>{{t.from}} <ArrowRight :size="12"/> {{t.to}}</strong><small>{{t.id.slice(-3)}}</small></header><p>{{t.grain}} · {{number(t.tons)}} 吨 <span>{{overallProgress(t)}}%</span></p><div class="ch-track"><i :style="{width:overallProgress(t)+'%'}"/></div><footer><span>{{t.stages[t.current].name}}</span><b :class="{warn:t.attention}">{{t.attention?'需关注':taskState(t)==='done'?'已交付':taskState(t)==='waiting'?'待发运':'正常'}}</b></footer></button><div v-if="!filtered.length" class="ch-empty">没有符合条件的任务<button @click="reset">重置筛选</button></div></div></div></CockpitPanel>
   <CockpitPanel title="计划执行与衔接" icon="network" subtitle="任务口径"><div class="ch-execution"><div class="ch-dial" :style="{'--progress':completion*3.6+'deg'}"><strong>{{completion}}<small>%</small></strong><span>交付完成率</span></div><div><p>重点任务 <b>{{channelTasks.length}} 批</b></p><p>需要关注 <b class="warn">{{channelTasks.filter(t=>t.attention).length}} 批</b></p><p>衔接保障 <b>舱位 / 车皮</b></p></div></div></CockpitPanel>
  </aside>
  <section class="cc-map-section ch-map" aria-label="粮食运输通道地图">
   <CockpitMap ref="map" variant="channel" :native-labels="true" :style-config="sceneConfig" :routes="routes" :nodes="nodes" :assets="emptyAssets" :frame="filtered.length?frame:null" :replay-at="null" @select="selectMap" @interact="cameraMode='stage';map?.follow(false)"/>
   <div class="ch-map-top"><div><span class="ch-eyebrow">北粮南运 · 全程协同</span><h2>{{task.from}} <ArrowRight :size="20"/> {{task.to}}</h2><p>{{task.grain}} · {{number(task.tons)}} 吨 · {{task.id}}</p></div><div class="ch-map-filters"><div class="ch-tabs"><button v-for="s in [['all','全部任务'],['current','当前任务']]" :key="s[0]" :class="{active:scope===s[0]}" @click="scope=s[0]">{{s[1]}}</button></div><div class="ch-tabs"><button :class="{active:mode==='all'}" @click="mode='all'">全部方式</button><button v-for="m in (['RAIL','ROAD','WATER'] as Mode[])" :key="m" :class="{active:mode===m}" @click="mode=m">{{m==='RAIL'?'铁路':m==='ROAD'?'公路':'海运'}}</button></div></div></div>
   <div v-if="!filtered.length" class="ch-map-empty" role="status">当前筛选无运输任务</div>
   <div class="ch-map-controls"><div class="ch-route-legend"><span v-for="m in (['RAIL','ROAD','WATER'] as Mode[])" :key="m"><i :style="{background:color(m)}"/>{{modeName[m]}}</span></div><div class="ch-tabs"><button :class="{active:cameraMode==='global'}" @click="viewCamera('global')"><Globe2 :size="13"/>全局</button><button :class="{active:cameraMode==='stage'}" @click="viewCamera('stage')"><Focus :size="13"/>环节</button><button :class="{active:cameraMode==='follow'}" @click="viewCamera('follow')"><LocateFixed :size="13"/>跟随载具</button></div></div>
   <div class="ch-timeline"><header><strong>当前任务 · 多式联运全程</strong><span>{{task.stages.filter((_,i)=>i<task.current).length}} / {{task.stages.length}} 个环节完成</span></header><div class="ch-stages"><button v-for="(s,i) in task.stages" :key="s.name" :class="{selected:stageIndex===i,done:i<task.current,current:i===task.current}" :aria-pressed="stageIndex===i" :aria-label="`查看环节 ${s.name}`" @click="chooseStage(i)"><span class="ch-stage-icon"><Check v-if="i<task.current" :size="16"/><component :is="icon(s.mode)" v-else :size="16"/></span><strong>{{s.name}}</strong><small>{{status(i)}}</small></button></div><div class="ch-playback"><button :disabled="!stage.route" :aria-label="playing?'暂停路线回放':'播放路线回放'" @click="togglePlayback"><Pause v-if="playing" :size="14"/><Play v-else :size="14"/></button><span>{{stage.route?'路线回放':'节点作业'}}</span><input v-model.number="progress" :disabled="!stage.route" type="range" min="0" max="1" step=".001" aria-label="路线回放进度" @input="playing=false"/><b>{{Math.round(progress*100)}}%</b><button aria-label="恢复当前任务进度" @click="chooseStage(task.current)"><RotateCcw :size="14"/></button></div></div>
   <SouthSeaInset :style-config="config"/>
  </section>
  <aside class="cc-side ch-right">
   <CockpitPanel title="多式联运运行概览" icon="chart" subtitle="当前运行任务"><div class="ch-modes"><button v-for="row in modeStats" :key="row.mode" :style="{'--mode':color(row.mode)}" @click="mode=mode===row.mode?'all':row.mode"><component :is="icon(row.mode)" :size="22"/><div><header><strong>{{modeName[row.mode]}}</strong><span>{{row.count}} 批</span></header><p><b>{{number(row.tons)}}</b> 吨 <span>在途 / 作业</span></p><div class="ch-track"><i :style="{width:Math.max(3,row.tons/totalTons*100)+'%'}"/></div></div></button></div></CockpitPanel>
   <CockpitPanel title="运输环节详情" icon="package" :subtitle="status(stageIndex)"><div class="ch-detail"><div class="ch-detail-title"><strong>{{stage.name}}</strong><span>{{stage.place}}</span></div><div class="ch-model-wrap"><TransportModel :mode="stage.mode" :color="color(stage.mode)" :paused="paused||reduce.matches"/><span>拖动旋转载具</span></div><div class="ch-facts"><div><span>承运资源</span><b>{{stage.resource}}</b></div><div><span>运量 / 能力</span><b>{{stage.capacity}}</b></div><div><span>计划完成</span><b>{{stageTime(task,stageIndex)}}</b></div><div><span>{{stage.route?'线路里程':'作业窗口'}}</span><b>{{stage.route?number(path.length/1000)+' km':stage.hours+' 小时'}}</b></div></div><div v-if="stage.route" class="ch-route-progress"><span>回放位置剩余里程</span><strong>{{number(remaining)}}<small> km</small></strong></div><div v-if="task.attention" class="ch-warning"><AlertTriangle :size="14"/>{{task.attention}}</div></div></CockpitPanel>
   <CockpitPanel title="下一节点协同" icon="network" :subtitle="nextStage?'衔接准备':'交付闭环'"><div class="ch-handoff"><div><span>当前环节</span><strong>{{stage.name}}</strong></div><ArrowRight :size="20"/><div><span>{{nextStage?'下一环节':'最终节点'}}</span><strong>{{nextStage?.name||'完成签收'}}</strong></div></div><div class="ch-next"><p><span>作业节点</span><b>{{nextStage?.place||stage.place}}</b></p><p><span>计划完成</span><b>{{stageTime(task,Math.min(stageIndex+1,task.stages.length-1))}}</b></p><p><span>协同状态</span><b :class="{warn:task.attention}">{{task.attention?'需确认作业窗口':nextStage?'运力与接卸计划已衔接':'计量与签收归档'}}</b></p></div></CockpitPanel>
  </aside>
 </main>
</template>
