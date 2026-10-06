import {Injectable,ServiceUnavailableException,BadRequestException,Controller,Get,Query,Req,Res,ForbiddenException} from '@nestjs/common';
import {ApiTags,ApiBearerAuth,ApiPropertyOptional} from '@nestjs/swagger';
import {createHash,randomUUID} from 'node:crypto';
import {Response} from 'express';
import {secureCookie} from './runtime-config';
import {mapCallback,mapResponseType} from './map-proxy-response';
import {Database} from './database';
import {Public,publicUser,userInclude} from './security';
import {Type} from 'class-transformer';
import {IsNumber,Min,Max,IsString,IsOptional,Length} from 'class-validator';
export class MapSearchQuery {
 @ApiPropertyOptional() @IsOptional() @IsString() @Length(0,200) q?:string;
}
export class MapLocationQuery {
 @Type(()=>Number) @IsNumber() @Min(73) @Max(136) lng!:number;
 @Type(()=>Number) @IsNumber() @Min(3) @Max(54) lat!:number;
}
const mapPermissions=['plan:read','tracking:read','demand:write'];
export const hash=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function meters(a:any,b:any){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlng=(b.lng-a.lng)*r;const x=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
@Injectable()
export class AmapService {
 private queue:Promise<any>=Promise.resolve();private flights=new Map<string,Promise<any>>();
 readonly tickets=new Map<string,{userId:string,sessionId:string,expires:number}>();
 constructor(private db:Database){}
 async request(path:string,params:Record<string,string>){
  const key=process.env.AMAP_WEB_SERVICE_KEY;if(!key)throw new ServiceUnavailableException('未配置高德 Web 服务，请联系平台维护');
  const perform=async()=>{await new Promise(r=>setTimeout(r,650));for(let attempt=0;attempt<2;attempt++)try{const url=new URL('https://restapi.amap.com'+path);url.search=new URLSearchParams({...params,key}).toString();const response=await fetch(url,{signal:AbortSignal.timeout(18000),redirect:'error'});if(!response.ok)throw new Error();const result:any=await response.json();if(result.status==='1')return result;if(result.infocode==='10021'&&attempt===0){await new Promise(r=>setTimeout(r,1200));continue;}throw new ServiceUnavailableException(`高德服务暂不可用（${String(result.infocode).replace(/[^0-9]/g,'').slice(0,8)}），请稍后重试或检查服务授权`);}catch(e){if(e instanceof ServiceUnavailableException)throw e;throw new ServiceUnavailableException('高德请求超时或网络不可用，请重试');}};
  const task=this.queue.then(perform,perform);this.queue=task.catch(()=>{});return task;
 }
 async search(q:string){if(q.trim().length<2)throw new BadRequestException('请输入至少两个字的地点名称');const data=await this.request('/v3/place/text',{keywords:q,offset:'10',extensions:'base'});return (data.pois||[]).filter((p:any)=>p.location).map((p:any)=>{const [lng,lat]=p.location.split(',').map(Number);return {name:p.name,lng,lat,province:p.pname,city:p.cityname,district:p.adname,address:typeof p.address==='string'?p.address:'',sourceRef:p.id,source:'AMAP_POI',typecode:p.typecode};});}
 async locate(address:string,city=''){
  const text=address.trim().replace(/\s|\//g,'');if(text.length<2||text.length>200)throw new BadRequestException('请输入2至200字的地址');
  const data=await this.request('/v3/geocode/geo',{address:text,...(city?{city}: {})});
  const found=(data.geocodes||[]).filter((p:any)=>p.location&&(!city||p.city===city||p.province===city));
  let approximate:any=null;
  if(found.length===1){const p=found[0], [lng,lat]=p.location.split(',').map(Number);const result={name:address,lng,lat,province:p.province,city:p.city,district:p.district,adcode:p.adcode,matchedAddress:p.formatted_address,matchLevel:p.level,matchKind:['国家','省','市','区县'].includes(p.level)?'APPROXIMATE':'GEOCODE'};if(result.matchKind!=='APPROXIMATE')return result;approximate=result;}
  const pois=await this.search(text);const relevant=pois.filter((p:any)=>(!city||p.city===city)&&text.includes(p.name));
  if(relevant.length===1)return {...relevant[0],name:address,matchedAddress:relevant[0].name+' '+relevant[0].address,matchKind:'POI'};
  return approximate;
 }
 async reverse(lng:number,lat:number){
  if(!Number.isFinite(lng)||!Number.isFinite(lat)||lng<73||lng>136||lat<3||lat>54)throw new BadRequestException('请选择有效地图位置');
  const data=await this.request('/v3/geocode/regeo',{location:`${lng.toFixed(6)},${lat.toFixed(6)}`,extensions:'base'});
  const result=data.regeocode,parts=result?.addressComponent;
  if(!result?.formatted_address||!parts)throw new ServiceUnavailableException('未获取到地址，请补充装卸点名称');
  const text=(value:any)=>typeof value==='string'?value:'';
  return {lng,lat,name:result.formatted_address.slice(0,160),matchedAddress:result.formatted_address.slice(0,200),province:text(parts.province),city:text(parts.city)||text(parts.province),district:text(parts.district),adcode:text(parts.adcode),matchKind:'MAP'};
 }
 async routes(origin:any,destination:any){const cacheKey=hash({origin:[origin.lng,origin.lat].map(n=>n.toFixed(6)),destination:[destination.lng,destination.lat].map(n=>n.toFixed(6)),profile:'AMAP_DRIVING_GENERAL',strategy:32,v:1});const cached=await this.db.routeGeometry.findMany({where:{cacheKey,expiresAt:{gt:new Date()}},orderBy:{pathIndex:'asc'}});if(cached.length)return cached;
  const pending=this.flights.get(cacheKey);if(pending)return pending;
  const task=(async()=>{const data=await this.request('/v5/direction/driving',{origin:`${origin.lng.toFixed(6)},${origin.lat.toFixed(6)}`,destination:`${destination.lng.toFixed(6)},${destination.lat.toFixed(6)}`,strategy:'32',show_fields:'cost,polyline'});const records:any[]=[],seen=new Set<string>();for(const [index,path] of (data.route?.paths||[]).slice(0,5).entries()){
   const coordinates:number[][]=[];for(const step of path.steps||[])for(const text of (step.polyline||'').split(';')){const point=text.split(',').map(Number);if(point.length===2&&point.every(Number.isFinite)&&(!coordinates.length||point[0]!==coordinates.at(-1)![0]||point[1]!==coordinates.at(-1)![1]))coordinates.push(point);}
   const distanceMeters=Math.round(Number(path.distance)),durationSeconds=Math.round(Number(path.cost?.duration));if(coordinates.length<3||!distanceMeters||!durationSeconds)continue;
   const checksum=hash(coordinates);if(seen.has(checksum))continue;seen.add(checksum);records.push({cacheKey,pathIndex:index,mode:'ROAD',routeProfile:'AMAP_DRIVING_GENERAL',coordinates:JSON.stringify(coordinates),distanceMeters,durationSeconds,source:'AMAP_V5_DRIVING',sourceRef:'https://lbs.amap.com/api/webservice/guide/api/newroute',expiresAt:new Date(Date.now()+86400000),checksum,steps:JSON.stringify(path.steps.map((s:any)=>({instruction:s.instruction,road:s.road||'',distance:s.step_distance||0})))});
  }if(!records.length)throw new ServiceUnavailableException('高德未返回可用道路路径，请调整起讫点');return this.db.$transaction(records.map(data=>this.db.routeGeometry.create({data})));})();this.flights.set(cacheKey,task);try{return await task;}finally{this.flights.delete(cacheKey);}
 }
}
@ApiTags('地图与地点') @ApiBearerAuth() @Controller()
export class MapController {
 constructor(private service:AmapService,private db:Database){}
 @Get('map/config') config(@Req() req:any,@Res({passthrough:true}) res:Response){
  if(!req.user.permissions.some((p:string)=>mapPermissions.includes(p)))throw new ForbiddenException('无权使用地图');
  if(!process.env.AMAP_JSAPI_KEY||!process.env.AMAP_SECURITY_JS_CODE)throw new ServiceUnavailableException('地图凭据未配置');
  for(const [key,t] of this.service.tickets)if(t.expires<Date.now())this.service.tickets.delete(key);
    if(this.service.tickets.size>=5000)throw new ServiceUnavailableException('地图会话繁忙，请稍后再试');const ticket=randomUUID();this.service.tickets.set(ticket,{userId:req.user.id,sessionId:req.sessionId,expires:Date.now()+1800000});res.cookie('amap_session',ticket,{httpOnly:true,sameSite:'strict',secure:secureCookie(req),path:'/',maxAge:1800000});return {key:process.env.AMAP_JSAPI_KEY,serviceHost:'/_AMapService',coordinateSystem:'GCJ02'};
 }
 private pointAccess(req:any){if(!req.user.permissions.some((p:string)=>['plan:read','demand:write'].includes(p)))throw new ForbiddenException('无权选择地图位置');}
 @Get('map/search') search(@Query() q:MapSearchQuery,@Req() req:any){this.pointAccess(req);return this.service.search(q.q||'');}
 @Get('map/resolve') resolve(@Query() q:MapSearchQuery,@Req() req:any){this.pointAccess(req);return this.service.locate(q.q||'');}
 @Get('map/reverse') reverse(@Query() q:MapLocationQuery,@Req() req:any){this.pointAccess(req);return this.service.reverse(q.lng,q.lat);}
 @Public() @Get('_AMapService/*path') async proxy(@Req() req:any,@Res() res:Response){
  const ticket=this.service.tickets.get(req.cookies?.amap_session);if(!ticket||ticket.expires<Date.now())throw new ForbiddenException('地图会话失效，请刷新地图');
  const session=await this.db.refreshToken.findUnique({where:{id:ticket.sessionId},include:{user:{include:userInclude}}});if(!session||session.userId!==ticket.userId||session.user.mustChangePassword||!publicUser(session.user).permissions.some((p:any)=>mapPermissions.includes(String(p)))||session.revokedAt||session.expiresAt<new Date()||session.user.status!=='ACTIVE'||session.user.deletedAt||session.user.businessEntity.status!=='ACTIVE'||session.user.businessEntity.deletedAt)throw new ForbiddenException('地图会话失效');
  const url=new URL(req.originalUrl,'http://local');const path=url.pathname.replace(/^\/(?:api\/)?_AMapService/,'');if(!/^\/v4\/map\/styles(?:\/[^.\/]*)?$/.test(path)&&path!=='/v3/log/init')throw new ForbiddenException('未开放的地图代理路径');
  const callback=mapCallback(url);
  const target=new URL(path,path.startsWith('/v4/map/styles')?'https://webapi.amap.com':'https://restapi.amap.com');target.search=url.search;target.searchParams.set('key',process.env.AMAP_JSAPI_KEY!);target.searchParams.set('jscode',process.env.AMAP_SECURITY_JS_CODE!);
  try{const response=await fetch(target,{headers:{Referer:req.get('referer')||`${req.protocol}://${req.get('host')}/`},signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)throw new Error();const body=Buffer.from(await response.arrayBuffer());res.type(mapResponseType(body,callback,response.headers.get('content-type')));res.send(body);}catch{throw new ServiceUnavailableException('地图底图服务不可用，请重试');}
 }
}

