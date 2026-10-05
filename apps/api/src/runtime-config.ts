import type {Request} from 'express';

export function runtimeConfig(env:NodeJS.ProcessEnv=process.env){
  const port=Number(env.PORT||3001);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT 必须为1至65535之间的整数');
  if(env.COOKIE_SECURE&&!['auto','true','false'].includes(env.COOKIE_SECURE))throw new Error('COOKIE_SECURE 只支持 auto、true 或 false');
  const trustProxy=env.TRUST_PROXY?.trim()||'loopback';
  if(trustProxy==='true')throw new Error('TRUST_PROXY 请填写可信代理的 IP 或网段，例如 loopback');
  const origins=new Set([
    'http://localhost:5173','http://127.0.0.1:5173',
    'http://localhost:5174','http://127.0.0.1:5174',
    ...[env.WEB_ORIGIN,env.DRIVER_ORIGIN,env.CORS_ORIGINS].flatMap(value=>(value||'').split(','))
  ].filter(Boolean).map(value=>{
    const url=new URL(value.trim());
    if(!['http:','https:'].includes(url.protocol))throw new Error('访问地址必须使用 HTTP 或 HTTPS');
    return url.origin;
  }));
  return {port,host:env.API_HOST||'0.0.0.0',trustProxy:trustProxy==='false'?false:trustProxy,origins};
}

export function originAllowed(origin:string,req:Request,origins:Set<string>){
  try{
    const url=new URL(origin);
    if(!['http:','https:'].includes(url.protocol)||url.origin!==origin)return false;
    // Same-origin requests work with both a server IP and a domain, including its port.
    return origins.has(origin)||origin===`${req.protocol}://${req.get('host')}`;
  }catch{return false;}
}

export function secureCookie(req:Pick<Request,'secure'>){
  if(process.env.COOKIE_SECURE==='true')return true;
  if(process.env.COOKIE_SECURE==='false')return false;
  return req.secure;
}
