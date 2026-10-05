export const supplyCompany=(row:any)=>row.businessEntity?.name||row.carrier?.name||row.name||'—';
export const supplyLoading=(row:any)=>row.loadingType==='CONTAINER'?'集装箱':'散货';
export function supplyRange(row:any){
  const capacity=row.capacity??row.capacityKg/1000;
  const min=row.minQuantity??(row.minKg==null?capacity:row.minKg/1000);
  const max=row.maxQuantity??(row.maxKg==null?capacity:row.maxKg/1000);
  const format=(value:number)=>value.toLocaleString('zh-CN',{minimumFractionDigits:1,maximumFractionDigits:1});
  return `${format(min)} — ${format(max)} 吨`;
}
export function supplyQuotes(row:any){
  const price=(field:string)=>row[field]??(row[field+'Cents']==null?null:row[field+'Cents']/100);
  const text=(value:number|null,unit:string)=>value==null?'未报价':`${value.toLocaleString('zh-CN',{maximumFractionDigits:2})} ${unit}`;
  return row.loadingType==='CONTAINER'
    ?[`20GP：${text(price('container20Price'),'元/箱')}`,`40GP：${text(price('container40Price'),'元/箱')}`]
    :[text(price('bulkPrice'),'元/吨')];
}
