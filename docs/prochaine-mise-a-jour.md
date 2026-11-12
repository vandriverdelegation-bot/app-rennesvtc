# Prochaine mise à jour des apps (build Android du dimanche 1er novembre 2026)

Quota de builds Expo gratuit épuisé jusqu'au 01/11/2026 (ou plan Starter). Tout ce qui suit est **déjà dans le code (GitHub, branche main)** mais **pas dans les APK installés**.

## Récapitulatif du prochain build (mis à jour le 12/11/2026) : à lancer seulement sur ordre de Jim
Consigne de Jim (12/11) : ne pas cumuler les builds, regrouper ses demandes. Derniers APK installés : client v5, chauffeur v9 (06/11). Production Play Store : .aab déjà envoyés (client en test fermé, chauffeur en brouillon de test interne).
Dans le code mais PAS dans les APK installés (demandent le build) :
- Les deux apps : modes clair / sombre (interrupteur), clé Google Maps retirée (adresses via le serveur).
- Chauffeur : bouton « Passager absent (no show) », sonnerie wav (canal courses_v3), réservations à venir en pleine course, pastilles Trajet aller / retour, note de Rennes VTC affichée.
- Client : pastilles Trajet aller / retour, bouton « Se connecter avec Apple » (iPhone seulement).
- Migration 048 (aller-retour scindé) : APPLIQUÉE le 12/11. Migration 047 (no show, rappel) : appliquée.
Déjà en ligne sans build : rappel 1 h, notification « Course attribuée » à la création admin, moyen de paiement modifiable, bon de commande de toute course (back-office), réservations en cours triées, historique et calendrier sur la date de course, mot de passe chauffeur modifiable, note chauffeur à la création.

## Design (choisi le 01/11/2026)
- **Appli chauffeur : Nuit verte** (noir et vert, identité actuelle affinée). Palette dans `apps/driver/applyTheme.js`.
- **Appli client : refaite le 03/11 d'après la maquette de Jim** (`Accueil client-html.zip`) : noir chaud #0B0C0B, vert #5BD42A, titres Outfit, texte Inter. Remplace « Jour ivoire ». Détail dans la section Appli client.
- Chauffeur : boutons plus grands (52 px mini), actions de la course fixées en bas de l'écran (en route / arrivé / SMS / terminer).
- Pas fait côté chauffeur : barre de navigation du bas. Maquettes : `docs/propositions-design-apps.pdf`.

## Appli chauffeur
- **Design 02/11 (fourni par Jim, image de référence)** : en-tête avec logo + château et bouton menu rond vert, onglets en pastilles, « Saisir une réservation » en ligne d'action, carte de course à contour vert lumineux (date, prix en badge, pastilles avec pictogrammes, trajet, distance), boutons arrondis (Accepter, Dispatcher, Refuser). Pictogrammes en PNG (`assets/ui`), composants dans `ui.js`, couleurs dans `applyTheme.js`.
- Saisie d'une **mise à disposition** (durée en heures, 3 par défaut, prix = tarif horaire de la gamme) en plus du trajet.
- Le compte **propriétaire** voit toujours « Saisir une réservation » (plus besoin de la case « Créer »).
- **Calendrier et heure** pour choisir la date/l'heure (`DateTimeFields.js`, JS pur, sans module natif).
- Propriétaire : boutons **Confort / Affaires / Van** pour changer la gamme d'une course déjà acceptée.
- Page principale : onglets **Courses disponibles** / **Mes réservations à venir** + petit calendrier (`RideCalendar.js`). Une course acceptée pour plus tard reste dans « à venir » ; elle s'ouvre seule si elle est commencée, immédiate ou dans moins de 1 h 30.
- **Chat** avec le client / donneur d'ordre dans « Course en cours » (`RideChat.js`), ouvert dès qu'un chauffeur est attribué.
- Saisie d'une réservation : champ **Email du client (facultatif)** ; s'il est renseigné et que le chauffeur prend la course, le client reçoit la confirmation.
- Saisie d'une réservation : mode de règlement **En compte** disponible (en plus de CB à bord et Espèces) ; le serveur l'accepte déjà.
- Étape « Sur place » : bouton **Prévenir le client par SMS** (ouvre l’appli SMS avec le message prêt, gratuit, un appui sur Envoyer ; texte validé le 02/11 : « Votre chauffeur est bien arrivé sur place et vous attend… »).
- Notifications : l'écran affiche la **vraie raison** de l'échec. Cause du blocage trouvée le 02/11 : migrations 012/017 avaient retiré le droit d'écrire push_token (corrigé par la migration 041, appliquée ; notifications OK).
- **Sonnerie spéciale « Nouvelles courses »** : nouvelle sonnerie fournie par Jim le 03/11 (`apps/driver/assets/sounds/nouvelle_course.wav`, 6,4 s, remplace l'ancienne .aac), canal Android **`courses_v3`** (importance max, l'ancien `courses_v2` est supprimé) créé par l'app et enregistré dans profiles.push_channel ; le serveur envoie le canal propre à chaque appareil. Demande un build.
- **Bouton « Passager absent (no show) »** (03/11) : visible à l'étape « Sur place ». Après confirmation, la course est clôturée (status completed, ride_step no_show) et le client / donneur d'ordre est prévenu (push, e-mail, page de suivi). Admin : étape « Non presentation ». Demande la migration 047 + un build.
- **Rappel 1 h avant la course** (03/11, côté serveur, actif dès la migration 047) : notification au chauffeur (et aux chauffeurs supplémentaires) quand une course acceptée démarre dans moins d'1 h, une seule fois (rides.reminder_sent_at), avec la sonnerie. Fonctionne aussi avec les apps déjà installées.
- **Saisie semi-automatique du client** (nom ou téléphone, 2 lettres) dans « Saisir une réservation » : remplit téléphone et e-mail. Fichier clients : table `clients` (migration 042, 1 885 clients importés le 02/11 depuis la base nettoyée), mise à jour automatiquement à chaque saisie.

- **Mission partagée (03/11)** : un chauffeur supplémentaire voit la mission dans « Mes réservations à venir » (lecture seule, bouton Bon de commande). Le chauffeur principal gère les étapes. Côté back-office c'est déjà actif (migration 046).

## Appli client
- **Nouvelle présentation (03/11, maquette fournie par Jim)** :
  - Accueil : en-tête (logo étoile, cloche → notifications, initiales → mes informations), « Bonjour {prénom}, Où allez-vous aujourd'hui ? », gros bouton « Commander une course », raccourcis **Aéroport / Gare / Domicile** (destination pré-remplie ; Domicile mémorisé la première fois), onglets **À venir / Passées**, carte « Une question ? » (WhatsApp), barre de navigation flottante Accueil / Réservations / Compte.
  - Carte de réservation : statut, « Dans X jours », date et heure en grand, prix, mini-plan stylisé, itinéraire, pastilles gamme / passagers / bagages, boutons Appeler, WhatsApp et « ⋯ » (annuler, bloqué à moins de 24 h). Chat toujours présent sur une course acceptée.
  - Passées : « Recommander ce trajet » pré-remplit le formulaire. Formulaire, compte et connexion passent au thème sombre.
  - Écarts voulus avec la maquette : pas de bouton « Modifier » (n'existe pas côté client) ni « Facture » (pas de fonction facture) ; pas de pastille verte sur la cloche.
  - Code : `screens/HomeView.js`, `BottomNav.js`, `RideCard.js`, `RouteSketch.js`, `ui.js`, `icons.js`, `lib/format.js`, `applyTheme.js` ; pictogrammes PNG dans `assets/ui`, polices dans `assets/fonts` (chargées par `expo-font`, ajouté à `package.json`, JS seul). Captures : `docs/client_*.png`.
  - Pas encore testé sur téléphone : raccourcis Aéroport / Gare (Google Places), « Recommander ce trajet », rendu des polices. Voir sur Expo Go (port 8082) avant le build.
- **Continuer avec Google** (schéma `rennesvtc-client://auth`) + demande du téléphone après une inscription Google.
- Calendrier et heure pour la date de course et le retour.
- **Chat** avec son chauffeur sur une course acceptée (`RideChat.js`).
- Notifications : même message d'erreur détaillé.

## Mode clair / mode sombre (05/11, les deux apps)
- Interrupteur « Mode clair » dans Réglages (chauffeur) et Mon compte (client) ; choix mémorisé sur le téléphone, sombre par défaut. Code : `packages/shared/theme.js` (setThemeMode, themedStyles, useThemeMode, ThemeSwitch), palette claire ivoire + vert #2F8F10 ; pictogrammes recolorés en mode clair. Demande un build.
- **Course attribuée** : le chauffeur reçoit la notification quand l'admin lui attribue une course (bouton « Assigner » ET création d'une réservation avec chauffeur choisi). Côté serveur, déjà en ligne.

- **Réservations à venir pendant une course** (05/11, appli chauffeur) : en pleine course, onglets en haut « Course en cours » / « Mes réservations à venir (N) » ; la liste (calendrier, courses, missions partagées) s'ouvre sans quitter la course, avec le bon de commande de chaque réservation. Demande un build.
- **Back-office : moyen de paiement modifiable à tout moment** (05/11, déjà en ligne) : dans l'onglet Paiement de la réservation, le moyen de paiement (CB à bord / Espèces / En compte) s'enregistre dès qu'on le change, même sur une réservation terminée, sans toucher au tarif (bouton « Enregistrer le tarif » séparé). Le chauffeur le voit dans les 3 secondes.

- **Clé Google Maps retirée des applis** (05/11) : les adresses et itinéraires passent par le serveur (`/public/places/*`, nouvelle route `/public/route`, limite de 120 appels par minute et par adresse IP). Serveur déjà en ligne et testé ; les applis installées gardent l'ancien fonctionnement jusqu'au build. **Après ce build et la mise à jour de tous les téléphones** : changer la clé dans la console Google Cloud (limiter à Places et Directions, plafonner le quota) puis mettre la nouvelle clé dans Render (`GOOGLE_MAPS_API_KEY`) ; l'ancienne, présente dans les anciens APK, doit être révoquée.
- **Se connecter avec Apple** (appli client, iPhone uniquement, 05/11) : exigé par Apple dès que « Continuer avec Google » est proposé. Le bouton est codé ; il ne fonctionnera qu'après activation du fournisseur Apple dans Supabase (voir `docs/app-store/fiche-app-store.md`, §F).

- **Aller-retour scindé en deux courses** (11/11) : à la saisie (appli client, module web, back-office, appli chauffeur), la réservation devient 2 courses : un trajet aller et un trajet retour (départ et arrivée inversés, arrêts inversés, date de retour, même client, gamme, paiement et même tarif affiché pour chaque trajet), chacune avec son chauffeur, ses étapes et son lien de suivi. Étiquette « Trajet aller / Trajet retour » dans l'appli chauffeur et l'appli client. **Migration 048 à appliquer AVANT d'installer les prochains builds** (colonnes leg et linked_ride_id lues par les applis). Le tarif n'est pas doublé ni partagé : chaque trajet reprend le prix saisi (à confirmer avec Jim).

- **Note pour le chauffeur** (12/11) : champ à la création d'une réservation dans le back-office (déjà en ligne) et dans l'onglet Notes d'une réservation existante (existait) ; la note est imprimée sur le bon de commande (déjà le cas) et affichée dans l'appli chauffeur (« Note de Rennes VTC », sur la course en cours, les courses disponibles et les réservations à venir). Demande un build pour l'appli.

- **Bon de commande de toute course depuis le back-office** (12/11, déjà en ligne) : bouton « Bon de commande » dans l'en-tête de chaque réservation (créée par un client, le web, le back-office ou un chauffeur) ; PDF du chauffeur principal, ou sans chauffeur si la course n'est pas attribuée. Route `GET /admin/rides/:id/bon-commande` (admin uniquement).

- **Tablette d'accueil** (12/11) : image WELCOME avec le nom du client (nom du client, ou « Nom sur la tablette d'accueil » saisi au back-office). Serveur/e-mail/back-office en ligne ; appli chauffeur : bouton « Tablette d'accueil » (course en cours + réservations à venir, plein écran tourné) = demande le build. Migration 049 appliquée.

- **Navettes événementielles** (module back-office, sans build d'appli) : étapes 1 (back-office) et 2 (page invité /navette/{code}, migration 052 : inscription sécurisée sans surréservation) faites le 13/11 (tables navette_events / navette_departures / navette_signups = migration 050 appliquée ; menu « Navettes » ; événements, départs auto avec passage après minuit, logo). Étapes suivantes : 3 QR + chevalet PDF, 4 suivi de soirée (suppression auto à 30 jours, alerte de remplissage, liste imprimable). Code : backend/src/navettes.js (+ test navettes.test.js), backend/public/admin/navettes.js.

## Déjà en ligne (backend, pas besoin de build)
- Module web de réservation : **choix de la langue avec drapeaux** (FR, EN, ES, DE, IT) ; fichiers `backend/public/reserver/i18n.js` + `index.html`. Les e-mails et messages d'erreur du serveur restent en français.
- Module web : **email obligatoire** (vérifié aussi côté serveur). Admin : suivi au donneur d'ordre par **WhatsApp** (bouton dans la réservation + lien après création) quand il n'y a pas d'email.
- Admin : bouton **Assigner ce chauffeur** dans une réservation (même en dispatch auto) ; la page de suivi du donneur d'ordre se rafraîchit toutes les 4 s et propose le **chat** avec le chauffeur.
- Migration `040_chat_courses.sql` à appliquer sur Supabase pour que le chat fonctionne.
- Admin : gamme modifiable à tout moment, suppression d'une réservation (confirmation, définitive).
- Fiche de mission (nouveau bon de commande, licence 035 21 03 79 02, n° de dossier = 8 premiers caractères de l'id).
- Faille d'inscription corrigée (migration 039), SMTP Resend dans Supabase, Google activé dans Supabase.

## Déjà en ligne (02/11) : fichier clients
- Back-end admin : saisie semi-automatique sur « Nom » du client et « Donneur d'ordre » (route `GET /clients/search`, réservée admin / chauffeurs autorisés ; `POST /clients/remember`). Fichier source nettoyé : `docs/clients-nettoyes.xlsx` (ignoré par git, données personnelles).

## Quand le quota est remis (dimanche 01/11)
```
cd apps/client && NODE_OPTIONS=--use-system-ca npx.cmd --yes eas-cli build --platform android --profile preview --non-interactive --no-wait
cd apps/driver && NODE_OPTIONS=--use-system-ca npx.cmd --yes eas-cli build --platform android --profile preview --non-interactive --no-wait
```
Ne pas relancer de builds de diagnostic inutiles (quota). Ne pas remettre `react-native-maps` (plantage au lancement).
**Consigne de Jim (03/11) : ne plus envoyer de builds au fil de l'eau.** Ses retouches de design se valident dans Expo Go (PC et téléphone sur le même Wi-Fi, `npx.cmd expo start --lan`, avec `NODE_OPTIONS=--use-system-ca` sinon le serveur plante sur le certificat) ; un seul build final pour les deux apps, quand il l'aura décidé. Expo Go ne permet pas de tester les notifications ni la sonnerie.

## À tester sur le téléphone après installation
1. Chauffeur : saisir une mise à disposition ; calendrier + heure ; onglet « à venir » avec 2-3 réservations futures ; changer la gamme d'une course.
2. Client : « Continuer avec Google » (retour dans l'app, demande du téléphone) ; inscription par e-mail (plus d'« email rate limit »).
3. Notifications chauffeur : activer ; lire le message d'erreur s'il persiste ; réservation test → alerte propriétaire.
