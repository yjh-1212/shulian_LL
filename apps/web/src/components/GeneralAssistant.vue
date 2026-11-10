<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue';
import {useRoute} from 'vue-router';
import {ElMessageBox} from 'element-plus';
import {X} from 'lucide-vue-next';
import {api,message} from '../api';
import {agentRequestKey,sendAgentMessage} from '../agent-stream';
import {useAuth} from '../stores/auth';
import type {AgentContext} from '../agent';
import AgentAnswerText from './AgentAnswerText.vue';
import Icon from './Icon.vue';
const route=useRoute(),auth=useAuth();
const available=computed(()=>!!auth.user&&!auth.user.mustChangePassword&&!route.meta.driver&&route.path!=='/login'&&(auth.can('plan:read')||auth.can('tracking:read')));
const visible=ref(false),loading=ref(false),busy=ref(false),stopping=ref(false),error=ref('');
const question=ref(''),conversation=ref<any>(),restoreId=ref(''),context=ref<AgentContext>({contextType:'page'});
const pending=ref(''),liveAnswer=ref(''),facts=ref(''),status=ref('');
const messages=ref<HTMLElement>(),input=ref<{focus:()=>void}>();
const turns=computed<any[]>(()=>conversation.value?.turns||[]);
const storageKey=computed(()=>`liaoliang-general-assistant:${auth.user?.id}:${auth.user?.businessEntityId}`);
const suggestions=['这个平台的业务流程是什么？','汇总当前运输任务的进度和预警','账单核对与结算怎么操作？'];
let ready=false,requestKey='',generation=0,controller:AbortController|undefined,loadController:AbortController|undefined,scrollFrame=0;
function friendly(e:any){if(e instanceof TypeError)return '网络连接失败，输入已保留，请稍后重试。';return e?.response||e?.code?message(e):e?.message||'暂时无法完成回答，请重试。';}
function save(){if(!auth.user)return;try{localStorage.setItem(storageKey.value,JSON.stringify({id:conversation.value?.id||restoreId.value,draft:question.value,context:context.value}));}catch{/* Browser storage can be unavailable. */}}
function read(){try{return JSON.parse(localStorage.getItem(storageKey.value)||'{}');}catch{return {};}}
async function scroll(){await nextTick();messages.value?.scrollTo({top:messages.value.scrollHeight,behavior:'instant'});}
function progress(event:any){
 if(event.type==='status')status.value=event.message;
 if(event.type==='facts')facts.value=event.summary;
 if(event.type==='delta')liveAnswer.value+=event.text;
 if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;void scroll();});
}
async function load(){
 if(ready||loading.value)return;
 const current=generation;loading.value=true;error.value='';loadController=new AbortController();
 try{
  if(restoreId.value){
   const result=(await api.get('/agents/center/conversations/'+encodeURIComponent(restoreId.value),{signal:loadController.signal})).data.data;
   if(current!==generation)return;
   if(result.capability!=='GENERAL')throw new Error('这条对话不能在通用助手中打开，请新建对话。');
   conversation.value=result;context.value={contextType:result.contextType,contextId:result.contextId};
  }
  ready=true;await scroll();
 }catch(e:any){if(current===generation&&e.code!=='ERR_CANCELED'){
  if([403,404].includes(e.response?.status)){restoreId.value='';conversation.value=undefined;context.value={contextType:'page'};ready=true;save();}
  error.value=friendly(e);
 }}finally{if(current===generation){loading.value=false;loadController=undefined;}}
}
async function show(){if(!available.value)return;visible.value=true;await load();}
async function send(){
 const text=question.value.trim();if(text.length<2||busy.value||loading.value||!available.value)return;
 const current=generation;
 if(!ready){await load();if(!ready||current!==generation||!available.value)return;}
 busy.value=true;stopping.value=false;error.value='';liveAnswer.value='';facts.value='';status.value='正在整理问题…';pending.value=text;
 controller=new AbortController();const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]);
 try{
  requestKey||=agentRequestKey();
  if(!conversation.value){
   const result=(await api.post('/agents/center/conversations',{capability:'GENERAL',contextType:context.value.contextType,contextId:context.value.contextId||''},{signal})).data.data;
   if(current!==generation)return;
   conversation.value={...result,turns:[]};restoreId.value=result.id;save();
  }
  const turn=await sendAgentMessage(conversation.value.id,{question:text,requestKey},event=>{if(current===generation)progress(event);},signal);
  if(current!==generation)return;
  if(!turns.value.some(item=>item.id===turn.id))conversation.value.turns.push(turn);
  question.value='';requestKey='';pending.value='';liveAnswer.value='';facts.value='';status.value='';save();await scroll();
 }catch(e:any){if(current===generation){
  if(stopping.value){status.value='已停止回答，输入已保留。';liveAnswer.value='';facts.value='';}
  else error.value=e.name==='TimeoutError'?'回答超时，输入已保留，请重试。':friendly(e);
 }}finally{if(current===generation){busy.value=false;stopping.value=false;pending.value='';controller=undefined;await scroll();}}
}
async function stop(){
 if(!busy.value||stopping.value)return;
 const current=generation;stopping.value=true;
 try{
  if(conversation.value){const result=(await api.post('/agents/center/conversations/'+conversation.value.id+'/cancel')).data.data;if(current!==generation)return;if(result.status==='FINISHING'){status.value='回答正在保存，请稍候…';stopping.value=false;return;}}
  controller?.abort();
 }catch(e){if(current===generation){error.value=friendly(e);stopping.value=false;}}
}
async function newConversation(){
 if(busy.value||loading.value)return;
 const current=generation;
 if(question.value.trim()){try{await ElMessageBox.confirm('当前输入尚未发送。新建对话会清空这段输入。','新建对话',{confirmButtonText:'新建对话',cancelButtonText:'保留输入',type:'warning'});}catch{return;}}
 if(current!==generation)return;
 conversation.value=undefined;restoreId.value='';question.value='';context.value={contextType:'page'};requestKey='';ready=true;error.value='';liveAnswer.value='';facts.value='';status.value='';save();await nextTick();input.value?.focus();
}
function keydown(event:KeyboardEvent){if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();void send();}}
function example(text:string){question.value=text;void send();}
function links(turn:any){return (turn.response?.links||[]).filter((link:any)=>typeof link.url==='string'&&/^\/(?!\/)/.test(link.url)).slice(0,6);}
async function external(event:Event){
 if(!available.value)return;
 const current=generation;await show();if(current!==generation||!available.value)return;
 const detail=(event as CustomEvent<AgentContext>).detail;
 if(!detail||busy.value||loading.value)return;
 if(question.value.trim()){input.value?.focus();return;}
 if(detail.contextType!=='page'&&(context.value.contextType!==detail.contextType||context.value.contextId!==detail.contextId)){
  conversation.value=undefined;restoreId.value='';context.value={contextType:detail.contextType,contextId:detail.contextId};requestKey='';ready=true;save();
 }
 if(detail.question){question.value=detail.question.slice(0,2000);void send();}
}
watch(question,()=>{if(!busy.value)requestKey='';save();});
watch(storageKey,()=>{
 ++generation;controller?.abort();loadController?.abort();controller=undefined;loadController=undefined;ready=false;visible.value=false;loading.value=false;busy.value=false;stopping.value=false;conversation.value=undefined;pending.value='';liveAnswer.value='';facts.value='';status.value='';error.value='';requestKey='';
 const saved=auth.user?read():{};restoreId.value=typeof saved.id==='string'?saved.id:'';context.value=saved.context?.contextType?{contextType:saved.context.contextType,contextId:saved.context.contextId}:{contextType:'page'};question.value=typeof saved.draft==='string'?saved.draft.slice(0,2000):'';
},{immediate:true,flush:'sync'});
watch(()=>route.meta.cockpit,isCockpit=>{if(isCockpit&&!auth.user)void auth.init();},{immediate:true});
onMounted(()=>window.addEventListener('open-agent',external));
onBeforeUnmount(()=>{++generation;controller?.abort();loadController?.abort();cancelAnimationFrame(scrollFrame);window.removeEventListener('open-agent',external);});
</script>

<template>
 <el-tooltip v-if="available&&!visible" content="辽粮 AI 助手" placement="left"><button class="liaoliang-agent-entry" aria-label="打开AI助手" aria-haspopup="dialog" :aria-expanded="visible" @click="show"><img src="/assets/portal/liaoliang-ai-robot.png" alt=""/></button></el-tooltip>
 <el-drawer v-if="available" v-model="visible" title="辽粮 AI 助手" class="liaoliang-assistant-panel" direction="rtl" size="min(480px, 100%)" append-to-body :modal="false" :lock-scroll="false" :show-close="false" :close-on-click-modal="false" @opened="input?.focus()">
  <template #header><div class="assistant-heading"><img src="/assets/portal/liaoliang-ai-robot.png" alt=""/><div><h2>辽粮 AI 助手</h2><p>业务问答与平台使用帮助</p></div></div><div class="assistant-header-actions"><el-button text :disabled="busy||loading" @click="newConversation"><Icon name="plus" :size="15"/>新对话</el-button><button class="assistant-close" aria-label="关闭AI助手" @click="visible=false"><X :size="20"/></button></div></template>
  <div class="assistant-chat"><div ref="messages" class="assistant-messages" role="log" aria-label="AI助手对话" tabindex="0">
   <el-skeleton v-if="loading" :rows="5" animated/>
   <section v-else-if="!turns.length&&!busy&&!error" class="assistant-welcome"><img src="/assets/portal/liaoliang-ai-robot.png" alt=""/><h3>你好，有什么可以帮你？</h3><p>直接描述业务问题，我会结合当前账号可见的信息回答。</p><div class="assistant-suggestions"><button v-for="text in suggestions" :key="text" @click="example(text)">{{text}}<Icon name="arrow" :size="15"/></button></div></section>
   <section v-for="turn in turns" :key="turn.id" class="assistant-turn"><div class="assistant-question">{{turn.question}}</div><div class="assistant-answer"><span class="assistant-answer-label"><Icon name="bot" :size="16"/>辽粮 AI</span><AgentAnswerText :text="turn.response?.summary||'这条回答暂不可用，请重新提问。'"/><div v-if="links(turn).length" class="assistant-links"><router-link v-for="link in links(turn)" :key="link.url" :to="link.url" @click="visible=false">{{link.label}}<Icon name="external" :size="12"/></router-link></div><small v-if="turn.response?.provider==='RULES'">根据业务记录与平台指引整理</small></div></section>
   <div v-if="pending" class="assistant-question">{{pending}}</div>
   <div v-if="liveAnswer||facts" class="assistant-answer" aria-live="polite"><span class="assistant-answer-label"><Icon name="bot" :size="16"/>辽粮 AI</span><AgentAnswerText :text="liveAnswer||facts"/><small v-if="!busy">回答未完成，输入已保留，可重新发送。</small></div>
   <div v-if="busy" class="assistant-progress" role="status"><i/>{{status||'正在生成回答…'}}</div><p v-else-if="status" class="assistant-status" role="status">{{status}}</p>
   <el-alert v-if="error" class="assistant-error" :title="error" type="error" :closable="false"><el-button link type="primary" :disabled="busy" @click="ready?send():load()">{{ready?'重新发送':'重新加载'}}</el-button></el-alert>
  </div><form class="assistant-compose" @submit.prevent="send"><div v-if="context.contextType!=='page'" class="assistant-context"><Icon name="file" :size="14"/>已关联业务记录<span>新对话可切换到通用问答</span></div><el-input ref="input" v-model="question" aria-label="向AI助手提问" type="textarea" :autosize="{minRows:3,maxRows:6}" :maxlength="2000" :disabled="loading||busy" placeholder="输入你的问题…" resize="none" @keydown="keydown"/><footer><span>Enter 发送 · Shift + Enter 换行</span><el-button v-if="busy" :loading="stopping" @click="stop">停止回答</el-button><el-button v-else type="primary" native-type="submit" :disabled="loading||question.trim().length<2" aria-label="发送问题"><Icon name="up" :size="16"/>发送</el-button></footer><p>业务信息以系统记录为准</p></form></div>
 </el-drawer>
</template>

<style>
.liaoliang-agent-entry{position:fixed;right:18px;bottom:18px;width:82px;height:108px;z-index:1900;background:transparent;border:0;padding:0;cursor:pointer;transition:transform .18s}.liaoliang-agent-entry img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 9px #3d98d534)}.liaoliang-agent-entry:hover{transform:translateY(-3px)}.liaoliang-agent-entry:active{transform:scale(.97)}.liaoliang-agent-entry:focus-visible{outline:2px solid #2877ed;border-radius:16px;outline-offset:3px}
.liaoliang-assistant-panel{--el-color-primary:#2877ed;--el-color-primary-light-3:#689ef4;--el-color-primary-light-5:#94bbf8;--el-color-primary-light-7:#bed5fb;--el-color-primary-light-8:#d4e4fd;--el-color-primary-light-9:#eef5ff;--el-color-primary-dark-2:#2060bd;box-shadow:-8px 0 32px #173a6014;border-left:1px solid #e5edf5;max-width:100%;color:#334a65}.liaoliang-assistant-panel .el-drawer__header{margin-bottom:0;padding:18px 20px;border-bottom:1px solid #e9eef5;gap:10px;align-items:center}.liaoliang-assistant-panel .el-drawer__body{padding:0;overflow:hidden;display:flex;min-height:0}
.assistant-heading{display:flex;align-items:center;gap:10px;min-width:0}.assistant-heading>img{width:40px;height:40px;object-fit:contain}.assistant-heading h2{margin:0;font-size:17px;font-weight:600;color:#234a71;line-height:1.4}.assistant-heading p{margin:3px 0 0;font-size:11px;color:#7a8b9f}.assistant-header-actions{display:flex;align-items:center;gap:2px;margin-left:auto;flex-shrink:0}.assistant-header-actions .el-button{gap:4px;font-size:12px;padding:8px}.assistant-close{border:0;background:none;display:grid;place-items:center;width:36px;height:36px;color:#7b8da2;border-radius:6px;cursor:pointer}.assistant-close:hover{background:#f0f5fa;color:#2877ed}.assistant-close:focus-visible,.assistant-suggestions>button:focus-visible{outline:2px solid #2877ed;outline-offset:2px}
.assistant-chat{flex:1;display:flex;flex-direction:column;min-height:0;min-width:0;background:#fff}.assistant-messages{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:24px 22px;scrollbar-width:thin;scrollbar-color:#d5dfeb transparent}.assistant-welcome{padding:36px 2px 20px}.assistant-welcome>img{width:76px;height:76px;object-fit:contain;margin-bottom:12px}.assistant-welcome h3{font-size:21px;line-height:1.5;font-weight:600;color:#234a71;margin:0 0 9px}.assistant-welcome>p{font-size:13px;line-height:1.85;color:#7a8da2;max-width:310px;margin:0 0 28px}.assistant-suggestions{display:flex;flex-direction:column;gap:8px}.assistant-suggestions>button{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;border:1px solid #e6edf5;background:#f8fafd;border-radius:8px;padding:13px 14px;color:#52708e;font:inherit;font-size:12px;text-align:left;cursor:pointer}.assistant-suggestions>button:hover{background:#edf5ff;border-color:#c8defa;color:#2877ed}.assistant-suggestions>button>svg{flex-shrink:0}
.assistant-turn{margin-bottom:28px}.assistant-question{width:fit-content;max-width:90%;margin:0 0 20px auto;padding:12px 15px;border-radius:12px 12px 3px 12px;background:#edf4ff;color:#345d89;font-size:13px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}.assistant-answer{padding:0 2px;min-width:0}.assistant-answer-label{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;color:#7390ae;margin-bottom:10px}.assistant-answer .answer-content{font-size:14px;line-height:1.9;color:#445b73}.assistant-answer>small{display:block;color:#8494a7;font-size:10px;line-height:1.6;margin-top:12px}.assistant-links{display:flex;gap:7px;flex-wrap:wrap;margin-top:15px}.assistant-links>a{font-size:11px;color:#397bbd;text-decoration:none;padding:6px 8px;border:1px solid #e2ebf6;border-radius:5px;display:inline-flex;align-items:center;gap:5px;background:#fafcff}.assistant-links>a:hover{background:#eef5ff}
.assistant-progress{display:flex;align-items:center;gap:8px;color:#7792ae;font-size:12px;line-height:1.7;margin:20px 0}.assistant-progress>i{width:6px;height:6px;border-radius:50%;background:#2877ed;animation:assistant-pulse 1.2s ease-in-out infinite}.assistant-status{font-size:12px;color:#8393a5;margin-top:18px}.assistant-error{margin-top:20px}.assistant-compose{flex-shrink:0;border-top:1px solid #e9eef5;padding:16px 18px 10px;background:#fff}.assistant-compose .el-textarea__inner{box-shadow:none!important;border:1px solid #e3ebf5;background:#f8fafd;border-radius:9px;line-height:1.8;font-size:13px;padding:12px 14px;color:#415a75}.assistant-compose .el-textarea__inner:focus{border-color:#86b2ed;background:#fff}.assistant-compose footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}.assistant-compose footer>span{font-size:10px;color:#8b99aa}.assistant-compose .el-button{gap:6px;border-radius:7px}.assistant-compose>p{margin:9px 0 0;text-align:center;font-size:10px;color:#98a4b3}.assistant-context{font-size:11px;display:flex;align-items:center;gap:6px;color:#6486aa;margin-bottom:10px}.assistant-context>span{margin-left:auto;font-size:10px;color:#8d9db0}
@keyframes assistant-pulse{50%{opacity:.35}}@media(max-width:600px){.liaoliang-agent-entry{width:68px;height:90px;right:10px;bottom:12px}.liaoliang-assistant-panel .el-drawer__header{padding:14px 16px}.assistant-messages{padding:20px 16px}.assistant-compose{padding:12px 14px 10px}.assistant-heading p{font-size:10px}}@media(prefers-reduced-motion:reduce){.liaoliang-agent-entry{transition:none}.assistant-progress>i{animation:none}.liaoliang-assistant-panel{transition:none!important}}
</style>
