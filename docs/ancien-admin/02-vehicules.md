# Véhicules

**Chemin** : Mon application > Véhicules
**URL** : `/vehicules`

Gère le parc de catégories de véhicules proposées aux clients (pas les véhicules individuels des chauffeurs).

## Vue liste
Tableau avec colonnes : **VÉHICULE** (nom + modèle), **CAPACITÉ** (passagers + bagages S/M/L), **OPTIONS**, **ACTIONS** (Modifier / Supprimer).
Pagination ("Précédent" / "Suivant" / numéro de page).
Compteur "Total : N".

Exemple de categories existantes (structure, pas les vraies donnees) : "Gamme Berline", "Gamme Affaire", "Gamme Van / Minivan".

Bouton **Ajouter un véhicule** en haut.

## Formulaire d'ajout / édition (modale)
| Champ | Type | Détail |
|---|---|---|
| Type de véhicule | Liste déroulante | Touring, Coupé, Berline, SUV, Mini van, Van, Cabriolet, Sport, Limousine, Pickup, Camion |
| Couleur du véhicule | Choix | Blanc, Gris, Noir |
| Images | Upload (glisser-déposer ou parcourir) | Plusieurs images |
| Options véhicule | Cases à cocher multiples | Électrique, Écologique, Accès handicapé, Luxe, Climatisation, Véhicule réservé pour femme, Eau/Jus de fruit, Chargeur, Wifi, Siège auto, Rehausseur, Animaux acceptés, Grand coffre, Porte-skis/vélos, Fauteuil roulant pliable accepté, Non-fumeur, Sièges cuir, Vitres teintées, Parapluie à disposition |
| Options personnalisées | Liste dynamique (+ Ajouter) | 4 max, 24 caractères, avec icône |
| Nom | Texte (obligatoire) | Nom affiché du véhicule |
| Plaque d'immatriculation | Texte (optionnel) | Peut être laissée vide ; le chauffeur la renseigne lui-même dans son app |
| Nombre de places | Nombre (obligatoire) | |
| Capacité du coffre | 3 nombres (S / M / L) | M obligatoire, S et L calculés automatiquement à partir de M (modifiables, 0 = taille refusée) |

Boutons modale : **Fermer** / **Sauvegarder**.

## Équivalent côté RenVTC (nouveau)
🟡 Partiel. Nous avons 3 **gammes fixes** (Confort/Affaires/Van) utilisées pour la tarification et le dispatch, mais pas de gestion de véhicules individuels (marque, plaque, options, photos). Les chauffeurs choisissent juste leur gamme dans leurs réglages.
