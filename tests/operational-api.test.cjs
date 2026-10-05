const assert=require('node:assert/strict');
const test=require('node:test');
require('reflect-metadata');
const {validate}=require('class-validator');
const {TransportService}=require('../apps/api/dist/transport.service.js');
const {PublishDemandDto}=require('../apps/api/dist/transport.dto.js');
const {ContractsService}=require('../apps/api/dist/contracts.service.js');
const {MatchingService}=require('../apps/api/dist/matching.service.js');

const trader={user:{id:'trader-user',businessEntityId:'trader',businessEntity:{type:'TRADER'}}};
const demand={id:'demand',businessEntityId:'trader',businessNo:'XQ202610030001',status:'DRAFT',version:1,matchedKg:0,quantityKg:1600500,departureAt:new Date(Date.now()+86400000),originAddress:'长春市',destinationAddress:'广州市',modes:[],grain:{label:'玉米'},publications:[],files:[]};
const input=()=>({version:1,mode:'DIRECTED',targetCarrierIds:['carrier-a','carrier-b'],deadline:new Date(Date.now()+3600000).toISOString(),quoteType:'PER_TON',budgetPublic:false,contactPublic:false});
function publishing(available=2){
 const created=[];
 const tx={businessEntity:{count:async()=>available},matchPublication:{count:async()=>0,create:async v=>created.push(v.data)},transportDemand:{updateMany:async()=>({count:1})}};
 const s=new TransportService({$transaction:async fn=>fn(tx)},{write:async()=>{}});
 s.demand=async()=>demand;
 return {s,created};
}
test('a directed publication retains every invited carrier in one publication',async()=>{
 const {s,created}=publishing();
 await s.demandAction('demand','publish',1,trader,input());
 assert.equal(created.length,1);
 assert.equal(created[0].mode,'DIRECTED');
 assert.equal(created[0].targetCarrierId,'carrier-a');
 assert.deepEqual(created[0].recipients.create,[{carrierId:'carrier-a'},{carrierId:'carrier-b'}]);
});
test('a directed publication rejects any unavailable carrier before publishing',async()=>{
 const {s,created}=publishing(1);
 await assert.rejects(()=>s.demandAction('demand','publish',1,trader,input()),/不存在或已停用/);
 assert.equal(created.length,0);
});
test('a public publication cannot retain private recipients',async()=>{
 const {s,created}=publishing();
 await assert.rejects(()=>s.demandAction('demand','publish',1,trader,{...input(),mode:'PUBLIC'}),/公开发布不能指定/);
 assert.equal(created.length,0);
});
test('older single-carrier clients still publish a directed invitation',async()=>{
 const {s,created}=publishing(1);
 const dto=input();delete dto.targetCarrierIds;dto.targetCarrierId='carrier-a';
 await s.demandAction('demand','publish',1,trader,dto);
 assert.deepEqual(created[0].recipients.create,[{carrierId:'carrier-a'}]);
});
test('legacy publication options cannot expose budgets or enable partial acceptance',async()=>{
 const {s,created}=publishing();
 await s.demandAction('demand','publish',1,trader,{...input(),budgetPublic:true,allowPartial:true});
 assert.equal(created[0].budgetPublic,false);
 assert.equal(created[0].allowPartial,false);
});
test('the matching publication entry also ignores obsolete budget and partial options',async()=>{
 const created=[];
 const tx={transportDemand:{findFirst:async()=>demand,updateMany:async()=>({count:1})},businessEntity:{count:async()=>2},matchPublication:{count:async()=>0,create:async ({data})=>{created.push(data);return {id:'publication',...data};}}};
 const s=new MatchingService({$transaction:async fn=>fn(tx)},{write:async()=>{}});
 s.expire=async()=>{};
 await s.publish({...input(),demandId:'demand',budgetPublic:true,allowPartial:true},trader);
 assert.equal(created.length,1);
 assert.equal(created[0].budgetPublic,false);
 assert.equal(created[0].allowPartial,false);
 assert.equal(created[0].quantityKg,demand.quantityKg);
});
test('the DTO rejects duplicate and oversized recipient lists',async()=>{
 const duplicate=Object.assign(new PublishDemandDto(),input(),{targetCarrierIds:['a','a']});
 const oversized=Object.assign(new PublishDemandDto(),input(),{targetCarrierIds:Array.from({length:11},(_,i)=>String(i))});
 assert.ok((await validate(duplicate)).some(e=>e.property==='targetCarrierIds'));
 assert.ok((await validate(oversized)).some(e=>e.property==='targetCarrierIds'));
});
test('a recipient sees its invitation without identities of the other invitees',()=>{
 const {s}=publishing();
 const req={user:{businessEntityId:'carrier-b',businessEntity:{type:'CARRIER'}}};
 const publication={mode:'DIRECTED',targetCarrierId:'carrier-a',targetCarrier:{id:'carrier-a'},recipients:[{carrierId:'carrier-a',carrier:{id:'carrier-a'}},{carrierId:'carrier-b',carrier:{id:'carrier-b'}}],status:'ACTIVE',deadline:new Date(Date.now()+3600000),budgetPublic:true,contactPublic:false,snapshot:'private'};
 const result=s.demandView({...demand,contact:'联系人',phone:'13800000000',budgetCents:30000,orderItem:{id:'private-order'},publications:[publication]},req);
 assert.deepEqual(result.publications[0].targetCarriers,[{id:'carrier-b'}]);
 assert.equal(result.publications[0].targetCarrierId,'carrier-b');
 assert.equal(result.publications[0].targetCarrier,undefined);
 assert.equal(result.publications[0].recipients,undefined);
 assert.equal(result.publications[0].snapshot,undefined);
 assert.equal(result.orderItem,undefined);
 assert.equal(result.contact,undefined);
 assert.equal(result.budget,undefined);
 assert.equal(result.budgetCents,undefined);
 const scope=s.demandScope(req);
 assert.equal(scope.publications.some.OR[1].OR[1].recipients.some.carrierId,'carrier-b');
});
test('old public budget flags cannot expose a private budget through the matching hall',()=>{
 const s=new MatchingService({},{});
 const p={demand:{...demand,budgetCents:30000},createdBy:trader.user.id,recipients:[],snapshot:JSON.stringify({privateInfo:{budgetCents:30000},name:'玉米整单运输'}),riskNotes:'[]',budgetPublic:true,allowPartial:true,quantityKg:demand.quantityKg,matchedKg:0};
 const carrier=s.view(p,{user:{businessEntityId:'carrier-b',businessEntity:{type:'CARRIER'}}});
 assert.equal(carrier.budget,null);
 assert.equal(carrier.snapshot.privateInfo,undefined);
 assert.equal(carrier.allowPartial,false);
 assert.equal(s.view(p,trader).budget,30000);
});
test('quotes must cover all remaining cargo even when a legacy row allowed partial acceptance',()=>{
 const s=new MatchingService({},{});
 const p={quantityKg:demand.quantityKg,matchedKg:0,allowPartial:true,quoteType:'PER_TON',objectType:'DEMAND',deadline:new Date(Date.now()+7200000)};
 const terms={quantity:1600.5,price:220,unit:'PER_TON',validUntil:new Date(Date.now()+3600000).toISOString(),departureAt:new Date(Date.now()+86400000).toISOString(),arrivalAt:new Date(Date.now()+172800000).toISOString(),note:''};
 assert.equal(s.terms(terms,p).quantityKg,demand.quantityKg);
 assert.throws(()=>s.terms({...terms,quantity:800},p),/覆盖完整待承接数量/);
 assert.equal(s.terms({...terms,quantity:1100.5},{...p,matchedKg:500000}).quantityKg,1100500);
});
test('without a verified signing provider, signing cannot create records or activate a contract',async()=>{
 let writes=0;
 const s=new ContractsService({$transaction:async()=>{writes++;}},{write:async()=>{writes++;}});
 await assert.rejects(()=>s.action('contract','sign',{version:1,documentType:'MAIN',acknowledged:true},trader),e=>e.getStatus()===503&&/签署服务待接入/.test(e.message));
 assert.equal(writes,0);
 assert.deepEqual(s.view({snapshot:'{}',revisions:[]}).signing,{enabled:false,sealUrl:null,reason:'电子签署服务待接入'});
});
test('a generated contract is a draft with one-decimal tonnes and no fictional signing claim',()=>{
 const s=new ContractsService({},{});
 const docs=s.documents([{id:'template',version:1,name:'运输合同',type:'MAIN',body:'运输双方约定货物安全交付。'}],{trader:{name:'贸易企业'},carrier:{name:'物流企业'},platform:{name:'平台'},quantityKg:1600500,totalCents:32010000}, {platformFeeCents:0,settlement:'交付后结算',requirements:'防潮防损',expiresAt:'2026-12-31T00:00:00Z'});
 assert.match(docs[0].body,/1600\.5 吨/);
 assert.doesNotMatch(docs[0].body,/模拟|演示|已签署|电子认证/);
});
test('a real manual order import is not classified as a fixture by the server environment',async()=>{
 const created=[];
 const tx={tradeOrder:{create:async ({data})=>{created.push(data);return {id:'order',...data};}}};
 const db={businessEntity:{findFirst:async()=>({id:'trader',type:'TRADER'})},dictionary:{count:async()=>1},tradeOrder:{findUnique:async()=>null},$transaction:async fn=>fn(tx)};
 const s=new TransportService(db,{write:async()=>{}});
 await s.importOrder({businessNo:'JY202610030001',businessEntityId:'trader',sourceSystem:'ORDER_IMPORT',sourceRecordId:'202610030001',recipient:'粮食收货企业',shipperContact:'业务负责人',shipperPhone:'待录入',recipientContact:'收货负责人',recipientPhone:'待录入',items:[{lineNo:'1',grainId:'corn',cargoName:'玉米',specification:'二等',quantity:1600.5}]},{user:{businessEntity:{type:'PLATFORM'},id:'platform-user'}});
 assert.equal(created[0].isTestData,false);
 assert.equal(created[0].sourceType,'INTERNAL');
 assert.equal(created[0].items.create[0].quantityKg,1600500);
});
test('real order import stays restricted to the platform role',async()=>{
 const s=new TransportService({},{});
 await assert.rejects(()=>s.importOrder({},trader),/仅平台可导入/);
});
