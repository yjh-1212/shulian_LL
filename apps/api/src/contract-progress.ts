export function signingComplete(p:any,entityId:string){
 const role=entityId===p.traderId?'TRADER':entityId===p.carrierId?'CARRIER':entityId===p.platformId?'PLATFORM':'';
 const r=p.revisions.at(-1);if(!r)return false;
 const documents=role==='PLATFORM'?(r.mode==='B'?['ADDENDUM']:[]):['MAIN','ADDENDUM'];
 return documents.length?documents.every(type=>r.signatures.some((s:any)=>s.role===role&&s.documentType===type)):['EFFECTIVE','TERMINATED'].includes(p.status);
}
export function progress(p:any,business:any,bills:any[]){
 const tasks=business?.tasks||[],last=business?JSON.parse(business.segments).length:0;
 const completed=tasks.filter((t:any)=>t.segment===last&&t.status==='COMPLETED').reduce((s:number,t:any)=>s+(t.unloadedKg||0),0);
 const dispatched=tasks.filter((t:any)=>t.segment===1&&t.status!=='CANCELLED').reduce((s:number,t:any)=>s+t.quantityKg,0);
 const issues=tasks.flatMap((t:any)=>t.issues||[]).filter((i:any)=>i.status==='OPEN').length;
 const active=tasks.filter((t:any)=>!['COMPLETED','CANCELLED'].includes(t.status)).length;
 const activeBills=bills.filter(b=>b.status!=='VOID');
 const confirmedCents=activeBills.reduce((s,b)=>s+(b.settlement?.confirmedCents||0),0),settledCents=activeBills.reduce((s,b)=>s+(b.settlement?.settledCents||0),0);
 const managed=business?.stages?.some((s:any)=>s.managed);
 const performanceStatus=p.status==='TERMINATED'?'TERMINATED':!business?'WAITING':managed?(business.status==='COMPLETED'?'COMPLETED':business.status==='IN_PROGRESS'?'IN_PROGRESS':'WAITING'):completed>=p.quantityKg&&!active&&!issues?'COMPLETED':tasks.length?'IN_PROGRESS':'WAITING';
 const reasons:string[]=[];
 if(!['EFFECTIVE','TERMINATED'].includes(p.status))reasons.push('合同尚未生效');
 if(p.revisions.some((r:any)=>!['EFFECTIVE','REJECTED'].includes(r.status)))reasons.push('存在未完成的合同版本');
 if(p.status!=='TERMINATED'&&performanceStatus!=='COMPLETED')reasons.push('运输尚未履行完成');
 if(active||issues)reasons.push('存在未完成任务或运输异常');
 if(activeBills.some(b=>b.status!=='CONFIRMED'||b.settlement?.status!=='SETTLED'))reasons.push('存在未完成的对账或结算');
 const billed=new Set(activeBills.flatMap(b=>(b.tasks||[]).map((t:any)=>t.taskId)));
 if(tasks.some((t:any)=>t.status==='COMPLETED'&&!billed.has(t.id)))reasons.push('已完成任务尚未全部对账');
 return {dispatched,completed,issues,active,performanceStatus,confirmedCents,settledCents,unsettledCents:confirmedCents-settledCents,paymentPercent:confirmedCents?Math.round(settledCents/confirmedCents*100):0,canArchive:reasons.length===0,archiveReasons:reasons};
}
