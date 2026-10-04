// Tests du moteur de rotation : node tests/rotation.test.mjs
// Le script de index.html est extrait et exécuté avec un DOM minimal, sans navigateur.
import assert from 'node:assert/strict';
import { loadEngine } from '../scripts/engine.mjs';

const { compute, state, defaults, dutyIds, recLabel, parseBulk, vMoi, checklist, canTick, tick, progress, myCollab, ui, riskDays, vActivite, vAbsences, vPlanning, vEquipe, vReglages, store } = loadEngine();

function reset() {
  Object.assign(state, defaults());
  state.reglages.general.debut = '2026-09-21';
  state.absences = {}; state.affectations = {}; state.ordres = {}; state.liens = {}; state.journal = {};
  store.clear();
}
const week = (from = '2026-10-05', to = '2026-10-09') =>
  Object.values(compute(from, to)).map(d => (d.ferie ? '--' : dutyIds(d).join('+')));

let n = 0;
const pending = [];
const test = (name, fn) => { pending.push([name, fn]); };

test('rotation régulière, une personne par jour', () => {
  assert.deepEqual(week(), ['c3', 'c4', 'c1', 'c2', 'c3']);
});
test('une absence saute la personne, qui reprend à son retour', () => {
  state.absences = { a: { collab: 'c4', du: '2026-10-05', au: '2026-10-09', type: 'conge', portion: 'journee' } };
  assert.deepEqual(week(), ['c3', 'c1', 'c2', 'c3', 'c1']);
  assert.equal(dutyIds(compute('2026-10-12', '2026-10-12')['2026-10-12'])[0], 'c4');
});
test('échange : seuls les deux jours concernés changent', () => {
  state.affectations = { '2026-10-05': { cells: { '2026-10-05': { ids: ['c1'], mode: 'echange' } } } };
  assert.deepEqual(week(), ['c1', 'c4', 'c3', 'c2', 'c3']);
});
test('décalage : la suite glisse d\'un rang', () => {
  state.affectations = { '2026-10-05': { cells: { '2026-10-05': { ids: ['c1'], mode: 'decale' } } } };
  assert.deepEqual(week(), ['c1', 'c3', 'c4', 'c2', 'c1']);
});
test('nouvel ordre de passage appliqué à une date', () => {
  state.ordres = { '2026-10-07': { depuis: '2026-10-07', ordre: ['c2', 'c1', 'c3', 'c4'] } };
  assert.deepEqual(week(), ['c3', 'c4', 'c2', 'c1', 'c3']);
});
test('jour férié : pas de back office, rotation reprise le lendemain', () => {
  assert.deepEqual(week('2026-11-09', '2026-11-13')[2], '--');
});
test('absence récurrente hebdomadaire (tous les mercredis)', () => {
  state.absences = { tp: { collab: 'c1', du: '2026-10-05', au: '', type: 'tempspartiel', portion: 'journee', rec: { freq: 'hebdo', jours: [2], tous: 1 } } };
  const p = compute('2026-10-05', '2026-10-30');
  for (const d of ['2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28']) {
    assert.ok(p[d].absents.some(x => x.id === 'c1'), d);
    assert.ok(!dutyIds(p[d]).includes('c1'), d);
  }
  assert.ok(!p['2026-10-08'].absents.length);
  assert.equal(recLabel(state.absences.tp), 'Tous les mercredis');
});
test('absence récurrente une semaine sur deux avec date de fin', () => {
  state.absences = { b: { collab: 'c3', du: '2026-10-05', au: '2026-10-25', type: 'autre', portion: 'apresmidi', rec: { freq: 'hebdo', jours: [0], tous: 2 } } };
  const p = compute('2026-10-05', '2026-11-02');
  assert.ok(p['2026-10-05'].absents.length && !p['2026-10-12'].absents.length && p['2026-10-19'].absents.length);
  assert.ok(!p['2026-11-02'].absents.length, 'arrêtée après la date de fin');
});
test('absence mensuelle : 1er lundi et dernier vendredi', () => {
  state.absences = {
    m: { collab: 'c4', du: '2026-10-01', au: '', type: 'formation', portion: 'journee', rec: { freq: 'mensuel', rang: 1, jour: 0 } },
    l: { collab: 'c2', du: '2026-10-01', au: '', type: 'formation', portion: 'matin', rec: { freq: 'mensuel', rang: 5, jour: 4 } },
  };
  const p = compute('2026-10-01', '2026-11-30');
  const days = id => Object.keys(p).filter(d => p[d].absents.some(x => x.id === id));
  assert.deepEqual(days('c4'), ['2026-10-05', '2026-11-02']);
  assert.deepEqual(days('c2'), ['2026-10-30', '2026-11-27']);
});
test('saisie groupée : lignes valides, erreurs et doublons', () => {
  state.absences = { x: { collab: 'c1', du: '2026-10-26', au: '2026-10-30', type: 'conge', portion: 'journee' } };
  const r = parseBulk('Collaborateur 1 ; 26/10/2026 ; 30/10/2026\nCollaborateur 2 ; 12/11/2026 ; ; RTT ; matin\nInconnu ; 01/12/2026');
  assert.ok(r[0].dup);
  assert.equal(r[1].type, 'rtt'); assert.equal(r[1].portion, 'matin');
  assert.ok(r[2].err);
});
test('mon planning : choix du nom puis prochains tours', () => {
  assert.match(vMoi(), /Qui êtes-vous/);
  localStorage.setItem('rotation-bo-v1-moi', 'c2');
  assert.equal(myCollab(), 'c2');
  const html = vMoi();
  assert.match(html, /Bonjour Collaborateur 2/);
  assert.match(html, /Mes prochains tours/);
});
test('checklist : cocher une tâche met à jour la progression', () => {
  const d = '2026-10-05';
  const total = progress(d).total;
  assert.equal(progress(d).n, 0);
  tick(d, 't_mails', true);
  assert.equal(progress(d).n, 1);
  assert.match(state.journal[d].done.t_mails.at, /^\d\d:\d\d$/);
  tick(d, 't_mails', false);
  assert.equal(progress(d).n, 0);
  assert.equal(total, 4);
  assert.match(checklist(d), /Programme du jour/);
});
test('checklist : seul le manager ou la personne du jour peut cocher', () => {
  const futur = '2099-01-05';
  assert.equal(canTick(futur, compute(futur, futur)[futur]), false, 'jamais dans le futur');
});
test('jour à éviter : la personne passe le lendemain', () => {
  state.equipe.c3 = { ...state.equipe.c3, eviter: [0] }; // c3 évite le lundi
  assert.deepEqual(week(), ['c4', 'c3', 'c1', 'c2', 'c4']);
});
test('pas deux tours de suite après une absence', () => {
  // c2 absent le jeudi 01/10 : sans la règle il enchaînerait vendredi et lundi
  state.absences = { a: { collab: 'c2', du: '2026-10-01', au: '2026-10-01', type: 'rtt', portion: 'journee' } };
  const p = compute('2026-09-30', '2026-10-06');
  const seq = Object.values(p).map(d => dutyIds(d)[0]);
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], 'jamais deux jours de suite');
});
test('doublure : le nouveau accompagne son tuteur puis entre dans la rotation', () => {
  state.equipe.c5 = { ...state.equipe.c5, actif: true, doublure: { tuteur: 'c1', jusqu: '2026-10-09' } };
  const p = compute('2026-10-05', '2026-10-16');
  assert.ok(!Object.keys(p).filter(d => d <= '2026-10-09').some(d => dutyIds(p[d]).includes('c5')), 'pas seul pendant la doublure');
  assert.deepEqual(p['2026-10-07'].doublure, ['c5'], 'accompagne c1');
  assert.ok(Object.keys(p).filter(d => d > '2026-10-09').some(d => dutyIds(p[d]).includes('c5')), 'en rotation ensuite');
});
test('jours à risque : sous le seuil ou sans back office', () => {
  state.absences = {
    a: { collab: 'c1', du: '2026-10-12', au: '2026-10-12', type: 'conge', portion: 'journee' },
    b: { collab: 'c2', du: '2026-10-12', au: '2026-10-12', type: 'conge', portion: 'journee' },
    c: { collab: 'c3', du: '2026-10-12', au: '2026-10-12', type: 'maladie', portion: 'journee' },
  };
  let r = riskDays('2026-10-12', '2026-10-13');
  assert.equal(r.length, 1); assert.equal(r[0].eff, 1); assert.equal(r[0].level, 'warn');
  state.absences.d = { collab: 'c4', du: '2026-10-12', au: '2026-10-12', type: 'rtt', portion: 'journee' };
  r = riskDays('2026-10-12', '2026-10-12');
  assert.equal(r[0].level, 'crit');
});
test('indicateurs : volumes saisis et rendu des onglets', () => {
  ui.actPeriod = 'all';
  assert.match(vActivite(), /Pas encore de volumes/);
  state.journal = { '2026-09-28': { done: {}, vol: { t_mails: 20, t_appels: 12 } }, '2026-09-29': { done: {}, vol: { t_mails: 30 } } };
  const html = vActivite();
  assert.match(html, /<svg/); assert.match(html, /25 par jour/);
  for (const v of [vAbsences, vPlanning, vEquipe, vReglages]) assert.ok(v().length > 500);
});
test('compteurs du jour : mails début/fin et appels partagés avec la checklist', () => {
  const E2 = globalThis.__t;
  E2.cptSet('2026-09-28', 'md', 42); E2.cptSet('2026-09-28', 'mf', 7); E2.cptSet('2026-09-28', 'ap', 15);
  const j = state.journal['2026-09-28'];
  assert.equal(j.cpt.md, 42); assert.equal(j.cpt.mf, 7);
  assert.equal(j.vol.t_appels, 15, 'App. = volume de la tâche appels');
  assert.equal(E2.cptGet('2026-09-28', 'ap'), 15);
  ui.actPeriod = 'all';
  assert.match(vActivite(), /M-déb/);
  assert.match(vPlanning(), /data-cpt="md"/);
});
test('synchro : fusion document par document, suppressions propagées', async () => {
  const E2 = globalThis.__t;
  // appareil A : état de départ exporté
  await E2.put('absences', 'x1', { collab: 'c1', du: '2026-11-02', au: '2026-11-02', type: 'conge', portion: 'journee' });
  await E2.put('absences', 'x2', { collab: 'c2', du: '2026-11-03', au: '2026-11-03', type: 'rtt', portion: 'journee' });
  const fichierA = JSON.parse(JSON.stringify(E2.exportPayload()));
  // appareil B (même départ) : modifie x1 plus tard, supprime x2, ajoute x3
  await new Promise(r => setTimeout(r, 5));
  await E2.put('absences', 'x1', { ...state.absences.x1, note: 'modifié sur B' });
  await E2.del('absences', 'x2');
  await E2.put('absences', 'x3', { collab: 'c3', du: '2026-11-04', au: '2026-11-04', type: 'conge', portion: 'journee' });
  const fichierB = JSON.parse(JSON.stringify(E2.exportPayload()));
  // retour sur A : on recharge l'état A puis on fusionne le fichier B
  for (const col of Object.keys(fichierA.data)) state[col] = JSON.parse(JSON.stringify(fichierA.data[col]));
  E2.meta.tomb = {};
  const n = E2.mergePayload(fichierB);
  assert.equal(state.absences.x1.note, 'modifié sur B', 'version la plus récente gardée');
  assert.ok(!state.absences.x2, 'suppression propagée');
  assert.ok(state.absences.x3, 'ajout récupéré');
  assert.equal(n, 3);
  // refusionner le même fichier ne change rien
  assert.equal(E2.mergePayload(fichierB), 0);
  assert.throws(() => E2.mergePayload({ foo: 1 }), /application/);
});
test('compteurs : saisie possible sur tous les jours ouvrés, y compris à venir', () => {
  ui.week = '2099-01-05'; ui.view = 'poste';
  const html = vPlanning();
  const champs = html.match(/<input[^>]*data-cpt="[^"]+"[^>]*>/g) || [];
  assert.equal(champs.length, 15);
  assert.ok(champs.every(c => !/\sdisabled/.test(c)), 'aucune case bloquée');
});
test('planning : case fait / pas fait par tâche, liée à la checklist', () => {
  ui.week = '2026-09-28'; ui.view = 'poste';
  let html = vPlanning();
  const cases = html.match(/data-act="tk"[^>]*data-d="2026-09-28"/g) || [];
  assert.equal(cases.length, 4, 'une case par tâche');
  assert.match(html, /class="tk missed"/, 'jour passé non coché = non fait');
  tick('2026-09-28', 't_mails', true);
  html = vPlanning();
  assert.match(html, /class="tk done"[^>]*data-d="2026-09-28" data-t="t_mails"/);
  assert.equal(progress('2026-09-28').n, 1, 'même donnée que la checklist');
});
for (const [name, fn] of pending) { reset(); await fn(); n++; console.log('ok -', name); }
console.log(`\n${n} tests réussis`);
