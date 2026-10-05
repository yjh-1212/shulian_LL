import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {ensureIntermodalBusiness} from '../apps/api/src/intermodal-business';
const db=new PrismaClient();
async function run(){const contracts=await db.contractPackage.findMany({where:{status:{in:['EFFECTIVE','TERMINATED']}}});let count=0;for(const p of contracts){if(p.status==='TERMINATED'&&!await db.logisticsBusiness.findUnique({where:{packageId:p.id}}))continue;await db.$transaction(tx=>ensureIntermodalBusiness(tx,p),{timeout:20000});count++;}console.log(JSON.stringify({contractsBackfilled:count,businesses:await db.logisticsBusiness.count(),stages:await db.transportStage.count()}));}
run().finally(()=>db.$disconnect());
