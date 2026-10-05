require('tsx/cjs');
const assert=require('node:assert/strict');
const {buildGanttGroups}=require('../apps/web/src/intermodal-gantt.ts');
const {IntermodalService}=require('../apps/api/dist/intermodal.service.js');
const {report}=require('./helpers789.cjs');
const start='2026-10-03T00:00:00Z',end='2026-10-05T00:00:00Z';
const stage={id:'road',sequence:1,mode:'ROAD',origin:'盘锦粮库',destination:'营口港',status:'DRAFT',plannedStartAt:start,plannedEndAt:end,boxes:'[]',tasks:[],quantityKg:6000};
const results=[];
(async()=>{
  const allocations=Array.from({length:6},(_,i)=>({vehicleId:'v'+i,vehicle:{plate:'辽A1000'+i},driver:{displayName:'司机'+i},quantityKg:1000,startAt:`2026-10-03T0${i}:00:00Z`,endAt:`2026-10-04T0${i}:00:00Z`}));
  const drafts=buildGanttGroups([{...stage,allocations}])[0];
  assert.equal(drafts.vehicleCount,6);assert.equal(drafts.rows.length,6,'多车草稿不能截断车辆');
  assert.equal(drafts.rows[5].name,'辽A10005');assert.equal(drafts.rows[5].detail,'司机5 · 待过磅');
  assert.equal(drafts.rows[5].start,allocations[5].startAt);assert.equal(drafts.rows[5].end,allocations[5].endAt);assert.equal(drafts.rows[5].statusLabel,'待提交');
  const inline=buildGanttGroups([{...stage,allocations:[{plate:'吉B20001',quantityKg:6000}]}])[0];
  assert.equal(inline.rows[0].name,'吉B20001');assert.equal(inline.rows[0].start,start);assert.equal(inline.rows[0].end,end);
  results.push({name:'草稿逐车展示，支持超过五辆车、临时车牌及每车计划时间',result:'PASS'});

  const tasks=[
    {id:'t1',vehicleId:'v0',vehicle:{plate:'辽A10000'},driver:{displayName:'司机0'},quantityKg:0,unloadedKg:2800,status:'COMPLETED',businessNo:'RW1',plannedStartAt:allocations[0].startAt,plannedEndAt:allocations[0].endAt,events:[{type:'COMPLETE',createdAt:end,payload:{actualEndAt:'2026-10-04T01:00:00Z'}}]},
    {id:'t2',vehicleId:'v1',resource:'辽A10001',driver:{displayName:'司机1'},quantityKg:0,unloadedKg:3200,status:'RECEIVED',feedbackSubmittedAt:end,plannedStartAt:allocations[1].startAt,plannedEndAt:allocations[1].endAt},
    {id:'t3',vehicleId:'v0',resource:'辽A10000',quantityKg:0,status:'IN_TRANSIT',plannedStartAt:allocations[2].startAt,plannedEndAt:allocations[2].endAt}
  ];
  const submitted=buildGanttGroups([{...stage,status:'SUBMITTED',allocations,tasks,actualEndAt:end}])[0];
  assert.equal(submitted.rows.length,3,'提交后不能再重复展示分配草稿');assert.equal(submitted.vehicleCount,2,'同车多趟应区分车辆数和任务数');
  assert.equal(submitted.rows[0].actual,'2026-10-04T01:00:00Z');assert.equal(submitted.rows[1].statusLabel,'已回传 · 待确认');
  assert.equal(submitted.rows[0].detail,'司机0 · 已回传 2.8 吨');assert.equal(submitted.rows[1].detail,'司机1 · 已回传 3.2 吨');assert.equal(submitted.rows[2].detail,'司机待分配 · 待过磅');
  assert.equal(submitted.rows[2].statusLabel,'运输中');assert.equal(submitted.rows[2].actual,undefined);assert.notEqual(submitted.rows[0].start,submitted.rows[1].start);
  const mixed=buildGanttGroups([{...stage,allocations},{...stage,id:'water',sequence:2,mode:'WATER',vessel:'粮运一号',voyage:'V001'},{...stage,id:'rail',sequence:3,mode:'RAIL',railWaybillNo:'TL001'}]);
  assert.equal(mixed[1].rows[0].name,'粮运一号');assert.equal(mixed[2].rows[0].name,'TL001');
  results.push({name:'提交后每车任务时间与状态独立，保留铁路和水运分组',result:'PASS'});

  const queries={};
  const db={fleetVehicle:{findMany:async q=>{queries.vehicles=q;return [{id:'v0',carrierId:'carrierA',plate:'辽A10000'},{id:'foreignV',carrierId:'carrierB',plate:'外企车牌'}];}},user:{findMany:async q=>{queries.drivers=q;return [{id:'d0',businessEntityId:'carrierA',displayName:'本企业司机',phone:'模拟电话'},{id:'foreignD',businessEntityId:'carrierB',displayName:'外企司机',phone:'外企电话'}];}},bill:{findMany:async()=>[]}};
  const service=new IntermodalService(db,null,null,null,null);
  const business={id:'businessA',status:'PENDING',segments:'[]',package:{carrierId:'carrierA',status:'EFFECTIVE',snapshot:'{}'},stages:[{...stage,allocations:JSON.stringify([{vehicleId:'v0',driverId:'d0'},{vehicleId:'foreignV',driverId:'foreignD'}])}]};
  const enriched=(await service.views([business]))[0];
  assert.deepEqual(queries.vehicles.where.OR,[{carrierId:'carrierA',id:{in:['v0','foreignV']}}]);
  assert.deepEqual(queries.drivers.where.OR,[{businessEntityId:'carrierA',id:{in:['d0','foreignD']}}]);
  assert.equal(enriched.stages[0].allocations[0].vehicle.plate,'辽A10000');assert.equal(enriched.stages[0].allocations[0].driver.displayName,'本企业司机');
  assert.equal(enriched.stages[0].allocations[1].vehicle,undefined);assert.equal(enriched.stages[0].allocations[1].driver,undefined,'草稿引用不能泄漏其他企业资源');
  assert.equal(enriched.stages[0].allocations[0].driver.businessEntityId,undefined);assert.equal(enriched.readyToComplete,false);
  assert.deepEqual(await service.views([]),[]);
  results.push({name:'后端补齐草稿车辆和司机，按所属承运企业限制资源查询与返回',result:'PASS'});
  report('intermodal-gantt',results);results.forEach(v=>console.log('PASS '+v.name));
})().catch(e=>{console.error(e);process.exitCode=1;});
