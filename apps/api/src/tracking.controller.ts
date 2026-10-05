import {Controller,Get,Post,Put,Param,Query,Body,Req} from '@nestjs/common';
import {ApiTags,ApiBearerAuth} from '@nestjs/swagger';
import {Permit} from './security';
import {TrackingService} from './tracking.service';
import {TrackingQuery,PositionBatch,ObservationInput,EpcisInput,RuleInput} from './tracking.dto';
@ApiTags('全程可视化与数据接入') @ApiBearerAuth() @Controller('tracking') @Permit('tracking:read')
export class TrackingController {
 constructor(private s:TrackingService){}
 @Get('overview') overview(@Query() q:TrackingQuery,@Req() r:any){return this.s.overview(q,r);}
 @Get('tasks') list(@Query() q:TrackingQuery,@Req() r:any){return this.s.list(q,r);}
 @Get('alerts') alerts(@Query() q:TrackingQuery,@Req() r:any){return this.s.alerts(q,r);}
 @Get('rules') rules(){return this.s.rules();}
 @Put('rules') @Permit('data:read') rulesUpdate(@Body() d:RuleInput,@Req() r:any){return this.s.updateRules(d,r);}
 @Get('tasks/:id') detail(@Param('id') id:string,@Query() q:TrackingQuery,@Req() r:any){return this.s.detail(id,q,r);}
 @Get('tasks/:id/trajectory') trajectory(@Param('id') id:string,@Query() q:TrackingQuery,@Req() r:any){return this.s.trajectory(id,q,r);}
 @Post('tasks/:id/positions') @Permit('service:write') positions(@Param('id') id:string,@Body() d:PositionBatch,@Req() r:any){return this.s.positions(id,d,r);}
 @Post('tasks/:id/rail-events') @Permit('service:write') rail(@Param('id') id:string,@Body() d:ObservationInput,@Req() r:any){return this.s.observation(id,d,r);}
 @Post('tasks/:id/epcis-events') @Permit('service:write') epcis(@Param('id') id:string,@Body() d:EpcisInput,@Req() r:any){return this.s.epcis(id,d,r);}
}
