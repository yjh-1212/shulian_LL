const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {createHash}=require('node:crypto');
const JSZip=require('jszip');
(async()=>{
 const expected=['apps/api/dist/amap.js','apps/api/dist/main.js','apps/api/dist/web-hosting.js','apps/api/dist/security-headers.js','apps/api/dist/map-proxy-response.js','release-manifest.json','README.md','MAP-UPDATE.md'];
 const archive=await JSZip.loadAsync(await fs.readFile('ll_dist/liaoliang-map-fix.zip'));
 const names=Object.values(archive.files).filter(e=>!e.dir).map(e=>e.name.replace(/^liaoliang-server\//,'')).sort();
 assert.deepEqual(names,[...expected].sort(),'Update archive must contain only the required program files');
 const release=JSON.parse(await archive.file('liaoliang-server/release-manifest.json').async('string'));
 for(const name of names){
  const bytes=await archive.file('liaoliang-server/'+name).async('nodebuffer');
  if(name.startsWith('apps/api/dist/')){const disk=await fs.readFile('ll_dist/liaoliang-server/'+name);assert.ok(bytes.equals(disk),name+' must match the full package');}
  if(name!=='release-manifest.json')assert.equal(createHash('sha256').update(bytes).digest('hex'),release.files.find(f=>f.path===name).sha256,name+' checksum');
 }
 const {mapResponseType}=require('../ll_dist/liaoliang-server/apps/api/dist/map-proxy-response');
 assert.match(mapResponseType(Buffer.from('jsonp_1({"status":1});'),'jsonp_1','application/json'),/^application\/javascript/);
 console.log(JSON.stringify({passed:true,patchFiles:names.length,noDatabaseOrSecrets:true,checksums:true,compiledJsonpFix:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
