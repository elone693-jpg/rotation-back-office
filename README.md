# Rotation back office

Application autonome (PWA) de planification du back office de l'agence, pour iPhone et Mac. Chaque jour ouvré, une personne est « de back office » et assure tout le programme : mails de l'agence, alertes de départs et boîte mail du personnel le matin, émission d'appels l'après-midi.

- **Adresse : https://elone693-jpg.github.io/rotation-back-office/**
- Fichiers du site : `index.html`, `sw.js` (hors connexion), `manifest.webmanifest`, `icons/`
- Données : sur chaque appareil (stockage du navigateur), synchronisées automatiquement dans le dépôt GitHub **privé** `elone693-jpg/rotation-back-office-donnees` (fichier `donnees.json`). Une copie manuelle dans iCloud Drive reste possible.
- Le site public ne contient aucune donnée de l'agence.

## Mise en ligne sur GitHub Pages

Dépôt : https://github.com/elone693-jpg/rotation-back-office (GitHub Pages servi depuis la branche `main`, à la racine).

Pour publier une nouvelle version :
1. Modifier `VERSION` dans `sw.js`.
2. Lancer les tests :
   ```bash
   node tests/rotation.test.mjs
   ```
3. Envoyer sur GitHub :
   ```bash
   git push
   ```

Les appareils prennent la mise à jour à l'ouverture suivante.

## Installation

- **iPhone** : ouvrir l'adresse dans Safari › Partager › *Sur l'écran d'accueil*.
- **Mac** : Safari › Fichier › *Ajouter au Dock* (ou Chrome › Installer l'application).

Au premier lancement : *Activer la synchro*, puis coller la clé d'accès GitHub (la même sur chaque appareil).

## Synchronisation automatique

- **Clé d'accès** : jeton GitHub « fine-grained », limité au dépôt `rotation-back-office-donnees`, avec l'autorisation *Contents : Read and write*. Il est gardé uniquement sur l'appareil et n'est envoyé qu'à `api.github.com`.
- **Quand** : à l'ouverture, au retour sur l'app, toutes les minutes tant qu'elle est affichée, et 2 s après chaque modification. Sans réseau, l'envoi se fait au retour de la connexion.
- **Fusion** : élément par élément, la version la plus récente gagne (champ `_t`), et les suppressions se propagent (`tomb`). Si l'autre appareil a écrit entre-temps (409/422), l'app relit, refusionne et renvoie.
- La comparaison ignore l'ordre des clés, pour éviter que deux appareils se renvoient le fichier sans fin.
- **Copie iCloud (manuel)** : *Synchro › Copie de sauvegarde dans iCloud Drive*.

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
Le script lit le dépôt privé avec `gh`, déjà connecté sur le Mac. Si le dépôt est injoignable, il se rabat sur la copie iCloud. La tâche envoie ensuite le résultat par Gmail au propriétaire.

Pour tester sans envoyer, à une date choisie :
```bash
node scripts/rappel.mjs "<fichier ou dossier>" 2026-10-09
```

## Icônes

```bash
python3 scripts/icones.py
```
