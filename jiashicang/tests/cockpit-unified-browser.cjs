const {chromium,expect}=require('playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.COCKPIT_URL||'http://127.0.0.1:3002';
const out=path.resolve(__dirname,'../acceptance/unified-cockpit-20261020');
const views=[['comprehensive','综合驾驶舱'],['platform','平台运营'],['chain','一粮一链'],['grain-source','粮源分析'],['channel','通道运行']];

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:false});
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  fs.mkdirSync(out,{recursive:true});
  await page.goto(base+'/cockpit');
  await expect(page.locator('.cc-root')).toHaveAttribute('data-view','comprehensive');
  await page.locator('.cc-comp-overview-panel').waitFor();
  await page.locator('canvas').first().waitFor();
  assert.deepEqual(await page.getByRole('tab').allTextContents(),['平台运营','一粮一链','综合驾驶舱','粮源分析','通道运行']);
  const appearance=(await (await page.request.get(base+'/api/cockpit/appearance')).json()).data;
  const skin=appearance.styles.comprehensive;
  for(const [view] of views){
   assert.equal(appearance.styles[view].primary,skin.primary);
   assert.equal(appearance.styles[view].background,skin.background);
   assert.equal(appearance.styles[view].theme,'dark');
   assert.equal(appearance.styles[view].panelOpacity,0);
  }
  assert.equal(appearance.styles.platform.mapTexture,false);
  assert.equal(appearance.styles.channel.mapTexture,false);
  assert.equal(appearance.styles.chain.mapTexture,true);
  assert.equal(appearance.styles['grain-source'].mapTexture,true);
  checks.push('default entry and shared skin across five views; imagery defaults preserved');
  let frame;
  const layouts=[];
  for(const [width,height] of [[1920,1080],[1440,900],[1366,768]]){
   await page.setViewportSize({width,height});
   for(const [view,name] of views){
    await page.getByRole('tab',{name,exact:true}).click();
    await expect(page.locator('.cc-root')).toHaveAttribute('data-view',view);
    await expect(page.locator('.cc-panel')).toHaveCount(6);
    if(view==='platform'||view==='chain')await page.locator('.cc-grid[aria-busy=false]').waitFor();
    if(view==='grain-source')await expect(page.locator('.gs-chart[data-ready=true]')).toHaveCount(5);
    const result=await page.locator('.cc-root').evaluate(root=>{
     const panels=[...root.querySelectorAll('.cc-panel')];
     return {
      background:getComputedStyle(root).getPropertyValue('--cc-bg').trim(),
      primary:getComputedStyle(root).getPropertyValue('--cc-primary').trim(),
      frame:getComputedStyle(root.querySelector('.cc-frame-corners')).stroke,
      opaquePanels:panels.filter(p=>!/^rgba\([^)]*, 0\)$/.test(getComputedStyle(p).backgroundColor)).length,
      panelOverflows:panels.filter(p=>{const b=p.querySelector('.cc-panel-body');return b.scrollHeight>b.clientHeight+3;}).map(p=>p.getAttribute('aria-label')),
      offscreenPanels:panels.filter(p=>p.getBoundingClientRect().bottom>innerHeight+1).map(p=>p.getAttribute('aria-label')),
      pageOverflow:document.documentElement.scrollWidth>innerWidth,
      headerOverflow:root.querySelector('.cc-header').getBoundingClientRect().right>innerWidth,
     };
    });
    if(!frame)frame=result.frame;
    assert.equal(result.background,skin.background);
    assert.equal(result.primary,skin.primary);
    assert.equal(result.frame,frame,'shared frame '+view);
    assert.equal(result.opaquePanels,0);
    await page.screenshot({path:path.join(out,`${view}-${width}.png`)});
    assert.deepEqual(result.panelOverflows,[],view+' panel overflow at '+width);
    assert.deepEqual(result.offscreenPanels,[]);
    assert.equal(result.pageOverflow,false);
    assert.equal(result.headerOverflow,false);
    layouts.push({view,width,...result});
    console.log('PASS '+view+' '+width);
   }
  }
  checks.push('six transparent panels with matching frames at 1920, 1440, 1366 desktop widths');
  await page.setViewportSize({width:1920,height:1080});
  await page.goto(base+'/');
  await page.waitForURL('**/workbench');
  const origin='/data?tab=subscriptions#current-subscriptions';
  await page.goto(base+origin);
  await page.getByRole('button',{name:'驾驶舱',exact:true}).click();
  await expect(page.locator('.cc-root')).toHaveAttribute('data-view','comprehensive');
  await page.getByRole('tab',{name:'平台运营',exact:true}).click();
  await page.locator('.cc-grid[aria-busy=false]').waitFor();
  await page.getByRole('tab',{name:'通道运行',exact:true}).click();
  await page.locator('.ch-grid').waitFor();
  await page.reload();
  await page.locator('.ch-grid').waitFor();
  await page.getByRole('button',{name:'返回',exact:true}).click();
  await expect(page).toHaveURL(base+origin);
  checks.push('return to originating business page including query/hash after tab switching and reload');
  await page.goto(base+'/contracts/signing?from=tasks');
  await page.getByRole('button',{name:'驾驶舱',exact:true}).click();
  await page.locator('.cc-comp-grid').waitFor();
  await page.getByRole('button',{name:'返回',exact:true}).click();
  await expect(page).toHaveURL(base+'/contracts/signing?from=tasks');
  await page.goto(base+'/');
  await page.waitForURL('**/workbench');
  await page.getByRole('button',{name:'驾驶舱',exact:true}).click();
  await expect(page.locator('.cc-root')).toHaveAttribute('data-view','comprehensive');
  await page.getByRole('button',{name:'返回',exact:true}).click();
  await expect(page).toHaveURL(base+'/workbench');
  checks.push('return from contract management and default workbench entry');
  const direct=await context.newPage();
  await direct.goto(base+'/cockpit?view=grain-source');
  await direct.locator('.gs-grid').waitFor();
  await direct.getByRole('button',{name:'返回',exact:true}).click();
  await expect(direct).toHaveURL(base+'/workbench');
  await direct.close();
  checks.push('explicit deep link retained; independent entry returns to workbench');
  assert.deepEqual(errors,[]);
  const result={status:'PASS',checks,layouts,errors};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:'PASS',checks},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
