<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue';
import {ArrowUpRight,MapPin,X,Wheat} from 'lucide-vue-next';
import CockpitPanel from './CockpitPanel.vue';
import GrainSourceChart from './GrainSourceChart.vue';
import GrainSourceMap from './GrainSourceMap.vue';
import {grainSourcePoints} from '../grain-source-points';
import {sourceStatistics,scopeChoices,regionCentres,toGrainChartRow,previousOutput,completeSum,grainNumber as num} from '../grain-source-data';
import type {CockpitStyle} from '../theme';
import '../grain-source.css';
const props=defineProps<{config:CockpitStyle;paused:boolean}>();
const scope=ref('all'),selected=ref(''),map=ref<InstanceType<typeof GrainSourceMap>>();
const variety=ref('全部粮种'),level=ref('all');
const filteredPoints=computed(()=>grainSourcePoints.filter(point=>regions.value.some(r=>r.id===point.regionId)&&(!selected.value||point.regionId===selected.value)&&(variety.value==='全部粮种'||point.grainTypes.includes(variety.value))&&(level.value==='all'||point.level===level.value)));
const regions=computed(()=>sourceStatistics.regions.filter(r=>scope.value==='all'||r.group===scope.value));
const selectedRegion=computed(()=>regions.value.find(r=>r.id===selected.value));
const activeRegions=computed(()=>selectedRegion.value?[selectedRegion.value]:regions.value);
const rows=computed(()=>regions.value.map(toGrainChartRow));
const treemapRows=computed(()=>scope.value!=='all'?rows.value:[...rows.value.filter(r=>!sourceStatistics.scope.mengdongIds.includes(r.id)),{
 id:'mengdong',name:'蒙东',output:completeSum(rows.value.filter(r=>sourceStatistics.scope.mengdongIds.includes(r.id)).map(r=>r.output)),year:sourceStatistics.year,color:'#d19855',
}]);
const treemapSelected=computed(()=>scope.value==='all'&&sourceStatistics.scope.mengdongIds.includes(selected.value)?'mengdong':selected.value);
const mapRegions=computed(()=>regions.value.map(r=>({id:r.id,name:r.name,...regionCentres[r.id],production:r.productionWanTons,area:r.areaWanHectares})));
const config=computed(()=>({...props.config,flow:props.config.flow&&!props.paused}));
const total=computed(()=>completeSum(activeRegions.value.map(r=>r.productionWanTons)));
const area=computed(()=>completeSum(activeRegions.value.map(r=>r.areaWanHectares)));
const previous=computed(()=>completeSum(activeRegions.value.map(previousOutput)));
const unitYield=computed(()=>total.value!==null&&area.value?total.value/area.value*1000:null);
const growth=computed(()=>total.value!==null&&previous.value?((total.value/previous.value)-1)*100:null);
const subject=computed(()=>selectedRegion.value?.name||scopeChoices.find(s=>s.id===scope.value)?.name||'东北全域');
function select(id:string){selected.value=selected.value===id?'':id;}
function selectTreemap(id:string){if(id==='mengdong')scope.value='蒙东';else select(id);}
function reset(){scope.value='all';selected.value='';variety.value='全部粮种';level.value='all';map.value?.reset();}
function escape(event:KeyboardEvent){if(event.key==='Escape')selected.value='';}
watch(scope,()=>{selected.value='';});
onMounted(()=>window.addEventListener('keydown',escape));onBeforeUnmount(()=>window.removeEventListener('keydown',escape));
defineExpose({reset});
</script>
<template>
 <main class="cc-grid gs-grid" aria-label="东北粮源分析">
  <aside class="cc-side cc-left">
   <CockpitPanel title="粮源生产总览" icon="grain" :subtitle="`${sourceStatistics.year} 年`">
    <div class="gs-overview">
     <div class="gs-overview-label"><Wheat :size="16"/><span>{{subject}} · 粮食总产量</span><button v-if="selected" aria-label="取消选中地区" @click="selected=''"><X :size="13"/></button></div>
     <div class="gs-production"><strong>{{num(total)}}</strong><span>万吨</span></div>
     <div class="gs-growth"><ArrowUpRight :size="17"/><span>较 {{sourceStatistics.year-1}} 年</span><b>{{growth===null?'—':`${growth>=0?'+':''}${num(growth)}%`}}</b></div>
     <div class="gs-key-values">
      <div><span>粮食播种面积</span><strong>{{num(area)}}<small>万公顷</small></strong></div>
      <div><span>单位面积产量</span><strong>{{num(unitYield,0)}}<small>公斤/公顷</small></strong></div>
      <div><span>上年粮食产量</span><strong>{{num(previous)}}<small>万吨</small></strong></div>
      <div><span>统计区域</span><strong>{{activeRegions.length}}<small>个</small></strong></div>
     </div>
    </div>
   </CockpitPanel>
   <CockpitPanel title="主产区规模分布" icon="map" subtitle="万吨"><GrainSourceChart kind="treemap" :rows="treemapRows" :config="config" :selected="treemapSelected" label="主产区规模分布" @select="selectTreemap"/></CockpitPanel>
   <CockpitPanel title="主粮品种构成" icon="network" subtitle="万吨 · ≈估算"><GrainSourceChart kind="heatmap" :rows="rows" :config="config" :selected="selected" label="主粮品种构成" @select="select"/></CockpitPanel>
  </aside>
  <section class="gs-map-section" aria-label="东三省与蒙东粮源分布地图">
   <nav class="gs-scope" aria-label="粮源地区筛选"><button v-for="s in scopeChoices" :key="s.id" :aria-pressed="scope===s.id" :class="{active:scope===s.id}" @click="scope=s.id">{{s.name}}</button></nav>
   <div class="gs-source-filters" aria-label="粮源点筛选"><div><button v-for="v in ['全部粮种','玉米','水稻','大豆','杂粮']" :key="v" :aria-pressed="variety===v" @click="variety=v">{{v}}</button></div><select v-model="level" aria-label="粮源等级"><option value="all">全部等级</option><option value="core">核心粮源</option><option value="key">重点粮源</option><option value="normal">一般粮源</option></select></div>
   <GrainSourceMap ref="map" :config="config" :regions="mapRegions" :points="filteredPoints" :selected="selected" :paused="paused" @select="select"/>
   <div class="gs-map-foot"><span><i/>县域粮源分布</span><span>{{selectedRegion?`${selectedRegion.name} · ${num(selectedRegion.productionWanTons)} 万吨`:'东三省 · 蒙东四盟市'}}</span><small>统计年度 {{sourceStatistics.year}}</small></div>
   <div class="gs-region-picker" aria-label="选择统计地区"><button v-for="r in regions" :key="r.id" :aria-pressed="selected===r.id" @click="select(r.id)"><MapPin :size="11"/>{{r.name}}</button></div>
  </section>
  <aside class="cc-side cc-right">
   <CockpitPanel title="播种面积与产出" icon="grain" subtitle="规模 / 单产"><GrainSourceChart kind="scatter" :rows="rows" :config="config" :selected="selected" label="播种面积与产出" @select="select"/></CockpitPanel>
   <CockpitPanel title="地区增产贡献" icon="route" :subtitle="`较 ${sourceStatistics.year-1} 年`"><GrainSourceChart kind="waterfall" :rows="rows" :config="config" :selected="selected" label="地区增产贡献" @select="select"/></CockpitPanel>
   <CockpitPanel title="地区产量变化" icon="chart" :subtitle="`${sourceStatistics.year-1} = 100`"><GrainSourceChart kind="dumbbell" :rows="rows" :config="config" :selected="selected" label="地区产量变化" @select="select"/></CockpitPanel>
  </aside>
 </main>
</template>
