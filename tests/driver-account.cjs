const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {resolve}=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {compare}=require('bcryptjs');
const {configureDriverAccount}=require('../tools/configure-driver-account.cjs');

(async()=>{
 const file=resolve('.local/tencent-test/driver-account.db');
 await fs.mkdir(resolve('.local/tencent-test'),{recursive:true});
 await fs.copyFile('ll_dist/liaoliang-server/prisma/server.db',file);
 const url='file:'+file.replace(/\\/g,'/'),db=new PrismaClient({datasources:{db:{url}}});
 try{
  const users=()=>db.user.findMany({include:{roles:true},orderBy:{id:'asc'}});
  const before=await users(),old=before.find(u=>u.username==='driver');
  assert(old,'Existing driver should retain its identity and task references');
  const tasks=await db.transportTask.findMany({where:{driverId:old.id},select:{id:true,driverId:true}});
  const first=await configureDriverAccount(url,'shulian');
  assert.equal(first.username,'driver');assert.equal(first.mustChangePassword,false);
  const after=await users(),driver=after.find(u=>u.username==='driver');
  assert.equal(driver.id,old.id);assert.equal(driver.displayName,old.displayName);
  assert.equal(driver.businessEntityId,old.businessEntityId);
  assert.deepEqual(driver.roles,old.roles);
  assert.deepEqual(after.filter(u=>u.username!=='driver'),before.filter(u=>u.username!=='driver'));
  assert(await compare('shulian',driver.passwordHash));assert.equal(driver.status,'ACTIVE');assert.equal(driver.isTestData,false);
  assert.deepEqual(await db.transportTask.findMany({where:{driverId:old.id},select:{id:true,driverId:true}}),tasks);
  const count=await db.auditLog.count();
  assert.equal((await configureDriverAccount(url,'shulian')).result,'UNCHANGED');
  assert.equal(await db.auditLog.count(),count);
  await db.user.update({where:{id:old.id},data:{username:'driver-original'}});
  assert.equal((await configureDriverAccount(url,'shulian')).result,'CREATED');
  const created=await db.user.findUnique({where:{username:'driver'},include:{roles:{include:{role:true}}}});
  assert.equal(created.roles.length,1);assert.equal(created.roles[0].role.code,'driver');
  assert.equal(created.businessEntityId,(await db.user.findUnique({where:{username:'carrier'}})).businessEntityId);
  // A conflicting enterprise account must never have its permissions or password changed.
  await db.user.update({where:{id:created.id},data:{roles:{deleteMany:{},create:{role:{connect:{code:'carrier_admin'}}}}}});
  const conflict=await db.user.findUnique({where:{id:created.id},include:{roles:true}});
  await assert.rejects(configureDriverAccount(url,'shulian'),/同名账号/);
  assert.deepEqual(await db.user.findUnique({where:{id:created.id},include:{roles:true}}),conflict);
  console.log(JSON.stringify({passed:true,password:true,idempotent:true,existingIdentityPreserved:true,existingTasks:tasks.length,otherAccountsUnchanged:true,newDriverRoleOnly:true,conflictingAccountProtected:true}));
 }finally{await db.$disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
