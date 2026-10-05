const {assert,fs,login,report}=require('./helpers789.cjs');
(async()=>{const c=await login('carrier');try{
const old=JSON.parse(fs.readFileSync('docs/acceptance/contract-workspace-fixture.json'));
const billed=await c.call('GET','/intermodal/'+old.businessId);
assert(billed.bills.length);assert(billed.stages.every(s=>s.status==='COMPLETED'));
assert.equal(billed.readyToComplete,false,'已经出账的历史任务不能再次办理业务完成');
const fixture=JSON.parse(fs.readFileSync('docs/acceptance/intermodal-workspace-fixture.json'));
const completed=await c.call('GET','/intermodal/'+fixture.bulkBusinessId);
assert.equal(completed.status,'COMPLETED');assert.equal(completed.readyToComplete,false);
report('intermodal-readiness',[{name:'历史已出账及已完成运单不再提示或勾选业务完成',result:'PASS'}]);console.log('PASS 历史已出账及已完成运单不再提示或勾选业务完成');
}finally{await c.logout();}})().catch(e=>{console.error(e);process.exitCode=1;});
