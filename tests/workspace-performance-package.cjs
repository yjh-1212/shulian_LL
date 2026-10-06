const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {createHash} = require('node:crypto');
const JSZip = require('jszip');

(async () => {
  const zip = await JSZip.loadAsync(await fs.readFile('ll_dist/liaoliang-performance-fix.zip'));
  const entries = Object.values(zip.files).filter(e => !e.dir);
  const manifest = JSON.parse(await zip.file('liaoliang-server/release-manifest.json').async('string'));
  for (const entry of entries) {
    assert(entry.name.startsWith('liaoliang-server/'));
    const name = entry.name.slice('liaoliang-server/'.length);
    assert(!name.includes('..'));
    assert((!name.startsWith('prisma/') || name === 'prisma/bootstrap-production.ts') && !name.startsWith('.env') && !name.startsWith('.local/'));
    const bytes = await entry.async('nodebuffer');
    assert(bytes.equals(await fs.readFile('ll_dist/liaoliang-server/' + name)), name);
    if (name !== 'release-manifest.json') {
      assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.files.find(f => f.path === name).sha256, name);
    }
  }
  for (const module of ['json-compression', 'workspace-summaries', 'tracking-payload', 'security-headers', 'agent-model-stream']) {
    assert(zip.file('liaoliang-server/apps/api/dist/' + module + '.js'));
  }
  for (const grain of ['corn', 'rice', 'soybean', 'wheat']) {
    const bytes = await zip.file('liaoliang-server/apps/web/dist/assets/grain/' + grain + '.webp').async('nodebuffer');
    assert(bytes.length < 12000);
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
  }
  assert(zip.file('liaoliang-server/apps/web/dist/index.html'));
  assert(zip.file('liaoliang-server/apps/web/dist/driver.html'));
  assert(zip.file('liaoliang-server/PERFORMANCE-UPDATE.md'));
  assert(zip.file('liaoliang-server/DRIVER-ACCOUNT.md'));
  assert(zip.file('liaoliang-server/tools/configure-driver-account.cjs'));
  console.log(JSON.stringify({passed: true, files: entries.length, checksums: true, noDatabaseOrSecrets: true, thumbnails: true}));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
