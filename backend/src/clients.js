const { supabaseAdmin } = require('./supabaseAdmin');

// Telephone au format commun : +33612345678 (francais) ou +<indicatif><numero> (etranger). '' si inexploitable.
function normalizePhone(raw) {
  const s = String(raw ?? '').replace(/[\s.\-() \t]/g, '');
  if (!s || /[a-zA-Z]/.test(s)) return '';
  let d = s.replace(/\D/g, '');
  if (s.startsWith('+') || s.startsWith('00') || (!d.startsWith('0') && d.length >= 11)) {
    if (s.startsWith('00')) d = d.slice(2);
    if (d.startsWith('330')) d = '33' + d.slice(3);
    return d.length >= 8 && d.length <= 15 && !d.startsWith('0') ? '+' + d : '';
  }
  if (d.length === 9 && /^[1-9]/.test(d)) d = '0' + d;
  return /^0[1-9]\d{8}$/.test(d) ? '+33' + d.slice(1) : '';
}

// Retient (ou met a jour) un client saisi a la main, pour qu'il soit propose la fois suivante.
async function saveClient(name, phone, email) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim();
  const p = normalizePhone(phone);
  if (!n || !p) return;
  const e = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim()) ? email.trim().toLowerCase() : null;
  const { data: found } = await supabaseAdmin.from('clients').select('id, email, rides_count').eq('phone', p).ilike('name', n).limit(1);
  if (found?.length) {
    await supabaseAdmin.from('clients').update({ rides_count: found[0].rides_count + 1, ...(e && !found[0].email ? { email: e } : {}) }).eq('id', found[0].id);
  } else {
    await supabaseAdmin.from('clients').insert({ name: n, phone: p, email: e, rides_count: 1 });
  }
}

// Recherche par debut de nom (ou de numero), les clients les plus frequents d'abord.
function registerClients(app, requireStaff) {
  app.get('/clients/search', requireStaff, async (req, res) => {
    const q = String(req.query.q ?? '').trim().replace(/[%,()*]/g, ' ');
    if (q.length < 2) return res.json([]);
    const digits = q.replace(/\D/g, '');
    const filters = [`name.ilike.%${q}%`];
    if (digits.length >= 4) filters.push(`phone.ilike.%${digits.replace(/^0/, '')}%`);
    const { data } = await supabaseAdmin.from('clients').select('id, name, phone, email, status, rides_count').or(filters.join(',')).order('rides_count', { ascending: false }).limit(30);
    const lower = q.toLowerCase();
    // Les noms qui commencent par la saisie passent avant ceux qui la contiennent seulement.
    const starts = (c) => (c.name.toLowerCase().split(/[\s'-]+/).some((w) => w.startsWith(lower)) ? 0 : 1);
    res.json((data ?? []).sort((a, b) => starts(a) - starts(b) || b.rides_count - a.rides_count).slice(0, 8));
  });

  app.post('/clients/remember', requireStaff, async (req, res) => {
    await saveClient(req.body.name, req.body.phone, req.body.email).catch(() => {});
    res.json({ ok: true });
  });
}

module.exports = { registerClients, saveClient, normalizePhone };
