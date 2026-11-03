# Prochaine mise à jour des apps (build Android du dimanche 1er novembre 2026)

Quota de builds Expo gratuit épuisé jusqu'au 01/11/2026 (ou plan Starter). Tout ce qui suit est **déjà dans le code (GitHub, branche main)** mais **pas dans les APK installés**.

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
