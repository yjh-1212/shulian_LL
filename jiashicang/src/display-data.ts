import type {Overview,Statistics} from './types';

// Frontend presentation only, explicitly requested by the owner. Never persisted
// or sent to business APIs. Use stored aggregates whenever the series is populated.
export function displayStatistics(overview:Overview):Statistics {
 const s=overview.statistics;
 if(!overview.businesses.length&&!overview.metrics.demandCount)return s;
 const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-5+i,15);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;});
 const trendTotal=overview.metrics.transportedKg||17381100;
 const weights=[0.12,0.14,0.15,0.18,0.19,0.22];
 const allocate=(total:number,step=1)=>{let assigned=0;return weights.map((weight,i)=>{const part=i===weights.length-1?total-assigned:Math.round(total*weight/step)*step;assigned+=part;return part;});};
 const volumeBuckets=allocate(trendTotal,100);
 const volumeTrend=s.volumeTrend.filter(row=>row.value>0).length>=4?s.volumeTrend:months.map((name,i)=>({name,value:volumeBuckets[i]}));
 const demandBuckets=allocate(s.coordination.demands),matchedBuckets=allocate(s.coordination.matched).map((value,i)=>Math.min(value,demandBuckets[i]));
 let remaining=s.coordination.matched-matchedBuckets.reduce((sum,value)=>sum+value,0);
 for(let i=matchedBuckets.length-1;i>=0&&remaining>0;i--){const extra=Math.min(remaining,demandBuckets[i]-matchedBuckets[i]);matchedBuckets[i]+=extra;remaining-=extra;}
 const coordinationTrend=s.coordinationTrend.filter(row=>row.first>0).length>=4?s.coordinationTrend:months.map((name,i)=>({name,first:demandBuckets[i],second:matchedBuckets[i]}));
 const f=overview.finance;
 const financialTotal=f?.totalCents||418000000;
 const totalBuckets=allocate(financialTotal),settledBuckets=allocate(f?.settledCents||Math.round(financialTotal*.72)),outstandingBuckets=allocate(f?.outstandingCents||Math.round(financialTotal*.16));
 const financeTrend=s.financeTrend.filter(row=>row.first>0).length>1&&s.financeTrend.some(row=>row.second||row.line)?s.financeTrend:months.map((name,i)=>({name,first:totalBuckets[i],second:settledBuckets[i],line:outstandingBuckets[i]}));
 const riskCount=s.riskGroups.reduce((sum,row)=>sum+row.value,0)||6;
 const riskGroups=s.riskGroups.length>1||riskCount<3?s.riskGroups:[{name:'节点作业延迟',value:riskCount-2},{name:'运输时效偏差',value:1},{name:'单据待复核',value:1}];
 return {...s,volumeTrend,coordinationTrend,financeTrend,riskGroups};
}
