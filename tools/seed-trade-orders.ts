import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedTradeOrders } from '../prisma/seed-trade-orders';
const db=new PrismaClient();
seedTradeOrders(db).then(()=>console.log('已导入十条交易订单，重复执行不会新增或覆盖订单。')).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
