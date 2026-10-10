<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref,watch} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {Maximize,Minimize,Settings2,RefreshCw,ArrowLeft,RotateCcw,ShieldCheck,X} from 'lucide-vue-next';
import {api,message} from '../../apps/web/src/api';
import CockpitPanel from './components/CockpitPanel.vue';
import BusinessScalePanel from './components/BusinessScalePanel.vue';
import PlatformOperationsPanels from './components/PlatformOperationsPanels.vue';
import StatisticsChart from './components/StatisticsChart.vue';
import MapExplorer from './components/MapExplorer.vue';
import SouthSeaInset from './components/SouthSeaInset.vue';
import StyleSettings from './components/StyleSettings.vue';
import {useCockpitStyles,styleVariables,type CockpitStyle} from './theme';
import {displayStatistics} from './display-data';
import type {View,Overview,ChartSelection} from './types';
import './cockpit.css';
import './map-interactions.css';
const route=useRoute(),router=useRouter();
const view=ref<View>(route.query.view==='chain'?'chain':'platform');
const period=ref('all'),grain=ref('all'),overview=ref<Overview|null>(null),loading=ref(true),error=ref('');
const styles=useCockpitStyles(view),config=styles.current,settingsOpen=ref(false),clock=ref(new Date()),full=ref(false),map=ref<InstanceType<typeof MapExplorer>>();
const chartSelection=ref<ChartSelection|null>(null),mapScope=ref<Record<string,string>>({}),scopeLabel=ref('');
let overviewAbort:AbortController|undefined,generation=0,clockTimer:number,refreshTimer:number;
const vars=computed(()=>styleVariables(config.value));
const stats=computed(()=>overview.value?displayStatistics(overview.value):null);
const businesses=computed(()=>overview.value?.businesses||[]);
const clockText=computed(()=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(clock.value));
const coordinationGroups=computed(()=>overview.value?.demandGroups.filter(row=>row.value>0)||[]);
function highlight(value:ChartSelection){if(value.dimension==='grain'){grain.value=grain.value===value.value?'all':value.value;chartSelection.value=null;}else chartSelection.value=chartSelection.value?.dimension===value.dimension&&chartSelection.value?.value===value.value&&chartSelection.value?.grain===value.grain?null:value;}
function setScope(value:Record<string,string>,label:string){mapScope.value=value;scopeLabel.value=label;chartSelection.value=null;void loadOverview();}
function clearScope(){mapScope.value={};scopeLabel.value='';chartSelection.value=null;map.value?.reset();void loadOverview();}
async function loadOverview(){const current=++generation;overviewAbort?.abort();overviewAbort=new AbortController();loading.value=true;error.value='';try{const response=await api.get('/cockpit/overview',{params:{period:period.value,grain:grain.value==='all'?undefined:grain.value,...mapScope.value},signal:overviewAbort.signal});if(current===generation)overview.value=response.data.data;}catch(e:any){if(current===generation&&e.code!=='ERR_CANCELED')error.value=message(e);}finally{if(current===generation)loading.value=false;}}
function editStyle(){styles.begin();settingsOpen.value=true;}
async function saveStyle(both:boolean){if(await styles.save(both))settingsOpen.value=false;}
function changeStyle(style:CockpitStyle){styles.draft.value=style;}
async function toggleFull(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{error.value='浏览器未允许全屏，请使用浏览器全屏快捷键';}}
function fullscreenChanged(){full.value=!!document.fullscreenElement;}
watch([period,grain],()=>{chartSelection.value=null;void loadOverview();});
watch(view,()=>{settingsOpen.value=false;chartSelection.value=null;void router.replace({path:'/cockpit',query:{view:view.value}});});
watch(()=>route.query.view,value=>{if(value==='chain'||value==='platform')view.value=value;});
watch(settingsOpen,value=>{if(!value)styles.cancel();});
onMounted(()=>{void loadOverview();clockTimer=window.setInterval(()=>clock.value=new Date(),1000);refreshTimer=window.setInterval(()=>{if(!document.hidden&&!settingsOpen.value)void loadOverview();},60000);document.addEventListener('fullscreenchange',fullscreenChanged);});
onBeforeUnmount(()=>{overviewAbort?.abort();clearInterval(clockTimer);clearInterval(refreshTimer);document.removeEventListener('fullscreenchange',fullscreenChanged);});
</script>

<template>
 <div class="cc-root cc-statistical" :style="vars" :data-theme="config.theme" :data-view="view">
  <header class="cc-header">
   <el-tabs v-model="view" class="cc-view-tabs" aria-label="驾驶舱切换"><el-tab-pane label="平台运营" name="platform"/><el-tab-pane label="一粮一链" name="chain"/></el-tabs>
   <div class="cc-header-actions"><time>{{clockText}}</time><button class="cc-icon-button" aria-label="刷新数据" :disabled="loading" @click="loadOverview"><RefreshCw :size="18" :class="{'cc-spin':loading}"/></button><button class="cc-icon-button" aria-label="大屏风格设置" @click="editStyle"><Settings2 :size="18"/></button><button class="cc-icon-button cc-fullscreen" :aria-label="full?'退出全屏':'进入全屏'" @click="toggleFull"><component :is="full?Minimize:Maximize" :size="18"/></button><router-link to="/" class="cc-return"><ArrowLeft :size="15"/>首页</router-link></div>
  </header>
  <div v-if="error" class="cc-error" role="alert">{{overview?'刷新失败，保留上次加载的数据：':''}}{{error}}<button class="cc-button" @click="loadOverview">重试</button></div>
  <div v-if="styles.syncError.value" class="cc-error" role="alert">{{styles.syncError.value}}<button class="cc-button" @click="styles.refresh">重试同步</button></div>
  <main v-if="overview&&stats" class="cc-grid" :aria-busy="loading">
   <aside class="cc-side cc-left">
    <template v-if="view==='platform'">
     <BusinessScalePanel :statistics="stats" :config="config"/>
     <CockpitPanel title="多式联运结构" icon="route" subtitle="计划运输量"><StatisticsChart kind="bars" title="运输方式组合与计划运输量" :config="config" :items="stats.modeVolumes" unit="tons" interaction="mode" @select="highlight"/></CockpitPanel>
     <CockpitPanel class="cc-coordination-panel" title="供需协同情况" icon="handshake" subtitle="单"><StatisticsChart kind="donut" donut-layout="expanded" title="需求匹配状态结构" :config="config" :items="coordinationGroups"/></CockpitPanel>
    </template>
    <template v-else>
     <CockpitPanel class="cc-grain-structure-panel" title="粮种运输结构" icon="grain" subtitle="吨"><StatisticsChart kind="donut" donut-layout="wide" title="各粮种计划运输量占比" :config="config" :items="overview.grainVolumes" unit="tons" interaction="grain" @select="highlight"/></CockpitPanel>
     <CockpitPanel title="主要发运地区" icon="map" subtitle="计划发运量"><StatisticsChart kind="treemap" title="发运地区运输量矩形树图" :config="config" :items="stats.origins.slice(0,6)" unit="tons" interaction="origin" @select="highlight"/></CockpitPanel>
     <CockpitPanel title="粮食联运链条" icon="network" subtitle="吨"><StatisticsChart kind="sankey" title="粮种、联运方式与业务状态流向" :config="config" :links="stats.links" unit="tons" interaction="mode" @select="highlight"/></CockpitPanel>
    </template>
   </aside>
   <section class="cc-map-section" aria-label="全国粮食联运统计地图">
    <div class="cc-map-top cc-map-filter-bar"><div class="cc-filters"><span class="cc-filter-label">统计范围</span><el-select v-model="period" aria-label="统计时间范围" class="cc-period" popper-class="cc-select-popper"><el-option label="近 7 天" value="7"/><el-option label="近 30 天" value="30"/><el-option label="近 90 天" value="90"/><el-option label="全部业务" value="all"/></el-select><el-select v-model="grain" aria-label="筛选粮食品种" class="cc-grain" popper-class="cc-select-popper"><el-option label="全部粮种" value="all"/><el-option v-for="g in overview?.grains||[]" :key="g" :label="g" :value="g"/></el-select></div><button class="cc-icon-button" aria-label="重置地图视角" @click="map?.reset()"><RotateCcw :size="17"/></button></div>
    <div v-if="view==='chain'" class="cc-grain-pills" aria-label="粮种切换"><button :class="{active:grain==='all'}" :aria-pressed="grain==='all'" @click="grain='all'">全部粮种</button><button v-for="g in overview.grains" :key="g" :class="{active:grain===g}" :aria-pressed="grain===g" @click="grain=g">{{g}}</button></div>
    <div v-if="scopeLabel" class="cc-scope-chip" :title="scopeLabel">{{scopeLabel}}<button aria-label="取消地图统计筛选" @click="clearScope"><X :size="12"/></button></div>
    <MapExplorer ref="map" :config="config" :businesses="businesses" :view="view" :chart-selection="chartSelection" :risks="overview.risks" :paused="settingsOpen" :scoped="!!scopeLabel" @filter="setScope" @clear-highlight="chartSelection=null"/>
    <SouthSeaInset :style-config="config"/>
   </section>
   <aside class="cc-side cc-right">
    <template v-if="view==='platform'">
     <PlatformOperationsPanels :statistics="stats" :config="config" @select="highlight"/>
    </template>
    <template v-else>
     <CockpitPanel title="主要到达地区" icon="map" subtitle="计划到达量"><StatisticsChart kind="bubbles" title="到达地区计划运输量立体球图" :config="config" :items="stats.destinations" unit="tons" interaction="destination" @select="highlight"/></CockpitPanel>
     <CockpitPanel title="粮食运输通道结构" icon="route" subtitle="吨"><StatisticsChart kind="heatmap" title="粮种与联运通道运输量矩阵" :config="config" :cells="stats.heatmap" unit="tons" interaction="mode" @select="highlight"/></CockpitPanel>
     <CockpitPanel title="运输规模与合同单价" icon="wallet" subtitle="元 / 吨"><StatisticsChart kind="scatter" title="计划运输规模与合同运输单价分布" :config="config" :points="stats.scatter"/></CockpitPanel>
    </template>
   </aside>
  </main>
  <div v-else class="cc-initial-state" role="status"><ShieldCheck :size="30"/><h2>{{error?'统计数据暂未加载':'正在汇总平台统计'}}</h2><p>{{error?'请重试获取驾驶舱统计数据':'正在读取运输需求、合同和联运业务'}}</p><button v-if="error" class="cc-button cc-button-primary" @click="loadOverview">重新加载</button></div>
  <StyleSettings v-model:visible="settingsOpen" :draft="styles.draft.value" :view="styles.editingView.value" :feedback="styles.feedback.value" :custom-presets="styles.customPresets.value" :busy="styles.busy.value" :ready="styles.ready.value" @change="changeStyle" @save="saveStyle" @cancel="styles.cancel" @save-preset="styles.savePreset" @delete-preset="styles.deletePreset"/>
 </div>
</template>
