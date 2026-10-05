<script setup lang="ts">
import {computed} from 'vue';
import {date} from '../fulfillment';
import {buildGanttGroups,type GanttRow} from '../intermodal-gantt';
const props=defineProps<{stages:any[]}>();
const groups=computed(()=>buildGanttGroups(props.stages));
const valid=(v:GanttRow)=>Number.isFinite(+new Date(v.start))&&Number.isFinite(+new Date(v.end))&&+new Date(v.end)>+new Date(v.start);
const range=computed(()=>{const rows=groups.value.flatMap(g=>g.rows).filter(valid);if(!rows.length)return null;const start=Math.min(...rows.map(v=>+new Date(v.start))),end=Math.max(...rows.map(v=>+new Date(v.end)));return {start,end,span:end-start};});
const tick=(fraction:number)=>{const r=range.value;if(!r)return '';const d=new Date(r.start+r.span*fraction);return d.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})+' '+d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});};
const bar=(v:GanttRow)=>{const r=range.value!;const left=(+new Date(v.start)-r.start)/r.span*100,width=(+new Date(v.end)-+new Date(v.start))/r.span*100;return {left:left+'%',width:Math.min(100-left,Math.max(.5,width))+'%'};};
const state=(v:GanttRow)=>v.status==='DRAFT'?'draft':v.status==='CANCELLED'?'cancelled':v.status==='COMPLETED'?'completed':['DISPATCHED','RETURNED','ACCEPTED','AT_LOADING'].includes(v.status)?'pending':'active';
const tooltip=(v:GanttRow)=>`${v.name} · ${v.detail}\n${v.taskNo?'任务 '+v.taskNo+'\n':''}${v.statusLabel}\n计划 ${date(v.start)} — ${date(v.end)}${v.actual?'\n实际完成 '+date(v.actual):''}`;
</script>
<template>
  <div v-if="groups.length" class="service-gantt">
    <div class="gantt-scroll"><div class="gantt-canvas">
      <div class="gantt-axis"><span class="axis-label">车辆 / 运输资源</span><div class="axis-ticks"><span v-for="fraction in [0,.25,.5,.75,1]" :key="fraction">{{tick(fraction)}}</span></div></div>
      <section v-for="g in groups" :key="g.id" class="gantt-group" :aria-label="g.title">
        <header class="gantt-group-heading"><strong><i :class="g.mode.toLowerCase()"/>{{g.title}}</strong><span>{{g.route}}</span><b v-if="g.mode==='ROAD'">{{g.vehicleCount}} 辆车<span v-if="g.rows.length>g.vehicleCount"> · {{g.rows.length}} 个运输任务</span></b></header>
        <div v-for="v in g.rows" :key="v.id" class="gantt-row" :data-testid="v.mode==='ROAD'?'gantt-vehicle':'gantt-resource'">
          <div class="gantt-name" :title="v.name+(v.taskNo?' · '+v.taskNo:'')"><strong>{{v.name}}</strong><small>{{v.detail}}</small></div>
          <div v-if="range&&valid(v)" class="gantt-track"><div class="gantt-bar" :class="[v.mode.toLowerCase(),state(v)]" :style="bar(v)" :title="tooltip(v)" :aria-label="tooltip(v)" tabindex="0"><span>{{v.statusLabel}}{{v.status==='COMPLETED'?' ✓':''}}</span></div></div>
          <span v-else class="gantt-missing-time">时间待填写</span>
        </div>
        <p v-if="!g.rows.length" class="gantt-unallocated">尚未分配车辆，保存车辆安排后将逐车展示。</p>
      </section>
    </div></div>
    <div class="gantt-legend"><span><i class="road"/>公路</span><span><i class="rail"/>铁路</span><span><i class="water"/>水运</span><span>淡色：待提交 / 待接单 · ✓：已完成 · 灰色：已取消</span></div>
  </div>
  <span v-else class="gantt-empty">暂无运输阶段</span>
</template>
<style scoped>
.service-gantt{--resource-width:220px;--row-gap:16px}.gantt-scroll{max-height:520px;overflow:auto}.gantt-canvas{min-width:720px}.gantt-axis{position:sticky;top:0;z-index:1;display:flex;gap:var(--row-gap);align-items:center;background:#fff;padding:10px 0 12px;border-bottom:1px solid #e9edf2;color:#8793a2;font-size:11px}.axis-label{width:var(--resource-width);flex-shrink:0}.axis-ticks{display:flex;justify-content:space-between;flex:1;gap:8px}.gantt-group{padding:14px 0 8px;border-bottom:1px solid #e9edf2}.gantt-group-heading{display:flex;align-items:center;gap:16px;margin-bottom:12px;font-size:12px}.gantt-group-heading strong{display:flex;align-items:center;gap:7px;font-size:13px;color:#425063;white-space:nowrap}.gantt-group-heading>span{color:#8994a4;min-width:0}.gantt-group-heading>b{margin-left:auto;color:#d94148;font-size:12px;font-weight:500;white-space:nowrap}.gantt-group-heading i,.gantt-legend i{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}.gantt-row{display:flex;align-items:center;gap:var(--row-gap);min-height:54px;padding:5px 0}.gantt-name{width:var(--resource-width);flex-shrink:0;min-width:0;color:#425063}.gantt-name strong{display:block;font-size:13px;font-weight:500;overflow-wrap:anywhere}.gantt-name small{display:block;font-size:11px;color:#8994a4;margin-top:5px}.gantt-track{height:30px;position:relative;flex:1;border-radius:4px;background:repeating-linear-gradient(to right,#f5f7fa 0,#f5f7fa calc(25% - 1px),#e7ecf2 calc(25% - 1px),#e7ecf2 25%)}.gantt-bar{position:absolute;top:4px;height:22px;min-width:3px;box-sizing:border-box;border-radius:4px;display:flex;align-items:center;overflow:hidden;white-space:nowrap;font-size:11px;color:#fff}.gantt-bar span{padding-left:7px}.gantt-bar:focus-visible{outline:2px solid #263140;outline-offset:2px}.road{background:#e6504f}.rail{background:#8b6ac2}.water{background:#3490bf}.gantt-bar.draft{opacity:.42}.gantt-bar.pending{opacity:.65}.gantt-bar.cancelled{background:#a9b1bd;text-decoration:line-through}.gantt-unallocated,.gantt-missing-time,.gantt-empty{font-size:12px;color:#929baa}.gantt-unallocated{margin:14px 0 14px 24px}.gantt-legend{display:flex;flex-wrap:wrap;gap:16px;margin-top:16px;font-size:11px;color:#8994a4}.gantt-legend span{display:flex;align-items:center;gap:5px}
</style>
