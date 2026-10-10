<script setup lang="ts">
import {computed} from 'vue';
import type {Breakdown} from '../types';
import type {CockpitStyle} from '../theme';
import {tons,statusName,modeName} from '../format';
const props=defineProps<{items:Breakdown[];kind?:'bars'|'trend'|'ring';unit?:'tons'|'count';styleConfig:CockpitStyle;labels?:'status'|'mode'|'plain'}>();
const colors=computed(()=>props.styleConfig.chartPalette==='grain'?[props.styleConfig.accent,props.styleConfig.primary,props.styleConfig.waterColor,props.styleConfig.railColor]:props.styleConfig.chartPalette==='mono'?[props.styleConfig.primary,props.styleConfig.primary,props.styleConfig.primary,props.styleConfig.primary]:[props.styleConfig.primary,props.styleConfig.roadColor,props.styleConfig.accent,props.styleConfig.railColor]);
const total=computed(()=>props.items.reduce((s,i)=>s+i.value,0));
const maximum=computed(()=>Math.max(1,...props.items.map(i=>i.value)));
const label=(name:string)=>props.labels==='status'?statusName(name):props.labels==='mode'?modeName(name):name;
const value=(n:number)=>props.unit==='tons'?tons(n):n.toLocaleString('zh-CN');
const gradient=computed(()=>{let percent=0;return `conic-gradient(${props.items.map((row,i)=>{const start=percent;percent+=row.value/Math.max(1,total.value)*100;return `${colors.value[i%colors.value.length]} ${start}% ${percent}%`;}).join(',')})`;});
const line=computed(()=>props.items.map((row,i)=>`${props.items.length===1?150:8+i*284/(props.items.length-1)},${78-row.value/maximum.value*64}`).join(' '));
</script>
<template>
 <p v-if="!items.length||!total" class="cc-empty">暂无符合条件的数据</p>
 <div v-else-if="kind==='ring'" class="cc-ring-chart"><div class="cc-ring" :style="{background:gradient}"><span><strong>{{value(total)}}</strong><small>{{unit==='tons'?'吨':'项'}}</small></span></div><ul class="cc-chart-legend"><li v-for="(item,i) in items" :key="item.name"><span><i :style="{background:colors[i%colors.length]}"/>{{label(item.name)}}</span><b>{{value(item.value)}}</b></li></ul></div>
 <div v-else-if="kind==='trend'" class="cc-trend-chart"><svg viewBox="0 0 300 94" role="img" aria-label="业务登记数量趋势"><path v-if="styleConfig.chartGrid" d="M8 20H292M8 50H292M8 80H292" class="cc-chart-grid"/><polygon :points="`8,86 ${line} 292,86`" :fill="colors[0]" opacity="0.08"/><polyline :points="line" fill="none" :stroke="colors[0]" :stroke-width="styleConfig.chartWidth" stroke-linejoin="round"/><circle v-for="(row,i) in items" :key="row.name" :cx="items.length===1?150:8+i*284/(items.length-1)" :cy="78-row.value/maximum*64" r="2.6" :fill="colors[0]"><title>{{row.name}} · {{value(row.value)}}{{unit==='tons'?'吨':'项'}}</title></circle></svg><div class="cc-chart-axis"><span>{{items[0].name.slice(5)}}</span><span>{{items.at(-1)?.name.slice(5)}}</span></div></div>
 <div v-else class="cc-bar-chart"><div v-for="(item,i) in items.slice(0,5)" :key="item.name" class="cc-bar-row"><div><span>{{label(item.name)}}</span><strong>{{value(item.value)}}<small v-if="unit==='tons'"> 吨</small></strong></div><div class="cc-bar-track"><i :style="{width:`${item.value/maximum*100}%`,background:colors[i%colors.length],height:`${Math.max(3,styleConfig.chartWidth+2)}px`}"/></div></div></div>
</template>
