const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { supabaseAdmin } = require('./supabaseAdmin');
const { sendEmail, sendAdminEmail } = require('./email');
const { sendPush } = require('./push');
const { computeTrajetSimplePrice } = require('../../packages/shared/pricingEngine');
const { buildBonCommandePdf } = require('./bonCommande');
const { registerDriverOnboarding } = require('./driverOnboarding');

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

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://app-rennesvtc.onrender.com';

// Textes des emails de suivi (donneur d'ordre : hotel, entreprise, ou auteur d'une reservation web).
function trackingTexts(step, mad) {
  return {
    accepted: ['Chauffeur attribue', mad ? 'Un chauffeur est attribue a votre mission de mise a disposition.' : 'Un chauffeur est attribue a votre course.'],
    en_route: ['Le chauffeur est en route', 'Il se dirige vers le point de prise en charge. Suivez sa position en direct avec le lien ci-dessous.'],
    on_site: mad
      ? ['La mission commence', 'Le chauffeur est sur place : la mise a disposition debute.']
      : ['Le chauffeur est arrive', 'Il est sur place, au point de prise en charge.'],
    completed: [mad ? 'Mission terminee' : 'Course terminee', 'Merci de votre confiance.'],
  }[step];
}

async function sendTrackingEmail(rideId, step) {
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('tracking_token, orderer_email, client_name, pickup_address, dropoff_address, service_type, scheduled_at, duration_hours, driver_id')
    .eq('id', rideId)
    .single();
  if (!ride?.orderer_email) return;
  const mad = ride.service_type === 'mise_a_disposition';
  const texts = trackingTexts(step, mad);
  if (!texts) return;

  let driverInfo = '';
  if (ride.driver_id) {
    const [{ data: driver }, { data: vehicle }] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name, email').eq('id', ride.driver_id).single(),
      supabaseAdmin.from('vehicles').select('display_name, color, plate').eq('driver_id', ride.driver_id).limit(1).maybeSingle(),
    ]);
    const firstName = (driver?.full_name || '').split(' ')[0] || 'Votre chauffeur';
    driverInfo = `Chauffeur : ${firstName}${vehicle ? ` - ${[vehicle.display_name, vehicle.color, vehicle.plate].filter(Boolean).join(', ')}` : ''}\n`;
  }
  const lines = [
    ride.client_name ? `Passager : ${ride.client_name}` : null,
    mad ? `Mise a disposition${ride.duration_hours ? ` (${ride.duration_hours} h)` : ''}` : null,
    `Depart : ${ride.pickup_address}`,
    `Destination : ${ride.dropoff_address}`,
    ride.scheduled_at ? `Date et heure : ${new Date(ride.scheduled_at).toLocaleString('fr-FR')}` : null,
  ].filter(Boolean).join('\n');
  await sendEmail(
    ride.orderer_email,
    `${texts[0]} - ${ride.pickup_address}`,
    `Bonjour,\n\n${texts[1]}\n\n${lines}\n${driverInfo}\nSuivi de la mission en direct : ${BASE_URL}/suivi/${ride.tracking_token}\n\nRennes VTC`
  );
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
  const { email, password, vehicle_category, driver_role, can_create_rides, can_edit_price, full_name, phone } = req.body;
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
    .update({ vehicle_category, driver_role, can_create_rides: !!can_create_rides, can_edit_price: !!can_edit_price, full_name: full_name?.trim() || null, phone: phone?.trim() || null })
    .eq('id', data.user.id);

  res.status(201).json({ id: data.user.id, email: data.user.email });
});

// La gamme d'un chauffeur (utilisee pour le dispatch) suit celle de son vehicule.
app.patch('/admin/chauffeurs/:id/category', requireAdmin, async (req, res) => {
  const { vehicle_category } = req.body;
  if (!['confort', 'affaires', 'van'].includes(vehicle_category)) return res.status(400).json({ error: 'Gamme inconnue' });
  const { error } = await supabaseAdmin.from('profiles').update({ vehicle_category }).eq('id', req.params.id).eq('role', 'chauffeur');
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
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
    const { data: client } = await supabaseAdmin.from('profiles').select('email, phone, full_name').eq('id', ride.client_id).single();
    ride.client_name = client?.full_name || client?.email || null;
    ride.client_phone = client?.phone ?? null;
  }

  const [{ data: company }, { data: driver }, { data: vehicle }] = await Promise.all([
    supabaseAdmin.from('app_settings').select('company_legal_name, company_siret, company_address, logo_url').eq('id', true).single(),
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
  const { rideId, fromAdmin } = req.body;
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('pickup_address, dropoff_address, vehicle_category, price, payment_method, scheduled_at, client_id, client_email')
    .eq('id', rideId)
    .single();
  if (!ride) return res.json({ ok: true });

  autoDispatchPending().catch((e) => console.error('auto-dispatch', e));
  // Une reservation saisie par l'admin n'a pas besoin de le prevenir lui-meme.
  if (!fromAdmin) {
    await sendAdminEmail(
      'Nouvelle demande de course',
      `${formatRideRecap(ride)}\n\nConnectez-vous a l'espace admin pour dispatcher cette course.`
    );
  }

  const { data: client } = ride.client_id
    ? await supabaseAdmin.from('profiles').select('email').eq('id', ride.client_id).single()
    : { data: null };
  const to = client?.email || ride.client_email;
  if (to) {
    await sendEmail(
      to,
      'Votre demande de course a bien ete recue',
      `Bonjour,\n\nVotre demande de course a bien ete recue. Un chauffeur va vous etre attribue prochainement.\n\n${formatRideRecap(ride)}\n\nMerci de votre confiance.\nRennes VTC`
    );
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
    .select('client_id, client_email, orderer_email, driver_id, pickup_address, dropoff_address, vehicle_category, price, payment_method, scheduled_at')
    .eq('id', rideId)
    .single();
  if (!ride) return res.json({ ok: true });

  // Les courses sans compte client (web, admin, telephone) n'ont personne a prevenir
  // mais le chauffeur doit quand meme recevoir son bon de commande plus bas.
  const { data: client } = ride.client_id
    ? await supabaseAdmin.from('profiles').select('push_token, email').eq('id', ride.client_id).single()
    : { data: null };

  if (client) await sendPush([client.push_token], 'Chauffeur trouve', 'Un chauffeur a accepte votre course.');

  // Le donneur d'ordre recoit deja son propre email d'attribution (suivi) : pas de doublon a la meme adresse.
  const clientTo = client?.email || ride.client_email;
  if (clientTo && clientTo.toLowerCase() !== (ride.orderer_email ?? '').toLowerCase()) {
    const { data: driver } = await supabaseAdmin
      .from('profiles')
      .select('email, phone, full_name')
      .eq('id', ride.driver_id)
      .single();
    const driverInfo = driver
      ? `Chauffeur : ${driver.full_name || driver.email}${driver.phone ? `\nTelephone du chauffeur : ${driver.phone}` : ''}`
      : '';
    await sendEmail(
      clientTo,
      'Un chauffeur a accepte votre course',
      `Bonjour,\n\nUn chauffeur a accepte votre course.\n\n${driverInfo}\n\n${formatRideRecap(ride)}\n\nMerci de votre confiance.\nRennes VTC`
    );
  }

  await sendTrackingEmail(rideId, 'accepted');

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

async function requireDriver(req, res, next) {
  await requireSupabaseUser(req, res, async () => {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, vehicle_category')
      .eq('id', req.user.id)
      .single();
    if (profile?.role !== 'chauffeur') return res.status(403).json({ error: 'Reserve aux chauffeurs' });
    req.driverProfile = profile;
    next();
  });
}

// Chauffeurs auxquels une course peut etre attribuee (liste deroulante de l'app).
app.get('/driver/colleagues', requireDriver, async (req, res) => {
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
      child_ages: b.childAges?.trim() || null,
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

// Un chauffeur se desiste d'une course acceptee : elle repart en dispatch, soit
// vers tous les chauffeurs de sa gamme, soit vers un collegue precis.
app.post('/driver/rides/:rideId/release', requireDriver, async (req, res) => {
  const { assignTo } = req.body;
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('id, driver_id, status, pickup_address, dropoff_address, vehicle_category')
    .eq('id', req.params.rideId)
    .single();
  if (!ride || ride.driver_id !== req.user.id || ride.status !== 'accepted') {
    return res.status(404).json({ error: 'Course introuvable ou deja terminee' });
  }

  let category = ride.vehicle_category;
  let dispatchedTo = null;
  if (assignTo && assignTo !== 'all') {
    const { data: target } = await supabaseAdmin
      .from('profiles')
      .select('id, vehicle_category')
      .eq('id', assignTo)
      .eq('role', 'chauffeur')
      .single();
    if (!target?.vehicle_category || target.id === req.user.id) {
      return res.status(400).json({ error: 'Chauffeur invalide' });
    }
    category = target.vehicle_category;
    dispatchedTo = target.id;
  }

  const { error } = await supabaseAdmin
    .from('rides')
    .update({
      status: 'dispatched', driver_id: null, dispatched_to: dispatchedTo,
      vehicle_category: category, ride_step: 'not_started', driver_lat: null, driver_lng: null,
    })
    .eq('id', ride.id);
  if (error) return res.status(400).json({ error: error.message });

  let query = supabaseAdmin.from('profiles').select('push_token').eq('role', 'chauffeur').neq('id', req.user.id);
  query = dispatchedTo ? query.eq('id', dispatchedTo) : query.eq('vehicle_category', category);
  const { data: targets } = await query;
  await sendPush((targets ?? []).map((t) => t.push_token), 'Course remise en dispatch', `${ride.pickup_address} -> ${ride.dropoff_address}`);
  await sendAdminEmail('Course remise en dispatch par un chauffeur', `${ride.pickup_address} -> ${ride.dropoff_address}\nLe chauffeur s'est desiste${dispatchedTo ? ' en faveur d\'un collegue' : ' : course dispatchee a tous les chauffeurs de la gamme'}.`);
  res.json({ ok: true });
});

// Coordonnees du client d'une course acceptee, visibles uniquement par son chauffeur.
app.get('/driver/ride-client/:rideId', requireSupabaseUser, async (req, res) => {
  const bonData = await fetchBonCommandeData(req.params.rideId);
  if (!bonData || bonData.ride.driver_id !== req.user.id) {
    return res.status(404).json({ error: 'Course introuvable' });
  }
  res.json({ name: bonData.ride.client_name, phone: bonData.ride.client_phone });
});

// Annulation d'une reservation par son client. Une fois un chauffeur engage, elle n'est
// possible que jusqu'a 24 h avant la course ; sans chauffeur, personne n'est engage.
const CANCEL_DELAY_HOURS = 24;
app.post('/client/rides/:rideId/cancel', requireSupabaseUser, async (req, res) => {
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('id, client_id, driver_id, status, scheduled_at, pickup_address, dropoff_address')
    .eq('id', req.params.rideId)
    .single();
  if (!ride || ride.client_id !== req.user.id) return res.status(404).json({ error: 'Course introuvable' });
  if (!['pending', 'dispatched', 'accepted'].includes(ride.status)) {
    return res.status(400).json({ error: 'Cette course ne peut plus etre annulee.' });
  }
  if (ride.driver_id) {
    const hoursLeft = ride.scheduled_at ? (new Date(ride.scheduled_at) - Date.now()) / 3600000 : 0;
    if (hoursLeft < CANCEL_DELAY_HOURS) {
      return res.status(400).json({
        error: `Annulation impossible a moins de ${CANCEL_DELAY_HOURS} h de la course. Contactez le chauffeur.`,
        tooLate: true,
      });
    }
  }

  const { error } = await supabaseAdmin.from('rides').update({ status: 'cancelled', driver_lat: null, driver_lng: null }).eq('id', ride.id);
  if (error) return res.status(400).json({ error: error.message });

  const trajet = `${ride.pickup_address} -> ${ride.dropoff_address}`;
  if (ride.driver_id) {
    const { data: driver } = await supabaseAdmin.from('profiles').select('push_token').eq('id', ride.driver_id).single();
    await sendPush([driver?.push_token], 'Course annulee par le client', trajet);
  }
  await sendAdminEmail('Reservation annulee par le client', `${trajet}\n${ride.scheduled_at ? `Prevue le ${new Date(ride.scheduled_at).toLocaleString('fr-FR')}` : 'Course immediate'}`);
  res.json({ ok: true });
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
// Demande de devis d'un client : transmise par email a l'administrateur.
app.post('/client/quote', requireSupabaseUser, async (req, res) => {
  const message = String(req.body.message ?? '').trim().slice(0, 2000);
  if (!message) return res.status(400).json({ error: 'Message requis' });
  const { data: profile } = await supabaseAdmin.from('profiles').select('full_name, phone, email').eq('id', req.user.id).single();
  const who = profile?.full_name || profile?.email || req.user.email;
  await sendAdminEmail(
    `Demande de devis - ${who}`,
    `Client : ${who}\nTelephone : ${profile?.phone ?? 'non renseigne'}\nEmail : ${profile?.email ?? req.user.email}\n\nDepart : ${req.body.pickup ?? '-'}\nDestination : ${req.body.dropoff ?? '-'}\n\nMessage :\n${message}`
  );
  res.json({ ok: true });
});

// Vrai pour le chauffeur de la course ou pour un administrateur (changement d'etape fait depuis l'admin).
async function isDriverOrAdmin(userId, ride) {
  if (ride.driver_id === userId) return true;
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).single();
  return profile?.role === 'admin';
}

// Previent le client a chaque etape de la course (en route, arrive, terminee).
const STEP_PUSH = {
  en_route: ['Votre chauffeur est en route', 'Il se dirige vers votre point de depart.'],
  on_site: ['Votre chauffeur est arrive', 'Il vous attend au point de prise en charge.'],
  completed: ['Course terminee', 'Merci de votre confiance, a bientot avec Rennes VTC.'],
};
app.post('/notify/step', requireSupabaseUser, async (req, res) => {
  const { rideId, step } = req.body;
  const message = STEP_PUSH[step];
  if (!message) return res.status(400).json({ error: 'Etape inconnue' });
  const { data: ride } = await supabaseAdmin.from('rides').select('client_id, driver_id').eq('id', rideId).single();
  if (!ride || !(await isDriverOrAdmin(req.user.id, ride))) return res.status(403).json({ error: 'Course non attribuee a ce chauffeur' });
  if (ride.client_id) {
    const { data: client } = await supabaseAdmin.from('profiles').select('push_token').eq('id', ride.client_id).single();
    await sendPush([client?.push_token], message[0], message[1]);
  }
  await sendTrackingEmail(rideId, step);
  res.json({ ok: true });
});

// Previent le client (push + email) quand le prix de sa course change (modification par le chauffeur).
app.post('/notify/price', requireSupabaseUser, async (req, res) => {
  const { rideId, oldPrice } = req.body;
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('client_id, client_email, driver_id, price, pickup_address, dropoff_address, scheduled_at')
    .eq('id', rideId)
    .single();
  if (!ride || !(await isDriverOrAdmin(req.user.id, ride))) return res.status(403).json({ error: 'Course non attribuee a ce chauffeur' });
  if (ride.price == null || Number(oldPrice) === Number(ride.price)) return res.json({ ok: true });

  const { data: client } = ride.client_id
    ? await supabaseAdmin.from('profiles').select('push_token, email').eq('id', ride.client_id).single()
    : { data: null };
  const message = oldPrice != null && oldPrice !== ''
    ? `Le tarif de votre course est passe de ${oldPrice} € a ${ride.price} €.`
    : `Le tarif de votre course est fixe a ${ride.price} €.`;
  await sendPush([client?.push_token], 'Tarif modifie', message);
  const to = client?.email || ride.client_email;
  if (to) {
    await sendEmail(
      to,
      'Le tarif de votre course a ete modifie',
      `Bonjour,\n\n${message}\n\nCourse : ${ride.pickup_address} -> ${ride.dropoff_address}${ride.scheduled_at ? `\nDate et heure : ${new Date(ride.scheduled_at).toLocaleString('fr-FR')}` : ''}\n\nPour toute question, contactez-nous au 07 68 42 52 62.\n\nRennes VTC`
    );
  }
  res.json({ ok: true });
});

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

// ---- Suivi de mission (lien public non devinable, envoye au donneur d'ordre) ----
app.get('/suivi/:token', (req, res) => res.sendFile(path.join(__dirname, '../public/suivi/index.html')));

app.get('/public/track/:token', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = String(req.params.token).slice(0, 64);
  const { data: ride } = await supabaseAdmin
    .from('rides')
    .select('status, ride_step, service_type, scheduled_at, duration_hours, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, stop_addresses, round_trip, client_name, driver_id, driver_lat, driver_lng, step_times, created_at')
    .eq('tracking_token', token)
    .maybeSingle();
  if (!ride) return res.status(404).json({ error: 'Suivi introuvable' });

  // La position n'est donnee qu'une fois le chauffeur en route (elle est aussi effacee en base avant).
  const live = ride.status === 'accepted' && ['en_route', 'on_site'].includes(ride.ride_step) && ride.driver_lat != null;
  let driver = null;
  if (ride.driver_id && ['accepted', 'completed'].includes(ride.status)) {
    const [{ data: profile }, { data: vehicle }] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name').eq('id', ride.driver_id).single(),
      supabaseAdmin.from('vehicles').select('display_name, color, plate').eq('driver_id', ride.driver_id).limit(1).maybeSingle(),
    ]);
    driver = { firstName: (profile?.full_name || '').split(' ')[0] || null, vehicle: vehicle ?? null };
  }
  const { data: settings } = await supabaseAdmin.from('app_settings').select('app_name, logo_url, accent_color, accent_contrast').eq('id', true).single();
  const { driver_id, driver_lat, driver_lng, ...rest } = ride;
  res.json({ ...rest, driver, driverPosition: live ? { lat: driver_lat, lng: driver_lng } : null, branding: settings });
});

// ---- Module de reservation web public (sans compte) ----
// Le client en front-end n'a jamais besoin de la cle Google Maps : tous les
// appels passent par le serveur, qui la detient seule.

async function getDistanceKmServer(origin, destination) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const meters = data.routes?.[0]?.legs?.[0]?.distance?.value;
  if (!meters) throw new Error("Impossible de calculer l'itinéraire");
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
  const { vehicle_category, pickup, dropoff, when, passengerCount, childSeats, boosterSeats, service_type, duration_hours } = req.body;
  if (service_type === 'mise_a_disposition' && vehicle_category) {
    const { data: hourly } = await supabaseAdmin.from('pricing_hourly').select('price_per_hour, min_hours').eq('vehicle_category', vehicle_category).single();
    const hours = parseFloat(duration_hours);
    if (!hourly || !hours) return res.status(400).json({ error: 'Indiquez la durée de la mise à disposition.' });
    if (hours < hourly.min_hours) return res.status(400).json({ error: `Durée minimum : ${hourly.min_hours} h` });
    return res.json({ price: Math.round(hours * hourly.price_per_hour * 100) / 100 });
  }
  if (!vehicle_category || !pickup || !dropoff) return res.status(400).json({ error: 'Paramètres manquants' });
  const [{ data: pricing }, { data: zones }] = await Promise.all([
    supabaseAdmin.from('pricing_simple').select('*').eq('vehicle_category', vehicle_category).single(),
    supabaseAdmin.from('pricing_zones').select('*').eq('vehicle_category', vehicle_category).eq('active', true),
  ]);
  if (!pricing) return res.status(400).json({ error: 'Tarification non configurée pour cette gamme.' });
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
  const { clientName, clientPhone, clientEmail, vehicleCategory, pickup, dropoff, scheduledAt, roundTrip, returnAt, paymentMethod, price, passengerCount, luggageCount, childSeats, boosterSeats, childAges, serviceType, durationHours, acceptedTerms } = req.body;
  if (!acceptedTerms) return res.status(400).json({ error: 'Veuillez accepter les CGV et CGU.' });
  const isMad = serviceType === 'mise_a_disposition';
  if (isMad && !(parseFloat(durationHours) > 0)) return res.status(400).json({ error: 'Indiquez la durée de la mise à disposition.' });
  if (!clientName || !clientPhone || !vehicleCategory || !pickup?.address || !dropoff?.address || !paymentMethod || price == null) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  if (paymentMethod === 'compte') {
    return res.status(400).json({ error: 'Ce mode de règlement est réservé au back-office.' });
  }
  const { data: ride, error } = await supabaseAdmin
    .from('rides')
    .insert({
      client_id: null,
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail?.trim() || null,
      terms_accepted_at: new Date().toISOString(),
      vehicle_category: vehicleCategory,
      pickup_address: pickup.address,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_address: dropoff.address,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      round_trip: !isMad && !!roundTrip,
      return_scheduled_at: !isMad && roundTrip ? returnAt || null : null,
      passenger_count: Math.max(1, parseInt(passengerCount, 10) || 1),
      luggage_count: Math.max(0, parseInt(luggageCount, 10) || 0),
      child_seats: Math.max(0, parseInt(childSeats, 10) || 0),
      booster_seats: Math.max(0, parseInt(boosterSeats, 10) || 0),
      child_ages: childAges?.trim() || null,
      payment_method: paymentMethod,
      service_type: isMad ? 'mise_a_disposition' : 'trajet_simple',
      duration_hours: isMad ? parseFloat(durationHours) : null,
      price,
      created_by: 'web',
      scheduled_at: scheduledAt || null,
      status: 'pending',
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });

  autoDispatchPending().catch((e) => console.error('auto-dispatch', e));
  await sendAdminEmail(
    'Nouvelle demande de course (reservation web)',
    `${formatRideRecap(ride)}\n${isMad ? `Mise a disposition : ${parseFloat(durationHours)} h\n` : ''}Client : ${clientName} (${clientPhone})\n\nConnectez-vous a l'espace admin pour dispatcher cette course.`
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

registerDriverOnboarding(app, { supabaseAdmin, requireAdmin, sendEmail, sendAdminEmail, baseUrl: BASE_URL });

// Dispatch automatique : si l'admin l'a active, les courses restees en attente au-dela du delai choisi
// partent chez tous les chauffeurs de leur gamme. La verification est aussi relancee toutes les 30 s.
// shortcut: le delai repose sur ce serveur ; l'hebergement gratuit s'endort apres 15 min, donc delai <= 10 min.
async function autoDispatchPending() {
  const { data: settings } = await supabaseAdmin.from('app_settings').select('auto_dispatch_enabled, auto_dispatch_delay_minutes').eq('id', true).single();
  if (!settings?.auto_dispatch_enabled) return;
  const cutoff = new Date(Date.now() - (settings.auto_dispatch_delay_minutes ?? 0) * 60000).toISOString();
  const { data: rides } = await supabaseAdmin
    .from('rides')
    .select('id, pickup_address, dropoff_address, vehicle_category')
    .eq('status', 'pending')
    .is('driver_id', null)
    .not('vehicle_category', 'is', null)
    .lte('created_at', cutoff);
  for (const ride of rides ?? []) {
    // La condition sur le statut evite de dispatcher deux fois une course deja traitee par l'admin.
    const { data: updated } = await supabaseAdmin.from('rides').update({ status: 'dispatched', dispatched_to: null }).eq('id', ride.id).eq('status', 'pending').select('id');
    if (!updated?.length) continue;
    const { data: drivers } = await supabaseAdmin.from('profiles').select('push_token').eq('role', 'chauffeur').eq('vehicle_category', ride.vehicle_category);
    await sendPush((drivers ?? []).map((d) => d.push_token), 'Nouvelle course disponible', `${ride.pickup_address} -> ${ride.dropoff_address}`);
    await sendAdminEmail('Course dispatchee automatiquement', `${ride.pickup_address} -> ${ride.dropoff_address}\nDispatch automatique vers tous les chauffeurs de la gamme ${ride.vehicle_category}.`);
  }
}
setInterval(() => autoDispatchPending().catch((e) => console.error('auto-dispatch', e)), 30000);

app.listen(PORT, () => {
  console.log(`Backend demarre sur http://localhost:${PORT}`);
});
