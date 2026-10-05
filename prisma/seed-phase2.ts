import { PrismaClient } from '@prisma/client';
import { seedTradeOrders } from './seed-trade-orders';
export async function seedPhase2(db:PrismaClient){
  // Roles are granted in migration (existing installs) or seed.ts (new installs).
  const grains=await db.dictionary.findMany({where:{group:'粮食品种'}});
  for(const [index,grain] of grains.filter(g=>g.code!=='5').entries()){
    for(const entity of ['trader-a','trader-b']){
      const id=`sample-order-${entity}-${grain.code}`;
      await db.tradeOrder.upsert({where:{id},update:{},create:{id,businessNo:`JY-DEV-${entity==='trader-a'?'A':'B'}-${grain.code.padStart(3,'0')}`,businessEntityId:entity,recipient:`南方收货单位 ${index+1}（开发样例）`,shipperContact:'发货样例联系人',shipperPhone:'13800000001',recipientContact:'收货样例联系人',recipientPhone:'13800000002',sourceSystem:'development-seed',sourceRecordId:id,sourceDigest:'development-seed-v1',sourceType:'TEST',isTestData:true,items:{create:{id:`${id}-item`,lineNo:'1',grainId:grain.id,cargoName:`${grain.label}（开发样例）`,specification:'国标二等 / 以订单约定为准',quantityKg:[5000000,800000,12000000,1500000][index]}}}});
    }
  }
  await seedTradeOrders(db);
}
