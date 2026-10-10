<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref,useId} from 'vue';
import {Truck} from 'lucide-vue-next';
import CockpitPanel from './CockpitPanel.vue';
import {businessScaleSeries,scaleAxis} from '../business-scale';
import type {Statistics} from '../types';
import type {CockpitStyle} from '../theme';
const props=defineProps<{statistics:Statistics;config:CockpitStyle}>();
const rows=computed(()=>businessScaleSeries(props.statistics.volumeTrend,props.statistics.coordinationTrend));
const transportAxis=computed(()=>scaleAxis(rows.value.map(row=>row.tonnes)));
const demandAxis=computed(()=>scaleAxis(rows.value.map(row=>row.demands),true));
const chart=ref<HTMLElement>(),size=ref({width:380,height:142});let observer:ResizeObserver|undefined;
const gradientId=`volume-${useId().replace(/[^a-z0-9_-]/gi,'')}`;
const plot=computed(()=>({left:34,right:Math.max(60,size.value.width-25),top:18,bottom:Math.max(34,size.value.height-19)}));
const axisTicks=computed(()=>transportAxis.value.ticks.map((value,index)=>({value,index})).filter(row=>size.value.height>=100||row.index%2===0));
const chartFont=computed(()=>Math.max(8,Math.min(11,props.config.fontSize*0.8)));
const x=(index:number)=>plot.value.left+(index+.5)*(plot.value.right-plot.value.left)/Math.max(1,rows.value.length);
const y=(value:number,maximum:number)=>plot.value.bottom-value/maximum*(plot.value.bottom-plot.value.top);
const barWidth=computed(()=>Math.min(34,(plot.value.right-plot.value.left)/Math.max(1,rows.value.length)*.44));
const linePath=computed(()=>{let connected=false;return rows.value.map((row,index)=>{if(row.demands==null){connected=false;return '';}const point=`${connected?'L':'M'}${x(index)} ${y(row.demands,demandAxis.value.maximum)}`;connected=true;return point;}).join(' ');});
const empty=computed(()=>!rows.value.some(row=>(row.tonnes??0)>0||(row.demands??0)>0));
const month=(name:string)=>/^\d{4}-\d{2}$/.test(name)?`${name.slice(5)}月`:name;
const tickText=(value:number)=>value>=10000?`${Number((value/10000).toFixed(1))}万`:value>=1000?`${Number((value/1000).toFixed(1))}k`:Number(value.toFixed(1)).toString();
onMounted(()=>{observer=new ResizeObserver(()=>{if(chart.value)size.value={width:Math.max(100,chart.value.clientWidth),height:Math.max(60,chart.value.clientHeight)};});if(chart.value)observer.observe(chart.value);});
onBeforeUnmount(()=>observer?.disconnect());
</script>

<template>
 <CockpitPanel class="cc-business-scale-panel" title="业务规模与趋势" icon="grain">
  <template #heading-extra><div class="cc-scale-header-art" aria-hidden="true"><i/><Truck :size="27"/></div></template>
  <div class="cc-scale-content">
   <div class="cc-scale-chart-shell">
    <div ref="chart" class="cc-scale-chart" data-chart="business-scale">
     <p v-if="empty" class="cc-empty">当前筛选范围暂无统计数据</p>
     <svg v-else :viewBox="`0 0 ${size.width} ${size.height}`" role="img" aria-label="月度计划运输量与运输需求双轴趋势" :style="{fontSize:`${chartFont}px`}">
      <title>青色柱形表示计划运输量（吨），金色折线表示运输需求（单），分别使用左右坐标轴</title>
      <defs><linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--cc-primary)" stop-opacity=".9"/><stop offset="1" stop-color="var(--cc-primary)" stop-opacity=".34"/></linearGradient></defs>
      <text x="1" y="10" class="cc-scale-axis-title">运输量（吨）</text><text :x="size.width-1" y="10" text-anchor="end" class="cc-scale-axis-title">运输需求（单）</text>
      <g v-for="tick in axisTicks" :key="tick.index"><path v-if="config.chartGrid" :d="`M${plot.left} ${y(tick.value,transportAxis.maximum)} H${plot.right}`" class="cc-scale-grid"/><text :x="plot.left-6" :y="y(tick.value,transportAxis.maximum)+3" text-anchor="end">{{tickText(tick.value)}}</text><text :x="plot.right+7" :y="y(demandAxis.ticks[tick.index],demandAxis.maximum)+3">{{demandAxis.ticks[tick.index]}}</text></g>
      <path :d="`M${plot.left} ${plot.top} V${plot.bottom} H${plot.right} V${plot.top}`" class="cc-scale-axis"/>
      <g v-for="(row,index) in rows" :key="row.name" :data-month="row.name" :data-tonnes="row.tonnes" :data-demands="row.demands"><rect v-if="row.tonnes!=null" :x="x(index)-barWidth/2" :y="y(row.tonnes,transportAxis.maximum)" :width="barWidth" :height="plot.bottom-y(row.tonnes,transportAxis.maximum)" rx="3" :fill="`url(#${gradientId})`" class="cc-scale-bar"><title>{{row.name}} · 计划运输量 {{row.tonnes.toLocaleString('zh-CN',{maximumFractionDigits:1})}} 吨</title></rect><text :x="x(index)" :y="plot.bottom+14" text-anchor="middle">{{month(row.name)}}</text></g>
      <path :d="linePath" class="cc-scale-line" :stroke-width="config.chartWidth"/>
      <template v-for="(row,index) in rows" :key="row.name"><circle v-if="row.demands!=null" :cx="x(index)" :cy="y(row.demands,demandAxis.maximum)" r="3" class="cc-scale-dot"><title>{{row.name}} · 运输需求 {{row.demands}} 单</title></circle></template>
     </svg>
    </div>
    <div class="cc-scale-legend"><span><i/>运输量（吨）</span><span><i/>运输需求（单）</span></div>
   </div>
  </div>
 </CockpitPanel>
</template>

<style scoped>
.cc-statistical .cc-business-scale-panel{container-type:size;padding:var(--cc-panel-title-inset) 15px 11px}
.cc-business-scale-panel :deep(.cc-panel-heading){margin-bottom:8px;padding-bottom:7px}
.cc-business-scale-panel :deep(.cc-panel-heading h2){font-size:clamp(16px,4.4cqw,20px);font-weight:650;line-height:1.2}
.cc-business-scale-panel :deep(.cc-frame-outline){stroke:color-mix(in srgb,var(--cc-primary) 85%,transparent);stroke-width:1.5}
.cc-business-scale-panel :deep(.cc-frame-corners){stroke-width:3;opacity:1}
.cc-business-scale-panel :deep(.cc-panel-body){flex:1;min-height:0}
.cc-scale-header-art{margin-left:auto;position:relative;width:66px;height:23px;color:var(--cc-primary);opacity:.6;display:flex;justify-content:flex-end;align-items:center}
.cc-scale-header-art i{position:absolute;left:-13px;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,var(--cc-primary));transform:rotate(5deg)}
.cc-scale-content{display:flex;flex-direction:column;height:100%;min-height:0}
.cc-scale-chart-shell{display:flex;flex-direction:column;flex:1;min-height:0;border:1px solid color-mix(in srgb,var(--cc-primary) 21%,transparent);border-radius:7px;padding:7px 7px 5px;background:transparent}
.cc-scale-chart{position:relative;flex:1;min-height:0}.cc-scale-chart>svg{display:block;width:100%;height:100%;overflow:visible;font-family:var(--cc-family);font-variant-numeric:tabular-nums;fill:var(--cc-muted)}
.cc-scale-axis-title{fill:var(--cc-text);opacity:.85}.cc-scale-grid{fill:none;stroke:var(--cc-border);stroke-dasharray:3 4}.cc-scale-axis{fill:none;stroke:color-mix(in srgb,var(--cc-primary) 35%,transparent)}.cc-scale-bar{stroke:var(--cc-primary);stroke-width:.7}.cc-scale-line{fill:none;stroke:var(--cc-accent);stroke-linecap:round;stroke-linejoin:round}.cc-scale-dot{fill:var(--cc-accent);stroke:var(--cc-accent)}
.cc-scale-legend{display:flex;justify-content:center;align-items:center;gap:15px;min-height:17px;flex-shrink:0;font-size:9px;color:var(--cc-muted)}.cc-scale-legend>span{display:flex;align-items:center;gap:6px}.cc-scale-legend i{width:11px;height:6px;background:var(--cc-primary);border-radius:2px}.cc-scale-legend>span:last-child i{position:relative;width:18px;height:2px;background:var(--cc-accent)}.cc-scale-legend>span:last-child i:after{content:'';position:absolute;left:7px;top:-2px;width:6px;height:6px;border-radius:50%;background:var(--cc-accent)}
@container (max-height:245px){.cc-scale-chart-shell{padding:5px 4px 2px}.cc-scale-legend{font-size:8px;min-height:14px;gap:10px}}
@media (max-height:850px) and (min-width:1101px){.cc-statistical .cc-business-scale-panel{padding:var(--cc-panel-title-inset) 12px 10px}.cc-business-scale-panel :deep(.cc-panel-heading){margin-bottom:7px;padding-bottom:6px}.cc-scale-header-art{height:18px}.cc-scale-header-art>svg{width:22px;height:22px}}
</style>
