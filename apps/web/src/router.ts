import { createRouter,createWebHistory } from 'vue-router';
import {driverUrl} from './driver-url';
import { useAuth } from './stores/auth';
import Login from './views/Login.vue';
import Home from './views/Home.vue';
import Admin from './views/Admin.vue';
import Account from './views/Account.vue';
import Access from './views/Access.vue';
import Transport from './views/Transport.vue';
export const router=createRouter({history:createWebHistory(),routes:[
  ...[['bills','账单管理'],['reconciliations','对账管理'],['settlements','结算管理']].map(([key,title])=>({path:`/billing/${key}`,component:()=>import('./views/Billing.vue'),meta:{title,permission:'billing:read'}})),
  {path:'/data',component:()=>import('./views/DataService.vue'),meta:{title:'数据服务',permission:'data:read'}},
  ...['products','authorizations','subscriptions','applications'].map(key=>({path:`/data/${key}`,redirect:()=>({path:'/data',query:{tab:key==='applications'?'scenarios':key==='authorizations'?'authorizations':key==='subscriptions'?'subscriptions':'catalog'}})})),
  ...[['journeys','全程跟踪'],['themes','专题视图']].map(([key,title])=>({path:`/tracking/${key}`,component:()=>import('./views/Tracking.vue'),meta:{title,permission:'tracking:read',mapWorkspace:true}})),
  ...['overview','alerts'].map(key=>({path:`/tracking/${key}`,redirect:(to:any)=>({path:'/tracking/journeys',query:to.query})})),
  {path:'/system/vessels',component:()=>import('./views/Vessels.vue'),meta:{title:'船舶档案',permission:'tracking:read',entityTypes:['PLATFORM','CARRIER']}},
  {path:'/driver',component:()=>import('./views/Driver.vue'),meta:{title:'司机任务',driver:true}},
  ...[['templates','合同模板管理'],['signing','合同签署管理'],['performance','合同履约管理'],['archives','合同档案管理']].map(([key,title])=>({path:`/contracts/${key}`,component:key==='templates'?()=>import('./views/ContractTemplates.vue'):()=>import('./views/Contracts.vue'),meta:{title,permission:key==='templates'?'contract-template:read':'contract:read'}})),
  {path:'/services/:id/tracking',component:()=>import('./views/IntermodalTracking.vue'),meta:{title:'运单跟踪',permission:'service:read'}},
  {path:'/services',component:()=>import('./views/Fulfillment.vue'),meta:{title:'联运服务',permission:'service:read'}},
  ...['organizations','containers','tracking'].map(key=>({path:`/services/${key}`,redirect:(to:any)=>({path:'/services',query:to.query})})),
  {path:'/login',component:Login,meta:{title:'登录'}},
  {path:'/',component:()=>import('./views/Portal.vue'),meta:{title:'首页',public:true}},
  {path:'/workbench',component:Home,meta:{title:'工作台',permission:'home:read',workbench:true}},
  {path:'/supply-demand/demands',component:Transport,meta:{title:'运输需求管理',permission:'demand:read',kind:'demand'}},
  {path:'/supply-demand/supplies',component:Transport,meta:{title:'运输供给管理',permission:'supply:read',kind:'supply',entityTypes:['PLATFORM','CARRIER']}},
  ...[['users','用户管理'],['roles','角色权限'],['dictionaries','数据字典'],['entities','合作主体'],['logs','日志管理']].map(([key,title])=>({path:`/system/${key}`,component:Admin,meta:{title,permission:`${key}:read`,section:key}})),
  {path:'/matches',component:()=>import('./views/Matches.vue'),meta:{title:'供需匹配',permission:'match:read'}},
  {path:'/agents',component:()=>import('./views/AgentCenter.vue'),meta:{title:'辽粮智运智能体中心',agentCenter:true}},
  {path:'/plans/solve',component:()=>import('./views/Planning.vue'),meta:{title:'方案求解',permission:'plan:read'}},
  {path:'/plans/prices',component:()=>import('./views/RoutePrices.vue'),meta:{title:'线路价格',permission:'plan:read'}},
  {path:'/account',component:Account,meta:{title:'账号设置'}},
  {path:'/forbidden',component:Access,meta:{title:'访问受限'}},
  {path:'/:pathMatch(.*)*',component:Access,meta:{title:'页面不可用'}}
]});
router.beforeEach(async to=>{
  if(to.meta.driver){location.replace(driverUrl);return false;}
  document.title=`${String(to.meta.title||'工作台')} · 辽粮智运`;
  if(to.meta.public)return;
  const auth=useAuth();await auth.init();
  if(!auth.user&&to.path!=='/login')return '/login';
  if(auth.user&&to.path==='/login')return auth.user.mustChangePassword?'/account':'/workbench';
  if(auth.user?.mustChangePassword&&to.path!=='/account')return '/account';
  if(auth.user&&Array.isArray(to.meta.entityTypes)&&!to.meta.entityTypes.includes(auth.user.businessEntity.type))return '/forbidden';
  if(to.meta.agentCenter&&!auth.can('plan:read')&&!auth.can('tracking:read'))return '/forbidden';
  if(to.meta.permission&&!auth.can(String(to.meta.permission)))return '/forbidden';
});
