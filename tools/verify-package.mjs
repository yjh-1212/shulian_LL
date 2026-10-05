import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export async function fileHash(path){
  const digest=createHash('sha256');
  for await(const chunk of createReadStream(path))digest.update(chunk);
  return digest.digest('hex');
}
export async function verifyPackage(root,initial=false){
  root=resolve(root);
  const manifest=JSON.parse(await readFile(resolve(root,'release-manifest.json'),'utf8'));
  let checked=0;
  for(const file of manifest.files){
    const path=resolve(root,file.path);
    if(!path.startsWith(root+sep))throw new Error('包内路径无效');
    if(!initial&&file.mutable)continue;
    if(await fileHash(path)!==file.sha256)throw new Error('文件校验失败：'+file.path);
    checked++;
  }
  console.log('部署文件校验通过：'+checked+' 个文件。');
  return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  await verifyPackage(fileURLToPath(new URL('../',import.meta.url)),process.argv.includes('--initial'));
}
