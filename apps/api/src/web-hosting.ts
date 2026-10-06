import {Router,static as serveStatic} from 'express';
import {existsSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {createSecurityHeaders} from './security-headers';

export function createWebHosting(directory:string){
  const root=resolve(directory);
  for(const file of ['index.html','driver.html'])if(!existsSync(resolve(root,file)))throw new Error('网页构建文件缺失，请先执行 npm run build');
  const router=Router();
  // The map loader uses external scripts; API responses keep their own Helmet policy.
  const headers=createSecurityHeaders(true);
  const files=serveStatic(root,{index:false,dotfiles:'deny',maxAge:'1h',setHeaders(res,path){
    if(path.endsWith('.html'))res.setHeader('Cache-Control','no-store');
    else if(/[\\/]assets[\\/].+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(path))res.setHeader('Cache-Control','public, max-age=31536000, immutable');
  }});
  router.use((req,res,next)=>{
    if(!['GET','HEAD'].includes(req.method)||/^\/(?:api|_AMapService)(?:\/|$)/.test(req.path))return next();
    headers(req,res,()=>files(req,res,error=>{
      if(error)return next(error);
      if(req.path.split('/').some(part=>part.startsWith('.')))return res.sendStatus(404);
      if(extname(req.path)||!req.accepts('html'))return next();
      res.setHeader('Cache-Control','no-store');
      res.sendFile(req.path==='/driver'||req.path.startsWith('/driver/')?'driver.html':'index.html',{root},error=>{if(error)next(error);});
    }));
  });
  return router;
}
