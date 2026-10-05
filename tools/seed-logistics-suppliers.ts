import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {seedLogisticsSuppliers} from '../prisma/seed-logistics-suppliers';
const db=new PrismaClient();seedLogisticsSuppliers(db).then(r=>console.log(`已初始化${r.companies}家模拟物流企业、${r.supplies}条已发布运力；现有企业资料保留`)).finally(()=>db.$disconnect());
