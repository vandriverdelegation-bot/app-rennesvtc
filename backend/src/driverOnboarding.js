// Invitation des chauffeurs : lien d'invitation, dossier (infos + documents prives), validation par l'admin.
// Les tables driver_invitations / driver_documents n'ont aucune policy RLS : tout passe par ces routes.
const crypto = require('crypto');

const BUCKET = 'driver-documents';
const CATEGORIES = ['confort', 'affaires', 'van'];

// type -> [libelle, obligatoire]
const DOC_TYPES = {
  carte_vtc: ['Carte professionnelle VTC', true],
  permis: ['Permis de conduire', true],
  identite: ["Pièce d'identité", true],
  justificatif_siret: ['Kbis ou avis de situation SIRENE (INSEE)', true],
  assurance: ["Attestation d'assurance professionnelle", true],
  carte_grise: ['Carte grise du véhicule', true],
  photo_vehicule: ['Photo du véhicule', false],
};

const safeName = (name) => String(name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);

function registerDriverOnboarding(app, { supabaseAdmin, requireAdmin, sendEmail, sendAdminEmail, baseUrl }) {
  const link = (token) => `${baseUrl}/inscription-chauffeur/${token}`;

  async function loadUsableInvitation(token) {
    const { data: inv } = await supabaseAdmin.from('driver_invitations').select('*').eq('token', String(token).slice(0, 80)).maybeSingle();
    if (!inv) return { error: [404, "Ce lien d'invitation est introuvable."] };
    if (inv.status !== 'sent') return { error: [410, inv.status === 'submitted' || inv.status === 'validated' ? 'Votre dossier a déjà été transmis.' : "Cette invitation n'est plus valable."] };
    if (new Date(inv.expires_at) < new Date()) return { error: [410, 'Cette invitation a expiré. Demandez-en une nouvelle à Rennes VTC.'] };
    return { inv };
  }

  function inviteEmailText(inv) {
    return `Bonjour ${inv.first_name},\n\nRennes VTC vous invite à rejoindre son équipe de chauffeurs.\n\nPour créer votre profil, renseigner vos informations et déposer vos documents (carte professionnelle VTC, permis, pièce d'identité, justificatif d'activité, assurance, carte grise), ouvrez ce lien :\n${link(inv.token)}\n\nCe lien est personnel et valable 14 jours. Une fois votre dossier envoyé, il sera étudié par Rennes VTC et vous serez prévenu par email de l'activation de votre profil.\n\nRennes VTC`;
  }

  // ---------- Admin ----------

  app.post('/admin/driver-invitations', requireAdmin, async (req, res) => {
    const { first_name, last_name, email, phone, vehicle_category, driver_role, send_email } = req.body;
    if (!first_name?.trim() || !last_name?.trim() || !email?.includes('@')) {
      return res.status(400).json({ error: 'Prénom, nom et email sont requis.' });
    }
    if (!CATEGORIES.includes(vehicle_category)) return res.status(400).json({ error: 'Choisissez une gamme.' });
    const cleanEmail = email.trim().toLowerCase();
    const { data: existing } = await supabaseAdmin.from('profiles').select('role').ilike('email', cleanEmail).neq('role', 'ancien').limit(1);
    if (existing?.length) {
      return res.status(400).json({
        error: existing[0].role === 'admin'
          ? "Cet email est celui d'un compte administrateur. Un compte chauffeur doit avoir sa propre adresse : utilisez par exemple prenom+chauffeur@gmail.com, qui arrive dans la même boîte."
          : 'Cet email correspond déjà à un compte.',
      });
    }

    const { data: inv, error } = await supabaseAdmin
      .from('driver_invitations')
      .insert({
        token: crypto.randomBytes(24).toString('hex'),
        first_name: first_name.trim(), last_name: last_name.trim(), email: cleanEmail,
        phone: phone?.trim() || null, vehicle_category,
        driver_role: driver_role === 'principal' ? 'principal' : 'secondaire',
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    if (send_email) await sendEmail(inv.email, 'Invitation à rejoindre Rennes VTC', inviteEmailText(inv));
    res.status(201).json({ id: inv.id, link: link(inv.token), emailed: !!send_email });
  });

  app.get('/admin/driver-invitations', requireAdmin, async (req, res) => {
    const { data } = await supabaseAdmin.from('driver_invitations').select('*').order('created_at', { ascending: false }).limit(100);
    res.json((data ?? []).map((inv) => ({ ...inv, link: inv.status === 'sent' ? link(inv.token) : null, token: undefined })));
  });

  app.post('/admin/driver-invitations/:id/email', requireAdmin, async (req, res) => {
    const { data: inv } = await supabaseAdmin.from('driver_invitations').select('*').eq('id', req.params.id).single();
    if (!inv || inv.status !== 'sent') return res.status(400).json({ error: "Cette invitation n'est plus active." });
    await sendEmail(inv.email, 'Invitation à rejoindre Rennes VTC', inviteEmailText(inv));
    res.json({ ok: true });
  });

  app.delete('/admin/driver-invitations/:id', requireAdmin, async (req, res) => {
    const { error } = await supabaseAdmin.from('driver_invitations').update({ status: 'cancelled' }).eq('id', req.params.id).eq('status', 'sent');
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  });

  // Dossier complet : infos, vehicule propose et documents (liens temporaires, jamais publics).
  app.get('/admin/driver-invitations/:id/dossier', requireAdmin, async (req, res) => {
    const { data: inv } = await supabaseAdmin.from('driver_invitations').select('*').eq('id', req.params.id).single();
    if (!inv) return res.status(404).json({ error: 'Dossier introuvable' });
    const [{ data: profile }, { data: vehicle }, { data: docs }] = await Promise.all([
      inv.profile_id ? supabaseAdmin.from('profiles').select('email, full_name, phone, address, vtc_card_number, siret').eq('id', inv.profile_id).single() : { data: null },
      inv.profile_id ? supabaseAdmin.from('vehicles').select('display_name, plate, color, seats').eq('driver_id', inv.profile_id).maybeSingle() : { data: null },
      supabaseAdmin.from('driver_documents').select('doc_type, file_path, file_name').eq('invitation_id', inv.id),
    ]);
    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls((docs ?? []).map((d) => d.file_path), 3600);
    const urlByPath = Object.fromEntries((signed ?? []).map((s) => [s.path, s.signedUrl]));
    res.json({
      invitation: { ...inv, token: undefined },
      profile, vehicle,
      documents: (docs ?? []).map((d) => ({ type: d.doc_type, label: DOC_TYPES[d.doc_type]?.[0] ?? d.doc_type, name: d.file_name, url: urlByPath[d.file_path] ?? null })),
    });
  });

  // Validation : le candidat devient chauffeur (role "chauffeur"), son vehicule est active.
  app.post('/admin/driver-invitations/:id/validate', requireAdmin, async (req, res) => {
    const { data: inv } = await supabaseAdmin.from('driver_invitations').select('*').eq('id', req.params.id).single();
    if (!inv || inv.status !== 'submitted' || !inv.profile_id) return res.status(400).json({ error: "Ce dossier n'est pas en attente de validation." });
    const category = CATEGORIES.includes(req.body.vehicle_category) ? req.body.vehicle_category : inv.vehicle_category;
    const driver_role = req.body.driver_role === 'principal' ? 'principal' : req.body.driver_role === 'secondaire' ? 'secondaire' : inv.driver_role;
    const { error } = await supabaseAdmin.from('profiles').update({
      role: 'chauffeur', driver_role, vehicle_category: category, vehicle_categories: [category],
      can_create_rides: !!req.body.can_create_rides, can_edit_price: !!req.body.can_edit_price,
    }).eq('id', inv.profile_id);
    if (error) return res.status(400).json({ error: error.message });
    await supabaseAdmin.from('vehicles').update({ active: true, vehicle_category: category }).eq('driver_id', inv.profile_id);
    await supabaseAdmin.from('driver_invitations').update({ status: 'validated', validated_at: new Date().toISOString(), vehicle_category: category, driver_role }).eq('id', inv.id);
    await sendEmail(
      inv.email,
      'Votre profil chauffeur Rennes VTC est activé',
      `Bonjour ${inv.first_name},\n\nVotre dossier a été validé : votre profil chauffeur est maintenant actif.\n\nVous pouvez vous connecter à l'application Rennes VTC Driver avec votre adresse email (${inv.email}) et le mot de passe que vous avez choisi lors de votre inscription.\n\nBienvenue dans l'équipe,\nRennes VTC`
    );
    res.json({ ok: true });
  });

  app.post('/admin/driver-invitations/:id/refuse', requireAdmin, async (req, res) => {
    const reason = String(req.body.reason ?? '').trim().slice(0, 1000);
    const { data: inv } = await supabaseAdmin.from('driver_invitations').select('*').eq('id', req.params.id).single();
    if (!inv || inv.status !== 'submitted') return res.status(400).json({ error: "Ce dossier n'est pas en attente de validation." });
    await supabaseAdmin.from('driver_invitations').update({ status: 'refused', refusal_reason: reason || null }).eq('id', inv.id);
    await sendEmail(
      inv.email,
      'Votre dossier chauffeur Rennes VTC',
      `Bonjour ${inv.first_name},\n\nNous ne pouvons pas valider votre dossier pour le moment.${reason ? `\n\nMotif : ${reason}` : ''}\n\nPour toute question, contactez-nous au 07 68 42 52 62 ou par email à rennesvtc@gmail.com.\n\nRennes VTC`
    );
    res.json({ ok: true });
  });

  // ---------- Public (par lien d'invitation) ----------

  app.get('/inscription-chauffeur/:token', (req, res) => res.sendFile(require('path').join(__dirname, '../public/inscription-chauffeur/index.html')));

  app.get('/public/driver-invite/:token', async (req, res) => {
    const { inv, error } = await loadUsableInvitation(req.params.token);
    if (error) return res.status(error[0]).json({ error: error[1] });
    const { data: settings } = await supabaseAdmin.from('app_settings').select('app_name, logo_url, accent_color, accent_contrast').eq('id', true).single();
    res.json({
      first_name: inv.first_name, last_name: inv.last_name, email: inv.email, phone: inv.phone,
      docTypes: Object.entries(DOC_TYPES).map(([type, [label, required]]) => ({ type, label, required })),
      branding: settings,
    });
  });

  // URL d'envoi temporaire : le fichier part directement vers le stockage prive.
  app.post('/public/driver-invite/:token/upload-url', async (req, res) => {
    const { inv, error } = await loadUsableInvitation(req.params.token);
    if (error) return res.status(error[0]).json({ error: error[1] });
    const { type, filename } = req.body;
    if (!DOC_TYPES[type]) return res.status(400).json({ error: 'Type de document inconnu.' });
    const path = `${inv.id}/${type}-${Date.now()}-${safeName(filename)}`;
    const { data, error: signError } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (signError) return res.status(400).json({ error: signError.message });
    res.json({ path, token: data.token });
  });

  app.post('/public/driver-invite/:token/submit', async (req, res) => {
    const { inv, error } = await loadUsableInvitation(req.params.token);
    if (error) return res.status(error[0]).json({ error: error[1] });
    const b = req.body;
    const fail = (msg) => res.status(400).json({ error: msg });

    if (!b.phone?.trim() || !b.address?.trim() || !b.vtc_card_number?.trim() || !b.siret?.trim()) return fail('Téléphone, adresse, numéro de carte VTC et SIRET sont requis.');
    if (!b.vehicle?.name?.trim() || !b.vehicle?.plate?.trim()) return fail('Indiquez le modèle et la plaque de votre véhicule.');
    if (typeof b.password !== 'string' || b.password.length < 8) return fail('Le mot de passe doit contenir au moins 8 caractères.');
    if (!b.accepted) return fail('Vous devez certifier l\'exactitude de vos informations.');
    const docs = Array.isArray(b.documents) ? b.documents : [];
    for (const [type, [label, required]] of Object.entries(DOC_TYPES)) {
      if (required && !docs.some((d) => d.type === type)) return fail(`Document manquant : ${label}.`);
    }
    if (docs.some((d) => !DOC_TYPES[d.type] || !String(d.path).startsWith(inv.id + '/'))) return fail('Document invalide.');

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: inv.email, password: b.password, email_confirm: true, user_metadata: { role: 'candidat' },
    });
    if (createError) return fail(createError.message.includes('already') ? 'Un compte existe déjà avec cet email.' : createError.message);
    const userId = created.user.id;

    await supabaseAdmin.from('profiles').update({
      full_name: `${inv.first_name} ${inv.last_name}`, phone: b.phone.trim(), address: b.address.trim(),
      vtc_card_number: b.vtc_card_number.trim(), siret: b.siret.trim(),
      driver_role: inv.driver_role, vehicle_category: inv.vehicle_category, vehicle_categories: [inv.vehicle_category],
    }).eq('id', userId);
    await supabaseAdmin.from('vehicles').insert({
      driver_id: userId, vehicle_category: inv.vehicle_category, display_name: b.vehicle.name.trim(),
      plate: b.vehicle.plate.trim().toUpperCase(), color: b.vehicle.color?.trim() || null,
      seats: Math.min(Math.max(parseInt(b.vehicle.seats, 10) || 4, 1), 9), active: false,
    });
    await supabaseAdmin.from('driver_documents').insert(docs.map((d) => ({ invitation_id: inv.id, doc_type: d.type, file_path: d.path, file_name: String(d.name || '').slice(0, 120) })));
    await supabaseAdmin.from('driver_invitations').update({ status: 'submitted', profile_id: userId, submitted_at: new Date().toISOString() }).eq('id', inv.id);

    await sendAdminEmail(
      `Nouveau dossier chauffeur à valider - ${inv.first_name} ${inv.last_name}`,
      `${inv.first_name} ${inv.last_name} (${inv.email}) a rempli son dossier chauffeur et déposé ses documents.\n\nConnectez-vous à l'espace admin, rubrique Chauffeurs, pour étudier le dossier puis le valider ou le refuser.`
    );
    await sendEmail(inv.email, 'Votre dossier chauffeur a bien été reçu', `Bonjour ${inv.first_name},\n\nNous avons bien reçu votre dossier. Il va être étudié par Rennes VTC et vous serez prévenu par email dès l'activation de votre profil.\n\nRennes VTC`);
    res.json({ ok: true });
  });
}

module.exports = { registerDriverOnboarding };
