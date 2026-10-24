const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { supabaseAdmin } = require('./supabaseAdmin');
const { sendEmail, sendAdminEmail } = require('./email');
const { sendPush } = require('./push');
const { computeTrajetSimplePrice } = require('../../packages/shared/pricingEngine');
const { buildBonCommandePdf } = require('./bonCommande');

const VEHICLE_LABELS = { confort: 'Confort', affaires: 'Affaires', van: 'Van' };
const PAYMENT_LABELS = { carte_a_bord: 'CB a bord', especes: 'Especes', compte: 'En compte' };

function formatRideRecap(ride) {
  const lines = [
    `Depart : ${ride.pickup_address}`,
    `Destination : ${ride.dropoff_address}`,
    `Gamme : ${VEHICLE_LABELS[ride.vehicle_category] ?? ride.vehicle_category}`,
    ride.scheduled_at ? `Date et heure : ${new Date(ride.scheduled_at).toLocaleString('fr-FR')}` : null,
    ride.round_trip && ride.return_scheduled_at ? `Retour : ${new Date(ride.return_scheduled_at).toLocaleString('fr-FR')}` : null,
    `Mode de reglement : ${PAYMENT_LABELS[ride.payment_method] ?? ride.payment_method}`,
    ride.price != null ? `Prix : ${ride.price} euros` : 'Prix : a confirmer par le chauffeur',
  ];
  return lines.filter(Boolean).join('\n');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Rennes VTC API en ligne' });
});

async function requireSupabaseUser(req, res, next) {
  const token = req.get('authorization')?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ error: 'Non authentifie' });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Non authentifie' });
  req.user = data.user;
  next();
}

async function requireAdmin(req, res, next) {
  await requireSupabaseUser(req, res, async () => {
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', req.user.id).single();
    if (profile?.role !== 'admin') return res.status(403).json({ error: 'Reserve a l administrateur' });
    next();
  });
}

// Cree un compte chauffeur (reserve a l'admin, en attendant le vrai back-office de gestion de flotte).
app.post('/admin/chauffeurs', requireAdmin, async (req, res) => {
  const { email, password, vehicle_category, driver_role, can_create_rides, can_edit_price } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email et password sont requis' });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'chauffeur' },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  await supabaseAdmin
    .from('profiles')
    .update({ vehicle_category, driver_role, can_create_rides: !!can_create_rides, can_edit_price: !!can_edit_price })
    .eq('id', data.user.id);

  res.status(201).json({ id: data.user.id, email: data.user.email });
});

// Modifie la gamme/role/permissions/infos legales d'un chauffeur existant.
app.patch('/admin/chauffeurs/:id', requireAdmin, async (req, res) => {
  const { vehicle_category, driver_role, can_create_rides, can_edit_price, full_name, vtc_card_number, siret } = req.body;
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      vehicle_category, driver_role,
      can_create_rides: !!can_create_rides, can_edit_price: !!can_edit_price,
      full_name: full_name || null, vtc_card_number: vtc_card_number || null, siret: siret || null,
    })
    .eq('id', req.params.id)
    .eq('role', 'chauffeur');
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// Rassemble toutes les donnees necessaires au bon de commande (billet collectif)
// d'une course : identite de l'entreprise, du chauffeur et du vehicule assigne.
async function fetchBonCommandeData(rideId) {
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('client_id, client_name, client_phone, driver_id, pickup_address, dropoff_address, price, service_type, duration_hours, created_at, scheduled_at')
    .eq('id', rideId)
    .single();
  if (!ride) return null;

  if (!ride.client_name && ride.client_id) {
    const { data: client } = await supabaseAdmin.from('profiles').select('email, phone').eq('id', ride.client_id).single();
    ride.client_name = client?.email ?? null;
    ride.client_phone = client?.phone ?? null;
  }

  const [{ data: company }, { data: driver }, { data: vehicle }] = await Promise.all([
    supabaseAdmin.from('app_settings').select('company_legal_name, company_siret, company_address').eq('id', true).single(),
    ride.driver_id
      ? supabaseAdmin.from('profiles').select('email, full_name, vtc_card_number, siret').eq('id', ride.driver_id).single()
      : Promise.resolve({ data: null }),
    ride.driver_id
      ? supabaseAdmin.from('vehicles').select('display_name, plate').eq('driver_id', ride.driver_id).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return { ride, company, driver, vehicle };
}

// Previent l'admin par email qu'une nouvelle demande de course attend un dispatch,
// et confirme au client que sa demande a bien ete recue.
app.post('/notify/new-ride', requireSupabaseUser, async (req, res) => {
  const { rideId } = req.body;
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('pickup_address, dropoff_address, vehicle_category, price, payment_method, scheduled_at, client_id')
    .eq('id', rideId)
    .single();
  if (!ride) return res.json({ ok: true });

  await sendAdminEmail(
    'Nouvelle demande de course',
    `${formatRideRecap(ride)}\n\nConnectez-vous a l'espace admin pour dispatcher cette course.`
  );

  if (ride.client_id) {
    const { data: client } = await supabaseAdmin.from('profiles').select('email').eq('id', ride.client_id).single();
    if (client?.email) {
      await sendEmail(
        client.email,
        'Votre demande de course a bien ete recue',
        `Bonjour,\n\nVotre demande de course a bien ete recue. Un chauffeur va vous etre attribue prochainement.\n\n${formatRideRecap(ride)}\n\nMerci de votre confiance.\nRennes VTC`
      );
    }
  }
  res.json({ ok: true });
});

// Previent le ou les chauffeurs concernes qu'une course leur a ete dispatchee.
app.post('/notify/dispatch', requireSupabaseUser, async (req, res) => {
  const { rideId } = req.body;
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('pickup_address, dropoff_address, vehicle_category, dispatched_to')
    .eq('id', rideId)
    .single();
  if (!ride) return res.json({ ok: true });

  let query = supabaseAdmin.from('profiles').select('push_token').eq('role', 'chauffeur');
  query = ride.dispatched_to ? query.eq('id', ride.dispatched_to) : query.eq('vehicle_category', ride.vehicle_category);
  const { data: drivers } = await query;

  await sendPush(
    (drivers ?? []).map((d) => d.push_token),
    'Nouvelle course disponible',
    `${ride.pickup_address} -> ${ride.dropoff_address}`
  );
  res.json({ ok: true });
});

// Previent le client qu'un chauffeur a accepte sa course (push + email avec
// les coordonnees du chauffeur et un rappel complet de la reservation).
app.post('/notify/accepted', requireSupabaseUser, async (req, res) => {
  const { rideId } = req.body;
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('client_id, driver_id, pickup_address, dropoff_address, vehicle_category, price, payment_method, scheduled_at')
    .eq('id', rideId)
    .single();
  if (!ride) return res.json({ ok: true });

  // Les courses sans compte client (web, admin, telephone) n'ont personne a prevenir
  // mais le chauffeur doit quand meme recevoir son bon de commande plus bas.
  const { data: client } = ride.client_id
    ? await supabaseAdmin.from('profiles').select('push_token, email').eq('id', ride.client_id).single()
    : { data: null };

  if (client) await sendPush([client.push_token], 'Chauffeur trouve', 'Un chauffeur a accepte votre course.');

  if (client?.email) {
    const { data: driver } = await supabaseAdmin
      .from('profiles')
      .select('email, phone')
      .eq('id', ride.driver_id)
      .single();
    const driverInfo = driver
      ? `Chauffeur : ${driver.email}${driver.phone ? `\nTelephone du chauffeur : ${driver.phone}` : ''}`
      : '';
    await sendEmail(
      client.email,
      'Un chauffeur a accepte votre course',
      `Bonjour,\n\nUn chauffeur a accepte votre course.\n\n${driverInfo}\n\n${formatRideRecap(ride)}\n\nMerci de votre confiance.\nRennes VTC`
    );
  }

  // Envoie le bon de commande (billet collectif) au chauffeur qui vient d'accepter.
  const bonData = await fetchBonCommandeData(rideId);
  if (bonData?.driver?.email) {
    const pdf = await buildBonCommandePdf(bonData);
    await sendEmail(
      bonData.driver.email,
      'Bon de commande - course acceptee',
      'Bonjour,\n\nVeuillez trouver ci-joint le bon de commande de la course que vous venez d\'accepter.\n\nRennes VTC',
      [{ filename: 'bon-commande.pdf', content: pdf.toString('base64') }]
    );
  }
  res.json({ ok: true });
});

// Profil du chauffeur connecte, uniquement s'il a le droit de creer des reservations.
async function requireRideCreator(req, res, next) {
  await requireSupabaseUser(req, res, async () => {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, can_create_rides, vehicle_category')
      .eq('id', req.user.id)
      .single();
    if (profile?.role !== 'chauffeur' || !profile.can_create_rides) {
      return res.status(403).json({ error: "Vous n'avez pas l'autorisation de creer des reservations." });
    }
    req.driverProfile = profile;
    next();
  });
}

// Chauffeurs auxquels une reservation peut etre attribuee (liste deroulante de l'app).
app.get('/driver/colleagues', requireRideCreator, async (req, res) => {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, vehicle_category, online_status')
    .eq('role', 'chauffeur')
    .not('vehicle_category', 'is', null)
    .order('full_name', { ascending: true });
  res.json(
    (data ?? []).map((d) => ({
      id: d.id,
      name: d.full_name || d.email,
      vehicle_category: d.vehicle_category,
      online: !!d.online_status,
      isMe: d.id === req.user.id,
    }))
  );
});

// Cree une reservation saisie par un chauffeur : pour lui-meme, pour un collegue
// precis, ou dispatchee a tous les chauffeurs de sa gamme.
app.post('/driver/rides', requireRideCreator, async (req, res) => {
  const b = req.body;
  if (!b.clientName || !b.clientPhone || !b.pickup?.address || !b.dropoff?.address || b.price == null) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  if (!['carte_a_bord', 'especes'].includes(b.paymentMethod)) {
    return res.status(400).json({ error: 'Mode de reglement invalide' });
  }

  let category = req.driverProfile.vehicle_category;
  let assignment = { status: 'accepted', driver_id: req.user.id, dispatched_to: null };
  if (b.assignTo && b.assignTo !== 'self') {
    assignment = { status: 'dispatched', driver_id: null, dispatched_to: null };
    if (b.assignTo !== 'all') {
      const { data: target } = await supabaseAdmin
        .from('profiles')
        .select('id, vehicle_category')
        .eq('id', b.assignTo)
        .eq('role', 'chauffeur')
        .single();
      if (!target?.vehicle_category) return res.status(400).json({ error: 'Chauffeur introuvable' });
      category = target.vehicle_category;
      assignment.dispatched_to = target.id;
    }
  }

  const { data: ride, error } = await supabaseAdmin
    .from('rides')
    .insert({
      client_id: null,
      client_name: b.clientName,
      client_phone: b.clientPhone,
      pickup_address: b.pickup.address, pickup_lat: b.pickup.lat, pickup_lng: b.pickup.lng,
      dropoff_address: b.dropoff.address, dropoff_lat: b.dropoff.lat, dropoff_lng: b.dropoff.lng,
      stop_addresses: b.stopAddresses ?? [],
      round_trip: !!b.roundTrip,
      return_scheduled_at: b.roundTrip ? b.returnAt || null : null,
      scheduled_at: b.scheduledAt || null,
      vehicle_category: category,
      payment_method: b.paymentMethod,
      service_type: 'trajet_simple',
      price: b.price,
      passenger_count: Math.max(1, parseInt(b.passengerCount, 10) || 1),
      luggage_count: Math.max(0, parseInt(b.luggageCount, 10) || 0),
      child_seats: Math.max(0, parseInt(b.childSeats, 10) || 0),
      booster_seats: Math.max(0, parseInt(b.boosterSeats, 10) || 0),
      created_by: 'chauffeur',
      ...assignment,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });

  if (assignment.status === 'dispatched') {
    let query = supabaseAdmin.from('profiles').select('push_token').eq('role', 'chauffeur').neq('id', req.user.id);
    query = assignment.dispatched_to ? query.eq('id', assignment.dispatched_to) : query.eq('vehicle_category', category);
    const { data: targets } = await query;
    await sendPush((targets ?? []).map((t) => t.push_token), 'Nouvelle course disponible', `${ride.pickup_address} -> ${ride.dropoff_address}`);
  }
  res.status(201).json({ ok: true, id: ride.id, status: ride.status });
});

// Coordonnees du client d'une course acceptee, visibles uniquement par son chauffeur.
app.get('/driver/ride-client/:rideId', requireSupabaseUser, async (req, res) => {
  const bonData = await fetchBonCommandeData(req.params.rideId);
  if (!bonData || bonData.ride.driver_id !== req.user.id) {
    return res.status(404).json({ error: 'Course introuvable' });
  }
  res.json({ name: bonData.ride.client_name, phone: bonData.ride.client_phone });
});

// Coordonnees du chauffeur d'une course acceptee, visibles uniquement par son client.
app.get('/client/ride-driver/:rideId', requireSupabaseUser, async (req, res) => {
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('client_id, driver_id')
    .eq('id', req.params.rideId)
    .single();
  if (!ride?.driver_id || ride.client_id !== req.user.id) {
    return res.status(404).json({ error: 'Course introuvable' });
  }
  const { data: driver } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', ride.driver_id)
    .single();
  res.json({ name: driver?.full_name || driver?.email || null, phone: driver?.phone ?? null });
});

// Telecharge le bon de commande d'une course (espace chauffeur).
app.get('/driver/bon-commande/:rideId', requireSupabaseUser, async (req, res) => {
  const bonData = await fetchBonCommandeData(req.params.rideId);
  if (!bonData || bonData.ride.driver_id !== req.user.id) {
    return res.status(404).json({ error: 'Course introuvable' });
  }
  const pdf = await buildBonCommandePdf(bonData);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="bon-commande.pdf"');
  res.send(pdf);
});

// Previent le client d'une majoration de prix ajoutee par l'admin.
app.post('/notify/surcharge', requireSupabaseUser, async (req, res) => {
  const { rideId, amount, reason } = req.body;
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('client_id, price')
    .eq('id', rideId)
    .single();
  if (!ride?.client_id) return res.json({ ok: true });

  const { data: client } = await supabaseAdmin
    .from('profiles')
    .select('push_token, email')
    .eq('id', ride.client_id)
    .single();

  const message = `Une majoration de ${amount} € a ete ajoutee a votre course (${reason || 'sans raison precisee'}). Nouveau prix : ${ride.price} €.`;
  await sendPush([client?.push_token], 'Majoration de prix', message);
  if (client?.email) {
    await sendEmail(client.email, 'Majoration de prix sur votre course', `Bonjour,\n\n${message}\n\nRennes VTC`);
  }
  res.json({ ok: true });
});

// ---- Module de reservation web public (sans compte) ----
// Le client en front-end n'a jamais besoin de la cle Google Maps : tous les
// appels passent par le serveur, qui la detient seule.

async function getDistanceKmServer(origin, destination) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const meters = data.routes?.[0]?.legs?.[0]?.distance?.value;
  if (!meters) throw new Error("Impossible de calculer l'itineraire");
  return meters / 1000;
}

app.post('/public/places/autocomplete', async (req, res) => {
  const { input } = req.body;
  if (!input || input.length < 3) return res.json({ suggestions: [] });
  const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY },
    body: JSON.stringify({ input, includedRegionCodes: ['fr'] }),
  });
  const data = await r.json();
  const suggestions = (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({ placeId: p.placeId, text: p.text.text }));
  res.json({ suggestions });
});

app.post('/public/places/details', async (req, res) => {
  const { placeId } = req.body;
  const r = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { 'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY, 'X-Goog-FieldMask': 'location,formattedAddress' },
  });
  const data = await r.json();
  if (!data.location) return res.status(400).json({ error: 'Adresse introuvable' });
  res.json({ address: data.formattedAddress, lat: data.location.latitude, lng: data.location.longitude });
});

app.post('/public/estimate-price', async (req, res) => {
  const { vehicle_category, pickup, dropoff, when, passengerCount, childSeats, boosterSeats } = req.body;
  if (!vehicle_category || !pickup || !dropoff) return res.status(400).json({ error: 'Parametres manquants' });
  const [{ data: pricing }, { data: zones }] = await Promise.all([
    supabaseAdmin.from('pricing_simple').select('*').eq('vehicle_category', vehicle_category).single(),
    supabaseAdmin.from('pricing_zones').select('*').eq('vehicle_category', vehicle_category).eq('active', true),
  ]);
  if (!pricing) return res.status(400).json({ error: 'Tarification non configuree pour cette gamme.' });
  try {
    const km = await getDistanceKmServer(pickup, dropoff);
    const result = computeTrajetSimplePrice({
      pricing, zones: zones ?? [], pickup, dropoff, km,
      when: when ? new Date(when) : new Date(),
      passengerCount: passengerCount || 1, childSeats: childSeats || 0, boosterSeats: boosterSeats || 0, stopsCount: 0,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Cree une reservation depuis le module web public (pas de compte requis).
app.post('/public/book', async (req, res) => {
  const { clientName, clientPhone, clientEmail, vehicleCategory, pickup, dropoff, scheduledAt, roundTrip, returnAt, paymentMethod, price, passengerCount, luggageCount, childSeats, boosterSeats } = req.body;
  if (!clientName || !clientPhone || !vehicleCategory || !pickup?.address || !dropoff?.address || !paymentMethod || price == null) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  if (paymentMethod === 'compte') {
    return res.status(400).json({ error: 'Ce mode de reglement est reserve au back-office.' });
  }
  const { data: ride, error } = await supabaseAdmin
    .from('rides')
    .insert({
      client_id: null,
      client_name: clientName,
      client_phone: clientPhone,
      vehicle_category: vehicleCategory,
      pickup_address: pickup.address,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_address: dropoff.address,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      round_trip: !!roundTrip,
      return_scheduled_at: roundTrip ? returnAt || null : null,
      passenger_count: Math.max(1, parseInt(passengerCount, 10) || 1),
      luggage_count: Math.max(0, parseInt(luggageCount, 10) || 0),
      child_seats: Math.max(0, parseInt(childSeats, 10) || 0),
      booster_seats: Math.max(0, parseInt(boosterSeats, 10) || 0),
      payment_method: paymentMethod,
      service_type: 'trajet_simple',
      price,
      created_by: 'web',
      scheduled_at: scheduledAt || null,
      status: 'pending',
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });

  await sendAdminEmail(
    'Nouvelle demande de course (reservation web)',
    `${formatRideRecap(ride)}\nClient : ${clientName} (${clientPhone})\n\nConnectez-vous a l'espace admin pour dispatcher cette course.`
  );
  if (clientEmail) {
    await sendEmail(
      clientEmail,
      'Votre demande de course a bien ete recue',
      `Bonjour,\n\nVotre demande de course a bien ete recue. Un chauffeur va vous etre attribue prochainement.\n\n${formatRideRecap(ride)}\n\nMerci de votre confiance.\nRennes VTC`
    );
  }
  res.json({ ok: true, id: ride.id });
});

app.listen(PORT, () => {
  console.log(`Backend demarre sur http://localhost:${PORT}`);
});
