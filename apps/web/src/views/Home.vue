<script setup lang="ts">
import {ref,onMounted,computed} from 'vue';
import {useRouter} from 'vue-router';
import {useAuth} from '../stores/auth';
import {get,message} from '../api';
import {openAgent} from '../agent';
import {ton} from '../fulfillment';
import Icon from '../components/Icon.vue';
import BusinessArt from '../components/BusinessArt.vue';
type Stage={id:string;mode:string;status:string;origin:string;destination:string;plannedStartAt:string;plannedEndAt:string;actualEndAt:string|null};
type Waybill={id:string;waybillNo:string;contractNo:string;status:string;grain:string;quantityKg:number;origin:string;destination:string;shipper:string;carrier:string;stages:Stage[];expectedArrivalAt:string|null};
type Overview={scope:string;metrics:{pending:number|null;running:number|null;alerts:number|null;completed:number|null};todos:{key:string;title:string;count:number;description:string;path:string;icon:string}[];items:Waybill[];alerts:{id:string;businessId:string;taskId:string;message:string;level:string}[]};
const auth=useAuth(),router=useRouter(),data=ref<Overview>(),error=ref(''),loading=ref(true),question=ref('');
const company=computed(()=>auth.user?.businessEntity.name||'');
const greeting=computed(()=>{const h=Number(new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'numeric',hour12:false}).format(new Date()));return h<6?'你好':h<12?'上午好':h<18?'下午好':'晚上好';});
const agentAvailable=computed(()=>auth.can('plan:read')||auth.can('tracking:read'));
const shortcuts=computed(()=>{
 const carrier=auth.user?.businessEntity.type==='CARRIER',trader=auth.user?.businessEntity.type==='TRADER';
 return [
  ...(carrier&&auth.can('supply:read')?[{title:auth.can('supply:write')?'发布运输供给':'管理运输供给',description:'登记可用运力与服务线路',note:'让合适的需求找到您',art:'demand' as const,path:'/supply-demand/supplies',create:auth.can('supply:write')}]:auth.can('demand:read')?[{title:trader&&auth.can('demand:write')?'创建运输需求':'运输需求管理',description:'明确起终点、货物与时间',note:'从需求开启运输业务',art:'demand' as const,path:'/supply-demand/demands',create:trader&&auth.can('demand:write')}]:[]),
  ...(auth.can('plan:read')?[{title:'智能方案规划',description:'求解公铁水联运路线',note:'比较时效、成本与可靠性',art:'plan' as const,path:'/plans/solve',create:false}]:[]),
  ...(auth.can('match:read')?[{title:'匹配运力资源',description:'连接企业与运输资源',note:'查看推荐，协同议价',art:'matching' as const,path:'/matches',create:false}]:[]),
  ...(auth.can('tracking:read')?[{title:'查看运输进度',description:'全程跟踪运输与节点',note:'掌握在途状态与预警',art:'tracking' as const,path:'/tracking/journeys',create:false}]:[])
 ];
});
const metrics=computed(()=>!data.value?[]:[{label:'待执行运单',value:data.value.metrics.pending,icon:'truck',tone:'red',path:auth.can('service:read')?'/services':'/tracking/journeys'},{label:'执行中运单',value:data.value.metrics.running,icon:'truck',tone:'blue',path:auth.can('service:read')?'/services':'/tracking/journeys'},{label:'运输预警',value:data.value.metrics.alerts,icon:'warning',tone:'orange',path:'/tracking/journeys'},{label:'本月完成运单',value:data.value.metrics.completed,icon:'check',tone:'green',path:auth.can('service:read')?'/services':'/tracking/journeys'}].filter(m=>m.value!==null));
const selected=computed(()=>data.value?.items.find(b=>b.status==='IN_PROGRESS')||data.value?.items[0]);
const totalTodos=computed(()=>data.value?.todos.reduce((n,t)=>n+t.count,0)||0);
const statusNames:Record<string,string>={PENDING:'待执行',IN_PROGRESS:'执行中',COMPLETED:'已完成'};
const modeNames:Record<string,string>={ROAD:'公路运输',RAIL:'铁路运输',WATER:'水路运输'};
const modeIcons:Record<string,string>={ROAD:'truck',RAIL:'train',WATER:'ship'};
const prompts=computed(()=>[
 ...(auth.can('plan:read')?[{text:'帮我规划一条粮食联运路线',agent:'PLAN'}]:[]),
 ...(auth.can('tracking:read')?[{text:'汇总当前运单的运输进度',agent:'TRACK'},{text:'有哪些运输风险需要关注？',agent:'RISK'}]:[])
]);
const briefAddress=(v:string)=>{if(!v)return '—';const match=v.match(/(?:黑龙江|吉林|辽宁|河北|河南|山东|江苏|浙江|安徽|湖北|湖南|广东|广西|福建|四川|江西|陕西|山西|云南|贵州|海南|甘肃|青海)(?:省)?([^省市自治区]{2,5}市)/);return match?match[1]:v.length>15?v.slice(0,15)+'…':v;};
const date=(v:string|null)=>v?new Date(v).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit'}):'—';
const stageDate=(s:Stage)=>s.status==='COMPLETED'?s.actualEndAt||s.plannedEndAt:s.plannedStartAt;
const stageStatus=(s:Stage)=>({DRAFT:'待执行',SUBMITTED:'执行中',COMPLETED:'已完成'} as Record<string,string>)[s.status]||'待执行';
async function load(){loading.value=true;error.value='';try{data.value=await get('/dashboard/workbench');}catch(e){error.value=message(e);}finally{loading.value=false;}}
function goWaybill(b:Waybill){router.push({path:auth.can('tracking:read')?'/tracking/journeys':'/services',query:{businessId:b.id}});}
function ask(text=question.value,agent='TRACK'){if(!text.trim())return;openAgent({contextType:'page',suggestedAgent:agent,question:text.trim()});}
onMounted(load);
</script>
<template>
<div class="workbench-page">
 <section class="workbench-welcome"><img src="/assets/portal/intermodal-port.webp" alt="粮食港口联运场景" width="2172" height="724" fetchpriority="high"/><div class="welcome-shade"/><div><p>辽粮智运 · 企业工作台</p><h1>{{greeting}}，{{company}}</h1><span>让粮食运输更智能、更透明、更高效</span></div><span class="welcome-caption">连接每一程，协同每一步</span></section>
 <nav class="workbench-shortcuts" aria-label="业务快捷入口"><router-link v-for="s in shortcuts" :key="s.path" :to="{path:s.path,query:s.create?{create:'1'}:{}}"><span class="shortcut-art" :class="s.art"><BusinessArt :kind="s.art" :size="71"/></span><div><h2>{{s.title}}</h2><p>{{s.description}}<br/>{{s.note}}</p></div><span class="shortcut-next"><Icon name="arrow" :size="16"/></span></router-link></nav>
 <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon class="workbench-error"><el-button @click="load">重新加载</el-button></el-alert>
 <div class="workbench-grid" :class="{'without-assistant':!agentAvailable}"><div class="workbench-main"><el-skeleton v-if="loading&&!data" :rows="10" animated/>
 <template v-else-if="data&&!error"><div class="workbench-upper"><section class="wb-panel overview-panel"><header class="wb-heading"><h2>运输概览</h2><span>{{data.scope}}</span></header><div class="wb-metrics"><router-link v-for="m in metrics" :key="m.label" :to="m.path"><span class="wb-metric-icon" :class="m.tone"><Icon :name="m.icon" :size="22"/></span><strong>{{m.value}}</strong><span>{{m.label}}</span></router-link></div><p v-if="!metrics.length" class="wb-empty">当前账号尚未开放运输概览。</p></section>
 <section class="wb-panel shipment-panel"><header class="wb-heading"><h2>运输进度</h2><button v-if="selected" @click="goWaybill(selected)">查看详情<Icon name="arrow" :size="14"/></button></header><template v-if="selected"><div class="wb-shipment-title"><strong>{{selected.waybillNo}}</strong><span class="wb-status" :class="selected.status">{{statusNames[selected.status]||selected.status}}</span></div><p class="wb-shipment-route" :title="selected.origin+' → '+selected.destination">{{briefAddress(selected.origin)}}<Icon name="arrow" :size="12"/>{{briefAddress(selected.destination)}}<i/>{{selected.grain}} {{ton(selected.quantityKg)}}</p><div v-if="selected.stages.length" class="wb-stage-track"><div v-for="(s,i) in selected.stages" :key="s.id" class="wb-stage" :class="s.status"><span class="wb-stage-symbol"><Icon :name="modeIcons[s.mode]||'route'" :size="17"/></span><strong>{{modeNames[s.mode]}}</strong><small>{{stageStatus(s)}}</small><time>{{date(stageDate(s))}}</time><i v-if="i<selected.stages.length-1"/></div></div><div v-else class="wb-progress-empty"><Icon name="clock"/>运输阶段尚未登记，等待承运方安排。</div></template><div v-else class="wb-progress-empty"><Icon name="truck"/>暂无运单，完成合同后开始运输协同。</div></section></div>
 <div class="workbench-lower"><section class="wb-panel todo-panel"><header class="wb-heading"><h2>待办处理</h2><span>{{totalTodos}} 项</span></header><router-link v-for="t in data.todos" :key="t.key" :to="t.path" class="wb-todo"><span class="wb-todo-icon" :class="t.key"><Icon :name="t.icon" :size="20"/></span><div><strong><b>{{t.count}}</b> {{t.title}}</strong><p>{{t.description}}</p></div><Icon name="right" :size="15"/></router-link><div v-if="!data.todos.length" class="wb-empty">暂无待办，按业务入口开始使用平台。</div></section>
 <section class="wb-panel tasks-panel"><header class="wb-heading"><h2>最近运输任务</h2><router-link v-if="auth.can('service:read')" to="/services">全部运单<Icon name="arrow" :size="14"/></router-link></header><el-table :data="data.items" class="wb-task-table"><el-table-column label="运单编号" min-width="143"><template #default="{row}"><button class="wb-number-link" @click="goWaybill(row)">{{row.waybillNo}}</button></template></el-table-column><el-table-column label="运输路线" min-width="147"><template #default="{row}"><span :title="row.origin+' → '+row.destination">{{briefAddress(row.origin)}} → {{briefAddress(row.destination)}}</span></template></el-table-column><el-table-column label="货物" min-width="117"><template #default="{row}">{{row.grain}}<small class="wb-cargo-amount">{{ton(row.quantityKg)}}</small></template></el-table-column><el-table-column label="当前状态" width="94"><template #default="{row}"><span class="wb-table-status" :class="row.status"><i/>{{statusNames[row.status]}}</span></template></el-table-column><el-table-column label="预计到达" width="84"><template #default="{row}">{{date(row.expectedArrivalAt)}}</template></el-table-column><el-table-column label="操作" width="56" align="right"><template #default="{row}"><el-button type="primary" link @click="goWaybill(row)">查看</el-button></template></el-table-column><template #empty><div class="wb-empty">当前暂无运输任务，已生效合同转入运单后将在这里显示。</div></template></el-table></section></div></template>
 </div>
 <aside v-if="agentAvailable" class="wb-panel wb-ai-panel"><header class="wb-heading"><h2>辽粮 AI 助手</h2><router-link to="/agents">打开<Icon name="external" :size="14"/></router-link></header><div class="wb-ai-intro"><img src="/assets/portal/liaoliang-ai.webp" alt="辽粮 AI 智能体" width="133" height="133"/><div><strong>你好，我是辽粮 AI</strong><p>规划联运路线，查询运输进度，帮您梳理业务信息。</p></div></div><div class="wb-ai-prompts"><button v-for="p in prompts" :key="p.text" @click="ask(p.text,p.agent)">{{p.text}}<Icon name="right" :size="14"/></button></div><div class="wb-ai-help"><Icon name="shield" :size="16"/><p>根据当前账号可见的业务信息，为您整理运输建议与分析。</p></div><form class="wb-ai-form" @submit.prevent="ask(question,auth.can('tracking:read')?'TRACK':'PLAN')"><label for="workbench-question">向辽粮 AI 提问</label><div><el-input id="workbench-question" v-model="question" aria-label="向辽粮 AI 提问" placeholder="输入您的业务问题…" maxlength="2000"/><button :disabled="!question.trim()" type="submit" aria-label="发送给辽粮 AI"><Icon name="arrow" :size="19"/></button></div></form></aside>
 </div>
</div>
</template>
<style src="./workbench.css"/>
