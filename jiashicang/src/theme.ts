import {ref,computed,onMounted,onBeforeUnmount} from 'vue';
import {api,message} from '../../apps/web/src/api';
import initial from '../server/default-styles.json';
import type {View} from './types';
export interface CockpitStyle {
 theme:'dark'|'light';background:string;backgroundEnd:string;primary:string;accent:string;text:string;muted:string;panel:string;panelOpacity:number;border:string;borderOpacity:number;radius:number;shadow:number;
 fontSize:number;titleSize:number;metricSize:number;fontFamily:'hei'|'song';panelWidth:number;gap:number;
 chartPalette:'ocean'|'grain'|'mono';chartWidth:number;chartGrid:boolean;
 mapColor:string;mapSide:string;mapEdge:string;mapHeight:number;mapTexture:boolean;mapTilt:boolean;ambient:number;light:number;
 grid:boolean;gridColor:string;roadColor:string;railColor:string;waterColor:string;routeWidth:number;labels:boolean;labelSize:number;assets:boolean;
 flow:boolean;pulse:boolean;edgeFlow:boolean;sweep:boolean;motionSpeed:number;performance:'smooth'|'balanced'|'fine';routeLimit:number;labelLimit:number;autoCruise:boolean;
}
export const defaults=(view:View):CockpitStyle=>({...initial[view]} as CockpitStyle);
export const presets=[{id:'ocean',name:'深海联运'},{id:'grain',name:'金穗流转'},{id:'light',name:'清朗浅色'},{id:'smooth',name:'流畅展示'}];
export function preset(id:string,view:View):CockpitStyle {
 if(id==='grain')return defaults('chain');
 if(id==='light')return {...defaults(view),theme:'light',background:'#e8f0f4',backgroundEnd:'#f6f9fb',text:'#16384c',muted:'#587789',panel:'#ffffff',panelOpacity:0.86,border:'#658695',borderOpacity:0.2,primary:'#177c8c',accent:'#aa7229',mapColor:'#71a0b1',mapSide:'#507f94',mapEdge:'#217d94'};
 if(id==='smooth')return {...defaults(view),performance:'smooth',flow:false,pulse:false,edgeFlow:false,sweep:false};
 return defaults('platform');
}
const colorKeys=['background','backgroundEnd','primary','accent','text','muted','panel','border','mapColor','mapSide','mapEdge','gridColor','roadColor','railColor','waterColor'];
const ranges:Record<string,[number,number]>={panelOpacity:[0,1],borderOpacity:[0,0.8],radius:[0,24],shadow:[0,0.5],fontSize:[12,18],titleSize:[15,24],metricSize:[26,48],panelWidth:[20,28],gap:[8,28],chartWidth:[1,5],mapHeight:[0,0.85],ambient:[0.4,4],light:[0,7],routeWidth:[1,5],labelSize:[10,16],motionSpeed:[0.3,2.5],routeLimit:[4,24],labelLimit:[2,14]};
export function sanitizeStyle(input:unknown,view:View):CockpitStyle {
 const base=defaults(view),out={...base};if(!input||typeof input!=='object')return out;
 const value=input as Record<string,unknown>;
 for(const key of Object.keys(base) as (keyof CockpitStyle)[]){
  const v=value[key];
  if(colorKeys.includes(key)&&typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v))(out as any)[key]=v;
  else if(ranges[key]&&typeof v==='number'&&Number.isFinite(v))(out as any)[key]=Math.min(ranges[key][1],Math.max(ranges[key][0],v));
  else if(typeof base[key]==='boolean'&&typeof v==='boolean')(out as any)[key]=v;
 }
 for(const [key,choices] of Object.entries({theme:['dark','light'],fontFamily:['hei','song'],chartPalette:['ocean','grain','mono'],performance:['smooth','balanced','fine']}))if(choices.includes(String(value[key])))(out as any)[key]=value[key];
 return out;
}
export const rgba=(hex:string,alpha:number)=>`rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${alpha})`;
export function styleVariables(s:CockpitStyle){return {
 '--cc-bg':s.background,'--cc-bg-end':s.backgroundEnd,'--cc-primary':s.primary,'--cc-accent':s.accent,'--cc-text':s.text,'--cc-muted':s.muted,'--cc-panel':rgba(s.panel,s.panelOpacity),'--cc-panel-solid':s.panel,'--cc-border':rgba(s.border,s.borderOpacity),'--cc-radius':`${s.radius}px`,'--cc-shadow':`0 12px 36px rgba(0,0,0,${s.shadow})`,'--cc-font':`${s.fontSize}px`,'--cc-title':`${s.titleSize}px`,'--cc-metric':`${s.metricSize}px`,'--cc-family':s.fontFamily==='song'?'"Noto Serif SC", "Source Han Serif SC", "SimSun", serif':'"HarmonyOS Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif','--cc-side':`${s.panelWidth}%`,'--cc-gap':`${s.gap}px`,'--cc-chart-width':`${s.chartWidth}px`
};}
export interface CockpitPreset {id:string;name:string;view:View;style:CockpitStyle}
interface SharedAppearance {revision:number;updatedAt:string;styles:Record<View,CockpitStyle>;presets:CockpitPreset[]}
export function useCockpitStyles(view:{value:View}) {
 const saved=ref<Record<View,CockpitStyle>>({platform:defaults('platform'),chain:defaults('chain')});
 const customPresets=ref<CockpitPreset[]>([]),feedback=ref(''),syncError=ref(''),busy=ref(false),ready=ref(false);
 let revision=-1,disposed=false,timer:number,inFlight:Promise<void>|null=null,nextSyncAt=0,failures=0;
 const draft=ref<CockpitStyle|null>(null),editingView=ref<View>('platform');
 const current=computed(()=>draft.value&&editingView.value===view.value?draft.value:saved.value[view.value]);
 function apply(state:SharedAppearance,remote=false){
  if(disposed||state.revision<revision)return;
  syncError.value='';
  if(ready.value&&state.revision===revision)return;
  const changed=revision>=0&&state.revision>revision;
  const next={platform:sanitizeStyle(state.styles.platform,'platform'),chain:sanitizeStyle(state.styles.chain,'chain')};
  for(const scope of ['platform','chain'] as const)if(JSON.stringify(next[scope])===JSON.stringify(saved.value[scope]))next[scope]=saved.value[scope];
  if(next.platform!==saved.value.platform||next.chain!==saved.value.chain)saved.value=next;
  if(JSON.stringify(state.presets)!==JSON.stringify(customPresets.value))customPresets.value=state.presets.map(p=>({...p,style:sanitizeStyle(p.style,p.view)}));
  revision=state.revision;ready.value=true;syncError.value='';
  if(remote&&changed&&draft.value)feedback.value='共享设置已更新；当前预览已保留，保存前会检查最新版本';
 }
 function refresh():Promise<void>{
  if(inFlight)return inFlight;
  inFlight=api.get('/cockpit/appearance').then(response=>{apply(response.data.data,true);failures=0;nextSyncAt=Date.now()+5000;}).catch(error=>{
   if(disposed)return;failures++;nextSyncAt=Date.now()+Math.min(30000,failures*10000);
   syncError.value=ready.value?'共享风格同步失败，保留上次设置':'共享风格读取失败，暂用默认风格';
   if(draft.value)feedback.value=message(error);
  }).finally(()=>{inFlight=null;});
  return inFlight;
 }
 function resume(){if(!document.hidden&&!busy.value)void refresh();}
 function begin(){editingView.value=view.value;draft.value={...saved.value[view.value]};feedback.value='';}
 function cancel(){draft.value=null;}
 async function write(method:'put'|'post'|'delete',url:string,body:Record<string,unknown>,success:string){
  if(busy.value)return false;
  if(!ready.value){feedback.value='请先读取共享风格后再保存';return false;}
  busy.value=true;feedback.value='正在保存…';
  try{
   const response=await api.request({method,url,data:{...body,expectedRevision:revision}});
   apply(response.data.data);feedback.value=success;return true;
  }catch(error:any){
   if(error.response?.status===409||error.response?.status===404)await refresh();
   feedback.value=message(error);return false;
  }finally{busy.value=false;}
 }
 async function save(both:boolean){
  if(!draft.value)return false;
  const ok=await write('put','/cockpit/appearance',{view:editingView.value,style:sanitizeStyle(draft.value,editingView.value),both},'风格已保存，其他浏览器将自动同步');
  if(ok)cancel();return ok;
 }
 async function savePreset(name:string){
  if(!draft.value||!name.trim())return false;
  return write('post','/cockpit/appearance/presets',{view:editingView.value,name:name.trim(),style:sanitizeStyle(draft.value,editingView.value)},'预设已保存，其他浏览器将自动同步');
 }
 async function deletePreset(id:string){return write('delete',`/cockpit/appearance/presets/${encodeURIComponent(id)}`,{},'预设已删除，当前风格保持不变');}
 onMounted(()=>{
  void refresh();timer=window.setInterval(()=>{if(!document.hidden&&!busy.value&&Date.now()>=nextSyncAt)void refresh();},1000);
  window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
 });
 onBeforeUnmount(()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);});
 return {saved,draft,current,feedback,customPresets,editingView,begin,cancel,save,savePreset,deletePreset,busy,ready,syncError,refresh};
}
