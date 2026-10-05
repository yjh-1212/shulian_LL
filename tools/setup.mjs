import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!existsSync('.env')) {
  writeFileSync('.env', `DATABASE_URL="file:./dev.db"\nJWT_SECRET="${randomBytes(48).toString('hex')}"\nPORT=3001\nAPI_HOST="0.0.0.0"\nWEB_HOST="0.0.0.0"\nWEB_ORIGIN="http://127.0.0.1:5173"\nDRIVER_ORIGIN="http://127.0.0.1:5174"\nTRUST_PROXY="loopback"\nCOOKIE_SECURE="auto"\nNODE_ENV=development\nSEED_PASSWORD="${randomBytes(18).toString('base64url')}"\nAMAP_JSAPI_KEY=""\nAMAP_WEB_SERVICE_KEY=""\nAMAP_SECURITY_JS_CODE=""\nDEEPSEEK_API_KEY=""\nDEEPSEEK_BASE_URL="https://api.deepseek.com"\n`);
  console.log('Created local .env. The initial account password is stored in SEED_PASSWORD; see the local .env file.');
} else console.log('Existing .env preserved.');
if (!existsSync('prisma/dev.db')) writeFileSync('prisma/dev.db', '');
