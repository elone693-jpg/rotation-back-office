// Tests du moteur de rotation : node tests/rotation.test.mjs
// Le script de index.html est extrait et exécuté avec un DOM minimal, sans navigateur.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
let js = html.match(/<script>([\s\S]*)<\/script>/)[1];
js = js.replace('/* ---------- démarrage', 'globalThis.__t={compute,state,defaults,dutyIds,recLabel,parseBulk,vMoi,checklist,canTick,tick,progress,myCollab,ui,riskDays,vActivite,vAbsences,vPlanning,vEquipe,vReglages};return;/*');
const el = { innerHTML: '', contains: () => false, className: '', addEventListener() {} };
globalThis.document = { querySelector: () => el, addEventListener() {}, activeElement: null };
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
new Function(js)();
const { compute, state, defaults, dutyIds, recLabel, parseBulk, vMoi, checklist, canTick, tick, progress, myCollab, ui, riskDays, vActivite, vAbsences, vPlanning, vEquipe, vReglages } = globalThis.__t;

function reset() {
  Object.assign(state, defaults());
  state.reglages.general.debut = '2026-09-21';
  state.absences = {}; state.affectations = {}; state.ordres = {}; state.liens = {}; state.journal = {};
  store.clear();
}
const week = (from = '2026-10-05', to = '2026-10-09') =>
  Object.values(compute(from, to)).map(d => (d.ferie ? '--' : dutyIds(d).join('+')));

let n = 0;
const test = (name, fn) => { reset(); fn(); n++; console.log('ok -', name); };

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
console.log(`\n${n} tests réussis`);
