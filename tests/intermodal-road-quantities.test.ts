import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {roadResourceError,roadFeedbackQuantityError,type RoadFeedbackQuantity} from '../apps/api/src/intermodal-road-quantities';
const resource={driverId:'driver-one',vehicleId:'vehicle-one',capacityKg:32000};
const feedback:RoadFeedbackQuantity={quantityKg:28500,capacityKg:32000,stageQuantityKg:600000,contractQuantityKg:600000,otherReportedKg:571500,containerized:false,containers:[],grossKg:45200,tareKg:16700};
test('公路安排只校验车辆司机和核定载重，不预分配吨数',()=>{
 assert.equal(roadResourceError([resource,{...resource,driverId:'driver-two',vehicleId:'vehicle-two'}]),undefined);
 assert.equal(roadResourceError([]),'请添加车辆与司机');
 assert.match(roadResourceError([{...resource,capacityKg:0}])!,/核定载重/);
 assert.match(roadResourceError([resource,{...resource,driverId:'driver-two'}])!,/同一辆车/);
 assert.match(roadResourceError([resource,{...resource,vehicleId:'vehicle-two'}])!,/同一位司机/);
});
test('待过磅任务以磅单净重记实际量，可以恰好达到阶段合同总量',()=>{
 assert.equal(roadFeedbackQuantityError(feedback),undefined);
 assert.match(roadFeedbackQuantityError({...feedback,quantityKg:0})!,/实际签收/);
 assert.match(roadFeedbackQuantityError({...feedback,capacityKg:28000})!,/核定载重/);
});
test('按其他车辆已回传累计守住阶段及合同量，替换本人回传不重复累加',()=>{
 assert.match(roadFeedbackQuantityError({...feedback,otherReportedKg:571600})!,/阶段运输数量/);
 assert.match(roadFeedbackQuantityError({...feedback,contractQuantityKg:599900})!,/合同数量/);
 assert.equal(roadFeedbackQuantityError({...feedback,otherReportedKg:540000}),undefined);
});
test('散货必须以完整磅单净重校验实际量，不能把计划量当实际量',()=>{
 assert.match(roadFeedbackQuantityError({...feedback,grossKg:undefined,tareKg:undefined})!,/过磅/);
 assert.match(roadFeedbackQuantityError({...feedback,tareKg:undefined})!,/有效毛重/);
 assert.match(roadFeedbackQuantityError({...feedback,grossKg:45000})!,/净重/);
 assert.match(roadFeedbackQuantityError({...feedback,tareKg:46000})!,/毛重须大于皮重/);
});
test('集装箱以真实磅单净重校验箱重合计，并受载重与阶段上限约束',()=>{
 const c={...feedback,containerized:true,containers:[{boxNo:'MSCU1234567',quantityKg:14000},{boxNo:'MSCU7654321',quantityKg:14500}]};
 assert.equal(roadFeedbackQuantityError(c),undefined);
 assert.match(roadFeedbackQuantityError({...c,grossKg:undefined,tareKg:undefined})!,/过磅/);
 assert.match(roadFeedbackQuantityError({...c,containers:[]})!,/箱号/);
 assert.match(roadFeedbackQuantityError({...c,containers:[c.containers[0]]})!,/合计/);
 assert.match(roadFeedbackQuantityError({...c,containers:[c.containers[0],c.containers[0]]})!,/重复/);
 assert.match(roadFeedbackQuantityError({...c,containerized:false})!,/散货/);
});

const {IntermodalService}=createRequire(import.meta.url)('../apps/api/dist/intermodal.service.js');
test('提交公路阶段下发未知载重的车辆任务，无须车辆计划量',async()=>{
 const created:any[]=[],resources:any[]=[{id:'vehicle-one',plate:'辽A11111',capacityKg:32000},{id:'vehicle-two',plate:'辽A22222',capacityKg:32000}];
 const stage:any={id:'stage',version:1,status:'DRAFT',mode:'ROAD',sequence:1,quantityKg:600000,allocations:JSON.stringify([{vehicleId:'vehicle-one',driverId:'driver-one'},{vehicleId:'vehicle-two',driverId:'driver-two'}]),plannedStartAt:new Date('2026-10-01'),plannedEndAt:new Date('2026-10-03')};
 const business:any={id:'business',version:1,package:{status:'EFFECTIVE',carrierId:'carrier',snapshot:'{}'},stages:[stage]};
 const tx:any={user:{findFirst:async({where}:any)=>({id:where.id})},fleetVehicle:{findFirst:async({where}:any)=>resources.find(v=>v.id===where.id)},transportTask:{create:async({data}:any)=>{created.push(data);return data;}},transportStage:{update:async()=>({})},logisticsBusiness:{update:async()=>({})}};
 const service=new IntermodalService({$transaction:async(callback:any)=>callback(tx)},{write:async()=>{}},null,{owner:()=>{}},null);
 service.stage=async()=>({b:business,s:stage});
 await service.submit('stage',{version:1},{});
 assert.equal(created.length,2);assert.deepEqual(created.map(t=>t.quantityKg),[0,0]);
 assert.deepEqual(created.map(t=>t.vehicleId),['vehicle-one','vehicle-two']);assert.equal(created[0].driverId,'driver-one');
});
test('司机回传实际净重并冻结版本，保留计划量未知而守住磅单凭证',async()=>{
 const writes:any[]=[];const task:any={id:'task',stageId:'stage',version:2,status:'ACCEPTED',serviceManaged:true,vehicleId:'vehicle-one',quantityKg:0,evidence:[{category:'WEIGH'},{category:'RECEIPT'}]};
 const stage:any={id:'stage',version:3,status:'SUBMITTED',containerized:false,quantityKg:600000,tasks:[task,{id:'other',status:'RECEIVED',unloadedKg:571500}]};
 const business:any={id:'business',version:4,status:'IN_PROGRESS',package:{status:'EFFECTIVE',carrierId:'carrier',quantityKg:600000}};
 const tx:any={fleetVehicle:{findFirst:async()=>({capacityKg:32000})},transportStage:{update:async(v:any)=>writes.push(['stage',v])},logisticsBusiness:{update:async(v:any)=>writes.push(['business',v])},transportTask:{update:async(v:any)=>writes.push(['task',v])},executionEvent:{create:async(v:any)=>writes.push(['event',v])}};
 const service=new IntermodalService({$transaction:async(callback:any)=>callback(tx)},{write:async()=>{}},null,{driver:()=>true,task:async()=>task},null);
 service.stage=async()=>({b:business,s:stage});
 const dto:any={version:2,quantityKg:28500,grossKg:45200,tareKg:16700,weightTicketNo:'WEIGH-1',receiver:'收货人员',sealNo:'',note:'',containers:[]};
 await service.feedback('task',dto,{user:{id:'driver-one'}});
 const update=writes.find(v=>v[0]==='task')[1];assert.equal(update.data.loadedKg,28500);assert.equal(update.data.unloadedKg,28500);assert.equal(update.data.quantityKg,undefined);
 assert.deepEqual(writes.find(v=>v[0]==='stage')[1].where,{id:'stage',version:3});assert.deepEqual(writes.find(v=>v[0]==='business')[1].where,{id:'business',version:4});
 assert.equal(writes.find(v=>v[0]==='event')[1].data.source,'DRIVER_APP');
 writes.length=0;task.evidence=[{category:'RECEIPT'}];
 await assert.rejects(service.feedback('task',dto,{user:{id:'driver-one'}}),/实际磅单/);assert.equal(writes.length,0);
});
