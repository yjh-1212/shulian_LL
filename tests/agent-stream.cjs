const assert=require('node:assert/strict');
const {readModelStream}=require('../apps/api/dist/agent-model-stream');
const {IntelligenceService}=require('../apps/api/dist/intelligence.service');
function response(text,chunkSize=1){const bytes=new TextEncoder().encode(text);return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=chunkSize)controller.enqueue(bytes.slice(i,i+chunkSize));controller.close();}}));}
(async()=>{
 const pieces=[];
 const input=': keep-alive\r\n\r\ndata: '+JSON.stringify({choices:[{delta:{content:'运输'}}]})+'\r\n\r\ndata: '+JSON.stringify({choices:[{delta:{reasoning_content:'not visible',content:'正常。'}}]})+'\n\ndata: [DONE]\n\n';
 assert.equal(await readModelStream(response(input),s=>pieces.push(s)),'运输正常。');
 assert.deepEqual(pieces,['运输','正常。']);
 await assert.rejects(()=>readModelStream(response('data: {"choices":[{"delta":{"content":"未完成"}}]}\n'),()=>{}),/未完整返回/);
 await assert.rejects(()=>readModelStream(response('data: {"error":{"message":"provider error"}}\n\n'),()=>{}),/暂不可用/);
 await assert.rejects(()=>readModelStream(response('data: [DONE]\n'),()=>{}),/未完整返回/);
 let cancelled=false;
 const abortable=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"开始"}}]}\n'));},cancel(){cancelled=true;}}));
 await assert.rejects(()=>readModelStream(abortable,()=>{throw Error('stop');}),/stop/);assert.ok(cancelled);
 const failedDb={agentRun:{create:async()=>{throw Error('database unavailable');}}};
 const intelligence=new IntelligenceService(failedDb,null,null,null,null,null,null);
 for(let i=0;i<2;i++)await assert.rejects(()=>intelligence.ask({capability:'TRACK',contextType:'page',question:'查询业务'}, {user:{id:'lock-test'}}),/database unavailable/);
 assert.equal(intelligence.active.size,0,'Failed run creation must release the analysis lock');
 const documents=new IntelligenceService({documentReview:{count:async()=>{throw Error('document database unavailable');}}},null,{authorizeTask:async()=>({id:'task'})},null,null,null,null);
 for(let i=0;i<2;i++)await assert.rejects(()=>documents.recognize('task',{buffer:Buffer.from([255,216,255])},{user:{id:'document-lock-test',permissions:['tracking:read']}}),/document database unavailable/);
 assert.equal(documents.active.size,0,'Failed document preparation must release the analysis lock');
 const statuses=[],events=[];
 const db={agentRun:{create:async()=>({id:'run'}),update:async({data})=>statuses.push(data.status)},agentResult:{create:async({data})=>data},$transaction:async work=>work(db)};
 const degraded=new IntelligenceService(db,{write:async()=>{}},null,null,null,null,null);
 degraded.facts=async()=>({structured:{guidance:'已读取业务依据'},links:[],sources:[],quality:'REFERENCE'});
 degraded.model=async(_q,_facts,_history,_signal,onText)=>{onText('未完成的模型回答');throw Error('upstream truncated');};
 const originalKey=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY='local-test-only';let fallback;
 try{fallback=await degraded.ask({capability:'TRACK',contextType:'page',question:'查询运输',useModel:true},{user:{id:'fallback-test'}},[],undefined,e=>events.push(e));}finally{if(originalKey===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=originalKey;}
 assert.equal(fallback.status,'DEGRADED');assert.equal(fallback.provider,'RULES');assert.ok(!fallback.summary.includes('未完成的模型回答'));assert.ok(events.some(e=>e.type==='delta'));
 assert.equal(degraded.active.size,0);assert.equal(statuses.length,1);
 console.log(JSON.stringify({passed:true,splitUtf8:true,partialTokens:true,truncatedResponseRejected:true,providerError:true,cancellation:true,failedCreateReleasesLock:true,failedDocumentReleasesLock:true,degradedResultDoesNotSavePartialAnswer:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
