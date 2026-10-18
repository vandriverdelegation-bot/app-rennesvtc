# Modèle de données — déduit de l'ancien back-office

## Entreprise (le compte Jim / Rennes VTC)
- Nom, logo, couleurs, police, description (branding app)
- Contact (email, tél, site, réseaux sociaux)
- Infos légales (SIRET/SIREN, registre VTC, zone d'activité, TVA)
- Devise, moyens de paiement acceptés

## Chauffeur
- Nom, email, téléphone
- Rôle : **Principal** (le gérant) ou **Secondaire** (partenaire)
- Statut : Actif / Inactif / Pause
- Note moyenne + nombre d'avis
- Pièces justificatives (documents, nombre fournis/manquants)
- Véhicule(s) associé(s) — un chauffeur peut avoir plusieurs catégories de véhicules
- Disponibilité : statut En ligne/Hors ligne (géré depuis l'app chauffeur), horaires/agenda
- Options/permissions : créer des réservations, majorer le prix, modifier le prix
- Commission (montant fixe ou %) — lié à Gestion financière
- Date d'inscription

## Véhicule (catégorie de véhicule, propriété de l'entreprise/chauffeur)
- Type (Berline, SUV, Van, etc.), couleur, images
- Nom affiché, plaque d'immatriculation (optionnelle)
- Capacité : nombre de places, bagages S/M/L
- Options (climatisation, wifi, siège auto...) + options personnalisées

## Client
- Nom, prénom, coordonnées (email, téléphone)
- Date d'inscription
- Nombre de réservations
- Solde de points fidélité (si programme actif)

## Service
- Type : **Trajet simple** / **Mise à disposition** / **Forfait**
- Actif (oui/non)
- Véhicules associés
- Dispatch automatique entre chauffeurs (oui/non)
- Mode de tarification : **Manuel** (saisi à chaque course) ou **Calcul** (règles automatiques : base, km, jour/nuit/weekend/férié, zones géographiques, suppléments)

## Forfait
- Nom, véhicule(s) associé(s), prix fixe
- Lien de réservation dédié partageable

## Réservation (course)
- Client (ou personne transportée différente du client), chauffeur assigné
- Trajet : départ, destination, point(s) d'arrêt (plusieurs possibles), date/heure, aller simple/retour
- Service utilisé (trajet simple / mise à disposition / forfait)
- Statut global : en attente / confirmé / en cours d'approbation / annulé / refusé / terminé
- **Étape de la course (tracker fin, distinct du statut global)** : pas commencée → chauffeur en route → chauffeur sur place/trajet en cours → terminée (mise à jour normalement par le chauffeur depuis son app ; override manuel possible par l'admin via "Prévenir le client" si le chauffeur n'a pas fait avancer l'app)
- Moyen de paiement : carte bancaire, espèces, différé, en ligne
- Prix (éditable manuellement à tout moment par l'admin), majoration éventuelle (montant + raison, notifiée au client par email/notification), remboursement éventuel
- Taux de commission appliqué à cette course précise (figé, indépendant d'un changement ultérieur du réglage chauffeur/apporteur)
- Note du client, note pour le chauffeur (texte libre, visible par le chauffeur), note pour la facture (imprimée sur la facture)
- Options : bagages (S/M/L), sièges auto, rehausseurs (compteurs par réservation)
- Origine (app, module web, création manuelle admin, création depuis l'app chauffeur)
- Possibilité de ré-assignation manuelle (dispatch) même après assignation initiale
- Tags (libres, créables)
- Documents liés (facture entreprise + aperçu, téléchargeables)
- Avis laissé par le client après la course (note + commentaire)

## Code promo
- Code, règles (non détaillées), historique d'utilisation (client, réservation, date)

## Programme de fidélité
- Points gagnés par € dépensé, bonus 1ère course, expiration
- Récompenses configurables (liste, vide par défaut)
- Design de la carte fidélité (branding)

## Campagne de notification
- Titre, message, destinataires (clients et/ou chauffeurs secondaires sélectionnés), date d'envoi

## Commission / Apporteur d'affaires
- Chauffeur ou client désigné comme apporteur
- Commission en montant fixe ou %, TVA applicable ou non

## Liens entre objets (résumé)
```
Entreprise ──< Chauffeur ──< Véhicule
Entreprise ──< Service ──< Véhicule (association)
Service ──< Forfait
Client ──< Réservation >── Chauffeur
Réservation ── Service
Réservation ── Avis (1:1, optionnel)
Réservation ── Facture (1:1, optionnel)
Chauffeur ── Commission (1:1 ou 1:N par période)
Client/Chauffeur ── Apporteur d'affaires (0:1)
```

## Comparaison avec le modèle RenVTC actuel
Table `rides` (RenVTC) ≈ "Réservation" ci-dessus, mais plus simple :
- Pas de point d'arrêt multiple, pas d'aller-retour, pas de tags, pas de tracker d'étape fin (pas commencée/en route/sur place/terminée), pas de majoration, pas de commission par course.
- ✅ **Origine ajoutée** : une réservation peut maintenant venir d'un client (`client_id` rempli) ou d'une saisie téléphonique par un chauffeur (`client_id` vide, `client_name`/`client_phone` renseignés, course assignée directement, prix modifiable si autorisé).
- ✅ **Rôle/permissions chauffeur ajoutés** (`profiles.driver_role` Principal/Secondaire, `can_create_rides`, `can_edit_price`), gérables depuis l'admin.
- Statuts RenVTC : `pending` (chez l'admin) → `dispatched` → `accepted` → `completed` (pas de "refusé" distinct, pas de "en cours d'approbation").
- `vehicle_category` (3 valeurs fixes) remplace le système de "Véhicule" flexible avec options/photos.
- Pas de table Commission / Apporteur d'affaires / Code promo / Fidélité / Campagne.
