// Sauvegarde quotidienne vers Cloudflare R2 (stockage prive) : toutes les tables en JSON compresse + documents des chauffeurs.
// Inactive tant que les variables R2_* ne sont pas definies sur le serveur. Les comptes de connexion (auth) ne sont pas
// exportes avec leurs mots de passe : en cas de restauration complete, les utilisateurs reinitialisent leur mot de passe.
const zlib = require('zlib');
const { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const TABLES = ['app_settings', 'profiles', 'rides', 'vehicles', 'pricing_simple', 'pricing_hourly', 'pricing_zones', 'forfaits',
  'driver_availability', 'driver_invitations', 'driver_documents', 'email_log'];
const KEEP_DAYS = 14;
const DOCS_BUCKET = 'driver-documents';

function r2() {
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  const account = process.env.R2_ACCOUNT_ID || '1807d1e8aa5adf4efaee870c2ace9e4b';
  return {
    bucket: R2_BUCKET,
    s3: new S3Client({ region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } }),
  };
}

const exists = (store, Key) => store.s3.send(new HeadObjectCommand({ Bucket: store.bucket, Key })).then(() => true, () => false);

async function exportTable(supabaseAdmin, table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`${table} : ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function listDocuments(supabaseAdmin, prefix = '') {
  const { data, error } = await supabaseAdmin.storage.from(DOCS_BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error('documents : ' + error.message);
  const files = [];
  for (const item of data ?? []) {
    if (item.id) files.push(prefix + item.name);
    else files.push(...(await listDocuments(supabaseAdmin, `${prefix}${item.name}/`)));
  }
  return files;
}

// Retourne { skipped } si R2 n'est pas configure, sinon un compte rendu.
async function runBackup(supabaseAdmin, { force = false } = {}) {
  const store = r2();
  if (!store) return { skipped: 'R2 non configure' };
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }); // AAAA-MM-JJ
  const key = `base/${day}.json.gz`;
  if (!force && (await exists(store, key))) return { skipped: 'deja faite aujourd\'hui' };

  const dump = { date: new Date().toISOString(), tables: {} };
  let rows = 0;
  for (const table of TABLES) {
    dump.tables[table] = await exportTable(supabaseAdmin, table);
    rows += dump.tables[table].length;
  }
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  dump.auth_users = (users?.users ?? []).map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, banned_until: u.banned_until }));
  await store.s3.send(new PutObjectCommand({ Bucket: store.bucket, Key: key, Body: zlib.gzipSync(JSON.stringify(dump)), ContentType: 'application/gzip' }));

  // Documents des chauffeurs : copie incrementale (un fichier n'est envoye qu'une fois).
  let copied = 0;
  for (const path of await listDocuments(supabaseAdmin)) {
    const docKey = `documents/${path}`;
    if (await exists(store, docKey)) continue;
    const { data: blob, error } = await supabaseAdmin.storage.from(DOCS_BUCKET).download(path);
    if (error) throw new Error(`document ${path} : ${error.message}`);
    await store.s3.send(new PutObjectCommand({ Bucket: store.bucket, Key: docKey, Body: Buffer.from(await blob.arrayBuffer()), ContentType: blob.type }));
    copied++;
  }

  // Ne garde que les 14 dernieres sauvegardes de la base.
  const { Contents = [] } = await store.s3.send(new ListObjectsV2Command({ Bucket: store.bucket, Prefix: 'base/' }));
  const old = Contents.map((o) => o.Key).sort().slice(0, -KEEP_DAYS);
  if (old.length) await store.s3.send(new DeleteObjectsCommand({ Bucket: store.bucket, Delete: { Objects: old.map((Key) => ({ Key })) } }));
  return { day, rows, documentsCopied: copied };
}

async function lastBackup() {
  const store = r2();
  if (!store) return null;
  const { Contents = [] } = await store.s3.send(new ListObjectsV2Command({ Bucket: store.bucket, Prefix: 'base/' }));
  return Contents.map((o) => o.Key).sort().pop()?.replace('base/', '').replace('.json.gz', '') ?? null;
}

function registerBackup(app, { supabaseAdmin, requireAdmin, sendAdminEmail }) {
  const run = async (force) => {
    try {
      const result = await runBackup(supabaseAdmin, { force });
      if (!result.skipped) await sendAdminEmail(`Sauvegarde du ${result.day} : OK`, `Base : ${result.rows} lignes sauvegardees.\nDocuments chauffeurs ajoutes : ${result.documentsCopied}.`);
      return result;
    } catch (e) {
      console.error('Sauvegarde en echec', e);
      await sendAdminEmail('ALERTE : la sauvegarde quotidienne a echoue', e.message);
      return { error: e.message };
    }
  };

  app.get('/admin/backup', requireAdmin, async (req, res) => {
    res.json({ configured: !!r2(), last: await lastBackup().catch(() => null) });
  });
  app.post('/admin/backup', requireAdmin, async (req, res) => {
    const result = await run(true);
    res.status(result.error ? 500 : 200).json(result);
  });

  // Une fois par jour, a partir de 3 h (heure de Paris), puis verification toutes les heures.
  const tick = () => {
    const hour = Number(new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }));
    if (hour >= 3) run(false);
  };
  setInterval(tick, 60 * 60 * 1000);
  setTimeout(tick, 60 * 1000);
}

module.exports = { registerBackup };
