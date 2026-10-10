<script setup lang="ts">
import {computed} from 'vue';
import {CircleCheck,Truck,FileCheck2,Wallet,CheckCheck,Clock3,Network,FileSearch,ShieldAlert} from 'lucide-vue-next';
import CockpitPanel from './CockpitPanel.vue';
import StatisticsChart from './StatisticsChart.vue';
import {amount} from '../format';
import type {Statistics,ChartSelection} from '../types';
import type {CockpitStyle} from '../theme';
const props=defineProps<{statistics:Statistics;config:CockpitStyle}>();
const emit=defineEmits<{select:[value:ChartSelection]}>();
const fulfillment=computed(()=>props.statistics.fulfillment);
const executionRate=computed(()=>fulfillment.value.total?fulfillment.value.active/fulfillment.value.total*100:null);
const fulfillmentCards=computed(()=>[
 {label:'已完成业务',value:fulfillment.value.completed,unit:'单',icon:CircleCheck,color:props.config.primary},
 {label:'执行中业务',value:fulfillment.value.active,unit:'单',icon:Truck,color:props.config.roadColor},
 {label:'运输合同',value:fulfillment.value.contracts,unit:'份',icon:FileCheck2,color:props.config.accent}
]);
const riskTotal=computed(()=>props.statistics.riskGroups.reduce((sum,row)=>sum+row.value,0));
const risks=computed(()=>props.statistics.riskGroups.filter(row=>row.value>0).map((row,i)=>({...row,share:riskTotal.value?row.value/riskTotal.value*100:0,color:[props.config.accent,props.config.roadColor,props.config.primary][i%3],icon:/单据|凭证|复核/.test(row.name)?FileSearch:/时效|延迟|到达/.test(row.name)?Clock3:Network})));
const finance=computed(()=>props.statistics.financeTrend.reduce((sum,row)=>({total:sum.total+row.first,settled:sum.settled+row.second,outstanding:sum.outstanding+(row.line||0)}),{total:0,settled:0,outstanding:0}));
const financeCards=computed(()=>[
 {label:'账单金额',value:finance.value.total,icon:Wallet,color:props.config.primary},
 {label:'已结算',value:finance.value.settled,icon:CheckCheck,color:props.config.roadColor},
 {label:'待结算',value:finance.value.outstanding,icon:Clock3,color:props.config.accent}
]);
const settlementRate=computed(()=>finance.value.total?finance.value.settled/finance.value.total*100:null);
const percent=(value:number|null)=>value==null?'—':`${value.toFixed(1)}%`;
</script>

<template>
 <CockpitPanel class="cc-operation-panel cc-fulfillment-panel" title="履约与运输效率" icon="check" subtitle="业务状态">
  <div class="cc-fulfillment-layout">
   <div class="cc-completion"><StatisticsChart kind="gauge" title="联运业务完成率" :config="config" :percent="fulfillment.completionRate"/></div>
   <div class="cc-fulfillment-cards"><div v-for="card in fulfillmentCards" :key="card.label" class="cc-status-card" :role="card.unit==='单'?'button':undefined" :tabindex="card.unit==='单'?0:undefined" :aria-label="`高亮 ${card.label}`" @click="card.unit==='单'&&emit('select',{dimension:'status',value:card.label==='已完成业务'?'已完成':'执行中'})" @keydown.space.prevent="card.unit==='单'&&emit('select',{dimension:'status',value:card.label==='已完成业务'?'已完成':'执行中'})" @keydown.enter="card.unit==='单'&&emit('select',{dimension:'status',value:card.label==='已完成业务'?'已完成':'执行中'})" :style="{'--op-color':card.color}"><span class="cc-status-icon"><component :is="card.icon" :size="18"/></span><div><small>{{card.label}}</small><strong>{{card.value}}<em>{{card.unit}}</em></strong></div></div></div>
   <div class="cc-fulfillment-footer"><span>业务总量 <b>{{fulfillment.total}}</b> 单</span><span>执行占比 <b>{{percent(executionRate)}}</b></span></div>
  </div>
 </CockpitPanel>
 <CockpitPanel class="cc-operation-panel cc-risk-panel" title="风险预警分布" icon="shield" subtitle="项">
  <div class="cc-risk-layout">
   <div class="cc-risk-overview"><span class="cc-risk-emblem"><ShieldAlert :size="24"/></span><div><strong>{{riskTotal}}</strong><span>项关注事项</span></div><small>{{risks.length}} 类风险</small></div>
   <div v-if="risks.length" class="cc-risk-categories"><div v-for="row in risks" :key="row.name" class="cc-risk-category" role="button" tabindex="0" :aria-label="`高亮 ${row.name}`" @click="emit('select',{dimension:'risk',value:row.name})" @keydown.enter="emit('select',{dimension:'risk',value:row.name})" @keydown.space.prevent="emit('select',{dimension:'risk',value:row.name})" :style="{'--op-color':row.color}"><div class="cc-risk-category-heading"><component :is="row.icon" :size="18"/><span>{{row.name}}</span><strong>{{row.value}}<em>项</em></strong></div><div class="cc-risk-category-value"><div class="cc-risk-share"><i :style="{width:`${row.share}%`}"/></div><small>{{percent(row.share)}}</small></div></div></div>
   <p v-else class="cc-empty">当前筛选范围暂无风险事项</p>
  </div>
 </CockpitPanel>
 <CockpitPanel class="cc-operation-panel cc-finance-panel" title="费用与结算统计" icon="wallet" subtitle="万元">
  <div class="cc-finance-layout">
   <div class="cc-finance-cards"><div v-for="card in financeCards" :key="card.label" class="cc-finance-card" :style="{'--op-color':card.color}"><small><component :is="card.icon" :size="13"/>{{card.label}}</small><strong>{{amount(card.value)}}</strong></div></div>
   <div class="cc-finance-chart-heading"><span>月度费用趋势</span><small>结算率 <b>{{percent(settlementRate)}}</b></small></div>
   <StatisticsChart kind="combo" title="费用与结算月度分布" :config="config" :series="statistics.financeTrend" unit="money" :legend="['账单金额','已结算','待结算']"/>
  </div>
 </CockpitPanel>
</template>

<style scoped>
.cc-operation-panel :deep(.cc-panel-body){container-type:size}
.cc-fulfillment-layout{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;gap:10px 13px;flex:1;min-height:0}
.cc-completion{display:flex;min-height:0;min-width:0;align-items:center}.cc-completion :deep(.cc-stat-chart){height:100%;width:100%}
.cc-fulfillment-cards{display:grid;grid-template-rows:repeat(3,minmax(0,1fr));gap:8px;min-height:0}
.cc-status-card{display:flex;align-items:center;gap:9px;min-height:0;padding:5px 9px;border:1px solid color-mix(in srgb,var(--op-color) 23%,transparent);background:linear-gradient(110deg,color-mix(in srgb,var(--op-color) 7%,transparent),transparent);border-radius:5px}
.cc-status-icon{color:var(--op-color);display:flex;flex-shrink:0}.cc-status-card small{font-size:clamp(10px,4.8cqh,12px);color:var(--cc-muted);display:block;white-space:nowrap}.cc-status-card strong{font-size:clamp(20px,10cqh,28px);font-weight:550;line-height:1.1;color:var(--op-color)}
em{font-size:10px;font-style:normal;font-weight:400;color:var(--cc-muted);margin-left:5px}
.cc-fulfillment-footer{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--cc-border);padding-top:8px;color:var(--cc-muted);font-size:11px}.cc-fulfillment-footer b{font-weight:550;color:var(--cc-text);font-size:13px;margin:0 3px}
.cc-risk-layout{display:flex;flex-direction:column;flex:1;min-height:0;gap:10px}
.cc-risk-overview{display:flex;align-items:center;gap:10px;flex-shrink:0}.cc-risk-emblem{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;border:1px solid color-mix(in srgb,var(--cc-accent) 30%,transparent);background:radial-gradient(circle,color-mix(in srgb,var(--cc-accent) 10%,transparent),transparent);color:var(--cc-accent)}
.cc-risk-overview strong{font-weight:550;font-size:clamp(28px,14cqh,36px);color:var(--cc-accent);line-height:1.1}.cc-risk-overview span:not(.cc-risk-emblem){font-size:11px;color:var(--cc-muted);margin-left:7px}.cc-risk-overview>small{margin-left:auto;border:1px solid var(--cc-border);padding:3px 7px;border-radius:3px;font-size:10px;color:var(--cc-muted)}
.cc-risk-categories{display:grid;grid-auto-rows:minmax(0,1fr);gap:9px;flex:1;min-height:0}.cc-risk-category{display:flex;flex-direction:column;justify-content:center;gap:8px;padding:8px 10px;border-left:2px solid var(--op-color);background:linear-gradient(90deg,color-mix(in srgb,var(--op-color) 7%,transparent),transparent);min-height:0}
.cc-risk-category-heading{display:flex;align-items:center;gap:8px;min-width:0}.cc-risk-category-heading>svg{color:var(--op-color);flex-shrink:0}.cc-risk-category-heading>span{font-size:clamp(11px,5.5cqh,13px);color:var(--cc-text);white-space:nowrap}.cc-risk-category-heading strong{margin-left:auto;font-weight:550;font-size:clamp(20px,10cqh,26px);line-height:1;color:var(--op-color);white-space:nowrap}
.cc-risk-category-value{display:flex;gap:10px;align-items:center}.cc-risk-share{flex:1;height:6px;background:var(--cc-border);border-radius:2px;overflow:hidden}.cc-risk-share>i{display:block;height:100%;background:var(--op-color);border-radius:2px}.cc-risk-category-value>small{width:38px;font-size:10px;color:var(--cc-muted);text-align:right}
.cc-finance-layout{display:flex;flex-direction:column;gap:10px;flex:1;min-height:0}.cc-finance-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;flex-shrink:0}.cc-finance-card{padding:8px 7px;border:1px solid color-mix(in srgb,var(--op-color) 23%,transparent);border-radius:5px;background:linear-gradient(140deg,color-mix(in srgb,var(--op-color) 7%,transparent),transparent);min-width:0}.cc-finance-card small{display:flex;align-items:center;gap:5px;white-space:nowrap;font-size:11px;color:var(--cc-muted)}.cc-finance-card small>svg{color:var(--op-color);flex-shrink:0}.cc-finance-card strong{display:block;font-size:clamp(18px,6.3cqw,26px);color:var(--op-color);font-weight:550;line-height:1.2;margin-top:6px;font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:-.5px}
.cc-finance-chart-heading{display:flex;justify-content:space-between;align-items:center;flex-shrink:0;font-size:11px;color:var(--cc-text)}.cc-finance-chart-heading small{color:var(--cc-muted);font-size:10px}.cc-finance-chart-heading b{color:var(--cc-primary);font-weight:500;margin-left:4px}
@container(max-height:190px){.cc-fulfillment-layout{gap:6px 8px}.cc-fulfillment-cards{gap:5px}.cc-status-card{padding:3px 6px;gap:6px}.cc-status-icon>svg{width:15px;height:15px}.cc-status-card strong{font-size:20px}.cc-fulfillment-footer{padding-top:5px;font-size:10px}.cc-risk-layout{gap:7px}.cc-risk-emblem{width:33px;height:33px}.cc-risk-emblem>svg{width:20px;height:20px}.cc-risk-categories{gap:6px}.cc-risk-category{padding:5px 7px;gap:5px}}
@container(max-width:310px){.cc-finance-layout{gap:7px}.cc-finance-cards{gap:5px}.cc-finance-card{padding:6px 4px}.cc-finance-card small{font-size:10px;gap:3px}.cc-finance-card small>svg{width:11px;height:11px}.cc-finance-card strong{font-size:18px;margin-top:4px}.cc-status-card small{font-size:10px}}
</style>
