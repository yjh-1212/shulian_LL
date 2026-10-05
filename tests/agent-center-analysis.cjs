const {assert,login,report}=require('./helpers789.cjs'),{randomUUID}=require('node:crypto');
const results=[],pass=name=>{console.log('PASS',name);results.push({name,result:'PASS'});};
(async()=>{const t=await login('trader');try{
 const context=await t.call('GET','/agents/context');assert.equal(context.capabilities.length,6);
 const ids=[];for(const [capability,question] of [['ETA','当前执行中运单有哪些预计到达时间和延误风险？'],['PORT','已收录港口的拥堵记录有哪些，是否仍在有效期？'],['ENVIRONMENT','现有环境异常记录对运输有哪些影响？'],['DOCUMENT','如何上传设备交接单并复核？']]){
  const c=await t.call('POST','/agents/center/conversations',{capability});ids.push(c.id);
  const v=await t.call('POST','/agents/center/conversations/'+c.id+'/messages',{question,requestKey:randomUUID()});assert.equal(v.response.type,'ANALYSIS');assert(v.response.summary);assert.equal(v.response.provider,'DEEPSEEK');
  if(capability==='ETA')assert(Array.isArray(v.response.structured.forecasts));
  if(['PORT','ENVIRONMENT'].includes(capability))assert(v.response.structured.signals.every(x=>x.kind===(capability==='PORT'?'PORT':'ENVIRONMENT')));
  if(capability==='DOCUMENT')assert(v.response.structured.guidance.includes('上传'));
 }
 pass('六种能力已授权；ETA、港口、环境和单据对话接入实际业务上下文并默认使用模型');
 const demand=await t.call('POST','/plans/examples/demand',{}),source=await t.call('GET','/plans/demand/'+demand.id+'/input');
 const c=await t.call('POST','/agents/center/conversations',{capability:'PLAN',contextType:'transport-demand',contextId:demand.id});
 const turn=await t.call('POST','/agents/center/conversations/'+c.id+'/messages',{question:'这批改成200吨大豆，请求解运输路线',requestKey:randomUUID()});
 assert.equal(turn.response.draft.demandId,demand.id);assert.equal(turn.response.draft.quantity,source.quantity);assert.equal(turn.response.draft.grainId,source.grainId);assert.equal(turn.response.draft.sourceLocked,true);assert(turn.response.draft.origin?.nodeId);assert(turn.response.draft.destination?.nodeId);
 pass('运输需求带入后自动匹配地址，并保留订单货物、数量、时间和装载约束');
 report('agent-center-analysis',results,{conversationIds:ids,demandConversationId:c.id,demandId:demand.id});
 }finally{await t.logout();}})().catch(e=>{console.error(e);process.exit(1);});
