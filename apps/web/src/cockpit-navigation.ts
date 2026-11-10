import type {Router} from 'vue-router';

const entryKey = 'cockpitEntryPath';

function sourcePath(value:unknown):string|null {
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//'))return null;
  try{
    const url=new URL(value,location.origin);
    return url.origin===location.origin&&url.pathname!=='/cockpit'?url.pathname+url.search+url.hash:null;
  }catch{return null;}
}

export function rememberCockpitEntry(path:string){
  const source=sourcePath(path);
  if(source)history.replaceState({...history.state,[entryKey]:source},'');
}

export function returnFromCockpit(router:Router){
  let referrer:string|null=null;
  try{
    const url=new URL(document.referrer);
    if(url.origin===location.origin)referrer=sourcePath(url.pathname+url.search+url.hash);
  }catch{/* Direct links have no referrer. */}
  const state=history.state||router.options.history.state;
  const target=sourcePath(state[entryKey])||sourcePath(state.back)||referrer||'/';
  if(sourcePath(state.back)===target)router.back();
  else void router.replace(target);
}
