// Verification des heures de depart : node backend/src/navettes.test.js
const assert = require('assert');
const { parisToUtc, departureMinutes } = require('./navettes');

const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}h${String(min % 60).padStart(2, '0')}`;
// 23h00 -> 03h00 toutes les 1h15 : passage apres minuit
assert.deepStrictEqual(departureMinutes('23:00', '03:00', 75).map(hhmm), ['23h00', '00h15', '01h30', '02h45']);
// fin le meme jour
assert.deepStrictEqual(departureMinutes('20:00', '22:00', 60).map(hhmm), ['20h00', '21h00', '22h00']);
// frequence trop courte / heure invalide
assert.strictEqual(departureMinutes('23:00', '03:00', 2), null);
assert.strictEqual(departureMinutes('25:00', '03:00', 60), null);
// Heure de Rennes -> UTC : hiver (UTC+1) et ete (UTC+2)
assert.strictEqual(parisToUtc('2026-11-21', 23 * 60).toISOString(), '2026-11-21T22:00:00.000Z');
assert.strictEqual(parisToUtc('2026-07-11', 23 * 60 + 15).toISOString(), '2026-07-11T21:15:00.000Z');
// apres minuit : le depart de 00h15 est le lendemain
assert.strictEqual(parisToUtc('2026-11-21', 1440 + 15).toISOString(), '2026-11-21T23:15:00.000Z');
// changement d'heure de la nuit du 25 octobre 2026 (a 3h00 il redevient 2h00) : 01h30 le 25 est en heure d'ete, 01h30 le 26 en heure d'hiver
assert.strictEqual(parisToUtc('2026-10-24', 1440 + 90).toISOString(), '2026-10-24T23:30:00.000Z');
assert.strictEqual(parisToUtc('2026-10-25', 1440 + 90).toISOString(), '2026-10-26T00:30:00.000Z');
console.log('navettes : tous les controles sont passes');
