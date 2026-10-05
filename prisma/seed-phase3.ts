import {PrismaClient} from '@prisma/client';import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {seedPublicServices} from './seed-public-services';
export async function seedPhase3(db:PrismaClient){
 const nodes=JSON.parse(await readFile(resolve(__dirname,'data/transport-nodes.json'),'utf8'));
 for(const node of nodes)await db.transportNode.upsert({where:{id:node.id},update:{},create:{...node,verifiedAt:new Date(node.verifiedAt)}});
 await seedPublicServices(db);
 await db.routePrice.upsert({where:{id:'sample-road-rate-v1'},update:{},create:{id:'sample-road-rate-v1',unit:'PER_TON_KM',rateMillis:320,validFrom:new Date('2026-01-01'),validUntil:new Date('2030-01-01'),source:'开发样例定价（非市场报价）',maintainer:'开发样例平台',isTestData:true}});
}
