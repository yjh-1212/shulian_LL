const has=(task:any,category:string)=>task.evidence?.some((e:any)=>
 e.category===category&&e.dataProvenance?.type!=='INITIALIZATION'&&e.sourceSystem!=='BUSINESS_INITIALIZATION');
const positiveKg=(value:any)=>Number.isInteger(value)&&value>0;
function feedback(task:any){
 if(task.feedback&&typeof task.feedback==='object')return task.feedback;
 try{const value=JSON.parse(task.feedback||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}
}

// Each corridor counts its cargo once. Dispatch does not establish a vehicle's actual load.
export function corridorProgress(stages:any[],totalKg:number){
 const groups=new Map<string,any>();
 const seen=new Map<string,{tasks:Set<string>,boxes:Set<string>,tickets:Set<string>}>();
 for(const s of stages){
  const key=[s.mode,s.origin,s.destination].join('|');
  if(!groups.has(key)){
   groups.set(key,{id:'node:'+s.id,mode:s.mode,origin:s.origin,destination:s.destination,targetKg:0,arrivedKg:0,shippedKg:0,reportedKg:0,awaitingEvidenceKg:0,boxes:[],tickets:[],unverifiedTasks:0,warnings:[],stageIds:[],taskIds:[],status:s.status});
   seen.set(key,{tasks:new Set(),boxes:new Set(),tickets:new Set()});
  }
  const g=groups.get(key),ids=seen.get(key)!;
  const stageLimit=Math.min(totalKg,positiveKg(s.quantityKg)?s.quantityKg:totalKg);
  let stageReportedKg=0;
  g.targetKg+=positiveKg(s.quantityKg)?s.quantityKg:0;g.stageIds.push(s.id);
  for(const t of s.tasks||[]){
   if(t.status==='CANCELLED')continue;
   if(t.id&&ids.tasks.has(t.id))continue;
   if(t.id)ids.tasks.add(t.id);g.taskIds.push(t.id);
   if(s.mode!=='ROAD'){
    if(['IN_TRANSIT','ARRIVED','UNLOADED','RECEIVED','COMPLETED'].includes(t.status))g.shippedKg+=t.loadedKg||t.quantityKg||0;
    if(['ARRIVED','UNLOADED','RECEIVED','COMPLETED'].includes(t.status))g.arrivedKg+=t.unloadedKg||0;
    continue;
   }
   if(!t.feedbackSubmittedAt){if(t.status==='COMPLETED')g.unverifiedTasks++;continue;}
   const f=feedback(t),net=Number(f.grossKg)-Number(f.tareKg);
   const capacity=positiveKg(t.vehicleCapacityKg)?t.vehicleCapacityKg:100000;
   const limit=Math.min(capacity,stageLimit,100000);
   if(!positiveKg(f.quantityKg)||!Number.isInteger(f.grossKg)||!Number.isInteger(f.tareKg)||f.tareKg<0||net!==f.quantityKg||net>limit){
    g.unverifiedTasks++;continue;
   }
   const boxes=s.containerized?(Array.isArray(f.containers)&&f.containers.length?f.containers:t.boxNo?[{boxNo:t.boxNo,quantityKg:net}]:[]):[];
   const boxNos=boxes.map((c:any)=>String(c.boxNo||'').trim().toUpperCase());
   if(s.containerized&&(!boxes.length||boxes.some((c:any,i:number)=>! /^[A-Z]{4}\d{7}$/.test(boxNos[i])||!positiveKg(c.quantityKg))||new Set(boxNos).size!==boxNos.length||boxes.reduce((sum:number,c:any)=>sum+c.quantityKg,0)!==net)||!s.containerized&&Array.isArray(f.containers)&&f.containers.length){
    g.unverifiedTasks++;continue;
   }
   const ticket=String(f.weightTicketNo||'').trim();
   const duplicateBoxes=boxNos.filter((boxNo:string)=>ids.boxes.has(boxNo));
   if(ticket&&ids.tickets.has(ticket)||duplicateBoxes.length){
    g.unverifiedTasks++;
    if(ticket&&ids.tickets.has(ticket))g.warnings.push('磅单 '+ticket+' 重复，已排除重复累计');
    for(const boxNo of duplicateBoxes)g.warnings.push('箱号 '+boxNo+' 重复，已排除重复累计');
    continue;
   }
   if(stageReportedKg+net>stageLimit||g.reportedKg+net>totalKg){
    g.unverifiedTasks++;g.warnings.push('回传净重累计超过阶段或运单数量，请核对磅单');continue;
   }
   if(ticket)ids.tickets.add(ticket);for(const boxNo of boxNos)ids.boxes.add(boxNo);
   stageReportedKg+=net;g.reportedKg+=net;
   const verified=has(t,'WEIGH')&&has(t,'RECEIPT')&&!!ticket&&(!s.containerized||has(t,'EIR')&&!!String(f.sealNo||'').trim());
   if(!verified){g.unverifiedTasks++;g.awaitingEvidenceKg+=net;continue;}
   g.arrivedKg+=net;g.tickets.push({ticketNo:ticket,quantityKg:net,taskId:t.id});
   for(let i=0;i<boxes.length;i++)g.boxes.push({boxNo:boxNos[i],quantityKg:boxes[i].quantityKg,taskId:t.id});
  }
 }
 return [...groups.values()].map(g=>{
  const targetKg=Math.min(totalKg,g.targetKg||totalKg);
  return {...g,targetKg,arrivedKg:Math.min(totalKg,g.arrivedKg),shippedKg:Math.min(totalKg,g.shippedKg),reportedKg:Math.min(totalKg,g.reportedKg),awaitingEvidenceKg:Math.min(totalKg,g.awaitingEvidenceKg),warnings:[...new Set(g.warnings)],percent:Math.min(100,Math.round((g.mode==='ROAD'?g.arrivedKg:g.shippedKg)/Math.max(1,targetKg)*100)),allShipped:g.mode!=='ROAD'&&g.shippedKg>=targetKg,allArrived:g.arrivedKg>=targetKg};
 });
}
