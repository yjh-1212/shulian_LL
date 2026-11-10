const {chromium,expect}=require('playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.TARGET_URL||'http://127.0.0.1:3002';

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:false});
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];let entries=0;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().endsWith('/api/auth/experience')&&r.method()==='POST')entries++;});
  await page.goto(base+'/');
  await expect(page).toHaveURL(base+'/workbench');
  await page.locator('.workbench-welcome').waitFor();
  await expect(page.locator('.workspace-identity')).toHaveText('辽宁省粮食发展集团有限责任公司');
  await expect(page.getByRole('button',{name:'首页',exact:true})).toHaveCount(0);
  await expect(page.locator('.portal-page,.portal-header')).toHaveCount(0);
  assert.equal(entries,1);
  await page.reload();
  await page.locator('.workbench-welcome').waitFor();
  assert.equal(entries,1,'Refresh should retain the current account');
  const dir=path.resolve('docs/acceptance/workbench-entry-20261020');fs.mkdirSync(dir,{recursive:true});
  for(const width of [1920,1366]){
   await page.setViewportSize({width,height:1080});
   assert.equal(await page.locator('.main-nav').getByRole('button',{name:'首页',exact:true}).count(),0);
   assert.equal(await page.locator('.topbar .brand').getAttribute('href'),'/workbench');
   await page.screenshot({path:path.join(dir,'workbench-'+width+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.goto(base+'/contracts/signing');
  await page.locator('.topbar .brand').click();
  await expect(page).toHaveURL(base+'/workbench');
  await page.getByRole('button',{name:'驾驶舱',exact:true}).click();
  await expect(page.locator('.cc-root')).toHaveAttribute('data-view','comprehensive');
  await page.getByRole('button',{name:'返回',exact:true}).click();
  await expect(page).toHaveURL(base+'/workbench');
  assert.equal(entries,1);
  await page.getByRole('button',{name:'用户菜单',exact:true}).click();
  await page.getByText('退出登录',{exact:true}).click();
  await expect(page).toHaveURL(base+'/login');
  await page.reload();
  await page.getByRole('button',{name:'登录',exact:true}).waitFor();
  assert.equal(entries,1,'Explicit logout must remain on the login page');
  await page.goto(base+'/contracts/signing');
  await expect(page).toHaveURL(base+'/login');
  assert.equal(entries,1,'Other protected pages must keep their login requirement');
  const unavailable=await browser.newContext();
  const blocked=await unavailable.newPage();let attempts=0;
  await blocked.route('**/api/auth/experience',route=>{attempts++;return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'默认 trader 账号暂不可用'})});});
  await blocked.goto(base+'/');
  await expect(blocked).toHaveURL(base+'/login');
  await blocked.getByRole('button',{name:'登录',exact:true}).waitFor();
  assert.equal(attempts,1);
  await unavailable.close();
  assert.deepEqual(errors,[]);
  const result={status:'PASS',checks:['root enters workbench automatically','homepage navigation hidden at 1920 and 1366','current session retained on refresh','brand and cockpit return to workbench','logout remains on login page','other protected pages retain authentication','unavailable default account falls back to login'],errors};
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
