import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

// Orders supplied by the user for the local business demonstration.
export const tradeOrderSamples = [
  ['JY202610020001','玉米','二等',5000,'辽宁省盘锦市双台子区粮食储备库','210000/211100/211102'],
  ['JY202610020002','玉米','一等',3200,'吉林省四平市铁西区粮食储备库','220000/220300/220302'],
  ['JY202610020003','大豆','三等',2800,'黑龙江省绥化市北林区粮库','230000/231200/231202'],
  ['JY202610020004','稻谷','二等',4500,'黑龙江省佳木斯市郊区粮食储备库','230000/230800/230811'],
  ['JY202610020005','小麦','一等',3600,'辽宁省锦州市太和区粮食储备库','210000/210700/210711'],
  ['JY202610020006','玉米','三等',6200,'内蒙古自治区通辽市科尔沁区粮库','150000/150500/150502'],
  ['JY202610020007','大豆','二等',2100,'黑龙江省黑河市爱辉区粮食储备库','230000/231100/231102'],
  ['JY202610020008','稻谷','一等',4000,'吉林省松原市宁江区粮食储备库','220000/220700/220702'],
  ['JY202610020009','小麦','二等',3000,'辽宁省营口市大石桥市粮食储备库','210000/210800/210882'],
  ['JY202610020010','玉米','二等',5500,'黑龙江省哈尔滨市双城区粮食储备库','230000/230100/230113'],
] as const;

export async function seedTradeOrders(db:PrismaClient) {
  if(process.env.NODE_ENV==='production')throw new Error('开发订单示例禁止在生产环境导入');
  const grains=await db.dictionary.findMany({where:{group:'粮食品种',enabled:true}});
  await db.$transaction(async tx=>{
    for(const [businessNo,cargoName,grainGrade,quantity,pickupAddress,pickupCodes] of tradeOrderSamples){
      const grain=grains.find(g=>g.label===cargoName);
      if(!grain)throw new Error(`缺少粮食品种：${cargoName}`);
      const sourceDigest=createHash('sha256').update(JSON.stringify({businessNo,cargoName,grainGrade,quantity,pickupAddress,pickupCodes})).digest('hex');
      const existing=await tx.tradeOrder.findUnique({where:{businessNo}});
      if(existing){
        if(existing.businessEntityId!=='trader-a'||existing.sourceDigest!==sourceDigest)throw new Error(`订单 ${businessNo} 已存在且内容不同`);
        continue;
      }
      await tx.tradeOrder.create({data:{businessNo,businessEntityId:'trader-a',recipient:'',shipperContact:'',shipperPhone:'',recipientContact:'',recipientPhone:'',sourceSystem:'user-provided-example',sourceRecordId:businessNo,sourceDigest,sourceType:'TEST',isTestData:true,items:{create:{lineNo:'1',grainId:grain.id,cargoName,specification:grainGrade,grainGrade,pickupAddress,pickupCodes,quantityKg:quantity*1000}}}});
    }
  },{timeout:15000});
}
