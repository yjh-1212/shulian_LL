import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
type Tx=Prisma.TransactionClient;
@Injectable()
export class Audit {
  write(tx:Tx,req:any,module:string,objectId:string,action:string,before?:unknown,after?:unknown) {
    return tx.auditLog.create({data:{userId:req.user.id,userName:req.user.displayName,role:req.user.roles.map((r:any)=>r.code).join(','),businessEntityId:req.user.businessEntityId,ip:req.ip||'',userAgent:String(req.headers['user-agent']||'').slice(0,500),module,objectId,action,before:before===undefined?null:JSON.stringify(before),after:after===undefined?null:JSON.stringify(after),requestId:req.requestId}});
  }
}
