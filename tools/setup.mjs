import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!existsSync('.env')) {
  writeFileSync('.env', `DATABASE_URL="file:./dev.db"\nJWT_SECRET="${randomBytes(48).toString('hex')}"\nPORT=3001\nWEB_ORIGIN="http://localhost:5173"\nNODE_ENV=development\nSEED_PASSWORD="${randomBytes(18).toString('base64url')}"\nAMAP_KEY=""\nAMAP_SECURITY_JS_CODE=""\nDEEPSEEK_API_KEY=""\nDEEPSEEK_BASE_URL="https://api.deepseek.com"\n`);
  console.log('Created local .env. The initial account password is stored in SEED_PASSWORD; see the local .env file.');
} else console.log('Existing .env preserved.');
if (!existsSync('prisma/dev.db')) writeFileSync('prisma/dev.db', '');
