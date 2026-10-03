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

## Données (base partagée de la page)

| Collection | Contenu |
|---|---|
| `equipe/<id>` | `nom`, `couleur`, `actif`, `debut`, `fin`, `ordre` |
| `taches/<id>` | `nom`, `desc`, `creneau` (`matin` ou `apresmidi`), `ordre` |
| `absences/<id>` | `collab`, `du`, `au` (vide = sans fin), `type`, `portion` (`journee`, `matin` ou `apresmidi`), `note`, `rec` (récurrence, optionnel) |
| `affectations/<lundi>` | `cells[date] = {ids, mode: 'echange' ou 'decale'}` |
| `ordres/<date>` | `{depuis, ordre: [ids]}` |
| `reglages/general` | `debut`, `feries`, `parJour` |

Récurrence `rec` :
- `{freq:'hebdo', jours:[0-4], tous:1|2}` : 0 = lundi, `tous:2` = une semaine sur deux à partir de `du` ;
- `{freq:'mensuel', rang:1-5, jour:0-4}` : `rang:5` = dernier du mois.

## Droits

La règle d'accès de la base est `read: view`, `write: admin` :

- **Manager** : à partager en *Éditeur*. Il peut tout modifier.
- **Collaborateurs** : à partager en *Lecteur* ou *Contributeur*. Ils consultent seulement.

## Tests

```bash
node tests/rotation.test.mjs
```

## Publier une mise à jour

Republier `index.html` sur l'URL de l'artifact ci-dessus, avec l'outil Artifact de Claude en passant cette `url`, sans redéclarer les capabilities. Les données de la base sont conservées.
