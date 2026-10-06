import {Controller,Get,Post,Param,Query,Body,Req,Res} from '@nestjs/common';
import type {Response} from 'express';
import {ApiTags,ApiBearerAuth} from '@nestjs/swagger';
import {AgentCenterService} from './agent-center.service';
import {AgentMessageInput,AgentPlanInput,CreateAgentConversation} from './agent-center.dto';
import {ListDto} from './dto';
@ApiTags('AI智能体中心') @ApiBearerAuth() @Controller('agents/center')
export class AgentCenterController {
 constructor(private s:AgentCenterService){}
 @Get('tasks') tasks(@Query() q:ListDto,@Req() r:any){return this.s.tasks(q,r);}
 @Get('tasks/:id') task(@Param('id') id:string,@Req() r:any){return this.s.task(id,r);}
 @Get('conversations') list(@Query() q:ListDto,@Req() r:any){return this.s.list(q,r);}
 @Post('conversations') create(@Body() d:CreateAgentConversation,@Req() r:any){return this.s.create(d,r);}
 @Get('conversations/:id') detail(@Param('id') id:string,@Req() r:any){return this.s.detail(id,r);}
 @Post('conversations/:id/messages') send(@Param('id') id:string,@Body() d:AgentMessageInput,@Req() r:any){return this.s.send(id,d,r);}
 @Post('conversations/:id/messages/stream') async stream(@Param('id') id:string,@Body() d:AgentMessageInput,@Req() r:any,@Res() res:Response){
  return this.progress(id,r,res,(emit,signal)=>this.s.send(id,d,r,emit,signal));
 }
 @Post('conversations/:id/solve/stream') async solveStream(@Param('id') id:string,@Body() d:AgentPlanInput,@Req() r:any,@Res() res:Response){
  return this.progress(id,r,res,(emit,signal)=>this.s.solve(id,d,r,emit,signal));
 }
 private async progress(id:string,r:any,res:Response,run:(emit:(event:any)=>void,signal:AbortSignal)=>Promise<any>){
  await this.s.conversation(id,r);
  const controller=new AbortController();
  res.set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'});
  res.flushHeaders();
  const emit=(event:any)=>{if(!res.destroyed&&!res.writableEnded)res.write('data: '+JSON.stringify(event)+'\n\n');};
  const heartbeat=setInterval(()=>{if(!res.destroyed&&!res.writableEnded)res.write(': keep-alive\n\n');},10000);
  const closed=()=>{if(!res.writableEnded)controller.abort();};res.on('close',closed);
  emit({type:'status',message:'正在读取授权业务记录…'});
  try{const turn=await run(emit,controller.signal);emit({type:'result',turn});}
  catch(e:any){const detail=e.getResponse?.();emit({type:'error',code:e.getStatus?.()||500,message:e.getStatus?typeof detail==='string'?detail:detail?.message||'分析未完成，请重试':'智能分析暂不可用，请重试'});}
  finally{clearInterval(heartbeat);res.off('close',closed);res.end();}
 }
 @Post('conversations/:id/solve') solve(@Param('id') id:string,@Body() d:AgentPlanInput,@Req() r:any){return this.s.solve(id,d,r);}
 @Post('conversations/:id/cancel') cancel(@Param('id') id:string,@Req() r:any){return this.s.cancel(id,r);}
}
