# Rotation back office

Application autonome (PWA) de planification du back office de l'agence, pour iPhone et Mac. Chaque jour ouvré, une personne est « de back office » et assure tout le programme : mails de l'agence, alertes de départs et boîte mail du personnel le matin, émission d'appels l'après-midi.

- Fichiers du site : `index.html`, `sw.js` (hors connexion), `manifest.webmanifest`, `icons/`
- Données : sur chaque appareil (stockage du navigateur). Synchronisation par le fichier `rotation-back-office.json`, dans iCloud Drive › Rotation back office.
- Aucun serveur, aucun compte : le site ne contient aucune donnée de l'agence.

## Mise en ligne sur GitHub Pages

1. Sur github.com, créer un dépôt **public** `rotation-back-office`.
2. Y déposer le contenu de ce dossier (*Add file › Upload files*, glisser tous les fichiers et le dossier `icons`), ou pousser avec git.
3. *Settings › Pages* : Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
4. L'adresse est `https://<identifiant>.github.io/rotation-back-office/`.

Pour chaque nouvelle version : modifier `VERSION` dans `sw.js`, puis redéposer les fichiers. Les appareils prennent la mise à jour à l'ouverture suivante.

## Installation

- **iPhone** : ouvrir l'adresse dans Safari › Partager › *Sur l'écran d'accueil*.
- **Mac** : Safari › Fichier › *Ajouter au Dock* (ou Chrome › Installer l'application).

Au premier lancement : *Récupérer depuis iCloud* et choisir `rotation-back-office.json`.

## Synchronisation (bouton « Synchroniser »)

1. **Récupérer** : choisir le fichier dans iCloud Drive › Rotation back office. La fusion garde, élément par élément, la version la plus récente, et les suppressions se propagent.
2. **Enregistrer** : iPhone › *Enregistrer dans Fichiers* › même dossier › *Remplacer*. Mac : enregistrer dans ce dossier.

Toujours récupérer avant d'enregistrer. Chaque document porte `_t` (horodatage de dernière modification), et les suppressions sont gardées dans `tomb`.

## Fonctionnement de la rotation

- **File d'attente** : chaque jour, la première personne de la file présente toute la journée prend le back office, puis repasse en fin de file. Une personne absente garde sa place et passe à son retour.
- **Relais** : si personne n'est présent toute la journée, un matin et un après-midi sont confiés à deux personnes différentes.
- **Jours fériés français** : non travaillés (Pâques, Ascension et Pentecôte calculés automatiquement).
- **Ajustements d'un jour** :
  - *échange* : la personne prévue reprend le prochain tour du remplaçant ;
  - *décalage* : la personne choisie passe ce jour-là, et les suivants glissent d'un jour.
- **Ordre de passage** : il peut être redéfini à partir d'une date. Les jours passés ne changent pas.
- **Règles souples** : jours à éviter par personne, pas deux tours de suite. La personne écartée garde sa place et passe le jour suivant, sauf si personne d'autre n'est disponible.
- **Doublure** : un nouveau collaborateur accompagne son tuteur jusqu'à une date, puis entre dans la rotation.
- **Jours à risque** : effectif présent (1 par journée, 0,5 par demi-journée) sous le seuil, ou back office non couvert, sur 3 mois.

## Données

| Collection | Contenu |
|---|---|
| `equipe/<id>` | `nom`, `couleur`, `actif`, `debut`, `fin`, `ordre`, `eviter` (jours 0-4), `doublure` `{tuteur, jusqu}` |
| `taches/<id>` | `nom`, `desc`, `creneau` (`matin` ou `apresmidi`), `ordre` |
| `absences/<id>` | `collab`, `du`, `au` (vide = sans fin), `type`, `portion` (`journee`, `matin` ou `apresmidi`), `note`, `rec` (récurrence, optionnel) |
| `affectations/<lundi>` | `cells[date] = {ids, mode: 'echange' ou 'decale'}` |
| `ordres/<date>` | `{depuis, ordre: [ids]}` |
| `reglages/general` | `debut`, `feries`, `parJour`, `seuil` (effectif minimum), `pasDeSuite` |
| `journal/<date>` | checklist du jour : `done[tacheId] = {at: 'HH:MM', by: userId}`, `vol[tacheId]` (volume traité), `cpt` `{md, mf}` (mails en début / fin de journée), `note`. Le compteur App. (appels émis) du Planning écrit dans `vol` de la tâche d'appels |

Récurrence `rec` :
- `{freq:'hebdo', jours:[0-4], tous:1|2}` : 0 = lundi, `tous:2` = une semaine sur deux à partir de `du` ;
- `{freq:'mensuel', rang:1-5, jour:0-4}` : `rang:5` = dernier du mois.

## Tests

```bash
node tests/rotation.test.mjs
```

## Rappel par mail (17 h, jours ouvrés)

Une tâche planifiée de l'app Claude (`rappel-back-office`) lance chaque jour ouvré :
```bash
node scripts/rappel.mjs
```
Le script lit le fichier le plus récent d'iCloud Drive › Rotation back office, puis la tâche envoie le résultat par Gmail au propriétaire. Le rappel est donc aussi à jour que le dernier enregistrement fait depuis l'application.

Pour tester sans envoyer, à une date choisie :
```bash
node scripts/rappel.mjs "<fichier ou dossier>" 2026-10-09
```

## Icônes

```bash
python3 scripts/icones.py
```
