import {Injectable,Controller,Get,Post,Put,Param,Body,Req,Res,Query,ForbiddenException,NotFoundException,BadRequestException,ConflictException,HttpException} from '@nestjs/common';
import {ApiTags,ApiBearerAuth,ApiHeader} from '@nestjs/swagger';
import {randomBytes} from 'node:crypto';
import {Database} from './database';import {Audit} from './audit';import {Public,Permit} from './security';import {sha,parse} from './contracts.service';
import {ProductInput,DataState,GrantInput,SubscriptionInput,ApplicationInput,DataRequestInput,DataReviewInput,DataQuery} from './data-service.dto';
import {dataFields,dataCatalog,dataScenarios} from './data-products.catalog';
import {DataDatasets} from './data-datasets';
import {businessDataScope} from './business-data-scope';
const csv=(rows:any[])=>{const keys=Object.keys(rows[0]||{});const cell=(v:any)=>'"'+String(typeof v==='object'?JSON.stringify(v):v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n');};
const quotas:Record<string,number>={BASIC:100,STANDARD:1000,ENTERPRISE:5000};
const effective=(g:any)=>g.status!=='ACTIVE'?g.status:g.expiresAt<=new Date()?'EXPIRED':g.product&&(g.product.status!=='PUBLISHED'||g.productVersion!==g.product.version)?'UNAVAILABLE':g.startsAt>new Date()?'SCHEDULED':'ACTIVE';
const report=(result:any)=>{
 const text=(v:any)=>String(typeof v==='object'?JSON.stringify(v):v??'—').replace(/[|\r\n]/g,' ');
 const keys=Object.keys(result.data[0]||{});
 return `# ${result.product.name}\n\n生成时间：${new Date(result.asOf).toISOString()}\n\n授权企业：${result.entityName}\n\n授权范围：${result.scope}；产品版本：${result.product.version}\n\n${result.notes}\n\n`+(keys.length?'| '+keys.join(' | ')+' |\n| '+keys.map(()=> '---').join(' | ')+' |\n'+result.data.map((row:any)=>'| '+keys.map(k=>text(row[k])).join(' | ')+' |').join('\n'):'授权范围内暂无可提供数据。')+'\n';
};

@Injectable()
export class DataService {
 private datasets:DataDatasets;
 constructor(private db:Database,private audit:Audit){this.datasets=new DataDatasets(db);}
 private platform(r:any){return r.user?.businessEntity?.type==='PLATFORM'&&r.user.permissions?.includes('data:write');}
 private applicant(r:any){if(!['TRADER','CARRIER'].includes(r.user?.businessEntity?.type))throw new ForbiddenException('数据授权申请与订阅由粮食贸易企业或物流运营商办理，平台负责审核授权');}
 private async entityWhere(r:any){const entities=await this.db.businessEntity.findMany({where:{...businessDataScope(),...(this.platform(r)?{}:{id:r.user.businessEntityId})},select:{id:true}});return {entityId:{in:entities.map(e=>e.id)}};}
 private own(entityId:string,r:any){if(!this.platform(r)&&entityId!==r.user.businessEntityId)throw new NotFoundException('数据服务记录不存在');}
 private admin(r:any){if(!this.platform(r))throw new ForbiddenException('产品维护与授权审核由平台运营方执行');}
 productView(p:any){const profile=dataCatalog.find(x=>x.dataset===p.dataset);return {...p,fields:parse(p.fields),profile:profile?{...profile,fields:undefined}:null,versions:p.versions?.map((v:any)=>({...v,snapshot:parse(v.snapshot)}))};}
 async options(r:any){
  const platform=this.platform(r),entityId=r.user.businessEntityId;
  return {datasets:dataFields,editions:[{id:'BASIC',name:'基础版',dailyLimit:100},{id:'STANDARD',name:'标准版',dailyLimit:1000},{id:'ENTERPRISE',name:'企业版',dailyLimit:5000}],entities:platform?await this.db.businessEntity.findMany({where:{type:{in:['TRADER','CARRIER']},status:'ACTIVE',deletedAt:null,...businessDataScope()},select:{id:true,name:true,type:true}}):[{id:entityId,name:r.user.businessEntity.name,type:r.user.businessEntity.type}],waybills:await this.db.logisticsBusiness.findMany({where:{package:{isTestData:false,OR:[{traderId:entityId},{carrierId:entityId}]}},select:{id:true,waybillNo:true,businessNo:true},take:500})};
 }
 async products(r:any){return (await this.db.dataProduct.findMany({where:this.platform(r)?{}:{status:'PUBLISHED'},include:this.platform(r)?{versions:{orderBy:{number:'desc'}}}:undefined,orderBy:{createdAt:'desc'},take:500})).map(p=>this.productView(p));}
 async scenarios(){const products=await this.db.dataProduct.findMany({where:{status:'PUBLISHED',code:{in:dataCatalog.map(p=>p.code)}}});return dataScenarios.map(s=>({...s,products:s.datasets.map(dataset=>products.find(p=>p.dataset===dataset)).filter(Boolean).map(p=>this.productView(p))}));}
 validateProduct(d:ProductInput){if(!/^[A-Za-z0-9_.-]+$/.test(d.code))throw new BadRequestException('产品编号仅支持字母、数字、点和短横线');if(!dataFields[d.dataset]||d.fields.some(f=>!dataFields[d.dataset].includes(f)))throw new BadRequestException('产品包含不支持的字段');}
 async product(d:ProductInput,r:any,id?:string){this.admin(r);this.validateProduct(d);return this.db.$transaction(async tx=>{
  const old=id?await tx.dataProduct.findUnique({where:{id}}):null;if(id&&(!old||old.version!==d.version))throw new ConflictException('产品已更新，请重新加载');if(old&&old.code!==d.code)throw new BadRequestException('产品编号不可变更');
  const data={...d,fields:JSON.stringify(d.fields)};delete data.version;const p=id?await tx.dataProduct.update({where:{id,version:d.version},data:{...data,version:{increment:1},status:'DRAFT'}}):await tx.dataProduct.create({data});
  await tx.dataProductVersion.create({data:{productId:p.id,number:p.version,snapshot:JSON.stringify(p),userId:r.user.id}});await this.audit.write(tx,r,'数据服务',p.id,id?'创建产品新版本':'登记数据产品',undefined,{code:p.code,version:p.version});return this.productView(p);
 });}
 async productState(id:string,d:DataState,r:any){this.admin(r);const flow:Record<string,string[]>={DRAFT:['REVIEW'],REVIEW:['PUBLISHED','DRAFT'],PUBLISHED:['PAUSED','OFFLINE'],PAUSED:['PUBLISHED','OFFLINE'],OFFLINE:['DRAFT']};return this.db.$transaction(async tx=>{
  const p=await tx.dataProduct.findUnique({where:{id}});if(!p||p.version!==d.version||!flow[p.status]?.includes(d.status))throw new ConflictException('当前产品状态或版本不允许此操作');const updated=await tx.dataProduct.update({where:{id,version:d.version},data:{status:d.status}});await this.audit.write(tx,r,'数据服务',id,'产品状态变更',{status:p.status},{status:d.status});return this.productView(updated);
 });}
 async requests(r:any){const rows=await this.db.dataAccessRequest.findMany({where:await this.entityWhere(r),include:{product:true},orderBy:{createdAt:'desc'},take:500}),entities=await this.db.businessEntity.findMany({where:{...businessDataScope(),...(this.platform(r)?{}:{id:r.user.businessEntityId})},select:{id:true,name:true}});return rows.map(x=>({...x,scenarios:parse(x.scenarios),constraints:parse(x.constraints),product:this.productView(x.product),entityName:entities.find(e=>e.id===x.entityId)?.name}));}
 async request(d:DataRequestInput,r:any){
  this.applicant(r);
  if(d.department.trim().length<2||d.applicationName.trim().length<2||d.purpose.trim().length<10)throw new BadRequestException('请填写部门、使用应用和至少10字的数据用途');
  const p=await this.db.dataProduct.findUnique({where:{id:d.productId}}),profile=dataCatalog.find(x=>x.dataset===p?.dataset);
  if(!p||p.status!=='PUBLISHED'||!profile)throw new BadRequestException('请选择已发布的数据产品');
  if(!profile.scopes.includes(d.scope))throw new BadRequestException('该产品未开放所选数据范围');
  const from=new Date(d.startsAt),to=new Date(d.expiresAt);if(from>=to||to<=new Date()||to.getTime()-from.getTime()>366*86400000)throw new BadRequestException('申请期限须有效且不超过一年');
  const constraints:any={edition:d.edition};
  if(p.dataset==='CAPACITY'){if(!d.origin?.trim()||!d.destination?.trim())throw new BadRequestException('运力资源须指定申请起运地和目的地');constraints.origin=d.origin.trim();constraints.destination=d.destination.trim();}
  if(p.dataset==='TRACE'){
   if(!d.waybillIds?.length)throw new BadRequestException('链路核验须选择本企业的指定运单');
   const count=await this.db.logisticsBusiness.count({where:{id:{in:d.waybillIds},package:{isTestData:false,OR:[{traderId:r.user.businessEntityId},{carrierId:r.user.businessEntityId}]}}});
   if(count!==d.waybillIds.length)throw new BadRequestException('核验运单须属于申请企业且可提供授权数据');constraints.waybillIds=d.waybillIds;
  }
  return this.db.$transaction(async tx=>{
   if(await tx.dataAccessRequest.findFirst({where:{entityId:r.user.businessEntityId,productId:p.id,status:'PENDING'}}))throw new ConflictException('该产品已有待审核申请，请在我的授权中查看');
   const x=await tx.dataAccessRequest.create({data:{productId:p.id,productVersion:p.version,entityId:r.user.businessEntityId,userId:r.user.id,department:d.department.trim(),applicationName:d.applicationName.trim(),scenarios:JSON.stringify(d.scenarios),purpose:d.purpose.trim(),edition:d.edition,scope:d.scope,constraints:JSON.stringify(constraints),startsAt:from,expiresAt:to}});
   await this.audit.write(tx,r,'数据服务',x.id,'提交数据授权申请',undefined,{productId:p.id,scope:d.scope,entityId:x.entityId});return x;
  });
 }
 async review(id:string,d:DataReviewInput,r:any){this.admin(r);return this.db.$transaction(async tx=>{
  const x=await tx.dataAccessRequest.findUnique({where:{id},include:{product:true}});
  if(!x||x.version!==d.version||x.status!=='PENDING')throw new ConflictException('申请已处理，请重新加载');
  if(d.status==='APPROVED'){
   const profile=dataCatalog.find(p=>p.dataset===x.product.dataset);if(profile&&!profile.scopes.includes(x.scope))throw new BadRequestException('申请范围未由该产品开放，请退回重新申请');
   if(x.product.status!=='PUBLISHED'||x.product.version!==x.productVersion||x.expiresAt<=new Date())throw new BadRequestException('产品版本或申请期限已失效，请退回重新申请');
   if(!await tx.businessEntity.findFirst({where:{id:x.entityId,type:{in:['TRADER','CARRIER']},status:'ACTIVE',deletedAt:null,...businessDataScope()}}))throw new BadRequestException('申请企业须为有效的粮食贸易企业或物流运营商');
   const limit=d.dailyLimit||quotas[x.edition];if(limit>quotas[x.edition])throw new BadRequestException('审核额度不能超过申请版本的上限');
   await tx.dataAuthorization.create({data:{productId:x.productId,productVersion:x.productVersion,entityId:x.entityId,purpose:x.purpose,scope:x.scope,fields:x.product.fields,basis:d.note,approver:r.user.displayName,startsAt:x.startsAt,expiresAt:x.expiresAt,constraints:x.constraints,dailyLimit:limit,requestId:x.id}});
  }
  const updated=await tx.dataAccessRequest.update({where:{id,version:d.version,status:'PENDING'},data:{status:d.status,reviewNote:d.note,reviewedBy:r.user.id,reviewedAt:new Date(),version:{increment:1}}});
  await this.audit.write(tx,r,'数据服务',id,'审核数据授权申请',{status:x.status},{status:d.status,note:d.note});return updated;
 });}
 async withdraw(id:string,d:DataState,r:any){this.applicant(r);return this.db.$transaction(async tx=>{const x=await tx.dataAccessRequest.findUnique({where:{id}});if(!x)throw new NotFoundException('申请不存在');this.own(x.entityId,r);if(x.status!=='PENDING'||x.version!==d.version)throw new ConflictException('只能撤回待审核申请');const updated=await tx.dataAccessRequest.update({where:{id,version:d.version},data:{status:'WITHDRAWN',version:{increment:1}}});await this.audit.write(tx,r,'数据服务',id,'撤回授权申请');return updated;});}
 async grants(r:any){const rows=await this.db.dataAuthorization.findMany({where:await this.entityWhere(r),include:{product:true},orderBy:{createdAt:'desc'},take:500}),entities=await this.db.businessEntity.findMany({where:{...businessDataScope(),...(this.platform(r)?{}:{id:r.user.businessEntityId})},select:{id:true,name:true}});return rows.map(g=>({...g,fields:parse(g.fields),constraints:parse(g.constraints),product:this.productView(g.product),entityName:entities.find(e=>e.id===g.entityId)?.name,effectiveStatus:effective(g)}));}
 async grant(d:GrantInput,r:any){
  this.admin(r);const p=await this.db.dataProduct.findUnique({where:{id:d.productId}}),e=await this.db.businessEntity.findFirst({where:{id:d.entityId,type:{in:['TRADER','CARRIER']},status:'ACTIVE',deletedAt:null,...businessDataScope()}});
  if(!p||p.status!=='PUBLISHED'||p.version!==d.productVersion||!e)throw new BadRequestException('请选择有效主体与已发布产品当前版本');if(new Date(d.startsAt)>=new Date(d.expiresAt))throw new BadRequestException('授权期限无效');if(d.fields.some(f=>!parse(p.fields).includes(f)))throw new BadRequestException('授权字段必须为产品字段的子集');
  if(['CAPACITY','TRACE'].includes(p.dataset))throw new BadRequestException('该产品须通过含指定线路或运单的企业申请进行审核授权');
  if(p.dataset==='TASKS'&&d.scope!=='OWN'||p.dataset==='LINES'&&d.scope!=='PUBLIC'||p.dataset==='METRICS'&&!['OWN','AGGREGATE'].includes(d.scope)||dataCatalog.find(x=>x.dataset===p.dataset)&&!dataCatalog.find(x=>x.dataset===p.dataset)!.scopes.includes(d.scope))throw new BadRequestException('所选数据范围未开放');
  return this.db.$transaction(async tx=>{const g=await tx.dataAuthorization.create({data:{...d,fields:JSON.stringify(d.fields),startsAt:new Date(d.startsAt),expiresAt:new Date(d.expiresAt)}});await this.audit.write(tx,r,'数据服务',g.id,'登记产品授权',undefined,{productId:p.id,entityId:e.id,scope:g.scope});return g;});
 }
 async state(model:'dataAuthorization'|'dataSubscription'|'dataApplication',id:string,d:DataState,r:any){
  if(model==='dataSubscription')this.applicant(r);
  if(!['ACTIVE','PAUSED','REVOKED'].includes(d.status))throw new BadRequestException('无效服务状态');if(model!=='dataSubscription')this.admin(r);
  return this.db.$transaction(async tx=>{const old=await (tx as any)[model].findUnique({where:{id},...(model==='dataSubscription'?{include:{authorization:true}}:{})});if(!old)throw new NotFoundException('数据服务记录不存在');if(model==='dataSubscription')this.own(old.authorization.entityId,r);if(old.version!==d.version||old.status==='REVOKED')throw new ConflictException('记录已更新或撤销，不可更改');const row=await (tx as any)[model].update({where:{id,version:d.version},data:{status:d.status,version:{increment:1}}});await this.audit.write(tx,r,'数据服务',id,'授权或服务状态变更',{status:old.status},{status:d.status});const {keyHash,...safe}=row;return safe;});
 }
 async subscriptions(r:any){
  this.applicant(r);
  const day=new Date();day.setUTCHours(0,0,0,0);
  const rows=await this.db.dataSubscription.findMany({where:{authorization:await this.entityWhere(r)},include:{authorization:{include:{product:true}},calls:{orderBy:{createdAt:'desc'},take:50}},orderBy:{createdAt:'desc'},take:500});
  const entities=await this.db.businessEntity.findMany({where:{id:{in:rows.map(s=>s.authorization.entityId)}},select:{id:true,name:true}});
  return Promise.all(rows.map(async({keyHash,...s})=>({...s,entityName:entities.find(e=>e.id===s.authorization.entityId)?.name,effectiveStatus:s.status!=='ACTIVE'?s.status:s.authorization.product.status!=='PUBLISHED'||s.authorization.productVersion!==s.authorization.product.version?'UNAVAILABLE':effective(s.authorization),usedToday:await this.db.dataCall.count({where:{subscriptionId:s.id,createdAt:{gte:day},status:{in:['RUNNING','SUCCESS']}}}),authorization:{...s.authorization,fields:parse(s.authorization.fields),constraints:parse(s.authorization.constraints),product:this.productView(s.authorization.product)}})));
 }
 async subscribe(d:SubscriptionInput,r:any){
  this.applicant(r);
  const g=await this.db.dataAuthorization.findUnique({where:{id:d.authorizationId},include:{product:true}});if(!g)throw new NotFoundException('授权不存在');this.own(g.entityId,r);
  if(g.status!=='ACTIVE'||g.expiresAt<=new Date()||g.product.status!=='PUBLISHED'||g.product.version!==g.productVersion)throw new BadRequestException('授权或产品版本无效');if(g.product.serviceMode!=='BOTH'&&g.product.serviceMode!==d.mode)throw new BadRequestException('产品未开放该服务方式');if(d.dailyLimit>g.dailyLimit)throw new BadRequestException('订阅日额度不能超过平台授权额度');
  const key='gds_'+randomBytes(32).toString('hex');return this.db.$transaction(async tx=>{
   if(!this.platform(r)&&await tx.dataSubscription.findFirst({where:{authorizationId:g.id,mode:d.mode,status:{not:'REVOKED'}}}))throw new ConflictException('该授权已有此方式的订阅，请在我的订阅中管理');
   const s=await tx.dataSubscription.create({data:{...d,keyHash:sha(key),keyPrefix:key.slice(0,12)}});await this.audit.write(tx,r,'数据服务',s.id,'开通订阅',undefined,{authorizationId:g.id,mode:s.mode,dailyLimit:s.dailyLimit,keyPrefix:s.keyPrefix});const {keyHash,...safe}=s;return {...safe,key};
  });
 }
 async rotate(id:string,d:DataState,r:any){this.applicant(r);const key='gds_'+randomBytes(32).toString('hex');return this.db.$transaction(async tx=>{
  const old=await tx.dataSubscription.findUnique({where:{id},include:{authorization:true}});if(!old)throw new NotFoundException('订阅不存在');this.own(old.authorization.entityId,r);if(old.version!==d.version||old.status==='REVOKED')throw new ConflictException('订阅已更新或撤销');await tx.dataSubscription.update({where:{id,version:d.version},data:{keyHash:sha(key),keyPrefix:key.slice(0,12),version:{increment:1}}});await this.audit.write(tx,r,'数据服务',id,'轮换调用凭证',undefined,{keyPrefix:key.slice(0,12)});return {key};
 });}
 async call(id:string|undefined,key:string|undefined,r:any,channel='PREVIEW',q:DataQuery={}){
  if(id){if(channel==='APPLICATION')this.admin(r);else this.applicant(r);}
  const s=await this.db.dataSubscription.findFirst({where:id?{id}:key?{keyHash:sha(key)}:{id:'INVALID'},include:{authorization:{include:{product:true}}}});if(!s)throw new ForbiddenException('调用凭证无效');if(id)this.own(s.authorization.entityId,r);
  const g=s.authorization,p=g.product,now=new Date();let error='';
  if(s.status!=='ACTIVE'||g.status!=='ACTIVE'||g.startsAt>now||g.expiresAt<=now||p.status!=='PUBLISHED'||p.version!==g.productVersion)error='订阅、授权或产品版本已暂停、到期或改变';
  if(['API','PUSH'].includes(channel)&&s.mode!=='API')error='此订阅仅开放文件服务';if(channel==='FILE'&&s.mode!=='FILE')error='此订阅仅开放 API 服务';if(channel==='PUSH'&&p.dataset!=='RISK')error='仅风险产品开放事件订阅';if(p.dataset==='TRACE'&&channel==='FILE')error='链路核验不提供批量文件服务';
  const entity=await this.db.businessEntity.findFirst({where:{id:g.entityId,status:'ACTIVE',deletedAt:null,...businessDataScope()}});if(!entity)error='授权主体已停用';
  const parameters=JSON.stringify(q),requestId=r.requestId||'';
  if(error){await this.db.dataCall.create({data:{subscriptionId:s.id,requestId,channel,status:'FAILED',error,parameters}});throw new ForbiddenException(error);}
  const day=new Date(now);day.setUTCHours(0,0,0,0);const call=await this.db.$transaction(async tx=>{
   const used=await tx.dataCall.count({where:{subscriptionId:s.id,createdAt:{gte:day},status:{in:['RUNNING','SUCCESS']}}}),grantUsed=await tx.dataCall.count({where:{subscription:{authorizationId:g.id},createdAt:{gte:day},status:{in:['RUNNING','SUCCESS']}}});
   if(used>=s.dailyLimit||grantUsed>=g.dailyLimit){await tx.dataCall.create({data:{subscriptionId:s.id,requestId,channel,status:'FAILED',error:'日调用限额已用尽',parameters}});return null;}
   return tx.dataCall.create({data:{subscriptionId:s.id,requestId,channel,status:'RUNNING',parameters}});
  });if(!call)throw new HttpException('日调用限额已用尽',429);
  try{const rows=await this.datasets.rows(p.dataset,g,entity,q),allowed=parse(g.fields),data=rows.map((row:any)=>Object.fromEntries(allowed.map((f:string)=>[f,row[f]??null])));await this.db.dataCall.update({where:{id:call.id},data:{status:'SUCCESS',rows:data.length}});return {product:{code:p.code,name:p.name,version:g.productVersion},format:p.format,scope:g.scope,entityName:entity!.name,asOf:now,data,truncated:data.length>=1000,callId:call.id,notes:p.dataset==='CORRIDOR'?'按运单计量，跨运输方式不重复计吨；少于3单隐藏吨数和效率；节点等待参考有效态势登记':p.dataset==='CREDIT'?'仅供合作参考，不构成法定信用评级；少于3单不评级；准时率按已完成阶段统计':'仅返回授权字段；不含联系方式、合同底价和原始单据'};}
  catch(e:any){await this.db.dataCall.update({where:{id:call.id},data:{status:'FAILED',error:e?.getStatus?.()&&e.getStatus()<500?e.message:'数据服务生成失败'}});throw e;}
 }
 async applications(r:any){this.admin(r);return (await this.db.dataApplication.findMany({orderBy:{createdAt:'desc'},take:500})).map(a=>({...a,subscriptionIds:parse(a.subscriptionIds)}));}
 async application(d:ApplicationInput,r:any,id?:string){this.admin(r);if(id&&!Number.isInteger(d.version))throw new BadRequestException('更新专题须提供当前版本');if(await this.db.dataSubscription.count({where:{id:{in:d.subscriptionIds},status:'ACTIVE'}})!==d.subscriptionIds.length)throw new BadRequestException('请选择有效订阅');return this.db.$transaction(async tx=>{const data={name:d.name,description:d.description,subscriptionIds:JSON.stringify(d.subscriptionIds)};const a=id?await tx.dataApplication.update({where:{id,version:d.version},data:{...data,version:{increment:1}}}):await tx.dataApplication.create({data});await this.audit.write(tx,r,'数据服务',a.id,id?'修改专题应用':'组合专题应用',undefined,{subscriptionIds:d.subscriptionIds});return a;});}
 async applicationData(id:string,r:any){this.admin(r);const a=await this.db.dataApplication.findUnique({where:{id}});if(!a||a.status!=='ACTIVE')throw new NotFoundException('专题应用未开放');const results=[];for(const sid of parse(a.subscriptionIds))try{results.push(await this.call(sid,undefined,r,'APPLICATION'));}catch(e:any){results.push({subscriptionId:sid,error:e.message});}return {name:a.name,description:a.description,results,asOf:new Date()};}
}

@ApiTags('数据产品服务') @ApiBearerAuth() @Controller('data') @Permit('data:read')
export class DataController {
 constructor(private s:DataService){}
 @Get('options') options(@Req() r:any){return this.s.options(r);}
 @Get('products') products(@Req() r:any){return this.s.products(r);}
 @Get('scenarios') scenarios(){return this.s.scenarios();}
 @Post('products') @Permit('data:write') product(@Body() d:ProductInput,@Req() r:any){return this.s.product(d,r);}
 @Put('products/:id') @Permit('data:write') update(@Param('id') id:string,@Body() d:ProductInput,@Req() r:any){return this.s.product(d,r,id);}
 @Post('products/:id/status') @Permit('data:write') productState(@Param('id') id:string,@Body() d:DataState,@Req() r:any){return this.s.productState(id,d,r);}
 @Get('requests') requests(@Req() r:any){return this.s.requests(r);}
 @Post('requests') @Permit('data:subscribe') request(@Body() d:DataRequestInput,@Req() r:any){return this.s.request(d,r);}
 @Post('requests/:id/review') @Permit('data:write') review(@Param('id') id:string,@Body() d:DataReviewInput,@Req() r:any){return this.s.review(id,d,r);}
 @Post('requests/:id/withdraw') @Permit('data:subscribe') withdraw(@Param('id') id:string,@Body() d:DataState,@Req() r:any){return this.s.withdraw(id,d,r);}
 @Get('authorizations') grants(@Req() r:any){return this.s.grants(r);}
 @Post('authorizations') @Permit('data:write') grant(@Body() d:GrantInput,@Req() r:any){return this.s.grant(d,r);}
 @Post('authorizations/:id/status') @Permit('data:write') grantState(@Param('id') id:string,@Body() d:DataState,@Req() r:any){return this.s.state('dataAuthorization',id,d,r);}
 @Get('subscriptions') subscriptions(@Req() r:any){return this.s.subscriptions(r);}
 @Post('subscriptions') @Permit('data:subscribe') subscribe(@Body() d:SubscriptionInput,@Req() r:any){return this.s.subscribe(d,r);}
 @Post('subscriptions/:id/status') @Permit('data:subscribe') subscriptionState(@Param('id') id:string,@Body() d:DataState,@Req() r:any){return this.s.state('dataSubscription',id,d,r);}
 @Post('subscriptions/:id/key') @Permit('data:subscribe') rotate(@Param('id') id:string,@Body() d:DataState,@Req() r:any){return this.s.rotate(id,d,r);}
 @Post('subscriptions/:id/preview') preview(@Param('id') id:string,@Body() q:DataQuery,@Req() r:any){return this.s.call(id,undefined,r,'PREVIEW',q);}
 @Get('subscriptions/:id/file') async file(@Param('id') id:string,@Query() q:DataQuery,@Req() r:any,@Res() res:any){const result=await this.s.call(id,undefined,r,'FILE',q),json=result.format==='JSON';res.setHeader('Content-Type',json?'application/json; charset=utf-8':'text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${result.product.code}.${json?'json':'csv'}"`);res.send(json?JSON.stringify(result):csv(result.data));}
 @Get('subscriptions/:id/report') async report(@Param('id') id:string,@Query() q:DataQuery,@Req() r:any,@Res() res:any){const result=await this.s.call(id,undefined,r,'REPORT',q);res.setHeader('Content-Type','text/markdown; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${result.product.code}-report.md"`);res.send(report(result));}
 @Get('applications') @Permit('data:write') applications(@Req() r:any){return this.s.applications(r);}
 @Post('applications') @Permit('data:write') application(@Body() d:ApplicationInput,@Req() r:any){return this.s.application(d,r);}
 @Put('applications/:id') @Permit('data:write') updateApplication(@Param('id') id:string,@Body() d:ApplicationInput,@Req() r:any){return this.s.application(d,r,id);}
 @Post('applications/:id/status') @Permit('data:write') applicationState(@Param('id') id:string,@Body() d:DataState,@Req() r:any){return this.s.state('dataApplication',id,d,r);}
 @Post('applications/:id/query') @Permit('data:write') query(@Param('id') id:string,@Req() r:any){return this.s.applicationData(id,r);}
}
@ApiTags('授权数据调用') @Controller('data-feed')
export class DataFeedController {
 constructor(private s:DataService){}
 @Public() @Get() @ApiHeader({name:'X-Data-Key',required:true}) call(@Query() q:DataQuery,@Req() r:any){return this.s.call(undefined,String(r.headers['x-data-key']||''),r,'API',q);}
 @Public() @Get('events') @ApiHeader({name:'X-Data-Key',required:true}) async events(@Query() q:DataQuery,@Req() r:any,@Res() res:any){
  const key=String(r.headers['x-data-key']||''),first=await this.s.call(undefined,key,r,'PUSH',q);
  res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('Connection','keep-alive');res.flushHeaders();
  res.write('event: risks\ndata: '+JSON.stringify(first)+'\n\n');let running=false;
  const timer=setInterval(async()=>{if(running)return;running=true;try{const next=await this.s.call(undefined,key,r,'PUSH',q);res.write('event: risks\ndata: '+JSON.stringify(next)+'\n\n');}catch{res.write('event: service-error\ndata: {"message":"订阅、授权或额度已失效，请检查我的订阅"}\n\n');res.end();clearInterval(timer);}finally{running=false;}},60000);
  res.on('close',()=>clearInterval(timer));
 }
}
