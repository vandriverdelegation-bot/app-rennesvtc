// Note du client en fin de course. Elle est gardee dans la course ; le client est ensuite invite (quelle que soit sa note)
// a partager son avis sur la fiche Google : lien officiel, le client l'ecrit lui-meme avec son compte Google.
const { supabaseAdmin } = require('./supabaseAdmin');

const PLACE_ID = process.env.GOOGLE_PLACE_ID || 'ChIJPfHbDLgDD0gRLJFboMkl_Mg'; // fiche Google « RENNES VTC - Chauffeur prive »
const reviewUrl = () => `https://search.google.com/local/writereview?placeid=${encodeURIComponent(PLACE_ID)}`;

function registerAvisCourse(app, requireSupabaseUser) {
  app.post('/client/rides/:rideId/rating', requireSupabaseUser, async (req, res) => {
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Note invalide (1 a 5).' });
    const { data: ride } = await supabaseAdmin.from('rides').select('id, client_id, status, rating').eq('id', req.params.rideId).single();
    if (!ride || ride.client_id !== req.user.id || ride.status !== 'completed') return res.status(404).json({ error: 'Course introuvable' });
    if (ride.rating) return res.json({ ok: true, rating: ride.rating, reviewUrl: reviewUrl() }); // deja notee : on ne change pas
    const { error } = await supabaseAdmin.from('rides').update({ rating, rated_at: new Date().toISOString() }).eq('id', ride.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true, rating, reviewUrl: reviewUrl() });
  });
}

module.exports = { registerAvisCourse, reviewUrl };
