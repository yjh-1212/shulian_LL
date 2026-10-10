import {Controller, Get, Put, Post, Delete, Body, Query, Param, BadRequestException, NotFoundException, ConflictException} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {Database} from './database';
import {Public} from './security';
import {corridorProgress} from './tracking-quantities';
const cockpit = require('../../../jiashicang/server/cockpit.cjs');
const appearance = require('../../../jiashicang/server/appearance.cjs');

@Controller('cockpit')
@Public()
export class CockpitController {
 constructor(private db:Database){}
 private async appearanceCall(action:()=>Promise<any>){
  try{return await action();}catch(error:any){
   if(error.appearanceCode==='CONFLICT')throw new ConflictException(error.message);
   if(error.appearanceCode==='NOT_FOUND')throw new NotFoundException(error.message);
   if(error.appearanceCode==='INVALID')throw new BadRequestException(error.message);
   throw error;
  }
 }
 @Get('appearance') @Throttle({default:{limit:600,ttl:60000}})
 appearance(){return this.appearanceCall(()=>appearance.readAppearance(this.db));}
 @Put('appearance')
 saveAppearance(@Body() body:any){return this.appearanceCall(()=>appearance.saveAppearance(this.db,body));}
 @Post('appearance/presets')
 savePreset(@Body() body:any){return this.appearanceCall(()=>appearance.savePreset(this.db,body));}
 @Delete('appearance/presets/:id')
 deletePreset(@Param('id') id:string,@Body() body:any){return this.appearanceCall(()=>appearance.deletePreset(this.db,id,body));}
 @Get('overview') overview(@Query('period') period='30',@Query('grain') grain='',@Query('origin') origin='',@Query('destination') destination='',@Query('combination') combination='',@Query('node') node='',@Query('region') region=''){
  if(!['7','30','90','all'].includes(period)||typeof grain!=='string'||grain.length>40||[origin,destination,node,region].some(v=>typeof v!=='string'||v.length>100)||typeof combination!=='string'||(combination&&!['公','铁','水','公铁','公水','铁水','公铁水'].includes(combination)))throw new BadRequestException('请检查统计筛选范围');
  return cockpit.publicOverview(this.db,{period,grain,origin,destination,combination,node,region});
 }
 @Get('chains/:id') async chain(@Param('id') id:string){
  const result=await cockpit.publicChain(this.db,id,corridorProgress);
  if(!result)throw new NotFoundException('业务不存在');
  return result;
 }
}
