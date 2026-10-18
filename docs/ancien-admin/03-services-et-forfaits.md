# Services et forfaits

**Chemin** : Mon application > Services et forfaits
**URL** : `/services`

Configure les types de prestations proposées et leur tarification. C'est l'écran le plus complexe de l'ancien admin — **détail confirmé par une exploration exhaustive (scroll complet de la fenêtre de détail)**.

## Réglage global
- **Adresse exacte obligatoire** (case à cocher) : empêche un client de ne saisir qu'une ville ; une adresse précise (numéro + rue) est exigée (app + module web).
- **Ordre d'affichage des services** (lien dédié).

## Vue liste des services
Tableau : **ACTIF** (case à cocher), **VÉHICULES** (nombre ajoutés), **SERVICE** (nom + description), **DISPATCH AUTOMATIQUE ENTRE CHAUFFEURS** (case à cocher), bouton **Voir détails**.

3 services :
1. **Trajet simple** — "Le client peut choisir un lieu de départ et d'arrivée à une date et heure précises."
2. **Mise à disposition** — "Le client peut réserver un véhicule avec chauffeur à une date et sur une période souhaitées."
3. **Forfaits** — trajets nommés à prix fixe (listés séparément, voir plus bas).

## Détail d'un service (fenêtre "Voir détails")
En-tête : nom + description du service.
- **OPTIONS (N)** — section repliée "Ouvrir" (non développée en détail, probablement des réglages fins du service — ex: aller-retour autorisé, délai minimum de réservation, etc. — **à confirmer avec Jim**).
- **ORDRE D'AFFICHAGE** — section repliée "Ouvrir".
- **AJOUTER DES VÉHICULES** — bouton pour associer une nouvelle gamme à ce service.

### Tableau par véhicule
Pour **chaque gamme** (Berline, Affaire, Van/Minivan — la structure ci-dessous est **identique pour les 3**), bascule :
- **Manuel** : le chauffeur saisit le prix à chaque réservation.
- **Calcul** : "Calculer les tarifs automatiquement selon mes paramètres" — affiche le formulaire complet ci-dessous.

#### TARIFS DE BASE (par gamme)
| Champ | Type | Détail |
|---|---|---|
| Pays | Liste | Ex: France |
| Unité de calcul | Liste | Ex: "Calcul au kilomètre" |
| Tarif de jour | Plage horaire (de / à) | Heure de début et fin du tarif "jour" |
| Tarif de nuit | Plage horaire (de / à) + prix € | Tarif de base de nuit |
| Samedi / Dimanche / Jours fériés | 3 champs € | Majorations — **présentes deux fois dans le formulaire** (une fois liée au tarif de jour, une fois au tarif de nuit — l'ordre exact d'affichage n'a pas pu être confirmé visuellement, capture d'écran impossible sur ce site) |
| Tarif minimum de jour | € | Prix plancher si le calcul au km donne moins |
| Tarif minimum de nuit | € | Idem pour la nuit |
| Tarif par passager | € + "à partir du passager n°" | Supplément par passager au-delà d'un seuil |
| Supplément siège auto (par siège) | € | |
| Supplément rehausseur (par rehausseur) | € | |
| Tarif par point d'arrêt | € | Supplément par arrêt intermédiaire |
| Prise en charge | € | Frais fixe de départ |

#### TARIFS PAR ZONE (par gamme, alternative/complément au calcul au km)
- Case à cocher **Tarif fixe par zone (départ)** : "Chaque zone a un tarif fixe. Le tarif se base sur la zone de départ."
- Case à cocher **Tarif fixe par zone (arrivée)** : idem basé sur la zone d'arrivée.
- Les zones sont dessinées sur une **carte Google Maps intégrée** (attribution "Données cartographiques Google" visible).
- Chaque zone : "Nombre de kilomètres : X,XX km" (rayon), nom "ZONE DE TARIF N°N", lien **Voir tout** (détail du tarif de cette zone, non ouvert).
- Bouton **+ Ajouter une zone**.
- Observé jusqu'à 5 zones configurées sur une gamme ; état vide possible ("Aucune zone ajoutée pour le moment").

## Forfaits (liste séparée dans le même écran)
- Chaque forfait : nom (ex: "Forfait Aéroport Rennes"), nombre de véhicules associés, nombre de forfaits du même nom.
- Actions : **Modifier**, **Dupliquer**, **Supprimer**, **Configuration**, **Copier le lien** (lien de réservation direct dédié à ce forfait).

## Points à clarifier avec Jim
- Contenu exact de "OPTIONS (N)" et "ORDRE D'AFFICHAGE" par service (non développés).
- Répartition exacte Samedi/Dimanche/Jours fériés entre tarif jour et tarif nuit (visuel non capturable sur ce site).
- Détail du tarif d'une "ZONE" (prix exact, lien avec départ vs arrivée).
- Modèle de tarification de "Mise à disposition" (probablement tarif horaire, non confirmé en détail).

## Équivalent côté RenVTC (nouveau)
🟡 Partiel, volontairement simplifié (décision prise ensemble) :
- Trajet simple : prix de base + prix/km + minimum, **un seul tarif par gamme** (pas de variation jour/nuit/weekend/férié, pas de zones géographiques, pas de supplément passager/siège enfant/arrêt, pas de mode Manuel).
- Mise à disposition : prix/heure + heures minimum.
- Forfaits : nom + prix fixe par gamme (pas de lien partageable dédié).
