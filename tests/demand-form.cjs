const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
require('dotenv').config();
const db=new PrismaClient(),base='http://127.0.0.1:3001/api';
async function login(username){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:process.env.SEED_PASSWORD})});assert.equal(r.status,201);return (await r.json()).data.accessToken;}
async function call(token,method,path,body,status=method==='POST'?201:200){const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const json=await r.json();assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(json)}`);return json.data||json;}
async function main(){
 const trader=await login('trader'),admin=await login('admin'),stamp=Date.now(),businessNo='TEST-DEMAND-FORM-'+stamp;
 const opts=await call(trader,'GET','/transport-options');const grain=opts.grains.find(g=>g.code==='1');
 const order=await call(admin,'POST','/trade-orders/import',{businessNo,businessEntityId:'trader-a',recipient:'验收收货方',shipperContact:'验收联系人',shipperPhone:'13800000001',recipientContact:'验收联系人',recipientPhone:'13800000002',sourceSystem:'demand-form-test',sourceRecordId:String(stamp),items:[{lineNo:'1',grainId:grain.id,cargoName:'玉米',specification:'二等',grainGrade:'二等',quantity:10,pickupAddress:'辽宁省盘锦市双台子区验收粮库',pickupCodes:['210000','211100','211102']}]});
 try{
  const item=(await call(trader,'GET','/trade-orders?q='+businessNo)).items[0];
  const payload={orderItemId:item.id,quantity:6,originAddress:item.pickupAddress,destinationAddress:'广州市南沙区验收仓库',departureAt:new Date(Date.now()+86400000).toISOString(),arrivalAt:new Date(Date.now()+3*86400000).toISOString(),modeIds:[],loadingType:'BULK',contact:'验收联系人',phone:'13800000001',notes:'需求表单校验'};
  const balance=async()=> (await call(trader,'GET','/trade-orders?q='+businessNo)).items[0];
  const withoutArrival={...payload};delete withoutArrival.arrivalAt;await call(trader,'POST','/transport-demands',withoutArrival,400);
  const withoutDeparture={...payload};delete withoutDeparture.departureAt;await call(trader,'POST','/transport-demands',withoutDeparture,400);
  await call(trader,'POST','/transport-demands',{...payload,arrivalAt:null},400);
  await call(trader,'POST','/transport-demands',{...payload,arrivalAt:payload.departureAt},400);
  const pastDeparture=new Date(Date.now()-60000).toISOString();
  const pastResult=await call(trader,'POST','/transport-demands',{...payload,departureAt:pastDeparture},400);assert.match(JSON.stringify(pastResult),/计划发运时间必须晚于当前时间/);
  await call(trader,'POST','/transport-demands',{...payload,quantity:10.001},400);
  assert.equal((await balance()).reservedQuantity,0);console.log('PASS 两项时间必填、拒绝过去发运时间、先后顺序及单批订单上限');
  let first=await call(trader,'POST','/transport-demands',payload);assert.equal(first.name,'玉米 6吨');assert.equal(first.originAddress,item.pickupAddress);assert.deepEqual(first.originCodes,['210000','211100','211102']);assert.deepEqual(first.destinationCodes,['440000','440100','440115']);assert.equal(first.allowMultimodal,true);assert.equal(first.allowTransfer,true);
  await call(trader,'PUT','/transport-demands/'+first.id,{...payload,departureAt:pastDeparture,version:first.version},400);assert.equal((await balance()).reservedQuantity,6);
  const rejected=await call(trader,'POST','/transport-demands',{...payload,quantity:5},400);assert.match(JSON.stringify(rejected),/其他批次已占用 6 吨.*最多 4 吨/);
  let second=await call(trader,'POST','/transport-demands',{...payload,quantity:4});assert.equal((await balance()).reservedQuantity,10);
  await call(trader,'PUT','/transport-demands/'+first.id,{...payload,quantity:7,version:first.version},400);
  first=await call(trader,'PUT','/transport-demands/'+first.id,{...payload,quantity:5,version:first.version,originAddress:'可修改的起运仓库',destinationAddress:'可修改的卸货仓库'});assert.equal(first.quantity,5);assert.deepEqual(first.originCodes,[]);assert.deepEqual(first.destinationCodes,[]);assert.equal((await balance()).reservedQuantity,9);
  second=await call(trader,'PUT','/transport-demands/'+second.id,{...payload,quantity:5,version:second.version});assert.equal((await balance()).reservedQuantity,10);console.log('PASS 精简字段保存、地址可修改、分批累计及编辑自身额度');
  const byAddress=await call(trader,'GET','/transport-demands?origin='+encodeURIComponent('可修改的起运仓库')+'&destination='+encodeURIComponent('可修改的卸货仓库')+'&q='+encodeURIComponent('玉米'));assert.ok(byAddress.items.some(d=>d.id===first.id));
  await call(trader,'POST','/transport-demands/'+first.id+'/cancel',{version:first.version});assert.equal((await balance()).remainingQuantity,5);
  const concurrent=await Promise.all([1,2].map(()=>fetch(base+'/transport-demands',{method:'POST',headers:{Authorization:'Bearer '+trader,'Content-Type':'application/json'},body:JSON.stringify({...payload,quantity:5})})));
  assert.equal(concurrent.filter(r=>r.status===201).length,1);assert.equal((await balance()).reservedQuantity,10);console.log('PASS 自由地址筛选、取消释放额度及并发防止超额占用');
 }finally{
  await db.$transaction(async tx=>{const demands=await tx.transportDemand.findMany({where:{orderItem:{tradeOrderId:order.id}},select:{id:true}});await tx.demandMode.deleteMany({where:{demandId:{in:demands.map(d=>d.id)}}});await tx.transportDemand.deleteMany({where:{id:{in:demands.map(d=>d.id)}}});await tx.tradeOrderItem.deleteMany({where:{tradeOrderId:order.id}});await tx.tradeOrder.delete({where:{id:order.id}});});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
