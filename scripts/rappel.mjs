// Prépare le mail de rappel de la veille à partir d'un export de la base de l'outil.
// Usage : node scripts/rappel.mjs <dossier-export> [date-du-jour AAAA-MM-JJ]
// Le dossier contient <collection>/<id>.json (export ArtifactData avec out_dir).
// Sortie : JSON {envoyer, sujet, texte} sur la sortie standard.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEngine } from './engine.mjs';

const [dir, today] = process.argv.slice(2);
if (!dir) { console.error('Usage : node scripts/rappel.mjs <dossier-export> [AAAA-MM-JJ]'); process.exit(1); }

const E = loadEngine({ today });
const COLS = ['equipe', 'taches', 'absences', 'affectations', 'reglages', 'ordres', 'journal'];
for (const col of COLS) {
  const p = join(dir, col);
  E.state[col] = {};
  if (!existsSync(p)) continue;
  for (const f of readdirSync(p).filter(f => f.endsWith('.json')))
    E.state[col][f.slice(0, -5)] = JSON.parse(readFileSync(join(p, f), 'utf8'));
}
if (!Object.keys(E.state.equipe).length) { console.log(JSON.stringify({ envoyer: false, raison: 'export vide' })); process.exit(0); }

const T = E.TODAY, C = E.byId(), nom = id => C[id]?.nom || '?';
const jour = d => `${E.DNL[E.weekday(d)].toLowerCase()} ${E.short(d)}`;
if (E.weekday(T) > 4) { console.log(JSON.stringify({ envoyer: false, raison: 'week-end' })); process.exit(0); }

const cible = E.nextWorkday(E.addDays(T, 1));
const P = E.compute(cible, cible)[cible];
const qui = E.dutyIds(P);
const lignes = [];
const titre = qui.length ? qui.map(nom).join(' et ') : 'personne';
const quand = cible === E.addDays(T, 1) ? `Demain (${jour(cible)})` : `${E.DNL[E.weekday(cible)]} ${E.short(cible)}`;
lignes.push(`${quand}, ${qui.length ? `${titre} ${qui.length > 1 ? 'sont' : 'est'} de back office` : 'personne n\'est disponible pour le back office'}.`);
if (P.relais) lignes.push(`Relais : matin ${P.matin.map(nom).join(', ') || 'personne'}, après-midi ${P.apresmidi.map(nom).join(', ') || 'personne'}.`);
if (P.short.matin || P.short.apresmidi) lignes.push('⚠ Back office non couvert sur une partie de la journée : à organiser.');
if (P.doublure.length) lignes.push(`En doublure : ${P.doublure.map(nom).join(', ')}.`);
if (P.manual) lignes.push(P.manual === 'echange' ? 'Ce jour résulte d\'un échange de tours.' : 'Ce jour a été avancé à la main.');
if (P.absents.length) lignes.push(`Absents : ${P.absents.map(x => nom(x.id) + (x.p !== 'journee' ? ` (${x.p === 'matin' ? 'matin' : 'après-midi'})` : '')).join(', ')}.`);

const ts = E.taches();
lignes.push('', 'Programme :');
for (const [slot, lib] of [['matin', 'Matin'], ['apresmidi', 'Après-midi']]) {
  const l = ts.filter(t => t.creneau === slot).map(t => t.nom);
  if (l.length) lignes.push(`- ${lib} : ${l.join(', ')}`);
}

const g = E.progress(T);
if (g.total) lignes.push('', `Aujourd'hui : ${g.n}/${g.total} tâches cochées${g.n < g.total ? ' (programme incomplet)' : ''}.`);

const risques = E.riskDays(E.addDays(T, 1), E.addDays(T, 14));
if (risques.length) {
  lignes.push('', 'Jours à risque dans les 2 semaines :');
  for (const r of risques) lignes.push(`- ${jour(r.d)} : ${r.level === 'crit' ? 'back office non couvert' : `${String(r.eff).replace('.', ',')} présent${r.eff > 1 ? 's' : ''}`}`);
}
lignes.push('', 'Planning : https://claude.ai/artifact/MoF2yh1FXp6KNS9UYRQ1en');

console.log(JSON.stringify({ envoyer: true, sujet: `Back office ${jour(cible)} : ${titre}`, texte: lignes.join('\n') }, null, 2));
