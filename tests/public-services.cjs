const assert=require('node:assert/strict'),fs=require('node:fs');require('dotenv').config();
const root='http://127.0.0.1:5173/api',results=[];
async function main(){
 const response=await fetch(root+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'trader',password:process.env.SEED_PASSWORD})});const login=(await response.json()).data;assert.ok(login?.accessToken);
 const cookie=response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
 async function call(method,path,body,status=method==='POST'?201:200){const r=await fetch(root+path,{method,headers:{Authorization:'Bearer '+login.accessToken,'Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.equal(r.status,status,path+': '+j.message);return j.data;}
 const pass=name=>{results.push({name,result:'PASS'});console.log('PASS',name);};
 const options=await call('GET','/plans/options');assert.ok(options.lines.some(l=>l.id==='public-rail-puhe-guangzhou-x8784'));assert.equal(options.lines.filter(l=>l.id.startsWith('public-')).length,3);
 const demands=await call('GET','/transport-demands?status=DRAFT&pageSize=100');const demand=demands.items.find(d=>d.originAddress==='盘锦站'&&d.destinationAddress==='广州北站');assert.ok(demand,'exact-address test demand required');
 const source=await call('GET','/plans/demand/'+demand.id+'/input');assert.equal(source.origin.name,'盘锦站');assert.equal(source.destination.name,'广州北站');assert.ok(source.origin.nodeId&&source.destination.nodeId);pass('需求地址自动匹配真实同城节点');
 const dto={demandId:source.demandId,demandVersion:source.demandVersion,grainId:source.grainId,cargoName:source.cargoName,quantity:source.quantity,origin:source.origin,destination:source.destination,departureAt:source.departureAt,modes:['ROAD','RAIL','WATER'],allowMultimodal:true,allowTransfer:true,maxTransfers:2,loadingType:'BULK',allowContainerization:true,preference:'COST'};
 const run=await call('POST','/plans/solve',dto);assert.equal(run.candidates.length,6);assert.ok(run.candidates.some(c=>c.modes.includes('RAIL')));assert.ok(run.candidates.some(c=>c.modes.includes('WATER')));
 for(const c of run.candidates.filter(c=>c.modes.some(m=>m!=='ROAD'))){assert.equal(c.costCents,null);assert.equal(c.costComplete,false);assert.equal(c.arrivalAt,null);assert.equal(c.scheduleComplete,false);assert.equal(c.recommendation,'');assert.equal(c.transferCount,2);assert.equal(c.knownCostCents,c.segments.reduce((n,s)=>n+(s.costCents||0),0));for(const s of c.segments){if(s.mode==='ROAD'){assert.ok(s.geometry.coordinates.length>3);}else{assert.equal(s.geometry,null);assert.ok(s.priceSnapshot.service.code);assert.ok(s.priceSnapshot.service.sourceUrl.startsWith('https://'));assert.equal(s.priceSnapshot.conversionRequired,true);assert.equal(s.costCents,null);if(s.mode==='WATER'){assert.equal(s.distanceMeters,null);assert.equal(c.distanceMeters,null);}}}}
 assert.ok(run.candidates[0].costComplete);pass('真实公铁/公水链路、待报价不伪装零元或参与完整价格排名、班期待确认');
 const restored=await call('GET','/plans/runs/'+run.id);assert.equal(restored.input.sourceDemand.businessNo,source.businessNo);assert.deepEqual(restored.input.sourceDemand.modes,source.modes);assert.equal(restored.candidates.find(c=>c.modes.includes('WATER')).distanceMeters,null);pass('来源约束、班线出处与未知指标随方案快照持久化');
 const disabled=await call('POST','/plans/solve',{...dto,allowContainerization:false});assert.ok(disabled.candidates.every(c=>c.modes.every(m=>m==='ROAD')));pass('关闭散粮入箱后排除集装箱班线');
 const restricted=await call('POST','/plans/solve',{...dto,allowTransfer:false,maxTransfers:0});assert.ok(restricted.candidates.every(c=>c.transferCount===0&&!c.modes.includes('RAIL')&&!c.modes.includes('WATER')));pass('禁止中转约束不会因公开班线而被绕过');
 const water=restored.candidates.find(c=>c.modes.includes('WATER'));await call('POST','/plans/runs/'+restored.id+'/select',{candidateId:water.id,revision:restored.revision});assert.equal((await call('GET','/plans/runs/'+restored.id)).selectedPlanId,water.id);pass('有条件的完整联运方案可保存选择');
 const config=await call('GET','/map/config');assert.equal(config.serviceHost,'/_AMapService');const proxy=await fetch('http://127.0.0.1:5173/_AMapService/v3/log/init');assert.equal(proxy.status,403);pass('地图根路径代理正常转发且无会话访问被拒绝');
 const lines=await call('GET','/transport-lines?pageSize=100');assert.equal(lines.items.find(l=>l.id==='public-water-pan-asia-ic9').distanceKm,null);pass('线路资料对缺失航程返回未知而非零公里');
 await call('POST','/auth/logout',{});
 fs.writeFileSync('docs/acceptance/public-services-results.json',JSON.stringify({at:new Date().toISOString(),runId:run.id,results},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
