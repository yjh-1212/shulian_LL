export type AgentProgress={type:'status',message:string}|{type:'facts',summary:string}|{type:'delta',text:string};
export async function readModelStream(response:Response,onText:(text:string)=>void){
 if(!response.body)throw new Error('模型返回空结果');
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',text='',done=false;
 const line=(value:string)=>{
  if(!value.startsWith('data:'))return;
  const data=value.slice(5).trim();if(!data)return;
  if(data==='[DONE]'){done=true;return;}
  const item=JSON.parse(data);if(item.error)throw new Error('模型服务暂不可用');
  const part=item.choices?.[0]?.delta?.content;
  if(typeof part==='string'&&part){text+=part;if(text.length>12000)throw new Error('模型回答超出长度限制');onText(part);}
 };
 try{
  while(!done){const chunk=await reader.read();if(chunk.done)break;pending+=decoder.decode(chunk.value,{stream:true});if(pending.length>256000)throw new Error('模型响应格式无效');let at;while((at=pending.indexOf('\n'))!==-1){line(pending.slice(0,at).replace(/\r$/,''));pending=pending.slice(at+1);if(done)break;}}
  pending+=decoder.decode();if(!done&&pending.trim())line(pending.trim());
  if(!done||!text.trim())throw new Error('模型回答未完整返回，请重试');
  return text;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
