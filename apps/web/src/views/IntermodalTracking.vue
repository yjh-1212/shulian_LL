<script setup lang="ts">
import BusinessStatus from '../components/BusinessStatus.vue';
import {computed,onMounted,ref} from 'vue';
import {onBeforeRouteLeave,useRoute} from 'vue-router';
import {ElMessageBox} from 'element-plus';
import {get,message} from '../api';
import {useAuth} from '../stores/auth';
import {label,transportMode,date,money,ton} from '../fulfillment';
import IntermodalStageEditor from '../components/IntermodalStageEditor.vue';
import IntermodalStageDetail from '../components/IntermodalStageDetail.vue';
const route=useRoute(),auth=useAuth(),business=ref<any>(),resources=ref<any>({vehicles:[],drivers:[]});
const loading=ref(false),error=ref(''),activeId=ref(''),editMode=ref(true),editor=ref<any>(),savedStageId=ref('');
const statuses:Record<string,string>={PENDING:'待执行',IN_PROGRESS:'执行中',COMPLETED:'已完成'},stageStatuses:Record<string,string>={DRAFT:'待提交',SUBMITTED:'执行中',COMPLETED:'已完成'};
const canWrite=computed(()=>auth.can('service:write')&&auth.user?.businessEntity.type==='CARRIER');
const editable=computed(()=>canWrite.value&&business.value?.status!=='COMPLETED'&&business.value?.package.status==='EFFECTIVE');
const active=computed(()=>business.value?.stages.find((s:any)=>s.id===activeId.value));
const editing=computed(()=>editable.value&&(activeId.value==='new'||active.value?.status==='DRAFT'&&editMode.value));
async function load(){loading.value=true;error.value='';try{
  business.value=await get('/intermodal/'+String(route.params.id));
  if(canWrite.value&&!resources.value.loaded){resources.value={...await get('/fulfillment/resources'),loaded:true};}
  if(!activeId.value||activeId.value!=='new'&&!business.value.stages.some((s:any)=>s.id===activeId.value)){
    activeId.value=(business.value.stages.find((s:any)=>s.status!=='COMPLETED')||business.value.stages[0])?.id||(editable.value?'new':'');
  }
}catch(e){error.value=message(e);}finally{loading.value=false;}}
async function allowLeave(){if(!editor.value?.hasUnsavedChanges)return true;try{await ElMessageBox.confirm('当前阶段有尚未保存的内容，是否离开？','尚未保存',{confirmButtonText:'离开',cancelButtonText:'继续填写',type:'warning'});return true;}catch{return false;}}
async function choose(id:string){if(id===activeId.value)return;if(!await allowLeave())return;activeId.value=id;editMode.value=true;savedStageId.value='';}
async function editorChanged(id?:string){if(id)savedStageId.value=id;await load();}
async function editorClosed(){if(!await allowLeave())return;await load();activeId.value=savedStageId.value||active.value?.id||business.value.stages[0]?.id||'new';editMode.value=false;savedStageId.value='';}
onBeforeRouteLeave(allowLeave);onMounted(load);
</script>

<template>
  <div class="tracking-page" v-loading="loading&&!business">
    <header class="tracking-toolbar"><router-link to="/services">← 返回联运服务</router-link></header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon/>
    <template v-if="business">
      <section class="waybill-summary">
        <div class="summary-title"><h1>{{business.waybillNo}}</h1><BusinessStatus :status="business.status" :label="statuses[business.status]"/><span>{{business.cargo}} · {{ton(business.package.quantityKg)}} · {{business.package.snapshot.loadingType==='CONTAINER'?'集装箱':'散货'}}</span></div>
        <div class="summary-route">{{business.origin}} <span>→</span> {{business.destination}}</div>
        <div class="summary-meta"><span>合同 <router-link :to="'/contracts/performance?id='+business.packageId">{{business.package.businessNo}}</router-link></span><span>贸易商 <b>{{business.trader}}</b></span><span>物流运营企业 <b>{{business.carrier}}</b></span><span>合同费用 <b>{{money(business.package.totalCents)}}</b></span></div>
      </section>
      <el-alert v-if="business.readOnlyReason" :title="business.readOnlyReason" type="info" :closable="false"/><section class="tracking-workspace">
        <div class="stage-navigation"><div class="stage-menu" role="navigation" aria-label="运输阶段"><button v-for="s in business.stages" :key="s.id" :class="{active:activeId===s.id}" :aria-current="activeId===s.id?'step':undefined" @click="choose(s.id)"><span class="stage-index" :class="s.mode.toLowerCase()">{{s.sequence}}</span><span>{{transportMode(s.mode)}}<small>{{stageStatuses[s.status]}}</small></span></button></div><el-button v-if="editable" type="primary" plain :disabled="activeId==='new'" @click="choose('new')">添加运输阶段</el-button></div>
        <div class="tracking-content">
          <IntermodalStageEditor v-if="editing" ref="editor" :key="activeId" :business="business" :stage="active" :resources="resources" @changed="editorChanged" @close="editorClosed"/>
          <template v-else-if="active"><div class="stage-title"><h2>第 {{active.sequence}} 阶段 · {{transportMode(active.mode)}}</h2><el-button v-if="editable&&active.status==='DRAFT'" type="primary" @click="editMode=true">填写阶段</el-button></div><IntermodalStageDetail :key="activeId" :business="business" :stage-id="activeId" :can-write="editable" embedded @changed="load"/></template>
          <el-empty v-else description="暂无运输阶段" :image-size="65"/>
        </div>
      </section>
      <section class="tracking-footer"><span>计划时间 {{date(business.stages[0]?.plannedStartAt)}} 起</span><span>阶段完成 {{business.stages.filter((s:any)=>s.status==='COMPLETED').length}} / {{business.stages.length}}</span><span v-if="business.readyToComplete" class="ready">运输阶段均已完成，可返回运单列表办理业务完成。</span><router-link v-for="bill in business.bills" :key="bill.id" :to="'/billing/bills?id='+bill.id">查看账单 {{bill.businessNo}} →</router-link></section>
    </template>
    <el-empty v-else-if="!loading" description="运单不存在或无权查看" :image-size="65"/>
  </div>
</template>

<style scoped>
.tracking-page{display:flex;flex-direction:column;gap:16px}.tracking-toolbar{display:flex;justify-content:space-between;align-items:center}.tracking-toolbar a,.summary-meta a,.tracking-footer a{font-size:13px;color:#e72b32;text-decoration:none}.waybill-summary,.tracking-workspace{background:#fff;border:1px solid #e4e8ee;border-radius:9px}.waybill-summary{padding:22px 24px}.summary-title{display:flex;align-items:center;flex-wrap:wrap;gap:16px}.summary-title h1{font-size:19px;margin:0;font-weight:600}.summary-title>span{font-size:13px;color:#8994a4}.summary-route{font-size:17px;font-weight:500;margin:20px 0}.summary-route>span{color:#a0a9b5;margin:0 12px}.summary-meta{display:flex;flex-wrap:wrap;gap:12px 28px;font-size:12px;color:#8994a4}.summary-meta b{color:#485465;font-weight:400;margin-left:8px}.summary-meta a{font-size:12px;margin-left:8px}.stage-navigation{display:flex;align-items:center;gap:16px;justify-content:space-between;padding:18px 24px;border-bottom:1px solid #e7ebf0}.stage-menu{display:flex;gap:8px;flex-wrap:wrap}.stage-menu button{display:flex;align-items:center;gap:10px;background:#f7f8fa;border:1px solid transparent;padding:10px 14px;border-radius:7px;cursor:pointer;text-align:left;color:#6b7787;font-size:13px}.stage-menu button:hover{background:#fef4f4}.stage-menu button.active{border-color:#ee9fa4;background:#fff5f5;color:#de292f}.stage-menu button:focus-visible{outline:2px solid #e72b32;outline-offset:2px}.stage-menu small{display:block;font-size:11px;color:#8994a4;margin-top:4px}.stage-index{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;border-radius:50%;color:#fff;font-size:12px;flex-shrink:0}.stage-index.road{background:#e6504f}.stage-index.rail{background:#8b6ac2}.stage-index.water{background:#3490bf}.tracking-content{padding:24px;max-width:1100px;margin:0 auto}.stage-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.stage-title h2{font-size:16px;margin:0}.tracking-footer{display:flex;flex-wrap:wrap;gap:12px 24px;font-size:12px;color:#8994a4;padding:0 2px}.tracking-footer .ready{color:#cf5c26}@media(max-width:900px){.stage-navigation{align-items:flex-start;flex-direction:column}.tracking-content{padding:18px}}
</style>
