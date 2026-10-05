import { Controller,Post,Get,Delete,Param,Body,Req,Res,UploadedFile,UseInterceptors,BadRequestException,ForbiddenException,NotFoundException,ConflictException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth,ApiTags,ApiConsumes,ApiBody } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { mkdir,writeFile,unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { Response } from 'express';
import { Database } from './database';
import { Audit } from './audit';
import { TransportService } from './transport.service';
class FileDto { @IsIn(['PHOTO','DOCUMENT']) kind!:'PHOTO'|'DOCUMENT'; }
const directory=resolve(__dirname,'../../../.local/uploads');
@ApiTags('供需附件') @ApiBearerAuth() @Controller()
export class TransportFilesController {
  constructor(private db:Database,private service:TransportService,private audit:Audit){}
  private async authorize(type:string,id:string,req:any,write=false){
    if(!['demand','supply'].includes(type))throw new BadRequestException('无效对象类型');
    if(!req.user.permissions.includes(`${type}:${write?'write':'read'}`))throw new ForbiddenException('无附件访问权限');
    const row=type==='demand'?await this.service.demand(id,req):await this.service.supply(id,req);
    if(write&&(row.businessEntityId!==req.user.businessEntityId||req.user.businessEntity.type!==(type==='demand'?'TRADER':'CARRIER')))throw new ForbiddenException('仅业务所属企业可维护附件');
    if(write&&!['DRAFT','PAUSED','EXPIRED'].includes(row.status))throw new ConflictException('请先撤回需求或暂停供给，再维护附件');
    return row;
  }
  @Post('transport-files/:type/:id') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024,files:1,fields:2}})) @ApiConsumes('multipart/form-data')
  @ApiBody({schema:{type:'object',properties:{file:{type:'string',format:'binary'},kind:{type:'string',enum:['PHOTO','DOCUMENT']}},required:['file','kind']}})
  async upload(@Param('type') type:string,@Param('id') id:string,@Body() dto:FileDto,@UploadedFile() file:any,@Req() req:any){
    const row=await this.authorize(type,id,req,true);if(!file?.buffer?.length)throw new BadRequestException('请选择文件');
    const b:Buffer=file.buffer;
    const mime=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'?'image/webp':b.subarray(0,5).toString()==='%PDF-'?'application/pdf':null;
    if(!mime||(dto.kind==='PHOTO'&&!mime.startsWith('image/')))throw new BadRequestException('仅支持PNG、JPEG、WebP图片或PDF；货物照片必须为图片');
    const originalName=String(file.originalname);
    const decodedName=Buffer.from(originalName,'latin1').toString('utf8');
    const displayName=[...originalName].every(c=>c.charCodeAt(0)<=255)&&!decodedName.includes('\uFFFD')?decodedName:originalName;
    const storageName=randomUUID()+({ 'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','application/pdf':'.pdf'} as any)[mime];
    await mkdir(directory,{recursive:true});await writeFile(resolve(directory,storageName),b,{flag:'wx'});
    try{return await this.db.$transaction(async tx=>{
      const where=type==='demand'?{demandId:id}:{supplyId:id};
      if(await tx.businessFile.count({where:{...where,deletedAt:null}})>=10)throw new BadRequestException('每个对象最多10个附件');
      const change=type==='demand'?await tx.transportDemand.updateMany({where:{id,version:row.version,status:'DRAFT'},data:{version:{increment:1}}}):await tx.transportSupply.updateMany({where:{id,version:row.version,status:{in:['DRAFT','PAUSED','EXPIRED']}},data:{version:{increment:1}}});if(change.count!==1)throw new ConflictException('业务状态已改变，请刷新重试');
      const result=await tx.businessFile.create({data:{...where,name:displayName.replace(/[\x00-\x1f]/g,'').slice(0,180),storageName,mimeType:mime,size:b.length,kind:dto.kind,sha256:createHash('sha256').update(b).digest('hex'),createdBy:req.user.id}});
      await this.audit.write(tx,req,type==='demand'?'运输需求':'运输供给',id,'上传附件',undefined,{fileId:result.id,name:result.name,kind:dto.kind,size:b.length});return {id:result.id,name:result.name};
    });}catch(e){await unlink(resolve(directory,storageName)).catch(()=>{});throw e;}
  }
  @Get('transport-files/:id') async download(@Param('id') id:string,@Req() req:any,@Res() res:Response){
    const file=await this.db.businessFile.findFirst({where:{id,deletedAt:null}});if(!file)throw new NotFoundException('附件不存在');const type=file.demandId?'demand':'supply';const row=await this.authorize(type,(file.demandId||file.supplyId)!,req);
    if(row.businessEntityId!==req.user.businessEntityId&&req.user.businessEntity.type!=='PLATFORM'&&file.kind!=='PHOTO')throw new ForbiddenException('普通附件仅所属企业与平台可查看');
    res.setHeader('Content-Type',file.mimeType);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);res.setHeader('X-Content-Type-Options','nosniff');await new Promise<void>((done,reject)=>res.sendFile(file.storageName,{root:directory,dotfiles:'allow'},error=>error?reject(new NotFoundException('附件文件不存在，请联系管理员恢复备份')):done()));
  }
  @Delete('transport-files/:id') async remove(@Param('id') id:string,@Req() req:any){
    const file=await this.db.businessFile.findFirst({where:{id,deletedAt:null}});if(!file)throw new NotFoundException('附件不存在');const type=file.demandId?'demand':'supply';const objectId=(file.demandId||file.supplyId)!;const row=await this.authorize(type,objectId,req,true);
    return this.db.$transaction(async tx=>{const change=type==='demand'?await tx.transportDemand.updateMany({where:{id:objectId,version:row.version,status:'DRAFT'},data:{version:{increment:1}}}):await tx.transportSupply.updateMany({where:{id:objectId,version:row.version,status:{in:['DRAFT','PAUSED','EXPIRED']}},data:{version:{increment:1}}});if(change.count!==1)throw new ConflictException('业务状态已改变');await tx.businessFile.update({where:{id},data:{deletedAt:new Date()}});await this.audit.write(tx,req,type==='demand'?'运输需求':'运输供给',objectId,'移除附件',{fileId:id,name:file.name});return {success:true};});
  }
}
