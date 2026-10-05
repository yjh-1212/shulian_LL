const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const {workbench}=require('../apps/api/dist/workbench');
const {WorkspaceController}=require('../apps/api/dist/workspace');
require('dotenv').config({quiet:true});
// This is a read-only check against the current database. No credentials or business rows are changed.
const db=new PrismaClient();
(async()=>{
 const users=await db.user.findMany({where:{username:{in:['admin','trader','trader.b','carrier','carrier.b']},deletedAt:null},include:{businessEntity:true,roles:{include:{role:{include:{permissions:{include:{permission:true}}}}}}}});
 assert(users.length>=3,'Need platform, trader and carrier accounts');
 const checks=[];
 for(const raw of users){
  const user={...raw,permissions:[...new Set(raw.roles.flatMap(r=>r.role.permissions.map(p=>p.permission.code)))]};
  const result=await workbench(db,user);
  const own=user.businessEntity.type==='PLATFORM'?{}:{OR:[{traderId:user.businessEntityId},{carrierId:user.businessEntityId}]};
  const allowed=await db.logisticsBusiness.findMany({where:{package:{isTestData:false,...own}},select:{id:true,status:true,package:{select:{traderId:true,carrierId:true}}}});
  const ids=new Set(allowed.map(b=>b.id));
  assert(result.items.every(b=>ids.has(b.id)),'Foreign waybill in '+user.username);
  assert(result.alerts.every(a=>ids.has(a.businessId)),'Foreign alert in '+user.username);
  if(user.permissions.includes('service:read')||user.permissions.includes('tracking:read')){
   assert.equal(result.metrics.pending,allowed.filter(b=>b.status==='PENDING').length);
   assert.equal(result.metrics.running,allowed.filter(b=>b.status==='IN_PROGRESS').length);
  }
  const locked=await workbench(db,{...user,permissions:['home:read']});
  assert.deepEqual(locked.metrics,{pending:null,running:null,alerts:null,completed:null});
  assert.equal(locked.items.length,0);assert.equal(locked.alerts.length,0);assert.equal(locked.todos.length,0);
  const menus=await new WorkspaceController(db).menus({user});
  assert.equal(menus.find(m=>m.path==='/').label,'首页');
  assert.equal(menus.find(m=>m.path==='/workbench').label,'工作台');
  assert.equal(menus.findIndex(m=>m.path==='/workbench'),menus.findIndex(m=>m.path==='/')+1);
  checks.push({user:user.username,scope:result.scope,metrics:result.metrics,visibleRecent:result.items.length});
 }
 console.log(JSON.stringify({status:'PASS',readOnly:true,checks},null,2));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
