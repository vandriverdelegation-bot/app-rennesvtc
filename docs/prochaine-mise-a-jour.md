# Prochaine mise à jour des apps (build Android du dimanche 1er novembre 2026)

Quota de builds Expo gratuit épuisé jusqu'au 01/11/2026 (ou plan Starter). Tout ce qui suit est **déjà dans le code (GitHub, branche main)** mais **pas dans les APK installés**.

## Appli chauffeur
- Saisie d'une **mise à disposition** (durée en heures, 3 par défaut, prix = tarif horaire de la gamme) en plus du trajet.
- Le compte **propriétaire** voit toujours « Saisir une réservation » (plus besoin de la case « Créer »).
- **Calendrier et heure** pour choisir la date/l'heure (`DateTimeFields.js`, JS pur, sans module natif).
- Propriétaire : boutons **Confort / Affaires / Van** pour changer la gamme d'une course déjà acceptée.
- Page principale : onglets **Courses disponibles** / **Mes réservations à venir** + petit calendrier (`RideCalendar.js`). Une course acceptée pour plus tard reste dans « à venir » ; elle s'ouvre seule si elle est commencée, immédiate ou dans moins de 1 h 30.
- **Chat** avec le client / donneur d'ordre dans « Course en cours » (`RideChat.js`), ouvert dès qu'un chauffeur est attribué.
- Étape « Sur place » : bouton **Prévenir le client par SMS** (ouvre l'appli SMS avec le message prêt, gratuit, un appui sur Envoyer).
- Notifications : l'écran affiche la **vraie raison** de l'échec (la cause de l'échec actuel est inconnue : Firebase est bien dans l'APK).

## Appli client
- **Continuer avec Google** (schéma `rennesvtc-client://auth`) + demande du téléphone après une inscription Google.
- Calendrier et heure pour la date de course et le retour.
- **Chat** avec son chauffeur sur une course acceptée (`RideChat.js`).
- Notifications : même message d'erreur détaillé.

## Déjà en ligne (backend, pas besoin de build)
- Admin : bouton **Assigner ce chauffeur** dans une réservation (même en dispatch auto) ; la page de suivi du donneur d'ordre se rafraîchit toutes les 4 s et propose le **chat** avec le chauffeur.
- Migration `040_chat_courses.sql` à appliquer sur Supabase pour que le chat fonctionne.
- Admin : gamme modifiable à tout moment, suppression d'une réservation (confirmation, définitive).
- Fiche de mission (nouveau bon de commande, licence 035 21 03 79 02, n° de dossier = 8 premiers caractères de l'id).
- Faille d'inscription corrigée (migration 039), SMTP Resend dans Supabase, Google activé dans Supabase.

## Quand le quota est remis (dimanche 01/11)
```
cd apps/client && NODE_OPTIONS=--use-system-ca npx.cmd --yes eas-cli build --platform android --profile preview --non-interactive --no-wait
cd apps/driver && NODE_OPTIONS=--use-system-ca npx.cmd --yes eas-cli build --platform android --profile preview --non-interactive --no-wait
```
Ne pas relancer de builds de diagnostic inutiles (quota). Ne pas remettre `react-native-maps` (plantage au lancement).

## À tester sur le téléphone après installation
1. Chauffeur : saisir une mise à disposition ; calendrier + heure ; onglet « à venir » avec 2-3 réservations futures ; changer la gamme d'une course.
2. Client : « Continuer avec Google » (retour dans l'app, demande du téléphone) ; inscription par e-mail (plus d'« email rate limit »).
3. Notifications chauffeur : activer ; lire le message d'erreur s'il persiste ; réservation test → alerte propriétaire.
