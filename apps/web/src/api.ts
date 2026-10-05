import axios from 'axios';
export const api=axios.create({baseURL:'/api',timeout:15000,withCredentials:true});
let accessToken='';
let renewing:Promise<any>|null=null;
export function setToken(token:string){accessToken=token;}
export function message(error:any):string{return error?.response?.data?.message|| (error.code==='ECONNABORTED'?'请求超时，请重试':'网络连接失败，请检查服务后重试');}
api.interceptors.request.use(config=>{if(accessToken)config.headers.Authorization=`Bearer ${accessToken}`;return config;});
export async function renew() {
  if(!renewing) renewing=api.post('/auth/refresh').then(r=>{setToken(r.data.data.accessToken);return r.data.data;}).finally(()=>{renewing=null;});
  return renewing;
}
api.interceptors.response.use(r=>r,async error=>{
  const config=error.config;
  if(error.response?.status===401 && config && !config._retry && !config.url.startsWith('/auth/')) {
    config._retry=true;
    try{await renew();return api(config);}catch{setToken('');window.dispatchEvent(new Event('session-expired'));}
  }
  return Promise.reject(error);
});
export async function get<T=any>(path:string,params?:any):Promise<T>{return (await api.get(path,{params})).data.data;}
