# Mise en ligne sur Google Play : guide pas à pas

Préparé le 03/11/2026 pour les deux applis : **Rennes VTC** (client, `com.rennesvtc.client`) et **Rennes VTC Driver** (chauffeur, `com.rennesvtc.driver`).
Les règles de Google évoluent : chaque point marqué « à vérifier » doit être relu dans la Play Console au moment de la saisie.

## 0. Ce qui est déjà prêt (rien à refaire)
- Noms de paquets, version 1.0.0, icônes 1024 px, fond noir opaque.
- Profil de build **production** (fichier `.aab`, numéro de version automatique) dans `apps/client/eas.json` et `apps/driver/eas.json`.
- Variables du build production déjà enregistrées sur Expo (adresse du serveur, Supabase, clé Google, fichier Firebase) pour les deux applis.
- Politique de confidentialité en ligne : `https://app-rennesvtc.onrender.com/confidentialite/` (mise à jour 27/10/2026).
- Page de suppression de compte (exigée par Google) : `https://app-rennesvtc.onrender.com/confidentialite/#suppression`. Le client peut aussi supprimer son compte dans l'appli (Mon compte, Supprimer mon compte).
- Position du chauffeur : **au premier plan uniquement** (pas de position en arrière-plan), donc pas de formulaire spécial « localisation en arrière-plan » à remplir.
- Aucune publicité, aucun paiement dans l'appli (le règlement se fait à bord).
- Visuels dans ce dossier : icône 512, image de présentation 1024×500, captures (voir §5). Textes : `fiche-client.md`, `fiche-chauffeur.md`. Réponses aux formulaires : `formulaires-play-console.md`.

## 1. Décision à prendre : type de compte développeur
Frais : **25 $ une seule fois**. Il faut une pièce d'identité, un téléphone et une adresse ; la vérification prend de quelques heures à quelques jours.

| | Compte **personnel** | Compte **organisation** |
|---|---|---|
| Pour qui | Une personne (ton cas d'entrepreneur individuel est souvent traité ainsi) | Une société ou une entreprise identifiée |
| Pièce en plus | Aucune | **Numéro D-U-N-S** (gratuit via Dun & Bradstreet, délai jusqu'à 30 jours), site web de l'entreprise |
| Test obligatoire avant la production | **Oui : test fermé avec au moins 12 testeurs pendant 14 jours consécutifs** (comptes créés depuis novembre 2023, à vérifier) | Non (à vérifier) |
| Nom affiché sur la fiche | Ton nom | Nom de l'entreprise |

**Ma recommandation :** compte **personnel**, plus rapide à ouvrir, et tu as largement de quoi trouver 12 testeurs (tes chauffeurs et tes clients). Si tu préfères que « Rennes VTC » apparaisse comme éditeur, demande le D-U-N-S dès maintenant (il est gratuit et indépendant de tout le reste).
Utilise un compte Google **dédié à l'entreprise** (par exemple rennesvtc@gmail.com), pas un compte personnel : il sera propriétaire des applis.

## 2. Ordre des opérations (délai total estimé : 3 à 4 semaines)
1. **Créer le compte développeur** (`play.google.com/console`), régler les 25 $, envoyer la pièce d'identité. *Délai : 1 à 5 jours.*
2. **Valider le design dans Expo Go** (en cours). Un seul build final ensuite : le quota gratuit Expo est limité.
3. **Construire les deux `.aab`** (je lance, avec ton accord) :
   ```
   cd apps/client && NODE_OPTIONS=--use-system-ca npx.cmd --yes eas-cli build --platform android --profile production --non-interactive --no-wait
   cd apps/driver && NODE_OPTIONS=--use-system-ca npx.cmd --yes eas-cli build --platform android --profile production --non-interactive --no-wait
   ```
   *Délai : 30 à 90 minutes par build en file gratuite.* Télécharger les `.aab` depuis le lien Expo.
4. **Créer les deux applis dans la Play Console** (langue par défaut : français, appli gratuite) et remplir : fiche (textes + visuels), politique de confidentialité, sécurité des données, classification du contenu, public cible, accès à l'appli. Tout est préparé dans ce dossier.
5. **Test fermé** : importer le `.aab`, ajouter au moins 12 testeurs (adresses Gmail, ou un groupe Google), leur envoyer le lien d'inscription. Ils doivent rester inscrits **14 jours**. *Délai : 14 jours.*
6. **Demander l'accès à la production** dans la console, répondre au questionnaire (retours des testeurs, corrections faites).
7. **Examen par Google**, puis publication. *Délai : de quelques heures à 7 jours, souvent plus long pour une première appli.*

**Astuce pour l'appli chauffeur :** c'est un outil réservé à tes chauffeurs. Tu peux la **laisser en test fermé** (pas de publication publique) : tes chauffeurs l'installent via un lien d'invitation et tu n'as pas à passer l'examen « production ». À décider avec toi.

## 3. À préparer de ton côté
- Un compte Google d'entreprise pour la console, la pièce d'identité, une carte pour les 25 $.
- **Douze testeurs** (hors toi) avec une adresse Gmail : chauffeurs, proches, clients fidèles.
- **Deux comptes de démonstration pour l'examen Google** (rubrique « Accès à l'appli ») : un compte client et un compte chauffeur, avec quelques courses de test. Choisis une adresse du type `revue-client@rennesvtc.com` ; je les crée dans la base quand tu me donnes le feu vert, et le mot de passe ne sera noté que dans la console, jamais dans le dépôt.
- Une adresse de contact publique (déjà `contact@rennesvtc.com`) et ton numéro (07 68 42 52 62).

## 4. Points techniques à connaître avant de soumettre
- **Clé Google Maps / Places** : elle est embarquée dans les applis. À restreindre dans la console Google Cloud (limiter aux API Places et Directions, plafonner le quota). Une restriction « par application Android » ne fonctionne pas telle quelle avec nos appels réseau directs ; le plus propre est de faire passer ces appels par le serveur (les routes `/public/places/...` existent déjà). Chantier séparé, **non bloquant** pour Google Play.
- **Hébergement** : le serveur Render doit rester en formule payante, sinon il s'endort et les applis semblent en panne pendant l'examen.
- **Données de test** : nettoyer les courses et chauffeurs de test avant l'ouverture au public.
- **Adresse de la politique de confidentialité** : l'adresse Render fonctionne. Plus tard, une adresse à vos couleurs (`reservation.rennesvtc.com`) sera plus propre ; il faudra alors la mettre à jour dans la console.
- **Même icône pour les deux applis** : elles se distinguent par le nom. On peut ajouter une pastille « Driver » à l'icône chauffeur si tu veux.
- **Empreinte de signature** : après le premier envoi, Google signe l'appli lui-même (signature Play App Signing). Si on restreint un jour une clé à l'application Android, il faudra l'empreinte SHA-1 affichée dans la console (Intégrité de l'appli).
- **Mises à jour** : chaque nouvelle version doit avoir un numéro supérieur ; c'est automatique avec le profil `production`.

## 5. Contenu du dossier
```
docs/google-play/
  00-guide-mise-en-ligne.md        ce guide
  fiche-client.md                  textes de la fiche Rennes VTC (client)
  fiche-chauffeur.md               textes de la fiche Rennes VTC Driver
  formulaires-play-console.md      réponses prêtes à copier (sécurité des données, classification, public cible...)
  client/    icone-512x512.png, image-de-presentation-1024x500.png, captures/ (5 captures)
  chauffeur/ icone-512x512.png, image-de-presentation-1024x500.png, captures/ (1 capture)
```
Les captures sont des rendus fidèles de l'appli avec des données fictives. **Google préfère de vraies captures** : quand l'appli tourne sur ton téléphone (Expo Go), fais 4 à 8 captures d'écran de chaque appli (chauffeur : course disponible, saisie d'une réservation, course en cours, menu) et remplace-les. Il en faut au minimum **2 par appli** (le dossier chauffeur n'en contient qu'une pour l'instant).
