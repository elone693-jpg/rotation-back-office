# Rotation back office

Outil de planification du back office de l'agence. Chaque jour ouvré, une personne est « de back office » et assure tout le programme : mails de l'agence, alertes de départs et boîte mail du personnel le matin, émission d'appels l'après-midi.

- Page publiée : https://claude.ai/artifact/MoF2yh1FXp6KNS9UYRQ1en
- Source : `index.html` (page autonome : HTML, CSS et JavaScript, sans dépendance)

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

## Données (base partagée de la page)

| Collection | Contenu |
|---|---|
| `equipe/<id>` | `nom`, `couleur`, `actif`, `debut`, `fin`, `ordre`, `eviter` (jours 0-4), `doublure` `{tuteur, jusqu}`, `compte` |
| `taches/<id>` | `nom`, `desc`, `creneau` (`matin` ou `apresmidi`), `ordre` |
| `absences/<id>` | `collab`, `du`, `au` (vide = sans fin), `type`, `portion` (`journee`, `matin` ou `apresmidi`), `note`, `rec` (récurrence, optionnel) |
| `affectations/<lundi>` | `cells[date] = {ids, mode: 'echange' ou 'decale'}` |
| `ordres/<date>` | `{depuis, ordre: [ids]}` |
| `reglages/general` | `debut`, `feries`, `parJour`, `seuil` (effectif minimum), `pasDeSuite` |
| `journal/<date>` | checklist du jour : `done[tacheId] = {at: 'HH:MM', by: userId}`, `vol[tacheId]` (volume traité), `cpt` `{md, mf}` (mails en début / fin de journée), `note`. Le compteur App. (appels émis) du Planning écrit dans `vol` de la tâche d'appels |
| `liens/<userId>` | nom déclaré par le collègue lui-même : `{collab}` (le lien posé par le manager est `equipe.compte`) |

Récurrence `rec` :
- `{freq:'hebdo', jours:[0-4], tous:1|2}` : 0 = lundi, `tous:2` = une semaine sur deux à partir de `du` ;
- `{freq:'mensuel', rang:1-5, jour:0-4}` : `rang:5` = dernier du mois.

## Droits

Règles d'accès de la base :

| Chemin | Lecture | Écriture |
|---|---|---|
| tout (racine) | view | admin |
| `journal` | view | interact |
| `liens` | view | admin |
| `liens/{self}` | | interact |

- **Manager** : à partager en *Éditeur*. Il peut tout modifier.
- **Collaborateurs** : à partager en *Contributeur*. Ils consultent le planning, cochent leur checklist le jour où ils sont de back office et déclarent leur propre nom.
- *Lecteur* : consultation seule (l'identité est alors retenue dans le navigateur).

## Tests

```bash
node tests/rotation.test.mjs
```

## Publier une mise à jour

Republier `index.html` sur l'URL de l'artifact ci-dessus, avec l'outil Artifact de Claude en passant cette `url`, sans redéclarer les capabilities. Les données de la base sont conservées.

## Rappel par mail (17 h, jours ouvrés)

Une tâche planifiée de l'app Claude (`rappel-back-office`) fait chaque jour ouvré :
1. elle exporte la base de l'outil ;
2. elle lance le script :
   ```bash
   node scripts/rappel.mjs <dossier-export>
   ```
3. elle envoie le résultat par Gmail à l'adresse du propriétaire.

Pour tester sans envoyer, à une date choisie :
```bash
node scripts/rappel.mjs <dossier-export> 2026-10-09
```
