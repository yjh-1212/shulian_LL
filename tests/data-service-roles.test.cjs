const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const vue=require('vue');
const {parse,compileScript,compileTemplate}=require('@vue/compiler-sfc');
require('reflect-metadata');

// Compile current sources in memory so these checks never need a server, a build or a database.
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,file);
const {DataService}=require('../apps/api/src/data-service.ts');
const allPermissions=['data:read','data:write','data:subscribe','data-service:apply'];
const actor=(type,id=type.toLowerCase(),permissions=allPermissions)=>({user:{id:id+'-user',businessEntityId:id,displayName:'业务负责人',permissions,businessEntity:{type,name:id+'企业'}}});
const day=n=>new Date(Date.now()+n*86400000);
const product={id:'credit-product',dataset:'CREDIT',status:'PUBLISHED',version:1,name:'承运主体信用画像',fields:'["providerCode","providerName"]',serviceMode:'BOTH'};
const requestInput=()=>({productId:product.id,department:'物流业务部',applicationName:'粮食运输管理系统',scenarios:['合作评估'],purpose:'用于本企业评估物流供应商的履约能力',edition:'BASIC',scope:'PUBLIC',startsAt:day(-1).toISOString(),expiresAt:day(90).toISOString(),accepted:true});
const noDatabase=new Proxy({}, {get(_target,key){throw new Error('Unexpected database access: '+String(key));}});
const denied=e=>e.getStatus?.()===403;
const silentAudit={write:async()=>{}};

test('platform cannot apply or perform applicant actions even with every generic permission',async()=>{
 const s=new DataService(noDatabase,silentAudit),r=actor('PLATFORM');
 for(const action of [()=>s.request(null,r),()=>s.withdraw('request',{version:1,status:'WITHDRAWN'},r),()=>s.subscribe(null,r),()=>s.subscriptions(r),()=>s.rotate('subscription',{version:1,status:'ACTIVE'},r),()=>s.state('dataSubscription','subscription',{version:1,status:'PAUSED'},r),()=>s.call('subscription',undefined,r)])await assert.rejects(action,denied);
});
test('other entity types cannot enter the enterprise applicant flow',async()=>{
 const s=new DataService(noDatabase,silentAudit);
 for(const type of ['DRIVER','BUYER','UNKNOWN'])await assert.rejects(()=>s.request(requestInput(),actor(type)),denied);
});
for(const type of ['TRADER','CARRIER'])test(type+' creates its own request without choosing another applicant',async()=>{
 const created=[],r=actor(type);
 const tx={dataAccessRequest:{findFirst:async()=>null,create:async({data})=>{created.push(data);return {id:'request',version:1,...data};}}};
 const s=new DataService({dataProduct:{findUnique:async()=>product},$transaction:async fn=>fn(tx)},silentAudit);
 const x=await s.request({...requestInput(),entityId:'other-enterprise'},r);
 assert.equal(x.entityId,r.user.businessEntityId);
 assert.equal(x.userId,r.user.id);
 assert.equal(created.length,1);
 assert.equal(x.scope,'PUBLIC');
});
test('trader and carrier cannot review even with platform write permissions',async()=>{
 const s=new DataService(noDatabase,silentAudit);
 for(const type of ['TRADER','CARRIER'])await assert.rejects(()=>s.review('request',{version:1,status:'APPROVED',note:'授权审核通过'},actor(type)),denied);
 await assert.rejects(()=>s.review('request',{},actor('PLATFORM','platform',['data:read','data:subscribe'])),denied);
});
function reviewing({scope='PUBLIC',entityType='TRADER'}={}){
 const grants=[];
 const x={id:'request',productId:product.id,productVersion:1,product,version:1,status:'PENDING',entityId:'applicant',scope,edition:'BASIC',purpose:requestInput().purpose,startsAt:day(-1),expiresAt:day(30),constraints:'{"edition":"BASIC"}'};
 const tx={dataAccessRequest:{findUnique:async()=>x,update:async({data})=>({...x,...data})},businessEntity:{findFirst:async({where})=>where.type.in.includes(entityType)?{id:'applicant',type:entityType}:null},dataAuthorization:{create:async({data})=>{grants.push(data);return {id:'grant',...data};}}};
 return {s:new DataService({$transaction:async fn=>fn(tx)},silentAudit),grants};
}
test('platform review issues only the requested scope and approved edition quota',async()=>{
 const {s,grants}=reviewing();
 const reviewed=await s.review('request',{version:1,status:'APPROVED',note:'业务用途及公共范围审核通过',dailyLimit:60},actor('PLATFORM'));
 assert.equal(reviewed.status,'APPROVED');assert.equal(grants.length,1);
 assert.equal(grants[0].entityId,'applicant');assert.equal(grants[0].scope,'PUBLIC');
 assert.equal(grants[0].fields,product.fields);assert.equal(grants[0].dailyLimit,60);
 assert.deepEqual(JSON.parse(grants[0].constraints),{edition:'BASIC'});
});
test('review cannot widen a product scope, exceed quota or authorize the platform itself',async()=>{
 for(const settings of [{scope:'OWN'},{entityType:'PLATFORM'},{}]){
  const {s,grants}=reviewing(settings);
  await assert.rejects(()=>s.review('request',{version:1,status:'APPROVED',note:'授权审核通过',dailyLimit:Object.keys(settings).length?60:101},actor('PLATFORM')),e=>e.getStatus?.()===400);
  assert.equal(grants.length,0);
 }
});
test('an applicant can subscribe only to its own valid authorization',async()=>{
 const r=actor('TRADER'),created=[];
 const authorization={id:'grant',entityId:r.user.businessEntityId,status:'ACTIVE',startsAt:day(-1),expiresAt:day(30),product,productVersion:1,dailyLimit:100};
 const tx={dataSubscription:{findFirst:async()=>null,create:async({data})=>{created.push(data);return {id:'subscription',...data};}}};
 const s=new DataService({dataAuthorization:{findUnique:async()=>authorization},$transaction:async fn=>fn(tx)},silentAudit);
 const input={authorizationId:'grant',name:'信用画像接口',frequency:'按需',mode:'API',dailyLimit:50};
 await assert.rejects(()=>s.subscribe(input,actor('CARRIER')),e=>e.getStatus?.()===404);assert.equal(created.length,0);
 const subscription=await s.subscribe(input,r);assert.equal(created.length,1);assert.match(subscription.key,/^gds_/);assert.equal(subscription.keyHash,undefined);assert.equal(subscription.dailyLimit,50);
});

const viewPath=path.resolve(__dirname,'../apps/web/src/views/DataService.vue');
const descriptor=parse(fs.readFileSync(viewPath,'utf8'),{filename:viewPath}).descriptor;
const script=compileScript(descriptor,{id:'data-service-roles'});
const clientCode=ts.transpileModule(script.content,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
function client(type,query={}){
 const mounted=[],gets=[],posts=[],messages=[],replaces=[];
 const r=actor(type),auth={user:r.user,can:p=>r.user.permissions.includes(p)};
 const mod=new Module(viewPath,module);mod.filename=viewPath;mod.paths=Module._nodeModulePaths(path.dirname(viewPath));
 const stub={};
 mod.require=id=>{
  if(id==='vue')return {...vue,onMounted:fn=>mounted.push(fn),watch:()=>{}};
  if(id==='vue-router')return {useRoute:()=>({query}),useRouter:()=>({replace:target=>replaces.push(target),push:()=>{}})};
  if(id==='element-plus')return {ElMessage:{info:x=>messages.push(x),success:()=>{},error:()=>{}},ElMessageBox:{confirm:async()=>{}}};
  if(id==='../stores/auth')return {useAuth:()=>auth};
  if(id==='../api')return {get:async p=>{gets.push(p);return p==='/data/options'?{editions:[{id:'BASIC',name:'基础版',dailyLimit:100}],waybills:[],datasets:{}}:[];},api:{post:async(p,data)=>{posts.push({p,data});return {data:{data:{id:'request',key:'test-local-only'}}};}},message:e=>e.message};
  if(id.endsWith('.vue'))return {default:stub};
  if(id==='../data-fields')return {dataFieldLabels:{},fieldDescription:()=>''};
  return require(id);
 };
 mod._compile(clientCode,viewPath);
 return {state:mod.exports.default.setup({}, {expose:()=>{}}),mounted,gets,posts,messages,replaces};
}
test('the complete data-service Vue template compiles after the role guards',()=>{
 const result=compileTemplate({source:descriptor.template.content,id:'data-service-roles',filename:viewPath,compilerOptions:{bindingMetadata:script.bindings}});
 assert.deepEqual(result.errors,[]);
});
test('platform UI has review and management, without applicant tabs or actions',async()=>{
 const c=client('PLATFORM',{tab:'subscriptions'}),s=c.state;
 assert.equal(s.platform.value,true);assert.equal(s.applicant.value,false);
 assert.deepEqual(s.tabs.value.map(t=>t[0]),['catalog','scenarios','authorizations','operations','products']);
 assert.equal(s.recordTab.value,'grants');
 for(const fn of c.mounted)await fn();
 assert.equal(s.tab.value,'catalog');assert.equal(c.gets.includes('/data/subscriptions'),false);
 s.beginApply({...product,profile:{scopes:['PUBLIC']}});await s.submitApply();s.beginSubscribe({});await s.saveSubscribe();s.manage({});
 assert.equal(s.applyOpen.value,false);assert.equal(s.subscribeOpen.value,false);assert.equal(s.serviceOpen.value,false);assert.equal(c.posts.length,0);
 s.switchTab('operations');assert.equal(s.tab.value,'operations');
});
for(const type of ['TRADER','CARRIER'])test(type+' UI keeps the applicant flow without acquiring platform administration',async()=>{
 const c=client(type),s=c.state;
 assert.equal(s.platform.value,false);assert.equal(s.applicant.value,true);
 assert.deepEqual(s.tabs.value.map(t=>t[0]),['catalog','scenarios','authorizations','subscriptions']);
 assert.equal(s.recordTab.value,'requests');
 for(const fn of c.mounted)await fn();assert.equal(c.gets.includes('/data/subscriptions'),true);
 s.beginApply({...product,profile:{scopes:['PUBLIC']}});assert.equal(s.applyOpen.value,true);
 Object.assign(s.application.value,{department:'物流业务部',scenarios:['合作评估'],purpose:'用于本企业评估物流供应商的履约能力',accepted:true});
 s.confirmApply();assert.equal(s.applyStep.value,1);await s.submitApply();
 assert.equal(c.posts.length,1);assert.equal(c.posts[0].p,'/data/requests');assert.equal(s.applyStep.value,2);
 s.switchTab('products');assert.equal(s.tab.value,'catalog');
});
