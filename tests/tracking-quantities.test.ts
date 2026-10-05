import {test} from 'node:test';
import assert from 'node:assert/strict';
import {corridorProgress} from '../apps/api/src/tracking-quantities';

const task=(id:string,quantityKg=28500)=>({id,status:'RECEIVED',quantityKg:0,vehicleCapacityKg:32000,feedbackSubmittedAt:new Date(),feedback:{quantityKg,grossKg:quantityKg+16700,tareKg:16700,weightTicketNo:'P20261003-'+id,containers:[]},evidence:[{category:'WEIGH'},{category:'RECEIPT'}]});
const stage=(tasks:any[],extra:any={})=>({id:'road-port',mode:'ROAD',origin:'长春市',destination:'营口鲅鱼圈港',status:'SUBMITTED',quantityKg:600000,containerized:false,tasks,...extra});
test('未知车辆计划量为零，港口按实际磅单净重累计',()=>{
 const [p]=corridorProgress([stage([task('truck-1'),task('truck-2',28600)])],600000);
 assert.equal(p.reportedKg,57100);assert.equal(p.arrivedKg,57100);assert.equal(p.awaitingEvidenceKg,0);assert.equal(p.percent,10);assert.equal(p.tickets.length,2);
});
test('无实际回传时不把车辆计划量或核定载重计为集港量',()=>{
 const [p]=corridorProgress([stage([{...task('truck-1'),quantityKg:32000,feedbackSubmittedAt:null,feedback:{}}])],600000);
 assert.equal(p.reportedKg,0);assert.equal(p.arrivedKg,0);
});
test('初始化净重仅列为过磅回传待核对，没有凭证不能计已核验集港量',()=>{
 const t={...task('truck-1'),evidence:[],feedback:{...task('truck-1').feedback,sourceSystem:'BUSINESS_INITIALIZATION',dataProvenance:{type:'INITIALIZATION'}}};
 const [p]=corridorProgress([stage([t])],600000);
 assert.equal(p.reportedKg,28500);assert.equal(p.awaitingEvidenceKg,28500);assert.equal(p.arrivedKg,0);assert.equal(p.percent,0);assert.equal(p.unverifiedTasks,1);
});
test('初始化附件标记不充当已核验的真实凭证',()=>{
 const t={...task('truck-1'),evidence:[{category:'WEIGH',sourceSystem:'BUSINESS_INITIALIZATION'},{category:'RECEIPT',dataProvenance:{type:'INITIALIZATION'}}]};
 const [p]=corridorProgress([stage([t])],600000);
 assert.equal(p.reportedKg,28500);assert.equal(p.awaitingEvidenceKg,28500);assert.equal(p.arrivedKg,0);
});
test('回传净重不得超过车辆载重，缺车辆上限时仍有100吨安全上限',()=>{
 const [p]=corridorProgress([stage([task('over',32100),{...task('unknown',100100),vehicleCapacityKg:undefined}])],600000);
 assert.equal(p.reportedKg,0);assert.equal(p.arrivedKg,0);assert.equal(p.unverifiedTasks,2);
});
test('同阶段回传不得突破阶段或运单总量，不用截断来掩盖错误',()=>{
 const [p]=corridorProgress([stage([task('first',30000),task('second',30100)],{quantityKg:60000})],60000);
 assert.equal(p.reportedKg,30000);assert.equal(p.arrivedKg,30000);assert.match(p.warnings[0],/累计超过/);assert.equal(p.allArrived,false);
});
test('集装箱需要有效箱号、箱量合计和磅净重一致及全部单据',()=>{
 const base=task('container');
 const t={...base,feedback:{...base.feedback,sealNo:'F20261003001',containers:[{boxNo:'MSCU1234567',quantityKg:14000},{boxNo:'MSCU7654321',quantityKg:14500}]},evidence:[...base.evidence,{category:'EIR'}]};
 const [p]=corridorProgress([stage([t],{containerized:true})],600000);
 assert.equal(p.arrivedKg,28500);assert.equal(p.boxes.length,2);
 const [missing]=corridorProgress([stage([{...t,evidence:t.evidence.filter(e=>e.category!=='WEIGH')}],{containerized:true})],600000);
 assert.equal(missing.arrivedKg,0);assert.equal(missing.reportedKg,28500);assert.equal(missing.awaitingEvidenceKg,28500);
 const [wrong]=corridorProgress([stage([{...t,feedback:{...t.feedback,containers:[{boxNo:'MSCU1234567',quantityKg:14000}]}}],{containerized:true})],600000);
 assert.equal(wrong.reportedKg,0);
});
test('重复磅单和重复箱号不能重复计量，取消任务不占数量',()=>{
 const first=task('first'),second=task('second');second.feedback.weightTicketNo=first.feedback.weightTicketNo;
 const [bulk]=corridorProgress([stage([first,second,{...task('cancelled'),status:'CANCELLED'}])],600000);
 assert.equal(bulk.arrivedKg,28500);assert.equal(bulk.reportedKg,28500);assert.equal(bulk.taskIds.length,2);assert.match(bulk.warnings[0],/磅单.*重复/);
 const c=(t:any)=>({...t,feedback:{...t.feedback,sealNo:'seal',containers:[{boxNo:'MSCU1234567',quantityKg:28500}]},evidence:[...t.evidence,{category:'EIR'}]});
 second.feedback.weightTicketNo='P-SECOND';
 const [container]=corridorProgress([stage([c(first),c(second)],{containerized:true})],600000);
 assert.equal(container.arrivedKg,28500);assert.equal(container.boxes.length,1);assert.match(container.warnings[0],/箱号.*重复/);
});
test('无效磅净重或损坏回传不能作为待核对数量',()=>{
 const wrong={...task('wrong'),feedback:{...task('wrong').feedback,grossKg:40000}};
 const [p]=corridorProgress([stage([wrong,{...task('bad-json'),feedback:'{'},{...task('null-json'),feedback:'null'}])],600000);
 assert.equal(p.reportedKg,0);assert.equal(p.arrivedKg,0);assert.equal(p.unverifiedTasks,3);
});
test('同一粮食跨公路和水运各有独立台账，已验与待核对量可以并存',()=>{
 const waiting={...task('waiting'),evidence:[]};
 const road=stage([task('verified'),waiting]);
 const water=stage([{id:'vessel',status:'IN_TRANSIT',quantityKg:57000,loadedKg:57000}],{id:'water',mode:'WATER',origin:'营口鲅鱼圈港',destination:'广州新沙港'});
 const [a,b]=corridorProgress([road,water],600000);
 assert.equal(a.reportedKg,57000);assert.equal(a.arrivedKg,28500);assert.equal(a.awaitingEvidenceKg,28500);assert.equal(b.shippedKg,57000);assert.equal(b.arrivedKg,0);
});
