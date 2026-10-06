import helmet from 'helmet';
import type {RequestHandler} from 'express';

export function createSecurityHeaders(web=false):RequestHandler {
  const common={
    contentSecurityPolicy:web||process.env.NODE_ENV!=='production'?false:undefined,
    referrerPolicy:{policy:'strict-origin-when-cross-origin' as const},
    originAgentCluster:false,
  };
  const https=helmet(common);
  const http=helmet({...common,crossOriginOpenerPolicy:false,strictTransportSecurity:false});
  // Express derives secure from the configured trusted proxy, never arbitrary forwarded headers.
  return (req,res,next)=>(req.secure?https:http)(req,res,next);
}
