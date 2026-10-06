const assert=require('node:assert/strict'),fs=require('node:fs/promises'),{createHash}=require('node:crypto'),JSZip=require('jszip');
(async()=>{
 const zip=await JSZip.loadAsync(await fs.readFile('ll_dist/liaoliang-agent-fix.zip')),entries=Object.values(zip.files).filter(e=>!e.dir);
 const release=JSON.parse(await zip.file('liaoliang-server/release-manifest.json').async('string'));
 for(const entry of entries){const name=entry.name.replace(/^liaoliang-server\//,'');assert.ok(!name.startsWith('prisma/')&&!name.startsWith('.env')&&!name.startsWith('.local/'),'Patch must preserve live database, credentials and attachments');const bytes=await entry.async('nodebuffer');assert.ok(bytes.equals(await fs.readFile('ll_dist/liaoliang-server/'+name)),name+' matches full package');if(name!=='release-manifest.json')assert.equal(createHash('sha256').update(bytes).digest('hex'),release.files.find(f=>f.path===name).sha256);}
 assert.ok(zip.file('liaoliang-server/apps/api/dist/agent-model-stream.js'));assert.ok(zip.file('liaoliang-server/apps/api/dist/security-headers.js'));assert.ok(zip.file('liaoliang-server/apps/web/dist/index.html'));assert.ok(zip.file('liaoliang-server/AGENT-UPDATE.md'));
 const controller=await zip.file('liaoliang-server/apps/api/dist/agent-center.controller.js').async('string');assert.match(controller,/messages\/stream/);assert.match(controller,/solve\/stream/);assert.match(controller,/X-Accel-Buffering/);
 console.log(JSON.stringify({passed:true,patchFiles:entries.length,checksums:true,streamEndpoints:true,noDatabaseOrSecrets:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
