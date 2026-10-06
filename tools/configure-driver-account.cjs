const {PrismaClient}=require('@prisma/client');
const {hash,compare}=require('bcryptjs');
const {randomUUID}=require('node:crypto');
const {resolve,isAbsolute}=require('node:path');
const {existsSync}=require('node:fs');

async function configureDriverAccount(databaseUrl,password){
  if(!password||password.length<6||Buffer.byteLength(password,'utf8')>72)throw Error('请通过临时环境变量 DRIVER_ACCOUNT_PASSWORD 提供密码，需为6位以上且不超过72字节');
  if(!databaseUrl?.startsWith('file:'))throw Error('请配置当前 SQLite 数据库地址 DATABASE_URL');
  const db=new PrismaClient({datasources:{db:{url:databaseUrl}}});
  try{
    return await db.$transaction(async tx=>{
      const existing=await tx.user.findUnique({where:{username:'driver'},include:{businessEntity:true,roles:{include:{role:true}}}});
      if(existing&&(existing.roles.length!==1||existing.roles[0].role.code!=='driver'))throw Error('同名账号不是独立司机账号，未修改');
      const carrier=existing?null:await tx.user.findUnique({where:{username:'carrier'},include:{businessEntity:true}});
      const entity=existing?.businessEntity||carrier?.businessEntity;
      const role=await tx.role.findUnique({where:{code:'driver'}});
      if(!entity||entity.type!=='CARRIER'||entity.status!=='ACTIVE'||entity.deletedAt||entity.isTestData)throw Error('司机所属物流企业不可用，请先维护物流企业');
      if(!role||role.entityType!=='CARRIER')throw Error('司机角色不存在或配置错误');
      const passwordMatches=existing?await compare(password,existing.passwordHash):false;
      const changed=!existing||!passwordMatches||existing.mustChangePassword||existing.status!=='ACTIVE'||existing.deletedAt||existing.isTestData;
      let user=existing;
      if(!existing){
        user=await tx.user.create({data:{username:'driver',displayName:'司机',businessEntityId:entity.id,passwordHash:await hash(password,12),status:'ACTIVE',isTestData:false,mustChangePassword:false,roles:{create:{roleId:role.id}}}});
      }else if(changed){
        user=await tx.user.update({where:{id:existing.id},data:{passwordHash:passwordMatches?existing.passwordHash:await hash(password,12),mustChangePassword:false,status:'ACTIVE',deletedAt:null,isTestData:false,tokenVersion:{increment:1}}});
        await tx.refreshToken.updateMany({where:{userId:existing.id,revokedAt:null},data:{revokedAt:new Date()}});
      }
      if(changed){
        const actor=await tx.user.findUnique({where:{username:'admin'}});
        if(!actor)throw Error('缺少管理员账号，无法记录初始化审计');
        await tx.auditLog.create({data:{userId:actor.id,userName:actor.displayName,role:'platform_admin',businessEntityId:actor.businessEntityId,ip:'',userAgent:'configure-driver-account',module:'用户管理',objectId:user.id,action:existing?'设置司机账号密码':'创建司机账号',before:existing?JSON.stringify({username:existing.username,businessEntityId:existing.businessEntityId}):null,after:JSON.stringify({username:user.username,businessEntityId:user.businessEntityId,passwordConfigured:true}),requestId:randomUUID()}});
      }
      return {username:user.username,displayName:user.displayName,entity:entity.name,role:role.name,mustChangePassword:user.mustChangePassword,result:!existing?'CREATED':changed?'UPDATED':'UNCHANGED'};
    },{timeout:30000});
  }finally{await db.$disconnect();}
}

async function main(){
  const root=resolve(__dirname,'..');
  const file=process.env.ENV_FILE||(process.argv.includes('--server')?'.env.server':'.env');
  const loaded=require('dotenv').config({path:resolve(root,file)});
  if(loaded.error&&!process.env.DATABASE_URL)throw Error('无法读取数据库配置：'+file);
  const url=process.env.DATABASE_URL;
  if(!url?.startsWith('file:'))throw Error('请配置 SQLite 数据库地址 DATABASE_URL');
  const [name,...query]=url.slice(5).split('?');
  const absolute=isAbsolute(name)?name:resolve(root,'prisma',name);
  if(!existsSync(absolute))throw Error('数据库文件不存在，请检查 DATABASE_URL，未创建新数据库');
  const databaseUrl='file:'+absolute.replace(/\\/g,'/')+(query.length?'?'+query.join('?'):'');
  console.log(JSON.stringify(await configureDriverAccount(databaseUrl,process.env.DRIVER_ACCOUNT_PASSWORD),null,2));
}
module.exports={configureDriverAccount};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
