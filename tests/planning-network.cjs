const assert=require('node:assert/strict');
const {findCorridorChains,modeFamily}=require('../apps/api/dist/planning-network');
const {validateAdvisorResponse,adviseCorridors}=require('../apps/api/dist/planning-advisor');
const p=(id,lng,lat)=>({id,nodeId:id,name:id,lng,lat});
const line=(id,mode,a,b)=>({id,mode,originId:a.id,destinationId:b.id,origin:a,destination:b,durationSeconds:86400,serviceInfo:'{}'});
const origin=p('grain',126,46),rail=p('rail',126,43.5),port=p('port',121,40.5),near=p('near-port',121.01,40.5),south=p('south',113,23);
const lines=[line('rail-to-port','RAIL',rail,port),line('sea','WATER',near,south),line('rail-south','RAIL',rail,south),line('loop','RAIL',port,rail)];
const dto={modes:['ROAD','RAIL','WATER'],maxTransfers:4,allowMultimodal:true};
let result=findCorridorChains(lines,origin,south,dto);
assert.ok(result.accessLimit>200000);
assert.ok(result.chains.some(c=>c.map(l=>l.id).join(',')==='rail-to-port,sea'));
assert.ok(!result.chains.some(c=>c.some(l=>l.id==='rail-to-port')&&c.some(l=>l.id==='loop')));
const families=result.chains.map(c=>modeFamily([...c.map(l=>l.mode),'ROAD']));
assert.ok(families.includes('ROAD+RAIL'));assert.ok(families.includes('ROAD+RAIL+WATER'));
assert.equal(findCorridorChains(lines,origin,south,{...dto,modes:['RAIL','WATER']}).chains.length,0);
assert.ok(!findCorridorChains(lines,origin,south,{...dto,maxTransfers:1}).chains.some(c=>c.length>1));
assert.ok(findCorridorChains([lines[0],line('same-port-sea','WATER',port,south)],rail,south,{...dto,modes:['RAIL','WATER']}).chains.some(c=>c.length===2));
assert.deepEqual(validateAdvisorResponse({lineIds:['sea','invented','sea',null]},lines),['sea']);
assert.throws(()=>validateAdvisorResponse({routes:[]},lines));
console.log('PASS 远距离集港、邻近站港接驳、公铁/公铁水组合、禁公路/中转限制、铁水衔接与模型线路白名单');
const {estimateSegment}=require('../apps/api/dist/planning-estimates');
const pricedLine={...lines[0],serviceInfo:JSON.stringify({planningEstimate:{railRatePerTonKm:.08,detourFactor:1.3,waitHours:24,handlingHours:6,reliability:93}})};
const first=estimateSegment(pricedLine,{quantity:100},true,true),next=estimateSegment(pricedLine,{quantity:100},true,false);
assert.equal(first.fees.length,next.fees.length+1);assert.ok(first.fees.every(f=>Math.abs(f.rate*1000-Math.round(f.rate*1000))<1e-8));
assert.equal(first.fees.reduce((n,f)=>n+f.costCents,0)-next.fees.reduce((n,f)=>n+f.costCents,0),120000);
console.log('PASS 测算单价保留千分位、区段费用汇总及全程装拆箱不重复收费');
(async()=>{
 const fetchOriginal=global.fetch,key=process.env.DEEPSEEK_API_KEY,base=process.env.DEEPSEEK_BASE_URL;
 try {
  process.env.DEEPSEEK_API_KEY='unit-test';process.env.DEEPSEEK_BASE_URL='https://example.com';let sent;
  global.fetch=async(url,opts)=>{sent=JSON.parse(opts.body);return {ok:true,json:async()=>({choices:[{message:{content:'{"lineIds":["sea","invented"]}'}}]})};};
  const advisor=await adviseCorridors({...dto,origin:{...origin,name:'PRIVATE-ADDRESS'},destination:south,allowModel:true,notes:'PRIVATE-NOTES',phone:'PRIVATE-PHONE'},lines);
  assert.equal(advisor.status,'SUCCEEDED');assert.deepEqual(advisor.lineIds,['sea']);
  assert.ok(!JSON.stringify(sent).includes('PRIVATE-'));assert.equal(sent.response_format.type,'json_object');
  global.fetch=async()=>{throw Error('offline');};assert.equal((await adviseCorridors({...dto,origin,destination:south,allowModel:true},lines)).status,'DEGRADED');
  assert.equal((await adviseCorridors({...dto,origin,destination:south,allowModel:false},lines)).status,'DISABLED');
  console.log('PASS 模型辅助结构校验、最少地区信息传输、模型故障回退及关闭时不调用');
 } finally {global.fetch=fetchOriginal;if(key===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=key;if(base===undefined)delete process.env.DEEPSEEK_BASE_URL;else process.env.DEEPSEEK_BASE_URL=base;}
})().catch(e=>{console.error(e);process.exitCode=1;});
