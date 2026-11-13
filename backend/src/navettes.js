// Navettes evenementielles : back-office (reserve a l'admin). La page publique invite vient a l'etape 2.
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const { supabaseAdmin } = require('./supabaseAdmin');
const { buildChevaletPdf } = require('./chevalet');

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

const hmParis = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
// Message affiche a l'invite sur sa page (jusqu'a ce qu'il l'ait lu).
async function notifySignups(filter, text) {
  let q = supabaseAdmin.from('navette_signups').update({ notice: text });
  q = Array.isArray(filter) ? q.in('id', filter) : q.eq('departure_id', filter);
  await q;
}
// Departs a moins de 25 % de remplissage a moins d'une heure du depart (et encore ouverts).
function lowFill(departures, taken, now = Date.now()) {
  return departures.filter((d) => {
    const mins = (new Date(d.departs_at).getTime() - now) / 60000;
    return d.status !== 'ferme' && mins > 0 && mins <= 60 && (taken[d.id] ?? 0) < d.seats * 0.25;
  }).map((d) => ({ departure_id: d.id, time: hmParis(d.departs_at), taken: taken[d.id] ?? 0, seats: d.seats }));
}
const newCode = () => crypto.randomBytes(9).toString('base64url'); // 12 caracteres, non devinable
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const clean = (v, max = 300) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max); return s || null; };

function eventPayload(b, partial) {
  const out = {};
  const set = (k, v) => { if (!partial || b[k] !== undefined) out[k] = v; };
  set('name', clean(b.name, 120));
  set('type', ['mariage', 'entreprise', 'evenement'].includes(b.type) ? b.type : 'evenement');
  set('event_date', /^\d{4}-\d{2}-\d{2}$/.test(b.event_date ?? '') ? b.event_date : null);
  set('pickup_place', clean(b.pickup_place));
  set('destination', clean(b.destination));
  set('welcome_message', b.welcome_message == null ? null : String(b.welcome_message).trim().slice(0, 1000) || null);
  set('pin', /^\d{4}$/.test(String(b.pin ?? '')) ? String(b.pin) : null);
  set('status', ['ouvert', 'ferme', 'termine'].includes(b.status) ? b.status : 'ouvert');
  set('close_minutes', Math.min(Math.max(parseInt(b.close_minutes, 10) || 0, 0), 1440));
  set('max_party', Math.min(Math.max(parseInt(b.max_party, 10) || 4, 1), 10));
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
    const { data: deps } = ids.length ? await supabaseAdmin.from('navette_departures').select('id, event_id, seats, departs_at, status').in('event_id', ids) : { data: [] };
    const depIds = (deps ?? []).map((d) => d.id);
    const { data: signups } = depIds.length ? await supabaseAdmin.from('navette_signups').select('departure_id, seats').in('departure_id', depIds) : { data: [] };
    const takenByDep = {};
    (signups ?? []).forEach((s) => { takenByDep[s.departure_id] = (takenByDep[s.departure_id] ?? 0) + s.seats; });
    res.json((events ?? []).map((e) => {
      const mine = (deps ?? []).filter((d) => d.event_id === e.id);
      return { ...e, public_url: publicUrl(e.code), departures_count: mine.length, seats_total: mine.reduce((a, d) => a + d.seats, 0), seats_taken: mine.reduce((a, d) => a + (takenByDep[d.id] ?? 0), 0), alerts_count: e.status === 'ouvert' ? lowFill(mine, takenByDep).length : 0 };
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
      const next = new Date(new Date(d.departs_at).getTime() + minutes * 60000).toISOString();
      await supabaseAdmin.from('navette_departures').update({ departs_at: next }).eq('id', d.id);
      if (d.taken > 0) await notifySignups(d.id, `Votre navette a changé : le départ est maintenant à ${hmParis(next)}.`);
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
    if (patch.departs_at && new Date(patch.departs_at).getTime() !== new Date(dep.departs_at).getTime() && dep.taken > 0) {
      await notifySignups(dep.id, `Votre navette a changé : le départ est maintenant à ${hmParis(patch.departs_at)}.`);
    }
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

  // ---- Suivi de soirée : evenement, departs et invites (noms complets), avec la case « monte ».
  app.get('/admin/navettes/events/:id/live', requireAdmin, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const event = isUuid(req.params.id) ? await loadEvent(req.params.id) : null;
    if (!event) return res.status(404).json({ error: 'Evenement introuvable' });
    const ids = event.departures.map((d) => d.id);
    const { data: signups } = ids.length ? await supabaseAdmin.from('navette_signups').select('id, departure_id, first_name, last_name, seats, boarded, created_at').in('departure_id', ids).order('created_at', { ascending: true }) : { data: [] };
    const taken = {};
    (signups ?? []).forEach((x) => { taken[x.departure_id] = (taken[x.departure_id] ?? 0) + x.seats; });
    res.json({ event, signups: signups ?? [], alerts: event.status === 'ouvert' ? lowFill(event.departures, taken) : [] });
  });

  const ADMIN_ERRORS = {
    full: (r) => `Plus assez de places sur ce depart (${r.remaining ?? 0} restante(s)).`,
    no_room: (r) => `Impossible de regrouper : ${r.needed} passager(s) a deplacer, mais seulement ${r.remaining} place(s) libre(s) sur l'autre depart.`,
    departure_not_found: () => 'Depart introuvable.', signup_not_found: () => 'Inscription introuvable.', same_departure: () => 'Choisissez un autre depart.', bad_seats: () => 'Nombre de places invalide.',
  };
  const adminFail = (res, r) => res.status(r.error === 'signup_not_found' || r.error === 'departure_not_found' ? 404 : 409).json({ error: (ADMIN_ERRORS[r.error] ?? (() => 'Operation impossible.'))(r), code: r.error });

  // Modifie un invite : case « monte » et/ou deplacement vers un autre depart (l'invite en est prevenu sur sa page).
  app.patch('/admin/navettes/signups/:id', requireAdmin, async (req, res) => {
    const moving = req.body.departure_id !== undefined;
    if (!isUuid(req.params.id) || (typeof req.body.boarded !== 'boolean' && !moving) || (moving && !isUuid(req.body.departure_id))) return res.status(400).json({ error: 'Demande invalide.' });
    if (moving) {
      const { data, error } = await supabaseAdmin.rpc('navette_admin_move', { p_signup: req.params.id, p_departure: req.body.departure_id });
      if (error) { console.error('navette_admin_move :', error.message); return res.status(500).json({ error: 'Deplacement impossible pour le moment.' }); }
      if (!data.ok) return adminFail(res, data);
      if (!data.unchanged) {
        const { data: dep } = await supabaseAdmin.from('navette_departures').select('departs_at').eq('id', req.body.departure_id).single();
        await notifySignups([req.params.id], `Votre navette a changé : nouveau départ à ${hmParis(dep.departs_at)}.`);
      }
    }
    if (typeof req.body.boarded === 'boolean') {
      const { error } = await supabaseAdmin.from('navette_signups').update({ boarded: req.body.boarded }).eq('id', req.params.id);
      if (error) return res.status(400).json({ error: error.message });
    }
    const { data } = await supabaseAdmin.from('navette_signups').select('id, boarded, departure_id').eq('id', req.params.id).single();
    if (!data) return res.status(404).json({ error: 'Inscription introuvable' });
    res.json(data);
  });

  app.delete('/admin/navettes/signups/:id', requireAdmin, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Demande invalide.' });
    const { data } = await supabaseAdmin.from('navette_signups').delete().eq('id', req.params.id).select('id');
    if (!data?.length) return res.status(404).json({ error: 'Inscription introuvable' });
    res.json({ ok: true });
  });

  // Ajoute un passager a la main sur un depart.
  app.post('/admin/navettes/departures/:id/passengers', requireAdmin, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Demande invalide.' });
    const first = cleanName(req.body.first_name), last = cleanName(req.body.last_name), seats = parseInt(req.body.seats, 10) || 1;
    if (!first || !last) return res.status(400).json({ error: 'Indiquez un prenom et un nom (lettres uniquement).' });
    const { data, error } = await supabaseAdmin.rpc('navette_admin_add', { p_departure: req.params.id, p_first: first, p_last: last, p_seats: seats });
    if (error) { console.error('navette_admin_add :', error.message); return res.status(500).json({ error: 'Ajout impossible pour le moment.' }); }
    if (!data.ok) return adminFail(res, data);
    res.status(201).json({ id: data.id, remaining: data.remaining });
  });

  // Regroupe : tous les passagers d'un depart partent sur un autre depart (refuse si la place manque) ; ils en sont prevenus.
  app.post('/admin/navettes/departures/:id/merge', requireAdmin, async (req, res) => {
    if (!isUuid(req.params.id) || !isUuid(req.body.to)) return res.status(400).json({ error: 'Demande invalide.' });
    const { data: moved } = await supabaseAdmin.from('navette_signups').select('id').eq('departure_id', req.params.id);
    const { data, error } = await supabaseAdmin.rpc('navette_merge', { p_from: req.params.id, p_to: req.body.to });
    if (error) { console.error('navette_merge :', error.message); return res.status(500).json({ error: 'Regroupement impossible pour le moment.' }); }
    if (!data.ok) return adminFail(res, data);
    const { data: dep } = await supabaseAdmin.from('navette_departures').select('departs_at').eq('id', req.body.to).single();
    if (moved?.length) await notifySignups(moved.map((m) => m.id), `Votre navette a changé : nouveau départ à ${hmParis(dep.departs_at)}.`);
    res.json({ ok: true, moved: data.moved, passengers: data.passengers });
  });

  // Coche / decoche tous les invites d'un depart.
  app.post('/admin/navettes/departures/:id/boarded', requireAdmin, async (req, res) => {
    if (!isUuid(req.params.id) || typeof req.body.boarded !== 'boolean') return res.status(400).json({ error: 'Demande invalide.' });
    const { error } = await supabaseAdmin.from('navette_signups').update({ boarded: req.body.boarded }).eq('departure_id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  });

  // ---- Partage : QR code du lien public et chevalet imprimable (PDF A5 ou A6).
  const qrPng = (url) => require('qrcode').toBuffer(url, { type: 'png', errorCorrectionLevel: 'M', margin: 1, width: 900 });
  // Image distante (logo) -> PNG pour le PDF ; null si indisponible.
  async function logoPng(url) {
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await require('sharp')(Buffer.from(await res.arrayBuffer())).png().toBuffer();
    } catch { return null; }
  }

  app.get('/admin/navettes/events/:id/qr.png', requireAdmin, async (req, res) => {
    const event = isUuid(req.params.id) ? await loadEvent(req.params.id) : null;
    if (!event) return res.status(404).json({ error: 'Evenement introuvable' });
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }).send(await qrPng(event.public_url));
  });

  app.get('/admin/navettes/events/:id/chevalet.pdf', requireAdmin, async (req, res) => {
    const event = isUuid(req.params.id) ? await loadEvent(req.params.id) : null;
    if (!event) return res.status(404).json({ error: 'Evenement introuvable' });
    const format = String(req.query.format).toLowerCase() === 'a6' ? 'a6' : 'a5';
    try {
      const { data: settings } = await supabaseAdmin.from('app_settings').select('logo_url').eq('id', true).single();
      const [qr, rvtcLogo, eventLogo] = await Promise.all([qrPng(event.public_url), logoPng(settings?.logo_url), logoPng(event.logo_url)]);
      const pdf = await buildChevaletPdf({ event, format, qrPng: qr, rvtcLogo, eventLogo });
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="chevalet-navette-${format}.pdf"`, 'Cache-Control': 'no-store' }).send(pdf);
    } catch (e) {
      console.error('chevalet navette :', e.message);
      res.status(500).json({ error: 'Impossible de generer le chevalet.' });
    }
  });

  registerGuest(app);
}

// ---- Page publique invite : /navette/{code} (aucun compte ; le code du lien et, si defini, le PIN donnent l'acces).
const windows = new Map();
// Compteur par fenetre de temps (en memoire). shortcut: un seul serveur Render ; a remplacer par un stockage partage si on passe a plusieurs instances.
function allow(key, max, windowMs) {
  const now = Date.now();
  const e = windows.get(key);
  if (!e || e.reset < now) { windows.set(key, { n: 1, reset: now + windowMs }); return true; }
  e.n += 1;
  return e.n <= max;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of windows) if (v.reset < n) windows.delete(k); }, 60000).unref();

const MESSAGES = {
  departure_not_found: 'Ce départ n\'existe plus. Actualisez la page.',
  event_closed: 'Les inscriptions sont fermées pour cet événement.',
  departure_closed: 'Les inscriptions pour ce départ sont fermées. Choisissez un autre départ.',
  bad_seats: 'Nombre de places invalide.',
  device_limit: 'Vous avez atteint le nombre maximum d\'inscriptions depuis cet appareil.',
  full: 'Ce départ vient d\'être complété (ou n\'a plus assez de places). Choisissez un autre départ.',
  signup_not_found: 'Inscription introuvable : elle a peut-être déjà été annulée.',
};
const STATUS_HTTP = { full: 409, departure_closed: 403, event_closed: 403, signup_not_found: 404, departure_not_found: 404 };

const samePin = (given, pin) => {
  const a = Buffer.from(String(given ?? '').padEnd(8, ' ')); const b = Buffer.from(String(pin).padEnd(8, ' '));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const cleanName = (v) => {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim();
  return t.length >= 1 && t.length <= 60 && /^[\p{L}\p{M}' .-]+$/u.test(t) ? t : null;
};

let brandCache = { at: 0, data: null };
async function brand() {
  if (Date.now() - brandCache.at > 300000) {
    const { data } = await supabaseAdmin.from('app_settings').select('logo_url, app_name').eq('id', true).single();
    brandCache = { at: Date.now(), data: data ?? {} };
  }
  return brandCache.data;
}

function registerGuest(app) {
  const page = path.join(__dirname, '../public/navette/index.html');
  app.get('/navette/:code', (req, res) => res.set('Cache-Control', 'no-store').sendFile(page));

  async function eventByCode(code) {
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(String(code))) return null;
    const { data } = await supabaseAdmin.from('navette_events').select('*').eq('code', code).single();
    return data ?? null;
  }
  // Acces : code PIN eventuel (en-tete ou corps), avec limite de tentatives par appareil/reseau.
  function pinGate(req, ev, given) {
    if (!ev.pin || ev.status === 'termine') return { ok: true };
    if (!given) return { ok: false, status: 401, body: { needPin: true } };
    if (samePin(given, ev.pin)) return { ok: true };
    if (!allow('pin:' + req.ip + ':' + ev.id, 10, 600000)) return { ok: false, status: 429, body: { error: 'Trop d\'essais. Réessayez dans quelques minutes.' } };
    return { ok: false, status: 401, body: { needPin: true, wrong: true } };
  }
  const header = (ev, b) => ({ name: ev.name, logo_url: ev.logo_url, rvtc_logo: b.logo_url ?? null });

  app.get('/public/navette/:code', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!allow('read:' + req.ip, 600, 60000)) return res.status(429).json({ error: 'Trop de requêtes, patientez un instant.' });
    const ev = await eventByCode(req.params.code);
    if (!ev) return res.status(404).json({ error: 'Lien invalide ou événement introuvable.' });
    const b = await brand();
    const gate = pinGate(req, ev, req.get('x-navette-pin'));
    if (!gate.ok) return res.status(gate.status).json({ ...gate.body, event: header(ev, b) });

    const base = { event: { ...header(ev, b), type: ev.type, status: ev.status, event_date: ev.event_date, pickup_place: ev.pickup_place, destination: ev.destination, welcome_message: ev.welcome_message, max_party: ev.max_party }, server_time: new Date().toISOString() };
    if (ev.status === 'termine') return res.json({ ...base, departures: [], me: null });

    const { data: deps } = await supabaseAdmin.from('navette_departures').select('id, departs_at, seats, status').eq('event_id', ev.id).order('departs_at', { ascending: true });
    const ids = (deps ?? []).map((d) => d.id);
    const { data: signups } = ids.length ? await supabaseAdmin.from('navette_signups').select('departure_id, first_name, last_name, seats, token, notice').in('departure_id', ids).order('created_at', { ascending: true }) : { data: [] };
    const myToken = String(req.get('x-navette-token') ?? '');
    const now = Date.now();
    const evDay = ev.event_date;
    const departures = (deps ?? []).map((d) => {
      const mine = (signups ?? []).filter((x) => x.departure_id === d.id);
      const taken = mine.reduce((a, x) => a + x.seats, 0);
      const closed = ev.status !== 'ouvert' || d.status === 'ferme' || now >= new Date(d.departs_at).getTime() - ev.close_minutes * 60000;
      const full = d.status === 'complet' || taken >= d.seats;
      const iso = new Date(d.departs_at);
      return {
        id: d.id, time: iso.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }),
        next_day: iso.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }) !== evDay,
        seats: d.seats, taken, remaining: d.status === 'complet' ? 0 : Math.max(d.seats - taken, 0),
        state: closed ? 'ferme' : full ? 'complet' : 'ouvert',
        names: mine.map((x) => ({ name: `${x.first_name} ${x.last_name}`, seats: x.seats })),
      };
    });
    const me = myToken ? (signups ?? []).find((x) => x.token === myToken) : null;
    res.json({ ...base, departures, me: me ? { token: me.token, departure_id: me.departure_id, first_name: me.first_name, last_name: me.last_name, seats: me.seats, notice: me.notice ?? null } : null });
  });

  function fail(res, result) {
    res.status(STATUS_HTTP[result.error] ?? 400).json({ error: MESSAGES[result.error] ?? 'Inscription impossible.', code: result.error, remaining: result.remaining, max: result.max });
  }

  app.post('/public/navette/:code/signup', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!allow('write:' + req.ip, 40, 300000)) return res.status(429).json({ error: 'Trop de tentatives, patientez quelques minutes.' });
    const ev = await eventByCode(req.params.code);
    if (!ev) return res.status(404).json({ error: 'Lien invalide ou événement introuvable.' });
    const gate = pinGate(req, ev, req.body?.pin);
    if (!gate.ok) return res.status(gate.status).json(gate.body);
    const first = cleanName(req.body?.first_name), last = cleanName(req.body?.last_name);
    if (!first || !last) return res.status(400).json({ error: 'Indiquez votre prénom et votre nom (lettres uniquement).' });
    const seats = parseInt(req.body?.seats, 10);
    if (!(seats >= 1)) return res.status(400).json({ error: 'Indiquez le nombre de places.' });
    const device = /^[A-Za-z0-9-]{8,64}$/.test(String(req.body?.device ?? '')) ? req.body.device : null;
    if (!/^[0-9a-f-]{36}$/i.test(String(req.body?.departure_id ?? ''))) return res.status(400).json({ error: 'Départ invalide.' });
    const { data, error } = await supabaseAdmin.rpc('navette_signup', { p_event: ev.id, p_departure: req.body.departure_id, p_first: first, p_last: last, p_seats: seats, p_phone: null, p_device: device });
    if (error) { console.error('navette_signup :', error.message); return res.status(500).json({ error: 'Inscription impossible pour le moment.' }); }
    if (!data.ok) return fail(res, data);
    res.status(201).json({ token: data.token, remaining: data.remaining });
  });

  // Changer de depart (ou de nombre de places) avec le jeton de l'invite.
  app.patch('/public/navette/:code/signup/:token', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!allow('write:' + req.ip, 40, 300000)) return res.status(429).json({ error: 'Trop de tentatives, patientez quelques minutes.' });
    const ev = await eventByCode(req.params.code);
    if (!ev) return res.status(404).json({ error: 'Lien invalide ou événement introuvable.' });
    const gate = pinGate(req, ev, req.body?.pin);
    if (!gate.ok) return res.status(gate.status).json(gate.body);
    const seats = parseInt(req.body?.seats, 10);
    if (!(seats >= 1) || !/^[0-9a-f-]{36}$/i.test(String(req.body?.departure_id ?? ''))) return res.status(400).json({ error: 'Demande invalide.' });
    const { data, error } = await supabaseAdmin.rpc('navette_move', { p_event: ev.id, p_token: req.params.token, p_departure: req.body.departure_id, p_seats: seats });
    if (error) { console.error('navette_move :', error.message); return res.status(500).json({ error: 'Changement impossible pour le moment.' }); }
    if (!data.ok) return fail(res, data);
    res.json({ token: data.token, remaining: data.remaining });
  });

  // L'invite a lu le message de changement : il disparait de sa page.
  app.post('/public/navette/:code/signup/:token/ack', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!allow('write:' + req.ip, 40, 300000)) return res.status(429).json({ error: 'Trop de tentatives, patientez quelques minutes.' });
    const ev = await eventByCode(req.params.code);
    if (!ev) return res.status(404).json({ error: 'Lien invalide ou événement introuvable.' });
    const { data: deps } = await supabaseAdmin.from('navette_departures').select('id').eq('event_id', ev.id);
    await supabaseAdmin.from('navette_signups').update({ notice: null }).eq('token', req.params.token).in('departure_id', (deps ?? []).map((d) => d.id));
    res.json({ ok: true });
  });

  app.delete('/public/navette/:code/signup/:token', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!allow('write:' + req.ip, 40, 300000)) return res.status(429).json({ error: 'Trop de tentatives, patientez quelques minutes.' });
    const ev = await eventByCode(req.params.code);
    if (!ev) return res.status(404).json({ error: 'Lien invalide ou événement introuvable.' });
    const { data: deps } = await supabaseAdmin.from('navette_departures').select('id').eq('event_id', ev.id);
    const { data } = await supabaseAdmin.from('navette_signups').delete().eq('token', req.params.token).in('departure_id', (deps ?? []).map((d) => d.id)).select('id');
    if (!data?.length) return res.status(404).json({ error: MESSAGES.signup_not_found });
    res.json({ ok: true });
  });
}

// Suppression automatique des inscriptions 30 jours apres le jour de l'evenement (verifiee au demarrage puis toutes les 6 h).
async function purgeOldSignups() {
  const cutoff = new Date(Date.now() - 30 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const { data: events } = await supabaseAdmin.from('navette_events').select('id').lt('event_date', cutoff);
  if (!events?.length) return 0;
  const { data: deps } = await supabaseAdmin.from('navette_departures').select('id').in('event_id', events.map((e) => e.id));
  if (!deps?.length) return 0;
  const { data: gone } = await supabaseAdmin.from('navette_signups').delete().in('departure_id', deps.map((d) => d.id)).select('id');
  return gone?.length ?? 0;
}
setTimeout(() => purgeOldSignups().then((n) => n && console.log('navettes : ' + n + ' inscription(s) de plus de 30 jours supprimee(s)')).catch((e) => console.error('purge navettes :', e.message)), 60000).unref();
setInterval(() => purgeOldSignups().catch((e) => console.error('purge navettes :', e.message)), 6 * 3600000).unref();

module.exports = { purgeOldSignups, registerNavettes, parisToUtc, departureMinutes, toMinutes };
