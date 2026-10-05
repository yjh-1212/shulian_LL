const {assert,fs,login,report}=require('./helpers789.cjs');
(async()=>{const t=await login('trader'),c=await login('carrier');try{
const fixture=JSON.parse(fs.readFileSync('docs/acceptance/intermodal-workspace-fixture.json'));
let b=await t.call('GET','/billing/bills/'+fixture.bills[1].billId);
assert(['SENT','RECHECK'].includes(b.status));
b=await t.call('POST','/billing/bills/'+b.id+'/differences',{version:b.version,itemSequence:1,type:'AMOUNT',description:'本地验收重复费用来源与伪造来源校验',acceptedCents:b.items[0].finalCents});
const items=b.items.map(i=>({feeCode:i.feeCode,taskId:i.taskId||undefined,sourceId:i.sourceId,quantityMillis:i.quantityMillis,unit:i.unit,unitPriceCents:i.unitPriceCents,originalCents:i.originalCents,adjustmentCents:i.adjustmentCents,occurredAt:i.occurredAt,basis:i.basis}));
const dto={version:b.version,businessId:b.businessId,taskIds:b.tasks.map(t=>t.taskId),periodFrom:b.periodFrom,periodTo:b.periodTo,remark:b.remark,reason:'模拟差异核对，金额不变，保留来源',items};
await c.call('PUT','/billing/bills/'+b.id,{...dto,items:[...items,{...items[0]}]},400);
await c.call('PUT','/billing/bills/'+b.id,{...dto,items:items.map((i,n)=>n===0?{...i,sourceId:'foreign-fee-source'}:i)},400);
const unchanged=await c.call('GET','/billing/bills/'+b.id);assert.equal(unchanged.version,b.version);assert.equal(unchanged.totalCents,b.totalCents);
const edited=await c.call('PUT','/billing/bills/'+b.id,dto);assert.equal(edited.status,'RECHECK');assert.equal(edited.totalCents,b.totalCents);assert.deepEqual(edited.items.map(i=>i.sourceId),b.items.map(i=>i.sourceId));
report('intermodal-bill-sources',[{name:'重复或伪造费用来源拒绝，合法差异调整保留来源与金额',result:'PASS'}]);console.log('PASS 重复或伪造费用来源拒绝，合法差异调整保留来源与金额');
}finally{await t.logout();await c.logout();}})().catch(e=>{console.error(e);process.exitCode=1;});
