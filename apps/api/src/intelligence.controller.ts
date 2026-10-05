import {Controller,Get,Post,Put,Req,Res,Param,Body,Query,UploadedFile,UseInterceptors} from '@nestjs/common';import {FileInterceptor} from '@nestjs/platform-express';import {ApiTags,ApiBearerAuth,ApiConsumes,ApiBody} from '@nestjs/swagger';import {Permit} from './security';import {IntelligenceService} from './intelligence.service';import {ForecastService} from './forecast.service';import {AgentInput,SignalInput,WeatherInput,ConfirmDocument} from './intelligence.dto';import {TrackingQuery} from './tracking.dto';
import {SolveDto} from './planning.dto';
@ApiTags('预测预警与智能助手') @ApiBearerAuth() @Controller()
export class IntelligenceController {
 constructor(private s:IntelligenceService,private f:ForecastService){}
 @Get('agents/context') context(@Req() r:any){return this.s.context(r);}
 @Post('agents/runs') ask(@Body() d:AgentInput,@Req() r:any){return this.s.ask(d,r);}
 @Get('agents/runs') history(@Req() r:any){return this.s.history(r);}
 @Post('agents/solve') @Permit('plan:solve') solve(@Body() d:SolveDto,@Req() r:any){return this.s.solve(d,r);}
 @Get('eta/tasks/:id') @Permit('tracking:read') get(@Param('id') id:string,@Query() q:TrackingQuery,@Req() r:any){return this.f.get(id,q.includeTest==='true',r);}
 @Post('eta/tasks/:id/refresh') @Permit('tracking:read') refresh(@Param('id') id:string,@Query() q:TrackingQuery,@Req() r:any){return this.f.get(id,q.includeTest==='true',r,true);}
 @Get('alerts/history') @Permit('tracking:read') risks(@Query() q:TrackingQuery,@Req() r:any){return this.f.riskHistory(q,r);}
 @Get('monitoring/signals') @Permit('tracking:read') signals(@Query() q:TrackingQuery){return this.f.signals(q.includeTest==='true');}
 @Post('monitoring/signals') @Permit('data:write') signal(@Body() d:SignalInput,@Req() r:any){return this.f.saveSignal(d,r);}
 @Put('monitoring/signals/:id') @Permit('data:write') updateSignal(@Param('id') id:string,@Body() d:SignalInput,@Req() r:any){return this.f.saveSignal(d,r,id);}
 @Post('monitoring/weather') @Permit('data:write') weather(@Body() d:WeatherInput,@Req() r:any){return this.f.weather(d,r);}
 @Post('documents/recognize/:taskId') @Permit('tracking:read') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:8*1024*1024,files:1,fields:0}})) @ApiConsumes('multipart/form-data') @ApiBody({schema:{type:'object',properties:{file:{type:'string',format:'binary'}},required:['file']}}) recognize(@Param('taskId') id:string,@UploadedFile() file:any,@Req() r:any){return this.s.recognize(id,file,r);}
 @Get('documents/task/:taskId') @Permit('tracking:read') documents(@Param('taskId') id:string,@Req() r:any){return this.s.documents(id,r);}
 @Get('documents/:id') @Permit('tracking:read') document(@Param('id') id:string,@Req() r:any){return this.s.document(id,r);}
 @Post('documents/:id/confirm') @Permit('tracking:read') confirm(@Param('id') id:string,@Body() d:ConfirmDocument,@Req() r:any){return this.s.confirmDocument(id,d,r);}
 @Get('documents/:id/file') @Permit('tracking:read') async file(@Param('id') id:string,@Req() r:any,@Res() res:any){const d=await this.s.file(id,r);res.setHeader('Content-Type',d.mime);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`);res.send(Buffer.from(d.bytes));}
}
