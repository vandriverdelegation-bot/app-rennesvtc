// Navettes evenementielles : back-office (reserve a l'admin). La page publique invite vient a l'etape 2.
const crypto = require('crypto');
const express = require('express');
const { supabaseAdmin } = require('./supabaseAdmin');

const LOGO_BUCKET = 'navette-logos';
const LOGO_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' };

// ---- Heures : tout est saisi et affiche a l'heure de Rennes, stocke en UTC.
function parisOffsetMin(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(date).map((x) => [x.type, x.value]));
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes())) / 60000;
}
// dateStr « 2026-11-21 » + minutes depuis minuit (peut depasser 1440 : apres minuit) -> instant UTC.
function parisToUtc(dateStr, minutes) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d) + minutes * 60000;
  const first = wall - parisOffsetMin(new Date(wall)) * 60000;
  return new Date(wall - parisOffsetMin(new Date(first)) * 60000);
}
const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
};
// Liste des heures de depart entre debut et fin (apres minuit gere : 23:00 -> 03:00 = fin le lendemain).
function departureMinutes(start, end, every) {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (s == null || e == null || !(every >= 5 && every <= 600)) return null;
  if (e <= s) e += 1440;
  const list = [];
  for (let t = s; t <= e && list.length < 200; t += every) list.push(t);
  return list;
}

const newCode = () => crypto.randomBytes(9).toString('base64url'); // 12 caracteres, non devinable
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const clean = (v, max = 300) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max); return s || null; };

function eventPayload(b, partial) {
  const out = {};
  const set = (k, v) => { if (!partial || b[k] !== undefined) out[k] = v; };
  set('name', clean(b.name, 120));
  set('type', ['mariage', 'entreprise'].includes(b.type) ? b.type : 'entreprise');
  set('event_date', /^\d{4}-\d{2}-\d{2}$/.test(b.event_date ?? '') ? b.event_date : null);
  set('pickup_place', clean(b.pickup_place));
  set('destination', clean(b.destination));
  set('welcome_message', b.welcome_message == null ? null : String(b.welcome_message).trim().slice(0, 1000) || null);
  set('pin', /^\d{4}$/.test(String(b.pin ?? '')) ? String(b.pin) : null);
  set('status', ['ouvert', 'ferme', 'termine'].includes(b.status) ? b.status : 'ouvert');
  set('close_minutes', Math.min(Math.max(parseInt(b.close_minutes, 10) || 0, 0), 1440));
  set('client_id', isUuid(b.client_id) ? b.client_id : null);
  set('ride_id', isUuid(b.ride_id) ? b.ride_id : null);
  return out;
}

function registerNavettes(app, requireAdmin, baseUrl) {
  const publicUrl = (code) => `${baseUrl}/navette/${code}`;

  // Evenement + departs, avec le nombre de places prises par depart.
  async function loadEvent(id) {
    const { data: event } = await supabaseAdmin.from('navette_events').select('*').eq('id', id).single();
    if (!event) return null;
    const { data: departures } = await supabaseAdmin.from('navette_departures').select('*').eq('event_id', id).order('departs_at', { ascending: true });
    const ids = (departures ?? []).map((d) => d.id);
    const { data: signups } = ids.length ? await supabaseAdmin.from('navette_signups').select('departure_id, seats').in('departure_id', ids) : { data: [] };
    const taken = {};
    (signups ?? []).forEach((s) => { taken[s.departure_id] = (taken[s.departure_id] ?? 0) + s.seats; });
    return { ...event, public_url: publicUrl(event.code), departures: (departures ?? []).map((d) => ({ ...d, taken: taken[d.id] ?? 0 })) };
  }

  // Listes de choix du formulaire : clients, reservations recentes, vehicules, chauffeurs.
  app.get('/admin/navettes/lookups', requireAdmin, async (req, res) => {
    const [clients, rides, vehicles, drivers] = await Promise.all([
      supabaseAdmin.from('clients').select('id, name').order('name', { ascending: true }).limit(500),
      supabaseAdmin.from('rides').select('id, client_name, pickup_address, dropoff_address, scheduled_at').order('created_at', { ascending: false }).limit(80),
      supabaseAdmin.from('vehicles').select('id, display_name, plate, seats, driver_id').order('display_name', { ascending: true }),
      supabaseAdmin.from('profiles').select('id, full_name, email').eq('role', 'chauffeur').order('full_name', { ascending: true }),
    ]);
    res.json({ clients: clients.data ?? [], rides: rides.data ?? [], vehicles: vehicles.data ?? [], drivers: drivers.data ?? [] });
  });

  app.get('/admin/navettes/events', requireAdmin, async (req, res) => {
    const { data: events } = await supabaseAdmin.from('navette_events').select('*').order('event_date', { ascending: false });
    const ids = (events ?? []).map((e) => e.id);
    const { data: deps } = ids.length ? await supabaseAdmin.from('navette_departures').select('id, event_id, seats').in('event_id', ids) : { data: [] };
    const depIds = (deps ?? []).map((d) => d.id);
    const { data: signups } = depIds.length ? await supabaseAdmin.from('navette_signups').select('departure_id, seats').in('departure_id', depIds) : { data: [] };
    const takenByDep = {};
    (signups ?? []).forEach((s) => { takenByDep[s.departure_id] = (takenByDep[s.departure_id] ?? 0) + s.seats; });
    res.json((events ?? []).map((e) => {
      const mine = (deps ?? []).filter((d) => d.event_id === e.id);
      return { ...e, public_url: publicUrl(e.code), departures_count: mine.length, seats_total: mine.reduce((a, d) => a + d.seats, 0), seats_taken: mine.reduce((a, d) => a + (takenByDep[d.id] ?? 0), 0) };
    }));
  });

  app.post('/admin/navettes/events', requireAdmin, async (req, res) => {
    const row = eventPayload(req.body, false);
    if (!row.name) return res.status(400).json({ error: "Donnez un nom a l'evenement." });
    if (!row.event_date) return res.status(400).json({ error: "Indiquez la date de l'evenement." });
    const { data, error } = await supabaseAdmin.from('navette_events').insert({ ...row, code: newCode() }).select('id').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(await loadEvent(data.id));
  });

  app.get('/admin/navettes/events/:id', requireAdmin, async (req, res) => {
    const event = isUuid(req.params.id) ? await loadEvent(req.params.id) : null;
    if (!event) return res.status(404).json({ error: 'Evenement introuvable' });
    res.json(event);
  });

  app.patch('/admin/navettes/events/:id', requireAdmin, async (req, res) => {
    const patch = eventPayload(req.body, true);
    if ('name' in patch && !patch.name) return res.status(400).json({ error: "Le nom de l'evenement est obligatoire." });
    if ('event_date' in patch && !patch.event_date) return res.status(400).json({ error: "La date de l'evenement est invalide." });
    // Changer le jour de l'evenement decale tous ses departs du meme nombre de jours (heures inchangees).
    const { data: before } = await supabaseAdmin.from('navette_events').select('event_date').eq('id', req.params.id).single();
    if (!before) return res.status(404).json({ error: 'Evenement introuvable' });
    const { error } = await supabaseAdmin.from('navette_events').update(patch).eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    if (patch.event_date && patch.event_date !== before.event_date) {
      const { data: deps } = await supabaseAdmin.from('navette_departures').select('id, departs_at').eq('event_id', req.params.id);
      for (const d of deps ?? []) {
        const mins = Math.round((new Date(d.departs_at) - parisToUtc(before.event_date, 0)) / 60000);
        await supabaseAdmin.from('navette_departures').update({ departs_at: parisToUtc(patch.event_date, mins).toISOString() }).eq('id', d.id);
      }
    }
    res.json(await loadEvent(req.params.id));
  });

  app.delete('/admin/navettes/events/:id', requireAdmin, async (req, res) => {
    const event = await loadEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evenement introuvable' });
    const { error } = await supabaseAdmin.from('navette_events').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    if (event.logo_url) await removeLogoFile(event.logo_url);
    res.json({ ok: true });
  });

  // ---- Departs
  async function seatsFor(vehicleId, fallback) {
    if (fallback) return fallback;
    if (isUuid(vehicleId)) {
      const { data } = await supabaseAdmin.from('vehicles').select('seats').eq('id', vehicleId).single();
      if (data?.seats) return data.seats;
    }
    return 8;
  }

  // Genere les departs entre deux heures a frequence reguliere (les departs deja presents a la meme heure sont conserves).
  app.post('/admin/navettes/events/:id/generate', requireAdmin, async (req, res) => {
    const event = await loadEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evenement introuvable' });
    const every = parseInt(req.body.every, 10);
    const list = departureMinutes(req.body.start, req.body.end, every);
    if (!list) return res.status(400).json({ error: 'Indiquez une heure de debut, une heure de fin et une frequence (5 minutes au moins).' });
    const seats = await seatsFor(req.body.vehicle_id, parseInt(req.body.seats, 10) || 0);
    const existing = new Set(event.departures.map((d) => new Date(d.departs_at).getTime()));
    const rows = list.map((t) => parisToUtc(event.event_date, t)).filter((d) => !existing.has(d.getTime())).map((d) => ({
      event_id: event.id, departs_at: d.toISOString(), seats,
      vehicle_id: isUuid(req.body.vehicle_id) ? req.body.vehicle_id : null,
      driver_id: isUuid(req.body.driver_id) ? req.body.driver_id : null,
    }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from('navette_departures').insert(rows);
      if (error) return res.status(400).json({ error: error.message });
    }
    res.json({ ...(await loadEvent(event.id)), created: rows.length });
  });

  // Ajoute un depart a la main (heure HH:MM ; next_day = apres minuit, le lendemain du jour de l'evenement).
  app.post('/admin/navettes/events/:id/departures', requireAdmin, async (req, res) => {
    const event = await loadEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evenement introuvable' });
    const t = toMinutes(req.body.time);
    if (t == null) return res.status(400).json({ error: "Heure invalide (format 23:30)." });
    const seats = await seatsFor(req.body.vehicle_id, parseInt(req.body.seats, 10) || 0);
    const { error } = await supabaseAdmin.from('navette_departures').insert({
      event_id: event.id, departs_at: parisToUtc(event.event_date, t + (req.body.next_day ? 1440 : 0)).toISOString(), seats,
      vehicle_id: isUuid(req.body.vehicle_id) ? req.body.vehicle_id : null, driver_id: isUuid(req.body.driver_id) ? req.body.driver_id : null,
    });
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(await loadEvent(event.id));
  });

  // Decale tous les departs de l'evenement (minutes positives ou negatives).
  app.post('/admin/navettes/events/:id/shift', requireAdmin, async (req, res) => {
    const minutes = parseInt(req.body.minutes, 10);
    if (!minutes || Math.abs(minutes) > 720) return res.status(400).json({ error: 'Indiquez un decalage en minutes (par exemple 15 ou -10).' });
    const event = await loadEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evenement introuvable' });
    for (const d of event.departures) {
      await supabaseAdmin.from('navette_departures').update({ departs_at: new Date(new Date(d.departs_at).getTime() + minutes * 60000).toISOString() }).eq('id', d.id);
    }
    res.json(await loadEvent(event.id));
  });

  async function loadDeparture(id) {
    if (!isUuid(id)) return null;
    const { data: dep } = await supabaseAdmin.from('navette_departures').select('*').eq('id', id).single();
    if (!dep) return null;
    const { data: signups } = await supabaseAdmin.from('navette_signups').select('seats').eq('departure_id', id);
    return { ...dep, taken: (signups ?? []).reduce((a, s) => a + s.seats, 0) };
  }

  app.patch('/admin/navettes/departures/:id', requireAdmin, async (req, res) => {
    const dep = await loadDeparture(req.params.id);
    if (!dep) return res.status(404).json({ error: 'Depart introuvable' });
    const { data: event } = await supabaseAdmin.from('navette_events').select('event_date').eq('id', dep.event_id).single();
    const patch = {};
    if (req.body.time !== undefined) {
      const t = toMinutes(req.body.time);
      if (t == null) return res.status(400).json({ error: 'Heure invalide (format 23:30).' });
      patch.departs_at = parisToUtc(event.event_date, t + (req.body.next_day ? 1440 : 0)).toISOString();
    }
    if (req.body.seats !== undefined) {
      const seats = parseInt(req.body.seats, 10);
      if (!(seats >= 1 && seats <= 500)) return res.status(400).json({ error: 'Nombre de places invalide.' });
      if (seats < dep.taken) return res.status(400).json({ error: `${dep.taken} place(s) sont deja reservees : impossible de descendre sous ce nombre.` });
      patch.seats = seats;
    }
    if (req.body.vehicle_id !== undefined) patch.vehicle_id = isUuid(req.body.vehicle_id) ? req.body.vehicle_id : null;
    if (req.body.driver_id !== undefined) patch.driver_id = isUuid(req.body.driver_id) ? req.body.driver_id : null;
    if (req.body.status !== undefined) {
      if (!['ouvert', 'ferme', 'complet'].includes(req.body.status)) return res.status(400).json({ error: 'Etat invalide.' });
      patch.status = req.body.status;
    }
    const { error } = await supabaseAdmin.from('navette_departures').update(patch).eq('id', dep.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json(await loadEvent(dep.event_id));
  });

  app.delete('/admin/navettes/departures/:id', requireAdmin, async (req, res) => {
    const dep = await loadDeparture(req.params.id);
    if (!dep) return res.status(404).json({ error: 'Depart introuvable' });
    if (dep.taken > 0) return res.status(400).json({ error: 'Ce depart a des inscrits : deplacez ou retirez-les d\'abord (etape suivi de soiree).' });
    await supabaseAdmin.from('navette_departures').delete().eq('id', dep.id);
    res.json(await loadEvent(dep.event_id));
  });

  // ---- Logo : image brute envoyee par le navigateur (PNG, JPG ou SVG), reduite et allegee en WebP (400 px max).
  async function ensureBucket() {
    const { error } = await supabaseAdmin.storage.createBucket(LOGO_BUCKET, { public: true });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  async function removeLogoFile(url) {
    const file = String(url).split(`/${LOGO_BUCKET}/`)[1];
    if (file) await supabaseAdmin.storage.from(LOGO_BUCKET).remove([decodeURIComponent(file.split('?')[0])]);
  }

  app.post('/admin/navettes/events/:id/logo', requireAdmin, express.raw({ type: () => true, limit: '6mb' }), async (req, res) => {
    const event = await loadEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evenement introuvable' });
    const type = String(req.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!LOGO_TYPES[type] || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Envoyez une image PNG, JPG ou SVG (6 Mo maximum).' });
    try {
      const webp = await require('sharp')(req.body, type === 'image/svg+xml' ? { density: 300 } : {})
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 }).toBuffer();
      await ensureBucket();
      const path = `${event.id}-${Date.now()}.webp`;
      const { error } = await supabaseAdmin.storage.from(LOGO_BUCKET).upload(path, webp, { contentType: 'image/webp', upsert: true });
      if (error) throw error;
      const url = supabaseAdmin.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
      await supabaseAdmin.from('navette_events').update({ logo_url: url }).eq('id', event.id);
      if (event.logo_url) await removeLogoFile(event.logo_url);
      res.json({ logo_url: url, bytes: webp.length });
    } catch (e) {
      console.error('logo navette :', e.message);
      res.status(400).json({ error: "Image illisible ou trop lourde. Essayez un autre fichier." });
    }
  });

  app.delete('/admin/navettes/events/:id/logo', requireAdmin, async (req, res) => {
    const event = await loadEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evenement introuvable' });
    if (event.logo_url) await removeLogoFile(event.logo_url);
    await supabaseAdmin.from('navette_events').update({ logo_url: null }).eq('id', event.id);
    res.json({ ok: true });
  });
}

module.exports = { registerNavettes, parisToUtc, departureMinutes, toMinutes };
