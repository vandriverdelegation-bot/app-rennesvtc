# Comparaison ancien admin (Mon App VTC) vs nouveau backend (RenVTC)

Légende : ✅ existe déjà et identique / 🟡 existe mais incomplet / ❌ manquant

| Écran / fonction | RenVTC | Détail |
|---|---|---|
| **Tableau de bord** | 🟡 | Compteurs simples (chauffeurs, clients, demandes, courses en cours/terminées). Pas de revenus, pas de "Besoin d'aide", pas de guides intégrés. |
| **Apparence** (branding app) | ❌ | Charte graphique fixe, pas d'interface de personnalisation. |
| **Véhicules** (flotte détaillée) | ❌ | Remplacé par 3 gammes fixes (Confort/Affaires/Van), pas de gestion individuelle (plaque, photos, options). |
| **Services et forfaits** | 🟡 | 3 services existent (trajet simple, mise à disposition, forfaits) mais tarification très simplifiée (pas de zones, pas de jour/nuit/weekend/férié, pas de mode Manuel). |
| **Paiements** | 🟡 | 3 modes au choix client (CB à bord, espèces, en compte). Pas de paiement en ligne (décision explicite), pas de réglage devise. |
| **Disponibilités** | ❌ | Pas de page dédiée, pas de statut en ligne/hors ligne visible côté admin. |
| **Réservations** (liste complète + filtres) | 🟡 | Liste "nouvelles demandes" + "en cours" seulement. Pas d'historique complet, pas de filtres avancés, pas d'export. ✅ **Création manuelle depuis l'app chauffeur** ajoutée (réservation téléphonique, gérée par rôle/permission) — pas de création depuis l'admin, pas d'assistant multi-étapes admin, pas de fiche à onglets (Course/Client/Paiement/Documents), pas de points d'arrêt multiples/aller-retour/tags, pas de ré-assignation manuelle depuis une course déjà assignée, pas de tracker granulaire d'étape de course, pas de majoration de tarif. |
| **Calendrier** | ❌ | Pas de vue calendrier. |
| **Chauffeurs** (liste + gestion) | 🟡 | Liste + ajout avec gamme. Pas de rôle Principal/Secondaire, pas de permissions fines, pas de documents, pas de notation. |
| **Clients** (liste) | 🟡 | Liste basique (email, date). Pas de nb. réservations, pas d'export/recherche. |
| **Gestion financière** (revenus/factures/commissions/apporteurs) | ❌ | Totalement absent (cohérent avec l'absence de paiement en ligne). |
| **Marketing** (codes promo, fidélité, notifications, pop-up, annonces) | ❌ | Totalement absent. |
| **Statistiques avancées** | ❌ | Absent (seuls les compteurs du tableau de bord). |
| **Avis clients / notation** | ❌ | Absent (décision explicite : non prioritaire). |
| **Mes outils / module de réservation web** | ❌ | Absent (réservation uniquement via l'app mobile). |
| **Carte interactive** | 🟡 | Existe mais limitée aux chauffeurs en course (pas de suivi permanent des chauffeurs disponibles). |
| **Profil entreprise (SIRET/TVA)** | ❌ | Absent. |
| **Dispatch** | 🟡 différent | Pas de dispatch automatique géolocalisé : dispatch **manuel par l'admin** (à tous les chauffeurs compatibles, ou à un chauffeur précis) — demande explicite du client, volontairement différent de l'ancien système. Pas de ré-dispatch manuel depuis une course déjà assignée (l'ancien admin le permet via le bouton "Dispatcher" dans la fiche détail). |
| **Notifications push (vers client/chauffeur)** | ✅ | Existe (accepté/dispatché), via Expo —配置 compte Expo à finaliser. |
| **Email admin (nouvelle demande)** | ✅ | Existe via Resend. |
| **Authentification (client/chauffeur/admin)** | ✅ | Existe (Supabase Auth, 3 rôles). |

## Résumé
Les écrans **cœur de métier** (réservation, tarification de base, chauffeurs, dispatch, paiement) sont en place avec une version volontairement simplifiée. Les écrans **manquants** concernent surtout : la gestion financière/facturation avancée, le marketing, les statistiques poussées, la personnalisation de marque, et la gestion fine de la flotte de véhicules.
