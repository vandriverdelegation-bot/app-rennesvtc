# Chauffeurs

**Chemin** : Chauffeurs
**URL** : `/chauffeurs`

## Actions globales
- **Options chauffeurs** (lien vers réglages généraux : probablement mode silencieux hors ligne, respect des horaires — mentionné sur la page Disponibilités)
- **Télécharger** (export)
- **Ajouter un chauffeur** (bouton présent, formulaire non capturé — clic sans effet visible lors du test, à revérifier manuellement si besoin)

## Filtres
- Tous les statuts
- Tous les documents

## Vue liste
Tableau avec en-têtes : **ACTIF** (case à cocher statut), **CHAUFFEUR**, **SES VÉHICULES**, **INSCRIT LE**, **ACTIONS**.

Pour chaque chauffeur (structure des informations affichées, exemples fictifs) :
- Nom + rôle (**Principal** ou **Secondaire**)
- Note moyenne + nombre d'avis (ex: "5,00 • 4 avis" ou "0 avis")
- Email
- Téléphone
- **Pièces justificatives** : nombre fourni / nombre manquant, ou "Documents à jour"
- Statut : **Actif** / **Inactif** / **Pause** (icône ⏸)
- Gammes de véhicules assignées (ex: Gamme Berline, Gamme Affaire, Gamme Van/Minivan)
- Date d'inscription
- Bouton **Modifier**, et pour les secondaires un bouton **Supprimer**

### Menu "OPTIONS" par chauffeur (déroulant, non ouvert en détail)
- Créer des réservations
- Majorer le prix des courses
- Modifier le prix des courses (prix déjà défini)
- Voir toutes les options (lien vers plus de réglages)

→ Ces options suggèrent un système de **permissions fines par chauffeur** : certains peuvent créer des réservations ou ajuster les prix, d'autres non.

Pagination en bas de tableau.

## Rôle "Principal" vs "Secondaire"
- Le compte Principal (le gérant) peut aussi être chauffeur.
- Les chauffeurs "Secondaire" sont les partenaires ajoutés.

## Équivalent côté RenVTC (nouveau)
🟡 Partiel :
- ✅ On peut créer un compte chauffeur (email + mot de passe + gamme) depuis l'admin.
- ✅ Liste des chauffeurs avec email, gamme, notifications activées, date d'inscription.
- ❌ Pas de rôle Principal/Secondaire.
- ❌ Pas de permissions fines par chauffeur (créer des réservations, modifier les prix).
- ❌ Pas de gestion de documents/pièces justificatives.
- ❌ Pas de notation/avis affichés sur cette liste.
- ❌ Pas de statut Pause.
