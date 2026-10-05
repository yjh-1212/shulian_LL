const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('dotenv').config();
const TARGET=process.env.TARGET_URL||'http://127.0.0.1:5173';
const PASSWORD=process.env.SEED_PASSWORD;
const OUT=path.resolve('docs/acceptance/screenshots');
fs.mkdirSync(OUT,{recursive:true});
const results=[];
const check=(name)=>{results.push({name,result:'PASS'});console.log('PASS',name);};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:process.env.PW_HEADLESS==='true'});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await ctx.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let token='';
 async function login(user){
  await page.goto(TARGET+'/login');
  await page.getByRole('textbox',{name:'账号',exact:true}).fill(user);
  await page.getByRole('textbox',{name:'密码',exact:true}).fill(PASSWORD);
  const response=page.waitForResponse(r=>r.url().endsWith('/auth/login')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  const res=await response;const body=await res.json();assert.equal(res.status(),201,body.message);token=body.data.accessToken;
  await page.waitForURL(TARGET+'/');await page.getByRole('heading',{name:/欢迎回来/}).waitFor();
 }
 async function logout(){await page.getByRole('button',{name:'用户菜单'}).click();await page.getByText('退出登录',{exact:true}).click();await page.waitForURL('**/login');}
 async function request(method,url,data,access=token){const r=await ctx.request.fetch(TARGET+'/api'+url,{method,headers:{Authorization:'Bearer '+access},data});return {status:r.status(),body:await r.json()};}
 try{
  await page.goto(TARGET+'/login');await page.screenshot({path:path.join(OUT,'login-1440.png'),fullPage:true});
  await login('admin');check('平台管理员真实登录');
  const openapi=await ctx.request.get(TARGET+'/api/docs-json');assert.equal(openapi.status(),200);assert.ok((await openapi.json()).paths['/api/auth/login']);check('Swagger包含认证与管理API');
  const menu=await request('GET','/menus');assert.ok(menu.body.data.find(m=>m.id==='system'));
  const contract=menu.body.data.find(m=>m.id==='contract');assert.equal(contract.children.length,4);check('新版合同四级入口及平台模板权限');
  for(const width of [1920,1440,1280]){
   await page.setViewportSize({width,height:1000});
   await page.waitForFunction(()=>document.querySelector('.main-nav').scrollWidth<=document.querySelector('.main-nav').clientWidth+1);
   await page.screenshot({path:path.join(OUT,`home-${width}.png`),fullPage:true});
   const layout=await page.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth,nav:[...document.querySelectorAll('.main-nav>.nav-button,.main-nav>.el-dropdown')].map(e=>e.textContent)}));
   assert.ok(layout.body<=width,`body overflow ${width}`);
  }
  await page.setViewportSize({width:1280,height:1000});await page.getByRole('button',{name:'更多导航'}).waitFor();
  await page.getByRole('button',{name:'更多导航'}).focus();await page.keyboard.press('Enter');await page.getByRole('menuitem',{name:'用户管理'}).click();await page.waitForURL('**/system/users');
  assert.ok(await page.getByRole('button',{name:'更多导航'}).evaluate(el=>el.classList.contains('active')));check('1280px更多收纳、键盘操作、子路由激活');
  await page.setViewportSize({width:1920,height:1000});await page.getByRole('button',{name:'系统管理',exact:true}).waitFor();check('扩大窗口后导航恢复');
  await page.setViewportSize({width:1440,height:1000});await page.getByText('平台管理员',{exact:true}).first().waitFor();await page.screenshot({path:path.join(OUT,'users-1440.png'),fullPage:true});
  const suffix=Date.now().toString().slice(-8),entityName='验收粮贸企业-'+suffix;
  await page.goto(TARGET+'/system/entities');await page.getByRole('button',{name:'新增主体'}).click();
  await page.getByRole('textbox',{name:'主体名称',exact:true}).fill(entityName);
  await page.getByRole('textbox',{name:'联系人',exact:true}).fill('验收联系人');
  await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByText('已保存',{exact:true}).waitFor();
  await page.getByRole('textbox',{name:'搜索关键词'}).fill(entityName);await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByText(entityName,{exact:true}).waitFor();
  await page.reload();await page.getByText(entityName,{exact:true}).waitFor();check('主体新增写入SQLite、筛选与刷新持久化');
  const entityRows=await request('GET','/entities?q='+entityName);assert.equal(entityRows.body.data.total,1);
  fs.mkdirSync('.local',{recursive:true});fs.writeFileSync('.local/persistence.json',JSON.stringify({id:entityRows.body.data.items[0].id,name:entityName}));
  await page.goto(TARGET+'/system/dictionaries');await page.getByRole('button',{name:'新增字典项'}).click();await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByText('请完整填写字典分组、编码与名称').waitFor();
  await page.getByRole('textbox',{name:'字典分组',exact:true}).fill('验收字典');await page.getByRole('textbox',{name:'编码',exact:true}).fill(suffix);await page.getByRole('textbox',{name:'名称',exact:true}).fill('验收值');await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByText('已保存',{exact:true}).waitFor();check('字典表单校验、真实新增和成功反馈');
  await page.getByRole('button',{name:'打开智能助手'}).click();await page.getByText('智能体能力尚未开放').waitFor();await page.screenshot({path:path.join(OUT,'agent-context.png'),fullPage:true});await page.keyboard.press('Escape');check('AI入口展示权限范围，未伪造模型结果');
  const roles=await request('GET','/roles'),perms=await request('GET','/permissions');const traderRole=roles.body.data.find(r=>r.code==='trader_admin');const original=traderRole.permissions.map(p=>p.permissionId);const planPermission=perms.body.data.find(p=>p.code==='plan:read').id;
  const changed=await request('PUT','/roles/'+traderRole.id,{name:traderRole.name,description:traderRole.description,permissionIds:original.filter(id=>id!==planPermission)});assert.equal(changed.status,200);
  const adminToken=token;await logout();assert.equal((await request('GET','/auth/me',undefined,adminToken)).status,401);check('退出立即撤销Access Token');
  await login('trader');assert.equal((await request('GET','/users')).status,403);assert.equal((await request('GET','/entities')).status,403);
  const traderMenus=(await request('GET','/menus')).body.data;assert.ok(!traderMenus.find(m=>m.id==='system'||m.id==='data'||m.id==='plan'));assert.equal(traderMenus.find(m=>m.id==='contract').children.length,3);check('贸易角色权限变更生效，平台API拒绝，合同模板隐藏');
  const own=(await request('GET','/workspace/entities')).body.data;assert.equal(own.length,1);assert.equal(own[0].id,'trader-a');assert.equal((await request('GET','/workspace/entities?businessEntityId=trader-b')).status,403);check('企业主体数据隔离，篡改主体参数被拒绝');
  await page.reload();await page.getByRole('heading',{name:/欢迎回来/}).waitFor();check('页面刷新通过HttpOnly Refresh Token恢复会话');
  await page.goto(TARGET+'/system/users');await page.getByText('无权访问此页面',{exact:true}).waitFor();check('直接访问管理路由被拦截');
  await page.goto(TARGET+'/');await page.screenshot({path:path.join(OUT,'trader-home.png'),fullPage:true});await logout();
  await login('carrier');const carrierMenus=(await request('GET','/menus')).body.data;assert.ok(!carrierMenus.find(m=>m.id==='system'||m.id==='data'));const supply=carrierMenus.find(m=>m.id==='demand');assert.ok(supply&&!supply.children.find(c=>c.id==='demands'));assert.ok(supply.children.find(c=>c.id==='supplies'));check('物流运营商菜单仅有供给维护入口');await logout();
  const driver=await ctx.request.post(TARGET+'/api/auth/login',{data:{username:'driver',password:PASSWORD}});assert.equal(driver.status(),403);check('司机账号禁止登录PC');
  await login('admin');await request('PUT','/roles/'+traderRole.id,{name:traderRole.name,description:traderRole.description,permissionIds:original});
  const badRole=await request('PUT','/roles/'+traderRole.id,{name:traderRole.name,description:traderRole.description,permissionIds:[...original,perms.body.data.find(p=>p.code==='users:write').id]});assert.equal(badRole.status,400);check('企业角色不可授予平台权限');
  const unknown=await request('POST','/entities',{name:'注入测试',type:'TRADER',status:'ACTIVE',isTestData:false,secret:'denied'});assert.equal(unknown.status,400);check('DTO拒绝越权字段与未知字段');
  await page.goto(TARGET+'/system/logs');await page.getByText('新增主体',{exact:true}).first().waitFor();await page.screenshot({path:path.join(OUT,'audit-logs.png'),fullPage:true});check('数据库写操作有可查看审计日志');
  await page.setViewportSize({width:390,height:844});await page.goto(TARGET+'/');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(OUT,'home-mobile.png'),fullPage:true});check('390px工作台无横向溢出');
  assert.deepEqual(errors,[]);check('无浏览器运行时异常');
 }finally{fs.mkdirSync('docs/acceptance',{recursive:true});fs.writeFileSync('docs/acceptance/e2e-results.json',JSON.stringify({target:TARGET,at:new Date().toISOString(),results,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
