import { Controller, Get, Post, Put, Delete, Param, Query, Body, Req, Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { hash } from 'bcryptjs';
import { Database } from './database';
import { Audit } from './audit';
import { Permit, publicUser, userInclude } from './security';
import { ListDto, UserDto, EntityDto, RoleDto, DictionaryDto, ResetPasswordDto } from './dto';
import {businessDataScope} from './business-data-scope';
const pageResult=(q:ListDto,total:number,items:unknown[])=>({page:q.page,pageSize:q.pageSize,total,items});
const paging=(q:ListDto)=>({skip:(q.page-1)*q.pageSize,take:q.pageSize});
@Injectable()
export class AdminService {
  constructor(private db:Database,private audit:Audit){}
  async userOptions(){return {roles:await this.db.role.findMany({select:{id:true,name:true,code:true,entityType:true}}),entities:await this.db.businessEntity.findMany({where:{deletedAt:null,status:'ACTIVE',...businessDataScope()},select:{id:true,name:true,type:true}})};}
  async users(q:ListDto) {
    const where={deletedAt:null,...businessDataScope(),...(q.q?{OR:[{username:{contains:q.q}},{displayName:{contains:q.q}}]}:{}),...(q.status?{status:q.status}:{}),...(q.businessEntityId?{businessEntityId:q.businessEntityId}:{})};
    const [total,rows]=await this.db.$transaction([this.db.user.count({where}),this.db.user.findMany({where,include:userInclude,orderBy:{createdAt:q.order},...paging(q)})]);
    return pageResult(q,total,rows.map(publicUser));
  }
  async saveUser(dto:UserDto,req:any,id?:string) {
    if(id && dto.password) throw new BadRequestException('请通过重置密码功能修改他人密码');
    const existing=id?await this.db.user.findFirst({where:{id,deletedAt:null},include:userInclude}):null;
    if(id&&!existing) throw new NotFoundException('用户不存在');
    const entity=await this.db.businessEntity.findFirst({where:{id:dto.businessEntityId,deletedAt:null,status:'ACTIVE',...businessDataScope()}});
    const roles=await this.db.role.findMany({where:{id:{in:dto.roleIds}}});
    if(!entity||roles.length!==dto.roleIds.length||roles.some(r=>r.entityType!==entity.type)) throw new BadRequestException('所选角色与主体类型不匹配，或主体已停用');
    if(roles.some(r=>r.code==='driver')&&roles.length>1) throw new BadRequestException('司机角色不能与PC角色混用');
    if(id===req.user.id && (dto.status!=='ACTIVE'||dto.businessEntityId!==existing?.businessEntityId||JSON.stringify([...dto.roleIds].sort())!==JSON.stringify(existing.roles.map(r=>r.roleId).sort()))) throw new BadRequestException('不能停用自己或修改自己的主体与角色');
    if(existing?.roles.some(r=>r.role.code==='platform_admin') && (dto.status!=='ACTIVE'||!roles.some(r=>r.code==='platform_admin'))) {
      const other=await this.db.user.count({where:{id:{not:id},status:'ACTIVE',deletedAt:null,...businessDataScope(),roles:{some:{role:{code:'platform_admin'}}}}});
      if(other===0) throw new BadRequestException('必须保留至少一名可用的平台管理员');
    }
    if(!id&&!dto.password) throw new BadRequestException('新用户必须设置初始密码');
    const {roleIds,password,...fields}=dto;
    const passwordHash=password?await hash(password,12):undefined;
    return this.db.$transaction(async tx=>{
      const user=id?await tx.user.update({where:{id},data:{...fields,tokenVersion:{increment:1},roles:{deleteMany:{},create:roleIds.map(roleId=>({roleId}))}},include:userInclude}):await tx.user.create({data:{...fields,isTestData:false,passwordHash:passwordHash!,mustChangePassword:true,roles:{create:roleIds.map(roleId=>({roleId}))}},include:userInclude});
      if(id) await tx.refreshToken.updateMany({where:{userId:id},data:{revokedAt:new Date()}});
      const result=publicUser(user);
      await this.audit.write(tx,req,'用户管理',user.id,id?'编辑用户':'新增用户',existing?publicUser(existing):undefined,result);
      return result;
    });
  }
  async deleteUser(id:string,req:any) {
    if(id===req.user.id) throw new BadRequestException('不能删除当前账号');
    const u=await this.db.user.findFirst({where:{id,deletedAt:null},include:userInclude});
    if(!u) throw new NotFoundException('用户不存在');
    if(u.roles.some(r=>r.role.code==='platform_admin')) throw new BadRequestException('平台管理员请先调整角色，再删除');
    return this.db.$transaction(async tx=>{
      await tx.user.update({where:{id},data:{deletedAt:new Date(),status:'DISABLED',tokenVersion:{increment:1}}});
      await tx.refreshToken.updateMany({where:{userId:id},data:{revokedAt:new Date()}});
      await this.audit.write(tx,req,'用户管理',id,'删除用户',publicUser(u));return {success:true};
    });
  }
  async resetPassword(id:string,dto:ResetPasswordDto,req:any) {
    if(id===req.user.id) throw new BadRequestException('请在账号设置修改自己的密码');
    const u=await this.db.user.findFirst({where:{id,deletedAt:null}});
    if(!u) throw new NotFoundException('用户不存在');
    const passwordHash=await hash(dto.newPassword,12);
    return this.db.$transaction(async tx=>{
      await tx.user.update({where:{id},data:{passwordHash,tokenVersion:{increment:1},mustChangePassword:true}});
      await tx.refreshToken.updateMany({where:{userId:id},data:{revokedAt:new Date()}});
      await this.audit.write(tx,req,'用户管理',id,'重置密码');return {success:true};
    });
  }
  roles(){return this.db.role.findMany({include:{permissions:{include:{permission:true}},_count:{select:{users:true}}},orderBy:{code:'asc'}});}
  async saveRole(id:string,dto:RoleDto,req:any) {
    const before=await this.db.role.findUnique({where:{id},include:{permissions:true}});
    if(!before) throw new NotFoundException('角色不存在');
    const permissions=await this.db.permission.findMany({where:{id:{in:dto.permissionIds}}});
    if(permissions.length!==dto.permissionIds.length) throw new BadRequestException('权限不存在');
    if(before.code==='driver'&&permissions.length) throw new BadRequestException('司机不可授予PC权限');
    const platformModules=['users','roles','entities','dictionaries','logs','contract-template'];
    if(before.entityType!=='PLATFORM'&&permissions.some(p=>platformModules.includes(p.code.split(':')[0])||['trade-orders:import','plan:maintain','data:write'].includes(p.code))) throw new BadRequestException('企业角色不可授予平台专属权限');
    if(before.entityType==='PLATFORM'&&permissions.some(p=>p.code==='match:negotiate'))throw new BadRequestException('平台仅可查看匹配，不参与商务议价');
    if(permissions.some(p=>(['demand:write','demand:publish','plan:select','match:publish','match:confirm'].includes(p.code)&&before.entityType!=='TRADER')||(['supply:write','supply:publish','match:quote'].includes(p.code)&&before.entityType!=='CARRIER'))) throw new BadRequestException('供需维护权限必须与角色主体类型一致');
    if(before.code==='platform_admin'&&['home:read','roles:read','roles:write','users:read','users:write'].some(code=>!permissions.some(p=>p.code===code))) throw new BadRequestException('平台管理员必须保留账号与权限维护能力');
    return this.db.$transaction(async tx=>{
      const result=await tx.role.update({where:{id},data:{name:dto.name,description:dto.description,permissions:{deleteMany:{},create:dto.permissionIds.map(permissionId=>({permissionId}))}},include:{permissions:true}});
      await this.audit.write(tx,req,'角色权限',id,'更新角色权限',before,result);return result;
    });
  }
  permissions(){return this.db.permission.findMany({orderBy:[{module:'asc'},{code:'asc'}]});}
  async entities(q:ListDto) {
    const where={deletedAt:null,...businessDataScope(),...(q.q?{name:{contains:q.q}}:{}),...(q.type?{type:q.type}:{}),...(q.status?{status:q.status}:{})};
    const [total,items]=await this.db.$transaction([this.db.businessEntity.count({where}),this.db.businessEntity.findMany({where,include:{_count:{select:{users:{where:{deletedAt:null}}}}},orderBy:{createdAt:q.order},...paging(q)})]);
    return pageResult(q,total,items);
  }
  async saveEntity(dto:EntityDto,req:any,id?:string) {
    if(dto.registeredCodes!==undefined){
      const areas:Record<string,Record<string,string>>=require('china-area-data'),[province,city]=dto.registeredCodes.split('/');
      if(dto.registeredCodes&&(!areas['86'][province]||!areas[province]?.[city]))throw new BadRequestException('请选择有效的企业注册省市');
      dto.registeredRegion=dto.registeredCodes?[areas['86'][province],areas[province][city]].join(' / '):'';
    }
    const before=id?await this.db.businessEntity.findFirst({where:{id,deletedAt:null}}):null;
    if(id&&!before) throw new NotFoundException('主体不存在');
    if(id===req.user.businessEntityId&&dto.status!=='ACTIVE') throw new BadRequestException('不能停用当前所属平台');
    if(before&&before.type!==dto.type) throw new BadRequestException('主体类型不可变更，请新建主体');
    const org=await this.db.organization.findFirstOrThrow();
    return this.db.$transaction(async tx=>{
      const entity=id?await tx.businessEntity.update({where:{id},data:dto}):await tx.businessEntity.create({data:{...dto,isTestData:false,organizationId:org.id}});
      if(dto.status==='DISABLED') await tx.refreshToken.updateMany({where:{user:{businessEntityId:entity.id}},data:{revokedAt:new Date()}});
      await this.audit.write(tx,req,'合作主体',entity.id,id?'编辑主体':'新增主体',before??undefined,entity);return entity;
    });
  }
  async deleteEntity(id:string,req:any) {
    const before=await this.db.businessEntity.findFirst({where:{id,deletedAt:null}});
    if(!before) throw new NotFoundException('主体不存在');
    if(id===req.user.businessEntityId) throw new BadRequestException('不能删除当前主体');
    if(await this.db.user.count({where:{businessEntityId:id,deletedAt:null}})) throw new BadRequestException('主体仍有关联用户，请先处理用户');
    return this.db.$transaction(async tx=>{
      await tx.businessEntity.update({where:{id},data:{deletedAt:new Date(),status:'DISABLED'}});
      await this.audit.write(tx,req,'合作主体',id,'删除主体',before);return {success:true};
    });
  }
  async dictionaries(q:ListDto) {
    const where={...(q.q?{OR:[{group:{contains:q.q}},{label:{contains:q.q}},{code:{contains:q.q}}]}:{}),...(q.status?{enabled:q.status==='ACTIVE'}:{})};
    const [total,items]=await this.db.$transaction([this.db.dictionary.count({where}),this.db.dictionary.findMany({where,orderBy:[{group:'asc'},{sort:q.order}],...paging(q)})]);
    return pageResult(q,total,items);
  }
  async saveDictionary(dto:DictionaryDto,req:any,id?:string) {
    const before=id?await this.db.dictionary.findUnique({where:{id}}):null;
    if(id&&!before) throw new NotFoundException('字典项不存在');
    return this.db.$transaction(async tx=>{
      const result=id?await tx.dictionary.update({where:{id},data:dto}):await tx.dictionary.create({data:dto});
      await this.audit.write(tx,req,'数据字典',result.id,id?'编辑字典':'新增字典',before??undefined,result);return result;
    });
  }
  async logs(q:ListDto) {
    if(q.type==='login') {
      const where={...(q.q?{username:{contains:q.q}}:{}),...(q.status?{success:q.status==='SUCCESS'}:{})};
      const [total,items]=await this.db.$transaction([this.db.loginLog.count({where}),this.db.loginLog.findMany({where,orderBy:{createdAt:q.order},...paging(q)})]);return pageResult(q,total,items);
    }
    const where={...(q.q?{OR:[{userName:{contains:q.q}},{action:{contains:q.q}},{module:{contains:q.q}}]}:{}),...(q.status?{result:q.status}:{})};
    const [total,items]=await this.db.$transaction([this.db.auditLog.count({where}),this.db.auditLog.findMany({where,orderBy:{createdAt:q.order},...paging(q)})]);return pageResult(q,total,items);
  }
}
@ApiTags('平台管理') @ApiBearerAuth() @Controller()
export class AdminController {
  constructor(private service:AdminService){}
  @Get('users') @Permit('users:read') users(@Query() q:ListDto){return this.service.users(q);}
  @Get('users/options') @Permit('users:write') options(){return this.service.userOptions();}
  @Post('users') @Permit('users:write') createUser(@Body() dto:UserDto,@Req() req:any){return this.service.saveUser(dto,req);}
  @Put('users/:id') @Permit('users:write') updateUser(@Param('id') id:string,@Body() dto:UserDto,@Req() req:any){return this.service.saveUser(dto,req,id);}
  @Delete('users/:id') @Permit('users:write') deleteUser(@Param('id') id:string,@Req() req:any){return this.service.deleteUser(id,req);}
  @Post('users/:id/reset-password') @Permit('users:write') reset(@Param('id') id:string,@Body() dto:ResetPasswordDto,@Req() req:any){return this.service.resetPassword(id,dto,req);}
  @Get('roles') @Permit('roles:read') roles(){return this.service.roles();}
  @Put('roles/:id') @Permit('roles:write') updateRole(@Param('id') id:string,@Body() dto:RoleDto,@Req() req:any){return this.service.saveRole(id,dto,req);}
  @Get('permissions') @Permit('roles:read') permissions(){return this.service.permissions();}
  @Get('entities') @Permit('entities:read') entities(@Query() q:ListDto){return this.service.entities(q);}
  @Post('entities') @Permit('entities:write') createEntity(@Body() dto:EntityDto,@Req() req:any){return this.service.saveEntity(dto,req);}
  @Put('entities/:id') @Permit('entities:write') updateEntity(@Param('id') id:string,@Body() dto:EntityDto,@Req() req:any){return this.service.saveEntity(dto,req,id);}
  @Delete('entities/:id') @Permit('entities:write') deleteEntity(@Param('id') id:string,@Req() req:any){return this.service.deleteEntity(id,req);}
  @Get('dictionaries') @Permit('dictionaries:read') dictionaries(@Query() q:ListDto){return this.service.dictionaries(q);}
  @Post('dictionaries') @Permit('dictionaries:write') createDictionary(@Body() dto:DictionaryDto,@Req() req:any){return this.service.saveDictionary(dto,req);}
  @Put('dictionaries/:id') @Permit('dictionaries:write') updateDictionary(@Param('id') id:string,@Body() dto:DictionaryDto,@Req() req:any){return this.service.saveDictionary(dto,req,id);}
  @Get('logs') @Permit('logs:read') logs(@Query() q:ListDto){return this.service.logs(q);}
}
