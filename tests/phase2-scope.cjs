const assert=require('node:assert/strict'),fs=require('node:fs');require('dotenv').config();
const url=process.env.API_URL||'http://127.0.0.1:3001/api',results=[];const check=name=>{results.push({name,result:'PASS'});console.log('PASS',name);};
(async()=>{
 const tokens=[];async function login(username){const r=await fetch(url+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:process.env.SEED_PASSWORD})});assert.equal(r.status,201);const token=(await r.json()).data.accessToken;tokens.push(token);return async(method,path,body,status=method==='POST'?201:200)=>{const res=await fetch(url+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();assert.equal(res.status,status,JSON.stringify(data));return data.data;};}
 let restore,admin,trader,created;
 try{
 admin=await login('admin');trader=await login('trader');const carrier=await login('carrier'),other=await login('carrier.b');
 const roles=await admin('GET','/roles'),permissions=await admin('GET','/permissions'),role=roles.find(r=>r.code==='carrier_admin');restore={id:role.id,data:{name:role.name,description:role.description,permissionIds:role.permissions.map(p=>p.permissionId)}};
 // Temporarily grant the read permission to exercise publication scope before the Phase 4 hall opens.
 await admin('PUT','/roles/'+role.id,{...restore.data,permissionIds:[...new Set([...restore.data.permissionIds,permissions.find(p=>p.code==='demand:read').id])]});
 const opts=await trader('GET','/transport-options'),line=(await trader('GET','/trade-orders?q=JY-DEV-A-001')).items[0];const days=n=>new Date(Date.now()+n*86400000).toISOString();
 const dto={name:'验收定向隐私',orderItemId:line.id,quantity:.001,originCodes:['210000','211100','211102'],originAddress:'验收粮库',destinationCodes:['440000','440100','440112'],destinationAddress:'验收仓库',departureAt:days(10),modeIds:[],allowMultimodal:true,allowTransfer:false,maxTransfers:0,loadingType:'BULK',preference:'BALANCED',budget:1234,contact:'私有联系人',phone:'13800000001'};
 created=await trader('POST','/transport-demands',dto);await carrier('GET','/transport-demands/'+created.id,null,404);await trader('POST','/transport-demands/'+created.id+'/publish',{version:created.version,mode:'DIRECTED',targetCarrierId:'carrier-a',deadline:days(5),quoteType:'TOTAL',budgetPublic:false,contactPublic:false});
 const visible=await carrier('GET','/transport-demands/'+created.id);assert.equal(visible.grain.code,line.grain.code);assert.equal(visible.cargoName,line.cargoName);for(const key of ['orderItem','orderItemId','contact','phone','budget','budgetCents','files'])assert.equal(visible[key],undefined,key+' leaked');await other('GET','/transport-demands/'+created.id,null,404);assert.equal((await other('GET','/transport-demands?q=验收定向隐私')).total,0);check('定向需求只向目标企业展示，隐藏上游订单、预算、联系人与文件');
 let row=await trader('GET','/transport-demands/'+created.id);await trader('POST','/transport-demands/'+created.id+'/withdraw',{version:row.version});await carrier('GET','/transport-demands/'+created.id,null,404);row=await trader('GET','/transport-demands/'+created.id);await trader('POST','/transport-demands/'+created.id+'/publish',{version:row.version,mode:'PUBLIC',deadline:days(5),quoteType:'TOTAL',budgetPublic:true,contactPublic:true});assert.equal((await other('GET','/transport-demands/'+created.id)).budget,1234);check('撤回立即收回外部可见性，重新公开遵循字段公开设置');
 await admin('PUT','/roles/'+role.id,{...restore.data,permissionIds:[...restore.data.permissionIds,permissions.find(p=>p.code==='trade-orders:import').id]},400);check('企业角色不能授予交易订单导入权限');
 // Reordered JSON keys have the same canonical source digest.
 const stamp=String(Date.now()),importDto={businessNo:'JY-CANON-'+stamp,businessEntityId:'trader-a',recipient:'验收收货单位',shipperContact:'发货验收',shipperPhone:'13800000001',recipientContact:'收货验收',recipientPhone:'13800000002',sourceSystem:'canonical-acceptance',sourceRecordId:stamp,items:[{lineNo:'1',grainId:opts.grains[0].id,cargoName:'粮食',specification:'二等',quantity:1}]};const first=await admin('POST','/trade-orders/import',importDto),second=await admin('POST','/trade-orders/import',Object.fromEntries(Object.entries(importDto).reverse()));assert.equal(first.id,second.id);check('来源JSON字段顺序不同仍保持导入幂等');
 }finally{
 if(created&&trader){const row=await trader('GET','/transport-demands/'+created.id);if(row.status!=='CANCELLED')await trader('POST','/transport-demands/'+row.id+'/cancel',{version:row.version});}
 if(restore&&admin)await admin('PUT','/roles/'+restore.id,restore.data);
 for(const token of tokens)await fetch(url+'/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token}});
 fs.writeFileSync('docs/acceptance/phase2-scope.json',JSON.stringify({at:new Date().toISOString(),results,permissionsRestored:!!restore},null,2));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
