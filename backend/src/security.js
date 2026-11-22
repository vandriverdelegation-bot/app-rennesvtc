// Outils de securite du serveur : comparaison de signatures sans plantage, limites d'appels, en-tetes de securite, sites autorises.
const crypto = require('crypto');

// Compare deux textes secrets sans jamais lever d'erreur (une longueur differente ou des caracteres speciaux renvoient simplement false).
function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Limite d'appels par fenetre de temps (compteur en memoire).
// shortcut: compteur propre a ce serveur ; a remplacer par un stockage partage si on passe a plusieurs instances Render.
function limit({ max, windowMs, by = 'ip', name = 'limite' }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, Math.min(windowMs, 60000)).unref();
  return (req, res, next) => {
    const key = by === 'user' ? req.user?.id ?? req.ip : by === 'ip' ? req.ip : by(req);
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset <= now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
    h.n += 1;
    if (h.n > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: 'Trop de requetes, reessayez dans un instant.' });
    }
    next();
  };
}

// En-tetes de securite sur toutes les reponses.
function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  next();
}

// Sites autorises a appeler l'API depuis un navigateur. Les applis du telephone n'envoient pas d'origine : elles ne sont pas concernees.
function corsOptions(baseUrl) {
  const allowed = new Set([baseUrl, 'https://rennesvtc.com', 'https://www.rennesvtc.com', 'http://localhost:3000', 'http://localhost:8081', 'http://localhost:8082']);
  return {
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
    maxAge: 86400,
  };
}

// Les routes async d'Express 4 ne transmettent pas leurs erreurs : on les attrape pour qu'une erreur ne plante jamais le serveur.
function catchAsyncErrors(app) {
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
    const original = app[m].bind(app);
    app[m] = (path, ...handlers) => {
      if (!handlers.length) return original(path); // app.get('reglage')
      return original(path, ...handlers.map((h) => (typeof h !== 'function' || h.length >= 4 ? h : (req, res, next) => {
        try {
          const out = h(req, res, next);
          if (out && typeof out.catch === 'function') out.catch(next);
        } catch (e) { next(e); }
      })));
    };
  }
}

module.exports = { safeEqual, limit, securityHeaders, corsOptions, catchAsyncErrors };
