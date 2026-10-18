# Mes outils

**Chemin** : Mes outils
**URL** : `/mes-outils`

## Module de réservation web
Permet aux clients de réserver et payer une course depuis le site web de l'entreprise, un email ou un SMS, **sans télécharger l'application**. Les réservations arrivent comme celles de l'app.

### Étape 1 — Partager ou intégrer
Choix du format :
- **Lien** à partager
- **Script** à coller dans le site (recommandé)
- **Iframe** (si pas de script possible)

### Étape 2 — Copier le lien
Lien unique du type `https://admin.monappvtc.fr/reserver/<identifiant-entreprise>`, avec bouton **Aperçu** et **Copier le lien**.

### Étape 3 — Personnaliser le lien (facultatif)
Pré-remplissage de la réservation via paramètres dans le lien :
- Service (ou "le client choisit")
- Probablement d'autres champs pré-remplissables (adresse, véhicule...) — non détaillé davantage.

## Le module de réservation lui-même (page publique `/reserver/<id>`)
Assistant en 3 étapes avec indicateur numéroté en haut : **1 Réservation → 2 Informations → 3 Résumé**.

### Étape 1 — Réservation
- Sélection du service : **Trajet simple** / **Mise à disposition** (icônes)
- Champs : Départ (+ bouton "Ma position"), Destination (+ "Ma position"), lien "Ajouter un point d'arrêt"
- Date et heure
- Bascule **Aller simple / Aller-retour**
- Autocomplétion d'adresse (widget Google Places)
- Bouton Suivant (désactivé tant que les adresses ne sont pas correctement sélectionnées dans la liste de suggestions)

### Étape 2 — Informations (champs identifiés dans le DOM, non visités en détail)
- Nom, Email, Téléphone (connexion / création de compte)
- Adresse de facturation : numéro et rue, code postal, ville, pays, nom d'entreprise

### Étape 3 — Résumé
- Non visité en détail (pour ne pas aller jusqu'au paiement).

- Lien "Voir mes réservations" présent sur toutes les étapes.

## Équivalent côté RenVTC (nouveau)
❌ Manquant. RenVTC n'a pour l'instant qu'une réservation via l'app mobile (client connecté). Pas de module web embarquable, pas de réservation sans compte.
