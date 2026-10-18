# Gestion réservations (3 sous-pages)

**Note de méthode** : section revue en profondeur suite à une remarque de Jim ("exploration un peu sommaire"). Détail ci-dessous basé sur une exploration complète du formulaire de création (3 étapes) et de la fiche détaillée d'une réservation existante (4 onglets), sur une réservation de test ("Course de test (sans numéro de facture, hors chiffre d'affaires, supprimable)") — aucune donnée réelle de client n'est reproduite ci-dessous (exemples anonymisés).

## Disponibilités
**URL** : `/disponibilites`
- Tableau : **CHAUFFEUR** (nom, email, téléphone), **STATUT SUR L'APP** (En ligne / Hors ligne), **INFORMATIONS** (dernière réservation : date + trajet), **AGENDA** (calendrier hebdo par chauffeur).
- Note affichée : les chauffeurs règlent eux-mêmes leurs disponibilités et horaires depuis l'app mobile. Le "mode silencieux hors ligne" et le respect des horaires se règlent dans Chauffeurs > Options chauffeurs.

## Réservations — liste
**URL** : `/reservations`
- Vue liste de **toutes** les courses (passées, en cours, futures).
- Filtres : Date de début, Date de fin, Chauffeur, Statut, Moyen de paiement, Origine, Tags (+ créer un tag), Clients.
- Actions globales : **Télécharger** (export), **Créer une réservation** (voir ci-dessous).
- Tableau : **ACTIONS** (icônes : Voir, Dupliquer, Lien, Supprimer), **CLIENT** (nom, email, tél), **DATE ET HEURE**, **TRAJET** (départ, point d'arrêt éventuel, arrivée), **DÉTAILS**.
- Pagination nombreuse (des centaines de pages sur un historique réel).
- Guides liés : "Créer une réservation depuis l'admin", "Gérer une réservation : statut, chauffeur, paiement".

## Créer une réservation (depuis l'admin) — assistant en 3 étapes

Bouton **Créer une réservation** en haut de la liste. Ouvre une fenêtre modale à 3 étapes (indicateur numéroté 1-2-3 en haut, étapes nommées **Réservation / Informations / Résumé**) :

### Étape 1 — Réservation
- **Sélection du service** : Trajet simple ou Mise à disposition (les Forfaits se réservent via leur lien dédié, pas depuis cet assistant).
- Une fois le service choisi :
  - **Départ** (champ adresse avec autocomplétion + raccourci "Ma position")
  - **Destination** (idem + "Ma position")
  - **+ Ajouter un point d'arrêt** (arrêt(s) intermédiaire(s) optionnel(s))
  - **Date et heure**
  - Choix **Aller simple** / **Aller-retour**
  - Présents dans le formulaire mais révélés seulement après sélection d'une adresse ou d'un client (champs "masqués" tant qu'inutiles, comportement similaire à ce qui a déjà été observé sur ce site pour les listes virtualisées) :
    - **Recherche d'un client existant** (champ recherche) **ou** création d'un nouveau client à la volée (Nom, Email, Téléphone)
    - Case à cocher (probablement "personne transportée différente du client" ou "nouveau client" — libellé exact non confirmé)
    - **Adresse détaillée en saisie manuelle** (si l'autocomplétion ne suffit pas) : Numéro + rue, Code postal, Ville, Pays, Nom d'entreprise
    - **Note pour le chauffeur** (texte libre, visible par le chauffeur sur la course)
- Bouton **Suivant** (bloqué tant que Départ/Destination ne sont pas des adresses valides sélectionnées via l'autocomplétion — une simple saisie texte sans sélection dans la liste de suggestions ne suffit pas à valider l'étape).

### Étape 2 — Informations *(non atteinte lors de cette exploration : la validation de l'étape 1 exige une sélection d'adresse réelle via Google Places, impossible à simuler sans risquer de créer une vraie réservation)*
D'après la structure de la fiche détaillée d'une réservation existante (même formulaire en mode édition, voir plus bas), cette étape couvre vraisemblablement : choix de la gamme de véhicule, chauffeur (assignation manuelle ou dispatch), moyen de paiement, options (bagages, sièges auto/rehausseurs), tag. **À confirmer avec Jim.**

### Étape 3 — Résumé *(non atteinte, mêmes raisons)*
Vraisemblablement un récapitulatif avant validation finale + bouton de création. **À confirmer avec Jim.**

## Fiche détaillée d'une réservation existante ("Voir")

Ouverte depuis l'icône **Voir** (parmi les icônes d'action de chaque ligne : Voir / Dupliquer / Lien / Supprimer — cette dernière jamais testée). Fenêtre modale à 4 onglets : **Course / Client / Paiement / Documents**.

### Onglet Course
- **STATUT** de la réservation (ex: "Confirmée")
- **CHAUFFEUR** : nom assigné + lien "Fiche chauffeur"
- Bouton **Dispatcher** : "Dispatchez manuellement la réservation aux autres chauffeurs" — permet de renvoyer une réservation déjà assignée dans le circuit de dispatch (ré-attribution manuelle à tout moment, pas seulement à la création)
- **Adresses** : départ, point(s) d'arrêt (plusieurs observés), arrivée + lien "Modifier les adresses"
- **NOTE DU CLIENT** (texte libre)
- **OPTIONS DE LA COURSE** : compteurs +/− pour bagages S / M / L, sièges auto, rehausseurs
- **MODIFIER LA DATE ET L'HEURE**
- **ÉTAPE DE LA COURSE** : tracker en 4 paliers — 1. Pas commencée · 2. Chauffeur en route · 3. Chauffeur sur place / trajet en cours · 4. Terminée
- Bouton **Prévenir le client** — note : "Pour une course que le chauffeur n'a pas fait avancer dans l'app. Une course terminée ne peut plus revenir en arrière." (= intervention manuelle admin quand le chauffeur n'a pas mis à jour le statut depuis son app)
- **TAG** (étiquette libre assignable)
- Carte intégrée (Leaflet/OpenStreetMap) avec liens directs **Google Maps** et **Waze**
- Boutons **Fermer** / **Sauvegarder**

### Onglet Client
- Fiche client : Nom, Email, Téléphone + liens **Fiche client** et **Changer de client**
- Section **PERSONNE TRANSPORTÉE (si différente du client)** — distincte du client qui paie/réserve

### Onglet Paiement
- **Moyen de paiement** : Espèces / Paiement différé / Carte bancaire à bord
- **TARIF** (€) — éditable manuellement à tout moment, quel que soit le statut de la réservation ou du paiement
- **Ajouter une majoration** : Montant (€) + Raison (liste déroulante) + bouton "Appliquer la majoration" — note : "Le client est prévenu par e-mail et notification. S'il paie par carte, la majoration lui est demandée dans l'application."

### Onglet Documents
- **Facture entreprise** : statut ("À venir" si pas encore émise) + bouton Télécharger
- **Aperçu facture entreprise** + bouton Télécharger
- **TAUX DE COMMISSION DE CETTE COURSE** : % appliqué figé pour cette course seule (indépendant d'un changement ultérieur du réglage chauffeur/apporteur) ; affiche le réglage actuel du chauffeur en référence
- **NOTE POUR LA FACTURE** : texte libre imprimé sur la facture (colonne Désignations) — ne s'applique à une facture déjà émise qu'après un "Corriger / recalculer la facture"

## Création de réservation depuis l'application chauffeur (mobile)
**Non explorable directement** (app native, inaccessible via Chrome) — décrit par Jim :
- Cas d'usage : le chauffeur reçoit une demande par téléphone (ou autrement, hors app) et la saisit lui-même.
- Uniquement pour le service **Trajet simple** (pas de mise à disposition/forfait depuis l'app chauffeur).
- Champs : horaire, date, nom du client, coordonnées (téléphone), adresse de départ, adresse d'arrivée.
- **Tarif calculé automatiquement** à partir des réglages de tarification du back-office admin (mêmes règles que pour une réservation client classique).
- Le chauffeur peut **modifier manuellement ce tarif**.
- Informations client enregistrées : nom, prénom, email, téléphone.
- Non précisé/à confirmer si besoin plus tard : la course est-elle directement confirmée pour ce chauffeur (puisqu'il vient de la saisir) ou repasse-t-elle par un circuit de validation admin ?

## Calendrier
**URL** : `/calendrier`
- Vue calendrier mensuel.
- Filtre par chauffeur ("Tous les chauffeurs" ou un chauffeur précis).
- Navigation Précédent / Aujourd'hui / Suivant.
- Chaque jour affiche un **nombre** (nombre de courses ce jour-là) ; cliquer dessus ouvrirait probablement le détail du jour (non testé pour éviter toute action).

## Points à clarifier avec Jim
- Contenu exact des étapes 2 (Informations) et 3 (Résumé) de l'assistant de création — non atteintes car la validation de l'étape 1 exige une vraie sélection d'adresse Google Places.
- Libellé exact de la case à cocher révélée en étape 1 (probablement liée à "nouveau client" ou "personne transportée").
- Création de réservation depuis l'app chauffeur : champs, comportement, visibilité admin.

## Équivalent côté RenVTC (nouveau)
🟡 Partiel, très simplifié par rapport à l'ancien système :
- ✅ Liste des courses "Nouvelles demandes" et "En cours" dans l'admin (mais pas d'historique complet des courses terminées/annulées, pas de filtres par date/chauffeur/tag/client, pas d'export, pas de pagination avancée).
- ❌ Pas de vue calendrier.
- ❌ Pas de page "Disponibilités" dédiée (la gamme du chauffeur sert de filtre pour le dispatch, mais pas de statut en ligne/hors ligne visible côté admin, pas d'agenda).
- ❌ Pas de création de réservation manuelle depuis l'admin, ni depuis l'app chauffeur.
- ❌ Pas d'assistant multi-étapes, pas de fiche détaillée à onglets (Course/Client/Paiement/Documents).
- ❌ Pas de points d'arrêt multiples, pas d'aller-retour, pas de tags, pas de note "pour le chauffeur" distincte de la demande elle-même.
- ❌ Pas de ré-assignation manuelle (dispatch) depuis la fiche d'une course déjà assignée — seul le dispatch initial existe.
- ❌ Pas de tracker granulaire "ÉTAPE DE LA COURSE" (seulement les statuts globaux pending/dispatched/accepted/completed), pas de bouton "Prévenir le client" pour les courses bloquées côté chauffeur.
- ❌ Pas de majoration de tarif, pas de modification manuelle du prix après création, pas de taux de commission par course, pas de facturation/documents.
