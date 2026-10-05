import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createReadStream,existsSync,cpSync,mkdirSync} from 'node:fs';
const pdfjsRoot=resolve(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'),'..');
export default defineConfig(({mode})=>({
 plugins: [vue(), {
  name:'local-pdf-assets',
  configureServer(server){server.middlewares.use((req,res,next)=>{
   const match=req.url?.split('?')[0].match(/^\/pdfjs-assets\/(cmaps|standard_fonts|wasm)\/([A-Za-z0-9_.-]+)$/);
   if(!match)return next();const path=resolve(pdfjsRoot,match[1],match[2]);if(!existsSync(path))return next();
   res.setHeader('Content-Type',match[2].endsWith('.wasm')?'application/wasm':'application/octet-stream');createReadStream(path).pipe(res);
  });},
  writeBundle(output){const target=resolve(output.dir||resolve(__dirname,mode==='driver'?'dist-driver':'dist'),'pdfjs-assets');mkdirSync(target,{recursive:true});for(const folder of ['cmaps','standard_fonts','wasm'])cpSync(resolve(pdfjsRoot,folder),resolve(target,folder),{recursive:true});}
 }, {
  name: 'local-map-origin',
  configureServer(server) {
   // The supplied JSAPI key works at 127.0.0.1; localhost fails its domain check.
   // Canonicalize development document requests before creating a login session.
   server.middlewares.use((req,res,next)=>{
    if(mode!=='driver'&&req.method==='GET'&&req.url?.split('?')[0]==='/driver'&&req.headers.accept?.includes('text/html')){
     res.writeHead(302,{Location:'http://127.0.0.1:5174/'});res.end();return;
    }
    if(mode==='driver'&&req.url==='/')req.url='/driver.html';
    if(req.method==='GET'&&/^localhost(?::\d+)?$/.test(req.headers.host||'')&&req.headers.accept?.includes('text/html')){
     res.writeHead(302,{Location:`http://127.0.0.1:${mode==='driver'?5174:5173}`+(req.url?.startsWith('/')?req.url:'/')});res.end();return;
    }
    next();
   });
  }
 }],
 build:{outDir:mode==='driver'?'dist-driver':'dist',rollupOptions:{input:mode==='driver'?resolve(__dirname,'driver.html'):{web:resolve(__dirname,'index.html'),driver:resolve(__dirname,'driver.html')}}},
 server: {port:mode==='driver'?5174:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:3001','/_AMapService':'http://127.0.0.1:3001'}}
}));
