const test=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {hash}=require('bcryptjs');
const {AuthService}=require('../apps/api/dist/auth');

function fixture(overrides={}){
 const user={id:'trader-id',username:'trader',tokenVersion:3,status:'ACTIVE',deletedAt:null,isTestData:false,mustChangePassword:false,businessEntityId:'trader-entity',businessEntity:{type:'TRADER',status:'ACTIVE',deletedAt:null},roles:[{role:{id:'trader-role',code:'trader_admin',name:'贸易企业管理员',permissions:[{permission:{code:'home:read'}}]}}],...overrides};
 const calls={logs:[],sessions:[],updates:[],cookies:[],lookups:[]};
 const db={user:{findUnique:async query=>{calls.lookups.push(query.where);return user;},update:async query=>{calls.updates.push(query);return user;}},loginLog:{create:async query=>{calls.logs.push(query.data);}},refreshToken:{create:async query=>{calls.sessions.push(query.data);return {id:'session-id'};}}};
 const jwt={signAsync:async (claims,options)=>{calls.claims=claims;calls.jwtOptions=options;return 'signed-access-token';}};
 const req={ip:'127.0.0.1',headers:{'user-agent':'portal-entry-test'},requestId:'test-request',secure:false};
 const res={cookie:(...args)=>calls.cookies.push(args)};
 return {service:new AuthService(db,jwt,{}),req,res,calls,user};
}

test('首页入口只为 trader 建立有效的 Web 会话，密码不参与前端请求',async()=>{
 const {service,req,res,calls}=fixture();
 req.body={username:'admin',password:'ignored'};
 const result=await service.experience(req,res);
 assert.deepEqual(calls.lookups,[{username:'trader'}]);
 assert.equal(result.user.username,'trader');
 assert.deepEqual(result.user.permissions,['home:read']);
 assert.equal(result.accessToken,'signed-access-token');
 assert.equal(calls.sessions[0].userId,'trader-id');
 assert.equal(calls.sessions[0].audience,'grain-web');
 assert.equal(calls.sessions[0].tokenHash.length,64);
 assert.equal(calls.cookies[0][0],'grain_refresh');
 assert.equal(calls.cookies[0][2].httpOnly,true);
 assert.equal(calls.cookies[0][2].path,'/api/auth');
 assert.equal(calls.jwtOptions.audience,'grain-web');
 assert.equal(calls.logs[0].success,true);
 assert.ok(!JSON.stringify(result).includes('passwordHash'));
});

test('默认账号或所属企业不可用时拒绝自动登录，不创建会话',async()=>{
 const cases=[{status:'DISABLED'},{deletedAt:new Date()},{mustChangePassword:true},{businessEntity:{type:'PLATFORM',status:'ACTIVE'}},{businessEntity:{type:'TRADER',status:'DISABLED'}},{businessEntity:{type:'TRADER',status:'ACTIVE',deletedAt:new Date()}},{roles:[{role:{code:'driver'}}]}];
 for(const overrides of cases){const {service,req,res,calls}=fixture(overrides);await assert.rejects(service.experience(req,res),/默认 trader 账号暂不可用/);assert.equal(calls.sessions.length,0);assert.equal(calls.cookies.length,0);assert.equal(calls.logs[0].success,false);}
});

test('原有账号密码登录继续验证密码并使用正常 Web 会话',async()=>{
 const passwordHash=await hash('shulian',4);
 const {service,req,res,calls}=fixture({passwordHash});
 await assert.rejects(service.login({username:'trader',password:'incorrect'},req,res),/账号或密码错误/);
 assert.equal(calls.sessions.length,0);
 const result=await service.login({username:'trader',password:'shulian'},req,res);
 assert.equal(result.user.username,'trader');
 assert.equal(calls.sessions.length,1);
});
