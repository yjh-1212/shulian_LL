import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {seedDataService} from '../prisma/seed-data-service';
const db=new PrismaClient();seedDataService(db).then(()=>console.log('已初始化5项业务数据产品、企业访问权限与单一菜单；保留已有业务及授权。')).finally(()=>db.$disconnect());
