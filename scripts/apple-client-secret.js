// Fabrique le « Secret key » demande par Supabase pour « Se connecter avec Apple » (JWT valable 6 mois, maximum fixe par Apple).
// Usage : node scripts/apple-client-secret.js <chemin vers AuthKey_XXXX.p8>
// Le secret est copie dans le presse-papiers (jamais ecrit dans un fichier). A refaire tous les 6 mois et a recoller dans Supabase.
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const TEAM_ID = 'BBVQQMPNZY';
const KEY_ID = 'AAMKDQDJ6T';
const SERVICES_ID = 'com.rennesvtc.client.signin';
const DAYS = 180;

const file = process.argv[2];
if (!file) { console.error('Indiquez le chemin du fichier .p8'); process.exit(1); }
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const head = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
const body = b64({ iss: TEAM_ID, iat: now, exp: now + DAYS * 86400, aud: 'https://appleid.apple.com', sub: SERVICES_ID });
const signature = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: fs.readFileSync(file, 'utf8'), dsaEncoding: 'ieee-p1363' }).toString('base64url');
const jwt = `${head}.${body}.${signature}`;
execFileSync('clip', { input: jwt });
console.log(`Secret cree (${jwt.length} caracteres), copie dans le presse-papiers. Valable jusqu'au ${new Date((now + DAYS * 86400) * 1000).toLocaleDateString('fr-FR')}.`);
