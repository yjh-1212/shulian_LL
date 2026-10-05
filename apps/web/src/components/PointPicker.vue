<script setup lang="ts">
import {ref} from 'vue';import {get,message} from '../api';import PlanningMap from './PlanningMap.vue';
const props=defineProps<{modelValue:any;label:string;nodes:any[];searchText?:string;disabled?:boolean}>();
const emit=defineEmits(['update:modelValue']);
const open=ref(false),q=ref(''),results=ref<any[]>([]),pending=ref<any>(null),loading=ref(false),locating=ref(false),error=ref(''),locationName=ref('');
let searchRequest=0,pointRequest=0;
function fullAddress(p:any){
 if(p.matchedAddress)return p.matchedAddress;
 const region=[...new Set([p.province,p.city,p.district].filter(v=>typeof v==='string'&&v))].join('');
 const address=typeof p.address==='string'&&p.address?p.address:p.name;
 const detail=address.includes(p.name)?address:`${address} ${p.name}`;
 return !region||detail.startsWith(region)||p.city&&detail.includes(p.city)?detail:region+detail;
}
function select(p:any){pointRequest++;locating.value=false;pending.value=p;locationName.value=fullAddress(p);error.value='';}
function close(){searchRequest++;pointRequest++;loading.value=false;locating.value=false;}
function show(){
 close();q.value=props.searchText||'';pending.value=props.modelValue;locationName.value=pending.value?fullAddress(pending.value):'';results.value=[];error.value='';open.value=true;
 if(q.value&&!pending.value){const text=q.value.replace(/\s|\//g,'');const local=props.nodes.filter(p=>text===p.name||text===p.address||text===fullAddress(p).replace(/\s|\//g,''));if(local.length===1){results.value=local;select(local[0]);}else void search();}
}
async function search(){
 const current=++searchRequest;loading.value=true;error.value='';
 try{let found=await get('/map/search',{q:q.value});if(!found.length){const resolved=await get('/map/resolve',{q:q.value});if(resolved)found=[{...resolved,address:resolved.matchedAddress+(resolved.matchKind==='APPROXIMATE'?'（区域参考位置，请在地图核对装卸点）':'')}];}if(current!==searchRequest||!open.value)return;results.value=found;if(!found.length)error.value='未找到地点，请补充城市或选择已核验节点';}
 catch(e){if(current===searchRequest&&open.value)error.value=message(e);}
 finally{if(current===searchRequest)loading.value=false;}
}
async function pickMap(p:any){
 const current=++pointRequest;pending.value={...p,matchKind:'MAP'};locationName.value='';locating.value=true;error.value='';
 try{const found=await get('/map/reverse',{lng:p.lng,lat:p.lat});if(current===pointRequest&&open.value){pending.value=found;locationName.value=fullAddress(found);}}
 catch{if(current===pointRequest&&open.value)error.value='未获取到详细地址，请填写装卸点名称后确认；所选坐标已保留。';}
 finally{if(current===pointRequest)locating.value=false;}
}
function confirm(){
 if(!pending.value||locating.value)return;
 if(pending.value.matchKind==='APPROXIMATE'){error.value='当前仅定位到地区，请选择实际业务节点或在地图点选装卸位置';return;}
 if(locationName.value.trim().length<2){error.value='请填写至少两个字的装卸点名称';return;}
 const p=pending.value,matchedAddress=locationName.value.trim();
 emit('update:modelValue',{name:matchedAddress.slice(0,160),lng:p.lng,lat:p.lat,matchedAddress,matchKind:p.id||p.nodeId?'NODE':p.matchKind||'POI',...Object.fromEntries(['province','city','district','adcode'].filter(k=>typeof p[k]==='string').map(k=>[k,p[k]])),...(p.id?{nodeId:p.id}:p.nodeId?{nodeId:p.nodeId}:{})});
 open.value=false;
}
</script>
<template>
 <button type="button" class="point-trigger" :aria-label="'选择'+label" :disabled="disabled" @click="show"><strong>{{modelValue?.name||(searchText?'待确认定位 · '+label:'选择'+label)}}</strong><small>{{modelValue?`${modelValue.lng}, ${modelValue.lat} · 点击修改`:(searchText||'搜索地点 / 业务节点 / 地图选点')}}</small></button>
 <el-dialog v-model="open" class="point-picker-dialog" :title="'选择'+label" width="min(1050px, 96vw)" top="5vh" append-to-body destroy-on-close @close="close">
  <div class="point-picker-grid">
   <div class="point-search">
    <el-input v-model="q" placeholder="输入城市、港口、车站或详细地址" aria-label="地点搜索" maxlength="200" @keyup.enter="search"><template #append><el-button @click="search" :loading="loading">搜索地点</el-button></template></el-input>
    <el-alert v-if="error" :title="error" type="warning" :closable="false"/>
    <p v-if="searchText" class="original-address">需求地址：{{searchText}}</p>
    <h4>{{results.length?'搜索结果':'已核验定位节点'}}</h4>
    <div class="point-results"><button type="button" v-for="p in results.length?results:nodes" :key="p.id||p.sourceRef||`${p.lng},${p.lat}`" :class="{chosen:pending?.lng===p.lng&&pending?.lat===p.lat}" @click="select(p)"><strong>{{p.name}}</strong><span>{{p.province}} {{p.city}} {{p.district}} {{p.address}}</span></button></div>
   </div>
   <PlanningMap :points="pending?[pending]:results.length?results:nodes" pick @point="pickMap" @node="select"/>
  </div>
  <div v-if="pending" class="location-detail"><span>装卸点名称 / 详细地址</span><el-input v-model="locationName" aria-label="装卸点名称 / 详细地址" maxlength="200" :disabled="locating" :placeholder="locating?'正在获取详细地址…':'补充仓库、场站、出入口等信息'"/><small>{{pending.lng}}, {{pending.lat}} · GCJ-02</small></div>
  <template #footer><span class="picked-label">{{locating?'正在获取地址…':pending?`已选：${locationName||pending.name}`:'尚未选择位置'}}</span><el-button @click="open=false">取消</el-button><el-button type="primary" :disabled="!pending||locating||locationName.trim().length<2" @click="confirm">确认位置</el-button></template>
 </el-dialog>
</template>
<style scoped>
.point-trigger:disabled{cursor:not-allowed;opacity:.65}.point-picker-grid{min-width:0}.point-search{display:flex;flex-direction:column;min-width:0;max-height:450px}.point-search .point-results{flex:1;min-height:100px;height:auto}.point-search .original-address{margin:8px 0;padding:0}.point-search h4{margin:12px 0 8px}.location-detail{display:grid;grid-template-columns:150px minmax(0,1fr) auto;align-items:center;gap:10px;margin-top:16px;font-size:12px;color:#667085}.location-detail small{font-size:10px}.picked-label{display:inline-block;max-width:65%;overflow-wrap:anywhere;text-align:left;vertical-align:middle}.point-picker-dialog :deep(.el-dialog__body){max-height:calc(90vh - 130px);overflow:auto}@media(max-width:760px){.point-search{max-height:230px}.location-detail{grid-template-columns:1fr}.picked-label{max-width:100%;display:block;margin-bottom:10px}}
</style>
<style scoped>.original-address{font-size:12px;color:#667085;line-height:1.7;padding:10px 0}.point-trigger{background:white;border:1px solid #dfe4eb;border-radius:6px;width:100%;text-align:left;padding:9px 11px;color:#3b4654;min-height:58px}.point-trigger:hover{border-color:#e52b2f}.point-trigger strong,.point-trigger small{display:block;font-size:12px}.point-trigger small{font-size:10px;color:#87909b;margin-top:5px;white-space:normal;line-height:1.5}.point-picker-grid{display:grid;grid-template-columns:310px 1fr;gap:18px}.point-search h4{font-size:13px;margin:18px 0 10px}.point-results{height:365px;overflow:auto}.point-results button{display:block;text-align:left;width:100%;border:1px solid #e8ebee;border-radius:6px;padding:12px;margin:7px 0;background:white}.point-results button.chosen{border-color:#e52b2f;background:#fff6f5}.point-results strong{font-size:13px;display:block}.point-results span{font-size:11px;color:#7a8591;display:block;margin-top:6px;line-height:1.6}.picked-label{font-size:12px;margin-right:15px;color:#667085}@media(max-width:760px){.point-picker-grid{grid-template-columns:1fr}.point-results{height:150px}.point-picker-grid :deep(.planning-map){min-height:300px}}</style>

