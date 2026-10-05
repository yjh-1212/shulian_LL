export function extractPlanText(question:string){
 const text=question.replace(/[【】\[\]]/g,'').trim();
 const route=text.match(/从\s*(.{2,100}?)\s*(?:发运到|运输到|运送到|运到|送到|发往|至|到)\s*(.{2,100}?)(?=[，,。；;\n]|$)/)||text.match(/(.{2,100}?)\s*(?:→|至)\s*(.{2,100}?)(?=[，,。；;\n]|$)/);
 const clean=(s:string)=>s.replace(/^(?:请|帮我|规划|推荐|查询|运输|把|将|货物)+/g,'').replace(/(?:的)?(?:运输方案|联运方案|多式联运方案|多式联运路线|路线|运输|送货)$/g,'').trim();
 return {originText:route?clean(route[1]):'',destinationText:route?clean(route[2]):'',quantity:Number(text.match(/(\d+(?:\.\d+)?)\s*吨/)?.[1])||undefined,grain:['玉米','小麦','大豆','稻谷'].find(g=>text.includes(g)),loadingType:text.includes('集装箱')||/20GP|40GP/i.test(text)?'CONTAINER':text.includes('散货')||text.includes('散粮')?'BULK':undefined,containerType:/40GP/i.test(text)?'40GP':/20GP/i.test(text)?'20GP':undefined,containerCount:Number(text.match(/(\d+)\s*(?:个|只)?(?:集装)?箱/)?.[1])||undefined};
}
export function cleanPlanIntent(value:any){
 const out:any={};
 for(const key of ['originText','destinationText','grain'])if(typeof value?.[key]==='string'&&value[key].trim().length>=2&&value[key].length<=200)out[key]=value[key].trim();
 if(Number.isFinite(value?.quantity)&&value.quantity>=.001&&value.quantity<=100000)out.quantity=Math.round(value.quantity*1000)/1000;
 if(['BULK','CONTAINER'].includes(value?.loadingType))out.loadingType=value.loadingType;
 if(['20GP','40GP'].includes(value?.containerType))out.containerType=value.containerType;
 if(Number.isInteger(value?.containerCount)&&value.containerCount>=1&&value.containerCount<=10000)out.containerCount=value.containerCount;
 for(const key of ['departureAt','arrivalAt'])if(typeof value?.[key]==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value[key])&&Number.isFinite(Date.parse(value[key])))out[key]=new Date(value[key]).toISOString();
 return out;
}
