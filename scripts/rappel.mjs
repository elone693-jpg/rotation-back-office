// Prépare le mail de rappel de la veille à partir des données de l'application.
// Usage : node scripts/rappel.mjs [source] [date-du-jour AAAA-MM-JJ]
// source par défaut : le dépôt privé GitHub de la synchro automatique (lu avec `gh`, déjà connecté sur le Mac).
// Autres sources possibles : un fichier rotation-back-office.json, ou un dossier qui en contient (le plus récent).
// Si le dépôt est injoignable, repli sur iCloud Drive › Rotation back office. Lien vers l'app : RBO_URL (optionnel).
// Sortie : JSON {envoyer, sujet, texte} sur la sortie standard.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { loadEngine } from './engine.mjs';

const DEPOT = 'github:elone693-jpg/rotation-back-office-donnees/donnees.json';
const ICLOUD = join(homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/Rotation back office');
const [src = DEPOT, today] = process.argv.slice(2);

function lireGithub(spec) {
  const [owner, repo, ...chemin] = spec.slice(7).split('/');
  const gh = [process.env.GH_BIN, join(homedir(), '.local/bin/gh'), 'gh'].find(b => b && (b === 'gh' || existsSync(b)));
  const b64 = execFileSync(gh, ['api', `repos/${owner}/${repo}/contents/${chemin.join('/')}`, '--jq', '.content'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(Buffer.from(b64.replace(/\s/g, ''), 'base64').toString('utf8'));
}
function trouverFichier(p) {
  if (!existsSync(p)) return null;
  if (statSync(p).isFile()) return p;
  const cands = readdirSync(p).filter(f => /^rotation-back-office.*\.json$/.test(f)).map(f => join(p, f));
  const lus = cands.map(f => { try { return { f, t: Date.parse(JSON.parse(readFileSync(f, 'utf8')).exportedAt) || 0 }; } catch { return null; } }).filter(Boolean);
  lus.sort((a, b) => b.t - a.t);
  return lus[0]?.f || null;
}
let payload = null, origine = '';
if (src.startsWith('github:')) {
  try { payload = lireGithub(src); origine = 'dépôt GitHub'; } catch (e) { origine = 'iCloud (dépôt GitHub injoignable)'; }
}
if (!payload) {
  const fichier = trouverFichier(src.startsWith('github:') ? ICLOUD : src);
  if (!fichier) { console.log(JSON.stringify({ envoyer: false, raison: `aucune donnée trouvée (${src})` })); process.exit(0); }
  payload = JSON.parse(readFileSync(fichier, 'utf8')); origine = origine || 'fichier';
}

const E = loadEngine({ today });
const COLS = ['equipe', 'taches', 'absences', 'affectations', 'reglages', 'ordres', 'journal'];
for (const col of COLS) E.state[col] = payload.data?.[col] || {};
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
const ageJ = Math.round((Date.now() - Date.parse(payload.exportedAt)) / 864e5);
if (ageJ >= 3) lignes.push('', `Dernière synchronisation il y a ${ageJ} jours : ouvrez l'application pour mettre les données à jour.`);
if (origine.startsWith('iCloud')) lignes.push('', 'Note : données lues dans la copie iCloud, le dépôt de synchro était injoignable.');
if (process.env.RBO_URL) lignes.push('', `Application : ${process.env.RBO_URL}`);

console.log(JSON.stringify({ envoyer: true, sujet: `Back office ${jour(cible)} : ${titre}`, texte: lignes.join('\n') }, null, 2));
