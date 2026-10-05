import { Injectable, CanActivate, ExecutionContext, SetMetadata, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Database } from './database';
export const DriverEndpoint=()=>SetMetadata('driver',true);
export const Public = () => SetMetadata('public',true);
export const Permit = (code: string) => SetMetadata('permission',code);
export const userInclude = {businessEntity:true,roles:{include:{role:{include:{permissions:{include:{permission:true}}}}}}} as const;
export function publicUser(u: any) {
  return {id:u.id,username:u.username,displayName:u.displayName,phone:u.phone,email:u.email,department:u.department,status:u.status,businessEntityId:u.businessEntityId,businessEntity:u.businessEntity,roles:u.roles.map((x:any)=>({id:x.role.id,code:x.role.code,name:x.role.name})),permissions:[...new Set(u.roles.flatMap((x:any)=>x.role.permissions.map((p:any)=>p.permission.code)))],lastLoginAt:u.lastLoginAt,mustChangePassword:u.mustChangePassword,isTestData:u.isTestData,createdAt:u.createdAt};
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private db:Database,private jwt:JwtService,private reflector:Reflector){}
  async canActivate(context:ExecutionContext) {
    if(this.reflector.getAllAndOverride('public',[context.getHandler(),context.getClass()])) return true;
    const req=context.switchToHttp().getRequest();
    const driver=!!this.reflector.getAllAndOverride('driver',[context.getHandler(),context.getClass()]);
    try {
      const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if(!token) throw new Error();
      const payload=await this.jwt.verifyAsync(token,{algorithms:['HS256'],issuer:'grain-api',audience:driver?'grain-driver':'grain-web'});
      const [u,session]=await Promise.all([this.db.user.findUnique({where:{id:payload.sub},include:userInclude}),this.db.refreshToken.findUnique({where:{id:payload.sid}})]);
      if(!u||u.deletedAt||u.status!=='ACTIVE'||(process.env.NODE_ENV==='production'&&u.isTestData)||u.businessEntity.status!=='ACTIVE'||u.businessEntity.deletedAt||u.tokenVersion!==payload.ver||!session||session.audience!==(driver?'grain-driver':'grain-web')||session.userId!==u.id||session.revokedAt||session.expiresAt<new Date()) throw new Error();
      req.user=publicUser(u); req.sessionId=session.id;
    } catch {throw new UnauthorizedException('登录已失效，请重新登录');}
    if(req.user.roles.some((r:any)=>r.code==='driver')!==driver) throw new ForbiddenException('账号类型与入口不匹配');
    if(req.user.mustChangePassword && !['/api/auth/me','/api/auth/password','/api/auth/logout','/api/driver/me','/api/driver/password','/api/driver/logout'].includes(req.path)) throw new ForbiddenException('请先修改初始密码');
    return true;
  }
}
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector:Reflector){}
  canActivate(context:ExecutionContext) {
    const permission=this.reflector.getAllAndOverride<string>('permission',[context.getHandler(),context.getClass()]);
    if(!permission) return true;
    const u=context.switchToHttp().getRequest().user;
    if(!u?.permissions.includes(permission)) throw new ForbiddenException('无权执行此操作');
    if((['users','roles','entities','dictionaries','logs','contract-template'].includes(permission.split(':')[0])||permission==='data:write') && u.businessEntity.type!=='PLATFORM') throw new ForbiddenException('仅平台运营方可访问');
    return true;
  }
}
export function entityScope(user:any, requested?:string) {
  if(user.businessEntity.type==='PLATFORM') return requested?{id:requested}:{};
  if(requested && requested!==user.businessEntityId) throw new ForbiddenException('无权访问其他企业的数据');
  return {id:user.businessEntityId};
}
