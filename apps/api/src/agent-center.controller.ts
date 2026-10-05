import {Controller,Get,Post,Param,Query,Body,Req} from '@nestjs/common';
import {ApiTags,ApiBearerAuth} from '@nestjs/swagger';
import {AgentCenterService} from './agent-center.service';
import {AgentMessageInput,AgentPlanInput,CreateAgentConversation} from './agent-center.dto';
import {ListDto} from './dto';
@ApiTags('AI智能体中心') @ApiBearerAuth() @Controller('agents/center')
export class AgentCenterController {
 constructor(private s:AgentCenterService){}
 @Get('tasks') tasks(@Query() q:ListDto,@Req() r:any){return this.s.tasks(q,r);}
 @Get('conversations') list(@Query() q:ListDto,@Req() r:any){return this.s.list(q,r);}
 @Post('conversations') create(@Body() d:CreateAgentConversation,@Req() r:any){return this.s.create(d,r);}
 @Get('conversations/:id') detail(@Param('id') id:string,@Req() r:any){return this.s.detail(id,r);}
 @Post('conversations/:id/messages') send(@Param('id') id:string,@Body() d:AgentMessageInput,@Req() r:any){return this.s.send(id,d,r);}
 @Post('conversations/:id/solve') solve(@Param('id') id:string,@Body() d:AgentPlanInput,@Req() r:any){return this.s.solve(id,d,r);}
 @Post('conversations/:id/cancel') cancel(@Param('id') id:string,@Req() r:any){return this.s.cancel(id,r);}
}
