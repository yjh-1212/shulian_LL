import { Injectable,BadRequestException,ForbiddenException,NotFoundException,ConflictException,OnModuleInit,OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID,createHash } from 'node:crypto';
import { Database } from './database';
import { Audit } from './audit';
import { supplyAvailability } from './supply-availability';
import { demandSnapshot } from './match-snapshot';
import { DemandDto,SupplyDto,PublishDemandDto,TransportQuery,ImportOrderDto } from './transport.dto';
import {businessDataScope} from './business-data-scope';
import {storedDemandPoint} from './demand-location';
import {PointDto} from './planning.dto';
const regions:Record<string,Record<string,string>>=require('china-area-data');
const entitySelect={id:true,name:true,type:true,status:true};
const demandInclude={grain:true,businessEntity:{select:entitySelect},orderItem:{include:{grain:true,tradeOrder:true}},modes:{include:{mode:true}},publications:{include:{targetCarrier:{select:entitySelect},recipients:{include:{carrier:{select:entitySelect}}}},orderBy:{createdAt:'desc' as const}},files:{where:{deletedAt:null},select:{id:true,name:true,mimeType:true,size:true,kind:true,createdAt:true}}} as const;
const supplyInclude={businessEntity:{select:entitySelect},mode:true,grains:{include:{grain:true}},files:{where:{deletedAt:null},select:{id:true,name:true,mimeType:true,size:true,kind:true,createdAt:true}}} as const;
const kg=(n:number)=>Math.round(n*1000),cents=(n?:number|null)=>n==null?null:Math.round(n*100);
const no=(prefix:string)=>`${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0,6).toUpperCase()}`;
const sampleScope=businessDataScope;
const page=(q:TransportQuery,total:number,items:any[])=>({page:q.page,pageSize:q.pageSize,total,items});
const paging=(q:TransportQuery)=>({skip:(q.page-1)*q.pageSize,take:q.pageSize});
@Injectable()
export class TransportService implements OnModuleInit,OnModuleDestroy {
  private timer?:NodeJS.Timeout;private expiring=false;
  constructor(private db:Database,private audit:Audit){}
  onModuleInit(){this.timer=setInterval(()=>{this.expire().catch(()=>console.warn('供给有效期检查暂时失败，将在下次请求重试'));},60000);this.timer.unref();}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  private requireRole(req:any,type:string){if(req.user.businessEntity.type!==type)throw new ForbiddenException(type==='TRADER'?'仅贸易企业可维护运输需求':'仅物流运营商可维护运输供给');}
  private checkVersion(row:any,version?:number){if(version==null||row.version!==version)throw new ConflictException('记录已更新，请刷新后重试');}
  private region(codes:string[]){if(codes.length!==3||!regions['86'][codes[0]]||!regions[codes[0]]?.[codes[1]]||!regions[codes[1]]?.[codes[2]])throw new BadRequestException('请选择有效的省、市、区县');return codes.map((c,i)=>regions[i===0?'86':codes[i-1]][c]).join(' / ');}
  private city(codes:string[]){
    if(![2,3].includes(codes.length)||!regions['86'][codes[0]]||!regions[codes[0]]?.[codes[1]])throw new BadRequestException('请选择有效的省、市');
    if(codes.length===3)this.region(codes);
    const province=regions['86'][codes[0]],city=regions[codes[0]][codes[1]];
    return {codes:codes.slice(0,2),region:['市辖区','县'].includes(city)?province:`${province} / ${city}`};
  }
  private addressRegion(address:string,codes?:string[]){
    if(codes?.length)return {codes,region:this.region(codes)};
    const text=address.trim();
    for(const [province,provinceName] of Object.entries(regions['86']))for(const [city,cityName] of Object.entries(regions[province]||{}))for(const [district,districtName] of Object.entries(regions[city]||{})){
      const prefix=(provinceName===cityName?'':provinceName)+cityName+districtName;
      if(text.startsWith(prefix)||text.startsWith(cityName+districtName))return {codes:[province,city,district],region:[provinceName,cityName,districtName].join(' / ')};
    }
    return {codes:[],region:''};
  }
  private async dictionary(ids:string[],group:string,tx:any=this.db){if(!ids.length)return;const count=await tx.dictionary.count({where:{id:{in:ids},group,enabled:true}});if(count!==ids.length)throw new BadRequestException(`${group}包含不存在或已停用的选项`);}
  private async demandPoint(point:PointDto|null|undefined,previous:PointDto|null,address:string,previousAddress:string|undefined,tx:any){
    const p=point===undefined?(address===previousAddress?previous:null):point;
    if(!p)return null;
    if(!p.name?.trim()||!Number.isFinite(p.lng)||!Number.isFinite(p.lat)||p.lng<73||p.lng>136||p.lat<3||p.lat>54||p.matchKind==='APPROXIMATE')throw new BadRequestException('请在地图确认实际装卸位置');
    if(!p.nodeId)return JSON.stringify(p);
    const node=await tx.transportNode.findFirst({where:{id:p.nodeId,enabled:true,quality:{in:['PROVIDER','VERIFIED']}}});
    if(!node)throw new BadRequestException('所选装卸节点不可用，请重新选址');
    return JSON.stringify({...p,lng:node.lng,lat:node.lat,province:node.province,city:node.city,district:node.district,matchKind:'NODE'});
  }
  private transaction<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>){return this.db.$transaction(fn,{maxWait:10000,timeout:15000,isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
  async options(req:any){
    if(!req.user.permissions.some((p:string)=>['demand:read','supply:read'].includes(p)))throw new ForbiddenException('无供需访问权限');
    const dictionaries=await this.db.dictionary.findMany({where:{group:{in:['粮食品种','运输方式']},enabled:true},orderBy:{sort:'asc'}});
    const carriers=await this.db.businessEntity.findMany({where:{type:'CARRIER',status:'ACTIVE',deletedAt:null,...sampleScope()},select:{id:true,name:true}});
    const tree=Object.entries(regions['86']).map(([value,label])=>({value,label,children:Object.entries(regions[value]||{}).map(([city,cityLabel])=>({value:city,label:cityLabel,children:Object.entries(regions[city]||{}).map(([district,districtLabel])=>({value:district,label:districtLabel}))}))}));
    const nodes=req.user.permissions.includes('demand:write')?await this.db.transportNode.findMany({where:{enabled:true,quality:{in:['PROVIDER','VERIFIED']}},orderBy:{name:'asc'},select:{id:true,name:true,lng:true,lat:true,province:true,city:true,district:true,address:true}}):[];
    return {grains:dictionaries.filter(d=>d.group==='粮食品种'),modes:dictionaries.filter(d=>d.group==='运输方式'),carriers,nodes,regions:tree,regionSource:'china-area-data 5.0.1 / 2019参考区划'};
  }
  private demandScope(req:any):Prisma.TransportDemandWhereInput {
    const u=req.user;if(u.businessEntity.type==='PLATFORM')return {};
    if(u.businessEntity.type==='TRADER')return {businessEntityId:u.businessEntityId};
    return {status:'PUBLISHED',businessEntity:{status:'ACTIVE',deletedAt:null},publications:{some:{status:'ACTIVE',deadline:{gt:new Date()},OR:[{mode:'PUBLIC'},{mode:'DIRECTED',OR:[{targetCarrierId:u.businessEntityId},{recipients:{some:{carrierId:u.businessEntityId}}}]}]}}};
  }
  private supplyScope(req:any):Prisma.TransportSupplyWhereInput {
    if(req.user.businessEntity.type==='PLATFORM')return {};
    const now=new Date();const visible:Prisma.TransportSupplyWhereInput={status:'PUBLISHED',...supplyAvailability(now),businessEntity:{status:'ACTIVE',deletedAt:null}};
    return req.user.businessEntity.type==='CARRIER'?{businessEntityId:req.user.businessEntityId}:visible;
  }
  private demandView(row:any,req:any){
    row={...row,originPoint:storedDemandPoint(row.originPoint),destinationPoint:storedDemandPoint(row.destinationPoint)};
    const result={...row,grain:row.orderItem?.grain||row.grain,cargoName:row.orderItem?.cargoName||row.cargoName,specification:row.orderItem?.specification||row.specification,quantity:row.quantityKg/1000,budget:row.budgetCents==null?null:row.budgetCents/100,originCodes:row.originCodes?row.originCodes.split('/'):[],destinationCodes:row.destinationCodes?row.destinationCodes.split('/'):[],modeIds:row.modes.map((m:any)=>m.modeId),publications:row.publications.map((p:any)=>({...p,targetCarriers:p.recipients.length?p.recipients.map((r:any)=>r.carrier):p.targetCarrier?[p.targetCarrier]:[],status:p.status==='ACTIVE'&&p.deadline<new Date()?'EXPIRED':p.status}))};
    if(req.user.businessEntity.type==='CARRIER'){
      result.publications=result.publications.filter((p:any)=>p.mode==='PUBLIC'||p.targetCarrierId===req.user.businessEntityId||p.recipients.some((r:any)=>r.carrierId===req.user.businessEntityId));const publication=result.publications.find((p:any)=>p.status==='ACTIVE');
      result.publications=result.publications.map((p:any)=>{const {snapshot,recipients,targetCarrier,targetCarrierId,...safe}=p;return {...safe,targetCarrierId:p.mode==='DIRECTED'?req.user.businessEntityId:null,targetCarriers:p.targetCarriers.filter((c:any)=>c.id===req.user.businessEntityId)};});
      delete result.orderItem;delete result.orderItemId;delete result.files;
      delete result.budget;delete result.budgetCents;
      if(!publication?.contactPublic){delete result.contact;delete result.phone;}
      result.publications=result.publications.filter((p:any)=>p.status==='ACTIVE');
    }
    return result;
  }
  private supplyView(row:any,req:any){const own=row.businessEntityId===req.user.businessEntityId||req.user.businessEntity.type==='PLATFORM';return {...row,name:row.businessEntity.name,originRegion:row.originRegion.split(' / ').slice(0,2).join(' / '),destinationRegion:row.destinationRegion.split(' / ').slice(0,2).join(' / '),loadingType:row.loadingType,bulkPrice:row.bulkPriceCents==null?null:row.bulkPriceCents/100,container20Price:row.container20PriceCents==null?null:row.container20PriceCents/100,container40Price:row.container40PriceCents==null?null:row.container40PriceCents/100,originCodes:row.originCodes?row.originCodes.split('/'):[],destinationCodes:row.destinationCodes?row.destinationCodes.split('/'):[],capacity:row.capacityKg/1000,minQuantity:row.minKg==null?null:row.minKg/1000,maxQuantity:row.maxKg==null?null:row.maxKg/1000,referencePrice:row.referencePriceCents==null?null:row.referencePriceCents/100,grainIds:row.grains.map((g:any)=>g.grainId),phone:own?row.phone:row.phone.replace(/(.{3}).*(.{4})/,'$1****$2'),files:own?row.files:row.files.filter((f:any)=>f.kind==='PHOTO')};}
  async orders(q:TransportQuery,req:any){
    if(!['TRADER','PLATFORM'].includes(req.user.businessEntity.type))throw new ForbiddenException('无权访问交易订单');
    const where:Prisma.TradeOrderItemWhereInput={tradeOrder:{status:'ACTIVE',...(req.user.businessEntity.type==='TRADER'?{businessEntityId:req.user.businessEntityId}:{}),...sampleScope()},...(q.q?{OR:[{cargoName:{contains:q.q}},{grain:{label:{contains:q.q}}},{grainGrade:{contains:q.q}},{pickupAddress:{contains:q.q}},{tradeOrder:{businessNo:{contains:q.q}}}]}:{})};
    const [total,rows]=await this.db.$transaction([this.db.tradeOrderItem.count({where}),this.db.tradeOrderItem.findMany({where,include:{grain:true,tradeOrder:{include:{businessEntity:{select:entitySelect}}}},orderBy:[{tradeOrder:{createdAt:q.order}},{tradeOrder:{businessNo:q.order}},{lineNo:'asc'}],...paging(q)})]);
    return page(q,total,rows.map(r=>({...r,grainGrade:r.grainGrade||r.specification.match(/[一二三四五]等|等外/)?.[0]||null,pickupCodes:r.pickupCodes?.split('/')||[],quantity:r.quantityKg/1000,reservedQuantity:r.reservedKg/1000,remainingQuantity:(r.quantityKg-r.reservedKg)/1000})));
  }
  async importOrder(dto:ImportOrderDto,req:any){
    if(req.user.businessEntity.type!=='PLATFORM')throw new ForbiddenException('仅平台可导入上游交易订单');
    if(new Set(dto.items.map(i=>i.lineNo)).size!==dto.items.length)throw new BadRequestException('订单明细行号不能重复');
    const entity=await this.db.businessEntity.findFirst({where:{id:dto.businessEntityId,type:'TRADER',status:'ACTIVE',deletedAt:null,...sampleScope()}});if(!entity)throw new BadRequestException('订单必须属于有效贸易主体');
    await this.dictionary([...new Set(dto.items.map(i=>i.grainId))],'粮食品种');
    for(const item of dto.items)if(item.pickupCodes)this.region(item.pickupCodes);
    const sourceDigest=createHash('sha256').update(JSON.stringify(dto,(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value)).digest('hex');
    const key={sourceSystem_sourceRecordId:{sourceSystem:dto.sourceSystem,sourceRecordId:dto.sourceRecordId}};
    const existing=await this.db.tradeOrder.findUnique({where:key});if(existing){if(existing.sourceDigest!==sourceDigest)throw new ConflictException('来源记录已存在但内容不同，不允许覆盖订单事实');return existing;}
    const {items,...fields}=dto;
    return this.transaction(async tx=>{const result=await tx.tradeOrder.create({data:{...fields,sourceDigest,isTestData:false,sourceType:'INTERNAL',items:{create:items.map(({quantity,pickupCodes,...item})=>({...item,pickupCodes:pickupCodes?.join('/'),quantityKg:kg(quantity)}))}}});await this.audit.write(tx,req,'交易订单',result.id,'导入交易订单',undefined,{businessNo:result.businessNo,sourceSystem:result.sourceSystem,itemCount:items.length});return result;});
  }
  async demands(q:TransportQuery,req:any){
    const where:Prisma.TransportDemandWhereInput={AND:[this.demandScope(req),...(q.grainId?[{OR:[{grainId:q.grainId},{orderItem:{grainId:q.grainId}}]}]:[]),...(q.origin?[{OR:[{originRegion:{contains:q.origin}},{originAddress:{contains:q.origin}}]}]:[]),...(q.destination?[{OR:[{destinationRegion:{contains:q.destination}},{destinationAddress:{contains:q.destination}}]}]:[])],deletedAt:null,...sampleScope(),...(q.status?{status:q.status}:{}),...(q.q?{OR:[{name:{contains:q.q}},{businessNo:{contains:q.q}},{cargoName:{contains:q.q}},{specification:{contains:q.q}},{orderItem:{cargoName:{contains:q.q}}}]}:{}),...(q.modeId?{modes:{some:{modeId:q.modeId}}}:{})};
    const [total,rows]=await this.db.$transaction([this.db.transportDemand.count({where}),this.db.transportDemand.findMany({where,include:demandInclude,orderBy:{createdAt:q.order},...paging(q)})]);return page(q,total,rows.map(r=>this.demandView(r,req)));
  }
  async demand(id:string,req:any,tx:any=this.db){const row=await tx.transportDemand.findFirst({where:{id,deletedAt:null,...sampleScope(),AND:[this.demandScope(req)]},include:demandInclude});if(!row)throw new NotFoundException('运输需求不存在或无权访问');return this.demandView(row,req);}
  async saveDemand(dto:DemandDto,req:any,id?:string){
    this.requireRole(req,'TRADER');await this.dictionary(dto.modeIds,'运输方式');
    if(!dto.departureAt||!dto.arrivalAt)throw new BadRequestException('计划发运时间和要求到达时间均为必填项');
    if(new Date(dto.departureAt).getTime()<=Date.now())throw new BadRequestException('计划发运时间必须晚于当前时间');
    if(new Date(dto.arrivalAt)<=new Date(dto.departureAt))throw new BadRequestException('要求到达时间必须晚于计划发运时间');
    const {modeIds,version,quantity,budget,originCodes,destinationCodes,originPoint,destinationPoint,arrivalAt,name,allowMultimodal,allowTransfer,maxTransfers,preference,orderItemId,grainId,cargoName,specification,...fields}=dto;
    return this.transaction(async tx=>{
      const old=id?await this.demand(id,req,tx):null;
      if(old){this.checkVersion(old,version);if(old.status!=='DRAFT'||old.matchedKg>0)throw new ConflictException('仅未确认承运的草稿可以编辑，请先撤回发布');}
      const item=orderItemId?await tx.tradeOrderItem.findFirst({where:{id:orderItemId,tradeOrder:{businessEntityId:req.user.businessEntityId,status:'ACTIVE',...sampleScope()}},include:{tradeOrder:true,grain:true}}):null;
      if(orderItemId&&!item)throw new NotFoundException('订单明细不存在或不属于本企业');
      let grain=item?.grain;
      if(!item){
        const selectedGrain=grainId||old?.grainId;
        if(!selectedGrain)throw new BadRequestException('手动填写需求时请选择粮食品种');
        await this.dictionary([selectedGrain],'粮食品种',tx);
        grain=await tx.dictionary.findUniqueOrThrow({where:{id:selectedGrain}});
        if(!(specification??old?.specification)?.trim())throw new BadRequestException('手动填写需求时请填写货物规格');
      }
      const sameOrder=!!item&&old?.orderItemId===item.id;
      if(item){
        const otherReserved=item.reservedKg-(sameOrder?old.quantityKg:0),available=item.quantityKg-otherReserved;
        if(kg(quantity)>item.quantityKg)throw new BadRequestException(`运输数量不能超过订单成交数量 ${item.quantityKg/1000} 吨`);
        if(kg(quantity)>available)throw new BadRequestException(`分批运输累计数量超过订单成交数量：成交 ${item.quantityKg/1000} 吨，其他批次已占用 ${otherReserved/1000} 吨，本需求最多 ${available/1000} 吨。请刷新订单余量`);
      }
      const pickupCodes=item?.pickupCodes?.split('/');
      const origin=this.addressRegion(dto.originAddress,originCodes||(dto.originAddress.trim()===item?.pickupAddress?.trim()&&pickupCodes?.length===3?pickupCodes:undefined)),destination=this.addressRegion(dto.destinationAddress,destinationCodes);
      const locations={originPoint:await this.demandPoint(originPoint,old?.originPoint,dto.originAddress,old?.originAddress,tx),destinationPoint:await this.demandPoint(destinationPoint,old?.destinationPoint,dto.destinationAddress,old?.destinationAddress,tx)};
      for(const key of ['origin','destination'] as const){const p=storedDemandPoint(locations[`${key}Point`]);if(p?.province||p?.city)(key==='origin'?origin:destination).region=[...new Set([p.province,p.city,p.district].filter(Boolean))].join(' / ');}
      const transfer=allowTransfer??old?.allowTransfer??true,transfers=maxTransfers??old?.maxTransfers??(transfer?2:0);
      if(!transfer&&transfers!==0||transfer&&transfers<1)throw new BadRequestException('中转次数与是否允许中转不一致');
      // Association changes and both order reservations commit with the demand version.
      if(old?.orderItemId&&!sameOrder){
        const released=await tx.tradeOrderItem.updateMany({where:{id:old.orderItemId,reservedKg:{gte:old.quantityKg}},data:{reservedKg:{decrement:old.quantityKg}}});
        if(released.count!==1)throw new ConflictException('订单占用不一致，请联系平台核查');
      }
      if(item){
        const delta=kg(quantity)-(sameOrder?old.quantityKg:0);
        const reserved=await tx.tradeOrderItem.updateMany({where:{id:item.id,reservedKg:delta>=0?{lte:item.quantityKg-delta}:{gte:-delta}},data:{reservedKg:{increment:delta}}});
        if(reserved.count!==1)throw new BadRequestException('本次运输数量超过订单剩余可运输数量，请刷新订单余量');
      }
      const data={...fields,...locations,orderItemId:item?.id??null,grainId:grain!.id,cargoName:item?.cargoName||(cargoName?.trim()||grain!.label),specification:item?.specification||(specification??old?.specification??'').trim(),name:name||`${grain!.label} ${quantity}吨`,quantityKg:kg(quantity),budgetCents:budget===undefined?old?.budgetCents??null:cents(budget),originCodes:origin.codes.join('/'),originRegion:origin.region,destinationCodes:destination.codes.join('/'),destinationRegion:destination.region,allowMultimodal:allowMultimodal??old?.allowMultimodal??true,allowTransfer:transfer,maxTransfers:transfers,preference:preference??old?.preference??'BALANCED',departureAt:new Date(dto.departureAt),arrivalAt:new Date(arrivalAt),updatedBy:req.user.id};
      let result;
      if(old){const updated=await tx.transportDemand.updateMany({where:{id,version,status:'DRAFT'},data:{...data,version:{increment:1}}});if(updated.count!==1)throw new ConflictException('记录已更新，请刷新');await tx.demandMode.deleteMany({where:{demandId:id}});await tx.demandMode.createMany({data:modeIds.map(modeId=>({demandId:id!,modeId}))});result=await tx.transportDemand.findUniqueOrThrow({where:{id}});}
      else result=await tx.transportDemand.create({data:{...data,businessNo:no('XQ'),businessEntityId:req.user.businessEntityId,createdBy:req.user.id,isTestData:item?.tradeOrder.isTestData??false,sourceType:item?.tradeOrder.sourceType??'INTERNAL',modes:{create:modeIds.map(modeId=>({modeId}))}}});
      await this.audit.write(tx,req,'运输需求',result.id,id?'编辑运输需求':'创建运输需求',old?{orderItemId:old.orderItemId,quantityKg:old.quantityKg,status:old.status,version:old.version}:undefined,{...data,businessNo:result.businessNo,version:result.version});return this.demand(result.id,req,tx);
    });
  }
  async demandAction(id:string,action:string,version:number,req:any,dto?:PublishDemandDto){
    this.requireRole(req,'TRADER');return this.transaction(async tx=>{
      const row=await this.demand(id,req,tx);this.checkVersion(row,version);
      let status=row.status;
      if(row.matchedKg>0)throw new ConflictException('需求已有确认承运，请在供需匹配中取消承运后再修改');
      if(action==='publish'){
        if(row.status!=='DRAFT'||!dto)throw new ConflictException('只有草稿可以发布');
        if(new Date(dto.deadline)<=new Date()||new Date(row.departureAt)<=new Date()||new Date(dto.deadline)>new Date(row.departureAt))throw new BadRequestException('响应截止时间须晚于当前时间，且不晚于计划发运时间');
        const targetCarrierIds=[...new Set([...(dto.targetCarrierIds||[]),...(dto.targetCarrierId?[dto.targetCarrierId]:[])])];
        if(dto.mode==='DIRECTED'){
          if(!targetCarrierIds.length||targetCarrierIds.length>10)throw new BadRequestException('请选择 1 至 10 家指定物流运营商');
          const carriers=await tx.businessEntity.count({where:{id:{in:targetCarrierIds},type:'CARRIER',status:'ACTIVE',deletedAt:null,...sampleScope()}});
          if(carriers!==targetCarrierIds.length)throw new BadRequestException('指定物流运营商不存在或已停用，请重新选择');
        }
        if(dto.mode==='PUBLIC'&&targetCarrierIds.length)throw new BadRequestException('公开发布不能指定物流运营商');
        if(await tx.matchPublication.count({where:{demandId:id,status:'ACTIVE'}}))throw new ConflictException('该需求已有有效发布');
        await tx.matchPublication.create({data:{businessNo:no('FB'),demandId:id,mode:dto.mode,targetCarrierId:dto.mode==='DIRECTED'?targetCarrierIds[0]:null,recipients:dto.mode==='DIRECTED'?{create:targetCarrierIds.map(carrierId=>({carrierId}))}:undefined,deadline:new Date(dto.deadline),quoteType:dto.quoteType,budgetPublic:false,contactPublic:dto.contactPublic,notes:dto.notes||'',demandVersion:row.version+1,createdBy:req.user.id,quantityKg:row.quantityKg,snapshot:JSON.stringify(demandSnapshot(row)),allowPartial:false}});status='PUBLISHED';
      }else if(action==='withdraw'){if(row.status!=='PUBLISHED')throw new ConflictException('只有已发布需求可以撤回');status='DRAFT';}
      else if(action==='cancel'||action==='delete'){if(!['DRAFT','PUBLISHED'].includes(row.status)||action==='delete'&&row.status!=='DRAFT')throw new ConflictException('当前状态不允许该操作');status='CANCELLED';if(row.orderItemId){const released=await tx.tradeOrderItem.updateMany({where:{id:row.orderItemId,reservedKg:{gte:row.quantityKg}},data:{reservedKg:{decrement:row.quantityKg}}});if(released.count!==1)throw new ConflictException('订单占用不一致，请联系平台核查');}}
      else throw new BadRequestException('不支持的需求动作');
      if(action!=='publish')await tx.matchPublication.updateMany({where:{demandId:id,status:'ACTIVE'},data:{status:'CLOSED',closedAt:new Date()}});
      const changed=await tx.transportDemand.updateMany({where:{id,version},data:{status,matchStage:action==='publish'?'WAITING':'REMATCH',version:{increment:1},updatedBy:req.user.id,...(action==='delete'?{deletedAt:new Date()}:{})}});if(changed.count!==1)throw new ConflictException('记录已更新，请刷新');
      await this.audit.write(tx,req,'运输需求',id,({publish:'发布运输需求',withdraw:'撤回需求发布',cancel:'取消运输需求',delete:'删除需求草稿'} as any)[action],{status:row.status,version},{status,version:version+1});return {id,status,version:version+1};
    });
  }
  async expire(){if(this.expiring)return;this.expiring=true;try{await this.transaction(async tx=>{const expired=await tx.transportSupply.findMany({where:{deletedAt:null,status:{in:['DRAFT','PUBLISHED','PAUSED']},OR:[{validUntil:{lte:new Date()}},{serviceEnd:{lte:new Date()}}]},take:200});for(const row of expired){const changed=await tx.transportSupply.updateMany({where:{id:row.id,version:row.version},data:{status:'EXPIRED',version:{increment:1},updatedBy:'SYSTEM'}});if(changed.count)await tx.auditLog.create({data:{userId:'SYSTEM',userName:'系统',role:'SYSTEM',businessEntityId:row.businessEntityId,ip:'',userAgent:'expiry-worker',module:'运输供给',objectId:row.id,action:'供给到期失效',before:JSON.stringify({status:row.status}),after:JSON.stringify({status:'EXPIRED'}),requestId:randomUUID()}});}});}finally{this.expiring=false;}}
  async supplies(q:TransportQuery,req:any){await this.expire();const where:Prisma.TransportSupplyWhereInput={AND:[this.supplyScope(req),...(q.grainId?[{OR:[{grains:{none:{}}},{grains:{some:{grainId:q.grainId}}}]}]:[])],deletedAt:null,...sampleScope(),...(q.status?{status:q.status}:{}),...(q.q?{OR:[{name:{contains:q.q}},{businessNo:{contains:q.q}},{businessEntity:{name:{contains:q.q}}}]}:{}),...(q.modeId?{modeId:q.modeId}:{}),...(q.origin?{originRegion:{contains:q.origin}}:{}),...(q.destination?{destinationRegion:{contains:q.destination}}:{})};const [total,rows]=await this.db.$transaction([this.db.transportSupply.count({where}),this.db.transportSupply.findMany({where,include:supplyInclude,orderBy:{createdAt:q.order},...paging(q)})]);return page(q,total,rows.map(r=>this.supplyView(r,req)));}
  async supply(id:string,req:any,tx:any=this.db){const row=await tx.transportSupply.findFirst({where:{id,deletedAt:null,...sampleScope(),AND:[this.supplyScope(req)]},include:supplyInclude});if(!row)throw new NotFoundException('运输供给不存在或无权访问');return this.supplyView(row,req);}
  async saveSupply(dto:SupplyDto,req:any,id?:string){this.requireRole(req,'CARRIER');await this.expire();await this.dictionary([dto.modeId],'运输方式');await this.dictionary(dto.grainIds,'粮食品种');
    const origin=this.city(dto.originCodes),destination=this.city(dto.destinationCodes);
    const modern=dto.loadingType!=null;
    const minimum=dto.minQuantity??(modern?null:dto.maxQuantity??dto.capacity),maximum=dto.maxQuantity??dto.capacity;
    if(minimum==null||maximum==null)throw new BadRequestException('请填写可承运数量范围的下限和上限');
    if(minimum>maximum)throw new BadRequestException('可承运数量下限不能超过上限');
    if(dto.capacity!=null&&maximum>dto.capacity)throw new BadRequestException('最大承运量不能超过可承运数量');
    const loadingType=dto.loadingType??(dto.resourceType==='CONTAINER'?'CONTAINER':'BULK');
    if(modern&&(loadingType==='BULK'?dto.bulkPrice==null:dto.container20Price==null||dto.container40Price==null))throw new BadRequestException(loadingType==='BULK'?'请填写散货报价（元/吨）':'请分别填写 20GP 和 40GP 报价（元/箱）');
    const legacyWindow=[dto.serviceStart,dto.serviceEnd,dto.validFrom,dto.validUntil];
    if(legacyWindow.some(Boolean)&&!legacyWindow.every(Boolean))throw new BadRequestException('旧版时间窗口须完整填写');
    if(legacyWindow.every(Boolean)){
      if(new Date(dto.serviceEnd!)<=new Date(dto.serviceStart!)||new Date(dto.validUntil!)<=new Date(dto.validFrom!)||new Date(dto.validUntil!)>new Date(dto.serviceEnd!))throw new BadRequestException('结束时间必须晚于开始时间，且供给有效期不能超过服务结束时间');
      if(new Date(dto.validUntil!)<=new Date())throw new BadRequestException('有效期结束时间必须晚于当前时间');
    }
    if(dto.referencePrice!=null&&!dto.priceUnit)throw new BadRequestException('填写参考价格时必须选择计价单位');
    const {version,grainIds}=dto;
    const bulkPrice=loadingType==='BULK'?(dto.bulkPrice??(dto.priceUnit==='PER_TON'?dto.referencePrice:null)):null;
    return this.transaction(async tx=>{const old=id?await this.supply(id,req,tx):null;if(old){this.checkVersion(old,version);if(!['DRAFT','PAUSED','EXPIRED'].includes(old.status))throw new ConflictException('请先暂停供给再编辑');}
      const owner=await tx.businessEntity.findUniqueOrThrow({where:{id:req.user.businessEntityId},select:{name:true}});
      const data={name:owner.name,modeId:dto.modeId,originRegion:origin.region,destinationRegion:destination.region,originCodes:origin.codes.join('/'),destinationCodes:destination.codes.join('/'),originAddress:'',destinationAddress:'',viaNodes:'',capacityKg:kg(maximum),minKg:kg(minimum),maxKg:kg(maximum),loadingType,bulkPriceCents:cents(bulkPrice),container20PriceCents:loadingType==='CONTAINER'?cents(dto.container20Price):null,container40PriceCents:loadingType==='CONTAINER'?cents(dto.container40Price):null,referencePriceCents:modern?cents(bulkPrice):cents(dto.referencePrice),priceUnit:modern?(loadingType==='BULK'?'PER_TON':null):(dto.priceUnit??null),resourceType:dto.resourceType??(loadingType==='CONTAINER'?'CONTAINER':'COMBINED'),resourceDescription:dto.resourceDescription||'',capabilities:dto.capabilities||'',serviceStart:dto.serviceStart?new Date(dto.serviceStart):null,serviceEnd:dto.serviceEnd?new Date(dto.serviceEnd):null,validFrom:dto.validFrom?new Date(dto.validFrom):null,validUntil:dto.validUntil?new Date(dto.validUntil):null,durationHours:modern?null:dto.durationHours??null,contact:dto.contact,phone:dto.phone,notes:dto.notes||'',updatedBy:req.user.id,status:old?.status==='PAUSED'?'PAUSED':'DRAFT'};
      let result;if(old){const changed=await tx.transportSupply.updateMany({where:{id,version},data:{...data,version:{increment:1}}});if(changed.count!==1)throw new ConflictException('记录已更新，请刷新');await tx.supplyGrain.deleteMany({where:{supplyId:id}});await tx.supplyGrain.createMany({data:grainIds.map(grainId=>({supplyId:id!,grainId}))});result=await tx.transportSupply.findUniqueOrThrow({where:{id}});}else result=await tx.transportSupply.create({data:{...data,businessNo:no('GY'),businessEntityId:req.user.businessEntityId,createdBy:req.user.id,isTestData:false,sourceType:'INTERNAL',grains:{create:grainIds.map(grainId=>({grainId}))}}});
      await this.audit.write(tx,req,'运输供给',result.id,id?'编辑运输供给':'创建运输供给',old?{status:old.status,version:old.version}:undefined,{...data,version:result.version});return this.supply(result.id,req,tx);
    });
  }
  async supplyAction(id:string,action:string,version:number,req:any){this.requireRole(req,'CARRIER');await this.expire();return this.transaction(async tx=>{const row=await this.supply(id,req,tx);this.checkVersion(row,version);let status=row.status;
      if(row.matchedKg>0)throw new ConflictException('需求已有确认承运，请在供需匹配中取消承运后再修改');
    if(action==='publish'){if(!['DRAFT','PAUSED'].includes(row.status)||row.validUntil&&new Date(row.validUntil)<=new Date()||row.serviceEnd&&new Date(row.serviceEnd)<=new Date())throw new ConflictException('当前供给不可发布，请检查状态与有效期');status='PUBLISHED';}
    else if(action==='pause'){if(row.status!=='PUBLISHED')throw new ConflictException('只有已发布供给可以暂停');status='PAUSED';}
    else if(action==='expire'){if(row.status==='EXPIRED')throw new ConflictException('供给已经失效');status='EXPIRED';}
    else if(action==='delete'){if(row.status==='PUBLISHED')throw new ConflictException('请先暂停供给再删除');}
    else throw new BadRequestException('不支持的供给动作');
    const changed=await tx.transportSupply.updateMany({where:{id,version},data:{status,version:{increment:1},updatedBy:req.user.id,...(action==='delete'?{deletedAt:new Date()}:{})}});if(changed.count!==1)throw new ConflictException('记录已更新，请刷新');
    await this.audit.write(tx,req,'运输供给',id,({publish:'发布运输供给',pause:'暂停运输供给',expire:'终止供给有效期',delete:'删除运输供给'} as any)[action],{status:row.status,version},{status,version:version+1});return {id,status,version:version+1};});}
  async history(kind:'demand'|'supply',id:string,req:any){if(kind==='demand')await this.demand(id,req);else{await this.expire();await this.supply(id,req);}return this.db.auditLog.findMany({where:{objectId:id,module:kind==='demand'?'运输需求':'运输供给'},orderBy:{createdAt:'desc'},take:100,select:{id:true,userName:true,action:true,createdAt:true,requestId:true}});}
}
