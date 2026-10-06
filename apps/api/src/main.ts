import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({path:resolve(__dirname,'../../../.env')});
import { Controller, Get, Module, ValidationPipe, Catch, ExceptionFilter, ArgumentsHost, HttpException, Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import {createSecurityHeaders} from './security-headers';
import { randomUUID } from 'node:crypto';
import { map } from 'rxjs/operators';
import { Database } from './database';
import { Audit } from './audit';
import { AuthController, AuthService } from './auth';
import { AuthGuard, PermissionGuard,Public } from './security';
import { AdminController, AdminService } from './admin';
import { WorkspaceController } from './workspace';
import {PlanningController} from './planning.controller';
import {PlanningService} from './planning.service';
import {AmapService,MapController} from './amap';
import {json} from 'express';
import { TransportController } from './transport.controller';
import { TransportService } from './transport.service';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { TransportFilesController } from './transport-files';
import {ContractsService} from './contracts.service';
import {FulfillmentService} from './fulfillment.service';
import {ContractsController,FulfillmentController,DriverController} from './fulfillment.controller';
import {TrackingController} from './tracking.controller';
import {TrackingService} from './tracking.service';
import {TrackingWorkspaceService,TrackingWorkspaceController} from './tracking-workspace.service';
import {VesselService,VesselController} from './vessels';
import {ForecastService} from './forecast.service';
import {IntelligenceService} from './intelligence.service';
import {IntelligenceController} from './intelligence.controller';
import {BillingController} from './billing.controller';
import {BillingService} from './billing.service';
import {IntermodalService} from './intermodal.service';
import {IntermodalController} from './intermodal.controller';
import {AgentCenterService} from './agent-center.service';
import {AgentCenterController} from './agent-center.controller';
import {DataController,DataFeedController,DataService} from './data-service';
import {runtimeConfig,originAllowed} from './runtime-config';
import {createWebHosting} from './web-hosting';
@Catch()
class ErrorFilter implements ExceptionFilter {
  catch(error:any,host:ArgumentsHost) {
    const req=host.switchToHttp().getRequest();const res=host.switchToHttp().getResponse();
    let status=error instanceof HttpException?error.getStatus():500;
    let message:any=error instanceof HttpException?error.getResponse():'服务暂时不可用，请稍后重试';
    if(error.code==='P2002'){status=409;message='账号、名称或编码已存在';}
    if(error.code==='P2025'){status=404;message='记录不存在或已删除';}
    if(['P2034','P1008','P2028','P2024'].includes(error.code)){status=409;message='记录正被其他操作更新，请刷新后重试';}
    if(typeof message==='object') message=message.message;
    if(Array.isArray(message))message=message.join('；');
    if(status===500) console.error('Request failed',req.requestId,error.constructor?.name,error.code||'');
    res.status(status).json({code:status,message,data:null,timestamp:new Date().toISOString(),requestId:req.requestId});
  }
}
@Injectable()
class Envelope implements NestInterceptor {
  intercept(context:ExecutionContext,next:CallHandler) {
    const req=context.switchToHttp().getRequest();
    return next.handle().pipe(map(data=>({code:0,message:'ok',data,timestamp:new Date().toISOString(),requestId:req.requestId})));
  }
}
const secret=process.env.JWT_SECRET;
if(!secret || secret.length<32 || secret.startsWith('replace-')) throw new Error('请运行 npm run setup，或配置安全的 JWT_SECRET');
@Controller('health')
class HealthController {constructor(private db:Database){} @Public() @Get() async ready(){await this.db.$queryRawUnsafe('SELECT 1');return {status:'READY',version:'0.9.0'};}}
@Module({imports:[JwtModule.register({secret}),ThrottlerModule.forRoot([{ttl:60000,limit:180}])],controllers:[TrackingWorkspaceController,VesselController,AgentCenterController,IntermodalController,HealthController,IntelligenceController,BillingController,DataController,DataFeedController,TrackingController,ContractsController,FulfillmentController,DriverController,AuthController,AdminController,WorkspaceController,TransportController,TransportFilesController,PlanningController,MapController,MatchingController],providers:[TrackingWorkspaceService,VesselService,AgentCenterService,IntermodalService,ForecastService,IntelligenceService,BillingService,DataService,TrackingService,ContractsService,FulfillmentService,Database,Audit,AuthService,AdminService,TransportService,PlanningService,AmapService,MatchingService,{provide:APP_GUARD,useClass:ThrottlerGuard},{provide:APP_GUARD,useClass:AuthGuard},{provide:APP_GUARD,useClass:PermissionGuard}]})
class AppModule {}
async function bootstrap() {
  const runtime=runtimeConfig();
  const app=await NestFactory.create(AppModule,{logger:['error','warn','log']});
  app.getHttpAdapter().getInstance().set('trust proxy',runtime.trustProxy);
  if(process.env.SERVE_WEB==='true')app.use(createWebHosting(resolve(__dirname,'../../web/dist')));
  app.use(createSecurityHeaders());
  app.use(cookieParser());
  // JSAPI requires the proxy at the first URL path level. Keep the same guarded controller.
  app.use((req:any,_res:any,next:any)=>{if(req.url.startsWith('/_AMapService/'))req.url='/api'+req.url;next();});
  app.use(json({limit:'3mb'}));
  app.use((req:any,res:any,next:any)=>{
    req.requestId=randomUUID();res.setHeader('X-Request-Id',req.requestId);res.setHeader('Cache-Control','no-store');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&!originAllowed(req.headers.origin,req,runtime.origins))return res.status(403).json({code:403,message:'请求来源不允许',data:null,requestId:req.requestId,timestamp:new Date().toISOString()});
    res.on('finish',()=>console.log(JSON.stringify({requestId:req.requestId,method:req.method,path:req.path,status:res.statusCode})));next();
  });
  app.setGlobalPrefix('api');
  app.enableCors((req:any,callback:any)=>callback(null,{origin:(_origin:string,done:any)=>done(null,!_origin||originAllowed(_origin,req,runtime.origins)),credentials:true}));
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalFilters(new ErrorFilter());app.useGlobalInterceptors(new Envelope());
  const doc=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('辽粮 · 智能多式联运 API').setDescription('运输需求、联运方案、供需匹配、合同管理、运输执行、预测预警、账单对账、结算确认和授权数据服务。').setVersion('0.9.0').addBearerAuth().build());
  SwaggerModule.setup('api/docs',app,doc);
  app.enableShutdownHooks();await app.listen(runtime.port,runtime.host);
}
bootstrap();
