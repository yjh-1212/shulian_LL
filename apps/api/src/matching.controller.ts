import {Controller,Get,Post,Param,Query,Body,Req} from '@nestjs/common';
import {ApiTags,ApiBearerAuth} from '@nestjs/swagger';
import {Permit} from './security';
import {MatchingService} from './matching.service';
import {MatchQuery,MatchPublishDto,QuoteDto,NegotiateDto,ConfirmDto,CloseMatchDto,MatchInviteDto} from './matching.dto';
@ApiTags('供需匹配') @ApiBearerAuth() @Controller('matches')
export class MatchingController {
 constructor(private service:MatchingService){}
 @Get('options') @Permit('match:read') options(@Req() r:any){return this.service.options(r);}
 @Get('supplies') @Permit('match:read') supplies(@Query() q:MatchQuery,@Req() r:any){return this.service.supplies(q,r);}
 @Get('mine') @Permit('match:read') mine(@Query() q:MatchQuery,@Req() r:any){return this.service.mine(q,r);}
 @Get('recommendations/:kind/:id') @Permit('match:read') recommendations(@Param('kind') kind:string,@Param('id') id:string,@Req() r:any){return this.service.recommendations(kind,id,r);}
 @Get('my-publications') @Permit('match:read') myPublications(@Req() r:any){return this.service.myPublications(r);}
 @Post('publications/:id/invitations') @Permit('match:publish') invite(@Param('id') id:string,@Body() d:MatchInviteDto,@Req() r:any){return this.service.invite(id,d,r);}
 @Get('publications') @Permit('match:read') list(@Query() q:MatchQuery,@Req() r:any){return this.service.list(q,r);}
 @Get('publications/:id') @Permit('match:read') detail(@Param('id') id:string,@Req() r:any){return this.service.detail(id,r);}
 @Post('publications') @Permit('match:publish') publish(@Body() d:MatchPublishDto,@Req() r:any){return this.service.publish(d,r);}
 @Post('publications/:id/quote') @Permit('match:quote') quote(@Param('id') id:string,@Body() d:QuoteDto,@Req() r:any){return this.service.quote(id,d,r);}
 @Post('publications/:id/close') @Permit('match:publish') close(@Param('id') id:string,@Body() d:CloseMatchDto,@Req() r:any){return this.service.close(id,d,r);}
 @Post('responses/:id/negotiate') @Permit('match:negotiate') negotiate(@Param('id') id:string,@Body() d:NegotiateDto,@Req() r:any){return this.service.negotiate(id,d,r);}
 @Post('responses/:id/confirm') @Permit('match:confirm') confirm(@Param('id') id:string,@Body() d:ConfirmDto,@Req() r:any){return this.service.confirm(id,d,r);}
 @Post('confirmations/:id/cancel') @Permit('match:confirm') cancel(@Param('id') id:string,@Body() d:CloseMatchDto,@Req() r:any){return this.service.cancel(id,d,r);}
}
