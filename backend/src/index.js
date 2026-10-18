const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { supabaseAdmin } = require('./supabaseAdmin');
const { sendEmail, sendAdminEmail } = require('./email');
const { sendPush } = require('./push');

const VEHICLE_LABELS = { confort: 'Confort', affaires: 'Affaires', van: 'Van' };
const PAYMENT_LABELS = { carte_a_bord: 'CB a bord', especes: 'Especes', compte: 'En compte' };

function formatRideRecap(ride) {
  const lines = [
    `Depart : ${ride.pickup_address}`,
    `Destination : ${ride.dropoff_address}`,
    `Gamme : ${VEHICLE_LABELS[ride.vehicle_category] ?? ride.vehicle_category}`,
    ride.scheduled_at ? `Date et heure : ${new Date(ride.scheduled_at).toLocaleString('fr-FR')}` : null,
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
  const token = req.get('authorization')?.replace('Bearer ', '');
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

// Modifie la gamme/role/permissions d'un chauffeur existant.
app.patch('/admin/chauffeurs/:id', requireAdmin, async (req, res) => {
  const { vehicle_category, driver_role, can_create_rides, can_edit_price } = req.body;
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ vehicle_category, driver_role, can_create_rides: !!can_create_rides, can_edit_price: !!can_edit_price })
    .eq('id', req.params.id)
    .eq('role', 'chauffeur');
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

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
  if (!ride?.client_id) return res.json({ ok: true });

  const { data: client } = await supabaseAdmin
    .from('profiles')
    .select('push_token, email')
    .eq('id', ride.client_id)
    .single();

  await sendPush([client?.push_token], 'Chauffeur trouve', 'Un chauffeur a accepte votre course.');

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
  res.json({ ok: true });
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

app.listen(PORT, () => {
  console.log(`Backend demarre sur http://localhost:${PORT}`);
});
