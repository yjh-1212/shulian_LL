require('dotenv').config();
const {PrismaClient}=require('@prisma/client');
const {hash,compare}=require('bcryptjs');
const {randomUUID}=require('node:crypto');

const db=new PrismaClient();
const profiles=[
  {username:'admin',displayName:'平台管理员',entityId:'platform',entityType:'PLATFORM',roleCode:'platform_admin'},
  {username:'trader',displayName:'粮贸负责人',entityId:'trader-a',entityType:'TRADER',roleCode:'trader_admin'},
  {username:'carrier',displayName:'物流负责人',entityId:'carrier-a',entityType:'CARRIER',roleCode:'carrier_admin'}
];

async function main(){
  const password=process.env.FIXED_ACCOUNT_PASSWORD;
  if(!password||password.length<6||Buffer.byteLength(password,'utf8')>72)throw Error('请通过临时环境变量提供 FIXED_ACCOUNT_PASSWORD，需为6位以上且不超过72字节');
  const requestId=randomUUID();
  const result=await db.$transaction(async tx=>{
    const accounts=[];
    for(const profile of profiles){
      const user=await tx.user.findUnique({where:{username:profile.username},include:{businessEntity:true,roles:{include:{role:true}}}});
      const entity=user?.businessEntity||await tx.businessEntity.findUnique({where:{id:profile.entityId}});
      const role=await tx.role.findUnique({where:{code:profile.roleCode}});
      if(!entity||!role)throw Error(`${profile.username} 缺少主体或角色，请先初始化数据库`);
      if(entity.type!==profile.entityType||role.entityType!==profile.entityType||entity.status!=='ACTIVE'||entity.deletedAt)throw Error(`${profile.username} 的主体或角色无效，请先检查账号配置`);
      if(user&&(user.status!=='ACTIVE'||user.deletedAt||!user.roles.some(x=>x.role.code===profile.roleCode)||user.roles.some(x=>x.role.code==='driver')))throw Error(`${profile.username} 的账号状态或角色不符，请先检查账号配置`);
      accounts.push({profile,user,entity,role});
    }
    const rows=[];
    for(const {profile,user,entity,role} of accounts){
      const passwordMatches=user?await compare(password,user.passwordHash):false;
      let current=user;
      const changed=!user||!passwordMatches||user.mustChangePassword;
      if(!user){
        current=await tx.user.create({data:{username:profile.username,displayName:profile.displayName,businessEntityId:entity.id,isTestData:entity.isTestData,passwordHash:await hash(password,12),roles:{create:{roleId:role.id}}},include:{businessEntity:true,roles:{include:{role:true}}}});
      }else if(changed){
        current=await tx.user.update({where:{id:user.id},data:{passwordHash:passwordMatches?user.passwordHash:await hash(password,12),mustChangePassword:false,tokenVersion:{increment:1}},include:{businessEntity:true,roles:{include:{role:true}}}});
        await tx.refreshToken.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:new Date()}});
      }
      rows.push({username:current.username,role:role.name,entity:entity.name,result:!user?'CREATED':changed?'UPDATED':'UNCHANGED'});
      if(changed){
        const actor=await tx.user.findUniqueOrThrow({where:{username:'admin'}});
        await tx.auditLog.create({data:{userId:actor.id,userName:actor.displayName,role:'platform_admin',businessEntityId:actor.businessEntityId,ip:'',userAgent:'configure-fixed-accounts',module:'用户管理',objectId:current.id,action:user?'设置固定账号密码':'创建固定账号',before:user?JSON.stringify({username:user.username,businessEntityId:user.businessEntityId}):null,after:JSON.stringify({username:current.username,businessEntityId:current.businessEntityId,passwordConfigured:true}),requestId}});
      }
    }
    return rows;
  },{timeout:30000});
  console.log(JSON.stringify({accounts:result},null,2));
}

main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
