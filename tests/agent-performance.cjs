const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const {parse}=require('dotenv');
const {randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..');let server,folder,logs='';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
(async()=>{
 folder=await fs.mkdtemp(path.join(root,'.local/agent-performance-'));
 const database=path.join(folder,'server.db');await fs.copyFile(path.join(root,'ll_dist/liaoliang-server/prisma/server.db'),database);
 const config=parse(await fs.readFile(path.join(root,'ll_dist/liaoliang-server/.env.server')));
 const p=await port(),origin='http://127.0.0.1:'+p;
 const env={...process.env,...config,NODE_ENV:'production',SERVE_WEB:'true',PORT:String(p),API_HOST:'127.0.0.1',DATABASE_URL:'file:'+database.replace(/\\/g,'/'),TRUST_PROXY:'false',COOKIE_SECURE:'false'};
 server=spawn(process.execPath,['apps/api/dist/main.js'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>logs=(logs+b).slice(-8000));server.stderr.on('data',b=>logs=(logs+b).slice(-8000));
 for(let i=0;i<120;i++){try{if((await fetch(origin+'/api/health')).ok)break;}catch{}if(server.exitCode!==null)throw Error('API startup failed '+logs.slice(-1200));if(i===119)throw Error('startup timeout');await wait(250);}
 const login=await (await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:process.env.AGENT_TEST_PASSWORD})})).json();assert.ok(login.data?.accessToken,'Admin login');
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+login.data.accessToken};
 const request=async(method,route,body)=>{const r=await fetch(origin+'/api'+route,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});const j=await r.json();assert.ok(r.ok,route+': '+j.message);return j.data;};
 const begin=performance.now(),tasks=await request('GET','/agents/center/tasks?pageSize=20');const pickerMs=Math.round(performance.now()-begin);
 assert.ok(pickerMs<3000,'Picker must be a bounded inexpensive query');assert.ok(tasks.items.length<=20);if(tasks.items.length)assert.ok(!('currentPosition'in tasks.items[0]),'Picker must not load tracking analytics');
 const results=[];
 for(const [capability,question] of [['TRACK','汇总我当前运输任务的进度和异常。'],['ETA','有哪些在执行任务可能延误？'],['PORT','营口港有哪些有效的拥堵提示？'],['ENVIRONMENT','现有环境异常记录有哪些？'],['DOCUMENT','上传磅单前，我需要核对哪些字段？'],['PLAN','规划从公主岭站到鲅鱼圈港的1200.0吨玉米运输，散货。']]){
  if(process.env.AGENT_TEST_CAPABILITY&&process.env.AGENT_TEST_CAPABILITY!==capability)continue;
  const c=await request('POST','/agents/center/conversations',{capability});const requestKey=randomUUID(),start=performance.now();
  const r=await fetch(origin+'/api/agents/center/conversations/'+c.id+'/messages/stream',{method:'POST',headers,body:JSON.stringify({question,requestKey}),signal:AbortSignal.timeout(90000)});assert.equal(r.status,201);assert.match(r.headers.get('content-type'),/text\/event-stream/);assert.equal(r.headers.get('x-accel-buffering'),'no');
  const reader=r.body.getReader(),decoder=new TextDecoder();let pending='',firstEvent,firstContent,firstDelta,turn,error,events=0;
  for(;;){const chunk=await reader.read();if(chunk.done)break;pending+=decoder.decode(chunk.value,{stream:true});let at;while((at=pending.indexOf('\n'))!==-1){const line=pending.slice(0,at);pending=pending.slice(at+1);if(!line.startsWith('data:'))continue;const e=JSON.parse(line.slice(5));events++;firstEvent??=Math.round(performance.now()-start);if(e.type==='facts')firstContent??=Math.round(performance.now()-start);if(e.type==='delta'){firstDelta??=Math.round(performance.now()-start);firstContent??=firstDelta;}if(e.type==='result'){turn=e.turn;firstContent??=Math.round(performance.now()-start);}if(e.type==='error')error=e.message;}}
  assert.ok(turn,error||'Missing final turn');assert.ok(turn.response.summary);if(capability!=='PLAN')assert.equal(turn.response.provider,'DEEPSEEK','Live model should work for '+capability);
  const detail=await request('GET','/agents/center/conversations/'+c.id);assert.equal(detail.turns.length,1);assert.equal(detail.turns[0].id,turn.id);
  const duplicate=await request('POST','/agents/center/conversations/'+c.id+'/messages',{question,requestKey});assert.equal(duplicate.id,turn.id);
  const row={capability,firstEventMs:firstEvent,firstContentMs:firstContent,firstDeltaMs:firstDelta,totalMs:Math.round(performance.now()-start),events,status:turn.response.status||turn.response.type,provider:turn.response.provider||'CONDITION_EXTRACTION'};results.push(row);console.log(JSON.stringify(row));
  if(capability==='PLAN'){
   const draft=turn.response.draft;assert.ok(draft.origin&&draft.destination&&draft.grainId,'Public corridor nodes must be matched');
   const {origin:from,destination:to,grainId,quantity,loadingType,departureAt,arrivalAt}=draft;
   const input={origin:from,destination:to,grainId,quantity,loadingType,departureAt,arrivalAt,modes:['RAIL'],allowMultimodal:true,allowTransfer:true,maxTransfers:4,allowContainerization:true,allowModel:true,preference:'BALANCED'},key=randomUUID(),started=performance.now();
   const solve=await fetch(origin+'/api/agents/center/conversations/'+c.id+'/solve/stream',{method:'POST',headers,body:JSON.stringify({input,requestKey:key}),signal:AbortSignal.timeout(90000)});assert.match(solve.headers.get('content-type'),/text\/event-stream/);
   const rows=(await solve.text()).split('\n').filter(x=>x.startsWith('data:')).map(x=>JSON.parse(x.slice(5))),final=rows.find(x=>x.type==='result');assert.ok(final,rows.find(x=>x.type==='error')?.message||'Missing plan result');assert.ok(final.turn.response.plan.total>0,'Known public rail corridor should produce a candidate');
   const same=await request('POST','/agents/center/conversations/'+c.id+'/solve',{input,requestKey:key});assert.equal(same.id,final.turn.id);assert.equal((await request('GET','/agents/center/conversations/'+c.id)).turns.length,2);
   row.solveMs=Math.round(performance.now()-started);row.planCandidates=final.turn.response.plan.total;console.log(JSON.stringify({stage:'solve',...row}));
  }
 }
 await fs.writeFile(path.join(root,'.local/agent-performance-results.json'),JSON.stringify({origin,pickerMs,results},null,2));
 console.log(JSON.stringify({passed:true,origin,pickerMs,realAgentQuestions:results.length,streaming:true,idempotency:true,databaseIsolated:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{
 if(server?.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),wait(3000)]);}
 // Keep the private test copy and reports for browser follow-up; never alter the packaged database.
});
