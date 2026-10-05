const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
require('dotenv').config();
const db=new PrismaClient(),base='http://127.0.0.1:3001/api',created=[];
async function login(username){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:process.env.SEED_PASSWORD})});assert.equal(r.status,201);return (await r.json()).data;}
async function call(token,method,path,body,status=method==='POST'?201:200){const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const json=await r.json();assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(json)}`);return json.data||json;}
async function main(){
 const carrier=await login('carrier'),other=await login('carrier.b'),trader=await login('trader');
 const options=await call(carrier.accessToken,'GET','/transport-options');
 const payload={modeId:options.modes[0].id,originCodes:['210000','211100'],destinationCodes:['440000','440100'],minQuantity:1,maxQuantity:100,grainIds:[options.grains[0].id],loadingType:'BULK',bulkPrice:123.45,contact:'供给验收联系人',phone:'13800000001',notes:'TEST-SUPPLY-FORM-'+Date.now()};
 const create=async p=>{const row=await call(carrier.accessToken,'POST','/transport-supplies',p);created.push(row.id);return row;};
 for(const changes of [{minQuantity:101},{minQuantity:null},{maxQuantity:null},{minQuantity:.0001},{originCodes:['210000','440100']},{bulkPrice:null},{bulkPrice:0},{bulkPrice:-1},{bulkPrice:1.234},{loadingType:'CONTAINER',container20Price:1000},{loadingType:'CONTAINER',container20Price:0,container40Price:2000}])await call(carrier.accessToken,'POST','/transport-supplies',{...payload,...changes},400);
 console.log('PASS 城市编码、数量范围及各装载形式报价校验');
 let bulk=await create({...payload,name:'不可伪造的运输企业'});
 assert.equal(bulk.name,carrier.user.businessEntity.name);assert.equal(bulk.businessEntityId,carrier.user.businessEntityId);assert.deepEqual(bulk.originCodes,payload.originCodes);assert.equal(bulk.originRegion,'辽宁省 / 盘锦市');assert.equal(bulk.minQuantity,1);assert.equal(bulk.maxQuantity,100);assert.equal(bulk.capacity,100);assert.equal(bulk.bulkPriceCents,12345);assert.equal(bulk.bulkPrice,123.45);assert.equal(bulk.resourceDescription,'');assert.equal(bulk.originAddress,'');assert.equal(bulk.destinationAddress,'');for(const field of ['serviceStart','serviceEnd','validFrom','validUntil'])assert.equal(bulk[field],null);
 await call(other.accessToken,'GET','/transport-supplies/'+bulk.id,undefined,404);await call(trader.accessToken,'POST','/transport-supplies',payload,403);
 const publish=async row=>{await call(carrier.accessToken,'POST','/transport-supplies/'+row.id+'/publish',{version:row.version});return call(carrier.accessToken,'GET','/transport-supplies/'+row.id);};
 bulk=await publish(bulk);
 let container=await create({...payload,minQuantity:200,maxQuantity:500,loadingType:'CONTAINER',bulkPrice:999,container20Price:1500.25,container40Price:2400.75,grainIds:[]});container=await publish(container);
 assert.equal(container.bulkPrice,null);assert.equal(container.container20PriceCents,150025);assert.equal(container.container40PriceCents,240075);assert.equal(container.referencePrice,null);
 assert.equal((await call(trader.accessToken,'GET','/transport-supplies/'+bulk.id)).bulkPrice,123.45);
 const matches=await call(trader.accessToken,'GET','/matches/supplies?carrierId='+carrier.user.businessEntityId+'&pageSize=100&departureFrom=2026-10-04T00%3A00%3A00%2B08%3A00&departureTo=2026-10-06T00%3A00%3A00%2B08%3A00');
 assert.ok(matches.items.some(s=>s.id===bulk.id&&s.bulkPriceCents===12345));assert.ok(matches.items.some(s=>s.id===container.id&&s.container20PriceCents===150025&&s.container40PriceCents===240075));
 const ranges=await call(trader.accessToken,'GET','/matches/supplies?carrierId='+carrier.user.businessEntityId+'&pageSize=100&minQuantity=50&maxQuantity=60');assert.ok(ranges.items.some(s=>s.id===bulk.id));assert.ok(!ranges.items.some(s=>s.id===container.id));
 console.log('PASS 企业名称自动绑定、选填资源说明、无时间窗口发布、散货/20GP/40GP报价及匹配范围');
 await call(carrier.accessToken,'POST','/transport-supplies/'+bulk.id+'/pause',{version:bulk.version});bulk=await call(carrier.accessToken,'GET','/transport-supplies/'+bulk.id);
 const paused=await call(trader.accessToken,'GET','/matches/supplies?carrierId='+carrier.user.businessEntityId+'&pageSize=100');assert.ok(!paused.items.some(s=>s.id===bulk.id));
 const changed=await call(carrier.accessToken,'PUT','/transport-supplies/'+bulk.id,{...payload,version:bulk.version,loadingType:'CONTAINER',container20Price:1600,container40Price:2600});assert.equal(changed.bulkPrice,null);assert.equal(changed.container20Price,1600);assert.equal(changed.status,'PAUSED');
 await call(carrier.accessToken,'PUT','/transport-supplies/'+bulk.id,{...payload,version:bulk.version},409);
 await call(carrier.accessToken,'POST','/transport-supplies/'+container.id+'/expire',{version:container.version});const ended=await call(trader.accessToken,'GET','/matches/supplies?carrierId='+carrier.user.businessEntityId+'&pageSize=100');assert.ok(!ended.items.some(s=>s.id===container.id));
 console.log('PASS 跨企业隔离、暂停/终止下架、切换装载形式清理报价及并发版本校验');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(created.length){await db.supplyGrain.deleteMany({where:{supplyId:{in:created}}});await db.transportSupply.deleteMany({where:{id:{in:created}}});}await db.$disconnect();});
