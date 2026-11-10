/* Repair existing server records. Never imports or replaces a database. */
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
process.chdir(root);
const envFile=path.resolve(root,process.env.ENV_FILE||(fs.existsSync('.env.server')?'.env.server':'.env'));
if(fs.existsSync(envFile))require('dotenv').config({path:envFile,quiet:true});
process.env.NODE_ENV='production';
const raw=process.env.DATABASE_URL||'file:./server.db';
if(!raw.startsWith('file:'))throw Error('修复仅支持现有 SQLite 数据库');
const rawPath=raw.slice(5).split('?')[0];
if(!rawPath||rawPath===':memory:')throw Error('修复需要现有持久化数据库');
const database=path.isAbsolute(rawPath)?rawPath:path.resolve(root,'prisma',rawPath);
if(!fs.existsSync(database)||!fs.statSync(database).isFile()||fs.statSync(database).size<100)throw Error('未找到现有数据库，已停止；请确认 ENV_FILE 和 DATABASE_URL，禁止初始化空数据库');
process.env.DATABASE_URL='file:'+database.replaceAll('\\','/');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.resolve('.local/backups/business-repair-'+stamp);
const reportFile=path.resolve('.local/repair-reports/business-repair-'+stamp+'.json');
function run(args){
 const result=spawnSync(process.execPath,args,{cwd:root,env:process.env,encoding:'utf8',windowsHide:true,maxBuffer:12*1024*1024});
 if(result.stdout)process.stdout.write(result.stdout);
 if(result.stderr)process.stderr.write(result.stderr);
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('步骤执行失败：'+args.join(' ')+'；已停止后续步骤，修复可重复执行');
}
async function inspect(){
 const {PrismaClient}=require('@prisma/client');
 const db=new PrismaClient();
 try{
  const entity=await db.businessEntity.findUniqueOrThrow({where:{id:'trader-a'},select:{id:true,name:true}});
  const bills=await db.bill.findMany({where:{traderId:entity.id,isTestData:false,status:{not:'DRAFT'}},select:{businessNo:true,status:true,totalCents:true},orderBy:{businessNo:'asc'}});
  const settlements=await db.settlement.count({where:{bill:{traderId:entity.id,isTestData:false,status:{not:'DRAFT'}}}});
  const requests=await db.dataAccessRequest.count({where:{entityId:entity.id,id:{startsWith:'data-service-business-v1'}}});
  const authorizations=await db.dataAuthorization.count({where:{entityId:entity.id,requestId:{startsWith:'data-service-business-v1'}}});
  const subscriptions=await db.dataSubscription.count({where:{authorization:{entityId:entity.id,requestId:{startsWith:'data-service-business-v1'}}}});
  return {entity,bills,settlements,requests,authorizations,subscriptions};
 }finally{await db.$disconnect();}
}
async function main(){
 const apply=process.argv.includes('--apply');
 console.log('数据库：'+database+'\n配置文件：'+(fs.existsSync(envFile)?envFile:'使用现有进程环境'));
 if(!apply){
  console.log('只读检查；执行 --apply 才会备份并补齐数据。');
  run(['tools/initialize-billing-data.cjs']);
  run(['tools/initialize-data-service-records.cjs']);
  console.log(JSON.stringify(await inspect(),null,2));
  return;
 }
 run(['tools/backup.mjs',backup]);
 run(['node_modules/prisma/build/index.js','migrate','deploy']);
 // Validate the known source records before either workflow is changed.
 run(['tools/initialize-billing-data.cjs']);
 run(['tools/initialize-data-service-records.cjs']);
 run(['tools/initialize-billing-data.cjs','--apply']);
 run(['tools/initialize-data-service-records.cjs','--apply']);
 run(['tools/initialize-billing-data.cjs','--verify']);
 run(['tools/initialize-data-service-records.cjs','--verify']);
 const visible=await inspect();
 if(visible.bills.length<2||visible.settlements<1||visible.requests!==7||visible.authorizations!==5||visible.subscriptions!==6)throw Error('补齐后数量不符合预期，请保留备份并查看日志');
 const report={status:'PASS',completedAt:new Date().toISOString(),database,backup,visible,externalPaymentsSent:false,credentialsChanged:false};
 fs.mkdirSync(path.dirname(reportFile),{recursive:true});
 fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
 console.log('\n修复完成：当前企业至少可见 2 张账单、1 张结算单，另有 7 条申请、5 项授权、6 项订阅。\n报告：'+reportFile+'\n备份：'+backup);
}
main().catch(error=>{console.error('修复未完成：'+error.message);process.exitCode=1;});
