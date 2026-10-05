import {Controller,Get,Post,Put,Param,Body,Req,Res,Query,UploadedFile,UseInterceptors,ConflictException} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {ApiTags,ApiBearerAuth} from '@nestjs/swagger';
import {Throttle} from '@nestjs/throttler';
import {Response} from 'express';
import {Permit,Public,DriverEndpoint} from './security';
import {AuthService} from './auth';
import {LoginDto,PasswordDto} from './dto';
import {ContractsService} from './contracts.service';
import {FulfillmentService} from './fulfillment.service';
import {IntermodalService} from './intermodal.service';
import {DriverFeedback,ServiceFeeInput} from './intermodal.dto';
import {CreateContract,ChangeContract,TemplateDto,RevisionAction,BusinessDto,VehicleDto,TaskDto,EventDto,IssueDto,ResolutionDto,BatchDto,ArrivalDto,BoxDto,ContractWorkspaceQuery,ContractArchiveDto} from './fulfillment.dto';
const upload=()=>FileInterceptor('file',{limits:{fileSize:8*1024*1024,files:1}});
async function sendFile(s:FulfillmentService,id:string,req:any,res:Response){const f=await s.download(id,req);res.setHeader('Content-Type',f.mime);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`);res.send(Buffer.from(f.bytes));}
@ApiTags('合同管理') @ApiBearerAuth() @Controller('contracts') @Permit('contract:read')
export class ContractsController {
 constructor(private s:ContractsService){}
 @Get() list(@Req() r:any){return this.s.list(r);}
 @Get('workspace') workspace(@Query() q:ContractWorkspaceQuery,@Req() r:any){return this.s.workspace(q,r);}
 @Get('confirmations') confirmations(@Req() r:any){return this.s.confirmations(r);}
 @Get('templates') @Permit('contract-template:read') templates(){return this.s.templates();}
 @Post('templates') @Permit('contract-template:write') template(@Body() d:TemplateDto,@Req() r:any){return this.s.template(d,r);}
 @Post('templates/upload') @Permit('contract-template:write') @UseInterceptors(upload()) templateUpload(@Body() d:TemplateDto,@UploadedFile() f:any,@Req() r:any){return this.s.template(d,r,f);}
 @Get('templates/:id/file') @Permit('contract-template:read') async templateFile(@Param('id') id:string,@Res() res:Response){this.fileResponse(await this.s.templateFile(id),res);}
 @Post('templates/:id/publish') @Permit('contract-template:write') publish(@Param('id') id:string,@Req() r:any){return this.s.publishTemplate(id,r);}
 @Post() @Permit('contract:write') create(@Body() d:CreateContract,@Req() r:any){return this.s.create(d,r);}
 @Get(':id') detail(@Param('id') id:string,@Req() r:any){return this.s.detail(id,r);}
 @Get(':id/archive') archive(@Param('id') id:string,@Req() r:any){return this.s.archive(id,r);}
 @Post(':id/archive') @Permit('contract:write') fileArchive(@Param('id') id:string,@Body() d:ContractArchiveDto,@Req() r:any){return this.s.fileArchive(id,d,r);}
 @Get(':id/templates/:fileId') async contractFile(@Param('id') id:string,@Param('fileId') fileId:string,@Req() r:any,@Res() res:Response){this.fileResponse(await this.s.contractFile(id,fileId,r),res);}
 @Post(':id/change') @Permit('contract:write') change(@Param('id') id:string,@Body() d:ChangeContract,@Req() r:any){return this.s.change(id,d,r);}
 @Put(':id') @Permit('contract:write') edit(@Param('id') id:string,@Body() d:ChangeContract,@Req() r:any){return this.s.edit(id,d,r);}
 @Post(':id/:action') @Permit('contract:write') action(@Param('id') id:string,@Param('action') action:string,@Body() d:RevisionAction,@Req() r:any){return this.s.action(id,action,d,r);}
 private fileResponse(file:any,res:Response){res.setHeader('Content-Type',file.mime);res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, no-store');res.send(Buffer.from(file.bytes));}
}
@ApiTags('联运执行') @ApiBearerAuth() @Controller('fulfillment') @Permit('service:read')
export class FulfillmentController {
 constructor(private s:FulfillmentService){}
 @Get() list(@Req() r:any){return this.s.list(r);}
 @Post() @Permit('service:write') create(@Body() _d:BusinessDto,@Req() _r:any){throw new ConflictException('联运服务由生效合同自动生成，请从合同对应运单开始跟踪');}
 @Get('resources') resources(@Req() r:any){return this.s.resources(r);}
 @Post('vehicles') @Permit('service:write') vehicle(@Body() d:VehicleDto,@Req() r:any){return this.s.vehicle(d,r);}
 @Get('evidence/:id') download(@Param('id') id:string,@Req() r:any,@Res() res:Response){return sendFile(this.s,id,r,res);}
 @Get(':id') detail(@Param('id') id:string,@Req() r:any){return this.s.detail(id,r);}
 @Post(':id/tasks') @Permit('service:write') dispatch(@Param('id') id:string,@Body() d:TaskDto,@Req() r:any){return this.s.dispatch(id,d,r);}
 @Post('tasks/:id/events') @Permit('service:write') event(@Param('id') id:string,@Body() d:EventDto,@Req() r:any){return this.s.event(id,d,r);}
 @Post('tasks/:id/cancel') @Permit('service:write') cancel(@Param('id') id:string,@Req() r:any){return this.s.cancelTask(id,r);}
 @Post('tasks/:id/issues') @Permit('service:write') issue(@Param('id') id:string,@Body() d:IssueDto,@Req() r:any){return this.s.issue(id,d,r);}
 @Post('tasks/:id/evidence') @Permit('service:write') @UseInterceptors(upload()) upload(@Param('id') id:string,@UploadedFile() f:any,@Req() r:any){return this.s.upload(id,f,r);}
 @Post('issues/:id/resolve') @Permit('service:write') resolve(@Param('id') id:string,@Body() d:ResolutionDto,@Req() r:any){return this.s.resolve(id,d,r);}
 @Post(':id/batches') @Permit('service:write') batch(@Param('id') id:string,@Body() d:BatchDto,@Req() r:any){return this.s.batch(id,d,r);}
 @Post('batches/:id/arrivals') @Permit('service:write') arrival(@Param('id') id:string,@Body() d:ArrivalDto,@Req() r:any){return this.s.packing(id,d,'arrival',r);}
 @Post('batches/:id/boxes') @Permit('service:write') box(@Param('id') id:string,@Body() d:BoxDto,@Req() r:any){return this.s.packing(id,d,'box',r);}
}
@ApiTags('司机任务与回传') @DriverEndpoint() @Controller('driver')
export class DriverController {
 constructor(private auth:AuthService,private s:FulfillmentService,private intermodal:IntermodalService){}
 @Public() @Post('login') @Throttle({default:{limit:8,ttl:60000}}) login(@Body() d:LoginDto,@Req() r:any,@Res({passthrough:true}) res:Response){return this.auth.login(d,r,res,true);}
 @Public() @Post('refresh') refresh(@Req() r:any,@Res({passthrough:true}) res:Response){return this.auth.refresh(r,res,true);}
 @Public() @Post('logout') logout(@Req() r:any,@Res({passthrough:true}) res:Response){return this.auth.logout(r,res,true);}
 @Get('me') me(@Req() r:any){return r.user;}
 @Post('password') password(@Body() d:PasswordDto,@Req() r:any,@Res({passthrough:true}) res:Response){return this.auth.changePassword(d,r,res,true);}
 @Get('tasks') tasks(@Req() r:any){return this.s.driverTasks(r);}
 @Get('tasks/:id/service') service(@Param('id') id:string,@Req() r:any){return this.intermodal.driverService(id,r);}
 @Post('tasks/:id/feedback') feedback(@Param('id') id:string,@Body() d:DriverFeedback,@Req() r:any){return this.intermodal.feedback(id,d,r);}
 @Post('tasks/:id/fees') fees(@Param('id') id:string,@Body() d:ServiceFeeInput,@Req() r:any){return this.intermodal.fee(id,d,r,true);}
 @Post('tasks/:id/events') event(@Param('id') id:string,@Body() d:EventDto,@Req() r:any){return this.s.event(id,d,r);}
 @Post('tasks/:id/issues') issue(@Param('id') id:string,@Body() d:IssueDto,@Req() r:any){return this.s.issue(id,d,r);}
 @Post('tasks/:id/evidence') @UseInterceptors(upload()) upload(@Param('id') id:string,@Query('category') category='GENERAL',@UploadedFile() f:any,@Req() r:any){return this.s.upload(id,f,r,category);}
 @Get('evidence/:id') download(@Param('id') id:string,@Req() r:any,@Res() res:Response){return sendFile(this.s,id,r,res);}
}
