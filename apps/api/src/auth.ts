import { Controller, Post, Get, Body, Req, Res, Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomBytes, createHash } from 'node:crypto';
import { hash, compare } from 'bcryptjs';
import { Response } from 'express';
import { Database } from './database';
import { Audit } from './audit';
import { Public, userInclude, publicUser } from './security';
import { LoginDto, PasswordDto } from './dto';
import {secureCookie} from './runtime-config';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const sessionMaxAge=7*24*60*60*1000;
const cookieOptions=(req:any)=>({httpOnly:true,sameSite:'strict' as const,secure:secureCookie(req),path:'/api/auth',maxAge:sessionMaxAge});
@Injectable()
export class AuthService {
  constructor(private db:Database,private jwt:JwtService,private audit:Audit){}
  async login(dto:LoginDto,req:any,res:Response,driverMode=false) {
    const u=await this.db.user.findUnique({where:{username:dto.username},include:userInclude});
    const ok=u && !u.deletedAt && !(process.env.NODE_ENV==='production'&&u.isTestData) && u.status==='ACTIVE' && u.businessEntity.status==='ACTIVE' && !u.businessEntity.deletedAt && await compare(dto.password,u.passwordHash);
    const driver=!!u?.roles.some(r=>r.role.code==='driver');
    await this.db.loginLog.create({data:{username:dto.username,userId:u?.id,businessEntityId:u?.businessEntityId,ip:req.ip||'',userAgent:String(req.headers['user-agent']||'').slice(0,500),success:!!ok&&driver===driverMode,reason:!ok?'账号或密码错误':driver!==driverMode?'账号类型与入口不匹配':driverMode?'司机端登录成功':'登录成功',requestId:req.requestId}});
    if(!ok) throw new UnauthorizedException('账号或密码错误，或账号已停用');
    if(driver!==driverMode) throw new ForbiddenException(driverMode?'此入口仅限司机账号':'司机账号请使用司机端');
    const raw=randomBytes(48).toString('base64url');
    const session=await this.db.refreshToken.create({data:{userId:u.id,audience:driverMode?'grain-driver':'grain-web',tokenHash:digest(raw),expiresAt:new Date(Date.now()+sessionMaxAge)}});
    await this.db.user.update({where:{id:u.id},data:{lastLoginAt:new Date()}});
    res.cookie(driverMode?'grain_driver_refresh':'grain_refresh',raw,{...cookieOptions(req),path:driverMode?'/api/driver':'/api/auth'});
    return {accessToken:await this.access(u,session.id,driverMode),user:publicUser(u)};
  }
  private access(u:any,sid:string,driverMode=false) {return this.jwt.signAsync({sub:u.id,ver:u.tokenVersion,sid},{expiresIn:'15m',issuer:'grain-api',audience:driverMode?'grain-driver':'grain-web'});}
  async refresh(req:any,res:Response,driverMode=false) {
    const raw=req.cookies?.[driverMode?'grain_driver_refresh':'grain_refresh'];
    if(!raw) throw new UnauthorizedException('请登录');
    const old=await this.db.refreshToken.findUnique({where:{tokenHash:digest(raw)},include:{user:{include:userInclude}}});
    if(!old||old.audience!==(driverMode?'grain-driver':'grain-web')||old.user.roles.some(r=>r.role.code==='driver')!==driverMode||old.revokedAt||old.expiresAt<new Date()||old.user.status!=='ACTIVE'||old.user.deletedAt||(process.env.NODE_ENV==='production'&&old.user.isTestData)||old.user.businessEntity.status!=='ACTIVE'||old.user.businessEntity.deletedAt) {
      res.clearCookie(driverMode?'grain_driver_refresh':'grain_refresh',{...cookieOptions(req),path:driverMode?'/api/driver':'/api/auth'});throw new UnauthorizedException('登录已过期');
    }
    const next=randomBytes(48).toString('base64url');
    const changed=await this.db.refreshToken.updateMany({where:{id:old.id,tokenHash:digest(raw),revokedAt:null},data:{tokenHash:digest(next)}});
    if(changed.count!==1) throw new UnauthorizedException('会话已刷新，请重新登录');
    res.cookie(driverMode?'grain_driver_refresh':'grain_refresh',next,{...cookieOptions(req),path:driverMode?'/api/driver':'/api/auth',maxAge:old.expiresAt.getTime()-Date.now()});
    return {accessToken:await this.access(old.user,old.id,driverMode),user:publicUser(old.user)};
  }
  async logout(req:any,res:Response,driverMode=false) {
    const raw=req.cookies?.[driverMode?'grain_driver_refresh':'grain_refresh'];
    if(raw) await this.db.$transaction(async tx=>{
      const session=await tx.refreshToken.findUnique({where:{tokenHash:digest(raw)},include:{user:{include:userInclude}}});
      if(session && !session.revokedAt) {
        await tx.refreshToken.update({where:{id:session.id},data:{revokedAt:new Date()}});
        req.user=publicUser(session.user);
        await this.audit.write(tx,req,'认证',session.userId,'退出登录');
      }
    });
    res.clearCookie(driverMode?'grain_driver_refresh':'grain_refresh',{...cookieOptions(req),path:driverMode?'/api/driver':'/api/auth'});return {success:true};
  }
  async changePassword(dto:PasswordDto,req:any,res:Response,driverMode=false) {
    const u=await this.db.user.findUniqueOrThrow({where:{id:req.user.id}});
    if(!await compare(dto.currentPassword,u.passwordHash)) throw new BadRequestException('原密码不正确');
    if(await compare(dto.newPassword,u.passwordHash)) throw new BadRequestException('新密码不能与原密码相同');
    const passwordHash=await hash(dto.newPassword,12);
    await this.db.$transaction(async tx=>{
      await tx.user.update({where:{id:u.id},data:{passwordHash,tokenVersion:{increment:1},mustChangePassword:false}});
      await tx.refreshToken.updateMany({where:{userId:u.id},data:{revokedAt:new Date()}});
      await this.audit.write(tx,req,'认证',u.id,'修改密码');
    });
    res.clearCookie(driverMode?'grain_driver_refresh':'grain_refresh',{...cookieOptions(req),path:driverMode?'/api/driver':'/api/auth'}); return {success:true};
  }
}
@ApiTags('认证') @Controller('auth')
export class AuthController {
  constructor(private service:AuthService){}
  @Public() @Post('login') @Throttle({default:{limit:8,ttl:60000}}) @ApiOperation({summary:'PC登录，司机不可使用'})
  login(@Body() dto:LoginDto,@Req() req:any,@Res({passthrough:true}) res:Response){return this.service.login(dto,req,res);}
  @Public() @Post('refresh') @ApiOperation({summary:'HttpOnly cookie 轮换刷新'})
  refresh(@Req() req:any,@Res({passthrough:true}) res:Response){return this.service.refresh(req,res);}
  @Public() @Post('logout') @ApiOperation({summary:'撤销当前会话'})
  logout(@Req() req:any,@Res({passthrough:true}) res:Response){return this.service.logout(req,res);}
  @Get('me') @ApiBearerAuth() me(@Req() req:any){return req.user;}
  @Post('password') @ApiBearerAuth() changePassword(@Body() dto:PasswordDto,@Req() req:any,@Res({passthrough:true}) res:Response){return this.service.changePassword(dto,req,res);}
}
