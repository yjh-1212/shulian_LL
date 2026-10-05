import {PrismaClient} from '@prisma/client';
import {dataCatalog} from '../apps/api/src/data-products.catalog';
export async function seedDataService(db:PrismaClient){
 for(const code of ['data:read','data:subscribe']){
  const p=await db.permission.upsert({where:{code},update:{},create:{code,name:code==='data:read'?'查看数据服务':'申请授权与管理本企业订阅',module:'数据服务'}});
  const roles=await db.role.findMany({where:{entityType:{in:['PLATFORM','TRADER','CARRIER']},code:{not:'driver'}}});
  for(const role of roles)await db.rolePermission.upsert({where:{roleId_permissionId:{roleId:role.id,permissionId:p.id}},update:{},create:{roleId:role.id,permissionId:p.id}});
 }
 await db.menu.updateMany({where:{parentId:'data'},data:{enabled:false}});
 for(const profile of dataCatalog){
  const {code,name,description,theme,dataset,fields,source,frequency,coverage,serviceMode,format,owner,conditions}=profile;
  const p=await db.dataProduct.upsert({where:{code},update:{},create:{code,name,description,theme,dataset,fields:JSON.stringify(fields),source,frequency,coverage,serviceMode,format,owner,conditions,status:'PUBLISHED'}});
  await db.dataProductVersion.upsert({where:{productId_number:{productId:p.id,number:p.version}},update:{},create:{productId:p.id,number:p.version,snapshot:JSON.stringify(p),userId:'platform-catalog'}});
 }
}
