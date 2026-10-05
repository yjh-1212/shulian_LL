import {PrismaClient} from '@prisma/client';
import {hash} from 'bcryptjs';
const regions:Record<string,Record<string,string>>=require('china-area-data');
const cities:Record<string,string[]>={harbin:['230000','230100'],suihua:['230000','231200'],fujin:['230000','230800'],panjin:['210000','211100'],yingkou:['210000','210800'],tongliao:['150000','150500'],changchun:['220000','220100'],guangzhou:['440000','440100'],quanzhou:['350000','350500'],qinzhou:['450000','450700'],nantong:['320000','320600']};
const city=(key:string)=>({codes:cities[key].join('/'),name:cities[key].map((c,i)=>regions[i===0?'86':cities[key][0]][c]).join(' / ')});
const fixtures=[
 ['beicang','北仓联运物流（模拟）','harbin','BULK',250,[['harbin','guangzhou'],['harbin','quanzhou'],['harbin','qinzhou'],['suihua','guangzhou'],['fujin','quanzhou']]],
 ['liaogang','辽港粮运物流（模拟）','yingkou','BULK',265,[['harbin','guangzhou'],['panjin','guangzhou'],['panjin','quanzhou'],['changchun','guangzhou']]],
 ['jintong','锦通粮食物流（模拟）','tongliao','BULK',240,[['tongliao','nantong'],['tongliao','guangzhou'],['tongliao','qinzhou'],['panjin','guangzhou']]],
 ['nanyue','南粤集装箱物流（模拟）','guangzhou','CONTAINER',6200,[['harbin','guangzhou'],['panjin','guangzhou'],['changchun','guangzhou'],['tongliao','guangzhou']]],
 ['jigu','吉林谷运物流（模拟）','changchun','BULK',255,[['changchun','guangzhou'],['harbin','guangzhou'],['panjin','guangzhou']]],
 ['minyue','闽粤联运物流（模拟）','quanzhou','CONTAINER',5400,[['fujin','quanzhou'],['harbin','quanzhou'],['panjin','quanzhou'],['harbin','guangzhou']]],
 ['beibuwan','北部湾粮运物流（模拟）','qinzhou','BULK',275,[['harbin','qinzhou'],['tongliao','qinzhou'],['panjin','qinzhou'],['fujin','qinzhou']]],
 ['dongbei','东北粮运物流（模拟）','suihua','BULK',260,[['suihua','guangzhou'],['harbin','guangzhou'],['fujin','guangzhou'],['harbin','quanzhou']]],
] as const;

export async function seedLogisticsSuppliers(db:PrismaClient){
 if(process.env.NODE_ENV==='production')throw Error('模拟供应商禁止在生产环境初始化');
 if(!process.env.SEED_PASSWORD)throw Error('请配置开发账号密码');
 const passwordHash=await hash(process.env.SEED_PASSWORD,12),role=await db.role.findUniqueOrThrow({where:{code:'carrier_admin'}}),mode=await db.dictionary.findUniqueOrThrow({where:{group_code:{group:'运输方式',code:'4'}}});
 const grains=await db.dictionary.findMany({where:{group:'粮食品种',code:{in:['1','2','3','4']}}});
 for(const [key,name,registered,loadingType,rate,routes] of fixtures){
  const id='demo-logistics-'+key,org='demo-logistics-org-'+key,username='logistics.'+key,registration=city(registered);
  await db.organization.upsert({where:{id:org},update:{},create:{id:org,name}});
  await db.businessEntity.upsert({where:{id},update:{},create:{id,name,type:'CARRIER',organizationId:org,status:'ACTIVE',registeredRegion:registration.name,registeredCodes:registration.codes,contact:'物流运营经理',phone:'13800007001',isTestData:true}});
  const user=await db.user.upsert({where:{username},update:{},create:{username,displayName:name.replace('（模拟）','')+'负责人',businessEntityId:id,passwordHash,status:'ACTIVE',phone:'13800007001',isTestData:true}});
  await db.userRole.upsert({where:{userId_roleId:{userId:user.id,roleId:role.id}},update:{},create:{userId:user.id,roleId:role.id}});
  for(const [from,to] of routes){const origin=city(from),destination=city(to),supplyId=`demo-supply-${key}-${from}-${to}`;
   await db.transportSupply.upsert({where:{id:supplyId},update:{},create:{id:supplyId,businessNo:`GY-DEMO-${key.toUpperCase()}-${from.toUpperCase()}-${to.toUpperCase()}`,name,businessEntityId:id,modeId:mode.id,originCodes:origin.codes,originRegion:origin.name,originAddress:'',destinationCodes:destination.codes,destinationRegion:destination.name,destinationAddress:'',capacityKg:8000000,minKg:1000,maxKg:8000000,loadingType,bulkPriceCents:loadingType==='BULK'?rate*100:null,container20PriceCents:loadingType==='CONTAINER'?rate*100:null,container40PriceCents:loadingType==='CONTAINER'?(rate+800)*100:null,referencePriceCents:loadingType==='BULK'?rate*100:null,priceUnit:loadingType==='BULK'?'PER_TON':null,resourceType:'COMBINED',resourceDescription:'可组织公铁、公水、铁水及公铁水整程粮食运输、散粮入箱和港站接驳。',capabilities:'整程多式联运、散粮入箱、粮食装卸',contact:'物流运营经理',phone:'13800007001',notes:'模拟注册企业及已发布运力，报价仅供界面与业务流程演示；真实运力和费用需议价确认。',status:'PUBLISHED',createdBy:user.id,updatedBy:user.id,sourceType:'TEST',isTestData:true,grains:{create:grains.map(g=>({grainId:g.id}))}}});
  }
 }
 return {companies:fixtures.length,supplies:fixtures.reduce((n,f)=>n+f[5].length,0)};
}
