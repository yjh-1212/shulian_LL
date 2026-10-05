const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
require('dotenv').config();
const db=new PrismaClient(),base='http://127.0.0.1:3001/api';
async function login(username){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:process.env.SEED_PASSWORD})});assert.equal(r.status,201);return (await r.json()).data.accessToken;}
async function call(token,path,body,status=body?201:200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,status,path);return (await r.json()).data;}
async function main(){
  const trader=await login('trader'),other=await login('trader.b'),carrier=await login('carrier'),admin=await login('admin');
  const samples=await call(trader,'/trade-orders?q=JY20261002&pageSize=100');assert.equal(samples.total,10);
  const expected=[['玉米','二等',5000,'辽宁省盘锦市双台子区粮食储备库'],['玉米','一等',3200,'吉林省四平市铁西区粮食储备库'],['大豆','三等',2800,'黑龙江省绥化市北林区粮库'],['稻谷','二等',4500,'黑龙江省佳木斯市郊区粮食储备库'],['小麦','一等',3600,'辽宁省锦州市太和区粮食储备库'],['玉米','三等',6200,'内蒙古自治区通辽市科尔沁区粮库'],['大豆','二等',2100,'黑龙江省黑河市爱辉区粮食储备库'],['稻谷','一等',4000,'吉林省松原市宁江区粮食储备库'],['小麦','二等',3000,'辽宁省营口市大石桥市粮食储备库'],['玉米','二等',5500,'黑龙江省哈尔滨市双城区粮食储备库']];
  expected.forEach(([grain,grade,quantity,address],i)=>{const row=samples.items.find(r=>r.tradeOrder.businessNo==='JY20261002'+String(i+1).padStart(4,'0'));assert.ok(row);assert.deepEqual([row.grain.label,row.grainGrade,row.quantity,row.pickupAddress],[grain,grade,quantity,address]);assert.equal(row.pickupCodes.length,3);assert.equal(row.remainingQuantity,row.quantity-row.reservedQuantity);});
  console.log('PASS 十条订单的品种、等级、吨数、提货地址及数量余额');
  const first=await call(trader,'/trade-orders?pageSize=10');assert.ok(first.items.every(r=>r.tradeOrder.businessNo.startsWith('JY20261002')));
  assert.equal((await call(other,'/trade-orders?q=JY20261002')).total,0);await call(carrier,'/trade-orders',undefined,403);
  assert.equal((await call(trader,'/trade-orders?q='+encodeURIComponent('哈尔滨市双城区'))).items[0].tradeOrder.businessNo,'JY202610020010');
  console.log('PASS 新订单首页展示、企业隔离和提货地址搜索');
  const stamp=Date.now(),businessNo='TEST-ORDER-FIELDS-'+stamp;
  const body={businessNo,businessEntityId:'trader-a',recipient:'验收收货单位',shipperContact:'验收联系人',shipperPhone:'13800000001',recipientContact:'验收联系人',recipientPhone:'13800000002',sourceSystem:'order-fields-test',sourceRecordId:String(stamp),items:[{lineNo:'1',grainId:samples.items[0].grainId,cargoName:'验收玉米',specification:'一等',grainGrade:'一等',quantity:12.5,pickupAddress:'辽宁省盘锦市双台子区验收仓库',pickupCodes:['210000','211100','211102']}]};
  try{
    await call(admin,'/trade-orders/import',{...body,sourceRecordId:String(stamp)+'-invalid',items:[{...body.items[0],pickupCodes:['000000','000000','000000']}]},400);
    const imported=await call(admin,'/trade-orders/import',body);assert.equal((await call(admin,'/trade-orders/import',body)).id,imported.id);
    const row=(await call(trader,'/trade-orders?q='+businessNo)).items[0];assert.equal(row.quantity,12.5);assert.equal(row.grainGrade,'一等');assert.deepEqual(row.pickupCodes,body.items[0].pickupCodes);
    await call(admin,'/trade-orders/import',{...body,items:[{...body.items[0],pickupAddress:'不同的地址'}]},409);
    console.log('PASS 新字段导入、区划验证、重复导入和来源冲突保护');
  }finally{const order=await db.tradeOrder.findUnique({where:{businessNo}});if(order){await db.tradeOrderItem.deleteMany({where:{tradeOrderId:order.id}});await db.tradeOrder.delete({where:{id:order.id}});}}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
