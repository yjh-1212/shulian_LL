import {Controller,Get,Post,Put,Param,Body,Query,Req,Injectable,BadRequestException,ForbiddenException,NotFoundException,ConflictException} from '@nestjs/common';
import {IsString,MinLength,MaxLength,Matches,IsBoolean,IsOptional,IsInt,Min} from 'class-validator';
import {Database} from './database';
import {Audit} from './audit';
import {Permit} from './security';
import {ListDto} from './dto';
class VesselInput {
 @IsString() @MinLength(2) @MaxLength(100) name!:string;
 @IsString() @MinLength(1) @MaxLength(100) voyage!:string;
 @IsString() @Matches(/^[2-7]\d{8}$/, {message:'MMSI 须为以 2—7 开头的 9 位数字'}) mmsi!:string;
 @IsOptional() @IsString() carrierId?:string;
 @IsBoolean() enabled=true;
 @IsOptional() @IsInt() @Min(1) version?:number;
}
@Injectable()
export class VesselService {
 constructor(private db:Database,private audit:Audit){}
 scope(r:any){const type=r.user.businessEntity.type;if(!['PLATFORM','CARRIER'].includes(type))throw new ForbiddenException('船舶档案仅供平台和所属物流企业维护');return type==='PLATFORM'?{}:{carrierId:r.user.businessEntityId};}
 async list(q:ListDto,r:any){const where={...this.scope(r),...(q.q?{OR:[{name:{contains:q.q}},{voyage:{contains:q.q}},{mmsi:{contains:q.q}}]}:{})};const [total,items,carriers]=await Promise.all([this.db.vesselArchive.count({where}),this.db.vesselArchive.findMany({where,skip:(q.page-1)*q.pageSize,take:q.pageSize,orderBy:{updatedAt:'desc'}}),this.db.businessEntity.findMany({where:{type:'CARRIER',status:'ACTIVE',deletedAt:null,...(r.user.businessEntity.type==='CARRIER'?{id:r.user.businessEntityId}:{})},select:{id:true,name:true}})]);return {items:items.map(v=>({...v,carrier:carriers.find(c=>c.id===v.carrierId)?.name||''})),total,carriers};}
 async save(d:VesselInput,r:any,id?:string){const scope=this.scope(r),platform=r.user.businessEntity.type==='PLATFORM';if(!r.user.permissions.includes(platform?'entities:write':'service:write'))throw new ForbiddenException('无船舶维护权限');return this.db.$transaction(async tx=>{const old=id?await tx.vesselArchive.findFirst({where:{id,...scope}}):null;if(id&&!old)throw new NotFoundException('档案不存在或无权维护');if(old&&old.version!==d.version)throw new ConflictException('档案已更新，请重新打开');const carrierId=platform?(old?.carrierId||d.carrierId):r.user.businessEntityId;if(d.carrierId&&d.carrierId!==carrierId)throw new ForbiddenException('不能修改其他企业的船舶档案');if(!carrierId||!await tx.businessEntity.findFirst({where:{id:carrierId,type:'CARRIER',status:'ACTIVE',deletedAt:null}}))throw new BadRequestException('请选择有效物流企业');const name=d.name.trim(),voyage=d.voyage.trim();if(!name||!voyage)throw new BadRequestException('请填写船名和航次');const other=await tx.vesselArchive.findFirst({where:{mmsi:d.mmsi,name:{not:name}}});if(other)throw new BadRequestException('该 MMSI 已对应其他船名，请核对');const data={carrierId,name,voyage,mmsi:d.mmsi,enabled:d.enabled};const row=old?await tx.vesselArchive.update({where:{id,version:d.version},data:{...data,version:{increment:1}}}):await tx.vesselArchive.create({data});await this.audit.write(tx,r,'船舶档案',row.id,old?'更新船舶档案':'登记船舶档案',old,row);return row;});}
}
@Controller('vessels') @Permit('tracking:read')
export class VesselController {
 constructor(private s:VesselService){}
 @Get() list(@Query() q:ListDto,@Req() r:any){return this.s.list(q,r);}
 @Post() create(@Body() d:VesselInput,@Req() r:any){return this.s.save(d,r);}
 @Put(':id') update(@Param('id') id:string,@Body() d:VesselInput,@Req() r:any){return this.s.save(d,r,id);}
}
