// Mutations only affect a SQLite copy, never the user's orders or demand records.
require('dotenv').config({quiet:true});require('reflect-metadata');
const fs=require('node:fs/promises'),path=require('node:path'),{strict:assert}=require('node:assert');
const {PrismaClient}=require('@prisma/client'),{validate}=require('class-validator'),{plainToInstance}=require('class-transformer');
const {TransportService}=require('../apps/api/dist/transport.service'),{PlanningService}=require('../apps/api/dist/planning.service');
const {DemandDto}=require('../apps/api/dist/transport.dto'),{AmapService,MapController,MapLocationQuery,MapSearchQuery}=require('../apps/api/dist/amap');
const {Audit}=require('../apps/api/dist/audit');
const live=new PrismaClient();let db;const proof={checkedAt:new Date().toISOString(),checks:[]};
function pass(text){proof.checks.push(text);console.log('PASS '+text);}
async function main(){
 const dir=path.resolve('.local/tests','demand-map-location-'+Date.now());await fs.mkdir(dir,{recursive:true});const copy=path.join(dir,'database.db');await live.$executeRawUnsafe(`VACUUM INTO '${copy.replace(/'/g,"''")}'`);db=new PrismaClient({datasources:{db:{url:'file:'+copy.replace(/\\/g,'/')}}});
 const req={user:{...await db.user.findUniqueOrThrow({where:{username:'trader'},include:{businessEntity:true}}),roles:[{code:'trader'}],permissions:['demand:read','demand:write']},headers:{},ip:'local',requestId:'isolated-location'};
 const other={...req,user:await db.user.findUniqueOrThrow({where:{username:'trader.b'},include:{businessEntity:true}})};
 const service=new TransportService(db,new Audit()),grain=await db.dictionary.findFirstOrThrow({where:{group:'粮食品种',label:'玉米'}}),node=await db.transportNode.findFirstOrThrow({where:{name:'南沙港',enabled:true,quality:{in:['PROVIDER','VERIFIED']}}});
 const originPoint={name:'吉林省长春市榆树市五棵树镇粮库装车口',matchedAddress:'吉林省长春市榆树市五棵树镇粮库装车口',province:'吉林省',city:'长春市',district:'榆树市',lng:126.121234,lat:44.801234,matchKind:'MAP'};
 const destinationPoint={name:node.address||node.name,nodeId:node.id,lng:110,lat:30,matchKind:'NODE'};
 const base={grainId:grain.id,specification:'二等玉米，水分≤14.0%',quantity:880.5,originAddress:originPoint.name,destinationAddress:destinationPoint.name,originPoint,destinationPoint,modeIds:[],loadingType:'BULK',departureAt:new Date(Date.now()+5*86400000).toISOString(),arrivalAt:new Date(Date.now()+15*86400000).toISOString(),contact:'运输业务部',phone:'00000000000'};
 assert.deepEqual(await validate(plainToInstance(DemandDto,base)),[]);
 for(const point of [{...originPoint,lng:999},{name:'缺少经纬度'},{...originPoint,lat:'44'}])assert.ok((await validate(plainToInstance(DemandDto,{...base,originPoint:point}))).some(e=>e.property==='originPoint'));
 let demand=await service.saveDemand(base,req);assert.deepEqual(demand.originPoint,originPoint);assert.equal(demand.destinationPoint.lng,node.lng);assert.equal(demand.destinationPoint.lat,node.lat);assert.equal(demand.originRegion,'吉林省 / 长春市 / 榆树市');
 const raw=await db.transportDemand.findUniqueOrThrow({where:{id:demand.id}});assert.equal(JSON.parse(raw.originPoint).lng,originPoint.lng);assert.equal(JSON.parse(raw.destinationPoint).nodeId,node.id);
 pass('选址坐标及地址信息持久保存；已核验节点使用服务端坐标');
 let geocodeCalls=0;const planner=new PlanningService(db,new Audit(),{locate:async()=>{geocodeCalls++;return originPoint;}},service);
 const input=await planner.demandInput(demand.id,req);assert.deepEqual(input.origin,originPoint);assert.equal(input.destination.lng,node.lng);assert.equal(geocodeCalls,0);assert.equal((await planner.demandInput(demand.id,req,false)).origin.lng,originPoint.lng);
 await assert.rejects(()=>planner.demandInput(demand.id,other),/无权访问/);
 pass('从需求进入求解直接沿用已确认位置，免重复解析，并保留企业归属校验');
 const {originPoint:unusedOrigin,destinationPoint:unusedDestination,...legacy}=base;
 demand=await service.saveDemand({...legacy,quantity:900.1,version:demand.version},req,demand.id);assert.deepEqual(demand.originPoint,originPoint);
 demand=await service.saveDemand({...legacy,originAddress:'吉林省长春市榆树市新的粮库装车口',version:demand.version},req,demand.id);assert.equal(demand.originPoint,null);assert.equal(demand.destinationPoint.nodeId,node.id);
 demand=await service.saveDemand({...base,originPoint:{...originPoint,lng:126.133333},version:demand.version},req,demand.id);assert.equal(demand.originPoint.lng,126.133333);
 demand=await service.saveDemand({...legacy,originPoint:null,destinationPoint:null,version:demand.version},req,demand.id);assert.equal(demand.originPoint,null);assert.equal(demand.destinationPoint,null);await planner.demandInput(demand.id,req);assert.ok(geocodeCalls>0);
 pass('原地址未变时保留坐标；改地址清除旧坐标；旧需求仍能解析定位');
 await assert.rejects(()=>service.saveDemand({...base,originPoint:{...originPoint,matchKind:'APPROXIMATE'}},req),/实际装卸位置/);
 await assert.rejects(()=>service.saveDemand({...base,originPoint:{...originPoint,nodeId:'missing-node'}},req),/节点不可用/);
 await assert.rejects(()=>service.saveDemand({...base,originPoint:{...originPoint,lng:999}},req),/实际装卸位置/);
 const options=await service.options(req);assert.ok(options.nodes.some(n=>n.id===node.id));assert.ok(options.nodes.every(n=>Number.isFinite(n.lng)&&Number.isFinite(n.lat)));
 pass('拒绝区域中心、无效坐标和失效节点；仅有需求编辑权限也可获得选址节点');
 const map=new AmapService(db);let providerCall;map.request=async(url,params)=>{providerCall={url,params};return {regeocode:{formatted_address:'广东省广州市南沙区港前大道',addressComponent:{province:'广东省',city:'广州市',district:'南沙区',adcode:'440115'}}};};
 const reversed=await map.reverse(113.673421,22.661234);assert.equal(reversed.lng,113.673421);assert.equal(reversed.matchKind,'MAP');assert.equal(reversed.matchedAddress,'广东省广州市南沙区港前大道');assert.equal(providerCall.url,'/v3/geocode/regeo');assert.equal(providerCall.params.location,'113.673421,22.661234');
 await assert.rejects(()=>map.reverse(NaN,22),/有效地图位置/);assert.ok((await validate(plainToInstance(MapLocationQuery,{lng:'999',lat:'22'}))).length);assert.equal((await validate(plainToInstance(MapSearchQuery,{q:'详细地址'.repeat(40)}))).length,0);
 const controller=new MapController(map,db);assert.equal((await controller.reverse({lng:113.673421,lat:22.661234},req)).lng,113.673421);
 for(const permissions of [[],['demand:read'],['tracking:read']])assert.throws(()=>controller.reverse({lng:113,lat:22},{user:{permissions}}),/无权选择地图/);
 map.request=async()=>({regeocode:{}});await assert.rejects(()=>map.reverse(113,22),/补充装卸点名称/);
 pass('地图点选反查地址保留原坐标；接口校验范围和选址权限，未取得地址时可明确提示');
 await fs.writeFile('docs/acceptance/demand-map-location-tests.json',JSON.stringify({...proof,isolatedDatabase:copy},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(db)await db.$disconnect();await live.$disconnect();});
