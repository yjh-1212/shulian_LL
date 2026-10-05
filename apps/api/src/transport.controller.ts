import { Controller,Get,Post,Put,Param,Query,Body,Req } from '@nestjs/common';
import { ApiBearerAuth,ApiTags,ApiOperation } from '@nestjs/swagger';
import { Permit } from './security';
import { TransportService } from './transport.service';
import { TransportQuery,DemandDto,SupplyDto,VersionDto,PublishDemandDto,ImportOrderDto } from './transport.dto';
@ApiTags('交易订单与供需管理') @ApiBearerAuth() @Controller()
export class TransportController {
  constructor(private service:TransportService){}
  @Get('transport-options') options(@Req() req:any){return this.service.options(req);}
  @Get('trade-orders') @Permit('trade-orders:read') @ApiOperation({summary:'按主体查询交易订单明细及剩余可运输数量'}) orders(@Query() q:TransportQuery,@Req() req:any){return this.service.orders(q,req);}
  @Post('trade-orders/import') @Permit('trade-orders:import') @ApiOperation({summary:'平台幂等导入交易订单，不覆盖已有来源事实'}) import(@Body() dto:ImportOrderDto,@Req() req:any){return this.service.importOrder(dto,req);}
  @Get('transport-demands') @Permit('demand:read') demands(@Query() q:TransportQuery,@Req() req:any){return this.service.demands(q,req);}
  @Get('transport-demands/:id') @Permit('demand:read') demand(@Param('id') id:string,@Req() req:any){return this.service.demand(id,req);}
  @Post('transport-demands') @Permit('demand:write') createDemand(@Body() dto:DemandDto,@Req() req:any){return this.service.saveDemand(dto,req);}
  @Put('transport-demands/:id') @Permit('demand:write') updateDemand(@Param('id') id:string,@Body() dto:DemandDto,@Req() req:any){return this.service.saveDemand(dto,req,id);}
  @Post('transport-demands/:id/publish') @Permit('demand:publish') publish(@Param('id') id:string,@Body() dto:PublishDemandDto,@Req() req:any){return this.service.demandAction(id,'publish',dto.version,req,dto);}
  @Post('transport-demands/:id/:action') @Permit('demand:write') demandAction(@Param('id') id:string,@Param('action') action:string,@Body() dto:VersionDto,@Req() req:any){return this.service.demandAction(id,action,dto.version,req);}
  @Get('transport-demands/:id/history') @Permit('demand:read') demandHistory(@Param('id') id:string,@Req() req:any){return this.service.history('demand',id,req);}
  @Get('transport-supplies') @Permit('supply:read') supplies(@Query() q:TransportQuery,@Req() req:any){return this.service.supplies(q,req);}
  @Get('transport-supplies/:id') @Permit('supply:read') async supply(@Param('id') id:string,@Req() req:any){await this.service.expire();return this.service.supply(id,req);}
  @Post('transport-supplies') @Permit('supply:write') createSupply(@Body() dto:SupplyDto,@Req() req:any){return this.service.saveSupply(dto,req);}
  @Put('transport-supplies/:id') @Permit('supply:write') updateSupply(@Param('id') id:string,@Body() dto:SupplyDto,@Req() req:any){return this.service.saveSupply(dto,req,id);}
  @Post('transport-supplies/:id/publish') @Permit('supply:publish') publishSupply(@Param('id') id:string,@Body() dto:VersionDto,@Req() req:any){return this.service.supplyAction(id,'publish',dto.version,req);}
  @Post('transport-supplies/:id/:action') @Permit('supply:write') supplyAction(@Param('id') id:string,@Param('action') action:string,@Body() dto:VersionDto,@Req() req:any){return this.service.supplyAction(id,action,dto.version,req);}
  @Get('transport-supplies/:id/history') @Permit('supply:read') supplyHistory(@Param('id') id:string,@Req() req:any){return this.service.history('supply',id,req);}
}
