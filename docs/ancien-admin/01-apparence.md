# Apparence

**Chemin** : Mon application > Apparence
**URL** : `/apparence`

Permet de personnaliser le design et les informations affichees sur les stores (App Store / Google Play).

## Section "Informations générales"
| Champ | Type | Détail |
|---|---|---|
| Nom de l'application | Texte | Obligatoire, max 30 caractères (compteur affiché) |
| Logo | Upload image | Obligatoire, 2 Mo max, formats png/jpeg/jpg/gif |
| Couleur | Sélecteur couleur (hex) | Ex: `#44BA14` |
| Contraste | Choix Blanc / Noir | Couleur du texte sur fond de la couleur principale |
| Type d'accueil mobile | Choix Standard / Compact | Mise en page de l'écran d'accueil client |
| Mise en avant | Choix "Carte" (et probablement d'autres options) | Élément mis en avant sur l'accueil |
| Afficher les chauffeurs sur la carte | Case à cocher | Affiche les voitures à proximité sur la carte d'accueil/commande |
| Couleur des voitures | Choix Noir / Gris / Blanc | Couleur des icônes voiture sur la carte |
| Icônes | Choix de style : Classique / Moderne / Original / Arcade / Art / Clean / Pulsar | Style d'icônes de l'app |
| Police | Choix : Inter / Poppins / Roboto / Montserrat / Nunito / DM Sans | Typographie de l'app |
| Description | Texte long | Obligatoire, min 50 caractères, compteur affiché. Règle store : ne pas citer de concurrent |

Bouton **Modifier** pour valider la section Informations générales.

## Section "Contact"
| Champ | Type |
|---|---|
| Email | Texte |
| Téléphone | Texte |
| Site web | Texte (URL) |
| Facebook / Instagram / X / TikTok / LinkedIn / YouTube | URL complète, vide = masqué |

Bouton **Modifier**.

## Section "Numéro de téléphone du Standard ou Support"
- Numéro affiché dans l'app pour que les clients appellent directement (France +33)
- Case à cocher "Afficher ce numéro sur mon app mobile"
- S'enregistre immédiatement sans mise à jour de l'app (comportement notable)
- Bouton **Enregistrer**

## Section "Conditions générales d'utilisation (CGU)"
- Édition du texte des CGU, bouton **Modifier**

## Aperçu live
- Un mockup de téléphone à droite prévisualise en temps réel les changements
- Bascule **Client / Chauffeur** pour voir l'app des deux côtés
- Pagination "1/4" : plusieurs écrans d'aperçu disponibles (accueil, réservation, véhicules, compte visibles sur l'écran 1)

## Équivalent côté RenVTC (nouveau)
❌ Manquant. Notre app a une charte fixe codée en dur (pas d'interface pour la changer depuis l'admin). À discuter : est-ce vraiment nécessaire pour RenVTC (une seule marque, pas besoin de personnalisation dynamique) ?
