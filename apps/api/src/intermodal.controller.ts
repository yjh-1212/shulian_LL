import {Controller,Get,Post,Put,Body,Param,Query,Req,Res,UploadedFile,UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {Response} from 'express';
import {ApiTags,ApiBearerAuth} from '@nestjs/swagger';
import {Permit} from './security';
import {IntermodalService} from './intermodal.service';
import {IntermodalQuery,StageInput,StageAction,CompleteStage,ServiceFeeInput,FeeSelection,CompleteBusinesses} from './intermodal.dto';
@ApiTags('联运服务') @ApiBearerAuth() @Controller('intermodal') @Permit('service:read')
export class IntermodalController {
 constructor(private s:IntermodalService){}
 @Get() list(@Query() q:IntermodalQuery,@Req() r:any){return this.s.list(q,r);}
 @Post('complete') @Permit('service:write') complete(@Body() d:CompleteBusinesses,@Req() r:any){return this.s.complete(d,r);}
 @Put('fees/:id') @Permit('service:write') select(@Param('id') id:string,@Body() d:FeeSelection,@Req() r:any){return this.s.selectFee(id,d,r);}
 @Put('stages/:id') @Permit('service:write') save(@Param('id') id:string,@Body() d:StageInput,@Req() r:any){return this.s.stage(id,r).then(({b})=>this.s.save(b.id,d,r,id));}
 @Post('stages/:id/submit') @Permit('service:write') submit(@Param('id') id:string,@Body() d:StageAction,@Req() r:any){return this.s.submit(id,d,r);}
 @Post('stages/:id/complete') @Permit('service:write') finish(@Param('id') id:string,@Body() d:CompleteStage,@Req() r:any){return this.s.completeStage(id,d,r);}
 @Post('stages/:id/fees') @Permit('service:write') fee(@Param('id') id:string,@Body() d:ServiceFeeInput,@Req() r:any){return this.s.fee(id,d,r);}
 @Post('stages/:id/attachments') @Permit('service:write') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:8*1024*1024,files:1}})) upload(@Param('id') id:string,@Query('category') category='GENERAL',@UploadedFile() f:any,@Req() r:any){return this.s.upload(id,f,category,r);}
 @Get('attachments/:id') async file(@Param('id') id:string,@Req() r:any,@Res() res:Response){const f=await this.s.file(id,r);res.setHeader('Content-Type',f.mime);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`);res.setHeader('X-Content-Type-Options','nosniff');res.send(Buffer.from(f.bytes));}
 @Get(':id') detail(@Param('id') id:string,@Req() r:any){return this.s.detail(id,r);}
 @Post(':id/stages') @Permit('service:write') add(@Param('id') id:string,@Body() d:StageInput,@Req() r:any){return this.s.save(id,d,r);}
}
