const fs=require('node:fs'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),{hash}=require('bcryptjs'),{PrismaClient}=require('@prisma/client');
const runtime=JSON.parse(fs.readFileSync('.local/tests/general-assistant-20261031/runtime.json','utf8'));
assert(runtime.databaseUrl.includes('/.local/tests/general-assistant-20261031/'),'Only run against the isolated assistant test database');
const db=new PrismaClient({datasourceUrl:runtime.databaseUrl}),base='http://127.0.0.1:3002/api';
async function call(method,path,input,token,status=method==='GET'?200:201){const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(input?{body:JSON.stringify(input)}:{})});const json=await response.json();assert.equal(response.status,status,path+': '+JSON.stringify(json));return json.data;}
(async()=>{try{
 const session=await call('POST','/auth/experience',{}),token=session.accessToken;
 await call('POST','/agents/center/conversations',{capability:'GENERAL'},null,401);
 const conversation=await call('POST','/agents/center/conversations',{capability:'GENERAL',contextType:'page'},token);
 const ask=(question,key=randomUUID())=>call('POST',`/agents/center/conversations/${conversation.id}/messages`,{question,requestKey:key},token);
 const greeting=await ask('你好');assert.match(greeting.response.summary,/你好/);assert.equal(greeting.response.structured.tasks,undefined);
 const guide=await ask('账单核对与结算怎么操作');assert.match(guide.response.summary,/账单管理/);
 const requestKey=randomUUID(),tasks=await ask('汇总当前运输任务的进度和预警',requestKey);assert(Array.isArray(tasks.response.structured.tasks));
 const replay=await ask('汇总当前运输任务的进度和预警',requestKey);assert.equal(replay.id,tasks.id);
 const detail=await call('GET','/agents/center/conversations/'+conversation.id,null,token);assert.equal(detail.capability,'GENERAL');assert.equal(detail.turns.length,3);
 assert.equal(await db.agentTurn.count({where:{conversationId:conversation.id}}),3);
 const role=await db.role.findUniqueOrThrow({where:{code:'trader_admin'}}),otherEntity=await db.businessEntity.findFirstOrThrow({where:{type:'TRADER',status:'ACTIVE',deletedAt:null,id:{not:session.user.businessEntityId}}});
 for(const entityId of [session.user.businessEntityId,otherEntity.id]){
  const username='assistant-qa-'+randomUUID(),password=randomUUID();
  await db.user.create({data:{username,displayName:'通用助手验收',passwordHash:await hash(password,10),businessEntityId:entityId,roles:{create:{roleId:role.id}}}});
  const other=await call('POST','/auth/login',{username,password});
  await call('GET','/agents/center/conversations/'+conversation.id,null,other.accessToken,404);
  await call('POST','/agents/center/conversations/'+conversation.id+'/messages',{question:'读取他人对话',requestKey:randomUUID()},other.accessToken,404);
 }
 const report={status:'PASS',authRequired:true,realHttpConversation:true,generalCapability:detail.capability,turns:3,ordinaryGreeting:true,businessGuidance:true,scopedTaskQuery:true,idempotentRetry:true,sameCompanyUserIsolation:true,crossCompanyIsolation:true};
 fs.mkdirSync('docs/acceptance/general-assistant-20261031',{recursive:true});fs.writeFileSync('docs/acceptance/general-assistant-20261031/api.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await db.$disconnect();}})().catch(e=>{console.error(e.message);process.exitCode=1});
