import {getToken,renew} from './api';
export function agentRequestKey(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export async function sendAgentMessage(id:string,input:{question:string,requestKey:string},onEvent:(event:any)=>void,signal:AbortSignal){return streamAgentOperation(id,'messages',input,onEvent,signal);}
export async function solveAgentPlan(id:string,input:{input:any,requestKey:string},onEvent:(event:any)=>void,signal:AbortSignal){return streamAgentOperation(id,'solve',input,onEvent,signal);}
async function streamAgentOperation(id:string,operation:string,input:any,onEvent:(event:any)=>void,signal:AbortSignal){
 const request=()=>fetch('/api/agents/center/conversations/'+encodeURIComponent(id)+'/'+operation+'/stream',{method:'POST',credentials:'same-origin',headers:{Authorization:'Bearer '+getToken(),'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify(input),signal});
 let response=await request();if(response.status===401){await renew();response=await request();}
 if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.message||'智能分析请求失败，请重试');}
 if(!response.body)throw new Error('未收到智能分析结果，请重试');
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',result:any;
 const event=(line:string)=>{if(!line.startsWith('data:'))return;const data=JSON.parse(line.slice(5).trim());if(data.type==='error')throw new Error(data.message);if(data.type==='result')result=data.turn;onEvent(data);};
 try{
  while(!result){const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});if(pending.length>5000000)throw new Error('智能分析响应过大');let at;while((at=pending.indexOf('\n'))!==-1){event(pending.slice(0,at).replace(/\r$/,''));pending=pending.slice(at+1);}}
  if(!result)throw new Error('连接已中断，已保留问题，请重试');
  return result;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
