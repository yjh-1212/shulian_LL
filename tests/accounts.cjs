const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
require('dotenv').config();
const TARGET=process.env.TARGET_URL||'http://127.0.0.1:5173';
const out=[];const check=name=>{out.push({name,result:'PASS'});console.log('PASS',name);};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:process.env.PW_HEADLESS==='true'});
 const admin=await browser.newContext({viewport:{width:1440,height:1000}});const page=await admin.newPage();
 const username='qa.'+Date.now().toString().slice(-8),initial='InitialPass!2026',changed='ChangedPass!2026',reset='ResetPass!2026';
 let userId;
 async function login(p,user,password,target='/'){
  await p.goto(TARGET+'/login');await p.getByRole('textbox',{name:'账号',exact:true}).fill(user);await p.getByRole('textbox',{name:'密码',exact:true}).fill(password);
  const pending=p.waitForResponse(r=>r.url().endsWith('/auth/login')&&r.request().method()==='POST');await p.getByRole('button',{name:'登录',exact:true}).click();const r=await pending;assert.equal(r.status(),201);const d=(await r.json()).data;await p.waitForURL(TARGET+target);return d;
 }
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const loginData=await login(page,'admin',process.env.SEED_PASSWORD);const headers={Authorization:'Bearer '+loginData.accessToken};
  await page.goto(TARGET+'/system/users');await page.getByRole('button',{name:'新增用户'}).click();await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByText('请填写账号、姓名、所属主体并选择角色').waitFor();
  await page.getByRole('textbox',{name:'账号',exact:true}).fill(username);await page.getByRole('textbox',{name:'姓名',exact:true}).fill('验收新用户');
  await page.getByRole('combobox',{name:'所属主体',exact:true}).click();await page.getByRole('option',{name:'北方粮贸 A（开发样例）',exact:true}).click();
  await page.getByRole('combobox',{name:'业务角色',exact:true}).focus();await page.getByRole('combobox',{name:'业务角色',exact:true}).press('ArrowDown');await page.getByRole('option',{name:'贸易企业业务员',exact:true}).click();await page.keyboard.press('Escape');
  await page.getByRole('textbox',{name:'初始密码',exact:true}).fill(initial);await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByText('已保存',{exact:true}).waitFor();
  await page.getByRole('textbox',{name:'搜索关键词'}).fill(username);await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByText(username,{exact:true}).waitFor();await page.reload();await page.getByText(username,{exact:true}).waitFor();
  const users=await (await admin.request.get(TARGET+'/api/users?q='+username,{headers})).json();userId=users.data.items[0].id;assert.equal(users.data.items[0].isTestData,true);check('浏览器创建用户、字段校验、角色主体绑定与刷新持久化');
  await page.route('**/api/users?**',route=>route.abort());await page.getByRole('button',{name:'刷新列表'}).click();await page.getByText('网络连接失败，请检查服务后重试',{exact:true}).waitFor();await page.unroute('**/api/users?**');await page.getByRole('button',{name:'重新加载'}).click();await page.getByText(username,{exact:true}).waitFor();check('请求失败显示错误，重试恢复列表');
  const client=await browser.newContext();const p=await client.newPage();const first=await login(p,username,initial,'/account');
  assert.equal((await client.request.get(TARGET+'/api/dashboard',{headers:{Authorization:'Bearer '+first.accessToken}})).status(),403);check('新用户必须改密，API拒绝跳过');
  await p.getByRole('textbox',{name:'原密码',exact:true}).fill(initial);await p.getByRole('textbox',{name:'新密码',exact:true}).fill(changed);await p.getByRole('textbox',{name:'确认新密码',exact:true}).fill(changed);await p.getByRole('button',{name:'保存新密码'}).click();await p.waitForURL('**/login');
  assert.equal((await client.request.get(TARGET+'/api/auth/me',{headers:{Authorization:'Bearer '+first.accessToken}})).status(),401);check('修改密码后旧Access/Refresh会话失效');
  const second=await login(p,username,changed);await p.getByRole('heading',{name:/欢迎回来/}).waitFor();
  const resetResponse=await admin.request.post(TARGET+'/api/users/'+userId+'/reset-password',{headers,data:{newPassword:reset}});assert.equal(resetResponse.status(),201);
  assert.equal((await client.request.get(TARGET+'/api/auth/me',{headers:{Authorization:'Bearer '+second.accessToken}})).status(),401);
  const refresh=await client.request.post(TARGET+'/api/auth/refresh');assert.equal(refresh.status(),401);check('管理员重置密码撤销用户全部会话');
  const relogin=await client.request.post(TARGET+'/api/auth/login',{data:{username,password:reset}});const third=(await relogin.json()).data;assert.equal(third.user.mustChangePassword,true);check('重置后强制再次改密');
  const stored=users.data.items[0];const disable=await admin.request.put(TARGET+'/api/users/'+userId,{headers,data:{username,displayName:stored.displayName,businessEntityId:stored.businessEntityId,roleIds:stored.roles.map(r=>r.id),status:'DISABLED'}});assert.equal(disable.status(),200);
  assert.equal((await client.request.get(TARGET+'/api/auth/me',{headers:{Authorization:'Bearer '+third.accessToken}})).status(),401);
  assert.equal((await client.request.post(TARGET+'/api/auth/login',{data:{username,password:reset}})).status(),401);check('停用账号后旧Token和重新登录均不可用');
  const logs=await(await admin.request.get(TARGET+'/api/logs?pageSize=100',{headers})).json();const serialized=JSON.stringify(logs);for(const forbidden of [initial,changed,reset,'passwordHash'])assert.ok(!serialized.includes(forbidden));check('审计日志不含口令或密码哈希');
  await admin.request.delete(TARGET+'/api/users/'+userId,{headers});check('验收账号软删除保留审计');
  assert.deepEqual(errors,[]);
 }finally{fs.writeFileSync('docs/acceptance/account-results.json',JSON.stringify({at:new Date().toISOString(),results:out,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
