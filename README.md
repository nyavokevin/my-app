# Gymlytic

Gymlytic est une application desktop de gestion de salle de sport construite avec Electron, Vue 3, TypeScript et SQLite.

L'application fonctionne en local, sans serveur distant, et permet de gerer les membres, les abonnements, les paiements, les presences, le stock et les parametres de l'application depuis une seule interface.

## Fonctionnalites

- Tableau de bord avec statistiques membres, revenus et presences.
- Gestion des membres: creation, modification, suppression, activation et notes.
- Recherche de membres par nom, email, telephone, formule ou date d'inscription.
- Gestion des types d'adhesion avec prix, duree et unite.
- Gestion des abonnements avec date de debut, date de fin et reabonnement.
- Paiements d'adhesion et de stock avec modes `espece` et `mobile money`.
- Poste de presence admin pour enregistrer les entrees et sorties.
- Fenetre client dediee pour les presences avec saisie par telephone ou ID membre.
- Alerte apres pointage selon l'etat de l'abonnement: actif, bientot fini, expire.
- Historique des presences par jour et par membre.
- Gestion du stock: ajout, modification, suppression, vente et restock.
- Historique des mouvements de stock.
- Parametres application avec devise configurable.
- Seeder demo et remise a zero des donnees locales.

## Stack technique

- Electron Forge
- Vite
- Vue 3
- TypeScript
- SQLite via `better-sqlite3`

## Architecture

- `src/main.ts`: point d'entree Electron, creation des fenetres et enregistrement des handlers IPC.
- `src/preload.ts`: exposition securisee de l'API au renderer.
- `src/main/gym-member-service.ts`: logique metier et acces SQLite.
- `src/shared/gym-members.ts`: types partages entre main, preload et renderer.
- `src/App.vue`: interface principale de l'application.
- `src/css/main.css`: styles globaux.

## Installation

Prerequis:

- Node.js
- npm

Installer les dependances:

```bash
npm install
```

Lancer l'application en developpement:

```bash
npm start
```

## Scripts utiles

```bash
npm start
npm run package
npm run make
npm run publish
npm run lint
```

## Donnees

- Les donnees sont stockees localement en SQLite.
- L'application ne depend pas d'un backend distant.
- Un seeder demo permet d'injecter rapidement des donnees d'exemple.
- Une action de reset permet de repartir d'une base propre.

## Ecrans disponibles

- Tableau de bord
- Recherche
- Adhesions
- Presences
- Stock
- Paiements
- Parametres
- Presence client

## Cas d'usage couverts

- Ajouter un nouveau membre et lui creer un abonnement.
- Renouveler un abonnement avec paiement associe.
- Pointer une entree ou une sortie par telephone ou ID membre.
- Afficher l'etat d'un abonnement au moment de la presence.
- Vendre un produit du stock et tracer le paiement.
- Changer la devise de l'application.
- Charger des donnees de demonstration.

## Limites actuelles

- Application orientee usage local monoposte ou multi-fenetres locales.
- Pas de synchronisation cloud ni de comptes utilisateurs.
- Pas encore de systeme de roles ou permissions.

## Auteur

- `kitoza`