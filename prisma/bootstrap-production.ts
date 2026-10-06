import {seedDataService} from './seed-data-service';
import 'dotenv/config';import {PrismaClient} from '@prisma/client';import {hash} from 'bcryptjs';import {seedPhase789} from './seed-phase789';const db=new PrismaClient();async function main(){const username=process.env.BOOTSTRAP_ADMIN_USERNAME,password=process.env.BOOTSTRAP_ADMIN_PASSWORD,name=process.env.BOOTSTRAP_PLATFORM_NAME;if(!username||!password||password.length<6||!name)throw Error('必须配置平台名称、管理员账号及至少6位初始密码');if(await db.user.count({where:{isTestData:true}}))throw Error('生产初始化拒绝包含开发样例账号的数据库');
  await seedPhase789(db);
  const modules = [['home','工作台'],['demand','运输需求'],['supply','运输供给'],['plan','联运方案'],['match','供需匹配'],['contract','合同管理'],['service','联运服务'],['tracking','全程可视化'],['billing','对账结算'],['data','数据服务'],['users','用户管理'],['roles','角色权限'],['entities','合作主体'],['dictionaries','数据字典'],['logs','日志管理']];
  for (const [code,name] of modules) {
    await db.permission.upsert({ where:{code:`${code}:read`},update:{},create:{code:`${code}:read`,name:`查看${name}`,module:name} });
    if (['users','roles','entities','dictionaries'].includes(code)) await db.permission.upsert({where:{code:`${code}:write`},update:{},create:{code:`${code}:write`,name:`维护${name}`,module:name}});
  }
  await db.permission.upsert({where:{code:'contract-template:read'},update:{},create:{code:'contract-template:read',name:'查看合同模板',module:'合同模板'}});
  for(const [action,name] of [['publish','发布匹配'],['quote','提交报价'],['negotiate','参与议价'],['confirm','确认承运']])await db.permission.upsert({where:{code:`match:${action}`},update:{},create:{code:`match:${action}`,name,module:'供需匹配'}});
  const roles = [
    ['platform_admin','平台运营管理员','PLATFORM',modules.map(x=>`${x[0]}:read`).concat(['users:write','roles:write','entities:write','dictionaries:write','contract-template:read'])],
    ['trader_admin','贸易企业管理员','TRADER',['home:read','demand:read','supply:read','plan:read','match:read','contract:read','service:read','tracking:read','billing:read']],
    ['trader_member','贸易企业业务员','TRADER',['home:read','demand:read','supply:read','plan:read','match:read','contract:read','service:read','tracking:read']],
    ['carrier_admin','物流运营管理员','CARRIER',['home:read','supply:read','plan:read','match:read','contract:read','service:read','tracking:read','billing:read']],
    ['carrier_member','物流调度员','CARRIER',['home:read','supply:read','match:read','service:read','tracking:read']],
    ['driver','司机','CARRIER',[]]
  ] as const;
  for(const [code,name,entityType,permissions] of roles) {
    const existing = await db.role.findUnique({where:{code}});
    if(existing) continue; // Re-running seed never overwrites configured grants.
    const extra:Record<string,string[]>={platform_admin:['data:write','contract:write','contract-template:write','trade-orders:read','trade-orders:import','plan:solve','plan:maintain'],trader_admin:['billing:write','contract:write','trade-orders:read','demand:write','demand:publish','plan:solve','plan:select','match:publish','match:negotiate','match:confirm'],trader_member:['contract:write','trade-orders:read','demand:write','demand:publish','plan:solve','plan:select','match:publish','match:negotiate','match:confirm'],carrier_admin:['billing:write','contract:write','service:write','supply:write','supply:publish','plan:solve','match:quote','match:negotiate'],carrier_member:['service:write','supply:write','supply:publish','plan:read','plan:solve','match:quote','match:negotiate']};
    await db.role.create({data:{code,name,entityType,description:code==='driver'?'仅司机小程序，禁止进入 PC 后台':'按所属主体限制数据范围',permissions:{create:[...permissions,...(extra[code]||[])].map(p=>({permission:{connect:{code:p}}}))}}});
  }

  const nav = [
    ['home','首页','/','house','home',1,[]],
    ['demand','供需管理','/supply-demand','package','demand',2,[['demands','运输需求管理','/supply-demand/demands','demand'],['supplies','运输供给管理','/supply-demand/supplies','supply']]],
    ['plan','联运方案','/plans','route','plan',3,[['solve','求解','/plans/solve','plan'],['prices','线路价格','/plans/prices','plan']]],
    ['match','供需匹配','/matches','handshake','match',4,[]],
    ['contract','合同管理','/contracts','file','contract',5,[['contract-templates','合同模板管理','/contracts/templates','contract-template'],['contract-signing','合同签署管理','/contracts/signing','contract'],['contract-performance','合同履约管理','/contracts/performance','contract'],['contract-archives','合同档案管理','/contracts/archives','contract']]],
    ['service','联运服务','/services','truck','service',5,[]],
    ['tracking','全程可视化','/tracking','map','tracking',6,[['overview','运行总览','/tracking/overview','tracking'],['journey','全程跟踪','/tracking/journeys','tracking'],['alerts','预测预警','/tracking/alerts','tracking'],['themes','专题视图','/tracking/themes','tracking']]],
    ['billing','对账结算','/billing','wallet','billing',8,[['bills','账单管理','/billing/bills','billing'],['reconcile','对账管理','/billing/reconciliations','billing'],['settle','结算管理','/billing/settlements','billing']]],
    ['data','数据服务','/data','database','data',8,[]],
    ['system','系统管理','/system','settings','users',1,[['users','用户管理','/system/users','users'],['roles','角色权限','/system/roles','roles'],['dictionaries','数据字典','/system/dictionaries','dictionaries'],['entities','合作主体','/system/entities','entities'],['logs','日志管理','/system/logs','logs']]]
  ] as const;
  let order=0;
  for(const [id,label,path,icon,permission,phase,children] of nav) {
    await db.menu.upsert({where:{id},update:{},create:{id,label,path,icon,permissionCode:`${permission}:read`,displayOrder:order++,overflowPriority:order,phase}});
    let childOrder=0;
    for(const [cid,clabel,cpath,cp] of children) await db.menu.upsert({where:{id:cid},update:{},create:{id:cid,label:clabel,path:cpath,icon,parentId:id,permissionCode:`${cp}:read`,displayOrder:childOrder++,phase}});
  }
  await seedDataService(db);
  for(const [group,values] of [['粮食品种',['玉米','大豆','小麦','稻谷','其他']],['运输方式',['公路','铁路','水运','多式联运']],['费用类别',['运输费','装卸费','中转费','仓储费']]] as const) {
    for (let i=0;i<values.length;i++) await db.dictionary.upsert({where:{group_code:{group,code:`${i+1}`}},update:{},create:{group,code:`${i+1}`,label:values[i],sort:i}});
  }

const old=await db.user.findUnique({where:{username}});if(old){if(old.isTestData||old.businessEntityId!=='production-platform')throw Error('同名账号不属于生产平台');console.log('已有生产管理员保留，未覆盖账号和密码');return;}if(await db.user.count())throw Error('数据库已有用户，请通过现有管理员配置');const passwordHash=await hash(password,12);await db.$transaction(async tx=>{const org=await tx.organization.upsert({where:{id:'production-organization'},update:{},create:{id:'production-organization',name}});await tx.businessEntity.upsert({where:{id:'production-platform'},update:{},create:{id:'production-platform',name,type:'PLATFORM',organizationId:org.id,isTestData:false}});await tx.user.create({data:{username,displayName:'平台管理员',businessEntityId:'production-platform',passwordHash,isTestData:false,mustChangePassword:true,roles:{create:{role:{connect:{code:'platform_admin'}}}}}});});console.log('已初始化生产平台与管理员，无开发账号或运输业务。首次登录须修改密码。');}main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
