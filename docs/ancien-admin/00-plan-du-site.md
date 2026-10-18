# Plan du site — Ancien back-office (Mon App VTC)

Domaine : `admin.monappvtc.fr`
Connecté en tant que : compte Principal (chauffeur + gérant)

## Arborescence du menu (avec URL confirmée)

- **Tableau de bord** — `/accueil`
- **Mon application**
  - Apparence — `/apparence`
  - Véhicules — `/vehicules`
  - Services et forfaits — `/services`
  - Paiements — `/paiements`
- **Gestion réservations**
  - Disponibilités — `/disponibilites`
  - Réservations — `/reservations`
  - Calendrier — `/calendrier`
- **Chauffeurs** — `/chauffeurs`
- **Clients** — `/clients` *(structure seulement, données personnelles)*
- **Gestion financière** *(structure seulement, donnees financieres)*
  - Revenus et facturation — `/rapports`
  - Commissions — `/commissions`
  - Apporteurs d'affaires — `/apporteurs-affaires`
- **Marketing**
  - Codes promo — `/code-promo`
  - Fidélité — `/fidelite`
  - Notifications — `/campagne-notifications`
  - Pop-up de bienvenue — `/pop-up-bienvenue`
  - Annonces — `/annonces`
- **Statistiques** — `/statistiques` *(chiffres d'affaires, structure seulement)*
- **Avis clients** — `/avis`
- **Mes outils** — `/mes-outils` (+ module public `/reserver/<id>`)
- **Carte interactive** — `/carte-interactive`
- **Profil** — `/mon-profil`
- **Abonnement** — *non explore (facturation du service lui-meme, hors perimetre)*
- **Aide** — *centre d'aide externe, hors perimetre*

## Menu utilisateur (coin supérieur droit)
- Mon profil
- Aide
- Déconnexion

## Pages avec donnees reelles sensibles (documentees par structure uniquement)
- Clients (2400+ clients réels)
- Revenus et facturation, Commissions, Apporteurs d'affaires (montants réels)
- Statistiques (chiffre d'affaires réel)
- Les listes de destinataires dans Notifications (noms/emails/tel reels)

## Fiches détaillées
01. Apparence
02. Véhicules
03. Services et forfaits
04. Paiements
05. Gestion réservations (Disponibilités/Réservations/Calendrier)
06. Chauffeurs
07. Marketing (5 sous-pages)
08. Avis clients
09. Mes outils
10. Carte interactive
11. Clients (structure)
12. Gestion financière + Statistiques (structure)
13. Profil

## Captures d'écran
Non réalisées : l'outil de capture se heurte à un problème technique récurrent sur ce site (page jugée "toujours en chargement" à cause d'une activité réseau permanente en arrière-plan). La documentation ci-dessus repose donc uniquement sur la structure texte extraite de chaque page.

## Questions pour Jim — réponses obtenues (2026-10-17)
1. **Apparence, TVA/facturation, Commissions, Apporteurs d'affaires, Statistiques avancées, Marketing (5 pages)** : ✅ confirmé **hors scope pour l'instant** — tout reste pour plus tard.
2. **Rôles/permissions par chauffeur** (Principal/Secondaire, "Créer des réservations", "Majorer/Modifier le prix") : ✅ **à reproduire dans RenVTC** — Jim veut ce système de rôle + permissions à cocher par chauffeur secondaire.
3. **Module de réservation web** (Mes outils, lien public de réservation) : ✅ **plus tard** — pas dans cette phase.
4. **Écrans/fonctions manqués** : ✅ aucun signalé — la documentation couvre tout ce que Jim utilise au quotidien.
