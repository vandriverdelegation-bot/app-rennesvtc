// Back-office : navettes evenementielles. Deux ecrans par evenement : « Suivi de soiree » (voir les departs et cocher
// les invites a la montee, pense pour le telephone) et « Reglages » (partage, departs, informations, logo).
(function () {
  const api = (path, method, body) => window.adminApi(path, method, body);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = () => document.getElementById('navettes-root');
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
  const dayOf = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }); // AAAA-MM-JJ
  const frDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const STATUS = { ouvert: 'Ouvert', ferme: 'Ferme', termine: 'Termine', complet: 'Complet' };
  const TYPES = { mariage: 'Mariage', entreprise: 'Soiree d\'entreprise', evenement: 'Evenement' };
  let lookups = null;
  let current = null;   // evenement ouvert (avec ses departs)
  let view = 'list';    // list | live | settings
  let liveData = null;  // { event, signups }
  let seq = 0;          // un ecran plus recent annule les reponses tardives des precedents
  let liveTimer = null;
  let liveBusy = false;
  const openState = {}; // sections repliables : ouvert / ferme, memorise d'un affichage a l'autre

  const fail = (e) => alert(e.message || 'Une erreur est survenue.');
  const options = (list, value, label, selected, empty) => (empty ? `<option value="">${esc(empty)}</option>` : '') + list.map((x) => `<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${esc(label(x))}</option>`).join('');
  const vehicleLabel = (v) => `${v.display_name}${v.plate ? ' (' + v.plate + ')' : ''} - ${v.seats} places`;
  const driverLabel = (d) => d.full_name || d.email;
  const stopLive = () => { if (liveTimer) { clearInterval(liveTimer); liveTimer = null; } };

  function injectStyle() {
    if (document.getElementById('nv-style')) return;
    const st = document.createElement('style');
    st.id = 'nv-style';
    st.textContent = `
      .nv-nav { margin: 0 0 8px; } .nv-nav a { cursor: pointer; }
      .nv-title { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 4px 0 6px; font-size: 24px; }
      .nv-sub { color: var(--text-muted); margin: 0 0 14px; }
      .nv-chip { display: inline-block; padding: 3px 11px; border-radius: 99px; font-size: 12px; font-weight: 700; background: var(--card-2, var(--card)); border: 1px solid var(--card-border); }
      .nv-chip.ok { color: var(--accent); border-color: var(--accent); } .nv-chip.off { color: var(--text-muted); } .nv-chip.full { color: var(--error); border-color: var(--error); }
      .nv-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0 16px; max-width: 640px; }
      .nv-stat { border: 1px solid var(--card-border); background: var(--card); border-radius: 14px; padding: 10px 12px; text-align: center; }
      .nv-stat b { display: block; font-size: 26px; line-height: 1.1; } .nv-stat span { color: var(--text-muted); font-size: 12.5px; }
      .nv-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; } .nv-actions button { margin: 0; }
      .nv-dep { border: 1px solid var(--card-border); background: var(--card); border-radius: 18px; padding: 14px; margin-bottom: 14px; max-width: 640px; }
      .nv-dep.closed { opacity: .85; }
      .nv-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
      .nv-time { font-size: 36px; font-weight: 800; line-height: 1; letter-spacing: -.02em; } .nv-time small { font-size: 12px; font-weight: 600; color: var(--text-muted); margin-left: 6px; letter-spacing: 0; }
      .nv-counts { text-align: right; font-size: 14px; color: var(--text-muted); } .nv-counts b { color: var(--text); font-size: 18px; }
      .nv-who { color: var(--text-muted); font-size: 13px; margin: 2px 0 10px; }
      .nv-guest { display: flex; align-items: center; gap: 12px; padding: 11px 12px; margin: 0 0 6px; border: 1px solid var(--card-border); border-radius: 12px; cursor: pointer; font-weight: 400; background: var(--bg, transparent); }
      .nv-nuancier { display: grid; gap: 14px; margin: 8px 0 14px; }
      .nv-famname { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
      .nv-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; }
      .nv-tile { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; margin: 0; padding: 8px 9px 9px; text-align: left; border-radius: 12px; background: var(--card-2); border: 2px solid var(--card-border); color: var(--text); cursor: pointer; transition: transform .12s, border-color .12s; }
      .nv-tile:hover { transform: translateY(-2px); border-color: #4A5851; }
      .nv-tile i { display: block; width: 100%; height: 34px; margin-bottom: 6px; border-radius: 8px; background: var(--c); box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
      .nv-tile b { font-size: 13px; line-height: 1.2; }
      .nv-tile small { font-size: 11.5px; color: var(--text-muted); font-weight: 600; }
      .nv-tile.on { border-color: var(--c); box-shadow: 0 0 0 1px var(--c); background: color-mix(in srgb, var(--c) 10%, var(--card-2)); }
      .nv-tile.on::after { content: '\\2713'; position: absolute; top: 12px; right: 14px; font-weight: 800; font-size: 16px; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,.8); }
      .nv-tile-custom i { background: conic-gradient(#ef4444, #facc15, #5bd42a, #38bdf8, #8b5cf6, #ef4444); }
      .nv-tile-custom.on i { background: var(--c); }
      .nv-tile-custom input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; margin: 0; padding: 0; }
      .nv-colorline { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 12px; }
      .nv-colorline input { width: 110px; margin: 0; text-transform: uppercase; }
      .nv-colorline button { margin: 0; }
      .nv-colorname { font-weight: 700; min-width: 150px; }
      .nv-preview { --c: #5BD42A; --t: #08110A; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 16px 18px; border-radius: 14px; background: #070908; border: 1px solid #232b26; margin-bottom: 6px; }
      .nv-preview .pk { padding: 5px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: color-mix(in srgb, var(--c) 62%, #fff); background: color-mix(in srgb, var(--c) 14%, transparent); border: 1px solid color-mix(in srgb, var(--c) 40%, transparent); }
      .nv-preview .pb { padding: 10px 18px; border-radius: 12px; font-weight: 700; background: var(--c); color: var(--t); }
      .nv-preview .pbar { width: 120px; height: 8px; border-radius: 99px; background: #232b26; overflow: hidden; } .nv-preview .pbar i { display: block; width: 62%; height: 100%; background: var(--c); }
      .nv-preview .pc { font-size: 13px; font-weight: 700; color: color-mix(in srgb, var(--c) 62%, #fff); }
      .nv-guest input { width: 26px; height: 26px; margin: 0; flex: none; accent-color: var(--accent); }
      .nv-guest .nm { flex: 1; font-size: 17px; } .nv-guest .n { font-weight: 700; color: var(--accent); }
      .nv-guest.on { border-color: var(--accent); } .nv-guest.on .nm { color: var(--text-muted); text-decoration: line-through; }
      .nv-none { color: var(--text-muted); margin: 8px 0; }
      .nv-alert { border: 1px solid var(--amber); background: rgba(245,184,61,.1); color: var(--amber); border-radius: 12px; padding: 10px 14px; margin: 0 0 10px; max-width: 640px; font-weight: 600; }
      .nv-g { display: flex; align-items: stretch; gap: 6px; } .nv-g .nv-guest { flex: 1; } .nv-dots { margin: 0 0 6px; min-width: 44px; font-size: 20px; padding: 0 10px; }
      .nv-edit { display: none; gap: 8px; margin: -2px 0 8px; flex-wrap: wrap; } .nv-edit.open { display: flex; } .nv-edit select { flex: 1; min-width: 150px; margin: 0; } .nv-edit button { margin: 0; }
      details.nv-more { margin-top: 10px; border-top: 1px dashed var(--card-border); padding-top: 8px; } details.nv-more > summary { cursor: pointer; color: var(--text-muted); font-size: 14px; padding: 6px 0; }
      .nv-tool { margin: 10px 0; } .nv-tool .price-row { margin-top: 6px; }
      .nv-foot { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; } .nv-foot button { margin: 0; }
      details.nv-sec { border: 1px solid var(--card-border); background: var(--card); border-radius: 16px; padding: 0; margin-bottom: 12px; max-width: 900px; }
      details.nv-sec > summary { cursor: pointer; padding: 14px 16px; font-weight: 700; font-size: 16px; list-style: none; display: flex; align-items: center; justify-content: space-between; }
      details.nv-sec > summary::after { content: '+'; font-size: 22px; color: var(--text-muted); } details.nv-sec[open] > summary::after { content: '−'; }
      details.nv-sec > .nv-body { padding: 0 16px 16px; }
      @media (max-width: 640px) { .nv-time { font-size: 32px; } .nv-stat b { font-size: 22px; } }`;
    document.head.appendChild(st);
  }

  // ---- Liste des evenements
  async function showList() {
    const my = ++seq; stopLive(); injectStyle();
    current = null; view = 'list';
    root().innerHTML = '<p class="hint">Chargement...</p>';
    try {
      const events = await api('/admin/navettes/events');
      if (my !== seq) return;
      root().innerHTML = `
        <p class="hint">Les invites s'inscrivent eux-memes a un depart de navette en scannant un QR code ou en ouvrant un lien, sans application ni compte.</p>
        <div class="price-row"><button id="nav-new">Nouvel evenement</button></div>
        ${events.length === 0 ? '<p>Aucun evenement pour le moment.</p>' : `
        <table><thead><tr><th>Evenement</th><th>Date</th><th>Etat</th><th>Departs</th><th>Places prises</th><th></th></tr></thead><tbody>
          ${events.map((e) => `<tr>
            <td><strong>${esc(e.name)}</strong><br><span class="hint">${TYPES[e.type] ?? e.type}</span></td><td>${esc(frDate(e.event_date))}</td>
            <td>${STATUS[e.status]}</td><td>${e.departures_count}</td><td>${e.seats_taken} / ${e.seats_total}</td>
            <td><button data-live="${e.id}">Suivi de soiree</button> <button class="secondary" data-open="${e.id}">Reglages</button></td></tr>`).join('')}
        </tbody></table>`}`;
      document.getElementById('nav-new').onclick = () => showSettings(null);
      root().querySelectorAll('[data-live]').forEach((b) => (b.onclick = () => showLive(b.dataset.live)));
      root().querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => showSettings(b.dataset.open)));
    } catch (e) { root().innerHTML = `<p class="error">${esc(e.message)}</p>`; }
  }

  // =====================================================================================
  // SUIVI DE SOIREE : departs, invites, cases a cocher
  // =====================================================================================
  async function showLive(id) {
    const my = ++seq; stopLive(); injectStyle();
    try {
      if (!lookups) lookups = await api('/admin/navettes/lookups');
      const d = await api(`/admin/navettes/events/${id}/live`);
      if (my !== seq) return;
      liveData = d; current = d.event; view = 'live';
      drawLive();
      liveTimer = setInterval(() => refreshLive(false), 8000);
    } catch (e) { fail(e); }
  }

  async function refreshLive(force) {
    if (view !== 'live' || !current || (liveBusy && !force)) return;
    if (!force && (document.hidden || !root() || root().offsetParent === null)) return; // onglet masque : pas de requete inutile
    if (!force && editingNow()) return; // saisie ou menu ouvert : on ne remplace pas l'ecran
    liveBusy = true;
    try {
      const d = await api(`/admin/navettes/events/${current.id}/live`);
      if (view === 'live' && d.event.id === current.id) { liveData = d; current = d.event; drawLive(); }
    } catch (e) { /* nouvel essai au prochain tour */ } finally { liveBusy = false; }
  }

  const editingNow = () => {
    const r = root();
    if (!r) return false;
    if (r.querySelector('details.nv-more[open], .nv-edit.open')) return true;
    const a = document.activeElement;
    return !!(a && r.contains(a) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName) && a.type !== 'checkbox');
  };

  // Liste imprimable (une page par depart) avec une case a cocher a la montee.
  function printLists(depIds) {
    const { event: ev, signups } = liveData;
    const deps = ev.departures.filter((d) => depIds.includes(d.id));
    const w = window.open('', '_blank');
    if (!w) return alert('Autorisez les fenetres surgissantes pour imprimer la liste.');
    const veh = (id) => lookups?.vehicles.find((v) => v.id === id);
    const drv = (id) => lookups?.drivers.find((d) => d.id === id);
    const pages = deps.map((d) => {
      const list = signups.filter((x) => x.departure_id === d.id);
      const n = list.reduce((a, x) => a + x.seats, 0);
      const who = [drv(d.driver_id) && driverLabel(drv(d.driver_id)), veh(d.vehicle_id) && veh(d.vehicle_id).display_name].filter(Boolean).join(' - ');
      return `<section><h1>${esc(ev.name)}</h1><h2>Départ de ${hhmm(d.departs_at).replace(':', 'h')}${dayOf(d.departs_at) !== ev.event_date ? ' (après minuit)' : ''} - ${esc(frDate(dayOf(d.departs_at)))}</h2>
        <p>${esc([ev.pickup_place, ev.destination].filter(Boolean).join(' > '))}${who ? ' | ' + esc(who) : ''}</p>
        <p><b>${n}</b> passager(s) inscrit(s) pour ${d.seats} place(s)</p>
        <table>${list.map((x) => `<tr><td class="c">${x.boarded ? '&#9745;' : '&#9744;'}</td><td>${esc(x.last_name.toUpperCase())} ${esc(x.first_name)}</td><td class="r">${x.seats > 1 ? x.seats + ' places' : '1 place'}</td></tr>`).join('') || '<tr><td colspan="3">Aucun inscrit</td></tr>'}
        ${Array.from({ length: 3 }, () => '<tr class="blank"><td class="c">&#9744;</td><td></td><td></td></tr>').join('')}</table></section>`;
    }).join('');
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Liste de montée - ${esc(ev.name)}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:24px} section{page-break-after:always} section:last-child{page-break-after:auto}
      h1{font-size:22px;margin:0 0 4px} h2{font-size:30px;margin:0 0 6px} p{margin:2px 0 10px;font-size:14px}
      table{width:100%;border-collapse:collapse;margin-top:10px} td{border-bottom:1px solid #999;padding:9px 6px;font-size:18px} td.c{width:38px;font-size:26px;text-align:center} td.r{width:110px;text-align:right;font-size:15px} tr.blank td{height:34px}
      </style></head><body>${pages}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
    w.document.close();
  }

  function drawLive() {
    const { event: ev, signups } = liveData;
    const by = {};
    signups.forEach((s) => { (by[s.departure_id] ??= []).push(s); });
    const pax = signups.reduce((a, s) => a + s.seats, 0);
    const boarded = signups.filter((s) => s.boarded).reduce((a, s) => a + s.seats, 0);
    const seatsTotal = ev.departures.reduce((a, d) => a + d.seats, 0);
    const veh = (id) => lookups?.vehicles.find((v) => v.id === id);
    const drv = (id) => lookups?.drivers.find((d) => d.id === id);
    const others = (d) => ev.departures.filter((o) => o.id !== d.id);
    const evChip = ev.status === 'ouvert' ? '<span class="nv-chip ok">Inscriptions ouvertes</span>' : `<span class="nv-chip off">${ev.status === 'ferme' ? 'Inscriptions fermees' : 'Evenement termine'}</span>`;
    root().innerHTML = `
      <p class="nv-nav"><a id="lv-back">&larr; Tous les evenements</a></p>
      <h3 class="nv-title">${esc(ev.name)} ${evChip}</h3>
      <p class="nv-sub">${esc(frDate(ev.event_date))}${ev.pickup_place ? ' · ' + esc(ev.pickup_place) : ''}${ev.destination ? ' &rarr; ' + esc(ev.destination) : ''}</p>
      <div class="nv-stats">
        <div class="nv-stat"><b>${pax}</b><span>passagers inscrits</span></div>
        <div class="nv-stat"><b>${boarded}</b><span>montes</span></div>
        <div class="nv-stat"><b>${seatsTotal - pax}</b><span>places libres</span></div>
      </div>
      ${(liveData.alerts ?? []).map((a) => `<div class="nv-alert">&#9888; Depart de ${esc(a.time.replace(':', 'h'))} : ${a.taken} / ${a.seats} inscrit(s), moins de 25 % a moins d'une heure du depart. Pensez a le regrouper avec un autre depart.</div>`).join('')}
      <div class="nv-actions">
        <button class="secondary" id="lv-settings">Reglages</button>
        <button class="secondary" id="lv-print-all">Imprimer toutes les listes</button>
        <button class="secondary" id="lv-copy">Copier le lien invite</button>
        ${ev.status === 'ouvert' ? '<button class="secondary" id="lv-close" style="color:var(--error)">Fermer toutes les inscriptions</button>' : (ev.status === 'ferme' ? '<button class="secondary" id="lv-reopen">Rouvrir les inscriptions</button>' : '')}
      </div>
      ${ev.departures.length === 0 ? '<p class="nv-none">Aucun depart : ouvrez les reglages pour en generer.</p>' : ''}
      ${ev.departures.map((d) => {
        const list = by[d.id] ?? [];
        const n = list.reduce((a, s) => a + s.seats, 0);
        const b = list.filter((s) => s.boarded).reduce((a, s) => a + s.seats, 0);
        const closed = d.status === 'ferme';
        const who = [drv(d.driver_id) && driverLabel(drv(d.driver_id)), veh(d.vehicle_id) && veh(d.vehicle_id).display_name].filter(Boolean).join(' · ');
        return `<section class="nv-dep ${closed ? 'closed' : ''}" data-dep="${d.id}">
          <div class="nv-head"><div class="nv-time">${hhmm(d.departs_at).replace(':', 'h')}${dayOf(d.departs_at) !== ev.event_date ? '<small>apres minuit</small>' : ''}</div>
            <div class="nv-counts"><b>${n} / ${d.seats}</b> places<br>montes <b>${b}</b> / ${n} ${closed ? '<br><span class="nv-chip off">ferme</span>' : (d.taken >= d.seats ? '<br><span class="nv-chip full">complet</span>' : '')}</div></div>
          ${who ? `<p class="nv-who">${esc(who)}</p>` : ''}
          ${list.length ? list.map((s) => `<div class="nv-g"><label class="nv-guest ${s.boarded ? 'on' : ''}"><input type="checkbox" data-sid="${s.id}" ${s.boarded ? 'checked' : ''} /><span class="nm">${esc(s.first_name)} ${esc(s.last_name)}</span>${s.seats > 1 ? `<span class="n">×${s.seats}</span>` : ''}</label><button class="secondary nv-dots" data-more="${s.id}" aria-label="Actions">&#8943;</button></div>
            <div class="nv-edit" id="ed-${s.id}"><select class="ed-dest">${others(d).map((o) => `<option value="${o.id}">${hhmm(o.departs_at).replace(':', 'h')} (${o.seats - o.taken} libre${o.seats - o.taken > 1 ? 's' : ''})</option>`).join('') || '<option value="">Aucun autre depart</option>'}</select><button class="secondary" data-move="${s.id}">Deplacer</button><button class="secondary" data-del="${s.id}" style="color:var(--error)">Retirer</button></div>`).join('') : '<p class="nv-none">Personne d\'inscrit.</p>'}
          <div class="nv-foot">
            ${list.length ? `<button class="secondary" data-all="${d.id}" data-val="${b < n ? 'true' : 'false'}">${b < n ? 'Tout cocher' : 'Tout decocher'}</button>` : ''}
            <button class="secondary" data-toggle="${d.id}" data-next="${closed ? 'ouvert' : 'ferme'}">${closed ? 'Rouvrir ce depart' : 'Fermer ce depart'}</button>
            <button class="secondary" data-print="${d.id}">Imprimer la liste</button>
          </div>
          <details class="nv-more"><summary>Plus d'actions sur ce depart</summary>
            <div class="nv-tool"><b>Ajouter un passager</b><div class="price-row"><input class="ad-first" placeholder="Prenom" /><input class="ad-last" placeholder="Nom" /><select class="ad-seats">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n} place${n > 1 ? 's' : ''}</option>`).join('')}</select><button data-add="${d.id}">Ajouter</button></div></div>
            <div class="nv-tool"><b>Regrouper vers un autre depart</b><p class="hint" style="margin:2px 0 6px">Tous les passagers de ce depart partent sur le depart choisi (refuse s'il manque de la place) et en sont prevenus sur leur page.</p><div class="price-row"><select class="mg-dest">${others(d).map((o) => `<option value="${o.id}">${hhmm(o.departs_at).replace(':', 'h')} (${o.seats - o.taken} libre${o.seats - o.taken > 1 ? 's' : ''})</option>`).join('') || '<option value="">Aucun autre depart</option>'}</select><button class="secondary" data-merge="${d.id}" ${list.length ? '' : 'disabled'}>Regrouper</button></div></div>
            <div class="nv-tool"><b>Modifier l'heure ou les places</b><p class="hint" style="margin:2px 0 6px">Les inscrits sont prevenus d'un changement d'heure. Les places ne peuvent pas descendre sous le nombre d'inscrits (${n}).</p><div class="price-row"><input type="time" class="ed-time" value="${hhmm(d.departs_at)}" /><label style="font-weight:400"><input type="checkbox" class="ed-next" ${dayOf(d.departs_at) !== ev.event_date ? 'checked' : ''} /> apres minuit</label><input type="number" class="ed-seats" min="1" max="500" value="${d.seats}" style="width:90px" /><button class="secondary" data-edit="${d.id}">Enregistrer</button></div></div>
            ${list.length === 0 ? `<div class="nv-tool"><button class="secondary" data-rmdep="${d.id}" style="color:var(--error)">Supprimer ce depart (vide)</button></div>` : ''}
          </details></section>`;
      }).join('')}`;
    document.getElementById('lv-back').onclick = (e) => { e.preventDefault(); showList(); };
    document.getElementById('lv-settings').onclick = () => showSettings(ev.id);
    document.getElementById('lv-copy').onclick = async (e) => {
      try { await Promise.race([navigator.clipboard.writeText(ev.public_url), new Promise((_, no) => setTimeout(no, 1000))]); } catch { prompt('Copiez ce lien :', ev.public_url); return; }
      e.target.textContent = 'Lien copie ✓'; setTimeout(() => { if (e.target) e.target.textContent = 'Copier le lien invite'; }, 2200);
    };
    const act = (fn) => async (...a) => { liveBusy = true; try { await fn(...a); } catch (e) { fail(e); } finally { liveBusy = false; } await refreshLive(true); };
    root().querySelectorAll('input[data-sid]').forEach((c) => (c.onchange = act(() => api('/admin/navettes/signups/' + c.dataset.sid, 'PATCH', { boarded: c.checked }))));
    root().querySelectorAll('[data-all]').forEach((b) => (b.onclick = act(() => api(`/admin/navettes/departures/${b.dataset.all}/boarded`, 'POST', { boarded: b.dataset.val === 'true' }))));
    root().querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = act(() => api('/admin/navettes/departures/' + b.dataset.toggle, 'PATCH', { status: b.dataset.next }))));
    const close = document.getElementById('lv-close');
    if (close) close.onclick = act(async () => { if (confirm('Fermer les inscriptions de tout l\'evenement ? Les invites ne pourront plus s\'inscrire.')) await api('/admin/navettes/events/' + ev.id, 'PATCH', { status: 'ferme' }); });
    document.getElementById('lv-print-all').onclick = () => printLists(ev.departures.map((d) => d.id));
    root().querySelectorAll('[data-print]').forEach((b) => (b.onclick = () => printLists([b.dataset.print])));
    // actions par invite : menu « ... » puis deplacer / retirer
    root().querySelectorAll('[data-more]').forEach((b) => (b.onclick = () => document.getElementById('ed-' + b.dataset.more).classList.toggle('open')));
    root().querySelectorAll('[data-move]').forEach((b) => (b.onclick = act(() => { const dest = b.parentElement.querySelector('.ed-dest').value; if (!dest) throw new Error('Aucun autre depart disponible.'); return api('/admin/navettes/signups/' + b.dataset.move, 'PATCH', { departure_id: dest }); })));
    root().querySelectorAll('[data-del]').forEach((b) => (b.onclick = act(async () => { if (confirm('Retirer cet invite de la navette ?')) await api('/admin/navettes/signups/' + b.dataset.del, 'DELETE'); })));
    // outils par depart
    root().querySelectorAll('[data-add]').forEach((b) => (b.onclick = act(() => { const t = b.closest('.nv-tool'); return api('/admin/navettes/departures/' + b.dataset.add + '/passengers', 'POST', { first_name: t.querySelector('.ad-first').value, last_name: t.querySelector('.ad-last').value, seats: t.querySelector('.ad-seats').value }); })));
    root().querySelectorAll('[data-merge]').forEach((b) => (b.onclick = act(async () => { const dest = b.parentElement.querySelector('.mg-dest').value; if (!dest) throw new Error('Aucun autre depart disponible.'); if (confirm('Deplacer tous les passagers de ce depart vers le depart choisi ?')) { const r = await api('/admin/navettes/departures/' + b.dataset.merge + '/merge', 'POST', { to: dest }); alert(r.passengers + ' passager(s) deplace(s). Ils en sont prevenus sur leur page. Vous pouvez maintenant supprimer ce depart vide.'); } })));
    root().querySelectorAll('[data-edit]').forEach((b) => (b.onclick = act(() => { const t = b.closest('.nv-tool'); return api('/admin/navettes/departures/' + b.dataset.edit, 'PATCH', { time: t.querySelector('.ed-time').value, next_day: t.querySelector('.ed-next').checked, seats: t.querySelector('.ed-seats').value }); })));
    root().querySelectorAll('[data-rmdep]').forEach((b) => (b.onclick = act(async () => { if (confirm('Supprimer ce depart ?')) await api('/admin/navettes/departures/' + b.dataset.rmdep, 'DELETE'); })));
    const reopen = document.getElementById('lv-reopen');
    if (reopen) reopen.onclick = act(() => api('/admin/navettes/events/' + ev.id, 'PATCH', { status: 'ouvert' }));
  }

  // =====================================================================================
  // REGLAGES : partage, departs, informations, logo
  // =====================================================================================
  async function showSettings(id) {
    const my = ++seq; stopLive(); injectStyle();
    try {
      if (!lookups) lookups = await api('/admin/navettes/lookups');
      const ev = id ? await api('/admin/navettes/events/' + id) : null;
      if (my !== seq) return;
      current = ev; view = 'settings';
      drawSettings();
    } catch (e) { fail(e); }
  }

  const section = (key, title, defOpen, html) => `<details class="nv-sec" data-key="${key}" ${(openState[key] ?? defOpen) ? 'open' : ''}><summary>${title}</summary><div class="nv-body">${html}</div></details>`;

  // Palette de couleurs pour la page des invites et le chevalet (noms parlants pour choisir selon les mariés ou l'entreprise).
  const NUANCIER = [
    ['Verts', [['#5BD42A', 'Vert Rennes VTC'], ['#A3E635', 'Citron vert'], ['#10B981', 'Émeraude'], ['#14B8A6', 'Turquoise'], ['#7CB69D', 'Sauge'], ['#2F7D5B', 'Sapin']]],
    ['Bleus', [['#38BDF8', 'Bleu ciel'], ['#0EA5E9', 'Azur'], ['#3B82F6', 'Bleu roi'], ['#6366F1', 'Indigo'], ['#94A3B8', 'Bleu gris'], ['#1E3A8A', 'Bleu marine']]],
    ['Violets et roses', [['#8B5CF6', 'Violet'], ['#B197FC', 'Lavande'], ['#C4A1E0', 'Mauve'], ['#EC4899', 'Rose'], ['#F0A6C0', 'Rose poudré'], ['#C026D3', 'Fuchsia']]],
    ['Rouges et oranges', [['#EF4444', 'Rouge'], ['#BE3455', 'Bordeaux'], ['#FF7A59', 'Corail'], ['#E07A5F', 'Terracotta'], ['#F97316', 'Orange'], ['#FB923C', 'Abricot']]],
    ['Dorés et neutres', [['#FACC15', 'Jaune'], ['#D4AF37', 'Or'], ['#E8D5A8', 'Champagne'], ['#CBD5E1', 'Argent'], ['#A8A29E', 'Taupe'], ['#F5F5F4', 'Blanc cassé']]],
  ];
  const PALETTE = NUANCIER.flatMap(([, list]) => list);
  let pickedColor = '';
  const colorHtml = (e) => {
    pickedColor = e.accent_color || '';
    if (!lookups.accent_supported) return '<div class="field wide"><label>Couleur de la page des invites</label><p class="hint">Pour activer le choix de couleur, la migration « 054_navettes_couleur » doit d\'abord être appliquée dans Supabase.</p></div>';
    const shown = pickedColor || PALETTE[0][0];
    return `<div class="field wide"><label>Couleur de la page des invites et du chevalet</label>
      <div class="nv-nuancier" id="ne-palette">${NUANCIER.map(([family, list]) => `<div class="nv-family"><div class="nv-famname">${family}</div><div class="nv-tiles">${list.map(([hex, name]) => `<button type="button" class="nv-tile${shown.toUpperCase() === hex ? ' on' : ''}" data-hex="${hex}" style="--c:${hex}" aria-label="${name}"><i></i><b>${name}</b><small>${hex}</small></button>`).join('')}</div></div>`).join('')}
        <div class="nv-family"><div class="nv-famname">Autre couleur</div><div class="nv-tiles"><label class="nv-tile nv-tile-custom" style="--c:${esc(shown)}"><i></i><b>Couleur libre</b><small>Choisir...</small><input type="color" id="ne-color-custom" value="${esc(shown)}" /></label></div></div>
      </div>
      <div class="nv-colorline"><span class="nv-colorname" id="ne-color-name"></span><input id="ne-color-hex" value="${esc(shown.toUpperCase())}" maxlength="7" placeholder="#5BD42A" /><button type="button" class="secondary" id="ne-color-reset">Revenir au vert Rennes VTC</button></div>
      <div class="nv-preview" id="ne-color-preview"><span class="pk">${esc(TYPES[e.type] ?? 'Événement')}</span><span class="pb">Réserver ma place</span><span class="pbar"><i></i></span><span class="pc">3 places restantes</span></div>
      <p class="hint">La page ouverte par les invités et le chevalet imprimé reprennent cette couleur (une teinte très sombre est légèrement éclaircie sur la page pour rester lisible). N'oubliez pas d'enregistrer.</p></div>`;
  };
  function bindColor() {
    const pal = document.getElementById('ne-palette');
    if (!pal) return;
    const hexInput = document.getElementById('ne-color-hex'), custom = document.getElementById('ne-color-custom'), preview = document.getElementById('ne-color-preview');
    const name = (hex) => (PALETTE.find(([h]) => h === hex.toUpperCase()) || [])[1] || 'Couleur personnalisée';
    const paint = (hex) => {
      pickedColor = hex.toUpperCase();
      preview.style.setProperty('--c', pickedColor);
      const lum = ((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(pickedColor.slice(i, i + 2), 16));
      const L = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
      preview.style.setProperty('--t', 1.05 / (L + 0.05) > (L + 0.05) / 0.055 ? '#fff' : '#0b0f0c');
      pal.querySelectorAll('.nv-tile[data-hex]').forEach((b2) => b2.classList.toggle('on', b2.dataset.hex === pickedColor));
      const free = pal.querySelector('.nv-tile-custom');
      free.classList.toggle('on', !PALETTE.some(([h]) => h === pickedColor));
      free.style.setProperty('--c', pickedColor);
      hexInput.value = pickedColor; custom.value = pickedColor.toLowerCase();
      document.getElementById('ne-color-name').textContent = name(pickedColor);
    };
    pal.querySelectorAll('.nv-tile[data-hex]').forEach((b2) => { b2.onclick = () => paint(b2.dataset.hex); });
    custom.oninput = () => paint(custom.value);
    hexInput.oninput = () => { const v = hexInput.value.startsWith('#') ? hexInput.value : '#' + hexInput.value; if (/^#[0-9a-f]{6}$/i.test(v)) paint(v); };
    document.getElementById('ne-color-reset').onclick = () => { paint(PALETTE[0][0]); pickedColor = ''; };
    const initial = pickedColor; // vide = vert Rennes VTC par defaut, rien n'est enregistre tant que l'on ne choisit pas
    paint(initial || PALETTE[0][0]);
    pickedColor = initial;
  }

  function drawSettings() {
    const e = current ?? { name: '', type: 'evenement', event_date: '', pickup_place: '', destination: '', welcome_message: '', pin: '', status: 'ouvert', close_minutes: 1, max_party: 4, client_id: null, ride_id: null, departures: [] };
    const L = lookups;
    const info = `
        <div class="form-grid">
          <div class="field wide"><label>Nom affiche aux invites</label><input id="ne-name" value="${esc(e.name)}" placeholder="Mariage de Camille et Hugo" /></div>
          <div class="field"><label>Type</label><select id="ne-type">${Object.entries(TYPES).map(([v, l]) => `<option value="${v}" ${e.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label>Date de l'evenement</label><input id="ne-date" type="date" value="${esc(e.event_date)}" /></div>
          <div class="field"><label>Lieu de depart</label><input id="ne-pickup" value="${esc(e.pickup_place)}" placeholder="Domaine des Pres" /></div>
          <div class="field"><label>Destination</label><input id="ne-dest" value="${esc(e.destination)}" placeholder="Centre-ville de Rennes" /></div>
          <div class="field wide"><label>Message d'accueil / point de rendez-vous</label><textarea id="ne-welcome" style="min-height:60px" placeholder="Rendez-vous devant l'entree principale, 5 minutes avant le depart.">${esc(e.welcome_message)}</textarea></div>
          <div class="field"><label>Code PIN (4 chiffres, facultatif)</label><input id="ne-pin" value="${esc(e.pin)}" maxlength="4" inputmode="numeric" placeholder="Aucun" /></div>
          <div class="field"><label>Etat</label><select id="ne-status"><option value="ouvert" ${e.status === 'ouvert' ? 'selected' : ''}>Ouvert</option><option value="ferme" ${e.status === 'ferme' ? 'selected' : ''}>Ferme</option><option value="termine" ${e.status === 'termine' ? 'selected' : ''}>Termine</option></select></div>
          <div class="field"><label>Cloture automatique (minutes avant le depart)</label><input id="ne-close" type="number" min="0" max="1440" value="${e.close_minutes}" /></div>
          <div class="field"><label>Places maximum par inscription</label><input id="ne-party" type="number" min="1" max="10" value="${e.max_party ?? 4}" /></div>
          <div class="field"><label>Client (facultatif)</label><select id="ne-client">${options(L.clients, 'x', (c) => c.name, e.client_id, 'Aucun')}</select></div>
          ${colorHtml(e)}
          <div class="field wide"><label>Reservation Rennes VTC liee (facultatif)</label><select id="ne-ride">${options(L.rides, 'x', (r) => `${r.client_name ?? 'Client'} - ${r.pickup_address} -> ${r.dropoff_address}`, e.ride_id, 'Aucune')}</select></div>
        </div>
        <div class="price-row" style="margin-top:12px">
          <button id="ne-save">${current ? 'Enregistrer' : "Creer l'evenement"}</button>
          ${current ? '<button class="secondary" id="ne-delete" style="color:var(--error)">Supprimer l\'evenement</button>' : ''}
        </div>`;
    if (!current) {
      root().innerHTML = `<p class="nv-nav"><a id="nav-back">&larr; Tous les evenements</a></p><h3 class="nv-title">Nouvel evenement</h3><div class="card" style="max-width:760px">${info}</div>
        <p class="hint">Apres la creation, vous pourrez generer les departs, copier le lien et imprimer le chevalet.</p>`;
      document.getElementById('nav-back').onclick = (ev) => { ev.preventDefault(); showList(); };
      document.getElementById('ne-save').onclick = saveEvent;
      bindColor();
      return;
    }
    root().innerHTML = `
      <p class="nv-nav"><a id="nav-back">&larr; Tous les evenements</a></p>
      <h3 class="nv-title">${esc(e.name)} <span class="nv-chip">${STATUS[e.status]}</span></h3>
      <p class="nv-sub">${esc(frDate(e.event_date))} · ${e.departures.length} depart${e.departures.length > 1 ? 's' : ''}</p>
      <div class="nv-actions"><button id="nav-golive">Ouvrir le suivi de soiree</button></div>
      ${section('share', 'Lien, QR code et chevalet', true, shareHtml(e))}
      ${section('deps', `Departs (${e.departures.length})`, true, departuresHtml(e))}
      ${section('gen', 'Generer ou ajouter des departs', e.departures.length === 0, generateHtml())}
      ${section('info', 'Informations de l\'evenement', false, info)}
      ${section('logo', 'Logo de l\'evenement', false, logoHtml(e))}`;
    document.getElementById('nav-back').onclick = (ev) => { ev.preventDefault(); showList(); };
    document.getElementById('nav-golive').onclick = () => showLive(e.id);
    root().querySelectorAll('details.nv-sec').forEach((d) => d.addEventListener('toggle', () => { openState[d.dataset.key] = d.open; }));
    document.getElementById('ne-save').onclick = saveEvent;
    bindColor();
    bindDetail();
  }

  async function saveEvent() {
    const body = {
      name: document.getElementById('ne-name').value, type: document.getElementById('ne-type').value, event_date: document.getElementById('ne-date').value,
      pickup_place: document.getElementById('ne-pickup').value, destination: document.getElementById('ne-dest').value, welcome_message: document.getElementById('ne-welcome').value,
      pin: document.getElementById('ne-pin').value, status: document.getElementById('ne-status').value, close_minutes: document.getElementById('ne-close').value, max_party: document.getElementById('ne-party').value,
      client_id: document.getElementById('ne-client').value || null, ride_id: document.getElementById('ne-ride').value || null,
    };
    if (lookups.accent_supported) body.accent_color = pickedColor || null;
    if (body.pin && !/^\d{4}$/.test(body.pin)) return alert('Le code PIN doit comporter exactement 4 chiffres (ou rester vide).');
    try {
      current = current ? await api('/admin/navettes/events/' + current.id, 'PATCH', body) : await api('/admin/navettes/events', 'POST', body);
      drawSettings();
    } catch (e) { fail(e); }
  }

  const vehOpts = (sel) => options(lookups.vehicles, sel, vehicleLabel, sel, 'Aucun');
  const drvOpts = (sel) => options(lookups.drivers, sel, driverLabel, sel, 'Aucun');

  function shareHtml(e) {
    return `
        <p class="hint">Les invites ouvrent ce lien (ou scannent le QR code) : aucune application, aucun compte.</p>
        <div class="price-row">
          <input readonly id="sh-url" value="${esc(e.public_url)}" style="flex:1;min-width:260px" onclick="this.select()" />
          <button id="sh-copy">Copier le lien</button>
          <button class="secondary" id="sh-open">Ouvrir la page invite</button>
        </div>
        <div class="price-row" style="margin-top:14px;align-items:flex-start">
          <img id="sh-qr" alt="QR code du lien public" style="width:190px;height:190px;background:#fff;border-radius:14px;padding:8px" />
          <div>
            <p class="hint" style="margin-top:0">Chevalet a imprimer : logo Rennes VTC, logo de l'evenement, nom, QR code et « Scannez pour reserver votre navette retour »${e.pin ? ' (avec le code PIN)' : ''}.</p>
            <button id="sh-a5">Telecharger le chevalet A5</button>
            <button class="secondary" id="sh-a6">Telecharger le chevalet A6</button>
            <p class="hint" id="sh-msg" style="min-height:1.2em"></p>
          </div>
        </div>`;
  }

  function departuresHtml(e) {
    if (e.departures.length === 0) return '<p>Aucun depart. Generez-les ou ajoutez-en un a la main dans la section suivante.</p>';
    return `<p class="hint">Les heures sont celles de Rennes. Un depart apres minuit (00h15, 01h30...) se coche « apres minuit ».</p>
        <div style="overflow-x:auto"><table><thead><tr><th>Heure</th><th>Places</th><th>Vehicule</th><th>Chauffeur</th><th>Etat</th><th></th></tr></thead><tbody>
          ${e.departures.map((d) => `<tr data-dep="${d.id}">
            <td><input type="time" class="dp-time" value="${hhmm(d.departs_at)}" style="width:110px" /><br><label style="font-weight:400"><input type="checkbox" class="dp-next" ${dayOf(d.departs_at) !== e.event_date ? 'checked' : ''} /> apres minuit</label></td>
            <td><input type="number" class="dp-seats" min="1" max="500" value="${d.seats}" style="width:80px" /><br><span class="hint">${d.taken} prise(s)</span></td>
            <td><select class="dp-veh">${vehOpts(d.vehicle_id)}</select></td>
            <td><select class="dp-drv">${drvOpts(d.driver_id)}</select></td>
            <td><select class="dp-status">${['ouvert', 'complet', 'ferme'].map((s) => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${STATUS[s]}</option>`).join('')}</select></td>
            <td><button class="secondary dp-save">Enregistrer</button><br><button class="secondary dp-del" style="color:var(--error)">Supprimer</button></td></tr>`).join('')}
        </tbody></table></div>
        <div class="price-row" style="margin-top:10px"><input id="sh-min" type="number" placeholder="Minutes (ex. 15 ou -10)" style="width:210px" /><button class="secondary" id="sh-go">Decaler tous les departs</button></div>`;
  }

  function generateHtml() {
    return `
        <h4 style="margin:0 0 8px">Generer automatiquement</h4>
        <div class="form-grid">
          <div class="field"><label>Premier depart</label><input id="gn-start" type="time" value="23:00" /></div>
          <div class="field"><label>Dernier depart au plus tard</label><input id="gn-end" type="time" value="03:00" /></div>
          <div class="field"><label>Frequence (minutes)</label><input id="gn-every" type="number" min="5" max="600" value="75" /></div>
          <div class="field"><label>Places par depart</label><input id="gn-seats" type="number" min="1" max="500" placeholder="Places du vehicule" /></div>
          <div class="field"><label>Vehicule</label><select id="gn-veh">${vehOpts(null)}</select></div>
          <div class="field"><label>Chauffeur</label><select id="gn-drv">${drvOpts(null)}</select></div>
        </div>
        <p class="hint">Exemple : 23h00 a 03h00 toutes les 75 minutes = 23h00, 00h15, 01h30, 02h45. Le passage apres minuit est gere. Les departs deja presents a la meme heure sont conserves.</p>
        <button id="gn-go">Generer les departs</button>
        <h4 style="margin:18px 0 8px">Ajouter un depart a la main</h4>
        <div class="price-row">
          <input id="ad-time" type="time" /><label style="font-weight:400"><input type="checkbox" id="ad-next" /> apres minuit</label>
          <input id="ad-seats" type="number" min="1" max="500" placeholder="Places" style="width:100px" />
          <select id="ad-veh">${vehOpts(null)}</select><select id="ad-drv">${drvOpts(null)}</select>
          <button id="ad-go">Ajouter</button>
        </div>`;
  }

  function logoHtml(e) {
    return `
        <p class="hint">Logo de l'entreprise ou monogramme des maries (PNG, JPG ou SVG). Il est reduit et allege automatiquement pour s'afficher vite sur telephone.</p>
        <div class="price-row">
          ${e.logo_url ? `<img src="${esc(e.logo_url)}" alt="Logo" style="max-height:90px;max-width:220px;background:#fff;border-radius:10px;padding:6px" />` : '<span class="hint">Aucun logo : seul le logo Rennes VTC apparaitra.</span>'}
          <input type="file" id="nl-file" accept="image/png,image/jpeg,image/svg+xml" />
          <button class="secondary" id="nl-send">${e.logo_url ? 'Remplacer le logo' : 'Envoyer le logo'}</button>
          ${e.logo_url ? '<button class="secondary" id="nl-del" style="color:var(--error)">Supprimer le logo</button>' : ''}
        </div>`;
  }

  // Toutes les routes de departs renvoient l'evenement complet a jour.
  const apply = (promise) => promise.then((ev) => { current = ev; drawSettings(); }).catch(fail);

  function bindDetail() {
    const id = current.id;
    document.getElementById('ne-delete').onclick = async () => {
      if (!confirm(`Supprimer definitivement l'evenement « ${current.name} », ses departs et ses inscriptions ?`)) return;
      try { await api('/admin/navettes/events/' + id, 'DELETE'); showList(); } catch (e) { fail(e); }
    };
    // partage : lien, QR code, chevalet (le navigateur envoie la session dans l'en-tete, jamais dans l'adresse)
    const msg = (t) => { const m = document.getElementById('sh-msg'); if (m) m.textContent = t; };
    const authed = async (path) => {
      const { data: { session } } = await window.adminSession();
      const res = await fetch(path, { headers: { Authorization: 'Bearer ' + session.access_token } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Erreur');
      return res.blob();
    };
    authed('/admin/navettes/events/' + id + '/qr.png').then((b) => { document.getElementById('sh-qr').src = URL.createObjectURL(b); }).catch(() => {});
    document.getElementById('sh-open').onclick = () => window.open(current.public_url, '_blank');
    document.getElementById('sh-copy').onclick = async () => {
      const input = document.getElementById('sh-url');
      // Copie moderne, avec repli apres 1 s (certains navigateurs bloquent la copie sans geste de l'utilisateur).
      try { await Promise.race([navigator.clipboard.writeText(current.public_url), new Promise((_, no) => setTimeout(no, 1000))]); } catch { input.select(); document.execCommand('copy'); }
      msg('Lien copie ✓');
      document.getElementById('sh-copy').textContent = 'Lien copie ✓';
      setTimeout(() => { const b = document.getElementById('sh-copy'); if (b) b.textContent = 'Copier le lien'; }, 2500);
    };
    for (const f of ['a5', 'a6']) {
      document.getElementById('sh-' + f).onclick = async () => {
        msg('Preparation du chevalet ' + f.toUpperCase() + '...');
        try {
          const blob = await authed('/admin/navettes/events/' + id + '/chevalet.pdf?format=' + f);
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'chevalet-navette-' + current.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + f + '.pdf';
          document.body.appendChild(a); a.click(); a.remove();
          msg('Chevalet ' + f.toUpperCase() + ' telecharge ✓');
        } catch (e) { msg(e.message); }
      };
    }
    // logo
    document.getElementById('nl-send').onclick = async () => {
      const file = document.getElementById('nl-file').files[0];
      if (!file) return alert("Choisissez d'abord une image.");
      if (file.size > 6 * 1024 * 1024) return alert('Image trop lourde (6 Mo maximum).');
      const { data: { session } } = await window.adminSession();
      const res = await fetch('/admin/navettes/events/' + id + '/logo', { method: 'POST', headers: { 'Content-Type': file.type, Authorization: 'Bearer ' + session.access_token }, body: file });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return alert(json.error || "Envoi impossible.");
      showSettings(id);
    };
    const del = document.getElementById('nl-del');
    if (del) del.onclick = async () => { if (confirm('Supprimer le logo de cet evenement ?')) { try { await api('/admin/navettes/events/' + id + '/logo', 'DELETE'); showSettings(id); } catch (e) { fail(e); } } };
    // departs existants
    root().querySelectorAll('tr[data-dep]').forEach((row) => {
      const depId = row.dataset.dep;
      row.querySelector('.dp-save').onclick = () => apply(api('/admin/navettes/departures/' + depId, 'PATCH', {
        time: row.querySelector('.dp-time').value, next_day: row.querySelector('.dp-next').checked, seats: row.querySelector('.dp-seats').value,
        vehicle_id: row.querySelector('.dp-veh').value || null, driver_id: row.querySelector('.dp-drv').value || null, status: row.querySelector('.dp-status').value,
      }));
      row.querySelector('.dp-del').onclick = () => { if (confirm('Supprimer ce depart ?')) apply(api('/admin/navettes/departures/' + depId, 'DELETE')); };
    });
    const shift = document.getElementById('sh-go');
    if (shift) shift.onclick = () => { const m = document.getElementById('sh-min').value; if (m && confirm(`Decaler tous les departs de ${m} minute(s) ?`)) apply(api('/admin/navettes/events/' + id + '/shift', 'POST', { minutes: m })); };
    // generation
    document.getElementById('gn-go').onclick = () => apply(api('/admin/navettes/events/' + id + '/generate', 'POST', {
      start: document.getElementById('gn-start').value, end: document.getElementById('gn-end').value, every: document.getElementById('gn-every').value,
      seats: document.getElementById('gn-seats').value, vehicle_id: document.getElementById('gn-veh').value || null, driver_id: document.getElementById('gn-drv').value || null,
    }));
    document.getElementById('gn-veh').onchange = (ev) => {
      const v = lookups.vehicles.find((x) => x.id === ev.target.value);
      document.getElementById('gn-seats').placeholder = v ? `${v.seats} (vehicule)` : 'Places du vehicule';
    };
    // ajout manuel
    document.getElementById('ad-go').onclick = () => apply(api('/admin/navettes/events/' + id + '/departures', 'POST', {
      time: document.getElementById('ad-time').value, next_day: document.getElementById('ad-next').checked, seats: document.getElementById('ad-seats').value,
      vehicle_id: document.getElementById('ad-veh').value || null, driver_id: document.getElementById('ad-drv').value || null,
    }));
  }

  // Quand on revient sur l'onglet Navettes : meme ecran qu'avant.
  window.renderNavettes = () => {
    if (current && view === 'live') return showLive(current.id);
    if (current && view === 'settings') return showSettings(current.id);
    return showList();
  };
  window.openNavetteLive = (id) => showLive(id);

  // Raccourci sur le tableau de bord (et donc dans le back-office de l'app chauffeur proprietaire) : evenement du jour ou de la veille.
  window.renderNavettesShortcut = async () => {
    try {
      injectStyle();
      const host = document.getElementById('page-dashboard');
      if (!host) return;
      const events = await api('/admin/navettes/events');
      const day = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
      const live = events.filter((e) => e.status !== 'termine' && [day(-1), day(0), day(1)].includes(e.event_date));
      document.getElementById('nav-shortcut')?.remove();
      if (!live.length) return;
      const box = document.createElement('div');
      box.id = 'nav-shortcut';
      box.className = 'card';
      box.style.cssText = 'margin:0 0 18px;max-width:640px';
      box.innerHTML = `<h3 style="margin:0 0 8px">Navettes de soiree</h3>${live.map((e) => `<div class="price-row" style="align-items:center;margin:6px 0"><div style="flex:1;min-width:200px"><strong>${esc(e.name)}</strong><br><span class="hint">${esc(frDate(e.event_date))} · ${e.seats_taken} / ${e.seats_total} places prises</span>${e.alerts_count ? `<br><span style="color:var(--amber);font-weight:700">&#9888; ${e.alerts_count} depart(s) peu rempli(s) a moins d'une heure</span>` : ''}</div><button data-nv-live="${e.id}">Ouvrir le suivi</button></div>`).join('')}`;
      host.insertBefore(box, host.children[1] ?? null);
      box.querySelectorAll('[data-nv-live]').forEach((b) => (b.onclick = () => { document.querySelector('[data-page=navettes]').click(); showLive(b.dataset.nvLive); }));
    } catch (e) { /* le raccourci est facultatif */ }
  };
})();
