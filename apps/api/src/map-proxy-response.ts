import {BadRequestException} from '@nestjs/common';

export function mapCallback(url:URL):string|null {
  const callback=url.searchParams.get('callback');
  if(callback!==null&&!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(callback))throw new BadRequestException('地图回调名称无效');
  if(callback&&callback.length>128)throw new BadRequestException('地图回调名称过长');
  return callback;
}

export function mapResponseType(body:Buffer,callback:string|null,contentType:string|null):string {
  if(callback){
    const text=body.toString('utf8').trim();
    const prefix=callback+'(';
    const withoutSemicolon=text.endsWith(';')?text.slice(0,-1).trimEnd():text;
    if(withoutSemicolon.startsWith(prefix)&&withoutSemicolon.endsWith(')')){
      // Only relabel a valid JSONP response for the requested callback, never error JSON or HTML.
      try{JSON.parse(withoutSemicolon.slice(prefix.length,-1));return 'application/javascript; charset=utf-8';}catch{}
    }
  }
  return contentType||'application/octet-stream';
}
