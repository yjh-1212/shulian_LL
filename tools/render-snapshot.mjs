import { PrismaClient } from '@prisma/client';
import { parse } from 'dotenv';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, copyFile, mkdir, mkdtemp, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const encryptedPath = resolve(root, 'deploy/render-data.tar.gz.enc');
const algorithm = 'aes-256-gcm';
const nonceBytes = 12;
const tagBytes = 16;
const fileDatabase = path => 'file:' + path.replaceAll('\\', '/');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return false;
  }
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' 执行失败');
}

async function withTemporaryDirectory(parent, action) {
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(resolve(parent, 'render-snapshot-'));
  try {
    return await action(directory);
  } finally {
    if (!resolve(directory).startsWith(resolve(parent) + sep + 'render-snapshot-')) {
      throw new Error('临时目录校验失败');
    }
    await rm(directory, { recursive: true, force: true });
  }
}

async function exportSnapshot() {
  const settings = parse(await readFile(resolve(root, '.env')));
  if (!settings.DATABASE_URL?.startsWith('file:')) throw new Error('本地数据库须使用 SQLite');
  const release = resolve(root, 'll_dist', 'render-' + new Date().toISOString().replace(/[-:.TZ]/g, ''));
  await mkdir(release, { recursive: true });
  await withTemporaryDirectory(resolve(root, '.local'), async directory => {
    const data = resolve(directory, 'data');
    run(process.execPath, ['tools/backup.mjs', data], { ...process.env, DATABASE_URL: settings.DATABASE_URL });
    const snapshot = new PrismaClient({ datasources: { db: { url: fileDatabase(resolve(data, 'database.db')) } } });
    const uploads = resolve(data, 'uploads');
    await mkdir(uploads);
    let attachmentCount = 0;
    try {
      const integrity = await snapshot.$queryRawUnsafe('PRAGMA integrity_check');
      if (integrity.some(row => Object.values(row)[0] !== 'ok')) throw new Error('数据库完整性校验失败');
      await snapshot.refreshToken.updateMany({ where: { revokedAt: null }, data: { revokedAt: new Date() } });
      const files = await snapshot.businessFile.findMany({ select: { id: true, storageName: true, deletedAt: true } });
      const sourceUploads = resolve(root, settings.TRANSPORT_UPLOAD_DIR || '.local/uploads');
      for (const file of files) {
        if (!file.storageName || file.storageName !== basename(file.storageName) || !/^[a-z0-9-]+\.(png|jpg|webp|pdf)$/i.test(file.storageName)) {
          throw new Error('附件文件名无效');
        }
        const source = resolve(sourceUploads, file.storageName);
        if (file.deletedAt && !await exists(source)) continue;
        await copyFile(source, resolve(uploads, file.storageName));
        attachmentCount++;
      }
    } finally {
      await snapshot.$disconnect();
    }

    const archive = resolve(directory, 'data.tar.gz');
    run('tar', ['-czf', archive, '-C', data, 'database.db', 'uploads']);
    const key = randomBytes(32);
    const nonce = randomBytes(nonceBytes);
    const cipher = createCipheriv(algorithm, key, nonce);
    const output = resolve(directory, 'data.enc');
    await writeFile(output, nonce, { flag: 'wx' });
    await pipeline(createReadStream(archive), cipher, createWriteStream(output, { flags: 'a' }));
    await writeFile(output, cipher.getAuthTag(), { flag: 'a' });
    const { size } = await stat(output);
    if (size >= 95 * 1024 * 1024) throw new Error('加密快照过大，请通过 Render 私有通道迁移');

    const config = { RENDER_SNAPSHOT_KEY: key.toString('hex') };
    for (const name of ['AMAP_JSAPI_KEY', 'AMAP_SECURITY_JS_CODE', 'AMAP_WEB_SERVICE_KEY', 'DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL']) {
      if (settings[name]) config[name] = settings[name];
    }
    await writeFile(resolve(release, '.env.render'), Object.entries(config).map(([name, value]) => name + '=' + JSON.stringify(value)).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
    await rename(output, encryptedPath);
    console.log(JSON.stringify({ attachmentCount, encryptedBytes: size, privateConfigDirectory: release }));
  });
}

async function restoreSnapshot() {
  if (!process.env.RENDER_DATA_DIR) throw new Error('请配置 Render 持久磁盘目录');
  const data = resolve(process.env.RENDER_DATA_DIR);
  const database = resolve(data, 'database.db');
  if (process.env.DATABASE_URL !== fileDatabase(database) || resolve(process.env.TRANSPORT_UPLOAD_DIR || '') !== resolve(data, 'uploads')) {
    throw new Error('数据库与附件目录须位于同一持久磁盘');
  }
  if (await exists(database)) {
    if ((await stat(database)).size === 0) throw new Error('持久磁盘上的数据库为空，请检查恢复状态');
    return;
  }

  const secret = process.env.RENDER_SNAPSHOT_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(secret)) throw new Error('请在 Render 设置 RENDER_SNAPSHOT_KEY');
  await withTemporaryDirectory(dirname(data), async directory => {
    const archive = resolve(directory, 'data.tar.gz');
    const encrypted = await open(encryptedPath, 'r');
    try {
      const { size } = await encrypted.stat();
      if (size <= nonceBytes + tagBytes) throw new Error('加密快照不完整');
      const nonce = Buffer.alloc(nonceBytes);
      const tag = Buffer.alloc(tagBytes);
      await encrypted.read(nonce, 0, nonceBytes, 0);
      await encrypted.read(tag, 0, tagBytes, size - tagBytes);
      const decipher = createDecipheriv(algorithm, Buffer.from(secret, 'hex'), nonce);
      decipher.setAuthTag(tag);
      const content = encrypted.createReadStream({ start: nonceBytes, end: size - tagBytes - 1, autoClose: false });
      await pipeline(content, decipher, createWriteStream(archive, { flags: 'wx', mode: 0o600 }));
    } finally {
      await encrypted.close();
    }
    const restored = resolve(directory, 'data');
    await mkdir(restored);
    run('tar', ['-xzf', archive, '-C', restored]);
    if (!(await stat(resolve(restored, 'database.db'))).size) throw new Error('恢复后的数据库为空');
    await rename(restored, data);
    console.log('已在持久磁盘恢复本地数据库与附件');
  });
}

const command = process.argv[2];
if (command === 'export') await exportSnapshot();
else if (command === 'restore') await restoreSnapshot();
else throw new Error('请指定 export 或 restore');
