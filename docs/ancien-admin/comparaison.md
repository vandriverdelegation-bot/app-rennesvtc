# Comparaison ancien admin (Mon App VTC) vs nouveau backend (RenVTC)

Légende : ✅ existe déjà et identique / 🟡 existe mais incomplet / ❌ manquant

| Écran / fonction | RenVTC | Détail |
|---|---|---|
| **Tableau de bord** | 🟡 | Compteurs simples (chauffeurs, clients, demandes, courses en cours/terminées). Pas de revenus, pas de "Besoin d'aide", pas de guides intégrés. |
| **Apparence** (branding app) | ❌ | Charte graphique fixe, pas d'interface de personnalisation. |
| **Véhicules** (flotte détaillée) | 🟡 | ✅ Table `vehicles` : nom affiché, plaque, couleur, places, bagages S/M/L, options libres, photo, assignation à un chauffeur, actif/inactif. Page admin dédiée. ✅ **Upload réel de photo** (bucket Supabase Storage dédié, public en lecture). Reste simplifié : une seule photo par véhicule, pas de dessin de zones. |
| **Services et forfaits** | 🟡 | ✅ Tarification complète pour le trajet simple : tarif jour/nuit (plage horaire configurable), majorations samedi/dimanche/jour férié **distinctes pour le jour et pour la nuit** (calcul automatique des jours fériés français), suppléments passager/siège auto/rehausseur/point d'arrêt, prise en charge fixe, mode Manuel. ✅ **Zones de tarif géographique sur une vraie carte interactive** (clic pour créer, glisser pour déplacer/redimensionner, par gamme de véhicule) — chaque zone a son **propre tarif jour/nuit complet** (comme la tarification de base), fidèle à l'ancien admin. Simplification assumée : une seule zone prioritaire si départ et arrivée matchent chacun une zone différente ; mise à disposition et forfaits restent simples (tarif horaire / prix fixe). |
| **Paiements** | 🟡 | 3 modes au choix client (CB à bord, espèces, en compte). Pas de paiement en ligne (décision explicite), pas de réglage devise. |
| **Disponibilités** | 🟡 | ✅ Page admin ajoutée : statut en ligne/hors ligne par chauffeur (réglé depuis l'app chauffeur), téléphone, dernière réservation, agenda hebdomadaire (créneaux par jour, réglés par le chauffeur). Le dispatch "à tous" affiche désormais le nombre de chauffeurs en ligne. Pas de "mode silencieux hors ligne" distinct. |
| **Réservations** (liste complète + filtres) | 🟡 | ✅ **Historique complet avec filtres** (dates, statut, paiement, tag) **+ export CSV**. ✅ **Création manuelle depuis l'admin** (nom/téléphone client, adresses, points d'arrêt, aller-retour, tags, prix, assignation directe optionnelle à un chauffeur). ✅ **Ré-assignation manuelle**, **majoration de prix** avec notification, **étape de course détaillée**. ✅ **Points d'arrêt multiples avec adresses** (app client + app chauffeur + admin) et **aller-retour** fonctionnels, avec supplément tarifaire par arrêt. ✅ **Tags** : ajout/modification, filtre et export dans l'historique. ✅ **Fiche détaillée à onglets** (Course/Client/Paiement) accessible via "Voir" depuis chaque liste — statut, chauffeur + re-dispatch, adresses/arrêts/aller-retour éditables, date/heure, options, notes client et chauffeur, étape de course, tags, infos client + changement de client, moyen de paiement, tarif, majoration. Reste simplifié : pas d'onglet Documents (facturation, hors scope — décision Jim sur la gestion financière). |
| **Calendrier** | 🟡 | ✅ Vue mensuelle ajoutée (nombre de courses par jour, filtre par chauffeur, navigation précédent/aujourd'hui/suivant, détail au clic sur un jour). |
| **Chauffeurs** (liste + gestion) | 🟡 | ✅ Rôle Principal/Secondaire + permissions fines ("peut créer une réservation", "peut modifier le prix"), réglables à la création et modifiables ensuite. Pas de documents, pas de notation (décision explicite : non prioritaire). |
| **Clients** (liste) | 🟡 | Liste basique (email, date). Pas de nb. réservations, pas d'export/recherche. |
| **Gestion financière** (revenus/factures/commissions/apporteurs) | ❌ | Totalement absent (cohérent avec l'absence de paiement en ligne). |
| **Marketing** (codes promo, fidélité, notifications, pop-up, annonces) | ❌ | Totalement absent. |
| **Statistiques avancées** | ❌ | Absent (seuls les compteurs du tableau de bord). |
| **Avis clients / notation** | ❌ | Absent (décision explicite : non prioritaire). |
| **Mes outils / module de réservation web** | ❌ | Absent (réservation uniquement via l'app mobile). |
| **Carte interactive** | 🟡 | Existe mais limitée aux chauffeurs en course (pas de suivi permanent des chauffeurs disponibles). |
| **Profil entreprise (SIRET/TVA)** | ❌ | Absent. |
| **Dispatch** | 🟡 différent | Pas de dispatch automatique géolocalisé : dispatch **manuel par l'admin** (à tous les chauffeurs compatibles, ou à un chauffeur précis) — demande explicite du client, volontairement différent de l'ancien système. ✅ Ré-dispatch manuel depuis une course déjà assignée ajouté. |
| **Notifications push (vers client/chauffeur)** | ✅ | Existe (accepté/dispatché), via Expo —配置 compte Expo à finaliser. |
| **Email admin (nouvelle demande)** | ✅ | Existe via Resend. |
| **Email client (confirmation/récap)** | 🟡 | ✅ Email envoyé au client à la création de sa demande, à l'acceptation par un chauffeur (avec email + téléphone du chauffeur et récap complet de la course), et en cas de majoration de prix. Limitation opérationnelle : Resend est en mode sandbox (pas de domaine vérifié), donc ces emails ne partent réellement que vers l'adresse du compte Resend tant qu'un domaine n'est pas vérifié — à faire pour que les vrais clients les reçoivent. |
| **Authentification (client/chauffeur/admin)** | ✅ | Existe (Supabase Auth, 3 rôles). |

## Résumé
Suite à la demande explicite de Jim de rapprocher le back-end d'une copie conforme (2026-10-18), quatre chantiers ont été traités dans l'ordre de priorité qu'il a fixé : tarification complète (zones, jour/nuit, majorations, suppléments, mode Manuel), gestion des réservations côté admin (historique/filtres/export, création manuelle, ré-dispatch, majoration, étape de course), disponibilités + calendrier, et gestion détaillée des véhicules. Les écrans **toujours hors scope** (décision explicite de Jim, pour plus tard) restent : Apparence, TVA/facturation, Commissions, Apporteurs d'affaires, Statistiques avancées, Marketing (5 pages), module de réservation web, avis clients/notation.
