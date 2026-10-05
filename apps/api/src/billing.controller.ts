import {Controller,Get,Post,Put,Body,Param,Query,Req,Res,UploadedFile,UseInterceptors} from '@nestjs/common';import {FileInterceptor} from '@nestjs/platform-express';import {ApiTags,ApiBearerAuth,ApiConsumes,ApiBody} from '@nestjs/swagger';import {Permit} from './security';import {BillingService} from './billing.service';import {BillDraft,BillAction,DifferenceInput,SettlementInput,SettlementConfirm,FinanceQuery} from './billing.dto';
@ApiTags('对账结算') @ApiBearerAuth() @Controller('billing') @Permit('billing:read')
export class BillingController {
 constructor(private s:BillingService){}
 @Get('options') options(@Req() r:any){return this.s.options(r);}
 @Get('bills') list(@Query() q:FinanceQuery,@Req() r:any){return this.s.list(q,r);}
 @Get('bills/:id') detail(@Param('id') id:string,@Req() r:any){return this.s.detail(id,r);}
 @Post('bills') @Permit('billing:write') create(@Body() d:BillDraft,@Req() r:any){return this.s.create(d,r);}
 @Put('bills/:id') @Permit('billing:write') edit(@Param('id') id:string,@Body() d:BillDraft,@Req() r:any){return this.s.edit(id,d,r);}
 @Post('bills/:id/submit') @Permit('billing:write') submit(@Param('id') id:string,@Body() d:BillAction,@Req() r:any){return this.s.action(id,'submit',d,r);}
 @Post('bills/:id/withdraw') @Permit('billing:write') withdraw(@Param('id') id:string,@Body() d:BillAction,@Req() r:any){return this.s.action(id,'withdraw',d,r);}
 @Post('bills/:id/void') @Permit('billing:write') void(@Param('id') id:string,@Body() d:BillAction,@Req() r:any){return this.s.action(id,'void',d,r);}
 @Post('bills/:id/check') @Permit('billing:write') check(@Param('id') id:string,@Body() d:BillAction,@Req() r:any){return this.s.action(id,'check',d,r);}
 @Post('bills/:id/confirm') @Permit('billing:write') confirm(@Param('id') id:string,@Body() d:BillAction,@Req() r:any){return this.s.action(id,'confirm',d,r);}
 @Post('bills/:id/differences') @Permit('billing:write') difference(@Param('id') id:string,@Body() d:DifferenceInput,@Req() r:any){return this.s.difference(id,d,r);}
 @Get('bills/:id/archive') archive(@Param('id') id:string,@Req() r:any){return this.s.archive(id,r);}
 @Post('bills/:id/evidence') @Permit('billing:write') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:8*1024*1024,files:1,fields:0}})) @ApiConsumes('multipart/form-data') @ApiBody({schema:{type:'object',properties:{file:{type:'string',format:'binary'}},required:['file']}}) upload(@Param('id') id:string,@UploadedFile() f:any,@Req() r:any){return this.s.upload(id,f,r);}
 @Get('evidence/:id') async evidence(@Param('id') id:string,@Req() r:any,@Res() res:any){const e=await this.s.evidence(id,r);res.setHeader('Content-Type',e.mime);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(e.name)}`);res.send(Buffer.from(e.bytes));}
 @Get('settlements') settlements(@Query() q:FinanceQuery,@Req() r:any){return this.s.settlements(q,r);}
 @Post('settlements/:id/records') @Permit('billing:write') record(@Param('id') id:string,@Body() d:SettlementInput,@Req() r:any){return this.s.record(id,d,r);}
 @Post('settlements/:id/records/:recordId/confirm') @Permit('billing:write') confirmRecord(@Param('id') id:string,@Param('recordId') recordId:string,@Body() d:SettlementConfirm,@Req() r:any){return this.s.confirmRecord(id,recordId,d,r);}
}
