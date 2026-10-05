import {PrismaClient} from '@prisma/client';
export async function seedPhase789(db:PrismaClient){
 for(const [code,name,module] of [['billing:write','编制、核对与确认结算','对账结算'],['data:write','维护产品授权与外部态势','数据服务']])await db.permission.upsert({where:{code},update:{},create:{id:code.replace(':','-'),code,name,module}});
 for(const [code,label,sort] of [['TRANSPORT','基础运输费',1],['ROAD','公路短驳费',2],['RAIL','铁路运输费',3],['WATER','水运运输费',4],['HANDLING','装卸作业费',5],['TRANSFER','中转衔接费',6],['STORAGE','仓储堆存费',7],['CONTAINER','集装箱服务费',8],['WAITING','等待滞留费',9],['OTHER','其他经双方认可的费用',10]] as const)await db.dictionary.upsert({where:{group_code:{group:'费用项目',code}},update:{},create:{group:'费用项目',code,label,sort}});
}
