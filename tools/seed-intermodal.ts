import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {seedPhase3} from '../prisma/seed-phase3';
const db=new PrismaClient();
seedPhase3(db).then(()=>console.log('Corridor nodes and lines seeded; existing edits preserved.')).finally(()=>db.$disconnect());
