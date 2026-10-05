export type RoadResource = {driverId:string;vehicleId:string;capacityKg:number};
export function roadResourceError(resources:RoadResource[]):string|undefined {
 if(!resources.length)return '请添加车辆与司机';
 const vehicles=new Set<string>(),drivers=new Set<string>();
 for(const r of resources){
  if(!r.vehicleId||!r.driverId||!Number.isSafeInteger(r.capacityKg)||r.capacityKg<=0)return '请选择有效车辆和司机，并核实车辆核定载重';
  if(vehicles.has(r.vehicleId))return '同一阶段不能重复分配同一辆车';
  if(drivers.has(r.driverId))return '同一阶段不能重复分配同一位司机';
  vehicles.add(r.vehicleId);drivers.add(r.driverId);
 }
}
export type RoadFeedbackQuantity = {
 quantityKg:number;capacityKg:number;stageQuantityKg:number;contractQuantityKg:number;otherReportedKg:number;
 containerized:boolean;containers:{boxNo:string;quantityKg:number}[];grossKg?:number;tareKg?:number;
};
export function roadFeedbackQuantityError(f:RoadFeedbackQuantity):string|undefined {
 if(!Number.isSafeInteger(f.capacityKg)||f.capacityKg<=0)return '车辆核定载重缺失，请联系物流运营商核实车辆档案';
 if(!Number.isSafeInteger(f.quantityKg)||f.quantityKg<=0)return '请填写有效实际签收数量';
 if(f.quantityKg>f.capacityKg)return '实际签收数量不能超过车辆核定载重';
 if(!Number.isSafeInteger(f.otherReportedKg)||f.otherReportedKg<0)return '本阶段已回传数量异常，请联系物流运营商核实';
 if(f.otherReportedKg+f.quantityKg>f.stageQuantityKg)return '本阶段累计回传数量不能超过阶段运输数量';
 if(f.otherReportedKg+f.quantityKg>f.contractQuantityKg)return '本阶段累计回传数量不能超过合同数量';
 if(f.containerized){
  if(!f.containers.length)return '请填写集装箱箱号与实际粮食数量';
  if(f.containers.some(c=>!c.boxNo||!Number.isSafeInteger(c.quantityKg)||c.quantityKg<=0))return '每个集装箱须填写有效箱号与实际粮食数量';
  if(new Set(f.containers.map(c=>c.boxNo.trim().toUpperCase())).size!==f.containers.length)return '箱号不能重复';
  if(f.containers.reduce((n,c)=>n+c.quantityKg,0)!==f.quantityKg)return '集装箱数量合计须等于实际签收数量';
 }else if(f.containers.length)return '散货任务不能提交集装箱明细';
 if(f.grossKg!=null||f.tareKg!=null){
  const gross=f.grossKg,tare=f.tareKg;
  if(gross==null||tare==null||!Number.isSafeInteger(gross)||!Number.isSafeInteger(tare)||tare<0||gross<=tare)return '请填写有效毛重、皮重，毛重须大于皮重';
  if(gross-tare!==f.quantityKg)return '磅单净重须等于实际签收数量';
 }else return '请填写过磅毛重与皮重';
}
