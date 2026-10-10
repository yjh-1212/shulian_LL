const {randomUUID}=require('node:crypto');
const initial=require('./default-styles.json');
const ranges={panelOpacity:[0,1],borderOpacity:[0,0.8],radius:[0,24],shadow:[0,0.5],fontSize:[12,18],titleSize:[15,24],metricSize:[26,48],panelWidth:[20,28],gap:[8,28],chartWidth:[1,5],mapHeight:[0,0.85],ambient:[0.4,4],light:[0,7],routeWidth:[1,5],labelSize:[10,16],motionSpeed:[0.3,2.5],routeLimit:[4,24],labelLimit:[2,14]};
const choices={theme:['dark','light'],fontFamily:['hei','song'],chartPalette:['ocean','grain','mono'],performance:['smooth','balanced','fine']};
const initializing=new WeakMap();
function fail(message,code='INVALID'){throw Object.assign(new Error(message),{appearanceCode:code});}
function validView(view){if(!['platform','chain'].includes(view))fail('请选择有效的驾驶舱');return view;}
function cleanStyle(input,view){
 const base=initial[validView(view)];
 if(!input||typeof input!=='object'||Array.isArray(input))fail('风格参数格式不正确');
 if(Object.keys(input).some(key=>!Object.hasOwn(base,key)))fail('包含未知的风格参数');
 const out={...base};
 for(const key of Object.keys(base)){
  const value=input[key];if(value===undefined)continue;
  if(ranges[key]){if(typeof value!=='number'||!Number.isFinite(value)||value<ranges[key][0]||value>ranges[key][1])fail('风格参数超出允许范围');}
  else if(choices[key]){if(!choices[key].includes(value))fail('风格选项不正确');}
  else if(typeof base[key]==='boolean'){if(typeof value!=='boolean')fail('风格开关格式不正确');}
  else if(typeof value!=='string'||!/^#[\da-f]{6}$/i.test(value))fail('颜色须使用六位十六进制格式');
  out[key]=value;
 }
 return out;
}
async function ensure(db){
 if(!initializing.has(db)){
  const promise=(async()=>{
   // Also supports existing code-only installations before their next migration run.
   await db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "CockpitAppearance" ("id" TEXT NOT NULL PRIMARY KEY, "revision" INTEGER NOT NULL DEFAULT 0, "payload" TEXT NOT NULL, "updatedAt" TEXT NOT NULL)');
   await db.$executeRawUnsafe('INSERT OR IGNORE INTO "CockpitAppearance" ("id","revision","payload","updatedAt") VALUES (?,0,?,?)','global',JSON.stringify({styles:{platform:initial.platform,chain:initial.chain},presets:initial.presets}),new Date().toISOString());
  })().catch(error=>{initializing.delete(db);throw error;});
  initializing.set(db,promise);
 }
 await initializing.get(db);
}
async function readAppearance(db){
 await ensure(db);
 const [row]=await db.$queryRawUnsafe('SELECT "revision","payload","updatedAt" FROM "CockpitAppearance" WHERE "id"=?','global');
 const payload=JSON.parse(row.payload);
 // Fill newly introduced controls without overwriting existing shared colors or incrementing the revision.
 const styles={platform:{...initial.platform,...payload.styles.platform},chain:{...initial.chain,...payload.styles.chain}};
 return {revision:row.revision,updatedAt:row.updatedAt,styles,presets:payload.presets.map(p=>({...p,style:{...initial[p.view],...p.style}}))};
}
async function changeAppearance(db,input,change){
 if(!input||typeof input!=='object'||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)fail('缺少有效的风格版本，请重新读取后保存');
 const current=await readAppearance(db);
 if(current.revision!==input.expectedRevision)fail('其他浏览器已更新设置，已保留你的预览，请再次保存','CONFLICT');
 const next=change(current);
 const count=await db.$executeRawUnsafe('UPDATE "CockpitAppearance" SET "revision"="revision"+1,"payload"=?,"updatedAt"=? WHERE "id"=? AND "revision"=?',JSON.stringify({styles:next.styles,presets:next.presets}),new Date().toISOString(),'global',current.revision);
 if(count!==1)fail('其他浏览器已更新设置，已保留你的预览，请再次保存','CONFLICT');
 return readAppearance(db);
}
function saveAppearance(db,input){return changeAppearance(db,input,current=>{
 const view=validView(input.view),style=cleanStyle(input.style,view);
 if(typeof input.both!=='boolean')fail('请选择风格应用范围');
 return {...current,styles:input.both?{platform:{...style},chain:{...style}}:{...current.styles,[view]:style}};
});}
function savePreset(db,input){return changeAppearance(db,input,current=>{
 const view=validView(input.view),style=cleanStyle(input.style,view);
 if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>20||/[\u0000-\u001f]/.test(input.name))fail('预设名称须为 1 至 20 个字符');
 const name=input.name.trim(),old=current.presets.find(p=>p.name===name);
 if(!old&&current.presets.length>=12)fail('最多保存 12 个预设，请先删除不需要的预设');
 const item={id:old?.id||randomUUID(),name,view,style};
 return {...current,presets:old?current.presets.map(p=>p.id===old.id?item:p):[...current.presets,item]};
});}
function deletePreset(db,id,input){return changeAppearance(db,input,current=>{
 if(typeof id!=='string'||id.length>80||!current.presets.some(p=>p.id===id))fail('该预设已不存在，请刷新预设列表','NOT_FOUND');
 return {...current,presets:current.presets.filter(p=>p.id!==id)};
});}
module.exports={readAppearance,saveAppearance,savePreset,deletePreset,cleanStyle};
