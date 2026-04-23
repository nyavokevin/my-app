# Presentation du projet Gymlytic

## Resume

Gymlytic est une application desktop de gestion pour salle de sport.

Elle permet de centraliser les operations quotidiennes d'une salle dans une application locale simple:

- gestion des membres
- gestion des abonnements
- suivi des paiements
- suivi des presences
- gestion du stock

## Probleme resolu

Dans beaucoup de petites salles, les informations sont dispersees entre cahiers, fichiers Excel et messages.

Gymlytic propose une interface unique pour:

- enregistrer les membres
- suivre les abonnements actifs ou expires
- faire pointer les clients
- suivre les ventes et paiements
- conserver un historique local fiable

## Valeur du projet

- Fonctionne en local, sans serveur.
- Rapide a deployer dans une salle.
- Interface moderne et orientee usage quotidien.
- Permet une borne de presence client separee de l'ecran admin.
- Reduit les oublis sur les expirations d'abonnement et les encaissements.

## Fonctionnalites principales

### 1. Gestion des membres

- creation et modification des profils
- telephone, email, notes, statut actif/inactif
- consultation detaillee d'un membre

### 2. Gestion des abonnements

- types d'adhesion parametrables
- duree en jours, mois ou annees
- calcul de fin d'abonnement
- reabonnement depuis l'interface

### 3. Gestion des presences

- entree et sortie
- pointage par telephone ou ID membre
- historique des presences
- borne client dediee
- alerte sur l'etat de l'abonnement pendant le pointage

### 4. Gestion des paiements

- paiements d'adhesion
- paiements de stock
- paiement en espece ou mobile money

### 5. Gestion du stock

- ajout et modification de produits
- ventes et restocks
- historique des mouvements

### 6. Outils d'administration

- devise configurable
- seeder demo
- reset des donnees locales

## Technologies utilisees

- Electron
- Vue 3
- TypeScript
- Vite
- SQLite avec `better-sqlite3`

## Utilisateurs cibles

- petites salles de sport
- coachs independants
- salles locales sans infrastructure serveur
- structures souhaitant une application offline-first

## Points forts

- application desktop locale
- interface moderne
- gestion metier deja large
- deux modes d'usage: admin et presence client
- stockage local simple et robuste

## Evolutions possibles

- comptes utilisateurs et permissions
- export PDF ou Excel
- sauvegarde/restauration de base
- statistiques avancees
- synchronisation multi-postes
- impression de recus

## Conclusion

Gymlytic est deja une base solide de logiciel de gestion de salle de sport.

Le projet couvre les besoins essentiels d'exploitation quotidienne et peut evoluer vers une solution plus complete selon les besoins metier.