export const labels:Record<string,string>={DRAFT:'草稿',REVIEW:'待承运方确认',SIGNING:'待签署',EFFECTIVE:'已生效',REJECTED:'已拒签',TERMINATED:'已终止',DISPATCHED:'待接单',ACCEPTED:'待到达装货点',AT_LOADING:'待装货',LOADED:'待发车',IN_TRANSIT:'运输中',ARRIVED:'待卸货',UNLOADED:'待回单',RECEIVED:'待完成',COMPLETED:'已完成',RETURNED:'信息有误',CANCELLED:'已取消',OPEN:'待处理',RESOLVED:'已处理',MAIN:'运输主合同',ADDENDUM:'平台附加合同',TRADER:'贸易方',CARRIER:'承运方',PLATFORM:'平台',ROAD:'公路',RAIL:'铁路',WATER:'水运',SINGLE:'一单制',TRADITIONAL:'传统模式',ORIGINAL:'原始合同',CHANGE:'变更协议',TERMINATION:'终止协议',PUBLISHED:'已发布',ACCEPT:'确认接单',RETURN:'反馈信息有误',LOAD:'装货完成',DEPART:'发车',ARRIVE:'到达卸货点',UNLOAD:'卸货完成',RECEIPT:'提交回单',COMPLETE:'完成任务',POSITION:'记录位置'};
export const label=(s:string)=>labels[s]||s;
export const transportMode=(s:string)=>s==='WATER'?'水运':label(s)+'运输';
export const date=(s:string)=>s?new Date(s).toLocaleString('zh-CN',{hour12:false}):'—';
export const money=(n:number)=>`¥${(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2})}`;
export const ton=(n:number)=>`${(n/1000).toLocaleString('zh-CN',{minimumFractionDigits:1,maximumFractionDigits:1})} 吨`;
export function download(data:BlobPart,name:string,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export const eventLabel=(s:string)=>s==='AT_LOADING'?'到达装货点':label(s);
labels.MULTIMODAL='多式联运';
labels.DRIVER_REPORT='司机业务回传';
