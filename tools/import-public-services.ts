import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {seedPublicServices} from '../prisma/seed-public-services';
const db=new PrismaClient();seedPublicServices(db).then(()=>console.log('Imported public references: X8784/3, IC9, IC15; existing platform edits preserved.')).finally(()=>db.$disconnect());
