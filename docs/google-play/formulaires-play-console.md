# Réponses aux formulaires de la Play Console

À recopier dans la console, rubrique **Contenu de l'appli** (une fois par appli). Les intitulés peuvent changer légèrement : en cas de doute, choisir la réponse la plus transparente.

## 1. Politique de confidentialité
`https://app-rennesvtc.onrender.com/confidentialite/`

## 2. Accès à l'appli (comptes de démonstration pour l'examen)
- **Rennes VTC (client)** : « Toutes les fonctionnalités nécessitent un compte. » Fournir l'e-mail et le mot de passe du compte de démonstration client, avec l'indication : « Pour tester : Commander une course, puis consulter Mes réservations. Les courses de test sont supprimées régulièrement. »
- **Rennes VTC Driver (chauffeur)** : « Application réservée aux chauffeurs partenaires ; les comptes sont créés par l'administrateur sur invitation. » Fournir l'e-mail et le mot de passe du compte de démonstration chauffeur. Préciser : « Une course de test est disponible dans l'onglet Courses disponibles. »
- Les identifiants se saisissent **uniquement dans la console**. Ne jamais les écrire dans le dépôt.

## 3. Publicités
**Non**, l'appli ne contient pas de publicité.

## 4. Public cible et contenu
- Tranche d'âge : **18 ans et plus** (service de transport réservé aux adultes). Cela évite les règles « Familles ».
- L'appli n'est pas destinée aux enfants et n'est pas attrayante pour eux.

## 5. Classification du contenu (questionnaire IARC)
- Catégorie : **Utilitaire, productivité, communication ou autre**.
- Violence, sexe, langage grossier, drogues, jeux d'argent, peur : **Non** partout.
- Les utilisateurs peuvent-ils communiquer entre eux ? **Oui** (messagerie entre client et chauffeur sur une course). Cela ajoute une mention « interactions entre utilisateurs », sans changer la note d'âge.
- Partage de la position avec d'autres utilisateurs : **Oui** (le client voit le chauffeur en route).
- Achats numériques : **Non**.
- Résultat attendu : tous publics (PEGI 3 / « Pour tous »), avec les mentions ci-dessus.

## 6. Applis gouvernementales, santé, finance, actualités, COVID-19
**Non** à toutes (pas une appli gouvernementale, pas de fonction de santé, pas de prêt ni de portefeuille, pas d'actualités).
Fonctions financières : l'appli ne propose **ni paiement ni transfert d'argent** (règlement à bord).

## 7. Sécurité des données
### Questions générales
- Collectez-vous ou partagez-vous des données utilisateur ? **Oui**
- Toutes les données sont-elles chiffrées en transit ? **Oui** (HTTPS)
- Les utilisateurs peuvent-ils demander la suppression de leurs données ? **Oui**
  - Lien : `https://app-rennesvtc.onrender.com/confidentialite/#suppression`
  - Client : suppression directe dans l'appli (Mon compte, Supprimer mon compte).
  - Chauffeur : sur demande à `contact@rennesvtc.com`.
- Création de compte dans l'appli : **client : oui** (e-mail et mot de passe, ou Google) ; **chauffeur : non** (compte créé par l'administrateur sur invitation).

### Types de données déclarés : appli client
| Catégorie | Donnée | Collectée | Partagée | Obligatoire | Finalité |
|---|---|---|---|---|---|
| Informations personnelles | Nom | Oui | Oui, avec le chauffeur de la course | Oui | Fonctionnalités de l'appli, gestion du compte |
| Informations personnelles | Adresse e-mail | Oui | Non | Oui | Fonctionnalités, gestion du compte, communications |
| Informations personnelles | Numéro de téléphone | Oui | Oui, avec le chauffeur de la course | Oui | Fonctionnalités de l'appli |
| Informations personnelles | Adresse (départ, destination) | Oui | Oui, avec le chauffeur de la course | Oui | Fonctionnalités de l'appli |
| Informations financières | Historique d'achats (prix des courses) | Oui | Non | Oui | Fonctionnalités de l'appli |
| Messages | Autres messages dans l'appli | Oui | Oui, avec le chauffeur de la course | Non | Fonctionnalités de l'appli |
| Identifiants | Identifiant d'appareil ou autre (jeton de notification) | Oui | Non | Non | Fonctionnalités de l'appli (notifications) |

Position de l'appareil, photos, contacts, journaux de plantage, données de santé : **non collectés** dans l'appli client.

### Types de données déclarés : appli chauffeur
| Catégorie | Donnée | Collectée | Partagée | Obligatoire | Finalité |
|---|---|---|---|---|---|
| Informations personnelles | Nom, e-mail, téléphone | Oui | Oui (nom et téléphone avec le client de la course) | Oui | Fonctionnalités, gestion du compte |
| Position | Position précise | Oui | Oui, avec le client de la course (suivi) | Oui | Fonctionnalités de l'appli (suivi, répartition des courses) |
| Informations financières | Historique d'achats (prix des courses) | Oui | Non | Oui | Fonctionnalités de l'appli |
| Messages | Autres messages dans l'appli | Oui | Oui, avec le client de la course | Non | Fonctionnalités de l'appli |
| Identifiants | Identifiant d'appareil ou autre (jeton de notification) | Oui | Non | Non | Fonctionnalités (notifications) |

Les documents professionnels des chauffeurs sont fournis sur la page web d'inscription, pas dans l'appli.

**Note sur « Partagée » :** les prestataires qui traitent les données pour notre compte (Supabase, Resend, Expo, Google Maps) ne comptent pas comme du « partage » au sens de Google. Les transferts au chauffeur ou au client concerné par une course sont déclarés par prudence : mieux vaut trop déclarer que pas assez (à confirmer dans la console).

## 8. Autorisations de l'appli
- **Chauffeur** : position précise et approximative, **au premier plan seulement** (pas d'accès en arrière-plan) ; notifications. Texte affiché à l'utilisateur : « Rennes VTC Driver utilise votre position pour suivre la course en cours et la partager avec le client une fois en route. »
- **Client** : notifications uniquement.
- Aucun accès aux photos, vidéos, contacts, SMS ni journal d'appels. (Le message d'arrivée ouvre l'appli SMS du téléphone, sans autorisation spéciale.)

## 9. Autres déclarations
- Appli de VPN, dons, jeux d'argent, services de santé : **non**.
- Identifiant publicitaire : **non utilisé**.
- Fonction de suppression de compte : voir §7.
