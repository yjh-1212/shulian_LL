import type {Breakdown,Series} from './types';

export function businessScaleSeries(volume:Breakdown[],coordination:Series[]){
 const volumes=new Map(volume.map(row=>[row.name,row.value]));
 const demands=new Map(coordination.map(row=>[row.name,row.first]));
 const names=[...new Set([...volumes.keys(),...demands.keys()])].sort().slice(-6);
 const valid=(value:number|undefined)=>value!=null&&Number.isFinite(value)&&value>=0?value:null;
 return names.map(name=>({name,tonnes:valid(volumes.get(name))==null?null:volumes.get(name)!/1000,demands:valid(demands.get(name))}));
}

export function scaleAxis(values:(number|null)[],integer=false){
 const maximum=Math.max(0,...values.filter((value):value is number=>value!=null&&Number.isFinite(value)&&value>=0));
 const rough=Math.max(maximum/4,integer?1:0.25);
 const magnitude=10**Math.floor(Math.log10(rough));
 const multiplier=[1,2,2.5,5,10].find(value=>value*magnitude>=rough)??10;
 const step=integer?Math.max(1,Math.ceil(multiplier*magnitude)):multiplier*magnitude;
 return {maximum:step*4,ticks:Array.from({length:5},(_,index)=>index*step)};
}

export function monthlyChange(values:(number|null)[]){
 if(values.length<2)return null;
 const current=values.at(-1),previous=values.at(-2);
 if(current==null||previous==null||previous===0)return null;
 return (current-previous)/previous*100;
}
