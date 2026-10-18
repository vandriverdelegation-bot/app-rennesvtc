# Gestion financière (3 sous-pages) + Statistiques
*(structure uniquement — chiffres réels non reproduits, exemples fictifs utilisés)*

## Revenus et facturation
**URL** : `/rapports`
- **Options de facturation**, **Facture mensuel client** (guide dédié).
- Filtres : Date début/fin, Chauffeur, Moyen de paiement, Remboursement, Origine, Tags, Clients.
- KPIs période : "Revenus sur la période" (ex: 1 000 €), "Réservations confirmées sur la période" (ex: 15).
- Graphique quotidien des revenus sur la période.
- Tableau détail par course : **Client / Chauffeur**, **Détails**, **Prix / Paiement**, **Documents** (facture).
- Bloc "Facturer un client au mois" : liste clients avec Nom, Email, Téléphone, Nb. réservations — pour regrouper plusieurs courses sur une seule facture mensuelle.
- Bouton **Télécharger toutes les factures**.
- Guides : annulations/remboursements/avoirs.

## Commissions
**URL** : `/commissions`
- Objectif : définir la commission prélevée sur chaque chauffeur secondaire.
- Actions globales : **Attribution groupée**, **Accès au rapport**.
- Tableau : **CHAUFFEUR** (nom, email, statut), **COMMISSIONS** (montant/% défini ou "Aucune commission renseignée"), **ACTIONS** (Ajouter, Fiche chauffeur).
- Filtre par période (dates dans l'URL).

## Apporteurs d'affaires
**URL** : `/apporteurs-affaires`
- Concept : un chauffeur secondaire ou un client qui touche une commission (montant fixe ou %) quand il est à l'origine d'une réservation.
- Bouton **Ajouter un apporteur d'affaires**.
- Tableau : **APPORTEUR D'AFFAIRES**, **COMMISSION**, **ACTIF**, **MODIFIER PRIX**, **TVA NON APPLICABLE**, **TVA %**, **PRÉFIXE FACTURE**, **ACTIONS**.
- Section "Rapport des commissions apporteurs d'affaires" avec filtre de dates.

## Statistiques
**URL** : `/statistiques`
- Filtre période : "Toute l'année" + sélecteur d'année.
- 4 KPIs principaux (exemples fictifs) : Revenus de l'année (ex: 50 000 €), Réservations (ex: 800), Nouveaux clients (ex: 450), Taux de refus (ex: 8%).
- Graphique "Revenus mensuels" (barres, Janv → Déc).
- Graphique "Réservations / clients / chauffeurs" (3 courbes mensuelles : clients créés, chauffeurs créés, réservations créées).
- Graphique "Moyens de paiements favoris" (camembert : Carte bancaire, Espèce, Différé, En ligne — avec % et total).
- Graphique "Statut des réservations" (camembert : Confirmé, En cours d'approbation, Annulé, Refusé — avec % et total).
- Bloc séparé "Réservations du module web" : même répartition de statuts, mais uniquement pour les réservations venues du module de réservation web (Mes outils).

## Équivalent côté RenVTC (nouveau)
❌ Entièrement manquant (décision initiale : pas de paiement en ligne donc pas de facturation automatisée, pas de commissions/apporteurs d'affaires, pas de page statistiques avancée — seuls quelques compteurs simples sur le tableau de bord).
