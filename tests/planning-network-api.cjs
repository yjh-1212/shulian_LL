const assert=require('node:assert/strict');require('dotenv').config();const {PrismaClient}=require('@prisma/client');const db=new PrismaClient(),runs=[];
const base='http://127.0.0.1:3001/api';let token;
async function call(method,path,body){const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await res.json();assert.equal(res.status,method==='POST'?201:200,JSON.stringify(value).slice(0,600));return value.data;}
(async()=>{
 token=(await call('POST','/auth/login',{username:'trader',password:process.env.SEED_PASSWORD})).accessToken;
 const options=await call('GET','/plans/options');const grain=options.grains.find(g=>g.code==='1');
 const node=id=>{const n=options.nodes.find(n=>n.id===id);assert.ok(n,id);return {name:n.name,nodeId:n.id,lng:n.lng,lat:n.lat};};
 const departureAt=new Date(Date.now()+3*86400000).toISOString(),arrivalAt=new Date(Date.now()+24*86400000).toISOString();
 const defaults={grainId:grain.id,quantity:100,cargoName:'玉米',departureAt,arrivalAt,modes:['ROAD','RAIL','WATER'],allowMultimodal:true,allowTransfer:true,maxTransfers:4,loadingType:'BULK',allowContainerization:true,preference:'BALANCED',notes:'TEST-PLANNING-NETWORK'};
 const cases=[['哈尔滨→广州','corridor-node-harbin','amap-B0IR3HK9U0',true],['富锦→泉州','corridor-node-fujin','corridor-node-quanzhou',false],['通辽→南通','corridor-node-tongliao','corridor-node-nantong',false]];
 for(const [label,a,b,allowModel] of cases){
  const origin=node(a),destination=node(b);if(label.startsWith('哈尔滨')){delete origin.nodeId;origin.name='哈尔滨粮库验收位置';origin.lng+=.02;origin.lat+=.02;delete destination.nodeId;destination.name='广州粮库验收位置';destination.lng+=.02;}
  const r=await call('POST','/plans/solve',{...defaults,origin,destination,...(allowModel?{}:{allowModel:false})});runs.push(r.id);
  const families=[...new Set(r.candidates.map(c=>c.familyLabel))];assert.ok(r.candidates.some(c=>c.modes.length>1),label);
  for(const objective of ['RELIABILITY','COST','TIME']){const rec=r.recommendedPlans.find(c=>c.objectives.includes(objective));assert.ok(rec);assert.ok(r.candidates.find(c=>c.id===rec.candidateId).modes.length>1);}
  assert.ok(r.candidates.some(c=>c.modes.includes('RAIL')&&c.modes.includes('WATER')),label+' rail+water');
  for(const c of r.candidates)assert.equal(c.costCents,c.segments.reduce((sum,s)=>sum+(s.costCents||0),0));
  if(allowModel){assert.equal(r.input.solverInfo.advisor.status,'SUCCEEDED',JSON.stringify(r.input.solverInfo.advisor));assert.ok(r.input.solverInfo.advisor.lineIds.length);const log=await db.agentRun.findFirst({where:{contextId:r.id,contextType:'plan'}});assert.equal(log.status,'SUCCEEDED');}
  console.log('PASS',label,families.join(' / '),allowModel?'DeepSeek真实调用成功':'本地网络求解');
 }
 const r=await call('POST','/plans/solve',{...defaults,origin:node('corridor-node-wukeshu'),destination:node('amap-B0FFITHKX8'),allowModel:false,modes:['RAIL','WATER'],loadingType:'CONTAINER',containerType:'20GP',containerCount:4});runs.push(r.id);
 assert.ok(r.candidates.some(c=>c.family==='RAIL+WATER'));assert.ok(r.candidates.every(c=>!c.modes.includes('ROAD')));console.log('PASS 五棵树→南沙纯铁水联运，禁公路约束生效');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await db.agentResult.deleteMany({where:{run:{contextId:{in:runs},contextType:'plan'}}});await db.agentRun.deleteMany({where:{contextId:{in:runs},contextType:'plan'}});await db.planRun.deleteMany({where:{id:{in:runs}}});await db.$disconnect();});
