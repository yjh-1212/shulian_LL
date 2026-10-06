const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const net=require('node:net');
const {randomBytes}=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {hash}=require('bcryptjs');
const {request}=require('playwright');

const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'.local'),{recursive:true});
const folder=fs.mkdtempSync(path.join(root,'.local','server-runtime-'));
const databasePath=path.join(folder,'server.db');
const envFile=path.join(folder,'.env.runtime');
let server,db,client;
const devProcesses=[];
let logs='';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function availablePort(){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'0.0.0.0',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));return port;}
function run(args,env){const result=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',windowsHide:true});if(result.status!==0)throw Error(result.error?.message||(result.stderr+result.stdout).slice(-2000));return result.stdout;}
async function main(){
  const port=await availablePort(),base=`http://127.0.0.1:${port}`;
  const env={...process.env,ENV_FILE:envFile,NODE_ENV:'production',API_HOST:'0.0.0.0',PORT:String(port),SERVE_WEB:'true',DATABASE_URL:'file:'+databasePath.replace(/\\/g,'/'),JWT_SECRET:randomBytes(48).toString('hex'),TRUST_PROXY:'loopback',COOKIE_SECURE:'auto',CORS_ORIGINS:'https://partner.example.com',FIXED_ACCOUNT_PASSWORD:randomBytes(18).toString('base64url'),BOOTSTRAP_PLATFORM_NAME:'服务器安装验收',BOOTSTRAP_ADMIN_USERNAME:'admin',BOOTSTRAP_ADMIN_PASSWORD:randomBytes(24).toString('hex'),AMAP_JSAPI_KEY:'0'.repeat(32),AMAP_SECURITY_JS_CODE:'1'.repeat(32),AMAP_WEB_SERVICE_KEY:'2'.repeat(32),DEEPSEEK_API_KEY:''};
  fs.writeFileSync(envFile,'PORT='+port+'\n');
  const original=fs.readFileSync(envFile,'utf8');
  run(['tools/setup-server.mjs'],env);
  assert.equal(fs.readFileSync(envFile,'utf8'),original,'服务器配置不得覆盖');
  const setupEnv=path.join(folder,'generated.env');
  run(['tools/setup-server.mjs'],{...env,ENV_FILE:setupEnv});
  const generated=fs.readFileSync(setupEnv,'utf8');
  assert.doesNotMatch(generated,/^(?:FIXED_ACCOUNT_PASSWORD|BOOTSTRAP_\w+)=/m,'新服务器配置不得生成账号密码项');
  fs.appendFileSync(setupEnv,'FIXED_ACCOUNT_PASSWORD="obsolete"\nBOOTSTRAP_ADMIN_PASSWORD="obsolete"\n');
  run(['tools/setup-server.mjs'],{...env,ENV_FILE:setupEnv});
  assert.equal(fs.readFileSync(setupEnv,'utf8'),generated,'清理旧密码设置后其余配置应保持不变');
  fs.unlinkSync(setupEnv);
  run(['tools/server.mjs','init'],env);
  db=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}});
  assert.equal(await db.user.count(),1);
  assert.equal(await db.user.count({where:{isTestData:true}}),0);
  const organization=await db.organization.findFirstOrThrow();
  for(const [id,type,username,roleCode] of [['trader-a','TRADER','trader','trader_admin'],['carrier-a','CARRIER','carrier','carrier_admin']]){
    await db.businessEntity.create({data:{id,name:username+'服务器验收主体',type,organizationId:organization.id}});
    await db.user.create({data:{username,displayName:username,businessEntityId:id,passwordHash:await hash(env.FIXED_ACCOUNT_PASSWORD,12),roles:{create:{role:{connect:{code:roleCode}}}}}});
  }
  await db.user.create({data:{username:'server.driver',displayName:'司机',businessEntityId:'carrier-a',passwordHash:await hash(env.FIXED_ACCOUNT_PASSWORD,12),roles:{create:{role:{connect:{code:'driver'}}}}}});
  await db.user.update({where:{username:'admin'},data:{passwordHash:await hash(env.FIXED_ACCOUNT_PASSWORD,12),mustChangePassword:false}});
  server=spawn(process.execPath,['tools/server.mjs','start'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>logs=(logs+chunk.toString()).slice(-12000));
  server.stderr.on('data',chunk=>logs=(logs+chunk.toString()).slice(-12000));
  for(let attempts=0;attempts<180;attempts++){
    if(server.exitCode!==null)throw Error('服务器提前退出：'+logs.slice(-2000));
    try{if((await fetch(base+'/api/health')).ok)break;}catch{}
    if(attempts===179)throw Error('服务器启动超时：'+logs.slice(-2000));
    await delay(250);
  }
  client=await request.newContext({baseURL:base});
  for(const route of ['/','/workbench','/plans/solve','/services/an-order/tracking','/driver','/driver/','/driver.html']){
    const response=await client.get(route);
    assert.equal(response.status(),200,route);
    assert.match(response.headers()['content-type'],/text\/html/);
    assert.equal(response.headers()['cache-control'],'no-store');
    assert.equal(response.headers()['referrer-policy'],'strict-origin-when-cross-origin');
    assert.equal(response.headers()['cross-origin-opener-policy'],undefined,'HTTP should not request an HTTPS-only opener policy');
    assert.equal(response.headers()['origin-agent-cluster'],undefined);
    if(route.startsWith('/driver'))assert.match(await response.text(),/司机/);
  }
  const html=await (await client.get('/')).text(),asset=html.match(/src="([^\"]+\.js)"/)[1];
  const httpsPage=await client.get('/workbench',{headers:{'X-Forwarded-Proto':'https'}});
  assert.equal(httpsPage.headers()['cross-origin-opener-policy'],'same-origin');
  assert.equal(httpsPage.headers()['referrer-policy'],'strict-origin-when-cross-origin');
  assert.equal(httpsPage.headers()['origin-agent-cluster'],undefined);
  const resource=await client.get(asset);assert.equal(resource.status(),200);assert.match(resource.headers()['cache-control'],/immutable/);
  assert.equal((await client.get('/assets/missing.js')).status(),404);
  assert.equal((await client.get('/api/not-present')).status(),404);
  assert.equal((await client.get('/.env')).status(),404);
  assert.equal((await client.get('/tools/setup-server.mjs')).status(),404);
  assert.equal((await client.get('/api/auth/me')).status(),401);
  let adminToken;
  for(const [username,type,roleCode] of [['admin','PLATFORM','platform_admin'],['trader','TRADER','trader_admin'],['carrier','CARRIER','carrier_admin']]){
    const response=await client.post('/api/auth/login',{headers:{Origin:base},data:{username,password:env.FIXED_ACCOUNT_PASSWORD}});
    assert.equal(response.status(),201,username);
    assert.doesNotMatch(response.headers()['set-cookie'],/; Secure/i);
    const data=(await response.json()).data;
    assert.equal(data.user.businessEntity.type,type);
    assert.ok(data.user.roles.some(role=>role.code===roleCode));
    assert.equal(data.user.mustChangePassword,false);
    const refreshed=await client.post('/api/auth/refresh',{headers:{Origin:base}});
    assert.equal(refreshed.status(),201,'HTTP Cookie refresh '+username);
    if(username==='admin')adminToken=(await refreshed.json()).data.accessToken;
  }
  const map=await client.get('/api/map/config',{headers:{Authorization:'Bearer '+adminToken}});
  assert.equal(map.status(),200);assert.doesNotMatch(map.headers()['set-cookie'],/; Secure/i);
  const mapConfig=(await map.json()).data;assert.equal(mapConfig.serviceHost,'/_AMapService');assert.equal(mapConfig.securityJsCode,undefined);
  assert.equal((await client.get('/_AMapService/invalid')).status(),403);
  const secure=await client.post('/api/auth/login',{headers:{Origin:`https://127.0.0.1:${port}`,'X-Forwarded-Proto':'https'},data:{username:'admin',password:env.FIXED_ACCOUNT_PASSWORD}});
  assert.equal(secure.status(),201);assert.match(secure.headers()['set-cookie'],/; Secure/i);
  const secureToken=(await secure.json()).data.accessToken;
  const secureMap=await client.get('/api/map/config',{headers:{Authorization:'Bearer '+secureToken,'X-Forwarded-Proto':'https'}});
  assert.equal(secureMap.status(),200);assert.match(secureMap.headers()['set-cookie'],/; Secure/i);
  const denied=await client.post('/api/auth/login',{headers:{Origin:'https://untrusted.example.com'},data:{username:'admin',password:env.FIXED_ACCOUNT_PASSWORD}});
  assert.equal(denied.status(),403);
  const preflight=await client.fetch('/api/auth/login',{method:'OPTIONS',headers:{Origin:'https://partner.example.com','Access-Control-Request-Method':'POST'}});
  assert.equal(preflight.headers()['access-control-allow-origin'],'https://partner.example.com');
  const driver=await client.post('/api/driver/login',{data:{username:'server.driver',password:env.FIXED_ACCOUNT_PASSWORD}});
  assert.equal(driver.status(),201);
  const driverToken=(await driver.json()).data.accessToken;
  assert.equal((await client.get('/api/auth/me',{headers:{Authorization:'Bearer '+driverToken}})).status(),401);
  assert.equal((await client.get('/api/driver/me',{headers:{Authorization:'Bearer '+adminToken}})).status(),401);
  const addresses=Object.values(os.networkInterfaces()).flat().filter(value=>value?.family==='IPv4'&&!value.internal).map(value=>value.address);
  let lanVerified=false;
  if(addresses.length){
    const lan=`http://${addresses[0]}:${port}`;
    assert.equal((await fetch(lan+'/workbench')).status,200,'0.0.0.0 LAN listener');
    const response=await fetch(lan+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:lan,'X-Forwarded-Proto':'https'},body:JSON.stringify({username:'admin',password:env.FIXED_ACCOUNT_PASSWORD})});
    assert.equal(response.status,201);assert.doesNotMatch(response.headers.get('set-cookie'),/; Secure/i,'untrusted proxy headers must be ignored');
    lanVerified=true;
  }
  assert.equal(await db.contractPackage.count(),0);
  await client.dispose();client=null;
  server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));
  const apiPort=await availablePort(),webPort=await availablePort(),driverPort=await availablePort();
  const devEnv={...env,NODE_ENV:'development',SERVE_WEB:'false',PORT:String(apiPort),WEB_PORT:String(webPort),DRIVER_PORT:String(driverPort),WEB_HOST:'0.0.0.0',API_PROXY_TARGET:`http://127.0.0.1:${apiPort}`,WEB_ORIGIN:`http://127.0.0.1:${webPort}`,DRIVER_ORIGIN:`http://127.0.0.1:${driverPort}`};
  for(const [args,cwd] of [[['apps/api/dist/main.js'],root],[[path.join(root,'node_modules/vite/bin/vite.js')],path.join(root,'apps/web')],[[path.join(root,'node_modules/vite/bin/vite.js'),'--mode','driver'],path.join(root,'apps/web')]]){
    const child=spawn(process.execPath,args,{cwd,env:devEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',chunk=>logs=(logs+chunk.toString()).slice(-12000));child.stderr.on('data',chunk=>logs=(logs+chunk.toString()).slice(-12000));devProcesses.push(child);
  }
  const devBase=`http://127.0.0.1:${webPort}`;
  for(let attempts=0;attempts<120;attempts++){
    if(devProcesses.some(child=>child.exitCode!==null))throw Error('本地开发服务提前退出：'+logs.slice(-2000));
    try{if((await fetch(devBase+'/api/health')).ok&&(await fetch(`http://127.0.0.1:${driverPort}/`)).ok)break;}catch{}
    if(attempts===119)throw Error('本地开发服务启动超时：'+logs.slice(-2000));
    await delay(250);
  }
  client=await request.newContext({baseURL:devBase});
  assert.match(await (await client.get('/workbench')).text(),/@vite\/client/);
  const localLogin=await client.post('/api/auth/login',{headers:{Origin:devBase},data:{username:'admin',password:env.FIXED_ACCOUNT_PASSWORD}});
  assert.equal(localLogin.status(),201);
  assert.equal((await client.post('/api/auth/refresh',{headers:{Origin:devBase}})).status(),201);
  const redirect=await client.get('/driver',{headers:{Accept:'text/html'},maxRedirects:0});
  assert.equal(redirect.status(),302);assert.equal(redirect.headers().location,`http://127.0.0.1:${driverPort}/`);
  if(addresses.length){const lan=`http://${addresses[0]}:${webPort}`;assert.equal((await fetch(lan+'/workbench')).status,200);const response=await fetch(lan+'/driver',{headers:{Accept:'text/html'},redirect:'manual'});assert.equal(response.headers.get('location'),`http://${addresses[0]}:${driverPort}/`);}
  console.log(JSON.stringify({passed:true,singlePortPages:7,staticAssets:true,httpLoginAndRefresh:3,httpsProxyCookies:true,mapProxyGuard:true,crossOriginGuard:true,driverSessionIsolation:true,lanListener:lanVerified,productionInitialization:true,localDevelopmentProxy:true,localDriverRedirect:true}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{
  await client?.dispose();
  for(const child of devProcesses)if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(3000)]);if(child.exitCode===null)child.kill('SIGKILL');}
  if(server&&server.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),delay(3000)]);if(server.exitCode===null)server.kill('SIGKILL');}
  await db?.$disconnect();
  // These are only files created in this test's private temporary directory.
  for(const suffix of ['','-wal','-shm','-journal'])if(fs.existsSync(databasePath+suffix))fs.unlinkSync(databasePath+suffix);
  fs.unlinkSync(envFile);fs.rmdirSync(folder);
});
