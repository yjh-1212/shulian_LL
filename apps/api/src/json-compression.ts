import {gzip, constants} from 'node:zlib';
import type {Request, Response, NextFunction} from 'express';

/** Compress JSON only; streamed answers, map scripts and file downloads keep their own transport. */
export function jsonCompression(req: Request, res: Response, next: NextFunction) {
  const original = res.json.bind(res);
  res.json = function (body: any) {
    res.vary('Accept-Encoding');
    if (req.method === 'HEAD' || res.statusCode === 204 || res.statusCode === 304 ||
        res.headersSent || res.getHeader('Content-Encoding') || req.acceptsEncodings('gzip') !== 'gzip') return original(body);
    const serialized = JSON.stringify(body);
    if (!serialized || Buffer.byteLength(serialized) < 1024) return original(body);
    gzip(serialized, {level: constants.Z_BEST_SPEED}, (error, bytes) => {
      if (res.destroyed) return;
      if (error) { original(body); return; }
      res.type('application/json');
      res.setHeader('Content-Encoding', 'gzip');
      res.removeHeader('Content-Length');
      res.send(bytes);
    });
    return res;
  };
  next();
}
