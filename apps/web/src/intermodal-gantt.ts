import {label,ton,transportMode} from './fulfillment';
export interface GanttRow {
  id:string; name:string; detail:string; mode:string; status:string; statusLabel:string;
  start:string; end:string; actual?:string; taskNo?:string; vehicleKey?:string;
}
export interface GanttGroup {
  id:string; title:string; route:string; mode:string; rows:GanttRow[]; vehicleCount:number;
}
const stageStatus:Record<string,string>={DRAFT:'待提交',SUBMITTED:'执行中',COMPLETED:'已完成'};
export function buildGanttGroups(stages:any[]):GanttGroup[]{
  return stages.map(s=>{
    let rows:GanttRow[];
    if(s.mode==='ROAD'){
      const tasks=s.tasks||[];
      rows=tasks.length?tasks.map((t:any,index:number)=>{
        const completion=[...(t.events||[])].reverse().find((e:any)=>e.type==='COMPLETE');
        return {id:s.id+'-'+t.id,name:t.vehicle?.plate||t.resource||'车辆 '+(index+1),
          detail:(t.driver?.displayName||'司机待分配')+' · '+(t.feedbackSubmittedAt||t.unloadedKg>0?'已回传 '+ton(t.unloadedKg||t.feedback?.quantityKg||0):'待过磅'),
          mode:s.mode,status:t.status,statusLabel:t.status==='RECEIVED'&&t.feedbackSubmittedAt?'已回传 · 待确认':label(t.status),
          start:t.plannedStartAt||s.plannedStartAt,end:t.plannedEndAt||s.plannedEndAt,
          actual:t.status==='COMPLETED'?(completion?.payload?.actualEndAt||completion?.createdAt||s.actualEndAt):undefined,
          taskNo:t.businessNo,vehicleKey:t.vehicleId||t.vehicle?.plate||t.resource||t.id};
      }):(s.allocations||[]).map((a:any,index:number)=>({
        id:s.id+'-allocation-'+index,name:a.vehicle?.plate||a.plate||'车辆 '+(index+1),
        detail:(a.driver?.displayName||'司机待分配')+' · 待过磅',
        mode:s.mode,status:'DRAFT',statusLabel:'待提交',start:a.startAt||s.plannedStartAt,end:a.endAt||s.plannedEndAt,
        vehicleKey:a.vehicleId||a.plate||String(index)}));
    }else rows=[{id:s.id,name:s.mode==='WATER'?(s.vessel||'船舶待填写'):(s.railWaybillNo||'铁路运单待填写'),
      detail:s.mode==='WATER'&&s.voyage?'航次 '+s.voyage+' · '+ton(s.quantityKg):ton(s.quantityKg),
      mode:s.mode,status:s.status,statusLabel:stageStatus[s.status]||label(s.status),
      start:s.plannedStartAt,end:s.plannedEndAt,actual:s.actualEndAt}];
    return {id:s.id,title:'第 '+s.sequence+' 阶段 · '+transportMode(s.mode),route:s.origin+' → '+s.destination,mode:s.mode,rows,vehicleCount:s.mode==='ROAD'?new Set(rows.map(v=>v.vehicleKey)).size:0};
  });
}
