// Envoie les variables EXPO_PUBLIC_* du .env d'une app vers les variables d'environnement EAS (builds preview et production).
// Les valeurs ne passent jamais par Git ni par l'affichage. Usage : node scripts/eas-env.js client   puis   node scripts/eas-env.js driver
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const app = process.argv[2];
if (!['client', 'driver'].includes(app)) throw new Error('Usage : node scripts/eas-env.js client|driver');
const dir = path.join(__dirname, '..', 'apps', app);

for (const line of fs.readFileSync(path.join(dir, '.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^(EXPO_PUBLIC_[A-Z_]+)=(.*)$/);
  if (!match) continue;
  const [, name, value] = match;
  const r = spawnSync('npx.cmd', ['--yes', 'eas-cli', 'env:create', '--name', name, '--value', value, '--environment', 'preview', '--environment', 'production', '--visibility', 'plaintext', '--force', '--non-interactive'], { cwd: dir, shell: true, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '--use-system-ca' } });
  console.log(r.status === 0 ? `ok   ${name}` : `ECHEC ${name} : ${(r.stderr || r.stdout || '').split('\n').filter((l) => !l.includes('npm warn')).slice(-3).join(' ').replace(value, '***')}`);
}
