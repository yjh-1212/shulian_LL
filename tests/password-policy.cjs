const assert=require('node:assert/strict');
const {validateSync}=require('class-validator');
const {plainToInstance}=require('class-transformer');
const {PasswordDto,ResetPasswordDto,UserDto}=require('../apps/api/dist/dto');

for(const password of ['123456','abcdef','a1b2c3','shulian']){
 for(const [Dto,data] of [[PasswordDto,{currentPassword:'old-password',newPassword:password}],[ResetPasswordDto,{newPassword:password}],[UserDto,{username:'policy.user',displayName:'密码规则验证',businessEntityId:'carrier-a',roleIds:['driver-role'],status:'ACTIVE',password}]]){
  assert.equal(validateSync(plainToInstance(Dto,data)).length,0,Dto.name+' should allow six characters without composition rules');
 }
}
for(const password of ['12345','abcde','a'.repeat(73)]){
 for(const Dto of [PasswordDto,ResetPasswordDto])assert(validateSync(plainToInstance(Dto,{currentPassword:'old-password',newPassword:password})).length>0);
 assert(validateSync(plainToInstance(UserDto,{username:'policy.user',displayName:'密码规则验证',businessEntityId:'carrier-a',roleIds:['driver-role'],status:'ACTIVE',password})).some(e=>e.property==='password'));
}
console.log('PASS password DTOs accept six digits or six letters and reject fewer than six or more than 72 characters');

if(process.env.PASSWORD_POLICY_ORIGIN){
 const base=process.env.PASSWORD_POLICY_ORIGIN;
 assert(process.env.PASSWORD_POLICY_ADMIN_PASSWORD,'Provide isolated test admin password');
 async function call(path,body,token){const r=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:(await r.json()).data};}
 (async()=>{
  const login=await call('/auth/login',{username:'admin',password:process.env.PASSWORD_POLICY_ADMIN_PASSWORD});assert.equal(login.status,201);const admin=login.data.accessToken;
  const fixed=await call('/driver/login',{username:'driver',password:process.env.PASSWORD_POLICY_ADMIN_PASSWORD});assert.equal(fixed.status,201);assert.equal(fixed.data.user.mustChangePassword,false);
  assert.equal((await call('/auth/login',{username:'driver',password:process.env.PASSWORD_POLICY_ADMIN_PASSWORD})).status,403);
  const tasks=await call('/driver/tasks',null,fixed.data.accessToken);assert.equal(tasks.status,200);
  const options=(await call('/users/options',null,admin)).data;
  const outcomes=[];
  for(const [roleCode,entityType,audience] of [['trader_admin','TRADER','auth'],['driver','CARRIER','driver']]){
   const role=options.roles.find(r=>r.code===roleCode),entity=options.entities.find(e=>e.type===entityType);
   const username='pw.'+audience+'.'+Date.now();
   const body={username,displayName:'密码规则验证',businessEntityId:entity.id,roleIds:[role.id],status:'ACTIVE',password:'abcdef'};
   assert.equal((await call('/users',{...body,password:'abcde'},admin)).status,400);
   const created=await call('/users',body,admin);assert.equal(created.status,201);
   let first=await call('/'+audience+'/login',{username,password:'abcdef'});assert.equal(first.status,201);
   assert.equal((await call('/'+audience+'/password',{currentPassword:'abcdef',newPassword:'12345'},first.data.accessToken)).status,400);
   assert.equal((await call('/'+audience+'/password',{currentPassword:'abcdef',newPassword:'123456'},first.data.accessToken)).status,201);
   let second=await call('/'+audience+'/login',{username,password:'123456'});assert.equal(second.status,201);assert.equal(second.data.user.mustChangePassword,false);
   assert.equal((await call('/users/'+created.data.id+'/reset-password',{newPassword:'qwerty'},admin)).status,201);
   assert.equal((await call('/'+audience+'/me',null,second.data.accessToken)).status,401);
   const reset=await call('/'+audience+'/login',{username,password:'qwerty'});assert.equal(reset.status,201);assert.equal(reset.data.user.mustChangePassword,true);
   assert.equal((await call('/'+audience+'/password',{currentPassword:'qwerty',newPassword:'654321'},reset.data.accessToken)).status,201);
   assert.equal((await call('/'+audience+'/login',{username,password:'654321'})).status,201);
   outcomes.push({audience,createSixLetters:true,changeSixDigits:true,resetSixLetters:true,rejectFive:true,oldSessionRevoked:true});
  }
  console.log(JSON.stringify({passed:true,fixedDriverLogin:true,driverPcLoginRejected:true,driverTasks:tasks.data.length,outcomes}));
 })().catch(e=>{console.error(e.message);process.exitCode=1;});
}
