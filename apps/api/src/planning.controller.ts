import {Controller,Get,Post,Put,Param,Query,Body,Req} from '@nestjs/common';import {ApiTags,ApiBearerAuth} from '@nestjs/swagger';
import {Permit} from './security';import {PlanningService} from './planning.service';import {SolveDto,NodeDto,LineDto,PriceDto,GeometryDto,PlanSelectDto,PlanPublishDto,PlanQuery} from './planning.dto';
@ApiTags('联运求解与线路价格') @ApiBearerAuth() @Controller() @Permit('plan:read')
export class PlanningController {
 constructor(private service:PlanningService){}
 @Get('plans/options') options(){return this.service.options();}
 @Get('plans/demand/:id/input') input(@Param('id') id:string,@Req() req:any){return this.service.demandInput(id,req);}
 @Post('plans/solve') @Permit('plan:solve') solve(@Body() dto:SolveDto,@Req() req:any){return this.service.solve(dto,req);}
 @Get('plans/runs') runs(@Query() q:PlanQuery,@Req() req:any){return this.service.runs(q,req);}
 @Get('plans/runs/:id') run(@Param('id') id:string,@Req() req:any){return this.service.run(id,req);}
 @Get('plans/runs/:id/suppliers') suppliers(@Param('id') id:string,@Query('candidateId') candidateId:string,@Req() req:any){return this.service.suppliers(id,candidateId,req);}
 @Post('plans/runs/:id/select') @Permit('plan:select') select(@Param('id') id:string,@Body() dto:PlanSelectDto,@Req() req:any){return this.service.select(id,dto,req);}
 @Post('plans/runs/:id/publish') @Permit('match:publish') publish(@Param('id') id:string,@Body() dto:PlanPublishDto,@Req() req:any){return this.service.publish(id,dto,req);}
 @Get('plans/examples') examples(){return this.service.examples();}
 @Post('plans/examples/demand') @Permit('demand:write') exampleDemand(@Req() req:any){return this.service.exampleDemand(req);}
 @Get('transport-nodes') nodes(@Query() q:PlanQuery){return this.service.nodes(q);}
 @Post('transport-nodes') @Permit('plan:maintain') createNode(@Body() dto:NodeDto,@Req() req:any){return this.service.saveNode(dto,req);}
 @Put('transport-nodes/:id') @Permit('plan:maintain') updateNode(@Param('id') id:string,@Body() dto:NodeDto,@Req() req:any){return this.service.saveNode(dto,req,id);}
 @Get('transport-lines') lines(@Query() q:PlanQuery){return this.service.lines(q);}
 @Get('transport-lines/:id') line(@Param('id') id:string){return this.service.line(id);}
 @Post('transport-lines') @Permit('plan:maintain') createLine(@Body() dto:LineDto,@Req() req:any){return this.service.saveLine(dto,req);}
 @Put('transport-lines/:id') @Permit('plan:maintain') updateLine(@Param('id') id:string,@Body() dto:LineDto,@Req() req:any){return this.service.saveLine(dto,req,id);}
 @Post('transport-lines/:id/geometry') @Permit('plan:maintain') geometry(@Param('id') id:string,@Body() dto:GeometryDto,@Req() req:any){return this.service.importGeometry(id,dto,req);}
 @Get('route-prices') prices(@Query() q:PlanQuery){return this.service.prices(q);}
 @Post('route-prices') @Permit('plan:maintain') createPrice(@Body() dto:PriceDto,@Req() req:any){return this.service.savePrice(dto,req);}
 @Put('route-prices/:id') @Permit('plan:maintain') updatePrice(@Param('id') id:string,@Body() dto:PriceDto,@Req() req:any){return this.service.savePrice(dto,req,id);}
}

