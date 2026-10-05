import { Controller, Get, Req, Query, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Database } from './database';
import { Permit, entityScope } from './security';
import { ListDto } from './dto';
import {businessDataScope} from './business-data-scope';
import {workbench} from './workbench';
@ApiTags('工作空间') @ApiBearerAuth() @Controller()
export class WorkspaceController {
  constructor(private db:Database){}
  @Get('menus') async menus(@Req() req:any) {
    const all=await this.db.menu.findMany({where:{enabled:true},orderBy:{displayOrder:'asc'}});
    // 联运服务始终是一个入口，兼容尚未更新菜单种子的数据库。
    for(const m of all)if(m.path==='/services')m.label='联运服务';
    const type=req.user.businessEntity.type;
    for(const m of all)if(m.path==='/'){m.label='首页';m.icon='house';}
    if(!all.some(m=>m.path==='/workbench'))all.push({id:'workbench',label:'工作台',path:'/workbench',icon:'dashboard',permissionCode:'home:read',parentId:null,displayOrder:1.5,overflowPriority:0,phase:1,enabled:true});
    if(!all.some(m=>m.path==='/system/vessels'))all.push({id:'vessels',label:'船舶档案',path:'/system/vessels',icon:'ship',permissionCode:'tracking:read',parentId:'system',displayOrder:4,overflowPriority:0,phase:6,enabled:true});
    const navOrder=(m:any)=>m.path==='/'?-2:m.path==='/workbench'?-1:m.displayOrder;
    all.sort((a,b)=>navOrder(a)-navOrder(b));
    const can=(m:any)=>req.user.permissions.includes(m.permissionCode)&&(!['users','roles','entities','dictionaries','logs','contract-template'].includes(m.permissionCode.split(':')[0])||type==='PLATFORM')&&!(type==='TRADER'&&['/supply-demand/supplies','/system/vessels'].includes(m.path));
    return all.filter(m=>!m.parentId).map(m=>({...m,available:m.phase<=9,children:all.filter(c=>c.parentId===m.id&&can(c)).map(c=>({...c,available:c.phase<=9}))})).filter(m=>can(m)||m.children.length).flatMap(m=>{
      if(m.path==='/services')return [{...m,label:'联运服务',children:[]}];
      if(m.path==='/data')return [{...m,label:'数据服务',children:[]}];
      if(m.path==='/tracking')return [{...m,children:m.children.filter(c=>['/tracking/journeys','/tracking/themes'].includes(c.path))}];
      if(m.path!=='/supply-demand'||!['TRADER','CARRIER'].includes(type))return [m];
      const entry=m.children.find(c=>c.path===(type==='TRADER'?'/supply-demand/demands':'/supply-demand/supplies'));
      return entry?[{...m,label:entry.label,path:entry.path,icon:entry.icon,permissionCode:entry.permissionCode,phase:entry.phase,available:entry.available,children:[]}]:[];
    });
  }
  @Get('workspace/entities') @Permit('home:read') entities(@Req() req:any,@Query() q:ListDto) {
    return this.db.businessEntity.findMany({where:{...entityScope(req.user,q.businessEntityId),deletedAt:null,...businessDataScope()},select:{id:true,name:true,type:true,status:true,isTestData:true}});
  }
  @Get('dashboard') @Permit('home:read') async dashboard(@Req() req:any) {
    const platform=req.user.businessEntity.type==='PLATFORM';
    const userWhere={deletedAt:null,...businessDataScope(),...(platform?{}:{businessEntityId:req.user.businessEntityId})};
    const logWhere=platform?{}:{businessEntityId:req.user.businessEntityId};
    const [users,entities,roles,logins,recent]=await this.db.$transaction([
      this.db.user.count({where:userWhere}),
      this.db.businessEntity.count({where:{...entityScope(req.user),deletedAt:null,...businessDataScope()}}),
      this.db.role.count({where:platform?{}:{entityType:req.user.businessEntity.type}}),
      this.db.loginLog.count({where:{...logWhere,success:true,createdAt:{gte:new Date(Date.now()-86400000)}}}),
      this.db.auditLog.findMany({where:logWhere,orderBy:{createdAt:'desc'},take:6,select:{id:true,userName:true,action:true,module:true,createdAt:true}})
    ]);
    return {scope:platform?'平台全局':'本企业',users,entities,roles,logins,recent,phase:9,asOf:new Date().toISOString()};
  }
  @Get('dashboard/workbench') @Permit('home:read') overview(@Req() req:any){return workbench(this.db,req.user);}
}
