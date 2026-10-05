import {PointDto} from './planning.dto';

export function storedDemandPoint(raw:string|null|undefined):PointDto|null {
  if(!raw)return null;
  try {
    const p=JSON.parse(raw);
    return p&&typeof p.name==='string'&&Number.isFinite(p.lng)&&Number.isFinite(p.lat)&&p.lng>=73&&p.lng<=136&&p.lat>=3&&p.lat<=54&&p.matchKind!=='APPROXIMATE'?p:null;
  } catch {return null;}
}
