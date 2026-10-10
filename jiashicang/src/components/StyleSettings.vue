<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import {defaults,preset,presets,type CockpitStyle,type CockpitPreset} from '../theme';
import {Trash2} from 'lucide-vue-next';
import type {View} from '../types';
const props=defineProps<{visible:boolean;draft:CockpitStyle|null;view:View;feedback:string;customPresets:CockpitPreset[];busy:boolean;ready:boolean}>();
const emit=defineEmits<{ 'update:visible':[value:boolean];change:[style:CockpitStyle];save:[both:boolean];cancel:[];savePreset:[name:string];deletePreset:[id:string]}>();
const open=computed({get:()=>props.visible,set:value=>emit('update:visible',value)}),search=ref(''),both=ref(false),presetName=ref(''),presetChoice=ref('');
const activeGroups=ref(['整体主题与背景']);
type Field={key:keyof CockpitStyle;label:string;kind:'color'|'range'|'toggle'|'select';min?:number;max?:number;step?:number;options?:{value:string;label:string}[]};
const colors=(items:[keyof CockpitStyle,string][]):Field[]=>items.map(([key,label])=>({key,label,kind:'color'}));
const range=(key:keyof CockpitStyle,label:string,min:number,max:number,step=1):Field=>({key,label,kind:'range',min,max,step});
const toggle=(key:keyof CockpitStyle,label:string):Field=>({key,label,kind:'toggle'});
const select=(key:keyof CockpitStyle,label:string,options:[string,string][]):Field=>({key,label,kind:'select',options:options.map(([value,label])=>({value,label}))});
const groups=[
 {name:'整体主题与背景',fields:[...colors([['background','背景主色'],['backgroundEnd','背景渐变色'],['primary','主题色'],['accent','强调色']])]},
 {name:'文字与指标',fields:[...colors([['text','正文颜色'],['muted','辅助文字颜色']]),range('fontSize','正文字号',12,18),range('titleSize','面板标题字号',15,24),range('metricSize','指标数字字号',26,48),select('fontFamily','字体风格',[['hei','现代黑体'],['song','典雅宋体']])]},
 {name:'面板与布局',fields:[...colors([['panel','面板背景'],['border','面板边框']]),range('panelOpacity','面板背景不透明度',0,1,0.05),range('borderOpacity','边框透明度',0,0.8,0.05),range('radius','面板圆角',0,24),range('shadow','阴影强度',0,0.5,0.05),range('panelWidth','单侧面板宽度（%）',20,28),range('gap','面板间距',8,28)]},
 {name:'图表风格',fields:[select('chartPalette','图表配色',[['ocean','蓝青海运'],['grain','金穗粮食'],['mono','单色渐变']]),range('chartWidth','图表线宽',1,5,0.5),toggle('chartGrid','显示图表网格')]},
 {name:'地图外观与光照',fields:[...colors([['mapColor','地图区域颜色'],['mapSide','地图侧面颜色'],['mapEdge','地图边界颜色']]),toggle('mapTexture','显示地形纹理'),toggle('mapTilt','倾斜地图视角'),range('mapHeight','地图立体高度',0,0.85,0.05),range('ambient','环境光强度',0.4,4,0.1),range('light','主光源强度',0,7,0.1),toggle('grid','显示底部网格'),...colors([['gridColor','网格颜色']])]},
 {name:'线路与运输资源',fields:[...colors([['roadColor','公路线路颜色'],['railColor','铁路线路颜色'],['waterColor','水运线路颜色']]),range('routeWidth','路线粗细',1,5,0.5),range('routeLimit','总览线路数量',4,24),toggle('labels','显示节点名称'),range('labelLimit','节点标签数量',2,14),range('labelSize','节点标签字号',10,16),toggle('assets','显示运输资源')]},
 {name:'动效与性能',fields:[toggle('flow','线路流光'),toggle('pulse','节点呼吸'),toggle('edgeFlow','边缘流光'),toggle('sweep','地图扫光'),toggle('autoCruise','进入页面自动巡航'),range('motionSpeed','装饰动效速度',0.3,2.5,0.1),select('performance','渲染模式',[['smooth','流畅'],['balanced','均衡'],['fine','精细']])]}
];
const filtered=computed(()=>groups.map(g=>({...g,fields:g.fields.filter(f=>!search.value||`${g.name}${f.label}`.includes(search.value))})).filter(g=>g.fields.length));
watch(search,q=>{activeGroups.value=q.trim()?filtered.value.map(g=>g.name):['整体主题与背景'];});
function update(key:keyof CockpitStyle,value:unknown){if(!props.draft)return;if(typeof props.draft[key]==='number')value=Number(value);if(typeof props.draft[key]==='string'&&String(props.draft[key]).startsWith('#')&&!/^#[\da-f]{6}$/i.test(String(value)))return;emit('change',{...props.draft,[key]:value});}
const selectedCustom=computed(()=>props.customPresets.find(p=>`custom:${p.id}`===presetChoice.value));
watch(()=>props.visible,value=>{if(value){presetChoice.value='';presetName.value='';both.value=false;}});
watch(()=>props.customPresets,()=>{if(presetChoice.value.startsWith('custom:')&&!selectedCustom.value)presetChoice.value='';});
function choose(value:string){const custom=props.customPresets.find(p=>`custom:${p.id}`===value);emit('change',custom?{...custom.style}:preset(value,props.view));}
</script>
<template>
 <el-dialog v-model="open" title="大屏风格设置" width="390px" top="8vh" draggable :modal="false" :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy" class="cc-settings" @close="emit('cancel')">
  <div class="cc-settings-intro">调整时仅自己预览，保存后同步到所有浏览器</div>
  <div class="cc-setting-preset"><el-select v-model="presetChoice" placeholder="选择风格预设" aria-label="选择风格预设" :disabled="busy||!ready" @change="choose"><el-option v-for="p in presets" :key="p.id" :label="p.name" :value="p.id"/><el-option v-for="p in customPresets" :key="p.id" :label="p.name" :value="`custom:${p.id}`"/></el-select><el-popconfirm v-if="selectedCustom" :title="`删除预设‘${selectedCustom.name}’？`" confirm-button-text="删除" cancel-button-text="取消" width="230" @confirm="emit('deletePreset',selectedCustom!.id)"><template #reference><button class="cc-button cc-delete-preset" :disabled="busy" :aria-label="`删除预设 ${selectedCustom.name}`" title="删除所选预设"><Trash2 :size="16"/></button></template></el-popconfirm><button class="cc-button" :disabled="busy" @click="emit('change',defaults(view))">恢复默认</button></div>
  <el-input v-model="search" placeholder="搜索设置项" aria-label="搜索风格参数" clearable/>
  <div class="cc-settings-scroll">
   <el-collapse v-if="draft" v-model="activeGroups">
    <el-collapse-item v-for="group in filtered" :key="group.name" :name="group.name" :title="group.name">
     <div v-for="field in group.fields" :key="field.key" class="cc-setting-row" :class="{'cc-setting-range':field.kind==='range'}">
      <label :for="`cc-setting-${field.key}`">{{field.label}}</label>
      <div v-if="field.kind==='color'" class="cc-color-field"><input :id="`cc-setting-${field.key}`" type="color" :value="String(draft[field.key])" :aria-label="field.label" @input="update(field.key,($event.target as HTMLInputElement).value)"/><input :value="String(draft[field.key])" maxlength="7" :aria-label="`${field.label}颜色值`" @change="update(field.key,($event.target as HTMLInputElement).value)"/></div>
      <el-switch v-else-if="field.kind==='toggle'" :id="`cc-setting-${field.key}`" :model-value="Boolean(draft[field.key])" :aria-label="field.label" @update:model-value="(v:unknown)=>update(field.key,v)"/>
      <div v-else-if="field.kind==='range'" class="cc-range-field"><input :id="`cc-setting-${field.key}`" type="range" :min="field.min" :max="field.max" :step="field.step" :value="Number(draft[field.key])" :aria-label="field.label" @input="update(field.key,($event.target as HTMLInputElement).value)"/><input type="number" :min="field.min" :max="field.max" :step="field.step" :value="Number(draft[field.key])" :aria-label="`${field.label}数值`" @change="update(field.key,Math.max(field.min!,Math.min(field.max!,Number(($event.target as HTMLInputElement).value))))"/></div>
      <el-select v-else :id="`cc-setting-${field.key}`" :model-value="draft[field.key]" :aria-label="field.label" @update:model-value="(v:unknown)=>update(field.key,v)"><el-option v-for="option in field.options" :key="option.value" :label="option.label" :value="option.value"/></el-select>
     </div>
    </el-collapse-item>
   </el-collapse>
   <p v-if="!filtered.length" class="cc-empty">没有找到对应设置项</p>
  </div>
  <template #footer>
   <div class="cc-preset-save"><el-input v-model="presetName" placeholder="新预设名称" aria-label="新预设名称" maxlength="20" :disabled="busy"/><button class="cc-button" :disabled="!presetName.trim()||busy||!ready" @click="emit('savePreset',presetName)">另存预设</button></div>
   <el-checkbox v-model="both" :disabled="busy">应用到两个驾驶舱</el-checkbox>
   <div class="cc-settings-footer"><small role="status">{{feedback||(ready?'设置保存在服务器，所有浏览器共享':'正在读取共享风格…')}}</small><button class="cc-button" :disabled="busy" @click="open=false">取消</button><button class="cc-button cc-button-primary" :disabled="busy||!ready" @click="emit('save',both)">{{busy?'保存中…':'保存风格'}}</button></div>
  </template>
 </el-dialog>
</template>
