// Activa/consulta el dominio público r2.dev de un bucket vía API de Cloudflare. Uso: node server/r2_public_url.mjs _V4
import { config } from 'dotenv'; import path from 'path'; import { fileURLToPath } from 'url';
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env'), quiet: true });
const sfx = process.argv[2] ?? '';
const clean = (v) => (v || '').replace(/^[A-Z0-9_]+:\s*/, '').trim();
const acc = clean(process.env['R2_ENDPOINT' + sfx]).match(/https?:\/\/([a-f0-9]{32})\./)?.[1];
const bucket = clean(process.env['R2_BUCKET_NAME' + sfx]);
const token = clean(process.env['R2_TOKEN' + sfx]);
const base = `https://api.cloudflare.com/client/v4/accounts/${acc}/r2/buckets/${bucket}/domains/managed`;
const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const show = async (r) => { const j = await r.json(); console.log(r.status, JSON.stringify(j.success ? j.result : j.errors)); return j; };
console.log('bucket', bucket);
await show(await fetch(base, { headers: h }));
if (process.argv[3] === 'enable') await show(await fetch(base, { method: 'PUT', headers: h, body: JSON.stringify({ enabled: true }) }));
