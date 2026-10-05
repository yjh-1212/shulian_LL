import {ensureIntermodalBusiness} from './intermodal-business';
import {Injectable,BadRequestException,ForbiddenException,NotFoundException,ConflictException,ServiceUnavailableException} from '@nestjs/common';
import {createHash,randomUUID} from 'node:crypto';
import {Database} from './database';
import {Audit} from './audit';
import {CreateContract,ChangeContract,TemplateDto,RevisionAction,ContractWorkspaceQuery,ContractArchiveDto} from './fulfillment.dto';
import {readTemplateFile,templateFileSelect} from './contract-files';
import {progress,signingComplete} from './contract-progress';
import {businessDataScope} from './business-data-scope';
export const parse=(v:string)=>JSON.parse(v);
export const number=(prefix:string)=>`${prefix}${Date.now()}${randomUUID().slice(0,5).toUpperCase()}`;
export const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
export const packageInclude={revisions:{orderBy:{number:'asc' as const},include:{signatures:true}},business:true};
const initializationSource='BUSINESS_INITIALIZATION';
function initializationProcess(snapshot:any){const p=snapshot?.contractManagement;return snapshot?.provenance?.sourceSystem===initializationSource&&p?.provenance?.sourceSystem===initializationSource&&p?.referenceOnly===true?p:null;}
function referenceArchive(record:any){if(!record)return false;try{const s=parse(record.snapshot);return s.referenceOnly===true&&s.provenance?.sourceSystem===initializationSource;}catch{return false;}}
@Injectable()
export class ContractsService {
 constructor(private db:Database,private audit:Audit){}
 scope(req:any){return {...businessDataScope(),...(req.user.businessEntity.type==='PLATFORM'?{}:{OR:[{traderId:req.user.businessEntityId},{carrierId:req.user.businessEntityId}]})};}
 role(req:any,type:string){if(req.user.businessEntity.type!==type)throw new ForbiddenException('当前主体不能执行此操作');}
 async row(id:string,req:any,db:any=this.db){const p=await db.contractPackage.findFirst({where:{id,...this.scope(req)},include:packageInclude});if(!p)throw new NotFoundException('合同不存在或无权查看');return p;}
 view(p:any){const snapshot=parse(p.snapshot);return {...p,readOnly:snapshot?.provenance?.sourceSystem===initializationSource,performanceReference:initializationProcess(snapshot),signing:{enabled:false,sealUrl:null,reason:'电子签署服务待接入'},snapshot,revisions:p.revisions.map((r:any)=>({...r,terms:parse(r.terms),documents:parse(r.documents)}))};}
 writable(p:any){if(parse(p.snapshot)?.provenance?.sourceSystem===initializationSource)throw new ConflictException('此合同为待核验的业务资料，仅供查看；请核实真实成交资料后建立并签署正式合同');}
 async list(req:any){const rows=await this.db.contractPackage.findMany({where:this.scope(req),include:packageInclude,orderBy:{createdAt:'desc'},take:500});return rows.map(p=>this.view(p));}
 async detail(id:string,req:any,db:any=this.db){
  const p=await this.row(id,req,db);
  const business=p.business?await db.logisticsBusiness.findUnique({where:{id:p.business.id},include:{tasks:{include:{issues:true,evidence:{select:{id:true,name:true,mime:true,digest:true,createdAt:true}},events:{orderBy:{createdAt:'asc'}}},orderBy:[{segment:'asc'},{businessNo:'asc'}]},stages:{orderBy:{sequence:'asc'}},serviceFees:true,batches:true}}):null;
  const bills=await db.bill.findMany({where:{packageId:id,...businessDataScope()},include:{tasks:true,settlement:{include:{records:{orderBy:{createdAt:'asc'}}}},evidence:{select:{id:true,name:true,mime:true,digest:true,createdAt:true}}},orderBy:{createdAt:'desc'}});
  const stats=progress(p,business,bills);
  const archive=await db.contractArchive.findUnique({where:{packageId_entityId:{packageId:id,entityId:req.user.businessEntityId}}});
  const archiveRecord=archive?{id:archive.id,entityId:archive.entityId,revisionId:archive.revisionId,digest:archive.digest,directoryNo:archive.directoryNo,dossierNo:archive.dossierNo,classification:archive.classification,name:archive.name,retention:archive.retention,archiveDate:archive.archiveDate,archivedAt:archive.archivedAt,archivedBy:archive.archivedBy,referenceOnly:referenceArchive(archive),verification:referenceArchive(archive)?'UNVERIFIED_BUSINESS_RECORD':null}:null;
  const logs=await db.auditLog.findMany({where:{module:'合同',objectId:id},orderBy:{createdAt:'asc'},take:500});
  const reference=initializationProcess(parse(p.snapshot));
  const visibleBills=bills.filter((b:any)=>b.status!=='DRAFT'||req.user.businessEntityId===p.carrierId||req.user.businessEntity.type==='PLATFORM'||reference&&parse(b.reference)?.provenance?.sourceSystem===initializationSource);
  const records=visibleBills.flatMap((b:any)=>(b.settlement?.records||[]).map((r:any)=>({...r,billId:b.id,billNo:b.businessNo,settlementNo:b.settlement.businessNo,direction:r.registeredEntityId===p.traderId?'PAYMENT':'RECEIPT',evidence:b.evidence.find((e:any)=>e.id===r.evidenceId)})));
  const measurements=(business?.tasks||[]).flatMap((t:any)=>{const f=parse(t.feedback||'{}');return f.quantityKg>0?[{id:t.id,taskNo:t.businessNo,segment:t.segment,resource:t.resource,quantityKg:f.quantityKg,grossKg:f.grossKg,tareKg:f.tareKg,weightTicketNo:f.weightTicketNo,containers:f.containers||[],receivedAt:t.feedbackSubmittedAt,verification:f.provenance?.sourceSystem===initializationSource?'PENDING_VERIFICATION':'REPORTED',receiver:f.receiver}]:[];});
  return {...this.view(p),performance:business,measurements,progress:stats,archiveRecord,logs,finance:{...stats,records,paymentPlans:reference?.paymentPlans||[],receiptPlans:reference?.receiptPlans||[],bills:visibleBills.map((b:any)=>({id:b.id,businessNo:b.businessNo,status:b.status,totalCents:b.totalCents,settledCents:b.settlement?.settledCents||0,settlementStatus:b.settlement?.status||null,evidence:b.evidence,referenceOnly:parse(b.reference)?.provenance?.sourceSystem===initializationSource}))}};
 }
 async workspace(q:ContractWorkspaceQuery,req:any){
  const packages=await this.db.contractPackage.findMany({where:{AND:[this.scope(req),...(q.status?[{status:q.status}]:[]),...(q.q?[{OR:[{businessNo:{contains:q.q}},{snapshot:{contains:q.q}}]}]:[])]},include:{...packageInclude,business:{include:{tasks:{include:{issues:true}},stages:true}}},orderBy:{createdAt:'desc'}});
  const [bills,archives]=await Promise.all([this.db.bill.findMany({where:{packageId:{in:packages.map(p=>p.id)},...businessDataScope()},include:{tasks:true,settlement:true}}),this.db.contractArchive.findMany({where:{entityId:req.user.businessEntityId},select:{packageId:true,name:true,archiveDate:true,archivedAt:true,snapshot:true}})]);
  let items=packages.map(p=>{const v=this.view(p);const archive=archives.find(a=>a.packageId===p.id);return {...v,contractName:`${v.snapshot.grain||'粮食'}运输合同`,ownSigned:signingComplete(p,req.user.businessEntityId),progress:progress(p,p.business,bills.filter(b=>b.packageId===p.id)),archiveRecord:archive?{name:archive.name,archiveDate:archive.archiveDate,archivedAt:archive.archivedAt,referenceOnly:referenceArchive(archive)}:null};});
  if(q.name)items=items.filter(p=>p.contractName.includes(q.name!)||p.revisions.some((r:any)=>r.documents.some((d:any)=>d.name.includes(q.name!))));
  if(q.type)items=items.filter(p=>p.revisions.at(-1).documents.some((d:any)=>d.type===q.type));
  if(q.stage!=='signing')items=items.filter(p=>['EFFECTIVE','TERMINATED'].includes(p.status)||p.performanceReference);
  const counts=q.stage==='signing'?{PENDING:items.filter(p=>!p.ownSigned).length,SIGNED:items.filter(p=>p.ownSigned).length}:{PENDING:items.filter(p=>!p.archiveRecord).length,ARCHIVED:items.filter(p=>p.archiveRecord).length};
  if(q.stage==='signing')items=items.filter(p=>q.tab==='SIGNED'?p.ownSigned:!p.ownSigned);
  if(q.stage==='archives')items=items.filter(p=>q.tab==='ARCHIVED'?!!p.archiveRecord:!p.archiveRecord);
  items.sort((a,b)=>new Date(b.archiveRecord?.archivedAt||b.createdAt).getTime()-new Date(a.archiveRecord?.archivedAt||a.createdAt).getTime());
  return {items:items.slice((q.page-1)*q.pageSize,q.page*q.pageSize),total:items.length,counts};
 }
 async confirmations(req:any){const assigned=await this.db.contractPackage.findMany({where:this.scope(req),select:{confirmationId:true}});return this.db.carrierConfirmation.findMany({where:{id:{notIn:assigned.map(p=>p.confirmationId)},status:'CONFIRMED',publication:{demand:businessDataScope()},...(req.user.businessEntity.type==='PLATFORM'?{}:{OR:[{traderId:req.user.businessEntityId},{carrierId:req.user.businessEntityId}]})},orderBy:{confirmedAt:'desc'},take:500});}
 async templates(){return this.db.contractTemplate.findMany({where:{status:{not:'ARCHIVED'}},include:{file:{select:templateFileSelect}},orderBy:[{type:'asc'},{version:'desc'}]});}
 async template(dto:TemplateDto,req:any,file?:any){
  this.role(req,'PLATFORM');if(dto.name.trim().length<2)throw new BadRequestException('模板名称至少 2 字');const uploaded=file?await readTemplateFile(file):null;
  return this.db.$transaction(async tx=>{
   const existing=dto.fileId?await tx.contractTemplateFile.findUnique({where:{id:dto.fileId},select:templateFileSelect}):null;if(dto.fileId&&!existing)throw new BadRequestException('原模板附件不存在');
   const attachment=uploaded?await tx.contractTemplateFile.create({data:{...uploaded,bytes:new Uint8Array(uploaded.bytes),createdBy:req.user.id}}):existing;
   const body=uploaded?.previewText||dto.body||attachment?.previewText||(attachment?'合同基础条款见上传附件《'+attachment.name+'》，动态成交约定附于合同正文。':'');
   if(body.trim().length<10)throw new BadRequestException('请上传模板文件或填写至少 10 字的条款正文');
   const last=await tx.contractTemplate.findFirst({where:{type:dto.type},orderBy:{version:'desc'}});
   const r=await tx.contractTemplate.create({data:{name:dto.name.trim(),type:dto.type,mode:dto.mode,body,effectiveFrom:new Date(dto.effectiveFrom),version:(last?.version||0)+1,fileId:attachment?.id},include:{file:{select:templateFileSelect}}});await this.audit.write(tx,req,'合同模板',r.id,uploaded?'上传模板版本':'创建模板版本',undefined,{fileId:attachment?.id,digest:attachment?.digest});return r;
  });
 }
 async templateFile(templateId:string){const t=await this.db.contractTemplate.findUnique({where:{id:templateId},include:{file:true}});if(!t?.file)throw new NotFoundException('模板附件不存在');return t.file;}
 async contractFile(id:string,fileId:string,req:any){const p=await this.row(id,req),snapshot=parse(p.snapshot);if(!snapshot.templates.some((t:any)=>t.fileId===fileId))throw new NotFoundException('合同附件不存在');const f=await this.db.contractTemplateFile.findUnique({where:{id:fileId}});if(!f)throw new NotFoundException('合同附件不存在');return f;}
 async publishTemplate(id:string,req:any){this.role(req,'PLATFORM');return this.db.$transaction(async tx=>{const changed=await tx.contractTemplate.updateMany({where:{id,status:'DRAFT'},data:{status:'PUBLISHED'}});if(!changed.count)throw new ConflictException('模板已发布或不存在');await this.audit.write(tx,req,'合同模板',id,'发布不可变模板');return {id};});}
 terms(dto:CreateContract|ChangeContract){if(new Date(dto.expiresAt)<=new Date())throw new BadRequestException('合同截止时间须晚于现在');return {settlement:dto.settlement,requirements:dto.requirements,platformFeeCents:dto.platformFeeCents,expiresAt:dto.expiresAt};}
 documents(templates:any[],snapshot:any,terms:any,kind='ORIGINAL',reason=''){
  return templates.map(t=>({type:t.type,templateId:t.id,templateVersion:t.version,name:t.name,fileId:t.fileId||null,file:t.file||null,body:`${t.body}\n\n合同类别：${kind==='ORIGINAL'?'原始合同':kind==='CHANGE'?'变更协议':'终止协议'}\n贸易方：${snapshot.trader.name}\n承运方：${snapshot.carrier.name}\n平台：${snapshot.platform.name}\n承运确认：${snapshot.confirmationNo}\n货物：${snapshot.grain||'粮食'}\n路线：${snapshot.origin} → ${snapshot.destination}\n数量：${(snapshot.quantityKg/1000).toFixed(1)} 吨\n运输总价：${(snapshot.totalCents/100).toFixed(2)} 元\n平台费用：${(terms.platformFeeCents/100).toFixed(2)} 元（独立于运输总价）\n结算约定：${terms.settlement}\n作业要求：${terms.requirements}\n截止时间：${terms.expiresAt}\n${reason?'变更/终止原因：'+reason:''}`}));
 }
 async create(dto:CreateContract,req:any){this.role(req,'TRADER');return this.db.$transaction(async tx=>{
  const c=await tx.carrierConfirmation.findFirst({where:{id:dto.confirmationId,traderId:req.user.businessEntityId,status:'CONFIRMED',publication:{demand:businessDataScope()}},include:{publication:true}});if(!c)throw new NotFoundException('有效承运确认不存在');
  const existing=await tx.contractPackage.findUnique({where:{confirmationId:c.id}});if(existing)throw new ConflictException('该承运确认已有合同包，请打开原合同');
  const now=new Date();const templates=await Promise.all(['MAIN','ADDENDUM'].map(type=>tx.contractTemplate.findFirst({where:{type,status:'PUBLISHED',effectiveFrom:{lte:now}},orderBy:[{effectiveFrom:'desc'},{version:'desc'}],include:{file:{select:templateFileSelect}}})));if(templates.some(t=>!t))throw new BadRequestException('请平台先发布主合同和附加合同模板');
  const [trader,carrier,platform,demand]=await Promise.all([tx.businessEntity.findUniqueOrThrow({where:{id:c.traderId}}),tx.businessEntity.findUniqueOrThrow({where:{id:c.carrierId}}),tx.businessEntity.findFirstOrThrow({where:{type:'PLATFORM',status:'ACTIVE',deletedAt:null}}),tx.transportDemand.findUniqueOrThrow({where:{id:c.demandId}})]);
  const published=parse(c.publication.snapshot);const party=(e:any)=>({id:e.id,name:e.name,contact:e.contact,phone:e.phone});const snapshot={confirmationNo:c.businessNo,demandId:c.demandId,demandNo:demand.businessNo,trader:party(trader),carrier:party(carrier),platform:party(platform),quantityKg:c.quantityKg,totalCents:c.totalCents,grain:published.grain,origin:demand.originAddress||demand.originRegion,destination:demand.destinationAddress||demand.destinationRegion,loadingType:demand.loadingType,plan:published.plan||null,deal:parse(c.terms),templates};
  const terms=this.terms(dto),documents=this.documents(templates,snapshot,terms);const p=await tx.contractPackage.create({data:{isTestData:demand.isTestData,businessNo:number('HT'),confirmationId:c.id,traderId:c.traderId,carrierId:c.carrierId,platformId:platform.id,quantityKg:c.quantityKg,totalCents:c.totalCents,snapshot:JSON.stringify(snapshot),revisions:{create:{number:1,mode:templates[1]!.mode,terms:JSON.stringify(terms),documents:JSON.stringify(documents),digest:sha(JSON.stringify(documents))}}}});await this.audit.write(tx,req,'合同',p.id,'生成合同草稿');return {id:p.id};
 });}
 async change(id:string,dto:ChangeContract,req:any){return this.db.$transaction(async tx=>{const p=await this.row(id,req,tx);this.writable(p);if(![p.traderId,p.carrierId].includes(req.user.businessEntityId))throw new ForbiddenException('合同双方可发起变更');if(await tx.contractArchive.count({where:{packageId:id}}))throw new ConflictException('合同已归档，不能发起新变更');if(p.version!==dto.version||p.status!=='EFFECTIVE'||p.revisions.some((r:any)=>!['EFFECTIVE','REJECTED'].includes(r.status)))throw new ConflictException('当前不可发起新变更');const snapshot=parse(p.snapshot),terms=this.terms(dto);const documents=this.documents(snapshot.templates,snapshot,terms,dto.kind,dto.reason);await tx.contractRevision.create({data:{packageId:id,number:p.revisions.length+1,kind:dto.kind,mode:p.revisions[0].mode,reason:dto.reason,terms:JSON.stringify(terms),documents:JSON.stringify(documents),digest:sha(JSON.stringify(documents))}});await tx.contractPackage.update({where:{id,version:dto.version},data:{version:{increment:1}}});await this.audit.write(tx,req,'合同',id,'发起'+dto.kind,undefined,{terms,reason:dto.reason});return {id};});}
 async action(id:string,action:string,dto:RevisionAction,req:any){
  // A document preview or a drawn seal is not a verified electronic signature.
  // Keep signing unavailable until a provider can return authenticated signing evidence.
  if(action==='sign')throw new ServiceUnavailableException('电子签署服务待接入，请联系平台配置签署服务');
  return this.db.$transaction(async tx=>{
  const p=await this.row(id,req,tx);this.writable(p);if(p.version!==dto.version)throw new ConflictException('合同已更新，请刷新');const r=p.revisions.at(-1);const role=req.user.businessEntityId===p.traderId?'TRADER':req.user.businessEntityId===p.carrierId?'CARRIER':req.user.businessEntityId===p.platformId?'PLATFORM':'';let status=r.status;
  if(action==='revise'){if(role!=='TRADER'||r.status!=='REJECTED')throw new ConflictException('仅贸易方可从拒签版本重新起草');await tx.contractRevision.create({data:{packageId:id,number:r.number+1,kind:r.kind,mode:r.mode,reason:'拒签后重新起草',terms:r.terms,documents:r.documents,digest:r.digest}});await tx.contractPackage.update({where:{id,version:dto.version},data:{version:{increment:1},...(r.kind==='ORIGINAL'?{status:'DRAFT'}:{})}});await this.audit.write(tx,req,'合同',id,'拒签后新建版本');return {id};}
  if(action==='submit'){if(role!=='TRADER'||r.status!=='DRAFT')throw new ForbiddenException('贸易方可提交草稿');status='REVIEW';}
  else if(action==='approve'){if(role!=='CARRIER'||r.status!=='REVIEW')throw new ForbiddenException('承运方可确认待审合同');status='SIGNING';}
  else if(action==='return'){if(role!=='CARRIER'||r.status!=='REVIEW'||!dto.reason?.trim())throw new BadRequestException('承运方退回须填写原因');status='DRAFT';}
  else if(action==='withdraw'){if(role!=='TRADER'||!['REVIEW','SIGNING'].includes(r.status)||r.signatures.length)throw new ConflictException('只能撤回尚未签署的合同');status='DRAFT';}
  else if(action==='reject'){if(!['TRADER','CARRIER'].includes(role)||!['REVIEW','SIGNING'].includes(r.status)||!dto.reason?.trim())throw new BadRequestException('当前不能拒签或原因未填');status='REJECTED';}
  else throw new BadRequestException('未知合同操作');
  if(status==='EFFECTIVE'&&r.kind==='TERMINATION'&&p.business){const active=await tx.transportTask.count({where:{businessId:p.business.id,status:{notIn:['COMPLETED','CANCELLED']}}});if(active)throw new ConflictException('请先处理未完成运输任务，再终止合同');}
  await tx.contractRevision.update({where:{id:r.id},data:{status,...(action==='return'?{reason:dto.reason}: {})}});await tx.contractPackage.update({where:{id,version:dto.version},data:{version:{increment:1},...(r.kind==='ORIGINAL'?{status}:{}),...(status==='EFFECTIVE'?{status:r.kind==='TERMINATION'?'TERMINATED':'EFFECTIVE',effectiveAt:p.effectiveAt||new Date()}: {})}});if(status==='EFFECTIVE'&&r.kind==='ORIGINAL')await ensureIntermodalBusiness(tx,await tx.contractPackage.findUniqueOrThrow({where:{id}}));await this.audit.write(tx,req,'合同',id,action,{revision:r.number,status:r.status},{status,reason:dto.reason,documentType:dto.documentType});return {id};
 });}
 async edit(id:string,dto:ChangeContract,req:any){this.role(req,'TRADER');return this.db.$transaction(async tx=>{const p=await this.row(id,req,tx),r=p.revisions.at(-1);this.writable(p);if(p.version!==dto.version||r.status!=='DRAFT')throw new ConflictException('仅可编辑最新草稿');const terms=this.terms(dto),documents=this.documents(parse(p.snapshot).templates,parse(p.snapshot),terms,r.kind,dto.reason);await tx.contractRevision.update({where:{id:r.id},data:{terms:JSON.stringify(terms),documents:JSON.stringify(documents),digest:sha(JSON.stringify(documents)),reason:dto.reason}});await tx.contractPackage.update({where:{id,version:dto.version},data:{version:{increment:1}}});await this.audit.write(tx,req,'合同',id,'编辑草稿');return {id};});}
 async fileArchive(id:string,dto:ContractArchiveDto,req:any){
  return this.db.$transaction(async tx=>{
   if([dto.directoryNo,dto.dossierNo,dto.name].some(v=>v.trim().length<2))throw new BadRequestException('目录号、案卷号、档案名称至少 2 字');const p=await this.row(id,req,tx);this.writable(p);if(![p.traderId,p.carrierId,p.platformId].includes(req.user.businessEntityId))throw new ForbiddenException('仅合同签约企业可以归档');
   if(p.version!==dto.version)throw new ConflictException('合同已更新，请刷新');
   if(await tx.contractArchive.findUnique({where:{packageId_entityId:{packageId:id,entityId:req.user.businessEntityId}}}))throw new ConflictException('本企业已经归档此合同');
   const detail=await this.detail(id,req,tx);if(!detail.progress.canArchive)throw new ConflictException(detail.progress.archiveReasons.join('；'));
   const archiveDate=new Date(dto.archiveDate);if(archiveDate.getTime()>Date.now()+300000||archiveDate<p.createdAt)throw new BadRequestException('归档日期须在合同创建后，且不能晚于当前时间');
   const revision=p.revisions.filter((r:any)=>r.status==='EFFECTIVE').at(-1);
   const record=await tx.contractArchive.create({data:{packageId:id,entityId:req.user.businessEntityId,revisionId:revision.id,digest:revision.digest,directoryNo:dto.directoryNo.trim(),dossierNo:dto.dossierNo.trim(),classification:dto.classification,name:dto.name.trim(),retention:dto.retention,archiveDate,archivedBy:req.user.id,snapshot:JSON.stringify(detail)}});
   await tx.contractPackage.update({where:{id,version:dto.version},data:{version:{increment:1}}});
   await this.audit.write(tx,req,'合同档案',id,'完成合同归档',undefined,{archiveId:record.id,directoryNo:record.directoryNo,dossierNo:record.dossierNo});return {id:record.id};
  });
 }
 async archive(id:string,req:any){const detail=await this.detail(id,req);const p=await this.row(id,req);const record=await this.db.contractArchive.findUnique({where:{packageId_entityId:{packageId:id,entityId:req.user.businessEntityId}}});const confirmation=await this.db.carrierConfirmation.findUniqueOrThrow({where:{id:p.confirmationId},include:{response:{include:{rounds:true}}}});await this.audit.write(this.db,req,'合同档案',id,'导出合同档案');return {exportedAt:new Date(),...(record&&!referenceArchive(record)?parse(record.snapshot):detail),signing:detail.signing,archiveRecord:detail.archiveRecord,confirmation};}
}
