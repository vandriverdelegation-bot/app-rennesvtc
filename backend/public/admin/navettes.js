// Back-office : navettes evenementielles (liste, evenement, logo, departs). Charge apres le script principal.
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
  let current = null; // evenement ouvert (avec ses departs)

  const fail = (e) => alert(e.message || 'Une erreur est survenue.');
  const options = (list, value, label, selected, empty) => (empty ? `<option value="">${esc(empty)}</option>` : '') + list.map((x) => `<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${esc(label(x))}</option>`).join('');
  const vehicleLabel = (v) => `${v.display_name}${v.plate ? ' (' + v.plate + ')' : ''} - ${v.seats} places`;
  const driverLabel = (d) => d.full_name || d.email;

  // ---- Liste des evenements
  async function showList() {
    current = null;
    root().innerHTML = '<p class="hint">Chargement...</p>';
    try {
      const events = await api('/admin/navettes/events');
      root().innerHTML = `
        <p class="hint">Les invites s'inscrivent eux-memes a un depart de navette en scannant un QR code ou en ouvrant un lien, sans application ni compte.</p>
        <div class="price-row"><button id="nav-new">Nouvel evenement</button></div>
        ${events.length === 0 ? '<p>Aucun evenement pour le moment.</p>' : `
        <table><thead><tr><th>Evenement</th><th>Type</th><th>Date</th><th>Etat</th><th>Departs</th><th>Places prises</th><th></th></tr></thead><tbody>
          ${events.map((e) => `<tr>
            <td><strong>${esc(e.name)}</strong></td><td>${TYPES[e.type] ?? e.type}</td><td>${esc(frDate(e.event_date))}</td>
            <td>${STATUS[e.status]}</td><td>${e.departures_count}</td><td>${e.seats_taken} / ${e.seats_total}</td>
            <td><button class="secondary" data-open="${e.id}">Ouvrir</button></td></tr>`).join('')}
        </tbody></table>`}`;
      document.getElementById('nav-new').onclick = () => showEvent(null);
      root().querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => showEvent(b.dataset.open)));
    } catch (e) { root().innerHTML = `<p class="error">${esc(e.message)}</p>`; }
  }

  // ---- Fiche d'un evenement (creation si id vide)
  async function showEvent(id) {
    try {
      if (!lookups) lookups = await api('/admin/navettes/lookups');
      current = id ? await api('/admin/navettes/events/' + id) : null;
      drawEvent();
    } catch (e) { fail(e); }
  }

  function drawEvent() {
    const e = current ?? { name: '', type: 'evenement', event_date: '', pickup_place: '', destination: '', welcome_message: '', pin: '', status: 'ouvert', close_minutes: 1, client_id: null, ride_id: null, departures: [] };
    const L = lookups;
    root().innerHTML = `
      <p><a href="#" id="nav-back">&larr; Tous les evenements</a></p>
      <div class="card" style="max-width:760px">
        <h3>${current ? esc(e.name) : 'Nouvel evenement'}</h3>
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
          <div class="field"><label>Client (facultatif)</label><select id="ne-client">${options(L.clients, 'x', (c) => c.name, e.client_id, 'Aucun')}</select></div>
          <div class="field wide"><label>Reservation Rennes VTC liee (facultatif)</label><select id="ne-ride">${options(L.rides, 'x', (r) => `${r.client_name ?? 'Client'} - ${r.pickup_address} -> ${r.dropoff_address}`, e.ride_id, 'Aucune')}</select></div>
        </div>
        <div class="price-row" style="margin-top:12px">
          <button id="ne-save">${current ? 'Enregistrer' : "Creer l'evenement"}</button>
          ${current ? '<button class="secondary" id="ne-delete" style="color:var(--error)">Supprimer l\'evenement</button>' : ''}
        </div>
      </div>
      ${current ? detailHtml(e) : ''}`;
    document.getElementById('nav-back').onclick = (ev) => { ev.preventDefault(); showList(); };
    document.getElementById('ne-save').onclick = saveEvent;
    if (current) bindDetail();
  }

  async function saveEvent() {
    const body = {
      name: document.getElementById('ne-name').value, type: document.getElementById('ne-type').value, event_date: document.getElementById('ne-date').value,
      pickup_place: document.getElementById('ne-pickup').value, destination: document.getElementById('ne-dest').value, welcome_message: document.getElementById('ne-welcome').value,
      pin: document.getElementById('ne-pin').value, status: document.getElementById('ne-status').value, close_minutes: document.getElementById('ne-close').value,
      client_id: document.getElementById('ne-client').value || null, ride_id: document.getElementById('ne-ride').value || null,
    };
    if (body.pin && !/^\d{4}$/.test(body.pin)) return alert('Le code PIN doit comporter exactement 4 chiffres (ou rester vide).');
    try {
      current = current ? await api('/admin/navettes/events/' + current.id, 'PATCH', body) : await api('/admin/navettes/events', 'POST', body);
      drawEvent();
    } catch (e) { fail(e); }
  }

  // ---- Logo, lien et departs d'un evenement existant
  function detailHtml(e) {
    const L = lookups;
    const vehOpts = (sel) => options(L.vehicles, sel, vehicleLabel, sel, 'Aucun');
    const drvOpts = (sel) => options(L.drivers, sel, driverLabel, sel, 'Aucun');
    return `
      <div class="card" style="max-width:760px;margin-top:14px">
        <h3>Logo de l'evenement (facultatif)</h3>
        <p class="hint">Logo de l'entreprise ou monogramme des maries (PNG, JPG ou SVG). Il est reduit et allege automatiquement pour s'afficher vite sur telephone.</p>
        <div class="price-row">
          ${e.logo_url ? `<img src="${esc(e.logo_url)}" alt="Logo" style="max-height:90px;max-width:220px;background:#fff;border-radius:10px;padding:6px" />` : '<span class="hint">Aucun logo : seul le logo Rennes VTC apparaitra.</span>'}
          <input type="file" id="nl-file" accept="image/png,image/jpeg,image/svg+xml" />
          <button class="secondary" id="nl-send">${e.logo_url ? 'Remplacer le logo' : 'Envoyer le logo'}</button>
          ${e.logo_url ? '<button class="secondary" id="nl-del" style="color:var(--error)">Supprimer le logo</button>' : ''}
        </div>
      </div>
      <div class="card" style="max-width:760px;margin-top:14px">
        <h3>Lien public des invites</h3>
        <input readonly value="${esc(e.public_url)}" style="width:100%" onclick="this.select()" />
        <p class="hint">La page invite, le bouton « Copier », le QR code et le chevalet arrivent aux etapes suivantes.</p>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Departs de navette (${e.departures.length})</h3>
        <p class="hint">Les heures sont celles de Rennes. Un depart apres minuit (00h15, 01h30...) se coche « apres minuit ».</p>
        ${e.departures.length === 0 ? '<p>Aucun depart. Generez-les ci-dessous ou ajoutez-en un a la main.</p>' : `
        <table><thead><tr><th>Heure</th><th>Places</th><th>Vehicule</th><th>Chauffeur</th><th>Etat</th><th></th></tr></thead><tbody>
          ${e.departures.map((d) => `<tr data-dep="${d.id}">
            <td><input type="time" class="dp-time" value="${hhmm(d.departs_at)}" style="width:110px" /><br><label style="font-weight:400"><input type="checkbox" class="dp-next" ${dayOf(d.departs_at) !== e.event_date ? 'checked' : ''} /> apres minuit</label></td>
            <td><input type="number" class="dp-seats" min="1" max="500" value="${d.seats}" style="width:80px" /><br><span class="hint">${d.taken} prise(s)</span></td>
            <td><select class="dp-veh">${vehOpts(d.vehicle_id)}</select></td>
            <td><select class="dp-drv">${drvOpts(d.driver_id)}</select></td>
            <td><select class="dp-status">${['ouvert', 'complet', 'ferme'].map((s) => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${STATUS[s]}</option>`).join('')}</select></td>
            <td><button class="secondary dp-save">Enregistrer</button><br><button class="secondary dp-del" style="color:var(--error)">Supprimer</button></td></tr>`).join('')}
        </tbody></table>
        <div class="price-row" style="margin-top:10px"><input id="sh-min" type="number" placeholder="Minutes (ex. 15 ou -10)" style="width:210px" /><button class="secondary" id="sh-go">Decaler tous les departs</button></div>`}
      </div>
      <div class="card" style="max-width:760px;margin-top:14px">
        <h3>Generer les departs automatiquement</h3>
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
      </div>
      <div class="card" style="max-width:760px;margin-top:14px">
        <h3>Ajouter un depart a la main</h3>
        <div class="price-row">
          <input id="ad-time" type="time" /><label style="font-weight:400"><input type="checkbox" id="ad-next" /> apres minuit</label>
          <input id="ad-seats" type="number" min="1" max="500" placeholder="Places" style="width:100px" />
          <select id="ad-veh">${vehOpts(null)}</select><select id="ad-drv">${drvOpts(null)}</select>
          <button id="ad-go">Ajouter</button>
        </div>
      </div>`;
  }

  // Toutes les routes de departs renvoient l'evenement complet a jour.
  const apply = (promise) => promise.then((ev) => { current = ev; drawEvent(); }).catch(fail);

  function bindDetail() {
    const id = current.id;
    document.getElementById('ne-delete').onclick = async () => {
      if (!confirm(`Supprimer definitivement l'evenement « ${current.name} », ses departs et ses inscriptions ?`)) return;
      try { await api('/admin/navettes/events/' + id, 'DELETE'); showList(); } catch (e) { fail(e); }
    };
    // logo
    document.getElementById('nl-send').onclick = async () => {
      const file = document.getElementById('nl-file').files[0];
      if (!file) return alert("Choisissez d'abord une image.");
      if (file.size > 6 * 1024 * 1024) return alert('Image trop lourde (6 Mo maximum).');
      const { data: { session } } = await window.adminSession();
      const res = await fetch('/admin/navettes/events/' + id + '/logo', { method: 'POST', headers: { 'Content-Type': file.type, Authorization: 'Bearer ' + session.access_token }, body: file });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return alert(json.error || "Envoi impossible.");
      showEvent(id);
    };
    const del = document.getElementById('nl-del');
    if (del) del.onclick = async () => { if (confirm('Supprimer le logo de cet evenement ?')) { try { await api('/admin/navettes/events/' + id + '/logo', 'DELETE'); showEvent(id); } catch (e) { fail(e); } } };
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

  window.renderNavettes = () => (current ? showEvent(current.id) : showList());
})();
