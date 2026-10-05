// Add unallocated trade inventory and independent demand drafts without publishing them.
require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');
const {createHash}=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const areas=require('china-area-data');
const SOURCE='TRANSPORT_DEMAND_INITIALIZATION';
const MARKER='transport-demand-records-2026-10-v1';
const REPORT=path.resolve('docs/acceptance/transport-demand-records.json');
const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const specifications={玉米:'二等黄玉米，水分≤14.0%',大豆:'食用大豆，水分≤13.0%',小麦:'普通小麦，水分≤12.5%',稻谷:'粳稻谷，水分≤14.5%'};
const trades=[
  ['玉米',1200.5,'五棵树站','南沙港'],['大豆',680.3,'新香坊站','新沙港'],
  ['小麦',1500.0,'盘锦站','广州国际港站'],['稻谷',960.8,'五棵树站','南沙港'],
  ['玉米',2400.0,'鲅鱼圈港','新沙港'],['大豆',820.6,'五棵树站','南沙港'],
  ['小麦',1100.2,'铁路货运蒲河物流基地','广州北站'],['稻谷',760.4,'新香坊站','南沙港'],
  ['玉米',1850.7,'五棵树站','广州国际港站'],['大豆',620.5,'鲅鱼圈港','新沙港'],
];
const drafts=[
  ['玉米',1200.5,'五棵树站','南沙港',['公路','水运'],'BULK',9],
  ['大豆',680.3,'新香坊站','新沙港',['铁路','水运'],'BULK',10],
  ['小麦',1500.0,'盘锦站','广州北站',['公路','铁路'],'BULK',5],
  ['稻谷',960.8,'五棵树站','广州国际港站',['公路','铁路','水运'],'CONTAINER',12],
];
const sources=[
  {title:'广州港新沙港务有限公司：新沙港区位于东莞麻涌镇',url:'https://www.xs.gzport.com/liangyou/gywm/gywm/201411/t20141118_558.html'},
  {title:'上海泛亚航运内贸航线：营口—南沙等业务流向',url:'https://www.panasiashipping.com/contents/Product/14.html'},
  {title:'辽宁省政府：蒲河站—广州国际港站快捷物流通道',url:'https://www.ln.gov.cn/web/ywdt/zymtkln/2025041108514451900/index.shtml'},
  {title:'项目已核对的港站位置与公开通道资料',file:'docs/business-data-sources.md'},
];
function location(node){
  const districtName=node.name==='新沙港'?'麻涌镇':node.district;
  const province=Object.keys(areas['86']).find(code=>areas['86'][code]===node.province);
  const city=Object.keys(areas[province]||{}).find(code=>areas[province][code]===node.city);
  const district=Object.keys(areas[city]||{}).find(code=>areas[city][code]===districtName);
  if(!province||!city||!district)throw Error('港站行政编码未匹配：'+node.name);
  return {address:node.province+node.city+districtName+node.name+(node.address?'（'+node.address+'）':''),codes:[province,city,district].join('/'),region:[node.province,node.city,districtName].join(' / ')};
}
async function backup(db){
  const dir=path.resolve('.local/backups','transport-demand-records-'+new Date().toISOString().replace(/[:.]/g,'-'));
  await fs.mkdir(dir,{recursive:true});const file=path.join(dir,'database.db');
  await db.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g,"''")}'`);
  const bytes=await fs.readFile(file);await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),bytes:bytes.length,sha256:sha(bytes),method:'SQLITE_VACUUM_INTO'},null,2));return file;
}
async function main(){
  const db=new PrismaClient();
  try{
    const previous=await db.auditLog.findUnique({where:{id:MARKER}});
    if(previous){console.log(JSON.stringify({status:'ALREADY_INITIALIZED',...JSON.parse(previous.after)},null,2));return;}
    const [admin,trader,nodes,dictionaries]=await Promise.all([
      db.user.findUniqueOrThrow({where:{username:'admin'}}),
      db.user.findUniqueOrThrow({where:{username:'trader'},include:{businessEntity:true}}),
      db.transportNode.findMany({where:{enabled:true,name:{in:[...new Set([...trades,...drafts].flatMap(row=>[row[2],row[3]]))]}}}),
      db.dictionary.findMany({where:{enabled:true,group:{in:['粮食品种','运输方式']}}}),
    ]);
    if(trader.status!=='ACTIVE'||trader.businessEntity.type!=='TRADER'||trader.businessEntity.status!=='ACTIVE')throw Error('贸易企业账号不可用');
    const node=name=>{const matches=nodes.filter(n=>n.name===name);if(matches.length!==1)throw Error('港站未唯一匹配：'+name);return matches[0];};
    const dictionary=(group,label)=>{const result=dictionaries.find(d=>d.group===group&&d.label===label);if(!result)throw Error('缺少启用字典：'+label);return result;};
    const now=new Date(),provenance={sourceSystem:SOURCE,sourceType:'INITIALIZATION',verification:'UNVERIFIED_BUSINESS_RECORD',generatedAt:now.toISOString(),note:'按用户选择生成的待核验业务记录；粮种、港站及公开运输通道有参考来源，企业参与、交易数量与发运安排为生成值，尚无原始成交凭证。联系电话留待企业补充。'};
    const summary={sourceSystem:SOURCE,provenance,owner:{id:trader.businessEntityId,name:trader.businessEntity.name,username:trader.username},trades:trades.map(([grain,quantity,from,to],index)=>({id:MARKER+'-trade-'+(index+1),itemId:MARKER+'-item-'+(index+1),businessNo:'JY20261003'+String(index+101).padStart(4,'0'),grain,quantity,origin:location(node(from)),destination:location(node(to)),reservedKg:0})),demands:drafts.map(([grain,quantity,from,to,modes,loadingType,days],index)=>({id:MARKER+'-demand-'+(index+1),businessNo:'XQ20261003'+String(index+101).padStart(4,'0'),grain,quantity,origin:location(node(from)),destination:location(node(to)),modes,loadingType,departureAt:new Date(now.getTime()+(3+index)*86400000).toISOString(),arrivalAt:new Date(now.getTime()+(3+index+days)*86400000).toISOString(),orderItemId:null})),sources};
    if(!process.argv.includes('--apply')){console.log(JSON.stringify({status:'PREVIEW',...summary},null,2));return;}
    const backupPath=await backup(db);
    await db.$transaction(async tx=>{
      if(await tx.auditLog.findUnique({where:{id:MARKER}}))throw Error('资料已由其他进程写入');
      const audit=(module,objectId,action,after)=>tx.auditLog.create({data:{userId:admin.id,userName:admin.displayName,role:'platform',businessEntityId:admin.businessEntityId,ip:'local',userAgent:'transport-demand-initialization',module,objectId,action,after:JSON.stringify({...after,provenance}),requestId:MARKER}});
      for(const record of summary.trades){
        await tx.tradeOrder.create({data:{id:record.id,businessNo:record.businessNo,businessEntityId:trader.businessEntityId,recipient:record.destination.address,shipperContact:'粮食业务部',shipperPhone:'',recipientContact:'收货作业部',recipientPhone:'',sourceSystem:SOURCE,sourceRecordId:record.id,sourceDigest:sha({record,provenance}),sourceType:'INITIALIZATION',isTestData:false,items:{create:{id:record.itemId,lineNo:'1',grainId:dictionary('粮食品种',record.grain).id,cargoName:record.grain,specification:specifications[record.grain],grainGrade:record.grain==='玉米'||record.grain==='稻谷'?'二等':null,pickupAddress:record.origin.address,pickupCodes:record.origin.codes,quantityKg:Math.round(record.quantity*1000),reservedKg:0}}}});
        await audit('交易订单',record.id,'新增待核验交易资料',record);
      }
      for(const record of summary.demands){
        await tx.transportDemand.create({data:{id:record.id,businessNo:record.businessNo,name:record.grain+' '+record.quantity.toFixed(1)+'吨',businessEntityId:trader.businessEntityId,grainId:dictionary('粮食品种',record.grain).id,cargoName:record.grain,specification:specifications[record.grain],quantityKg:Math.round(record.quantity*1000),originAddress:record.origin.address,originCodes:record.origin.codes,originRegion:record.origin.region,destinationAddress:record.destination.address,destinationCodes:record.destination.codes,destinationRegion:record.destination.region,departureAt:new Date(record.departureAt),arrivalAt:new Date(record.arrivalAt),allowMultimodal:true,allowTransfer:true,maxTransfers:record.modes.length,preference:'BALANCED',loadingType:record.loadingType,contact:'粮食业务部',phone:'',notes:'装卸防潮、防混粮。交付数量以过磅和签收资料为准，发运前确认港站接卸安排。',status:'DRAFT',createdBy:trader.id,updatedBy:trader.id,sourceType:'INITIALIZATION',isTestData:false,modes:{create:record.modes.map(mode=>({modeId:dictionary('运输方式',mode).id}))}}});
        await audit('运输需求',record.id,'新增独立运输需求草稿',record);
      }
      await tx.auditLog.create({data:{id:MARKER,userId:admin.id,userName:admin.displayName,role:'platform',businessEntityId:admin.businessEntityId,ip:'local',userAgent:'transport-demand-initialization',module:'运输需求',objectId:MARKER,action:'追加待核验交易和手动需求',after:JSON.stringify({...summary,backupPath}),requestId:MARKER}});
    },{timeout:30000,maxWait:30000});
    await fs.mkdir(path.dirname(REPORT),{recursive:true});await fs.writeFile(REPORT,JSON.stringify({...summary,backupPath},null,2));
    console.log(JSON.stringify({status:'INITIALIZED',tradeCount:summary.trades.length,standaloneDemandCount:summary.demands.length,owner:summary.owner,backupPath},null,2));
  }finally{await db.$disconnect();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={SOURCE,MARKER,trades,drafts,main};
