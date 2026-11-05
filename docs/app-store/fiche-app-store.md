# Fiche App Store (iPhone) : Rennes VTC et Rennes VTC Driver

Préparée le 05/11/2026, à copier dans **App Store Connect** une fois le compte Apple Developer actif. Langue principale : **Français**. Applications gratuites, sans achat intégré.
Identifiants : `com.rennesvtc.client` et `com.rennesvtc.driver`. Les limites de caractères sont celles d'Apple (à vérifier dans la console).

---
## A. Rennes VTC (client)

**Nom (30 max)** : `Rennes VTC`
**Sous-titre (30 max)** : `Votre chauffeur privé`
**Texte promotionnel (170 max, modifiable sans nouvelle version)** :
```
Réservez votre chauffeur privé à Rennes en quelques secondes : tarif affiché avant de valider, suivi de votre course en direct.
```
**Mots-clés (100 max, séparés par des virgules, sans espace)** :
```
vtc,rennes,chauffeur,taxi,aéroport,gare,transfert,réservation,bretagne,voiture
```
*(Apple déconseille de répéter le nom de l'appli ; le mot « taxi » reste un mot-clé de recherche des utilisateurs : à garder ou retirer selon votre ligne éditoriale.)*

**Description (4 000 max)** : reprendre la description complète de `docs/google-play/fiche-client.md`, en remplaçant la ligne « Créez votre compte avec votre adresse e-mail ou votre compte Google » par :
```
1. Créez votre compte avec votre adresse e-mail, votre compte Google ou Apple.
```
**Catégorie principale** : Voyages. **Secondaire** : Navigation.
**URL d'assistance** : `https://rennesvtc.com` · **URL marketing** : `https://rennesvtc.com`
**Politique de confidentialité** : `https://app-rennesvtc.onrender.com/confidentialite/`
**Droits d'auteur** : `2026 Rennes VTC`
**Nouveautés (première version)** : `Première version de l'application Rennes VTC : réservez votre chauffeur privé, suivez votre course en direct et retrouvez vos réservations.`

---
## B. Rennes VTC Driver (chauffeur)

**Nom** : `Rennes VTC Driver`
**Sous-titre** : `Réservé aux chauffeurs`
**Texte promotionnel** : `Application de travail des chauffeurs partenaires de Rennes VTC : courses, étapes, messagerie, bons de commande.`
**Mots-clés** : `chauffeur,vtc,rennes,courses,pro,transport,planning`
**Description** : reprendre `docs/google-play/fiche-chauffeur.md`.
**Catégorie** : Économie et entreprise (« Business »). Même contacts et même politique de confidentialité que le client.
**Distribution conseillée** : **TestFlight** (équipe interne, jusqu'à 100 testeurs) ou « Distribution non répertoriée » : l'appli n'a pas vocation à être cherchée par le public. À décider avec Jim.

---
## C. Questionnaire de classification par âge
- Toutes les questions de contenu (violence, sexe, langage, drogues, jeux d'argent, peur, etc.) : **Aucun / Non**.
- Fonctions sans restriction d'accès web, contenu généré par l'utilisateur : le client peut écrire des messages à son chauffeur → répondre **Oui** à « messagerie / contenu généré par l'utilisateur » si demandé (messages entre deux personnes d'une même course, pas de contenu public).
- Résultat attendu : **4+**. Public : adultes (service réservé aux 18 ans et plus) : à mentionner dans les notes de revue.

## D. Confidentialité de l'app (étiquettes « App Privacy »)
**Suivi (tracking) : NON** pour les deux applis (aucun identifiant publicitaire, aucune donnée croisée avec d'autres entreprises). Pas de fenêtre ATT.

### Client : « Données associées à l'utilisateur », finalité « Fonctionnalités de l'app »
| Type Apple | Donnée |
|---|---|
| Coordonnées | Nom ; adresse e-mail ; numéro de téléphone |
| Coordonnées | Adresse physique (départ et destination de la course) |
| Achats | Historique d'achats (prix des courses) |
| Contenu de l'utilisateur | Autres contenus (messages avec le chauffeur) |
| Identifiants | ID de l'appareil (jeton de notification) |

Pas de position, de photos, de contacts, de santé, de données de plantage ou d'analyse.

### Chauffeur : mêmes lignes, plus
| Type Apple | Donnée |
|---|---|
| Position | Position précise (au premier plan : suivi de la course et répartition) |
| Coordonnées | Nom, e-mail, numéro de téléphone |

## E. Notes pour l'équipe de revue d'Apple (à coller dans « Informations de revue »)
**Client** :
```
Rennes VTC is a private-driver (VTC) booking service in Rennes, France. The app is in French. Sign in with the demo account below (e-mail and password), then tap "Commander une course" to request a ride and open "Réservations" to see bookings. Rides are fulfilled by our own drivers; payment is made on board (no in-app purchase). Account deletion: Compte > Supprimer mon compte. Sign in with Apple and Google are also available.
```
**Chauffeur** :
```
Rennes VTC Driver is the work app of our partner drivers. Accounts are created by the administrator on invitation (no public sign-up). Use the demo account below. A test ride is available in "Courses disponibles". Location is used only while the app is open, to share the ride tracking with the passenger.
```
Comptes de démonstration : à fournir dans la console au moment de soumettre (client : `docs/google-play/comptes-demo.txt`, déjà créé ; chauffeur : à créer ce jour-là puis à supprimer après l'examen, voir le guide Google Play §3).

## F. Points techniques propres à l'iPhone
- **Se connecter avec Apple** : ajouté à l'appli client (iPhone uniquement). Apple l'exige dès qu'une autre connexion externe (Google) est proposée. Pour qu'il fonctionne, après l'ouverture du compte Apple : activer le fournisseur **Apple** dans Supabase (Authentication, Providers) avec un identifiant de service (« Services ID »), l'ID d'équipe Apple et une clé privée. Je guide pas à pas à ce moment-là.
- **Notifications** : la clé APNs est créée par Expo lors du premier build iPhone (elle utilise votre compte Apple). La sonnerie `nouvelle_course.wav` est reprise sur iPhone ; les « canaux » Android n'existent pas sur iPhone, la sonnerie vient du fichier son.
- **Chiffrement** : déjà déclaré (`usesNonExemptEncryption: false`), pas de questionnaire d'exportation.
- **Captures d'écran** : tailles acceptées 6,9 pouces (1 290 × 2 796). Fichiers prêts dans `docs/app-store/captures/`. Il en faut de 1 à 10 par appli.
- **Suppression de compte dans l'appli** (exigence Apple) : présente côté client. Côté chauffeur, les comptes sont créés et supprimés par l'administrateur (à préciser dans les notes de revue, ce qui est fait ci-dessus).
